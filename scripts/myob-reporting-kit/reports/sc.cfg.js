MK.app({
  title: 'Statement of Cash Flows', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', prev_day: '2026-08-31', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month_td","a":"custom","c":"none","v":"detail"}' },
  uses: { pnl: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss_3m (the period)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (account types: which accounts are cash and which activity each belongs to)', company_files: 'list_company_files' },
  views: [['detail', 'Expanded (category lines)'], ['summary', 'Collapsed (activities)']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['pnl', 'bs_open', 'bs_close'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Profit and Loss and both Balance Sheets loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.pnl || !c.data.bs_open || !c.data.bs_close) return {};
    var idx = MK.accounts(c.data.accounts), pl = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT), bs = MK.breakdown([c.data.bs_open, c.data.bs_close], idx, MK.BS_LAYOUT);
    var cf = MK.cashMoves(bs, pl, from, to, c.fy && c.fy.month);
    // Activities by MYOB account type (the API does not expose each account's own cash-flow classification): cash = bank accounts;
    // investing = fixed and other (non-current) assets; financing = long-term and other liabilities and equity; operating = the rest
    // (receivables, payables, credit cards, GST and other current accounts), starting from the period's net profit.
    var ACT = function (r) { return /^(FixedAsset|OtherAsset)$/.test(r.type) ? 'inv' : /^(LongTermLiability|OtherLiability)$/.test(r.type) || r.cls === 'Equity' ? 'fin' : 'op'; };
    var line = function (r) { return { label: (r.code ? r.code + ' ' : '') + r.name, value: r.effect }; }, keep = function (x) { return Math.abs(x.value) >= 0.005 || c.display.zeros; };
    var acts = [['op', 'Cash flow from operating activities'], ['inv', 'Cash flow from investing activities'], ['fin', 'Cash flow from financing activities']].map(function (a) {
      var l = cf.moves.filter(function (r) { return ACT(r) === a[0]; }).map(line).filter(keep); if (a[0] === 'op') l.unshift({ label: 'Net profit', value: cf.np, np: true });
      return { key: a[0], label: a[1], rows: l, total: MK.sum(l.map(function (x) { return x.value; })) }; });
    var net = MK.sum(acts.map(function (a) { return a.total; })), untyped = cf.moves.filter(function (r) { return !r.type; });
    var tr = function (label, v, cls, pad) { return '<tr class="' + (cls || '') + '"><td style="padding-left:' + (8 + (pad || 0) * 18) + 'px">' + MK.h(label) + '</td><td class="num">' + money(v) + '</td></tr>'; };
    var detail = (c.view || 'detail') === 'detail';
    body.innerHTML = MK.kpis([{ label: 'Operating', value: acts[0].total }, { label: 'Investing', value: acts[1].total }, { label: 'Financing', value: acts[2].total }, { label: 'Net increase/decrease', value: net }], c) +
      '<div class="mk-scroll" style="margin-top:16px"><table class="mk-stmt"><thead><tr><th scope="col">Classification</th><th scope="col" class="num">Net cash flow ($)</th></tr></thead><tbody>' +
      acts.map(function (a) { return (detail ? '<tr class="k-header"><td>' + MK.h(a.label) + '</td><td></td></tr>' + a.rows.map(function (x) { return tr(x.label, x.value, 'k-row detail-block', 1); }).join('') : '') + tr(detail ? 'Total ' + a.label.charAt(0).toLowerCase() + a.label.slice(1) : a.label, a.total, 'k-total'); }).join('') +
      tr('Net increase/decrease for the period', net, 'k-total') + tr('Cash at the beginning of the period', cf.open, 'k-row') + tr('Cash at the end of the period', cf.close, 'k-total') + '</tbody></table></div>' +
      '<div class="mk-card detail-block" style="margin-top:16px"><h3>Opening cash to closing cash</h3><div id="sc-chart"></div></div>';
    MK.waterfall(document.getElementById('sc-chart'), { title: 'Opening cash, the three activities and closing cash', steps: [{ label: 'Opening cash', value: cf.open, total: true }, { label: 'Operating', value: acts[0].total }, { label: 'Investing', value: acts[1].total }, { label: 'Financing', value: acts[2].total }, { label: 'Closing cash', value: cf.close, total: true }] }, c);
    var tie = r2(cf.open + net);
    var checks = [
      { name: 'Cash at the end = cash at the beginning + net increase/decrease (bank accounts on two Balance Sheets vs the P&L and every other account\'s change)', pass: MK.near(cf.close, tie), detail: money(cf.open) + ' + ' + money(net) + ' = ' + money(tie) + ' vs ' + money(cf.close) + (MK.near(cf.close, tie) ? '' : ' — difference ' + money(r2(cf.close - tie))) },
      { name: 'Net increase/decrease = operating + investing + financing', pass: MK.near(net, cf.net), detail: acts.map(function (a) { return money(a.total); }).join(' + ') },
      { name: 'Every account has a type in the chart of accounts, and there is at least one bank account', pass: c.errors.accounts ? null : untyped.length === 0 && cf.bank.length > 0, detail: c.errors.accounts ? c.err('accounts') + ' — activities need the account types' : cf.bank.length + ' bank account(s)' + (untyped.length ? '; no type: ' + untyped.map(function (r) { return r.code || r.name; }).join(', ') : '') },
      cf.fyCross ? { name: 'The year-end close moved last year\'s profit into Retained Earnings without cash (information)', pass: null, info: true, detail: 'Retained Earnings and Current Year Earnings are left out; ' + (Math.abs(cf.rollAdj) < 0.01 ? 'they net to the profit' : 'check ' + money(cf.rollAdj)) } : null
    ].filter(Boolean);
    this._x = { acts: acts, net: net, open: cf.open, close: cf.close };
    return { checks: checks, notes: ['Cash is the bank accounts (type Bank). MYOB\'s API does not expose each account\'s cash-flow classification, so activities follow the account type: investing = fixed and other non-current assets; financing = long-term and other liabilities and equity; operating = net profit plus every other account (receivables, payables, credit cards, GST and other current accounts).'], na: ['Comparison with another period'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return { v: v, s: 'money' }; }, rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Statement of cash flow', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], [{ v: 'Classification', s: 'bold' }, { v: 'Net cash flow ($)', s: 'bold' }]];
    x.acts.forEach(function (a) { rows.push([{ v: a.label, s: 'bold' }]); a.rows.forEach(function (r) { rows.push([{ v: r.label, indent: 1 }, mv(r.value)]); }); rows.push([{ v: 'Total', s: 'bold' }, { v: a.total, s: 'moneyBold' }]); });
    rows.push([{ v: 'Net increase/decrease for the period', s: 'bold' }, { v: x.net, s: 'moneyBold' }], ['Cash at the beginning of the period', mv(x.open)], [{ v: 'Cash at the end of the period', s: 'bold' }, { v: x.close, s: 'moneyBold' }]);
    return [{ name: 'Statement of cash flow', rows: rows, widths: [52, 18] }];
  }
});

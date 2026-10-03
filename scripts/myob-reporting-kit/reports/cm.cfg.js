MK.app({
  title: 'Cash movement', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', prev_day: '2026-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"cm"}' },
  uses: { pnl: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss_3m (the period)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (which accounts are bank accounts)', company_files: 'list_company_files' },
  views: [['cm', 'Cash movement'], ['bank', 'Bank accounts']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['pnl', 'bs_open', 'bs_close'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Profit and Loss and both Balance Sheets loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.pnl || !c.data.bs_open || !c.data.bs_close) return {};
    var idx = MK.accounts(c.data.accounts), pl = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT), bs = MK.breakdown([c.data.bs_open, c.data.bs_close], idx, MK.BS_LAYOUT);
    var np = pl.calc.NetProfit[0], isBank = function (r) { return r.type === 'Bank'; };
    // MYOB's layout: the P&L for the period, then each balance-sheet account's movement as its effect on cash (an asset going up uses
    // cash; a liability or equity going up provides it). Current Year Earnings is the P&L itself, so it is not counted again; Retained
    // Earnings moving at a financial-year end is the same profit closing, also not cash.
    var rows = bs.rows.filter(function (r) { return !r.header && /^(Asset|Liability|Equity)$/.test(r.cls); }), CYE = function (r) { return MK.CYE_RE.test(r.name); }, RE = function (r) { return /retained (earnings|profits)/i.test(r.name); };
    var fyCross = MK.fyStartOf(to, (c.fy && c.fy.month) || 7) >= from; // the period spans a financial-year start: Retained Earnings moves by last year's profit
    var lines = [], effect = function (r) { var d = r2((r.values[1] || 0) - (r.values[0] || 0)); return r.cls === 'Asset' ? -d : d; };
    var nonCash = rows.filter(function (r) { return !isBank(r) && !CYE(r) && !(fyCross && RE(r)); }), bank = rows.filter(isBank);
    var sec = function (cls, label) { var l = nonCash.filter(function (r) { return r.cls === cls; }).map(function (r) { return { label: (r.code ? r.code + ' ' : '') + r.name, value: effect(r) }; }).filter(function (x) { return Math.abs(x.value) >= 0.005 || c.display.zeros; }); return { label: label, rows: l, total: MK.sum(l.map(function (x) { return x.value; })) }; };
    var A = sec('Asset', 'Assets (increase uses cash)'), L = sec('Liability', 'Liabilities (increase provides cash)'), E = sec('Equity', 'Equity (excluding this year\'s profit)');
    var rolled = fyCross ? rows.filter(function (r) { return CYE(r) || RE(r); }) : [], rollAdj = fyCross ? r2(-(MK.sum(rolled.map(function (r) { return r.values[1] - r.values[0]; })) - np)) : 0; // a year-end close leaves equity unchanged in total
    var net = r2(np + A.total + L.total + E.total), open = MK.sum(bank.map(function (r) { return r.values[0]; })), close = MK.sum(bank.map(function (r) { return r.values[1]; })), bankMove = r2(close - open);
    var tr = function (label, v, cls) { return '<tr class="' + (cls || '') + '"><td>' + MK.h(label) + '</td><td class="num">' + money(v) + '</td></tr>'; };
    var plRows = pl.lines.filter(function (l) { return l.kind !== 'header'; }).map(function (l) { return tr(l.kind === 'row' ? '  ' + (l.code ? l.code + ' ' : '') + l.label : l.label, l.values[0], l.kind === 'total' ? 'k-total' : ''); }).join('');
    var block = function (s) { return '<tr class="k-head"><td colspan="2"><strong>' + MK.h(s.label) + '</strong></td></tr>' + s.rows.map(function (x) { return tr('  ' + x.label, x.value); }).join('') + tr('Total ' + s.label.replace(/ \(.*\)$/, ''), s.total, 'k-total'); };
    var view = c.view || 'cm';
    body.innerHTML = MK.kpis([{ label: 'Net profit', value: np }, { label: 'Net cash movement', value: net }, { label: 'Opening bank', value: open }, { label: 'Closing bank', value: close }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'bank' ? 'Bank accounts' : 'Cash movement') + ' — ' + MK.h(MK.periodLine(from, to)) + '</h3>' + (view === 'bank' ? '<div id="cm-bank"></div>'
        : '<div class="mk-scroll"><table class="mk-grid"><tbody>' + plRows + block(A) + block(L) + block(E) + tr('Net Cash Movement in (Out)', net, 'k-total') + tr('Opening Balance (bank accounts)', open) + tr('Closing Balance (bank accounts)', close, 'k-total') + '</tbody></table></div>') + '</div>';
    if (view === 'bank') MK.grid(document.getElementById('cm-bank'), { rows: bank.map(function (r) { return { code: r.code, name: r.name, open: r.values[0], move: r2(r.values[1] - r.values[0]), close: r.values[1] }; }), columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Bank account' }, { key: 'open', title: 'Opening balance', money: true }, { key: 'move', title: 'Movement', money: true }, { key: 'close', title: 'Closing balance', money: true }], total: { code: 'Total', open: open, move: bankMove, close: close } }, c);
    var checks = [
      { name: 'Closing balance = opening balance + net cash movement (bank accounts on two Balance Sheets vs the P&L and every other account\'s movement)', pass: MK.near(close, r2(open + net)), detail: money(open) + ' + ' + money(net) + ' = ' + money(r2(open + net)) + ' vs ' + money(close) + (MK.near(close, r2(open + net)) ? '' : ' — difference ' + money(r2(close - open - net))) },
      { name: 'Net cash movement = net profit + the change in every non-bank account (as laid out)', pass: MK.near(net, r2(np + A.total + L.total + E.total)), detail: money(np) + ' + ' + money(r2(A.total + L.total + E.total)) },
      { name: 'Every account is classified, and there is at least one bank account', pass: bs.unclassified.length === 0 && bank.length > 0, detail: bank.length + ' bank account(s)' + (bs.unclassified.length ? '; ' + bs.unclassified.length + ' unclassified' : '') },
      fyCross ? { name: 'The year-end close moved this year\'s profit into Retained Earnings without cash (information)', pass: null, info: true, detail: 'Retained Earnings and Current Year Earnings are left out of the movement; ' + (Math.abs(rollAdj) < 0.01 ? 'they net to the profit' : 'check ' + money(rollAdj)) } : null
    ].filter(Boolean);
    this._x = { np: np, A: A, L: L, E: E, net: net, open: open, close: close, pl: pl };
    return { checks: checks, notes: ['Bank accounts are the accounts of type Bank in the chart of accounts. Each other balance-sheet account\'s change between the day before the period and its end is shown as its effect on cash.'], na: ['Comparison with last year', 'Breakdown by month'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return { v: v, s: 'money' }; }, rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash movement', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    x.pl.lines.filter(function (l) { return l.kind !== 'header'; }).forEach(function (l) { rows.push([l.kind === 'total' ? { v: l.label, s: 'bold' } : (l.code ? l.code + ' ' : '') + l.label, mv(l.values[0])]); });
    [x.A, x.L, x.E].forEach(function (s) { rows.push([{ v: s.label, s: 'bold' }]); s.rows.forEach(function (r) { rows.push([r.label, mv(r.value)]); }); rows.push([{ v: 'Total', s: 'bold' }, { v: s.total, s: 'moneyBold' }]); });
    rows.push([{ v: 'Net Cash Movement in (Out)', s: 'bold' }, { v: x.net, s: 'moneyBold' }], ['Opening Balance', mv(x.open)], [{ v: 'Closing Balance', s: 'bold' }, { v: x.close, s: 'moneyBold' }]);
    return [{ name: 'Cash movement', rows: rows, widths: [44, 18] }];
  }
});

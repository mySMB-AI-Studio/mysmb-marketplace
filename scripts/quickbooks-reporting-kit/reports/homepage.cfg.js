QB.app({
  title: 'Business at a glance', token: null, primary: 'pl_widget', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { pl_start: '2026-07-01', pl_end: '2026-08-31', exp_start: '2026-08-27', cf_start: '2025-10-01', persona: 'Client',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":"last_month"}' },
  uses: { pl_widget: ['pl_start', 'pl_end'], expenses_widget: ['exp_start'], bank_accounts: [], cash_flow_12m: ['cf_start'], company_info: [], prefs: [] },
  tools: { pl_widget: 'get_report_profit_and_loss (by month: selected period and the one before)', expenses_widget: 'get_report_profit_and_loss (last 30 days)', bank_accounts: "list_account (Bank, Credit Card)", cash_flow_12m: 'get_report_cash_flow (12 months by month)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  // P&L widget period (x): last_month | this_month | this_quarter | last_quarter. The binding spans the prior period + the selected period, by month.
  roll: function (inp, fy, d) {
    var r = QB.preset(d.x || 'last_month', fy), prev = QB.compare(r.start, r.end, 'prev_period', fy), t = QB.preset('today', fy).end, y = +t.slice(0, 4), m = +t.slice(5, 7);
    var cf = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);
    return { pl_start: prev.start, pl_end: r.end, exp_start: QB.preset('last_30', fy).start, cf_start: cf };
  },
  render: function (c) {
    var body = c.body, d = c.display, money = function (v) { return QB.money(v, c.currency, d); };
    var key = d.x || 'last_month', sel = QB.preset(key, c.fy.month), prev = QB.compare(sel.start, sel.end, 'prev_period', c.fy.month);
    // --- P&L widget: sum month columns inside each window
    var pl = c.data.pl_widget, plc = pl ? QB.cols(pl) : [], plL = pl ? QB.walk(pl) : [];
    function windowSum(g, s, e) { var l = QB.find(plL, g); if (!l) return 0; var tot = 0; plc.slice(1).forEach(function (col, i) { if (!col.start) return; if (col.start >= s.slice(0, 7) + '-01' && col.start <= e) tot += l.values[i] || 0; }); return Math.round(tot * 100) / 100; }
    function win(s, e) { var inc = windowSum('Income', s, e) + windowSum('OtherIncome', s, e), ni = windowSum('NetIncome', s, e); return { inc: Math.round(inc * 100) / 100, ni: ni, exp: Math.round((inc - ni) * 100) / 100 }; }
    var w = win(sel.start, sel.end), wp = win(prev.start, prev.end), chg = wp.ni ? (w.ni - wp.ni) / Math.abs(wp.ni) : null;
    // --- Expenses widget: categories = top-level groups under Cost of Sales / Expenses / Other Expenses
    var ex = c.data.expenses_widget, exL = ex ? QB.walk(ex) : [], topG = {}, cats = [];
    exL.forEach(function (l) { if (l.kind === 'header' && l.depth === 0) topG[l.label] = l.group; });
    exL.forEach(function (l) { var g = topG[l.path[0]]; if (!(g === 'COGS' || g === 'Expenses' || g === 'OtherExpenses')) return; if (l.depth === 1 && (l.kind === 'row' || l.kind === 'total')) cats.push({ label: l.kind === 'total' ? l.label.replace(/^Total (for )?/i, '') : l.label, value: QB.val(l) }); });
    var spend = ex ? Math.round(((QB.val(QB.find(exL, 'COGS')) || 0) + (QB.val(QB.find(exL, 'Expenses')) || 0) + (QB.val(QB.find(exL, 'OtherExpenses')) || 0)) * 100) / 100 : null;
    // --- Bank accounts widget
    var accts = ((c.data.bank_accounts && c.data.bank_accounts.QueryResponse && c.data.bank_accounts.QueryResponse.Account) || []);
    var bank = accts.filter(function (a) { return a.AccountType === 'Bank'; }), cards = accts.filter(function (a) { return a.AccountType === 'Credit Card'; });
    var bankTot = QB.sum(bank.map(function (a) { return a.CurrentBalance; }));
    // --- Cash flow widget: month-end cash balance from the Statement of Cash Flows
    var cf = c.data.cash_flow_12m, cfc = cf ? QB.cols(cf) : [], cfL = cf ? QB.walk(cf) : [], incL = QB.find(cfL, 'CashIncrease', QB.CF_INC_RE);
    var months = cfc.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), idx = months.map(function (x) { return x.i - 1; });
    var endL = QB.cashEnd(cfL, idx, bank.length ? bankTot : null); // AU: no closing-cash line — worked back from today's bank balances
    var cashNow = null; if (endL) { var lastV = endL.values[endL.values.length - 1]; for (var ci = idx.length - 1; ci >= 0 && cashNow == null; ci--) cashNow = endL.values[idx[ci]] == null ? null : endL.values[idx[ci]]; if (cashNow == null) cashNow = lastV == null ? null : lastV; } // latest month-end first; Total column may be blank
    var opt = [['last_month', 'Last month'], ['this_month', 'This month'], ['last_quarter', 'Last quarter'], ['this_quarter', 'This quarter']];
    body.innerHTML = '<div class="qb-grid2">' +
      '<div class="qb-card"><h3>PROFIT &amp; LOSS <select id="w-pl" aria-label="Profit and loss period"' + (c.live ? '' : ' disabled') + '>' + opt.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === key ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></h3>' +
        (c.errors.pl_widget ? '<p class="qb-err">' + QB.h(c.err('pl_widget')) + '</p>' : QB.kpis([{ label: 'Net profit for ' + QB.periodLine(sel.start, sel.end), value: w.ni, delta: chg, sub: chg == null ? '' : (chg >= 0 ? 'Up ' : 'Down ') + QB.pct(Math.abs(chg), 0) + ' from prior period' }], c) + (pl && QB.noData(pl) ? '<p class="muted" style="margin:6px 0 0">QuickBooks recorded no income or expenses in this period.</p>' : '') + '<div id="w1"></div>') + '</div>' +
      '<div class="qb-card"><h3>EXPENSES <span class="muted">Last 30 days</span></h3>' + (c.errors.expenses_widget ? '<p class="qb-err">' + QB.h(c.err('expenses_widget')) + '</p>' : QB.kpis([{ label: 'Spending for last 30 days', value: spend }], c) + (ex && QB.noData(ex) ? '<p class="muted" style="margin:6px 0 0">QuickBooks recorded no expenses in this period.</p>' : '') + '<div id="w2"></div>') + '</div>' +
      '<div class="qb-card"><h3>BANK ACCOUNTS <span class="muted">As of today</span></h3><div id="w3"></div></div>' +
      '<div class="qb-card"><h3>CASH FLOW <span class="muted">Last 12 months</span></h3>' + (c.errors.cash_flow_12m ? '<p class="qb-err">' + QB.h(c.err('cash_flow_12m')) + '</p>' : QB.kpis([{ label: "Today's cash balance", value: cashNow }], c) + '<div id="w4"></div>') + '</div></div>';
    var s = document.getElementById('w-pl'); if (s) s.addEventListener('change', function () { var r = QB.preset(this.value, c.fy.month), p = QB.compare(r.start, r.end, 'prev_period', c.fy.month); c.change({ pl_start: p.start, pl_end: r.end }, { x: this.value }); });
    if (document.getElementById('w1')) QB.bars(document.getElementById('w1'), { title: 'Income and expenses', labels: ['Income', 'Expenses'], series: [{ name: QB.periodLine(sel.start, sel.end), values: [w.inc, w.exp] }, { name: 'Prior period', values: [wp.inc, wp.exp] }] }, c);
    if (document.getElementById('w2')) QB.donut(document.getElementById('w2'), { title: 'Spending by category', items: cats }, c);
    QB.grid(document.getElementById('w3'), { empty: 'No bank or credit card accounts.', columns: [{ key: 'name', title: 'Account' }, { key: 'type', title: 'Type' }, { key: 'bal', title: 'In QuickBooks', money: true }],
      rows: accts.map(function (a) { return { name: a.Name, type: a.AccountType, bal: a.CurrentBalance }; }) }, c);
    if (accts.length) document.getElementById('w3').insertAdjacentHTML('beforeend', '<p class="muted" style="font-size:12px;margin:6px 0 0">Bank balance (bank feed): N/A — not in the Accounting API.</p>');
    if (document.getElementById('w4')) QB.line(document.getElementById('w4'), { title: 'Cash balance', area: true, labels: months.map(function (x) { return x.title; }), series: [{ name: 'Cash balance', values: idx.map(function (i) { return endL ? endL.values[i] : null; }) }, { name: 'Net money in/out', values: idx.map(function (i) { return incL ? incL.values[i] : null; }) }] }, c);
    var catSum = QB.sum(cats.map(function (x) { return x.value; })), cfEnd = cashNow;
    var checks = [
      { name: 'Net profit = Income − Expenses', pass: pl ? QB.near(w.ni, w.inc - w.exp) && QB.near(windowSum('NetIncome', sel.start, sel.end), windowSum('Income', sel.start, sel.end) - windowSum('COGS', sel.start, sel.end) + windowSum('OtherIncome', sel.start, sel.end) - windowSum('Expenses', sel.start, sel.end) - windowSum('OtherExpenses', sel.start, sel.end)) : null, detail: money(w.ni) },
      ex && !cats.length && !spend ? { name: 'Category shares sum to the spending total (information)', pass: null, info: true, detail: 'No spending in the last 30 days — nothing to split' } :
      { name: 'Category shares sum to the spending total', pass: ex && cats.length ? QB.near(catSum, spend) : null, detail: money(catSum) + ' vs ' + money(spend) },
      endL && endL.derived ? { name: "Month-end cash worked back from today's bank balances (information)", pass: null, info: true, detail: "QuickBooks' cash flow report has no closing-cash line; " + money(bankTot) + ' in bank accounts today, less each month\'s net change' } :
      { name: "Bank 'In QuickBooks' = ledger cash (Cash at end of period today)", pass: cfEnd == null || !bank.length ? null : QB.near(bankTot, cfEnd, 1), detail: money(bankTot) + ' vs ' + money(cfEnd) }];
    this._x = { w: w, wp: wp, sel: sel, cats: cats, spend: spend, accts: accts, months: months, idx: idx, endL: endL };
    return { checks: checks, period: QB.asOfLine(c.today),
      na: ['Bank balance from the bank feed and the "N to review" counts (bank-feed data is not exposed by the Accounting API)', 'Privacy (hide amounts) toggle — use the Client persona or the house-style toggle for presentation'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Business at a glance', widths: [40, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business at a glance', s: 'bold' }], [c.today], [],
      [{ v: 'Profit & Loss — ' + QB.periodLine(x.sel.start, x.sel.end), s: 'bold' }, { v: 'This period', s: 'bold' }, { v: 'Prior period', s: 'bold' }],
      ['Income', { v: x.w.inc, s: 'money' }, { v: x.wp.inc, s: 'money' }], ['Expenses', { v: x.w.exp, s: 'money' }, { v: x.wp.exp, s: 'money' }], [{ v: 'Net profit', s: 'bold' }, { v: x.w.ni, s: 'moneyBold' }, { v: x.wp.ni, s: 'moneyBold' }], [],
      [{ v: 'Spending for last 30 days', s: 'bold' }, { v: x.spend, s: 'moneyBold' }]].concat(x.cats.map(function (k) { return [k.label, { v: k.value, s: 'money' }]; }), [[], [{ v: 'Bank accounts', s: 'bold' }, { v: 'In QuickBooks', s: 'bold' }]], x.accts.map(function (a) { return [a.Name, { v: a.CurrentBalance, s: 'money' }]; })) },
      { name: 'Cash flow 12 months', widths: [16, 18], rows: [[{ v: 'Month', s: 'bold' }, { v: 'Cash balance', s: 'bold' }]].concat(x.months.map(function (m, i) { return [m.title, x.endL ? { v: x.endL.values[x.idx[i]], s: 'money' } : null]; })) }];
  }
});

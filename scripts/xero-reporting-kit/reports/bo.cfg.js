XK.app({
  title: 'Business Overview', basisLabel: 'Accrual', primary: 'pnl_ytd', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', display: 'display' },
  defaults: { as_at: '2026-09-25', fy_start: '2026-07-01', prior_from: '2025-07-01', prior_to: '2025-09-25', month_from: '2026-09-01', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"","o":"w="}' },
  uses: { bank: ['month_from', 'as_at', 'org'], invoices: ['org'], bills: ['org'], payments: ['org'], pnl_ytd: ['fy_start', 'as_at', 'org'], pnl_prior: ['prior_from', 'prior_to', 'org'], pnl_month: ['month_from', 'as_at', 'org'], accounts: ['org'], tb: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, bills: { input: 'page', key: 'Invoices' } },
  fan: { bank: function (inp) { return XK.monthsEnding(inp.as_at, 6).map(function (m) { return { key: m.key, inputs: { month_from: m.start, as_at: m.end < inp.as_at ? m.end : inp.as_at } }; }); } },
  tools: { bank: 'get_bank_summary (this month; and each of the last 6 months)', invoices: 'list_invoices (sales invoices)', bills: 'list_invoices (bills)', payments: 'list_payments (recent invoice payments)', pnl_ytd: 'get_profit_and_loss (financial year to date)', pnl_prior: 'get_profit_and_loss (same period last year)', pnl_month: 'get_profit_and_loss (this month, for the watchlist)', accounts: 'list_accounts (codes)', tb: 'get_trial_balance (today, exact — for the ties; Xero\'s Balance Sheet is only at month ends)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // a dashboard is always "now"
  derive: function (inp, fyMonth) {
    var f = XK.fyStartOf(inp.as_at, fyMonth), y = function (s) { var p = s.split('-'), yy = +p[0] - 1, last = XK.eom(yy, +p[1]).getUTCDate(); return yy + '-' + p[1] + '-' + String(Math.min(+p[2], last)).padStart(2, '0'); };
    return { fy_start: f, prior_from: y(f), prior_to: y(inp.as_at), month_from: inp.as_at.slice(0, 8) + '01' };
  },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, asAt = c.inputs.as_at, base = c.currency, r2 = function (v) { return Math.round(v * 100) / 100; };
    var w = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null, wp = c.data.pnl_prior ? XK.walk(c.data.pnl_prior) : null, wm = c.data.pnl_month ? XK.walk(c.data.pnl_month) : null;
    var pl = w ? XK.plParts(w) : null, plp = wp ? XK.plParts(wp) : null;
    // bank accounts (this month's Bank Summary): Opening | Cash Received | Cash Spent | Closing
    var bw = c.data.bank ? XK.walk(c.data.bank) : null, banks = bw ? bw.lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return { name: l.label, id: l.id, open: l.values[0], rin: l.values[1], rout: l.values[2], close: l.values[3] }; }) : [];
    var accts = ((c.data.accounts || {}).Accounts || []), byId = {}; accts.forEach(function (a) { byId[a.AccountID] = a; });
    // documents
    var P = XK.pipeline(c.rows('invoices').filter(function (d) { return d.Type === 'ACCREC'; }), asAt, base), Q = XK.pipeline(c.rows('bills').filter(function (d) { return d.Type === 'ACCPAY'; }), asAt, base);
    var A = XK.parse(asAt), dow = (A.getUTCDay() + 6) % 7, wk = [0, 1, 2].map(function (i) { return [XK.addDaysIso(asAt, -dow + 7 * i), XK.addDaysIso(asAt, -dow + 7 * i + 6)]; });
    var d2 = function (s) { return +s.slice(8) + ' ' + XK.MONTHS[+s.slice(5, 7) - 1].slice(0, 3); };
    var aging = function (S) { var b = [{ label: 'Older', v: 0 }, { label: 'This week', v: 0 }, { label: d2(wk[1][0]) + '–' + d2(wk[1][1]), v: 0 }, { label: d2(wk[2][0]) + '–' + d2(wk[2][1]), v: 0 }, { label: 'From ' + d2(XK.addDaysIso(wk[2][1], 1)), v: 0 }];
      S.awaiting.docs.forEach(function (d) { var j = d.due < wk[0][0] ? 0 : d.due <= wk[0][1] ? 1 : d.due <= wk[1][1] ? 2 : d.due <= wk[2][1] ? 3 : 4; b[j].v = r2(b[j].v + d.amount); }); return b; };
    var agI = aging(P), agB = aging(Q);
    var box = function (title, S, ag, id) {
      return '<div class="xk-card"><h3>' + title + '</h3><div class="xk-kpis"><div class="xk-kpi"><div class="lbl">' + S.awaiting.n + ' awaiting payment</div><div class="val">' + money(S.awaiting.v) + '</div></div><div class="xk-kpi"><div class="lbl">' + S.overdue.n + ' of ' + S.awaiting.n + ' overdue</div><div class="val' + (S.overdue.v > 0 ? ' neg' : '') + '">' + money(S.overdue.v) + '</div></div></div><div id="' + id + '"></div>' +
        '<p class="muted">Draft: ' + S.draft.n + ' (' + money(S.draft.v) + ') · Awaiting approval: ' + S.approval.n + ' (' + money(S.approval.v) + ')</p></div>';
    };
    // recent invoice payments
    var pays = ((c.data.payments || {}).Payments || []).filter(function (p) { return p.PaymentType === 'ACCRECPAYMENT' && p.Status !== 'DELETED'; }).slice(0, 9).map(function (p) { var i = p.Invoice || {}; return { number: i.InvoiceNumber || '', contact: (i.Contact || {}).Name || '', date: XK.shortDate(XK.isoDate(p.Date)), amount: XK.num(p.Amount) }; });
    // cash in and out — last 6 months (Bank Summary per month)
    var fan = c.fan('bank'), months = XK.monthsEnding(asAt, 6), cash = fan ? fan.map(function (it, i) {
      if (it.error || !it.value) return { key: months[i].key, error: it.error || 'no data' };
      var t = XK.walk(it.value), tl = XK.find(t.lines, null, /^total$/i, 'total') || { values: [] }; return { key: months[i].key, rin: tl.values[1], rout: tl.values[2], open: tl.values[0], close: tl.values[3] };
    }) : null;
    var cashOk = cash && cash.every(function (m) { return !m.error; }), cin = cashOk ? XK.sum(cash.map(function (m) { return m.rin; })) : null, cout = cashOk ? XK.sum(cash.map(function (m) { return m.rout; })) : null;
    // watchlist: accounts from the P&L (codes from list_accounts); chosen accounts are kept in the display input (o: w=code,code)
    var plRows = w ? w.lines.filter(function (l) { return l.kind === 'row'; }) : [], rowByCode = {}, codeOf = function (l) { var a = byId[l.id]; return a ? a.Code : l.label; };
    plRows.forEach(function (l) { rowByCode[codeOf(l)] = l; });
    var monthVal = function (code) { if (!wm) return null; var l = wm.lines.filter(function (x) { return x.kind === 'row' && codeOf(x) === code; })[0]; return l ? l.values[0] : 0; };
    var chosen = String(c.opt('w') || '').split(',').filter(function (x) { return x && rowByCode[x]; });
    if (!chosen.length && !/(^|;)w=[^;]/.test(c.display.o || '')) chosen = plRows.filter(function (l) { return XK.isDeduction(l.group); }).sort(function (a, b) { return b.values[0] - a.values[0]; }).slice(0, 4).map(codeOf);
    var watch = chosen.map(function (code) { var l = rowByCode[code]; return { code: byId[l.id] ? code : '', name: l.label, month: monthVal(code), ytd: l.values[0] }; });
    var npDelta = pl && plp && plp.np ? (pl.np - plp.np) / Math.abs(plp.np) : null;
    body.innerHTML = '<div class="xk-grid2">' +
      '<div class="xk-card"><h3>Bank accounts</h3>' + (banks.length ? banks.map(function (b) { var a = byId[b.id] || {}, num = a.BankAccountNumber ? '•••• ' + String(a.BankAccountNumber).slice(-4) : ''; return '<div class="xk-kpi" style="margin-bottom:8px"><div class="lbl">' + XK.h((a.CurrencyCode && a.CurrencyCode !== base ? a.CurrencyCode + ' ' : '') + b.name) + (num ? ' · ' + num : '') + '</div><div class="val' + (b.close < 0 ? ' neg' : '') + '">' + money(b.close) + '</div><div class="sub">Balance in Xero · Statement balance: N/A — not in source · Balance difference: N/A</div></div>'; }).join('') : '<p class="xk-err">' + XK.h(c.err('bank') || 'Bank Summary unavailable') + '</p>') + '</div>' +
      box('Invoices owed to you', P, agI, 'bo-ai') + box('Bills to pay', Q, agB, 'bo-ab') +
      '<div class="xk-card"><h3>Tasks</h3><ul><li>' + (P.overdue.n ? 'Chase ' + P.overdue.n + ' overdue invoice' + (P.overdue.n === 1 ? '' : 's') + ' (' + money(P.overdue.v) + ')' : 'No overdue invoices') + '</li><li>' + (Q.overdue.n ? 'Pay ' + Q.overdue.n + ' overdue bill' + (Q.overdue.n === 1 ? '' : 's') + ' (' + money(Q.overdue.v) + ')' : 'No overdue bills') + '</li><li class="muted">Reconcile items: N/A — bank-feed statement lines are not in the Xero API</li></ul></div>' +
      '<div class="xk-card"><h3>Recent invoice payments</h3><div id="bo-pay"></div></div>' +
      '<div class="xk-card"><h3>Cash in and out — last 6 months</h3>' + (cash == null ? '<p class="muted">' + (c.live ? 'Loading the last 6 months…' : 'N/A in a snapshot — open the live report') + '</p>' : cashOk ? '<p>Cash in ' + money(cin) + ' · Cash out ' + money(-cout) + ' · Difference ' + money(r2(cin - cout)) + '</p><div id="bo-cash"></div>' : '<p class="xk-err">Some months could not be loaded: ' + XK.h(cash.filter(function (m) { return m.error; }).map(function (m) { return XK.monthLabel(m.key) + ' (' + m.error + ')'; }).join('; ')) + '</p>') + '</div>' +
      '<div class="xk-card"><h3>Net profit or loss — year to date</h3>' + (pl ? '<div class="xk-kpi"><div class="lbl">' + XK.h(XK.rangeLabel(c.inputs.fy_start, asAt)) + '</div><div class="val' + (pl.np < 0 ? ' neg' : '') + '">' + money(pl.np) + '</div>' + (npDelta != null ? '<span class="chip ' + (npDelta >= 0 ? 'up' : 'down') + '">' + (npDelta >= 0 ? '▲ ' : '▼ ') + XK.pct(Math.abs(npDelta), 0) + ' vs same period last year</span>' : '') + '</div><div id="bo-np"></div>' : '<p class="xk-err">' + XK.h(c.err('pnl_ytd') || 'Profit and Loss unavailable') + '</p>') + '</div>' +
      '<div class="xk-card detail-block"><h3>Chart of accounts watchlist</h3><div id="bo-watch"></div><label class="muted">Add account <select id="bo-add"><option value="">…</option>' + plRows.filter(function (l) { return chosen.indexOf(codeOf(l)) < 0; }).map(function (l) { return '<option value="' + XK.h(codeOf(l)) + '">' + XK.h(l.label) + '</option>'; }).join('') + '</select></label></div>' +
      '</div>';
    var col = function (v) { return v; };
    XK.bars(document.getElementById('bo-ai'), { title: 'Invoices owed by due date', labels: agI.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: agI.map(function (b) { return b.v; }), colors: ['var(--neg)'] }] }, c);
    XK.bars(document.getElementById('bo-ab'), { title: 'Bills to pay by due date', labels: agB.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: agB.map(function (b) { return b.v; }), colors: ['var(--neg)'] }] }, c);
    XK.grid(document.getElementById('bo-pay'), { rows: pays, columns: [{ key: 'number', title: 'Invoice #' }, { key: 'contact', title: 'Contact' }, { key: 'date', title: 'Date received' }, { key: 'amount', title: 'Amount', money: true }], empty: 'No invoice payments yet.' }, c);
    if (cashOk) XK.bars(document.getElementById('bo-cash'), { title: 'Cash in and out', labels: cash.map(function (m) { return XK.monthLabel(m.key).slice(0, 3); }), series: [{ name: 'Cash in', values: cash.map(function (m) { return m.rin; }), color: 'var(--pos)' }, { name: 'Cash out', values: cash.map(function (m) { return -m.rout; }), color: 'var(--neg)' }] }, c);
    if (pl) XK.bars(document.getElementById('bo-np'), { title: 'Income vs expenses', labels: ['Income', 'Expenses'], series: [{ name: 'This year to date', values: [pl.income, pl.expenses] }].concat(plp ? [{ name: 'Same period last year', values: [plp.income, plp.expenses] }] : []) }, c);
    XK.grid(document.getElementById('bo-watch'), { rows: watch, columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Account' }, { key: 'month', title: 'This month', money: true }, { key: 'ytd', title: 'YTD', money: true }], empty: 'Choose accounts to watch.' }, c);
    var add = document.getElementById('bo-add'); if (add) add.addEventListener('change', function () { if (this.value) c.change({}, { o: 'w=' + chosen.concat([this.value]).join(',') }); });

    // Checks
    var sumB = function (b) { return XK.sum(b.map(function (x) { return x.v; })); };
    var tbT = c.data.tb ? XK.tbYtd(c.data.tb) : null, bankTot = banks.length ? XK.sum(banks.map(function (b) { return b.close; })) : null;
    var deb = ((c.data.accounts || {}).Accounts || []).filter(function (a) { return a.SystemAccount === 'DEBTORS'; })[0], seen = tbT && banks.some(function (b) { return b.id && tbT.bal(b.id) != null; });
    var bs = tbT ? { bank: seen ? XK.sum(banks.map(function (b) { return tbT.bal(b.id) || 0; })) : null, cye: tbT.net, ar: deb ? tbT.bal(deb.AccountID) || 0 : null } : null;
    var checks = [
      { name: 'Invoices owed = Σ ageing buckets', pass: XK.near(sumB(agI), P.awaiting.v), detail: money(P.awaiting.v) },
      { name: 'Bills to pay = Σ ageing buckets', pass: XK.near(sumB(agB), Q.awaiting.v), detail: money(Q.awaiting.v) },
      { name: 'Each bank account: opening + cash in − cash out = balance', pass: banks.length ? banks.every(function (b) { return XK.near(b.open + b.rin - b.rout, b.close); }) : null, detail: banks.length + ' account(s)' },
      cash == null ? { name: 'Cash difference = cash in − cash out (last 6 months)', pass: null, detail: c.live ? 'Loading' : 'N/A in a snapshot' } : { name: 'Cash difference = cash in − cash out; each month closes where the next opens', pass: cashOk ? cash.every(function (m, i) { return i === 0 || XK.near(cash[i - 1].close, m.open); }) : false, detail: cashOk ? money(r2(cin - cout)) + ' over 6 months' : 'Some months failed to load' },
      { name: 'YTD net profit = income − expenses', pass: pl ? XK.near(pl.np, pl.income - pl.expenses) : null, detail: pl ? money(pl.np) + ' = ' + money(pl.income) + ' − ' + money(pl.expenses) : c.err('pnl_ytd') },
      { name: 'Bank accounts = the same accounts on the Trial Balance today (a separate Xero report)', pass: bs && bankTot != null && bs.bank != null ? XK.near(bankTot, bs.bank) : null, detail: bs && bankTot != null ? (bs.bank == null ? 'N/A — the bank accounts are not on the Trial Balance' : money(bankTot) + ' vs ' + money(bs.bank)) : c.err('tb') || c.err('bank') },
      { name: 'YTD net profit = income − expenses for the year on the Trial Balance today', pass: bs && pl && bs.cye != null ? XK.near(pl.np, bs.cye) : null, detail: bs && pl ? money(pl.np) + ' vs ' + money(bs.cye) : c.err('tb') || c.err('pnl_ytd') },
      { name: 'Invoices owed vs Accounts Receivable (information)', pass: null, info: true, detail: bs && bs.ar != null ? money(P.awaiting.v) + ' vs ' + money(bs.ar) + (XK.near(P.awaiting.v, bs.ar) ? '' : ' — Accounts Receivable also nets unallocated credit notes, overpayments and prepayments, and excludes future-dated invoices (see Aged Receivables)') : 'N/A' },
      { name: 'All invoices and bills loaded', pass: (c.errors.invoices || c.errors.bills) ? false : (c.truncated('invoices') || c.truncated('bills')) ? false : true, detail: c.errors.invoices ? c.err('invoices') : c.errors.bills ? c.err('bills') : (c.truncated('invoices') || c.truncated('bills')) ? 'May be truncated (over 20 pages)' : c.rows('invoices').length + ' invoice(s), ' + c.rows('bills').length + ' bill(s)' }
    ];
    this._x = { banks: banks, P: P, Q: Q, cash: cash, pl: pl, plp: plp, watch: watch, pays: pays, agI: agI, agB: agB };
    return { checks: checks, notes: ['Net profit, income and expenses come from one Profit and Loss (' + XK.rangeLabel(c.inputs.fy_start, asAt) + '); the comparison is the same dates last year.', 'Cash in and out is Xero\'s Bank Summary for each month (includes transfers between your accounts).'],
      na: ['Bank statement balances and reconcile counts (bank-feed data is not in the Xero API)'], period: XK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business overview', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], [], [{ v: 'Bank account', s: 'bold' }, { v: 'Balance in Xero', s: 'bold' }]]
      .concat(x.banks.map(function (b) { return [b.name, { v: b.close, s: 'money' }]; }))
      .concat([[], [{ v: '', s: 'bold' }, { v: 'Invoices owed', s: 'bold' }, { v: 'Bills to pay', s: 'bold' }], ['Awaiting payment', { v: x.P.awaiting.v, s: 'money' }, { v: x.Q.awaiting.v, s: 'money' }], ['Overdue', { v: x.P.overdue.v, s: 'money' }, { v: x.Q.overdue.v, s: 'money' }], ['Draft', { v: x.P.draft.v, s: 'money' }, { v: x.Q.draft.v, s: 'money' }], ['Awaiting approval', { v: x.P.approval.v, s: 'money' }, { v: x.Q.approval.v, s: 'money' }]]);
    if (x.pl) rows = rows.concat([[], [{ v: 'Year to date', s: 'bold' }, { v: 'This year', s: 'bold' }, { v: 'Last year', s: 'bold' }], ['Income', { v: x.pl.income, s: 'money' }, x.plp ? { v: x.plp.income, s: 'money' } : null], ['Expenses', { v: x.pl.expenses, s: 'money' }, x.plp ? { v: x.plp.expenses, s: 'money' } : null], [{ v: 'Net profit', s: 'bold' }, { v: x.pl.np, s: 'moneyBold' }, x.plp ? { v: x.plp.np, s: 'moneyBold' } : null]]);
    if (x.cash && x.cash.every(function (m) { return !m.error; })) rows = rows.concat([[], [{ v: 'Month', s: 'bold' }, { v: 'Cash in', s: 'bold' }, { v: 'Cash out', s: 'bold' }, { v: 'Difference', s: 'bold' }]]).concat(x.cash.map(function (m) { return [XK.monthLabel(m.key), { v: m.rin, s: 'money' }, { v: -m.rout, s: 'money' }, { v: Math.round((m.rin - m.rout) * 100) / 100, s: 'money' }]; }));
    rows = rows.concat([[], [{ v: 'Ageing (awaiting payment)', s: 'bold' }, { v: 'Invoices owed', s: 'bold' }, { v: 'Bills to pay', s: 'bold' }]]).concat(x.agI.map(function (b, i) { return [b.label, { v: b.v, s: 'money' }, { v: (x.agB[i] || {}).v, s: 'money' }]; }));
    rows = rows.concat([[], [{ v: 'Counts', s: 'bold' }, { v: 'Invoices', s: 'bold' }, { v: 'Bills', s: 'bold' }], ['Awaiting payment', x.P.awaiting.n, x.Q.awaiting.n], ['Overdue', x.P.overdue.n, x.Q.overdue.n], ['Draft', x.P.draft.n, x.Q.draft.n], ['Awaiting approval', x.P.approval.n, x.Q.approval.n]]);
    var pays = [[{ v: 'Invoice #', s: 'bold' }, { v: 'Contact', s: 'bold' }, { v: 'Date received', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat(x.pays.map(function (p) { return [p.number, p.contact, p.date, { v: p.amount, s: 'money' }]; }));
    var watch = [[{ v: 'Code', s: 'bold' }, { v: 'Account', s: 'bold' }, { v: 'This month', s: 'bold' }, { v: 'YTD', s: 'bold' }]].concat(x.watch.map(function (w) { return [w.code, w.name, { v: w.month, s: 'money' }, { v: w.ytd, s: 'money' }]; }));
    return [{ name: 'Business overview', rows: rows, widths: [34, 18, 18, 18] }, { name: 'Recent payments', rows: pays, widths: [14, 34, 16, 16] }, { name: 'Watchlist', rows: watch, widths: [10, 40, 16, 16] }];
  }
});

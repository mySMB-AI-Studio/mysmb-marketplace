XK.app({
  title: 'Bank Reconciliation Status', primary: 'bank', dated: ['bank'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', open_where: 'Status=="AUTHORISED" AND IsReconciled==false AND Date<=DateTime(2026,09,25)', done_where: 'Status=="AUTHORISED" AND IsReconciled==true AND Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,25)', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"accounts"}' },
  uses: { open_tx: ['open_where', 'org'], open_pay: ['open_where', 'org'], done_tx: ['done_where', 'org'], done_pay: ['done_where', 'org'], accounts: ['org'], bank: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  paged: { open_tx: { input: 'page', key: 'BankTransactions' }, open_pay: { input: 'page', key: 'Payments' }, done_tx: { input: 'page', key: 'BankTransactions' }, done_pay: { input: 'page', key: 'Payments' } },
  tools: { open_tx: 'list_bank_transactions (unreconciled spend / receive money and transfers, up to the period end)', open_pay: 'list_payments (unreconciled invoice and bill payments, up to the period end)', done_tx: 'list_bank_transactions (reconciled in the period)', done_pay: 'list_payments (reconciled in the period)', accounts: 'list_accounts (bank accounts)', bank: 'get_bank_summary (balance in Xero per bank account)', org: 'get_organisation', connections: 'list_connections' },
  views: [['accounts', 'By bank account'], ['items', 'Unreconciled items']],
  derive: function (inp) { return { open_where: 'Status=="AUTHORISED" AND IsReconciled==false AND ' + XK.dateWhere('Date', null, inp.to_date), done_where: 'Status=="AUTHORISED" AND IsReconciled==true AND ' + XK.dateWhere('Date', inp.from_date, inp.to_date) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['open_tx', 'open_pay', 'done_tx', 'done_pay'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Bank transactions and payments loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.open_tx || !c.data.open_pay) return {};
    var acc = {}, banks = ((c.data.accounts || {}).Accounts || []).filter(function (a) { return a.Type === 'BANK' && a.Status !== 'ARCHIVED'; });
    ((c.data.accounts || {}).Accounts || []).forEach(function (a) { acc[a.AccountID] = a; if (a.Code) acc['code:' + a.Code] = a; });
    var days = function (a, b) { return Math.round((XK.parse(b) - XK.parse(a)) / 86400000); };
    var TYPES = { RECEIVE: 'Receive money', SPEND: 'Spend money', 'RECEIVE-TRANSFER': 'Transfer in', 'SPEND-TRANSFER': 'Transfer out', 'RECEIVE-OVERPAYMENT': 'Overpayment received', 'SPEND-OVERPAYMENT': 'Overpayment paid', 'RECEIVE-PREPAYMENT': 'Prepayment received', 'SPEND-PREPAYMENT': 'Prepayment paid' };
    // one item per bank transaction or payment: + money in, − money out, in the bank account's own amounts
    var tx = function (d, rec) { var a = d.BankAccount || {}, inn = /^RECEIVE/.test(d.Type || ''); return { src: 'tx', rec: rec, ok: d.Status === 'AUTHORISED' && d.IsReconciled === rec, date: XK.isoDate(d.DateString || d.Date), type: TYPES[d.Type] || d.Type || '', acct: a.AccountID || '', acctName: (acc[a.AccountID] || {}).Name || a.Name || '', contact: (d.Contact || {}).Name || '', ref: d.Reference || '', amount: r2((inn ? 1 : -1) * (XK.num(d.Total) || 0)) }; };
    var pay = function (d, rec) { var a = d.Account || {}, inn = /^ACCREC|^ARCREDIT|^AROVERPAYMENT|^ARPREPAYMENT/.test(d.PaymentType || ''), ac = acc[a.AccountID] || acc['code:' + a.Code] || {}, inv = d.Invoice || {}; return { src: 'pay', rec: rec, ok: d.Status === 'AUTHORISED' && d.IsReconciled === rec, date: XK.isoDate(d.Date), type: inn ? 'Customer payment' : 'Supplier payment', acct: ac.AccountID || a.AccountID || '', acctName: ac.Name || a.Code || '', contact: (inv.Contact || {}).Name || '', ref: inv.InvoiceNumber || d.Reference || '', amount: r2((inn ? 1 : -1) * (XK.num(d.Amount) || 0)) }; };
    var open = c.rows('open_tx').map(function (d) { return tx(d, false); }).concat(c.rows('open_pay').map(function (d) { return pay(d, false); }));
    var done = c.rows('done_tx').map(function (d) { return tx(d, true); }).concat(c.rows('done_pay').map(function (d) { return pay(d, true); }));
    open.forEach(function (x) { x.age = days(x.date, to); });
    open.sort(function (a, b) { return a.date.localeCompare(b.date) || a.amount - b.amount; });
    // per bank account (every bank account in the chart, even with nothing to reconcile)
    var bw = c.data.bank ? XK.walk(c.data.bank) : null, xbal = {}; if (bw) bw.lines.filter(function (l) { return l.kind === 'row'; }).forEach(function (l) { xbal[l.id || l.label] = l.values[3]; });
    var per = {}; banks.forEach(function (a) { per[a.AccountID] = { name: a.Name, id: a.AccountID, rn: 0, rv: 0, un: 0, uv: 0, oldest: null, balance: xbal[a.AccountID] != null ? xbal[a.AccountID] : xbal[a.Name] != null ? xbal[a.Name] : null }; });
    var slot = function (x) { var k = x.acct || x.acctName; if (!per[k]) per[k] = { name: x.acctName || '(no bank account)', id: k, rn: 0, rv: 0, un: 0, uv: 0, oldest: null, balance: null, extra: true }; return per[k]; };
    done.forEach(function (x) { var p = slot(x); p.rn++; p.rv = r2(p.rv + x.amount); });
    open.forEach(function (x) { var p = slot(x); p.un++; p.uv = r2(p.uv + x.amount); if (!p.oldest || x.date < p.oldest) p.oldest = x.date; });
    var rowsA = Object.keys(per).map(function (k) { var p = per[k]; return { name: p.name, rn: p.rn, rv: p.rv, un: p.un, uv: p.uv, oldest: p.oldest ? XK.shortDate(p.oldest) : '—', age: p.oldest ? days(p.oldest, to) : null, balance: p.balance, extra: p.extra }; }).sort(function (a, b) { return (b.age || -1) - (a.age || -1) || a.name.localeCompare(b.name); });
    var U = { n: open.length, v: XK.sum(open.map(function (x) { return x.amount; })) }, R = { n: done.length, v: XK.sum(done.map(function (x) { return x.amount; })) };
    var oldest = open[0] ? open[0] : null, view = c.view || 'accounts';
    var band = function (d) { return d > 90 ? '90+ days' : d > 60 ? '61–90 days' : d > 30 ? '31–60 days' : d >= 0 ? '0–30 days' : 'Dated after the period'; };
    body.innerHTML = XK.kpis([{ label: 'Unreconciled items', value: U.n, money: false }, { label: 'Unreconciled amount (in − out)', value: U.v }, { label: 'Oldest unreconciled', text: oldest ? XK.shortDate(oldest.date) + ' · ' + oldest.age + ' days' : 'None' }, { label: 'Reconciled in the period', value: R.n, money: false }], c) +
      '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'items' ? 'Unreconciled items — oldest first' : 'By bank account') + '</h3><div id="br-grid"></div></div>';
    if (view === 'items') XK.grid(document.getElementById('br-grid'), { rows: open.map(function (x) { return Object.assign({}, x, { sdate: XK.shortDate(x.date), band: band(x.age) }); }), filter: true,
      columns: [{ key: 'sdate', title: 'Date' }, { key: 'acctName', title: 'Bank account' }, { key: 'type', title: 'Type' }, { key: 'contact', title: 'Contact' }, { key: 'ref', title: 'Reference' }, { key: 'age', title: 'Age (days)', num: true }, { key: 'band', title: 'Age band' }, { key: 'amount', title: 'Amount', money: true }],
      total: { sdate: 'Total', amount: U.v }, empty: 'Everything up to the period end is reconciled.' }, c);
    else XK.grid(document.getElementById('br-grid'), { rows: rowsA, columns: [{ key: 'name', title: 'Bank account' }, { key: 'balance', title: 'Balance in Xero', money: true }, { key: 'rn', title: 'Reconciled (period)', num: true }, { key: 'rv', title: 'Reconciled amount', money: true }, { key: 'un', title: 'Unreconciled', num: true }, { key: 'uv', title: 'Unreconciled amount', money: true }, { key: 'oldest', title: 'Oldest unreconciled' }, { key: 'age', title: 'Age (days)', num: true }],
      total: { name: 'Total', rn: R.n, rv: R.v, un: U.n, uv: U.v }, empty: 'No bank accounts in the chart of accounts.' }, c);
    // checks
    var badOpen = open.filter(function (x) { return !x.ok || x.date > to; }), badDone = done.filter(function (x) { return !x.ok || x.date < from || x.date > to; });
    var notBank = open.concat(done).filter(function (x) { var a = acc[x.acct]; return !a || a.Type !== 'BANK'; });
    var perU = XK.sum(rowsA.map(function (r) { return r.uv; })), perR = XK.sum(rowsA.map(function (r) { return r.rv; }));
    var trunc = ['open_tx', 'open_pay', 'done_tx', 'done_pay'].some(function (id) { return c.truncated(id); });
    var checks = [
      { name: 'Every unreconciled item is approved, unreconciled and dated on or before ' + to, pass: badOpen.length === 0, detail: badOpen.length ? badOpen.length + ' item(s) should not be listed' : U.n + ' item(s)' },
      { name: 'Every reconciled item is approved, reconciled and dated in the period', pass: badDone.length === 0, detail: badDone.length ? badDone.length + ' item(s) outside the rule' : R.n + ' item(s)' },
      { name: 'Every item belongs to a bank account in the chart of accounts', pass: c.data.accounts ? notBank.length === 0 : null, detail: c.data.accounts ? (notBank.length ? notBank.length + ' item(s) on another account, e.g. ' + (notBank[0].acctName || notBank[0].acct) : banks.length + ' bank account(s)') : c.err('accounts') },
      { name: 'Bank account totals = the items (reconciled and unreconciled)', pass: XK.near(perU, U.v) && XK.near(perR, R.v), detail: 'Unreconciled ' + money(perU) + ' vs ' + money(U.v) + ' · reconciled ' + money(perR) + ' vs ' + money(R.v) },
      { name: 'All bank transactions and payments loaded', pass: trunc ? false : true, detail: trunc ? 'May be truncated (over 20 pages) — counts are at least these' : (open.length + done.length) + ' item(s)' }
    ];
    this._x = { rowsA: rowsA, open: open, U: U, R: R, band: band };
    return { checks: checks, notes: ['Unreconciled = approved bank transactions (spend / receive money, transfers, overpayments and prepayments) and invoice or bill payments that Xero has not matched to a bank statement line, dated on or before the period end. Reconciled = those matched and dated in the period.', 'Amounts: money in positive, money out negative.'],
      na: ['Bank statement lines, statement balances and the reconcile count Xero shows on its dashboard (bank-feed data is not in the Xero API)', 'A "coded but not reconciled" state (the API has only reconciled or not)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    var a = head('Bank reconciliation status').concat([['Bank account', 'Balance in Xero', 'Reconciled (period)', 'Reconciled amount', 'Unreconciled', 'Unreconciled amount', 'Oldest unreconciled', 'Age (days)'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.rowsA.map(function (r) { return [r.name, r.balance == null ? '' : { v: r.balance, s: 'money' }, r.rn, { v: r.rv, s: 'money' }, r.un, { v: r.uv, s: 'money' }, r.oldest, r.age == null ? '' : r.age]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', x.R.n, { v: x.R.v, s: 'moneyBold' }, x.U.n, { v: x.U.v, s: 'moneyBold' }]]);
    var it = head('Unreconciled items').concat([['Date', 'Bank account', 'Type', 'Contact', 'Reference', 'Age (days)', 'Age band', 'Amount'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.open.map(function (r) { return [r.date, r.acctName, r.type, r.contact, r.ref, r.age, x.band(r.age), { v: r.amount, s: 'money' }]; }));
    return [{ name: 'By bank account', rows: a, widths: [30, 16, 14, 16, 12, 18, 16, 10] }, { name: 'Unreconciled items', rows: it, widths: [12, 26, 18, 26, 14, 10, 14, 14] }];
  }
});

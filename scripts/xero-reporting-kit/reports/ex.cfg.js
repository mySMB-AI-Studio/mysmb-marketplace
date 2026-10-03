XK.app({
  title: 'Exceptions Dashboard', primary: 'bs', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', display: 'display' },
  defaults: { as_at: '2026-09-25', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"all"}' },
  uses: { invoices: ['org'], bills: ['org'], tb: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, bills: { input: 'page', key: 'Invoices' } },
  tools: { invoices: 'list_invoices (sales invoices: draft, awaiting approval, awaiting payment)', bills: 'list_invoices (bills: draft, awaiting approval, awaiting payment)', tb: 'get_trial_balance (Accounts Receivable and Payable today, for information — exact; Xero\'s Balance Sheet is only at month ends)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // exceptions are always as at today
  views: [['all', 'All exceptions'], ['overdue', 'Overdue only'], ['drafts', 'Drafts only']],
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, base = c.currency, asAt = c.inputs.as_at;
    var need = ['invoices', 'bills'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Invoices and bills loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices || !c.data.bills) return {};
    var days = function (a, b) { return Math.round((XK.parse(b) - XK.parse(a)) / 86400000); };
    var band = function (d) { return d > 90 ? '90+ days' : d > 60 ? '61–90 days' : d > 30 ? '31–60 days' : '1–30 days'; };
    var ex = [];
    [['invoices', 'ACCREC', 'Sales'], ['bills', 'ACCPAY', 'Bill']].forEach(function (k) {
      c.rows(k[0]).forEach(function (d) {
        if (!d || d.Type !== k[1]) return; var x = XK.doc(d, 'Invoice', base);
        if (x.status === 'DRAFT' || x.status === 'SUBMITTED') ex.push({ group: k[1], kind: (k[1] === 'ACCREC' ? 'Draft sale' : 'Draft bill'), state: x.status === 'DRAFT' ? 'Draft' : 'Awaiting approval', contact: x.contact, number: x.number, date: x.date, due: x.due, late: null, band: '', amount: x.total, status: x.status });
        else if (x.status === 'AUTHORISED' && x.amount && x.due && x.due < asAt) { var dl = days(x.due, asAt); ex.push({ group: k[1], kind: (k[1] === 'ACCREC' ? 'Overdue sale' : 'Overdue bill'), state: 'Overdue', contact: x.contact, number: x.number, date: x.date, due: x.due, late: dl, band: band(dl), amount: x.amount, status: x.status }); }
      });
    });
    ex.sort(function (a, b) { return (b.late == null ? -1 : b.late) - (a.late == null ? -1 : a.late) || b.amount - a.amount; });
    var card = function (kind) { var l = ex.filter(function (x) { return x.kind === kind; }); return { n: l.length, v: XK.sum(l.map(function (x) { return x.amount; })) }; };
    var C = { ds: card('Draft sale'), db: card('Draft bill'), os: card('Overdue sale'), ob: card('Overdue bill') };
    var view = c.view || 'all', shown = ex.filter(function (x) { return view === 'all' || (view === 'overdue' ? x.state === 'Overdue' : x.state !== 'Overdue'); });
    var bands = ['1–30 days', '31–60 days', '61–90 days', '90+ days'].map(function (b) { var l = ex.filter(function (x) { return x.band === b; }); return { label: b, s: XK.sum(l.filter(function (x) { return x.group === 'ACCREC'; }).map(function (x) { return x.amount; })), p: XK.sum(l.filter(function (x) { return x.group === 'ACCPAY'; }).map(function (x) { return x.amount; })) }; });
    body.innerHTML = XK.kpis([{ label: 'Draft sales (' + C.ds.n + ')', value: C.ds.v }, { label: 'Draft bills (' + C.db.n + ')', value: C.db.v }, { label: 'Overdue sales (' + C.os.n + ')', value: C.os.v, red: C.os.v > 0 }, { label: 'Overdue bills (' + C.ob.n + ')', value: C.ob.v, red: C.ob.v > 0 }], c) +
      '<div class="xk-grid2" style="margin-top:16px"><div class="xk-card"><h3>Overdue by age</h3><div id="ex-age"></div></div><div class="xk-card"><h3>Largest overdue</h3><div id="ex-top"></div></div></div>' +
      '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'overdue' ? 'Overdue invoices and bills' : view === 'drafts' ? 'Draft and unapproved invoices and bills' : 'All exceptions') + ' — most overdue first</h3><div id="ex-grid"></div></div>';
    XK.bars(document.getElementById('ex-age'), { title: 'Overdue by days past due', labels: bands.map(function (b) { return b.label; }), series: [{ name: 'Sales', values: bands.map(function (b) { return b.s; }), color: 'var(--neg)' }, { name: 'Bills', values: bands.map(function (b) { return b.p; }) }] }, c);
    XK.grid(document.getElementById('ex-top'), { rows: ex.filter(function (x) { return x.state === 'Overdue'; }).slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5), columns: [{ key: 'contact', title: 'Contact' }, { key: 'kind', title: 'Type' }, { key: 'late', title: 'Days overdue', num: true }, { key: 'amount', title: 'Amount', money: true }], empty: 'Nothing overdue.' }, c);
    XK.grid(document.getElementById('ex-grid'), { rows: shown.map(function (x) { return Object.assign({}, x, { sdate: XK.shortDate(x.date), sdue: x.due ? XK.shortDate(x.due) : '' }); }), filter: true,
      columns: [{ key: 'kind', title: 'Type' }, { key: 'state', title: 'Status' }, { key: 'contact', title: 'Customer / supplier' }, { key: 'number', title: 'Number' }, { key: 'sdate', title: 'Date' }, { key: 'sdue', title: 'Due date' }, { key: 'late', title: 'Days overdue', num: true }, { key: 'band', title: 'Age' }, { key: 'amount', title: 'Amount', money: true }],
      total: { kind: 'Total', amount: XK.sum(shown.map(function (x) { return x.amount; })) }, empty: 'No exceptions — nothing draft, awaiting approval or overdue.' }, c);
    // checks
    var leak = ex.filter(function (x) { return !(x.status === 'DRAFT' || x.status === 'SUBMITTED' || (x.status === 'AUTHORISED' && x.due < asAt && x.amount)); });
    var sumCards = r2(C.ds.v + C.db.v + C.os.v + C.ob.v), sumRows = XK.sum(ex.map(function (x) { return x.amount; }));
    var tbT = c.data.tb ? XK.tbYtd(c.data.tb) : null, arv = tbT ? tbT.named(/^accounts receivable$/i) : null, apv = tbT ? tbT.named(/^accounts payable$/i) : null, bs = tbT ? { ar: arv, ap: apv == null ? null : Math.round(-apv * 100) / 100 } : null;
    var awaitS = XK.pipeline(c.rows('invoices').filter(function (d) { return d && d.Type === 'ACCREC'; }), asAt, base).awaiting.v, awaitP = XK.pipeline(c.rows('bills').filter(function (d) { return d && d.Type === 'ACCPAY'; }), asAt, base).awaiting.v;
    var trunc = c.truncated('invoices') || c.truncated('bills');
    var checks = [
      { name: 'Card totals = the rows behind them', pass: XK.near(sumCards, sumRows), detail: money(sumCards) + ' vs ' + money(sumRows) + ' (' + ex.length + ' item(s))' },
      { name: 'Every listed item is a draft, awaiting approval, or overdue at ' + asAt, pass: leak.length === 0, detail: leak.length ? leak.length + ' item(s) should not be listed, e.g. ' + leak[0].number : 'Paid and not-yet-due items are left out' },
      { name: 'Awaiting payment vs Accounts Receivable and Payable on the Trial Balance today (information)', pass: null, info: true, detail: bs && bs.ar != null && bs.ap != null ? 'Sales ' + money(awaitS) + ' vs ' + money(bs.ar) + ' · Bills ' + money(awaitP) + ' vs ' + money(bs.ap) + (XK.near(awaitS, bs.ar) && XK.near(awaitP, bs.ap) ? ' — they match' : ' — the accounts also net unallocated credit notes, overpayments and prepayments, and leave out future-dated documents') : (c.err('tb') || 'N/A') },
      { name: 'All draft, unapproved and unpaid invoices and bills loaded', pass: trunc ? false : true, detail: trunc ? 'May be truncated (over 20 pages)' : c.rows('invoices').length + ' invoice(s), ' + c.rows('bills').length + ' bill(s) checked' }
    ];
    this._x = { ex: ex, C: C };
    return { checks: checks, notes: ['Exceptions = invoices and bills in Draft or Awaiting approval, and approved ones with an amount due whose due date is before today. Paid and not-yet-due items are on the Sales and Purchases overviews.', 'Amounts in ' + base + '; drafts at their total, overdue items at the amount still due.'], period: XK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Exceptions dashboard', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], [],
      [{ v: 'Card', s: 'bold' }, { v: 'Count', s: 'bold' }, { v: 'Amount', s: 'bold' }], ['Draft sales', x.C.ds.n, { v: x.C.ds.v, s: 'money' }], ['Draft bills', x.C.db.n, { v: x.C.db.v, s: 'money' }], ['Overdue sales', x.C.os.n, { v: x.C.os.v, s: 'money' }], ['Overdue bills', x.C.ob.n, { v: x.C.ob.v, s: 'money' }], [],
      ['Type', 'Status', 'Customer / supplier', 'Number', 'Date', 'Due date', 'Days overdue', 'Age', 'Amount'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.ex.map(function (r) { return [r.kind, r.state, r.contact, r.number, r.date, r.due, r.late == null ? '' : r.late, r.band, { v: r.amount, s: 'money' }]; }));
    return [{ name: 'Exceptions', rows: rows, widths: [16, 18, 30, 12, 12, 12, 12, 12, 14] }];
  }
});

XK.app({
  title: '__TITLE__', primary: 'invoices', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', org: '', page: 1, persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"docs","o":"r=30"}' },
  uses: { invoices: ['org'], credit_notes: ['org'], overpayments: ['org'], prepayments: ['org'], __EXTRAUSES__, bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, overpayments: { input: 'page', key: 'Overpayments' }, prepayments: { input: 'page', key: 'Prepayments' }, __EXTRAPAGED__ },
  tools: { invoices: 'list_invoices (__DOCS__: draft, awaiting approval, awaiting payment)', credit_notes: 'list_credit_notes (unallocated)', overpayments: 'list_overpayments (unallocated)', prepayments: 'list_prepayments (unallocated)', __EXTRATOOLS__, bs: 'get_balance_sheet (__BSNAME__ today)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // a dashboard is always "now"
  views: __VIEWS__,
  options: __OPTIONS__,
  render: function (c) {
    var K = { kind: '__KIND__', inv: '__INV__', cn: '__CN__', op: '__OP__', pp: '__PP__', who: '__WHO__', whoPl: '__WHOPL__', docs: '__DOCS__', Docs: '__DOCSCAP__', bs: /^__BSNAME__$/i, bsName: '__BSNAME__' };
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, asAt = c.inputs.as_at, base = c.currency, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.invoices) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('invoices')) + '</p>'; return { checks: [{ name: K.Docs + ' loaded', pass: false, detail: c.err('invoices') }] }; }
    if (!c.data.invoices) return {};
    var inv = c.rows('invoices').filter(function (d) { return d && d.Type === K.inv; }), P = XK.pipeline(inv, asAt, base);
    var credits = XK.openDocs({ credit_notes: c.rows('credit_notes'), overpayments: c.rows('overpayments'), prepayments: c.rows('prepayments'), types: { credit_notes: K.cn, overpayments: K.op, prepayments: K.pp } }, base, null);
    var creditSum = XK.sum(credits.map(function (d) { return d.amount; }));
    var strip = '<div class="xk-kpis">' + [['Draft', P.draft], ['Awaiting approval', P.approval], ['Awaiting payment', P.awaiting], ['Overdue', P.overdue]].map(function (k, i) {
      return '<div class="xk-kpi"><div class="lbl">' + XK.h(k[0]) + ' (' + k[1].n + ')</div><div class="val' + (i === 3 && k[1].v > 0 ? ' neg' : '') + '">' + (k[1].n ? money(k[1].v) : 'None') + '</div></div>'; }).join('') + '</div>';
    var view = c.view || 'docs', extra = { checks: [], html: '', na: [] };
    // ---- per-kind panels ----
    var A = XK.parse(asAt), dow = (A.getUTCDay() + 6) % 7, wk0 = XK.addDaysIso(asAt, -dow), wk1 = XK.addDaysIso(wk0, 6), nw0 = XK.addDaysIso(wk0, 7), nw1 = XK.addDaysIso(wk0, 13);
    var due = function (a, b) { return XK.sum(P.awaiting.docs.filter(function (d) { return d.due >= a && d.due <= b; }).map(function (d) { return d.amount; })); };
    __PANELS__
    // ---- checks ----
    var docCount = P.draft.n + P.approval.n + P.awaiting.n, listed = inv.filter(function (d) { return /^(DRAFT|SUBMITTED)$/.test(d.Status) || (d.Status === 'AUTHORISED' && XK.num(d.AmountDue)); });
    var sums = { DRAFT: 0, SUBMITTED: 0, AUTHORISED: 0 }; listed.forEach(function (d) { sums[d.Status] = r2(sums[d.Status] + XK.doc(d, 'Invoice', base)[d.Status === 'AUTHORISED' ? 'amount' : 'total']); });
    var ids = ['invoices', 'credit_notes', 'overpayments', 'prepayments'], failed = ids.filter(function (id) { return c.errors[id]; }), cut = ids.filter(function (id) { return c.truncated(id); });
    var fxDocs = inv.filter(function (d) { return d.CurrencyCode && d.CurrencyCode !== base; }).length, open = r2(P.awaiting.v + creditSum);
    var bsRow = c.data.bs ? XK.find(XK.walk(c.data.bs).lines, null, K.bs, 'row') : null, bsv = bsRow ? XK.val(bsRow) : null;
    var future = XK.sum(P.awaiting.docs.filter(function (d) { return d.date > asAt; }).map(function (d) { return d.amount; })), openAt = r2(open - future);
    var checks = [
      { name: 'Strip counts × amounts reconcile to the ' + K.docs + ' listed', pass: listed.length === docCount && XK.near(sums.DRAFT, P.draft.v) && XK.near(sums.SUBMITTED, P.approval.v) && XK.near(sums.AUTHORISED, P.awaiting.v), detail: docCount + ' ' + K.docs + ' · ' + money(P.awaiting.v) + ' awaiting payment' },
      { name: 'Overdue is part of awaiting payment', pass: P.overdue.n <= P.awaiting.n && P.overdue.v <= P.awaiting.v + 0.005, detail: P.overdue.n + ' of ' + P.awaiting.n + ' overdue · ' + money(P.overdue.v) }
    ].concat(extra.checks).concat([
      { name: 'All ' + K.docs + ' and credits loaded', pass: failed.length || cut.length ? false : true, detail: failed.length ? 'Not loaded: ' + failed.map(function (id) { return c.err(id); }).join('; ') : cut.length ? 'May be truncated: ' + cut.join(', ') : inv.length + ' ' + K.docs + ', ' + credits.length + ' credit(s)' },
      c.errors.bs ? { name: 'Awaiting payment − credits = ' + K.bsName + ' on the Balance Sheet', pass: null, detail: c.err('bs') }
        : bsv == null ? { name: 'Awaiting payment − credits = ' + K.bsName + ' on the Balance Sheet', pass: null, detail: 'No ' + K.bsName + ' line on the Balance Sheet' }
        : XK.near(openAt, bsv) ? { name: 'Awaiting payment − credits = ' + K.bsName + ' on the Balance Sheet today', pass: true, detail: money(P.awaiting.v) + (creditSum ? ' − ' + money(-creditSum) : '') + (future ? ' − ' + money(future) + ' future-dated' : '') + ' = ' + money(bsv) }
        : fxDocs ? { name: 'Awaiting payment vs ' + K.bsName + ' on the Balance Sheet (information)', pass: null, info: true, detail: 'Difference ' + money(r2(openAt - bsv)) + ' — foreign-currency ' + K.docs + ' are converted at their own rates' }
        : { name: 'Awaiting payment − credits = ' + K.bsName + ' on the Balance Sheet today', pass: false, detail: money(openAt) + ' vs ' + money(bsv) + ' — difference ' + money(r2(openAt - bsv)) }
    ]);
    body.innerHTML = '<div class="xk-tabs detail-block">' + extra.tabs + '</div>' + strip + extra.html;
    (extra.after || []).forEach(function (f) { f(); });
    this._x = { P: P, extra: extra };
    return { checks: checks, notes: extra.notes || [], na: extra.na, period: XK.asOfLine(asAt), title: '__TITLE__' + (extra.viewTitle ? ' — ' + extra.viewTitle : '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: '__TITLE__', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], []];
    var strip = [[{ v: 'Status', s: 'bold' }, { v: 'Count', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting], ['Overdue', x.P.overdue]].map(function (k) { return [k[0], k[1].n, { v: k[1].v, s: 'money' }]; }));
    var docs = [[{ v: 'Status', s: 'bold' }, { v: 'Number', s: 'bold' }, { v: '__WHO__', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Amount', s: 'bold' }]]
      .concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting]].reduce(function (a, k) { return a.concat(k[1].docs.map(function (d) { return [k[0], d.number, d.contact, d.date, d.due, { v: k[0] === 'Awaiting payment' ? d.amount : d.total, s: 'money' }]; })); }, []));
    return [{ name: '__TITLE__', rows: head.concat(strip).concat((x.extra.sheet || [])), widths: [34, 12, 16, 12, 12, 16] }, { name: '__DOCSCAP__', rows: docs, widths: [18, 14, 32, 12, 12, 16] }];
  }
});

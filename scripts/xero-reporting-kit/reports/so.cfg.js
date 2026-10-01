XK.app({
  title: 'Sales overview', primary: 'invoices', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', org: '', page: 1, persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"docs","o":"r=30"}' },
  uses: { invoices: ['org'], credit_notes: ['org'], overpayments: ['org'], prepayments: ['org'], linked: ['org'], repeating: ['org'], bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, overpayments: { input: 'page', key: 'Overpayments' }, prepayments: { input: 'page', key: 'Prepayments' }, linked: { input: 'page', key: 'LinkedTransactions' } },
  tools: { invoices: 'list_invoices (invoices: draft, awaiting approval, awaiting payment)', credit_notes: 'list_credit_notes (unallocated)', overpayments: 'list_overpayments (unallocated)', prepayments: 'list_prepayments (unallocated)', linked: 'list_linked_transactions (billable expenses)', repeating: 'list_repeating_invoices', bs: 'get_balance_sheet (Accounts Receivable today)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // a dashboard is always "now"
  views: [['docs', 'Invoices'], ['repeating', 'Repeating invoices'], ['links', 'Payment links'], ['statements', 'Statements']],
  options: [],
  render: function (c) {
    var K = { kind: 'sales', inv: 'ACCREC', cn: 'ACCRECCREDIT', op: 'RECEIVE-OVERPAYMENT', pp: 'RECEIVE-PREPAYMENT', who: 'Customer', whoPl: 'Customers', docs: 'invoices', Docs: 'Invoices', bs: /^Accounts Receivable$/i, bsName: 'Accounts Receivable' };
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
    var VIEWS = [['docs', 'Invoices'], ['repeating', 'Repeating invoices'], ['links', 'Payment links'], ['statements', 'Statements']];
      extra.tabs = VIEWS.map(function (v) { return '<button type="button" class="xk-tab' + (v[0] === view ? ' on' : '') + '" data-v="' + v[0] + '">' + XK.h(v[1]) + '</button>'; }).join('');
      extra.after = [function () { body.querySelectorAll('.xk-tab').forEach(function (b) { b.addEventListener('click', function () { c.change({}, { v: b.getAttribute('data-v') }); }); }); }];
      var dueW = due(wk0, wk1), dueN = due(nw0, nw1), ms = XK.monthsEnding(asAt, 3), mkeys = ms.map(function (m) { return m.key; });
      var buckets = [{ label: 'Older', v: 0 }].concat(ms.map(function (m) { return { label: XK.monthLabel(m.key), v: 0 }; })).concat([{ label: 'Future', v: 0 }]);
      P.awaiting.docs.forEach(function (d) { var k = d.due.slice(0, 7), j = k < mkeys[0] ? 0 : k > mkeys[2] ? buckets.length - 1 : 1 + mkeys.indexOf(k); buckets[j].v = r2(buckets[j].v + d.amount); });
      var byC = {}; P.awaiting.docs.forEach(function (d) { if (!byC[d.cid]) byC[d.cid] = { name: d.contact, due: 0, overdue: 0 }; byC[d.cid].due = r2(byC[d.cid].due + d.amount); if (d.due < asAt) byC[d.cid].overdue = r2(byC[d.cid].overdue + d.amount); });
      var owing = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return b.due - a.due || a.name.localeCompare(b.name); }), top = self._all ? owing : owing.slice(0, 9);
      var names = {}; inv.forEach(function (d) { if (d.Contact) names[d.Contact.ContactID] = d.Contact.Name; });
      var lc = {}; c.rows('linked').forEach(function (l) { if (l && l.Status === 'APPROVED') lc[l.ContactID] = (lc[l.ContactID] || 0) + 1; });
      var lkeys = Object.keys(lc), rep = ((c.data.repeating || {}).RepeatingInvoices || []).filter(function (r) { return r.Type === K.inv && r.Status === 'AUTHORISED'; });
      if (view === 'docs') {
        extra.html = '<div class="xk-grid2" style="margin-top:12px"><div class="xk-card"><h3>Money coming in</h3><div class="xk-kpis"><div class="xk-kpi"><div class="lbl">Due this week</div><div class="val">' + money(dueW) + '</div></div><div class="xk-kpi"><div class="lbl">Due next week</div><div class="val">' + money(dueN) + '</div></div></div><div id="so-ch"></div></div>' +
          '<div class="xk-card"><h3>' + K.whoPl + ' owing the most</h3><div id="so-top"></div>' + (owing.length > 9 ? '<button type="button" id="so-all" class="xk-link">' + (self._all ? 'Show top 9' : 'View all ' + owing.length) + '</button>' : '') + '</div>' +
          '<div class="xk-card detail-block"><h3>Billable expenses</h3>' + (lkeys.length ? '<p>' + lkeys.length + ' customer' + (lkeys.length === 1 ? '' : 's') + ' · ' + lkeys.reduce(function (a, k) { return a + lc[k]; }, 0) + ' item(s) not yet invoiced</p><ul>' + lkeys.map(function (k) { return '<li>' + XK.h(names[k] || 'Customer ' + k.slice(0, 8)) + ' — ' + lc[k] + ' item(s)</li>'; }).join('') + '</ul><p class="muted">Amount owing: N/A — Xero\'s billable-expense API returns no amounts.</p>' : '<p class="muted">No billable expenses waiting to be invoiced.</p>') + '</div>' +
          '<div class="xk-card detail-block"><h3>Create new (in Xero)</h3><ul><li>Invoice</li><li>Payment link</li><li>Repeating invoice</li></ul><p class="muted">Reports only read from Xero — create these in Xero → Sales.</p></div></div>';
        extra.after.push(function () {
          XK.bars(document.getElementById('so-ch'), { title: 'Money coming in by due date', labels: buckets.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: buckets.map(function (b) { return b.v; }), colors: buckets.map(function (b, i) { return i === 3 ? 'var(--c1)' : 'var(--c2)'; }) }] }, c);
          XK.grid(document.getElementById('so-top'), { rows: top, columns: [{ key: 'name', title: K.who }, { key: 'due', title: 'Due', money: true }, { key: 'overdue', title: 'Overdue', num: true, fmt: function (v) { return v ? '<span class="neg">' + XK.h(money(v)) + '</span>' : money(v); }, html: true }], empty: 'Nothing owing.' }, c);
          var b = document.getElementById('so-all'); if (b) b.addEventListener('click', function () { self._all = !self._all; c.change({}, {}); });
        });
      } else if (view === 'repeating') {
        extra.viewTitle = 'Repeating invoices';
        extra.html = '<div class="xk-card" style="margin-top:12px"><h3>Repeating invoices</h3><div id="so-rep"></div></div>';
        extra.after.push(function () { XK.grid(document.getElementById('so-rep'), { filter: true, rows: rep.map(function (r) { var s = r.Schedule || {}; return { contact: (r.Contact || {}).Name || '', ref: r.Reference || '', every: (s.Period > 1 ? 'Every ' + s.Period + ' ' : '') + String(s.Unit || '').toLowerCase(), next: XK.isoDate(s.NextScheduledDateString || s.NextScheduledDate) || '', total: XK.num(r.Total) }; }), columns: [{ key: 'contact', title: K.who }, { key: 'ref', title: 'Reference' }, { key: 'every', title: 'Repeats' }, { key: 'next', title: 'Next invoice' }, { key: 'total', title: 'Amount', money: true }], empty: 'No repeating invoices.' }, c); });
      } else { extra.viewTitle = view === 'links' ? 'Payment links' : 'Statements'; extra.html = '<p class="muted" style="margin-top:12px">' + (view === 'links' ? 'Payment links' : 'Customer statements') + ': N/A — not in the Xero Accounting API. Open Xero → Sales → ' + (view === 'links' ? 'Payment links' : 'Statements') + '.</p>'; }
      extra.checks = [
        { name: 'Due ≥ Overdue for every ' + K.who.toLowerCase(), pass: owing.every(function (o) { return o.due + 0.005 >= o.overdue; }), detail: owing.length + ' ' + K.whoPl.toLowerCase() },
        { name: K.whoPl + ' owing the most ≤ total awaiting payment', pass: XK.sum(owing.slice(0, 9).map(function (o) { return o.due; })) <= P.awaiting.v + 0.005, detail: 'Top ' + Math.min(9, owing.length) + ': ' + money(XK.sum(owing.slice(0, 9).map(function (o) { return o.due; }))) + ' of ' + money(P.awaiting.v) },
        { name: 'Money coming in (by due date) = awaiting payment', pass: XK.near(XK.sum(buckets.map(function (b) { return b.v; })), P.awaiting.v), detail: money(XK.sum(buckets.map(function (b) { return b.v; }))) }];
      extra.na = ['Payment links and statements (not in the Xero Accounting API)', 'Billable expense amounts (the linked-transaction API has no amounts)'];
      extra.sheet = [[], [{ v: 'Money coming in', s: 'bold' }]].concat(buckets.map(function (b) { return [b.label, null, { v: b.v, s: 'money' }]; })).concat([[], [{ v: K.whoPl + ' owing the most', s: 'bold' }, null, { v: 'Due', s: 'bold' }, { v: 'Overdue', s: 'bold' }]]).concat(owing.map(function (o) { return [o.name, null, { v: o.due, s: 'money' }, { v: o.overdue, s: 'money' }]; }));
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
    return { checks: checks, notes: extra.notes || [], na: extra.na, period: XK.asOfLine(asAt), title: 'Sales overview' + (extra.viewTitle ? ' — ' + extra.viewTitle : '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Sales overview', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], []];
    var strip = [[{ v: 'Status', s: 'bold' }, { v: 'Count', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting], ['Overdue', x.P.overdue]].map(function (k) { return [k[0], k[1].n, { v: k[1].v, s: 'money' }]; }));
    var docs = [[{ v: 'Status', s: 'bold' }, { v: 'Number', s: 'bold' }, { v: 'Customer', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Amount', s: 'bold' }]]
      .concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting]].reduce(function (a, k) { return a.concat(k[1].docs.map(function (d) { return [k[0], d.number, d.contact, d.date, d.due, { v: k[0] === 'Awaiting payment' ? d.amount : d.total, s: 'money' }]; })); }, []));
    return [{ name: 'Sales overview', rows: head.concat(strip).concat((x.extra.sheet || [])), widths: [34, 12, 16, 12, 12, 16] }, { name: 'Invoices', rows: docs, widths: [18, 14, 32, 12, 12, 16] }];
  }
});

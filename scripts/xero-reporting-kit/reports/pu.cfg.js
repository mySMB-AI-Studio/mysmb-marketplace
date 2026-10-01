XK.app({
  title: 'Purchases overview', primary: 'invoices', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', org: '', page: 1, persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"docs","o":"r=30"}' },
  uses: { invoices: ['org'], credit_notes: ['org'], overpayments: ['org'], prepayments: ['org'], purchase_orders: ['org'], repeating: ['org'], bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, overpayments: { input: 'page', key: 'Overpayments' }, prepayments: { input: 'page', key: 'Prepayments' }, purchase_orders: { input: 'page', key: 'PurchaseOrders' } },
  tools: { invoices: 'list_invoices (bills: draft, awaiting approval, awaiting payment)', credit_notes: 'list_credit_notes (unallocated)', overpayments: 'list_overpayments (unallocated)', prepayments: 'list_prepayments (unallocated)', purchase_orders: 'list_purchase_orders', repeating: 'list_repeating_invoices (repeating bills)', bs: 'get_balance_sheet (Accounts Payable today)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // a dashboard is always "now"
  views: [['docs', 'Bills'], ['repeating', 'Repeating bills'], ['orders', 'Purchase orders']],
  options: [{ id: 'r', label: 'Money going out', options: [['30', 'Next 30 days'], ['60', 'Next 60 days'], ['90', 'Next 90 days']], def: '30' }],
  render: function (c) {
    var K = { kind: 'purchases', inv: 'ACCPAY', cn: 'ACCPAYCREDIT', op: 'SPEND-OVERPAYMENT', pp: 'SPEND-PREPAYMENT', who: 'Supplier', whoPl: 'Suppliers', docs: 'bills', Docs: 'Bills', bs: /^Accounts Payable$/i, bsName: 'Accounts Payable' };
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
    var VIEWS = [['docs', 'Bills'], ['repeating', 'Repeating bills'], ['orders', 'Purchase orders']];
      extra.tabs = VIEWS.map(function (v) { return '<button type="button" class="xk-tab' + (v[0] === view ? ' on' : '') + '" data-v="' + v[0] + '">' + XK.h(v[1]) + '</button>'; }).join('');
      extra.after = [function () { body.querySelectorAll('.xk-tab').forEach(function (b) { b.addEventListener('click', function () { c.change({}, { v: b.getAttribute('data-v') }); }); }); }];
      var RD = +(c.opt('r') || 30), end = XK.addDaysIso(asAt, RD), days = [];
      for (var i = 0; i <= RD; i++) days.push({ d: XK.addDaysIso(asAt, i), v: 0 });
      var od = 0, later = 0; P.awaiting.docs.forEach(function (d) { if (d.due < asAt) od = r2(od + d.amount); else if (d.due > end) later = r2(later + d.amount); else { var j = Math.round((XK.parse(d.due) - XK.parse(asAt)) / 86400000); days[j].v = r2(days[j].v + d.amount); } });
      var po = { DRAFT: { n: 0, v: 0 }, SUBMITTED: { n: 0, v: 0 }, AUTHORISED: { n: 0, v: 0 }, BILLED: { n: 0, v: 0 } }, pos = c.rows('purchase_orders');
      pos.forEach(function (p) { var s = po[p.Status]; if (s) { s.n++; s.v = r2(s.v + (XK.num(p.Total) || 0)); } });
      var rep = ((c.data.repeating || {}).RepeatingInvoices || []).filter(function (r) { return r.Type === K.inv && r.Status === 'AUTHORISED'; });
      var poStrip = '<div class="xk-kpis">' + [['Draft', 'DRAFT'], ['Awaiting approval', 'SUBMITTED'], ['Approved', 'AUTHORISED'], ['Billed', 'BILLED']].map(function (k) { return '<div class="xk-kpi"><div class="lbl">' + k[0] + ' (' + po[k[1]].n + ')</div><div class="val">' + (po[k[1]].n ? money(po[k[1]].v) : 'None') + '</div></div>'; }).join('') + '</div>';
      if (view === 'docs') {
        extra.html = '<div class="xk-card" style="margin-top:12px"><h3>Money going out — next ' + RD + ' days</h3><p>Overdue ' + money(od) + ' · due in the next ' + RD + ' days ' + money(XK.sum(days.map(function (x) { return x.v; }))) + (later ? ' · later ' + money(later) : '') + '</p><div id="pu-ch"></div></div>' +
          '<div class="xk-card detail-block" style="margin-top:12px"><h3>Purchase orders</h3>' + poStrip + '</div>';
        extra.after.push(function () { XK.bars(document.getElementById('pu-ch'), { title: 'Money going out', every: 7, labels: ['Overdue'].concat(days.map(function (x) { return x.d.slice(8) + '/' + x.d.slice(5, 7); })), series: [{ name: 'Bills due', values: [od].concat(days.map(function (x) { return x.v; })), colors: ['var(--neg)'] }] }, c); });
      } else if (view === 'orders') {
        extra.viewTitle = 'Purchase orders';
        extra.html = '<div class="xk-card" style="margin-top:12px"><h3>Purchase orders</h3>' + poStrip + '<div id="pu-po"></div></div>';
        extra.after.push(function () { XK.grid(document.getElementById('pu-po'), { filter: true, rows: pos.map(function (p) { return { number: p.PurchaseOrderNumber, contact: (p.Contact || {}).Name || '', date: XK.isoDate(p.DateString || p.Date), status: { DRAFT: 'Draft', SUBMITTED: 'Awaiting approval', AUTHORISED: 'Approved', BILLED: 'Billed' }[p.Status] || p.Status, total: XK.num(p.Total) }; }), columns: [{ key: 'number', title: 'Number' }, { key: 'contact', title: K.who }, { key: 'date', title: 'Date' }, { key: 'status', title: 'Status' }, { key: 'total', title: 'Amount', money: true }], empty: 'No purchase orders.' }, c); });
      } else {
        extra.viewTitle = 'Repeating bills';
        extra.html = '<div class="xk-card" style="margin-top:12px"><h3>Repeating bills</h3><div id="pu-rep"></div></div>';
        extra.after.push(function () { XK.grid(document.getElementById('pu-rep'), { filter: true, rows: rep.map(function (r) { var s = r.Schedule || {}; return { contact: (r.Contact || {}).Name || '', ref: r.Reference || '', every: (s.Period > 1 ? 'Every ' + s.Period + ' ' : '') + String(s.Unit || '').toLowerCase(), next: XK.isoDate(s.NextScheduledDateString || s.NextScheduledDate) || '', total: XK.num(r.Total) }; }), columns: [{ key: 'contact', title: K.who }, { key: 'ref', title: 'Reference' }, { key: 'every', title: 'Repeats' }, { key: 'next', title: 'Next bill' }, { key: 'total', title: 'Amount', money: true }], empty: 'No repeating bills.' }, c); });
      }
      extra.checks = [{ name: 'Money going out (overdue + next ' + RD + ' days + later) = awaiting payment', pass: XK.near(r2(od + XK.sum(days.map(function (x) { return x.v; })) + later), P.awaiting.v), detail: money(r2(od + XK.sum(days.map(function (x) { return x.v; })) + later)) },
        { name: 'Purchase orders loaded', pass: c.errors.purchase_orders ? false : c.truncated('purchase_orders') ? false : true, detail: c.errors.purchase_orders ? c.err('purchase_orders') : pos.length + ' purchase order(s)' }];
      extra.na = ['Paid bills list (open Xero → Purchases → Bills → Paid)', 'Bill search and import (Xero actions)'];
      extra.sheet = [[], [{ v: 'Purchase orders', s: 'bold' }]].concat([['Draft', 'DRAFT'], ['Awaiting approval', 'SUBMITTED'], ['Approved', 'AUTHORISED'], ['Billed', 'BILLED']].map(function (k) { return [k[0], po[k[1]].n, { v: po[k[1]].v, s: 'money' }]; }));
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
    return { checks: checks, notes: extra.notes || [], na: extra.na, period: XK.asOfLine(asAt), title: 'Purchases overview' + (extra.viewTitle ? ' — ' + extra.viewTitle : '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Purchases overview', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], []];
    var strip = [[{ v: 'Status', s: 'bold' }, { v: 'Count', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting], ['Overdue', x.P.overdue]].map(function (k) { return [k[0], k[1].n, { v: k[1].v, s: 'money' }]; }));
    var docs = [[{ v: 'Status', s: 'bold' }, { v: 'Number', s: 'bold' }, { v: 'Supplier', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Amount', s: 'bold' }]]
      .concat([['Draft', x.P.draft], ['Awaiting approval', x.P.approval], ['Awaiting payment', x.P.awaiting]].reduce(function (a, k) { return a.concat(k[1].docs.map(function (d) { return [k[0], d.number, d.contact, d.date, d.due, { v: k[0] === 'Awaiting payment' ? d.amount : d.total, s: 'money' }]; })); }, []));
    return [{ name: 'Purchases overview', rows: head.concat(strip).concat((x.extra.sheet || [])), widths: [34, 12, 16, 12, 12, 16] }, { name: 'Bills', rows: docs, widths: [18, 14, 32, 12, 12, 16] }];
  }
});

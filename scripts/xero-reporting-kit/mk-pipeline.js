// node mk-pipeline.js — writes reports/so.* (P02 Sales overview) and reports/pu.* (P03 Purchases overview) from one pipeline engine
// (reports/pipeline.tpl.js) plus a per-kind panel block.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'reports');
const tpl = fs.readFileSync(path.join(R, 'pipeline.tpl.js'), 'utf8').replace(/\r\n/g, '\n');
const TABS = `      extra.tabs = VIEWS.map(function (v) { return '<button type="button" class="xk-tab' + (v[0] === view ? ' on' : '') + '" data-v="' + v[0] + '">' + XK.h(v[1]) + '</button>'; }).join('');
      extra.after = [function () { body.querySelectorAll('.xk-tab').forEach(function (b) { b.addEventListener('click', function () { c.change({}, { v: b.getAttribute('data-v') }); }); }); }];`;
const SALES = `    var VIEWS = [['docs', 'Invoices'], ['repeating', 'Repeating invoices'], ['links', 'Payment links'], ['statements', 'Statements']];
${TABS}
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
          '<div class="xk-card detail-block"><h3>Billable expenses</h3>' + (lkeys.length ? '<p>' + lkeys.length + ' customer' + (lkeys.length === 1 ? '' : 's') + ' · ' + lkeys.reduce(function (a, k) { return a + lc[k]; }, 0) + ' item(s) not yet invoiced</p><ul>' + lkeys.map(function (k) { return '<li>' + XK.h(names[k] || 'Customer ' + k.slice(0, 8)) + ' — ' + lc[k] + ' item(s)</li>'; }).join('') + '</ul><p class="muted">Amount owing: N/A — Xero\\'s billable-expense API returns no amounts.</p>' : '<p class="muted">No billable expenses waiting to be invoiced.</p>') + '</div>' +
          '<div class="xk-card detail-block"><h3>Create new (in Xero)</h3><ul><li>Invoice</li><li>Payment link</li><li>Repeating invoice</li></ul><p class="muted">Reports only read from Xero — create these in Xero → Sales.</p></div></div>';
        extra.after.push(function () {
          XK.bars(document.getElementById('so-ch'), { title: 'Money coming in by due date', labels: buckets.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: buckets.map(function (b) { return b.v; }), colors: buckets.map(function (b, i) { return i === 3 ? 'var(--c1)' : 'var(--c2)'; }) }] }, c);
          var av = function (n) { var w = String(n || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(function (x) { return x; }); return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase(); };
          XK.grid(document.getElementById('so-top'), { rows: top, columns: [{ key: 'name', title: K.who, html: true, fmt: function (v) { return '<span class="xk-av" aria-hidden="true">' + XK.h(av(v)) + '</span>' + XK.h(v); } }, { key: 'due', title: 'Due', money: true }, { key: 'overdue', title: 'Overdue', num: true, fmt: function (v) { return v ? '<span class="neg">' + XK.h(money(v)) + '</span>' : money(v); }, html: true }], empty: 'Nothing owing.' }, c);
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
      extra.sheet = [[], [{ v: 'Money coming in', s: 'bold' }]].concat(buckets.map(function (b) { return [b.label, null, { v: b.v, s: 'money' }]; })).concat([[], [{ v: K.whoPl + ' owing the most', s: 'bold' }, null, { v: 'Due', s: 'bold' }, { v: 'Overdue', s: 'bold' }]]).concat(owing.map(function (o) { return [o.name, null, { v: o.due, s: 'money' }, { v: o.overdue, s: 'money' }]; }));`;
const PURCH = `    var VIEWS = [['docs', 'Bills'], ['repeating', 'Repeating bills'], ['orders', 'Purchase orders']];
${TABS}
      var RD = +(c.opt('r') || 30), end = XK.addDaysIso(asAt, RD), days = [];
      for (var i = 0; i <= RD; i++) days.push({ d: XK.addDaysIso(asAt, i), v: 0 });
      var od = 0, later = 0; P.awaiting.docs.forEach(function (d) { if (d.due < asAt) od = r2(od + d.amount); else if (d.due > end) later = r2(later + d.amount); else { var j = Math.round((XK.parse(d.due) - XK.parse(asAt)) / 86400000); days[j].v = r2(days[j].v + d.amount); } });
      var po = { DRAFT: { n: 0, v: 0 }, SUBMITTED: { n: 0, v: 0 }, AUTHORISED: { n: 0, v: 0 }, BILLED: { n: 0, v: 0 } }, pos = c.rows('purchase_orders');
      pos.forEach(function (p) { var s = po[p.Status]; if (s) { s.n++; s.v = r2(s.v + (XK.num(p.Total) || 0)); } });
      var rep = ((c.data.repeating || {}).RepeatingInvoices || []).filter(function (r) { return r.Type === K.inv && r.Status === 'AUTHORISED'; });
      var poStrip = '<div class="xk-kpis">' + [['Draft', 'DRAFT'], ['Awaiting approval', 'SUBMITTED'], ['Approved', 'AUTHORISED'], ['Billed', 'BILLED']].map(function (k) { return '<div class="xk-kpi"><div class="lbl">' + k[0] + ' (' + po[k[1]].n + ')</div><div class="val">' + money(po[k[1]].v || 0) + '</div></div>'; }).join('') + '</div>';
      if (view === 'docs') {
        extra.html = '<div class="xk-card" style="margin-top:12px"><h3>Money going out — next ' + RD + ' days</h3><p>Overdue ' + money(od) + ' · due in the next ' + RD + ' days ' + money(XK.sum(days.map(function (x) { return x.v; }))) + (later ? ' · later ' + money(later) : '') + '</p><div id="pu-ch"></div></div>' +
          '<div class="xk-grid2" style="margin-top:12px"><div class="xk-card detail-block"><h3>Purchase orders</h3>' + poStrip + '</div>' +
          '<div class="xk-card detail-block"><h3>Create new (in Xero)</h3><ul><li>New bill</li><li>Import bills</li><li>Purchase order</li><li>Repeating bill</li></ul><p class="muted">Reports only read from Xero — create or import these in Xero → Purchases.</p></div></div>';
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
      extra.sheet = [[], [{ v: 'Purchase orders', s: 'bold' }]].concat([['Draft', 'DRAFT'], ['Awaiting approval', 'SUBMITTED'], ['Approved', 'AUTHORISED'], ['Billed', 'BILLED']].map(function (k) { return [k[0], po[k[1]].n, { v: po[k[1]].v, s: 'money' }]; }))
        .concat([[], [{ v: 'Money going out — next ' + RD + ' days', s: 'bold' }, null, { v: 'Bills due', s: 'bold' }], ['Overdue', null, { v: od, s: 'money' }]]).concat(days.map(function (x) { return [x.d, null, { v: x.v, s: 'money' }]; })).concat(later ? [['Later', null, { v: later, s: 'money' }]] : []);`;
const KINDS = {
  so: { TITLE: 'Sales overview', KIND: 'sales', INV: 'ACCREC', CN: 'ACCRECCREDIT', OP: 'RECEIVE-OVERPAYMENT', PP: 'RECEIVE-PREPAYMENT', WHO: 'Customer', WHOPL: 'Customers', DOCS: 'invoices', DOCSCAP: 'Invoices', BSNAME: 'Accounts Receivable', PANELS: SALES,
    EXTRAUSES: "linked: ['org'], repeating: ['org']", EXTRAPAGED: "linked: { input: 'page', key: 'LinkedTransactions' }", EXTRATOOLS: "linked: 'list_linked_transactions (billable expenses)', repeating: 'list_repeating_invoices'",
    VIEWS: "[['docs', 'Invoices'], ['repeating', 'Repeating invoices'], ['links', 'Payment links'], ['statements', 'Statements']]", OPTIONS: '[]' },
  pu: { TITLE: 'Purchases overview', KIND: 'purchases', INV: 'ACCPAY', CN: 'ACCPAYCREDIT', OP: 'SPEND-OVERPAYMENT', PP: 'SPEND-PREPAYMENT', WHO: 'Supplier', WHOPL: 'Suppliers', DOCS: 'bills', DOCSCAP: 'Bills', BSNAME: 'Accounts Payable', PANELS: PURCH,
    EXTRAUSES: "purchase_orders: ['org'], repeating: ['org']", EXTRAPAGED: "purchase_orders: { input: 'page', key: 'PurchaseOrders' }", EXTRATOOLS: "purchase_orders: 'list_purchase_orders', repeating: 'list_repeating_invoices (repeating bills)'",
    VIEWS: "[['docs', 'Bills'], ['repeating', 'Repeating bills'], ['orders', 'Purchase orders']]", OPTIONS: "[{ id: 'r', label: 'Money going out', options: [['30', 'Next 30 days'], ['60', 'Next 60 days'], ['90', 'Next 90 days']], def: '30' }]" },
};
const fmt = (v) => Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : v && typeof v === 'object' ? '{ ' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + fmt(v[k])).join(', ') + ' }' : JSON.stringify(v);
const inp = (name) => ({ kind: 'input', input: name }), st = (value) => ({ kind: 'static', value });
for (const [id, K] of Object.entries(KINDS)) {
  let cfg = tpl.replace('    __PANELS__\n', K.PANELS + '\n');
  for (const [k, v] of Object.entries(K)) if (k !== 'PANELS') cfg = cfg.split('__' + k + '__').join(v);
  if (/__[A-Z]+__/.test(cfg)) throw new Error('unfilled placeholder in ' + id + ': ' + cfg.match(/__[A-Z]+__/)[0]);
  new Function('XK', cfg); // parses
  fs.writeFileSync(path.join(R, id + '.cfg.js'), cfg);
  const display = JSON.parse(/display: '(\{[^']+)'/.exec(cfg)[1]);
  const extra = id === 'so'
    ? [{ id: 'linked', tool: { mcp: 'xero-accounting', name: 'list_linked_transactions' }, params: { status: st('APPROVED'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'repeating', tool: { mcp: 'xero-accounting', name: 'list_repeating_invoices' }, params: { where: st('Type=="ACCREC" AND Status=="AUTHORISED"'), xero_tenant_id: inp('org') } }]
    : [{ id: 'purchase_orders', tool: { mcp: 'xero-accounting', name: 'list_purchase_orders' }, params: { page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'repeating', tool: { mcp: 'xero-accounting', name: 'list_repeating_invoices' }, params: { where: st('Type=="ACCPAY" AND Status=="AUTHORISED"'), xero_tenant_id: inp('org') } }];
  const m = {
    inputs: [
      { name: 'as_at', label: 'As at', type: 'date', default: 'today' },
      { name: 'org', label: 'Organisation', type: 'string', maxLength: 64, default: '' },
      { name: 'page', label: 'Page', type: 'number', min: 1, max: 20, default: 1 },
      { name: 'persona', label: 'View as', type: 'enum', options: ['Client', 'Bookkeeper', 'Practitioner', 'Executive'], default: 'Bookkeeper' },
      { name: 'display', label: 'Display settings', type: 'string', maxLength: 300, default: JSON.stringify(display) },
    ],
    bindings: [
      { id: 'invoices', tool: { mcp: 'xero-accounting', name: 'list_invoices' }, params: { where: st('Type=="' + K.INV + '"'), statuses: st('DRAFT,SUBMITTED,AUTHORISED'), order: st('DueDate ASC'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'credit_notes', tool: { mcp: 'xero-accounting', name: 'list_credit_notes' }, params: { where: st('Type=="' + K.CN + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'overpayments', tool: { mcp: 'xero-accounting', name: 'list_overpayments' }, params: { where: st('Type=="' + K.OP + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
      { id: 'prepayments', tool: { mcp: 'xero-accounting', name: 'list_prepayments' }, params: { where: st('Type=="' + K.PP + '" AND Status=="AUTHORISED"'), page: inp('page'), xero_tenant_id: inp('org') } },
    ].concat(extra).concat([
      { id: 'bs', tool: { mcp: 'xero-accounting', name: 'get_balance_sheet' }, params: { date: inp('as_at'), standardLayout: st(true), paymentsOnly: st(false), xero_tenant_id: inp('org') } },
      { id: 'org', tool: { mcp: 'xero-accounting', name: 'get_organisation' }, params: { xero_tenant_id: inp('org') } },
      { id: 'connections', tool: { mcp: 'xero-accounting', name: 'list_connections' }, params: {} },
    ]),
  };
  const out = '{\n  "inputs": [\n' + m.inputs.map((i) => '    ' + fmt(i)).join(',\n') + '\n  ],\n  "bindings": [\n' + m.bindings.map((b) => '    ' + fmt(b)).join(',\n') + '\n  ]\n}\n';
  JSON.parse(out); fs.writeFileSync(path.join(R, id + '.manifest.json'), out);
}
console.log('pipeline reports written: so, pu');

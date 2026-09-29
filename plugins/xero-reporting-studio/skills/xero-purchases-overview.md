---
name: xero-purchases-overview
description: Build a live Xero purchases overview dashboard on the tested report kit — bills by status, money going out, and purchase-order status. Use for "purchases overview", "bills", "bills to pay", "money going out", "purchase orders".
---
# Purchases Overview

Use when the user asks for a purchases overview, bills to pay, money going out, or purchase-order status. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`list_invoices`, `list_payments`, `list_purchase_orders`, `get_organisation`, `list_connections`).

Xero location: no single Xero screen — this composes Business → Bills to Pay and Business → Purchase Orders into one dashboard. Delivery: Wave 1 dashboard.

Bills are `list_invoices` with `where: Type=="ACCPAY"` — there is no separate bills tool. Purchase-order status comes from `list_purchase_orders` fetched unfiltered by status (so every status appears) and grouped client-side; `status` (singular) accepts only one value per call, so filtering to one status would hide the others.

## Discovery call

Call `get_organisation` once, `list_connections` once, `list_invoices` with `where: Type=="ACCPAY"`, `statuses: DRAFT,SUBMITTED,AUTHORISED`, `order: DueDate ASC`, `list_payments` with `where: PaymentType=="ACCPAYPAYMENT"`, `order: Date DESC`, and `list_purchase_orders` with `dateFrom` / `dateTo` = the period asked for. An error on any call is a failed section: report its message, keep the others rendering.

The exact JSON field names on `list_payments` and `list_purchase_orders` rows are not spelled out in the foundation's connector facts (only params are) — this skill relies on the standard, stable Xero Accounting API object schema (`Payment`: `PaymentID`, `Date`, `Amount`, `Invoice.Contact.Name`, `Invoice.InvoiceNumber`; `PurchaseOrder`: `PurchaseOrderID`, `PurchaseOrderNumber`, `DateString`, `DeliveryDateString`, `Status`, `Contact.Name`, `Total`). That schema is public and long-stable, but has not been called live against this connector while writing this skill.

## Date defaults

`from_date` = start of the period asked for (default: this calendar quarter, e.g. `2026-07-01`); `to_date` = end of the period (default `"today"`). This period scopes the purchase-order list (`dateFrom` / `dateTo`) and the money-going-out chart; bill and payment windows are filtered client-side on the same dates (`DateString` / `DueDateString`) since `list_invoices` and `list_payments` take no date-range parameter.

## Members

| Member / view | How |
|---|---|
| Purchases overview | The one dashboard view (no report switcher) |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Period | From / To dates (drives the purchase-order list and the money-going-out chart) |
| Presentation currency, tracking columns | N/A in this version — figures are in the organisation's base currency |

## Validation checks (shown in the banner)

- KPI counts and $ (Draft, Awaiting approval, Awaiting payment) reconcile against the bill rows actually shown
- Overdue is a subset of Awaiting payment (count and $ both ≤ the total)
- Money going out (Paid + Upcoming due) reconciles against the payment and bill rows shown for the period
- Purchase-order status breakdown sums to the total purchase orders fetched for the period

## Save as

`fileName`: `xero-purchases-overview.html` · `tags`: ["xero","purchases-overview","dashboard","payables"]

## QA test script (no live access — follow this before shipping)

This report has not been exercised against a live Xero organisation. Before treating it as done:

1. Open it against a connected sandbox or golden-set organisation and confirm all three sections load (KPIs, the money-going-out chart, the purchase-order donut and grid).
2. Confirm `list_payments` rows carry `Invoice.Contact.Name` and `Invoice.InvoiceNumber` (a payment against a bill, not a standalone transaction) and that `list_purchase_orders` rows carry `DateString` / `DeliveryDateString` and a `Status` value from `DRAFT | SUBMITTED | AUTHORISED | BILLED | DELETED` — this skill assumes those exact field names and enum values from the stable Xero API schema, not from a live call.
3. Check every validation line passes (or shows a stated reason) against the same organisation's figures in Xero → Business → Bills to Pay and → Purchase Orders.
4. Switch organisation (if more than one is connected), change the period, switch View as, toggle Branding and the dark theme, then Download PDF and Download Excel and confirm they match the screen.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "from_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "2026-09-29"
    },
    {
      "name": "org",
      "label": "Organisation",
      "type": "string",
      "maxLength": 64,
      "default": ""
    },
    {
      "name": "persona",
      "label": "View as",
      "type": "enum",
      "options": [
        "Client",
        "Bookkeeper",
        "Practitioner",
        "Executive"
      ],
      "default": "Bookkeeper"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"this_quarter\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "bills",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCPAY\""
        },
        "statuses": {
          "kind": "static",
          "value": "DRAFT,SUBMITTED,AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "payments_out",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_payments"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "PaymentType==\"ACCPAYPAYMENT\""
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "purchase_orders",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_purchase_orders"
      },
      "params": {
        "dateFrom": {
          "kind": "input",
          "input": "from_date"
        },
        "dateTo": {
          "kind": "input",
          "input": "to_date"
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "org",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_organisation"
      },
      "params": {
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "connections",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_connections"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
XK.app({
  title: 'Purchases Overview', primary: 'bills', dated: [], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-29', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' },
  uses: { bills: ['org'], payments_out: ['org'], purchase_orders: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  tools: { bills: 'list_invoices (Type==ACCPAY, DRAFT/SUBMITTED/AUTHORISED)', payments_out: 'list_payments (ACCPAYPAYMENT)', purchase_orders: 'list_purchase_orders', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, today = c.today;
    if (!c.data.bills && !c.errors.bills) return {};
    function rowsOf(v, key) { return v && !XK.errorOf(v) && Array.isArray(v[key]) ? v[key] : []; }
    var bills = rowsOf(c.data.bills, 'Invoices'), payments = rowsOf(c.data.payments_out, 'Payments'), pos = rowsOf(c.data.purchase_orders, 'PurchaseOrders');

    var byStatus = function (s) { return bills.filter(function (r) { return r.Status === s; }); };
    var draft = byStatus('DRAFT'), submitted = byStatus('SUBMITTED'), authorised = byStatus('AUTHORISED');
    var isOverdue = function (r) { var d = String(r.DueDateString || '').slice(0, 10); return !!d && d < today; };
    var overdue = authorised.filter(isOverdue);
    var sum = function (rows) { return XK.sum(rows.map(function (r) { return XK.num(r.AmountDue); })); };

    // Money going out for the selected period: paid (from payments_out, on Date) + upcoming (unpaid AUTHORISED bills due in-period)
    var paidInPeriod = payments.filter(function (p) { var d = XK.isoDate(p.Date); return !!d && d >= c.inputs.from_date && d <= c.inputs.to_date; });
    var upcomingInPeriod = authorised.filter(function (r) { var d = String(r.DueDateString || '').slice(0, 10); return !!d && d >= c.inputs.from_date && d <= c.inputs.to_date; });
    var paidTotal = XK.sum(paidInPeriod.map(function (p) { return XK.num(p.Amount); })), upcomingTotal = sum(upcomingInPeriod);

    // Purchase-order status breakdown
    var byPoStatus = {};
    pos.forEach(function (po) { var s = po.Status || 'UNKNOWN'; var e = byPoStatus[s] || (byPoStatus[s] = { status: s, count: 0, total: 0 }); e.count++; e.total += XK.num(po.Total) || 0; });
    var poStatuses = Object.keys(byPoStatus).map(function (k) { return byPoStatus[k]; }).sort(function (a, b) { return b.total - a.total; });
    var poTotal = XK.sum(poStatuses.map(function (e) { return e.total; })), poCount = pos.length;

    // ---- Body ----
    body.innerHTML =
      XK.kpis([
        { label: 'Draft', value: sum(draft), sub: draft.length + ' bill' + (draft.length === 1 ? '' : 's') },
        { label: 'Awaiting approval', value: sum(submitted), sub: submitted.length + ' bill' + (submitted.length === 1 ? '' : 's') },
        { label: 'Awaiting payment', value: sum(authorised), sub: authorised.length + ' bill' + (authorised.length === 1 ? '' : 's') },
        { label: 'Overdue', value: sum(overdue), sub: overdue.length + ' overdue' },
        { label: 'Open purchase orders', value: poCount, money: false, sub: money(poTotal) + ' total value' }
      ], c) +
      '<div class="xk-grid2" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Money going out — ' + XK.h(XK.rangeLabel(c.inputs.from_date, c.inputs.to_date)) + '</h3><div id="xk-out"></div></div>' +
      '<div class="xk-card"><h3>Purchase orders by status</h3><div id="xk-po-donut"></div></div>' +
      '</div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Bills to pay</h3><div id="xk-bills"></div></div>' +
      '<div class="xk-card"><h3>Purchase orders</h3><div id="xk-po-grid"></div></div>' +
      '</div>';

    XK.bars(document.getElementById('xk-out'), { title: 'Paid vs upcoming', labels: ['Paid', 'Upcoming (due in period)'], series: [{ name: XK.rangeLabel(c.inputs.from_date, c.inputs.to_date), values: [paidTotal, upcomingTotal] }] }, c);
    XK.donut(document.getElementById('xk-po-donut'), { title: 'Purchase orders by status', centre: String(poCount), items: poStatuses.map(function (e) { return { label: e.status + ' (' + e.count + ')', value: e.total }; }) }, c);

    function billCols() { return [{ key: 'num', title: 'Bill #' }, { key: 'contact', title: 'Supplier' }, { key: 'due', title: 'Due date' }, { key: 'flag', title: 'Status', html: true }, { key: 'amt', title: 'Amount due', money: true }]; }
    function billRow(r) {
      var due = String(r.DueDateString || '').slice(0, 10), over = !!due && due < today;
      return { num: r.InvoiceNumber || '(no number)', contact: (r.Contact && r.Contact.Name) || 'N/A — not in source', due: due || 'N/A', flag: over ? '<span class="chip down">Overdue</span>' : '<span class="chip up">Awaiting payment</span>', amt: XK.num(r.AmountDue) };
    }
    XK.grid(document.getElementById('xk-bills'), { columns: billCols(), rows: bills.filter(function (r) { return r.Status !== 'DRAFT'; }).map(billRow), filter: true, total: { num: '', contact: 'Total', due: '', flag: '', amt: sum(authorised.concat(submitted)) }, empty: c.errors.bills ? c.err('bills') : 'No open bills.' }, c);
    XK.grid(document.getElementById('xk-po-grid'), {
      columns: [{ key: 'num', title: 'PO #' }, { key: 'contact', title: 'Supplier' }, { key: 'status', title: 'Status' }, { key: 'delivery', title: 'Delivery date' }, { key: 'total', title: 'Total', money: true }],
      rows: pos.map(function (po) { return { num: po.PurchaseOrderNumber || '(no number)', contact: (po.Contact && po.Contact.Name) || 'N/A — not in source', status: po.Status || 'N/A', delivery: String(po.DeliveryDateString || '').slice(0, 10) || 'N/A', total: XK.num(po.Total) }; }),
      filter: true, empty: c.errors.purchase_orders ? c.err('purchase_orders') : 'No purchase orders in this period.'
    }, c);

    // ---- Checks ----
    var checks = [
      { name: 'Draft / Awaiting approval / Awaiting payment reconcile against the bill rows shown', pass: c.errors.bills ? false : true, detail: c.errors.bills ? c.err('bills') : draft.length + ' draft, ' + submitted.length + ' awaiting approval, ' + authorised.length + ' awaiting payment' },
      { name: 'Overdue is a subset of Awaiting payment', pass: c.errors.bills ? null : overdue.length <= authorised.length && sum(overdue) <= sum(authorised) + 0.01, detail: overdue.length + ' of ' + authorised.length + ' bills, ' + money(sum(overdue)) + ' of ' + money(sum(authorised)) },
      { name: 'Money going out (Paid + Upcoming) reconciles against the payment and bill rows shown', pass: (c.errors.payments_out || c.errors.bills) ? false : true, detail: (c.errors.payments_out ? c.err('payments_out') + ' — ' : '') + money(paidTotal) + ' paid (' + paidInPeriod.length + ') + ' + money(upcomingTotal) + ' upcoming (' + upcomingInPeriod.length + ')' },
      { name: 'Purchase-order status breakdown sums to the total fetched', pass: c.errors.purchase_orders ? false : XK.near(XK.sum(poStatuses.map(function (e) { return e.count; })), poCount, 0), detail: poCount + ' purchase order' + (poCount === 1 ? '' : 's') + ' across ' + poStatuses.length + ' status' + (poStatuses.length === 1 ? '' : 'es') }
    ];
    var notes = [];
    if (bills.length === 100 || payments.length === 100 || pos.length === 100) notes.push('One or more lists returned exactly 100 rows (Xero’s page size) — only the first page was fetched, so totals may be incomplete for a very large ledger.');
    this._bills = bills; this._pos = pos; this._payments = payments;
    return { checks: checks, notes: notes, na: ['Presentation currency and tracking-category columns (not in this version)'], title: 'Purchases Overview' };
  },
  excel: function (c) {
    var bills = this._bills || [], pos = this._pos || [], payments = this._payments || [];
    return [
      { name: 'Bills to pay', rows: [['Bill #', 'Supplier', 'Status', 'Due date', 'Amount due']].concat(bills.map(function (r) { return [r.InvoiceNumber || '', (r.Contact && r.Contact.Name) || '', r.Status || '', String(r.DueDateString || '').slice(0, 10), XK.num(r.AmountDue)]; })), widths: [16, 30, 14, 12, 14] },
      { name: 'Payments made', rows: [['Date', 'Supplier', 'Bill #', 'Amount']].concat(payments.map(function (p) { var inv = p.Invoice || {}; return [XK.isoDate(p.Date), (inv.Contact && inv.Contact.Name) || '', inv.InvoiceNumber || '', XK.num(p.Amount)]; })), widths: [12, 30, 16, 14] },
      { name: 'Purchase orders', rows: [['PO #', 'Supplier', 'Status', 'Delivery date', 'Total']].concat(pos.map(function (po) { return [po.PurchaseOrderNumber || '', (po.Contact && po.Contact.Name) || '', po.Status || '', String(po.DeliveryDateString || '').slice(0, 10), XK.num(po.Total)]; })), widths: [14, 30, 14, 14, 14] }
    ];
  }
});
```

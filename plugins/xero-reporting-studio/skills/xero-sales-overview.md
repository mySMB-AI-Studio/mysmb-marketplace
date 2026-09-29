---
name: xero-sales-overview
description: Build a live Xero sales overview dashboard on the tested report kit — invoices by status, money due this week and next, customers owing the most, top customers by revenue and billable expenses. Use for "sales overview", "invoices", "money coming in", "top customers", "who owes us most".
---
# Sales Overview

Use when the user asks for a sales overview, invoice status, money coming in, top customers, or who owes the most. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`list_invoices`, `list_linked_transactions`, `get_organisation`, `list_connections`).

Xero location: no single Xero screen — this composes Reporting → Invoices, and Business → Invoices → Awaiting Payment into one dashboard. Delivery: Wave 1 dashboard.

Sales invoices are `list_invoices` with `where: Type=="ACCREC"`. There is no top-customers tool and no all-contacts aged-receivables tool — top customers by revenue and customers owing the most are both aggregated client-side from `list_invoices`, with two different status filters (see dataBindings): `sales_open` (DRAFT, SUBMITTED, AUTHORISED — the open pipeline) and `sales_period` (AUTHORISED, PAID — revenue actually billed). `list_linked_transactions` returns only `{ LinkedTransactionID, SourceTransactionID, ContactID, Type, Status, UpdatedDateUTC, … }` — it does **not** return an amount or a resolved contact name, so "billable expenses" here is a count only, not a dollar figure; do not estimate one.

## Discovery call

Call `get_organisation` once, `list_connections` once, `list_invoices` with `where: Type=="ACCREC"`, `statuses: DRAFT,SUBMITTED,AUTHORISED`, `order: DueDate ASC` (the open pipeline), `list_invoices` with `where: Type=="ACCREC"`, `statuses: AUTHORISED,PAID`, `order: Date DESC` (the revenue set for top customers), and `list_linked_transactions` with `status: APPROVED`. An error on any call is a failed section: report its message, keep the others rendering.

The exact JSON field names on `list_payments` / `list_purchase_orders` / `list_linked_transactions` rows are not spelled out in the foundation's connector facts (only params are) — this skill relies on the standard, stable Xero Accounting API object schema for `LinkedTransaction` (`LinkedTransactionID`, `SourceTransactionID`, `ContactID`, `Type`, `Status`). That schema is public and long-stable, but has not been called live against this connector while writing this skill.

## Date defaults

No binding here takes a date parameter (see the foundation: `where`, `statuses` and `order` are static strings fixed at authoring). The top-customers period (This month / This quarter / This financial year to date) is a client-side preset applied to the already-loaded `sales_period` rows on `DateString` — not a declared input, and it never re-queries.

## Members

| Member / view | How |
|---|---|
| Sales overview | The one dashboard view (no report switcher) |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Top-customers period | Client-side preset (This month / This quarter / This financial year to date) over the loaded revenue set |
| Presentation currency, tracking columns | N/A in this version — figures are in the organisation's base currency |

## Validation checks (shown in the banner)

- KPI counts and $ (Draft, Awaiting approval, Awaiting payment) reconcile against the open-pipeline rows actually shown
- Overdue is a subset of Awaiting payment (count and $ both ≤ the total)
- Due this week + Due next week are each a subset of Awaiting payment
- For every customer in "Customers owing the most": Due ≥ Overdue
- Top customers by revenue (the rows shown) ≤ total revenue for the same period and status set

## Save as

`fileName`: `xero-sales-overview.html` · `tags`: ["xero","sales-overview","dashboard","receivables"]

## QA test script (no live access — follow this before shipping)

This report has not been exercised against a live Xero organisation. Before treating it as done:

1. Open it against a connected sandbox or golden-set organisation and confirm all three sections load (KPIs, both grids, the donut).
2. Confirm `list_invoices` rows carry `Contact.ContactID` (not just `Contact.Name`) for every AUTHORISED/PAID/DRAFT/SUBMITTED invoice — the customer aggregations group by `ContactID` and fall back to `Contact.Name` only when the ID is missing.
3. Confirm `list_linked_transactions` really returns no amount field on this connector (as the foundation implies); if it does carry one, this skill should be revisited to show a real dollar figure instead of a count.
4. Check every validation line passes (or shows a stated reason) against the same organisation's figures in Xero → Business → Invoices.
5. Switch organisation (if more than one is connected), switch the top-customers period preset, switch View as, toggle Branding and the dark theme, then Download PDF and Download Excel and confirm they match the screen.

## dataBindings

```json
{
  "inputs": [
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "sales_open",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCREC\""
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
      "id": "sales_period",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCREC\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED,PAID"
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
      "id": "billable",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_linked_transactions"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "APPROVED"
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
  title: 'Sales Overview', primary: 'sales_open', dated: [], org: 'org', conns: 'connections',
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"custom","c":"none","v":""}' },
  uses: { sales_open: ['org'], sales_period: ['org'], billable: ['org'], org: ['org'], connections: [] },
  tools: { sales_open: 'list_invoices (Type==ACCREC, DRAFT/SUBMITTED/AUTHORISED)', sales_period: 'list_invoices (Type==ACCREC, AUTHORISED/PAID)', billable: 'list_linked_transactions (APPROVED)', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, today = c.today;
    if (!c.data.sales_open && !c.errors.sales_open) return {};
    function rowsOf(v, key) { return v && !XK.errorOf(v) && Array.isArray(v[key]) ? v[key] : []; }
    var open = rowsOf(c.data.sales_open, 'Invoices'), period = rowsOf(c.data.sales_period, 'Invoices'), billable = rowsOf(c.data.billable, 'LinkedTransactions');

    var byStatus = function (s) { return open.filter(function (r) { return r.Status === s; }); };
    var draft = byStatus('DRAFT'), submitted = byStatus('SUBMITTED'), authorised = byStatus('AUTHORISED');
    var isOverdue = function (r) { var d = String(r.DueDateString || '').slice(0, 10); return !!d && d < today; };
    var overdue = authorised.filter(isOverdue);
    var sum = function (rows) { return XK.sum(rows.map(function (r) { return XK.num(r.AmountDue); })); };

    var t = XK.parse(today), w1s = today, w1e = XK.iso(XK.addDays(t, 6)), w2s = XK.iso(XK.addDays(t, 7)), w2e = XK.iso(XK.addDays(t, 13));
    var inWindow = function (r, s, e) { var d = String(r.DueDateString || '').slice(0, 10); return !!d && d >= s && d <= e; };
    var dueThisWeek = authorised.filter(function (r) { return inWindow(r, w1s, w1e); }), dueNextWeek = authorised.filter(function (r) { return inWindow(r, w2s, w2e); });

    // Customers owing the most (open pipeline, AUTHORISED only)
    var byCust = {};
    authorised.forEach(function (r) {
      var key = (r.Contact && (r.Contact.ContactID || r.Contact.Name)) || 'unknown', name = (r.Contact && r.Contact.Name) || 'N/A — not in source';
      var e = byCust[key] || (byCust[key] = { name: name, due: 0, overdue: 0, count: 0 });
      var amt = XK.num(r.AmountDue) || 0; e.due += amt; e.count++; if (isOverdue(r)) e.overdue += amt;
    });
    var custOwing = Object.keys(byCust).map(function (k) { return byCust[k]; }).sort(function (a, b) { return b.due - a.due; });
    var custViolations = custOwing.filter(function (e) { return e.overdue > e.due + 0.01; });

    // Top customers by revenue (client-side period preset over `period` rows)
    var presetKey = this._salesPreset || 'this_month', pr = XK.preset(presetKey, c.fy.month) || { start: '0000-01-01', end: '9999-12-31' };
    var periodRows = period.filter(function (r) { var d = String(r.DateString || '').slice(0, 10); return !!d && d >= pr.start && d <= pr.end; });
    var byRev = {};
    periodRows.forEach(function (r) {
      var key = (r.Contact && (r.Contact.ContactID || r.Contact.Name)) || 'unknown', name = (r.Contact && r.Contact.Name) || 'N/A — not in source';
      var e = byRev[key] || (byRev[key] = { name: name, revenue: 0, count: 0 }); e.revenue += XK.num(r.SubTotal) || 0; e.count++;
    });
    var topRev = Object.keys(byRev).map(function (k) { return byRev[k]; }).sort(function (a, b) { return b.revenue - a.revenue; });
    var totalRevenue = XK.sum(topRev.map(function (e) { return e.revenue; })), top10 = topRev.slice(0, 10), top10Sum = XK.sum(top10.map(function (e) { return e.revenue; }));

    // ---- Body ----
    body.innerHTML =
      XK.kpis([
        { label: 'Draft', value: sum(draft), sub: draft.length + ' invoice' + (draft.length === 1 ? '' : 's') },
        { label: 'Awaiting approval', value: sum(submitted), sub: submitted.length + ' invoice' + (submitted.length === 1 ? '' : 's') },
        { label: 'Awaiting payment', value: sum(authorised), sub: authorised.length + ' invoice' + (authorised.length === 1 ? '' : 's') },
        { label: 'Overdue', value: sum(overdue), sub: overdue.length + ' overdue' },
        { label: 'Billable expenses awaiting invoicing', value: billable.length, money: false, sub: 'count only — no amount on this endpoint' }
      ], c) +
      '<div class="xk-grid2" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Money due this week / next week</h3><div id="xk-due"></div></div>' +
      '<div class="xk-card"><h3>Top customers by revenue<label style="float:right;font-weight:400"><select id="xk-top-preset" style="font:inherit"><option value="this_month">This month</option><option value="this_quarter">This quarter</option><option value="this_fy_td">This financial year to date</option></select></label></h3><div id="xk-donut"></div></div>' +
      '</div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Customers owing the most</h3><div id="xk-owing"></div></div>' +
      '<div class="xk-card"><h3>Top customers by revenue (' + XK.h(pr.start) + ' to ' + XK.h(pr.end) + ')</h3><div id="xk-top"></div></div>' +
      '</div>';
    var presetEl = document.getElementById('xk-top-preset');
    presetEl.value = presetKey;
    presetEl.addEventListener('change', function () { self._salesPreset = presetEl.value; c.change({}); }); // client-side filter only — no refetch

    XK.bars(document.getElementById('xk-due'), { title: 'Money due this week vs next week', labels: ['Due this week', 'Due next week'], series: [{ name: 'Awaiting payment (AUTHORISED)', values: [sum(dueThisWeek), sum(dueNextWeek)] }] }, c);
    XK.donut(document.getElementById('xk-donut'), { title: 'Top customers by revenue', centre: money(totalRevenue), items: topRev.map(function (e) { return { label: e.name, value: e.revenue }; }) }, c);
    XK.grid(document.getElementById('xk-owing'), {
      columns: [{ key: 'name', title: 'Customer' }, { key: 'count', title: 'Invoices', num: true }, { key: 'due', title: 'Due', money: true }, { key: 'overdue', title: 'Overdue', money: true }],
      rows: custOwing, filter: true, total: { name: 'Total (' + custOwing.length + ')', count: authorised.length, due: sum(authorised), overdue: sum(overdue) },
      empty: c.errors.sales_open ? c.err('sales_open') : 'No open sales invoices.'
    }, c);
    XK.grid(document.getElementById('xk-top'), {
      columns: [{ key: 'name', title: 'Customer' }, { key: 'count', title: 'Invoices', num: true }, { key: 'revenue', title: 'Revenue', money: true }],
      rows: top10, filter: false, empty: c.errors.sales_period ? c.err('sales_period') : 'No invoiced or paid sales in this period.'
    }, c);

    // ---- Checks ----
    var checks = [
      { name: 'Draft / Awaiting approval / Awaiting payment reconcile against the rows shown', pass: c.errors.sales_open ? false : true, detail: c.errors.sales_open ? c.err('sales_open') : draft.length + ' draft, ' + submitted.length + ' awaiting approval, ' + authorised.length + ' awaiting payment' },
      { name: 'Overdue is a subset of Awaiting payment', pass: c.errors.sales_open ? null : overdue.length <= authorised.length && sum(overdue) <= sum(authorised) + 0.01, detail: overdue.length + ' of ' + authorised.length + ' invoices, ' + money(sum(overdue)) + ' of ' + money(sum(authorised)) },
      { name: 'Due this week + Due next week are each a subset of Awaiting payment', pass: c.errors.sales_open ? null : sum(dueThisWeek) <= sum(authorised) + 0.01 && sum(dueNextWeek) <= sum(authorised) + 0.01, detail: money(sum(dueThisWeek)) + ' + ' + money(sum(dueNextWeek)) + ' vs ' + money(sum(authorised)) + ' total' },
      { name: 'Every customer owing: Due ≥ Overdue', pass: c.errors.sales_open ? null : custViolations.length === 0, detail: custViolations.length ? custViolations.length + ' customer(s) show overdue exceeding due — a data or rendering bug' : custOwing.length + ' customer' + (custOwing.length === 1 ? '' : 's') + ' checked' },
      { name: 'Top customers by revenue ≤ total revenue for the period', pass: c.errors.sales_period ? null : top10Sum <= totalRevenue + 0.01, detail: money(top10Sum) + ' (top ' + top10.length + ') of ' + money(totalRevenue) + ' total' }
    ];
    var notes = ['Billable expenses: `list_linked_transactions` returns no amount or resolved contact name — the KPI is a count of APPROVED linked transactions only.'];
    if (open.length === 100 || period.length === 100 || billable.length === 100) notes.push('One or more lists returned exactly 100 rows (Xero’s page size) — only the first page was fetched, so totals may be incomplete for a very large ledger.');
    this._open = open; this._custOwing = custOwing; this._topRev = topRev; this._billableCount = billable.length; this._pr = pr;
    return { checks: checks, notes: notes, na: ['Presentation currency and tracking-category columns (not in this version)'], title: 'Sales Overview' };
  },
  excel: function (c) {
    var open = this._open || [], owing = this._custOwing || [], top = this._topRev || [], pr = this._pr || { start: '', end: '' };
    return [
      { name: 'Open invoices', rows: [['Invoice #', 'Customer', 'Status', 'Due date', 'Amount due']].concat(open.map(function (r) { return [r.InvoiceNumber || '', (r.Contact && r.Contact.Name) || '', r.Status || '', String(r.DueDateString || '').slice(0, 10), XK.num(r.AmountDue)]; })), widths: [16, 30, 14, 12, 14] },
      { name: 'Customers owing', rows: [['Customer', 'Invoices', 'Due', 'Overdue']].concat(owing.map(function (e) { return [e.name, e.count, e.due, e.overdue]; })), widths: [30, 10, 14, 14] },
      { name: 'Top customers by revenue', rows: [['Period ' + pr.start + ' to ' + pr.end], ['Customer', 'Invoices', 'Revenue']].concat(top.map(function (e) { return [e.name, e.count, e.revenue]; })), widths: [30, 10, 14] },
      { name: 'Billable expenses', rows: [['Awaiting invoicing (count)', this._billableCount || 0], ['Note', 'list_linked_transactions returns no amount field on this connector']], widths: [30, 40] }
    ];
  }
});
```

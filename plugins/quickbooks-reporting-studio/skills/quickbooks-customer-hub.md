---
name: quickbooks-customer-hub
description: QuickBooks Online Customer Hub overview (Q12) as a live, validated report in QuickBooks styling. Use when the user asks for the customer hub, open quotes, projects in progress, unpaid or overdue invoices by customer, or what needs attention with customers.
---

# Customer Hub overview (Q12)

Use when the user asks for the customer hub, open quotes, projects in progress, unpaid or overdue invoices by customer, or what needs attention with customers. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`list_customer`, `list_estimate`, `list_invoice`, `get_report_aged_receivables`, `qbo_query`, `get_preferences`).

QuickBooks location: All apps › Customer Hub › Overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q12. Delivery: Wave 3 (Train 05).

## Discovery call

`list_customer`, `list_estimate`, `list_invoice` (Balance > '0'), `get_report_aged_receivables`.

## Date defaults

No manual dates: quotes and invoices from the last 365 days, recomputed on every open.

## Members

| Member / view | How |
|---|---|
| Customers funnel | Open quotes · in-progress projects · unpaid invoices (opportunities and reviews N/A) |
| Overdue invoices | Overdue and all unpaid |
| Open quotes | Pending quotes with expiry |
| Needs attention | Overdue invoices and quotes expiring within 7 days (Customer Hub tasks are not in the API) |

## Validation checks (STEP 4 — shown in the banner)

- Unpaid invoices = A/R ageing total
- Funnel counts equal the entity queries (information)

## Save as

`fileName`: `quickbooks-customer-hub.html` · `tags`: ["quickbooks","customers","dashboard"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Funnel counts 0 · 0 · 0 · 1 · 0; overdue invoices A$0.00.
3. Compare the layout with the Q12 screenshots (row order, "Total for" rows, header block, footer, number format).
4. Validation banner: every check passes, or shows N/A with a stated reason.
5. Change every control in the control row, and confirm the report refetches and still validates. Switch View as to Client, then Bookkeeper.
6. Toggle Style to the mySMB house style and back, then switch the workspace to the dark theme.
7. Download PDF and Download Excel. Confirm they match the screen (the Excel file has Validation and Parameters sheets).
8. Use Download or Share from the report window, open the snapshot and confirm the period and figures are frozen and the controls that refetch are disabled.
9. Cross-client isolation (LIB-002): confirm that the saved report and every export carry only this company's figures and name.

## dataBindings

```json
{
  "inputs": [
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
      "default": "Client"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "customers",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_customer"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Active = true"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "quotes",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_estimate"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "open_invoices",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_invoice"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Balance > '0'"
        },
        "orderBy": {
          "kind": "static",
          "value": "DueDate"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "aged_receivables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_receivables"
      },
      "params": {}
    },
    {
      "id": "company_info",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "qbo_query"
      },
      "params": {
        "query": {
          "kind": "static",
          "value": "SELECT * FROM CompanyInfo"
        }
      }
    },
    {
      "id": "prefs",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_preferences"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
QB.app({
  title: 'Customer Hub overview', token: null, primary: 'aged_receivables', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Client', display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: {},
  tools: { customers: 'list_customer (active)', quotes: 'list_estimate (latest 1,000)', open_invoices: "list_invoice (Balance > '0')", aged_receivables: 'get_report_aged_receivables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, today = c.today, since = QB.iso(QB.addDays(QB.parse(today), -364));
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    if (c.errors.customers) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('customers')) + '</p>'; return { checks: [{ name: 'Customers loaded', pass: false, detail: c.err('customers') }] }; }
    var custs = q('customers', 'Customer'), flagged = custs.some(function (x) { return x.IsProject !== undefined; }), projects = custs.filter(function (x) { return flagged ? x.IsProject === true : x.Job === true; });
    var quotes = q('quotes', 'Estimate').filter(function (e) { return e.TxnDate >= since; }), openQ = quotes.filter(function (e) { return !e.TxnStatus || e.TxnStatus === 'Pending'; });
    var inv = q('open_invoices', 'Invoice'), od = inv.filter(function (x) { return x.DueDate && x.DueDate < today; }), unpaid = QB.sum(inv.map(function (x) { return x.Balance; })), odAmt = QB.sum(od.map(function (x) { return x.Balance; }));
    var soon = QB.iso(QB.addDays(QB.parse(today), 7));
    var attention = od.map(function (x) { return { task: 'Follow up overdue invoice ' + (x.DocNumber || x.Id), who: (x.CustomerRef || {}).name, due: x.DueDate, amt: x.Balance }; })
      .concat(openQ.filter(function (e) { return e.ExpirationDate && e.ExpirationDate <= soon; }).map(function (e) { return { task: (e.ExpirationDate < today ? 'Quote expired: ' : 'Quote expiring: ') + (e.DocNumber || e.Id), who: (e.CustomerRef || {}).name, due: e.ExpirationDate, amt: e.TotalAmt }; }));
    var funnel = [['Open opportunities', null], ['Open quotes', openQ.length], ['In progress projects', projects.length], ['Unpaid invoices', inv.length], ['Reviews', null]];
    body.innerHTML = '<div class="qb-card"><h3>Customers <span class="muted">· last 365 days</span></h3>' + QB.kpis(funnel.map(function (f) { return { label: f[0], money: false, value: f[1] == null ? 'N/A' : f[1], sub: f[1] == null ? 'Not in the Accounting API' : '' }; }), c) + '<div id="ch1"></div></div>' +
      '<div class="qb-grid2"><div class="qb-card"><h3>Overdue invoices</h3>' + QB.kpis([{ label: 'Overdue', value: odAmt, sub: od.length + ' invoice' + (od.length === 1 ? '' : 's') }, { label: 'All unpaid', value: unpaid }], c) + '</div>' +
      '<div class="qb-card"><h3>Open quotes</h3><div id="g1"></div></div></div><div class="qb-card"><h3>Needs attention</h3><div id="g2"></div></div>';
    QB.bars(document.getElementById('ch1'), { title: 'Customers funnel', labels: funnel.filter(function (f) { return f[1] != null; }).map(function (f) { return f[0]; }), series: [{ name: 'Count', values: funnel.filter(function (f) { return f[1] != null; }).map(function (f) { return f[1]; }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 0 }) });
    QB.grid(document.getElementById('g1'), { empty: 'No open quotes.', columns: [{ key: 'c', title: 'Customer' }, { key: 'n', title: 'Num' }, { key: 'd', title: 'Date' }, { key: 'x', title: 'Expires' }, { key: 'a', title: 'Amount', money: true }], rows: openQ.map(function (e) { return { c: (e.CustomerRef || {}).name, n: e.DocNumber, d: e.TxnDate, x: e.ExpirationDate || '', a: e.TotalAmt }; }) }, c);
    QB.grid(document.getElementById('g2'), { empty: 'Nothing needs attention.', columns: [{ key: 'task', title: 'Task' }, { key: 'who', title: 'Customer' }, { key: 'due', title: 'Due date' }, { key: 'amt', title: 'Amount', money: true }], rows: attention }, c);
    var ar = c.data.aged_receivables ? QB.find(QB.walk(c.data.aged_receivables), 'GrandTotal', /^total$/i) : null, arTot = ar ? QB.val(ar) : null;
    var checks = [
      { name: 'Unpaid invoices = A/R ageing total', pass: arTot == null || c.errors.open_invoices ? null : QB.near(unpaid, arTot, 1), detail: money(unpaid) + ' vs ' + money(arTot) + (arTot != null && !QB.near(unpaid, arTot, 1) ? ' — credits and journals to A/R are in the ageing but not in the invoice list' : '') },
      { name: 'Funnel counts equal the entity queries (information)', pass: null, detail: openQ.length + ' open quotes · ' + projects.length + ' projects · ' + inv.length + ' unpaid invoices' }];
    this._x = { funnel: funnel, openQ: openQ, attention: attention, odAmt: odAmt, unpaid: unpaid };
    return { checks: checks, period: QB.asOfLine(today), notes: ['"Needs attention" is built from overdue invoices and quotes expiring within 7 days (Customer Hub tasks are not in the Accounting API).'],
      na: ['Open opportunities, work requests, referrals and reviews (Customer Hub features outside the Accounting API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Customer Hub', widths: [40, 30, 14, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Customer Hub overview', s: 'bold' }], [QB.asOfLine(c.today)], []].concat(x.funnel.map(function (f) { return [f[0], f[1] == null ? 'N/A' : { v: f[1], s: 'none' }]; }), [[], ['Overdue', { v: x.odAmt, s: 'money' }], ['All unpaid', { v: x.unpaid, s: 'money' }], [], [{ v: 'Needs attention', s: 'bold' }, { v: 'Customer', s: 'bold' }, { v: 'Due', s: 'bold' }, { v: 'Amount', s: 'bold' }]], x.attention.map(function (a) { return [a.task, a.who, a.due, { v: a.amt, s: 'money' }]; })) }];
  }
});
```

---
name: quickbooks-sales-and-customers
description: QuickBooks Online Sales and customers family (Q25) as a live, validated report in QuickBooks styling. Use when the user asks for sales by customer, sales by product or service, income by customer, top customers, product mix, the customer contact list, the product/service list or quotes by customer.
---

# Sales and customers family (Q25)

Use when the user asks for sales by customer, sales by product or service, income by customer, top customers, product mix, the customer contact list, the product/service list or quotes by customer. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_customer_sales`, `get_report_item_sales`, `get_report_customer_income`, `get_report_profit_and_loss`, `list_customer`, `list_item`, `list_estimate`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Sales and customers. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q25. Delivery: Wave 2 (Train 03).

## Discovery call

`get_report_customer_sales` with `start_date`, `end_date`, `accounting_method` — expect one Data row per customer and a GrandTotal TOTAL row; `get_report_item_sales` has columns including Quantity and Amount.

## Date defaults

Preset `this_fy_td`: `start_date` = FY start, `end_date` = `"today"`.

## Members

| Member / view | How |
|---|---|
| Sales by Customer Summary | Report = Sales by Customer Summary |
| Sales by Product/Service Summary | Report = Sales by Product/Service Summary |
| Income by Customer Summary | Report = Income by Customer Summary |
| Customer Contact List | Report = Customer Contact List |
| Product/Service List | Report = Product/Service List |
| Quotes by Customer | Report = Quotes by Customer |
| Detail variants, Deposit Detail, Quotes & Progress Invoicing, Sales by Customer Type, Payment Method List, Time Activities by Customer, Transaction List by Customer / Tag Group, Cashflow Payment Transactions | Later members (tag groups are not in the API) |

## Validation checks (STEP 4 — shown in the banner)

- Σ customers = sales total
- Σ customers = income for the period (P&L Total for Income; a difference means income not raised on a sales form)
- Σ products/services = sales total

## Save as

`fileName`: `quickbooks-sales-and-customers.html` · `tags`: ["quickbooks","sales","customers"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Income A$72,532 (from the homepage) — Sales by Customer should tie to the period's sales income.
3. Compare the layout with the Q25 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "start_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "end_date",
      "label": "To",
      "type": "date",
      "default": "today"
    },
    {
      "name": "basis",
      "label": "Accounting method",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "Client"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"customers\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "customer_sales",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_customer_sales"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "item_sales",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_item_sales"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "customer_income",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_customer_income"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "pnl",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
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
      "id": "products",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_item"
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
          "value": 500
        }
      }
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
  title: 'Sales by Customer Summary', token: 'SALES_BY_CUSTOMER_SUMMARY', route: 'reportv2', primary: 'customer_sales', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', persona: 'Client',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"customers","x":""}' },
  uses: { customer_sales: ['start_date', 'end_date', 'basis'], item_sales: ['start_date', 'end_date', 'basis'], customer_income: ['start_date', 'end_date', 'basis'], pnl: ['start_date', 'end_date', 'basis'], customers: [], products: [], quotes: [], company_info: [], prefs: [] },
  tools: { customer_sales: 'get_report_customer_sales', item_sales: 'get_report_item_sales', customer_income: 'get_report_customer_income', pnl: 'get_report_profit_and_loss (income tie)', customers: 'list_customer', products: 'list_item', quotes: 'list_estimate', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['customers', 'Sales by Customer Summary'], ['products', 'Sales by Product/Service Summary'], ['income', 'Income by Customer Summary'], ['contacts', 'Customer Contact List'], ['items', 'Product/Service List'], ['quotes', 'Quotes by Customer']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'customers';
    var need = { customers: 'customer_sales', products: 'item_sales', income: 'customer_income', contacts: 'customers', items: 'products', quotes: 'quotes' }[v];
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(need)) + '</p>'; return { checks: [{ name: 'Report data loaded', pass: false, detail: c.err(need) }] }; }
    if (!c.data[need]) return {};
    var rowsOf = function (rep) { return rep ? QB.walk(rep).filter(function (l) { return l.kind === 'row'; }) : []; }, gtOf = function (rep) { var g = rep ? QB.find(QB.walk(rep), 'GrandTotal', /^total$/i) : null; return g; };
    var col = function (rep, re) { var t = QB.cols(rep).map(function (x) { return x.title; }); for (var i = 1; i < t.length; i++) if (re.test(t[i])) return i - 1; return -1; };
    var cs = c.data.customer_sales, cust = rowsOf(cs).map(function (l) { return { name: l.label, total: QB.val(l) }; }), csTot = QB.val(gtOf(cs));
    var is = c.data.item_sales, ai = is ? col(is, /^amount$/i) : -1, qi = is ? col(is, /^(quantity|qty)$/i) : -1;
    var prod = rowsOf(is).map(function (l) { return { name: l.label, qty: qi >= 0 ? l.values[qi] : null, amount: ai >= 0 ? l.values[ai] : QB.val(l) }; }), isTot = is && gtOf(is) ? (ai >= 0 ? gtOf(is).values[ai] : QB.val(gtOf(is))) : null;
    var pl = c.data.pnl ? QB.walk(c.data.pnl) : [], inc = QB.val(QB.find(pl, 'Income', /^total (for )?income$/i));
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    var kp = QB.kpis([{ label: 'Total sales', value: csTot }, { label: 'Customers with sales', money: false, value: cust.length }, { label: 'Top customer share', text: csTot && cust.length ? QB.pct(Math.max.apply(null, cust.map(function (x) { return x.total || 0; })) / csTot) : 'N/A — not in source' }, { label: 'Products / services sold', money: false, value: prod.length }], c);
    body.innerHTML = kp + '<div id="g1"></div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3>Top customers</h3><div id="ch1"></div></div><div class="qb-card"><h3>Product mix</h3><div id="ch2"></div></div></div>';
    var g = document.getElementById('g1');
    if (v === 'customers') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Customer' }, { key: 'total', title: 'Total', money: true }], rows: cust, total: { name: 'TOTAL', total: csTot } }, c);
    else if (v === 'products') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Product/Service' }, { key: 'qty', title: 'Quantity', num: true, fmt: function (x) { return x == null ? '' : String(x); } }, { key: 'amount', title: 'Amount', money: true }], rows: prod, total: { name: 'TOTAL', amount: isTot } }, c);
    else if (v === 'income') { var ci = c.data.customer_income, ii = col(ci, /^income$/i), ei = col(ci, /^expense/i), ni = col(ci, /^net income$/i), g2 = gtOf(ci);
      QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Customer' }, { key: 'i', title: 'Income', money: true }, { key: 'e', title: 'Expenses', money: true }, { key: 'n', title: 'Net Income', money: true }], rows: rowsOf(ci).map(function (l) { return { name: l.label, i: l.values[ii], e: l.values[ei], n: l.values[ni] }; }), total: g2 ? { name: 'TOTAL', i: g2.values[ii], e: g2.values[ei], n: g2.values[ni] } : null }, c); }
    else if (v === 'contacts') QB.grid(g, { filter: true, columns: [{ key: 'n', title: 'Customer' }, { key: 'e', title: 'Email' }, { key: 'p', title: 'Phone' }, { key: 'b', title: 'Open balance', money: true }], rows: q('customers', 'Customer').map(function (x) { return { n: x.DisplayName, e: (x.PrimaryEmailAddr || {}).Address || '', p: (x.PrimaryPhone || {}).FreeFormNumber || '', b: x.Balance }; }) }, c);
    else if (v === 'items') QB.grid(g, { filter: true, columns: [{ key: 'n', title: 'Product/Service' }, { key: 't', title: 'Type' }, { key: 'u', title: 'Sales price', money: true }], rows: q('products', 'Item').map(function (x) { return { n: x.Name, t: x.Type, u: x.UnitPrice }; }) }, c);
    else { var qs = q('quotes', 'Estimate').filter(function (x) { return x.TxnDate >= c.inputs.start_date && x.TxnDate <= c.inputs.end_date; });
      QB.grid(g, { filter: true, empty: 'No quotes in this period.', columns: [{ key: 'c', title: 'Customer' }, { key: 'n', title: 'Num' }, { key: 'd', title: 'Date' }, { key: 's', title: 'Status' }, { key: 'a', title: 'Amount', money: true }], rows: qs.map(function (x) { return { c: (x.CustomerRef || {}).name, n: x.DocNumber, d: x.TxnDate, s: x.TxnStatus, a: x.TotalAmt }; }), total: { c: 'TOTAL', a: QB.sum(qs.map(function (x) { return x.TotalAmt; })) } }, c); }
    var top = cust.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); }).slice(0, 8);
    QB.bars(document.getElementById('ch1'), { title: 'Top customers', labels: top.map(function (x) { return x.name.slice(0, 16); }), series: [{ name: 'Sales', values: top.map(function (x) { return x.total; }) }] }, c);
    QB.donut(document.getElementById('ch2'), { title: 'Product mix', items: prod.map(function (x) { return { label: x.name, value: x.amount }; }) }, c);
    var checks = [
      { name: 'Σ customers = sales total', pass: csTot == null ? null : QB.near(csTot, QB.sum(cust.map(function (x) { return x.total; }))), detail: money(csTot) },
      { name: 'Σ customers = income for the period (Profit and Loss Total for Income)', pass: csTot == null || inc == null ? null : QB.near(csTot, inc, 1), detail: 'Sales ' + money(csTot) + ' vs income ' + money(inc) + (csTot != null && inc != null && !QB.near(csTot, inc, 1) ? ' — the difference is income not raised on a sales form (e.g. journals)' : '') },
      { name: 'Σ products/services = sales total', pass: isTot == null || csTot == null ? null : QB.near(isTot, csTot, 1), detail: money(isTot) }];
    this._x = { cust: cust, prod: prod, csTot: csTot, isTot: isTot };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1],
      na: ['Sales by Customer / Product Detail, Deposit Detail, Quotes & Progress Invoicing Summary, Sales by Customer Type Detail, Payment Method List, Time Activities by Customer, Transaction List by Customer / Tag Group, Cashflow Payment Transactions (later members; tag groups are not in the API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []]; };
    return [{ name: 'Sales by Customer', widths: [40, 18], rows: head('Sales by Customer Summary').concat([[{ v: 'Customer', s: 'bold' }, { v: 'Total', s: 'bold' }]], x.cust.map(function (r) { return [r.name, { v: r.total, s: 'money' }]; }), [[{ v: 'TOTAL', s: 'bold' }, { v: x.csTot, s: 'moneyBold' }]]) },
      { name: 'Sales by Product', widths: [40, 12, 18], rows: head('Sales by Product/Service Summary').concat([[{ v: 'Product/Service', s: 'bold' }, { v: 'Quantity', s: 'bold' }, { v: 'Amount', s: 'bold' }]], x.prod.map(function (r) { return [r.name, r.qty == null ? null : { v: r.qty, s: 'none' }, { v: r.amount, s: 'money' }]; }), [[{ v: 'TOTAL', s: 'bold' }, null, { v: x.isTot, s: 'moneyBold' }]]) }];
  }
});
```

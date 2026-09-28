---
name: quickbooks-expenses-and-suppliers
description: QuickBooks Online Expenses and suppliers family (Q27) as a live, validated report in QuickBooks styling. Use when the user asks for expenses by supplier, top suppliers, supplier concentration, a purchase list, cheque detail or the supplier contact list.
---

# Expenses and suppliers family (Q27)

Use when the user asks for expenses by supplier, top suppliers, supplier concentration, a purchase list, cheque detail or the supplier contact list. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_vendor_expenses`, `get_report_profit_and_loss`, `list_purchase`, `list_bill`, `list_vendor`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Expenses and suppliers. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q27. Delivery: Wave 2 (Train 03).

## Discovery call

`get_report_vendor_expenses` with `start_date`, `end_date`, `accounting_method` — expect one Data row per supplier and a GrandTotal TOTAL row.

## Date defaults

Preset `this_fy_td`.

## Members

| Member / view | How |
|---|---|
| Expenses by Supplier Summary | Report = Expenses by Supplier Summary (with share of total and concentration) |
| Purchase List | Report = Purchase List (expenses, cheques, credit-card expenses and bills in the period) |
| Cheque Detail | Report = Cheque Detail |
| Supplier Contact List | Report = Supplier Contact List |
| Purchases by Supplier / Product Detail, Transaction List by Supplier, Supplier Phone List | Later members |

## Validation checks (STEP 4 — shown in the banner)

- Σ suppliers = supplier expense total
- Σ suppliers = expenses for the period (Cost of Sales + Expenses + Other Expenses; a difference means expenses with no supplier)

## Save as

`fileName`: `quickbooks-expenses-and-suppliers.html` · `tags`: ["quickbooks","expenses","suppliers"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Top supplier concentration led by Adaptovate (see the Expenses & Pay Bills overview).
3. Compare the layout with the Q27 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "Bookkeeper"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"suppliers\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "vendor_expenses",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_vendor_expenses"
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
      "id": "purchases",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_purchase"
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
      "id": "bills",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_bill"
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
      "id": "suppliers",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_vendor"
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
  title: 'Expenses by Supplier Summary', token: 'VENDOR_EXPENSES', route: 'reportv2', primary: 'vendor_expenses', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"suppliers","x":""}' },
  uses: { vendor_expenses: ['start_date', 'end_date', 'basis'], pnl: ['start_date', 'end_date', 'basis'], purchases: [], bills: [], suppliers: [], company_info: [], prefs: [] },
  tools: { vendor_expenses: 'get_report_vendor_expenses', pnl: 'get_report_profit_and_loss (expense tie)', purchases: 'list_purchase (latest 1,000)', bills: 'list_bill (latest 1,000)', suppliers: 'list_vendor', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['suppliers', 'Expenses by Supplier Summary'], ['purchases', 'Purchase List'], ['cheques', 'Cheque Detail'], ['contacts', 'Supplier Contact List']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'suppliers';
    var need = { suppliers: 'vendor_expenses', purchases: 'purchases', cheques: 'purchases', contacts: 'suppliers' }[v];
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(need)) + '</p>'; return { checks: [{ name: 'Report data loaded', pass: false, detail: c.err(need) }] }; }
    if (!c.data[need]) return {};
    var ve = c.data.vendor_expenses, lines = ve ? QB.walk(ve) : [], sup = lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return { name: l.label, total: QB.val(l) }; });
    var gt = QB.find(lines, 'GrandTotal', /^total$/i), veTot = QB.val(gt);
    var pl = c.data.pnl ? QB.walk(c.data.pnl) : [], T = function (g) { return QB.val(QB.find(pl, g)) || 0; }, plExp = c.data.pnl ? Math.round((T('COGS') + T('Expenses') + T('OtherExpenses')) * 100) / 100 : null;
    var sorted = sup.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); }), top5 = QB.sum(sorted.slice(0, 5).map(function (x) { return x.total; }));
    var hhi = veTot ? Math.round(sup.reduce(function (s, x) { var sh = (x.total || 0) / veTot; return s + sh * sh; }, 0) * 10000) : null;
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; }, inP = function (d) { return d >= c.inputs.start_date && d <= c.inputs.end_date; };
    var pur = q('purchases', 'Purchase').filter(function (x) { return inP(x.TxnDate); }).map(function (x) { return { d: x.TxnDate, t: x.PaymentType === 'Check' ? 'Cheque' : x.PaymentType === 'CreditCard' ? 'Credit card expense' : 'Expense', n: x.DocNumber || '', p: (x.EntityRef || {}).name || '', a: (x.AccountRef || {}).name || '', amt: x.TotalAmt }; })
      .concat(q('bills', 'Bill').filter(function (x) { return inP(x.TxnDate); }).map(function (x) { return { d: x.TxnDate, t: 'Bill', n: x.DocNumber || '', p: (x.VendorRef || {}).name || '', a: 'Accounts Payable (A/P)', amt: x.TotalAmt }; }));
    body.innerHTML = QB.kpis([{ label: 'Total expenses by supplier', value: veTot }, { label: 'Suppliers', money: false, value: sup.length }, { label: 'Top 5 concentration', text: veTot ? QB.pct(top5 / veTot) : 'N/A — not in source', sub: hhi == null ? '' : 'HHI ' + hhi + (hhi > 2500 ? ' (highly concentrated)' : hhi > 1500 ? ' (moderately concentrated)' : ' (diversified)') }], c) +
      '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3>Top suppliers</h3><div id="ch1"></div></div>';
    var g = document.getElementById('g1');
    if (v === 'suppliers') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Supplier' }, { key: 'total', title: 'Total', money: true }, { key: 'share', title: '% of total', fmt: function (x) { return QB.pct(x); } }], rows: sup.map(function (x) { return { name: x.name, total: x.total, share: veTot ? (x.total || 0) / veTot : null }; }), total: { name: 'TOTAL', total: veTot } }, c);
    else if (v === 'purchases' || v === 'cheques') { var list = v === 'cheques' ? pur.filter(function (x) { return x.t === 'Cheque'; }) : pur;
      QB.grid(g, { filter: true, empty: 'No transactions in this period.', columns: [{ key: 'd', title: 'Date' }, { key: 't', title: 'Transaction type' }, { key: 'n', title: 'Num' }, { key: 'p', title: 'Supplier' }, { key: 'a', title: 'Account' }, { key: 'amt', title: 'Amount', money: true }], rows: list, total: { d: 'TOTAL', amt: QB.sum(list.map(function (x) { return x.amt; })) } }, c); }
    else QB.grid(g, { filter: true, columns: [{ key: 'n', title: 'Supplier' }, { key: 'e', title: 'Email' }, { key: 'p', title: 'Phone' }, { key: 'b', title: 'Open balance', money: true }], rows: q('suppliers', 'Vendor').map(function (x) { return { n: x.DisplayName, e: (x.PrimaryEmailAddr || {}).Address || '', p: (x.PrimaryPhone || {}).FreeFormNumber || '', b: x.Balance }; }) }, c);
    var top = sorted.slice(0, 8);
    QB.bars(document.getElementById('ch1'), { title: 'Top suppliers', labels: top.map(function (x) { return x.name.slice(0, 16); }), series: [{ name: 'Expenses', values: top.map(function (x) { return x.total; }) }] }, c);
    var checks = [
      { name: 'Σ suppliers = supplier expense total', pass: veTot == null ? null : QB.near(veTot, QB.sum(sup.map(function (x) { return x.total; }))), detail: money(veTot) },
      { name: 'Σ suppliers = expenses for the period (Cost of Sales + Expenses + Other Expenses)', pass: veTot == null || plExp == null ? null : QB.near(veTot, plExp, 1), detail: 'Suppliers ' + money(veTot) + ' vs P&L ' + money(plExp) + (veTot != null && plExp != null && !QB.near(veTot, plExp, 1) ? ' — the difference is expenses with no supplier (e.g. journals, depreciation)' : '') }];
    this._x = { sup: sup, veTot: veTot, pur: pur };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1],
      notes: ['Purchase List and Cheque Detail use the latest 1,000 purchases and bills, filtered to the period.'],
      na: ['Purchases by Supplier Detail, Purchases by Product/Service Detail, Transaction List by Supplier and Supplier Phone List (later members)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Expenses by Supplier Summary', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], [{ v: 'Supplier', s: 'bold' }, { v: 'Total', s: 'bold' }]];
    return [{ name: 'Expenses by Supplier', widths: [40, 18], rows: head.concat(x.sup.map(function (r) { return [r.name, { v: r.total, s: 'money' }]; }), [[{ v: 'TOTAL', s: 'bold' }, { f: 'SUM(B6:B' + (5 + x.sup.length) + ')', v: x.veTot, s: 'moneyBold' }]]) },
      { name: 'Purchase List', widths: [12, 20, 10, 32, 28, 16], rows: [[{ v: 'Date', s: 'bold' }, { v: 'Type', s: 'bold' }, { v: 'Num', s: 'bold' }, { v: 'Supplier', s: 'bold' }, { v: 'Account', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat(x.pur.map(function (r) { return [r.d, r.t, r.n, r.p, r.a, { v: r.amt, s: 'money' }]; })) }];
  }
});
```

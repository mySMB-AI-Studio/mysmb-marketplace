---
name: quickbooks-custom-report-builder
description: QuickBooks Online Custom report builder (Q35) as a live, validated report in QuickBooks styling. Use when the user asks for a QuickBooks report that no other skill covers, a custom report, or a specific QuickBooks standard report by name (for example Sales by Class, Sales by Location, Customer Balance Detail, Supplier Balance Detail, Transaction List, Profit and Loss Detail).
---

# Custom report builder (Q35)

Use when the user asks for a QuickBooks report that no other skill covers, a custom report, or a specific QuickBooks standard report by name (for example Sales by Class, Sales by Location, Customer Balance Detail, Supplier Balance Detail, Transaction List, Profit and Loss Detail). Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_class_sales`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Custom report builder. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q35. Delivery: Wave 3 (Train 06).

## Choosing the report

Pick the QuickBooks report tool that matches the request from: `get_report_account_list`, `get_report_aged_payable_detail`, `get_report_aged_payables`, `get_report_aged_receivable_detail`, `get_report_aged_receivables`, `get_report_balance_sheet`, `get_report_cash_flow`, `get_report_class_sales`, `get_report_customer_balance`, `get_report_customer_balance_detail`, `get_report_customer_income`, `get_report_customer_sales`, `get_report_department_sales`, `get_report_general_ledger`, `get_report_general_ledger_detail`, `get_report_inventory_valuation_summary`, `get_report_item_sales`, `get_report_journal_report`, `get_report_profit_and_loss`, `get_report_profit_and_loss_detail`, `get_report_sales_by_class_summary`, `get_report_sales_by_customer`, `get_report_sales_by_department`, `get_report_sales_by_product`, `get_report_tax_summary`, `get_report_transaction_list`, `get_report_trial_balance`, `get_report_vendor_balance`, `get_report_vendor_balance_detail`, `get_report_vendor_expenses`. In the dataBindings change only the `custom_report` binding's `tool.name`. In the config change only `title`, `tools.custom_report` (the tool name) and `defaults`; keep every other line. If the report takes no period (for example Account List), keep the date inputs — QuickBooks ignores them. Prefer a dedicated family skill when one exists.

## Discovery call

The chosen `get_report_*` tool with the period and basis — note whether Rows contain Sections (statement layout) or only Data rows (list layout).

## Date defaults

Preset `this_fy_td` unless the user names a period.

## Members

| Member / view | How |
|---|---|
| Any of the 30 QuickBooks report tools | Set the binding tool, `tools.custom_report`, `title` and `fileName` for the chosen report (list below) |
| Revenue Recognition (Beta), Bill Approval Status, Invoice Approval Status | N/A — not in the Accounting API |
| Product/Item Profitability by Customer | Use get_report_item_sales with Display columns by Customers |

## Validation checks (STEP 4 — shown in the banner)

- Each 'Total for' = Σ its rows (statement layout) or TOTAL row = Σ rows (list layout)
- QuickBooks returned the requested period

## Save as

`fileName`: `quickbooks-custom-report.html` · `tags`: ["quickbooks","custom-report"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): User-defined — compare with the same QuickBooks report and controls.
3. Compare the layout with the Q35 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "columns_by",
      "label": "Display columns by",
      "type": "enum",
      "options": [
        "Total",
        "Month",
        "Quarter",
        "Year",
        "Customers",
        "Vendors",
        "Classes",
        "Departments",
        "ProductsAndServices"
      ],
      "default": "Total"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "custom_report",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_class_sales"
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
        },
        "summarize_column_by": {
          "kind": "input",
          "input": "columns_by"
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
  title: 'Sales by Class Summary', token: null, primary: 'custom_report', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', columnsBy: 'columns_by', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', columns_by: 'Total', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","x":""}' },
  uses: { custom_report: ['start_date', 'end_date', 'basis', 'columns_by'], company_info: [], prefs: [] },
  tools: { custom_report: 'get_report_class_sales', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years'], ['Customers', 'Customers'], ['Vendors', 'Suppliers'], ['Classes', 'Classes'], ['Departments', 'Locations'], ['ProductsAndServices', 'Products/Services']],
  render: function (c) {
    var body = c.body, rep = c.data.custom_report, T = this.title;
    if (c.errors.custom_report) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('custom_report')) + '</p>'; return { checks: [{ name: T + ' loaded', pass: false, detail: c.err('custom_report') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this period', pass: null }] }; }
    var cols = QB.cols(rep), lines = QB.walk(rep), sectioned = lines.some(function (l) { return l.kind === 'header'; });
    var moneyCol = cols.map(function (x) { return x.type === 'Money' || /total|amount|balance|income|expense|value|debit|credit|sales/i.test(x.title); });
    var titles = cols.map(function (x, i) { return x.title || (i ? 'Total' : ''); });
    if (sectioned) body.innerHTML = '<div class="qb-scroll">' + QB.statement(lines, titles, c) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>Top lines</h3><div id="ch1"></div></div>';
    else {
      body.innerHTML = '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3>Top lines</h3><div id="ch1"></div></div>';
      var gt = QB.find(lines, 'GrandTotal', /^total$/i), totalRow = null;
      if (gt) { totalRow = { c0: 'TOTAL' }; gt.values.forEach(function (v, i) { totalRow['c' + (i + 1)] = moneyCol[i + 1] ? v : gt.raw[i]; }); }
      QB.grid(document.getElementById('g1'), { filter: true, columns: titles.map(function (t, i) { return { key: 'c' + i, title: t || (i ? '' : 'Name'), money: i > 0 && moneyCol[i] }; }),
        rows: lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { var o = { c0: l.label }; l.raw.forEach(function (x, i) { o['c' + (i + 1)] = moneyCol[i + 1] ? QB.num(x) : x; }); return o; }), total: totalRow }, c);
    }
    var mi = -1; for (var i = cols.length - 1; i > 0; i--) if (moneyCol[i]) { mi = i - 1; break; }
    var top = lines.filter(function (l) { return l.kind === 'row' && mi >= 0 && l.values[mi] != null; }).sort(function (a, b) { return Math.abs(b.values[mi]) - Math.abs(a.values[mi]); }).slice(0, 10);
    QB.bars(document.getElementById('ch1'), { title: 'Top lines', labels: top.map(function (l) { return String(l.label).slice(0, 16); }), series: [{ name: titles[mi + 1] || 'Total', values: top.map(function (l) { return l.values[mi]; }) }] }, c);
    var ties = QB.sectionTies(rep), hd = QB.header(rep), gtl = QB.find(lines, 'GrandTotal', /^total$/i);
    var flatOk = gtl && mi >= 0 ? QB.near(gtl.values[mi], QB.sum(lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return l.values[mi]; })), 0.05) : null;
    this._x = { lines: lines, titles: titles, moneyCol: moneyCol };
    return { checks: [
      { name: sectioned ? "Each 'Total for' = Σ its rows" : 'TOTAL row = Σ rows', pass: sectioned ? (ties.checked ? ties.failed.length === 0 : null) : flatOk, detail: sectioned ? (ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections') : '' },
      { name: 'QuickBooks returned the requested period', pass: !c.live || !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') }],
      notes: ['Built with the custom report builder from the QuickBooks ' + (hd.ReportName || 'report') + ' report.'], title: T };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [QB.sheetFromLines(this.title, c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), x.titles, x.lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values.map(function (v, i) { return x.moneyCol[i + 1] ? v : null; }) }; }), QB.footerStamp(c.inputs.basis, c.fetchedAt))];
  }
});
```

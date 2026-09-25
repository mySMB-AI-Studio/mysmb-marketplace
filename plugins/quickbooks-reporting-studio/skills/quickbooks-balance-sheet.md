---
name: quickbooks-balance-sheet
description: QuickBooks Online Balance Sheet family (Q18) as a live, validated report in QuickBooks styling. Use when the user asks for a balance sheet, statement of financial position, net assets, balance sheet comparison, balance sheet summary, working capital or current ratio at a date.
---

# Balance Sheet family (Q18)

Use when the user asks for a balance sheet, statement of financial position, net assets, balance sheet comparison, balance sheet summary, working capital or current ratio at a date. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_balance_sheet`, `get_report_profit_and_loss`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Business overview › Balance Sheet. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q18. Delivery: Wave 1.

## Discovery call

`get_report_balance_sheet` with `end_date`, `accounting_method` — expect sections with `group` TotalAssets, CurrentAssets, BankAccounts, AR, OtherCurrentAssets, TotalLiabilitiesAndEquity, Liabilities, CurrentLiabilities, AP, CreditCards, Equity, and an Equity row labelled Net Income.

## Date defaults

As-of preset `today` (`a` in `display`): `as_at` = `"today"` (config: today's date); `fy_start` = first day of the financial year containing `as_at` (the report re-derives it on every change); `compare_as_at` = the same date one year earlier.

## Members

| Member / view | How |
|---|---|
| Balance Sheet | Default view |
| Balance Sheet Comparison | Compare to = Previous month end / Previous year |
| Balance Sheet Summary | Report = Balance Sheet Summary (account lines collapsed) |
| Balance Sheet by Month / Quarter / Class / Location | Display columns by |
| Balance Sheet Detail | N/A here — transaction level, use the General Ledger family (Wave 2) |
| Statement of Changes in Equity | N/A — not exposed by the Accounting API |

## Validation checks (STEP 4 — shown in the banner)

- Total for Assets = Total for Liabilities + Equity
- Each 'Total for' = Σ its rows
- Net Earnings = P&L financial year to date (tie to get_report_profit_and_loss from the FY start to the as-of date)
- QuickBooks returned the requested date
- Comparison deltas recomputed (when Compare to is on)

## Save as

`fileName`: `quickbooks-balance-sheet.html` · `tags`: ["quickbooks","balance-sheet","finance"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): As of 31 Aug 2026: Wise-AUD A$147,337.00 · ANZ A$99.00 · PHP A$2.69 · A/R A$91,905.00 · Prepaid expenses A$11,966.18 · Security Deposit A$28,800.00 · Intangibles – Trademarks A$18,294.11 · A/P A$175,222.57 · A/P – USD A$95,858.82 · Doug's Amex Card A$25,803.79 · Total for Liabilities and Shareholders' Equity A$298,398.60.
3. Compare the layout with the Q18 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "as_at",
      "label": "As of",
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
        "Classes",
        "Departments"
      ],
      "default": "Total"
    },
    {
      "name": "compare_as_at",
      "label": "Compare as of",
      "type": "date",
      "default": "2025-09-25"
    },
    {
      "name": "fy_start",
      "label": "Financial year start",
      "type": "date",
      "default": "2026-07-01"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"bs\"}"
    }
  ],
  "bindings": [
    {
      "id": "bs",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "fy_start"
        },
        "end_date": {
          "kind": "input",
          "input": "as_at"
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
      "id": "bs_compare",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
      },
      "params": {
        "end_date": {
          "kind": "input",
          "input": "compare_as_at"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Total"
        }
      }
    },
    {
      "id": "pnl_ytd",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "fy_start"
        },
        "end_date": {
          "kind": "input",
          "input": "as_at"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Total"
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
  title: 'Balance Sheet', token: 'BAL_SHEET', route: 'reportv2', primary: 'bs', company: 'company_info', prefs: 'prefs',
  inputs: { asAt: 'as_at', basis: 'basis', columnsBy: 'columns_by', cmpAsAt: 'compare_as_at', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', columns_by: 'Total', compare_as_at: '2025-09-25', fy_start: '2026-07-01', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"today","c":"none","v":"bs"}' },
  uses: { bs: ['fy_start', 'as_at', 'basis', 'columns_by'], bs_compare: ['compare_as_at', 'basis'], pnl_ytd: ['fy_start', 'as_at', 'basis'], company_info: [], prefs: [] },
  tools: { bs: 'get_report_balance_sheet', bs_compare: 'get_report_balance_sheet (comparison date)', pnl_ytd: 'get_report_profit_and_loss (financial year to date, for the Net Earnings tie)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years'], ['Classes', 'Classes'], ['Departments', 'Locations']],
  compare: true,
  views: [['bs', 'Balance Sheet'], ['summary', 'Balance Sheet Summary']],
  derive: function (inp, fyMonth) { return { fy_start: QB.fyStartOf(inp.as_at, fyMonth) }; },
  render: function (c) {
    var body = c.body, rep = c.data.bs;
    if (c.errors.bs) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('bs')) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err('bs') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this date', pass: null }] }; }
    var cols = QB.cols(rep), multi = cols.length > 2, cmpOn = c.compareMode !== 'none' && !multi;
    var m = QB.mergeCompare(rep, cmpOn ? c.data.bs_compare : null), lines = m.lines;
    if (c.view === 'summary') lines = lines.filter(function (l) { return l.kind !== 'row' || l.depth <= 1; });
    var T = function (g, re) { return QB.val(QB.find(lines, g, re)); };
    var A = T('TotalAssets', /^total assets$/i), L = T('Liabilities', /^total liabilities$/i), E = T('Equity', /^total equity$/i), LE = T('TotalLiabilitiesAndEquity', /^total liabilities and (shareholders' )?equity$/i);
    var CA = T('CurrentAssets', /^total current assets$/i), CL = T('CurrentLiabilities', /^total current liabilities$/i);
    var niRow = QB.find(m.lines, null, /^net (income|earnings)$/i, 'row'), niBS = QB.val(niRow);
    m.lines.forEach(function (l) { if (l === niRow) l.label = 'Net Earnings'; });
    var pl = c.data.pnl_ytd, niPL = pl ? QB.val(QB.find(QB.walk(pl), 'NetIncome', /^net income$/i)) : null;
    var extra = cmpOn ? QB.compareCols(c.compareMode === 'prev_year' ? 'Previous year' : 'Previous month end') : [];
    var titles = [''].concat(cols.slice(1).map(function (x) { return x.title || 'Total'; }));
    var html = QB.kpis([{ label: 'Total for Assets', value: A }, { label: 'Total for Liabilities', value: L }, { label: 'Total for Equity', value: E },
      { label: 'Working capital', value: CA != null && CL != null ? Math.round((CA - CL) * 100) / 100 : null, sub: 'Current assets − current liabilities' },
      { label: 'Current ratio', text: CA != null && CL ? (CA / CL).toFixed(2) : 'N/A — not in source' }], c);
    html += '<div class="qb-scroll">' + QB.statement(lines, titles, c, extra) + '</div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3>Assets vs liabilities + equity</h3><div id="ch1"></div></div>' + (multi ? '<div class="qb-card"><h3>Over time</h3><div id="ch2"></div></div>' : '') + '</div>';
    body.innerHTML = html;
    QB.bars(document.getElementById('ch1'), { title: 'Assets vs liabilities and equity', labels: ['Assets', 'Liabilities', 'Equity', 'Liabilities + Equity'], series: [{ name: 'As of ' + c.inputs.as_at, values: [A, L, E, LE] }] }, c);
    if (multi) {
      var mc = cols.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), idx = mc.map(function (x) { return x.i - 1; });
      var ser = function (g) { var l = QB.find(lines, g); return idx.map(function (i) { return l ? l.values[i] : null; }); };
      QB.line(document.getElementById('ch2'), { title: 'Assets and liabilities over time', labels: mc.map(function (x) { return x.title; }), series: [{ name: 'Total Assets', values: ser('TotalAssets') }, { name: 'Total Liabilities', values: ser('Liabilities') }] }, c);
    }
    var ties = QB.sectionTies(rep), hd = QB.header(rep);
    var checks = [
      { name: 'Total for Assets = Total for Liabilities + Equity', pass: A == null || LE == null ? null : QB.near(A, LE) && (L == null || E == null || QB.near(A, L + E)), detail: QB.money(A, c.currency, c.display) + ' vs ' + QB.money(LE, c.currency, c.display) },
      { name: "Each 'Total for' = Σ its rows", pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Net Earnings = P&L financial year to date', pass: niBS == null || niPL == null ? null : QB.near(niBS, niPL), detail: c.errors.pnl_ytd ? c.err('pnl_ytd') : QB.money(niBS, c.currency, c.display) + ' vs P&L ' + QB.money(niPL, c.currency, c.display) + ' (' + c.inputs.fy_start + ' to ' + c.inputs.as_at + ')' },
      { name: 'QuickBooks returned the requested date', pass: !c.live ? null : hd.EndPeriod === c.inputs.as_at, detail: 'As of ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }
    ];
    if (cmpOn) { var ch = QB.header(c.data.bs_compare); checks.push({ name: 'Comparison deltas recomputed from the comparison date', pass: c.errors.bs_compare ? false : !c.live ? null : ch.EndPeriod === c.inputs.compare_as_at, detail: c.errors.bs_compare ? c.err('bs_compare') : 'As of ' + (ch.EndPeriod || '?') }); }
    this._x = { lines: lines, titles: titles, extra: extra };
    return { checks: checks, na: ['Balance Sheet Detail (transaction level — use the General Ledger family)', 'Statement of Changes in Equity (not exposed by the Accounting API)'],
      notes: m.onlyInCompare.length ? [m.onlyInCompare.length + ' account(s) had a balance only at the comparison date: ' + m.onlyInCompare.join(', ')] : [],
      title: c.view === 'summary' ? 'Balance Sheet Summary' : cmpOn ? 'Balance Sheet Comparison' : 'Balance Sheet', period: QB.asOfLine(c.inputs.as_at) };
  },
  excel: function (c) {
    var x = this._x || { lines: [], titles: [''], extra: [] }, titles = x.titles.concat(x.extra.map(function (e) { return e.title; }));
    return [QB.sheetFromLines('Balance Sheet', c.company, QB.asOfLine(c.inputs.as_at), titles, x.lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.kind === 'total' ? QB.totalFor(l.label) : l.label, values: (l.values || []).slice(0, x.titles.length - 1).concat(x.extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), QB.footerStamp(c.inputs.basis, c.fetchedAt), x.titles.slice(1).map(function () { return 'money'; }).concat(x.extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});
```

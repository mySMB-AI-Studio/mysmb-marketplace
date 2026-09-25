---
name: quickbooks-profit-and-loss
description: QuickBooks Online Profit and Loss family (Q17) as a live, validated report in QuickBooks styling. Use when the user asks for a profit and loss, P&L, income statement, profit report, P&L by month / quarter / customer / class / location, P&L comparison, P&L as % of income or year-to-date comparison.
---

# Profit and Loss family (Q17)

Use when the user asks for a profit and loss, P&L, income statement, profit report, P&L by month / quarter / customer / class / location, P&L comparison, P&L as % of income or year-to-date comparison. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Business overview › Profit and Loss. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q17. Delivery: Wave 1.

## Discovery call

`get_report_profit_and_loss` with `start_date`, `end_date`, `accounting_method` — expect `Rows.Row[]` sections with `group` Income, COGS, GrossProfit, Expenses, NetOperatingIncome, OtherIncome, OtherExpenses, NetIncome.

## Date defaults

Preset `this_fy_td`: `start_date` = first day of the financial year (CompanyInfo `FiscalYearStartMonth`), `end_date` = `"today"` (config: today's date). `compare_start` / `compare_end` = the same two dates one year earlier. For a user-named period, set `p` in `display` to the matching preset key (or `custom`) and the dates to that period.

## Members

| Member / view | How |
|---|---|
| Profit and Loss | Display columns by = Total only |
| P&L by Month / Quarterly P&L Summary | Display columns by = Months / Quarters |
| P&L by Customer | Display columns by = Customers (also Suppliers, Classes, Locations, Products/Services) |
| P&L Comparison | Compare to = Previous period / Previous year |
| P&L year-to-date comparison | Compare to = Year-to-date |
| P&L as % of total income | Report = P&L as % of total income |
| P&L Detail | Not in this skill — transaction detail (ProfitAndLossDetail) is a Wave 2 member |
| P&L by Tag Group | N/A — tags are not exposed by the Accounting API |

## Validation checks (STEP 4 — shown in the banner)

- Total for Income = Σ income accounts
- Gross Profit = Income − Cost of Sales
- Net Earnings = Gross Profit + Other Income − Expenses − Other Expenses
- QuickBooks returned the requested period (Header StartPeriod / EndPeriod)
- Comparison deltas recomputed from the comparison period (when Compare to is on)

## Save as

`fileName`: `quickbooks-profit-and-loss.html` · `tags`: ["quickbooks","profit-and-loss","finance"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): August 2026 (accrual): SaaS – Consulting Services A$7,000.00 · SaaS – Subscription Licence A$57,833.33 · Total for Income A$64,833.33 · Gross Profit A$78,608.34 · Total for Expenses A$261,712.88 · Net Earnings −A$175,286.75. Note: Gross Profit above Income means Cost of Sales is a net credit (−A$13,775.01) — the report flags this in Sources & limitations.
3. Compare the layout with the Q17 screenshots (row order, "Total for" rows, header block, footer, number format).
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
        "Days",
        "Week",
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
      "name": "compare_start",
      "label": "Compare from",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "compare_end",
      "label": "Compare to",
      "type": "date",
      "default": "2026-06-30"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"pl\"}"
    }
  ],
  "bindings": [
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
        },
        "summarize_column_by": {
          "kind": "input",
          "input": "columns_by"
        }
      }
    },
    {
      "id": "pnl_compare",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "compare_start"
        },
        "end_date": {
          "kind": "input",
          "input": "compare_end"
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
  title: 'Profit and Loss', token: 'PANDL', route: 'report/builder', primary: 'pnl', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', columnsBy: 'columns_by', cmpStart: 'compare_start', cmpEnd: 'compare_end', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', columns_by: 'Total', compare_start: '2025-07-01', compare_end: '2026-06-30', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"pl"}' },
  uses: { pnl: ['start_date', 'end_date', 'basis', 'columns_by'], pnl_compare: ['compare_start', 'compare_end', 'basis'], company_info: [], prefs: [] },
  tools: { pnl: 'get_report_profit_and_loss', pnl_compare: 'get_report_profit_and_loss (comparison period)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Days', 'Days'], ['Week', 'Weeks'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years'], ['Customers', 'Customers'], ['Vendors', 'Suppliers'], ['Classes', 'Classes'], ['Departments', 'Locations'], ['ProductsAndServices', 'Products/Services']],
  compare: true,
  views: [['pl', 'Profit and Loss'], ['pct', 'P&L as % of total income']],
  render: function (c) {
    var body = c.body, rep = c.data.pnl;
    if (c.errors.pnl) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this period', pass: null, detail: 'No transactions in the selected period' }] }; }
    var cols = QB.cols(rep), multi = cols.length > 2, cmpOn = c.compareMode !== 'none' && !multi;
    var m = QB.mergeCompare(rep, cmpOn ? c.data.pnl_compare : null), lines = m.lines;
    lines.forEach(function (l) { if (l.group === 'NetIncome' && /^net income$/i.test(l.label)) l.label = 'Net Earnings'; });
    var T = function (g, re) { return QB.val(QB.find(lines, g, re)); };
    var inc = T('Income', /^total (for )?income$/i), cogs = T('COGS', /^total (for )?cost of (sales|goods sold)$/i) || 0, gp = T('GrossProfit', /^gross profit$/i),
      exp = T('Expenses', /^total (for )?expenses$/i), oi = T('OtherIncome', /^total (for )?other income$/i) || 0, oe = T('OtherExpenses', /^total (for )?other expenses$/i) || 0, ni = T('NetIncome', /^net (income|earnings)$/i);
    var incHdr = QB.find(lines, 'Income', null, 'header'), incRows = lines.filter(function (l) { return l.kind === 'row' && incHdr && l.path[0] === incHdr.label; });
    var extra = [];
    if (cmpOn) extra = QB.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year-to-date' }[c.compareMode]);
    if (c.view === 'pct') extra.push({ title: '% of Income', fmt: 'pct', value: function (l) { return inc ? QB.val(l) / inc : null; } });
    var titles = [''].concat(cols.slice(1).map(function (x) { return x.title || 'Total'; }));
    var niCmp = cmpOn ? (QB.find(lines, 'NetIncome', /^net (income|earnings)$/i) || {}).cmp : null;
    var html = QB.kpis([{ label: 'Total for Income', value: inc }, { label: 'Gross Profit', value: gp }, { label: 'Total for Expenses', value: exp },
      { label: 'Net Earnings', value: ni, delta: cmpOn && niCmp ? (ni - niCmp) / Math.abs(niCmp) : null }, { label: 'Net margin', text: inc ? QB.pct(ni / inc) : 'N/A — not in source' }], c);
    html += '<div class="qb-scroll">' + QB.statement(lines, titles, c, extra) + '</div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3>Income vs expenses</h3><div id="ch1"></div></div><div class="qb-card"><h3>Net profit</h3><div id="ch2"></div></div></div>';
    body.innerHTML = html;
    if (multi) {
      var mc = cols.slice(1, cols.length - (/total/i.test(cols[cols.length - 1].title) ? 1 : 0)), idx = mc.map(function (x) { return x.i - 1; });
      var ser = function (g, re) { var l = QB.find(lines, g, re); return idx.map(function (i) { return l ? l.values[i] : null; }); };
      QB.bars(document.getElementById('ch1'), { title: 'Income vs expenses', labels: mc.map(function (x) { return x.title; }), series: [{ name: 'Income', values: ser('Income', /^total (for )?income$/i) }, { name: 'Expenses', values: ser('Expenses', /^total (for )?expenses$/i) }] }, c);
      QB.line(document.getElementById('ch2'), { title: 'Net profit', labels: mc.map(function (x) { return x.title; }), series: [{ name: 'Net Earnings', values: ser('NetIncome', /^net (income|earnings)$/i) }], area: true }, c);
    } else {
      QB.bars(document.getElementById('ch1'), { title: 'Income vs expenses', labels: ['Income', 'Cost of Sales', 'Expenses', 'Net Earnings'], series: [{ name: 'This period', values: [inc, cogs, exp, ni] }].concat(cmpOn ? [{ name: 'Comparison', values: [(QB.find(lines, 'Income') || {}).cmp, (QB.find(lines, 'COGS') || {}).cmp || 0, (QB.find(lines, 'Expenses') || {}).cmp, niCmp] }] : []) }, c);
      QB.waterfall(document.getElementById('ch2'), { title: 'Income to net earnings', steps: [{ label: 'Income', value: inc, total: true }, { label: 'Cost of Sales', value: -cogs }, { label: 'Other income', value: oi }, { label: 'Expenses', value: -exp }, { label: 'Other exp.', value: -oe }, { label: 'Net Earnings', value: ni, total: true }] }, c);
    }
    var hd = QB.header(rep), checks = [
      { name: 'Total for Income = Σ income accounts', pass: inc == null ? null : QB.near(inc, QB.sum(incRows.map(function (l) { return QB.val(l); }))), detail: QB.money(inc, c.currency, c.display) },
      { name: 'Gross Profit = Income − Cost of Sales', pass: gp == null || inc == null ? null : QB.near(gp, inc - cogs), detail: QB.money(gp, c.currency, c.display) },
      { name: 'Net Earnings = Gross Profit + Other Income − Expenses − Other Expenses', pass: ni == null || gp == null || exp == null ? null : QB.near(ni, gp + oi - exp - oe), detail: QB.money(ni, c.currency, c.display) },
      { name: 'QuickBooks returned the requested period', pass: !c.live ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }
    ];
    if (cmpOn) { var ch = QB.header(c.data.pnl_compare); checks.push({ name: 'Comparison deltas recomputed from the comparison period', pass: c.errors.pnl_compare ? false : !c.live ? null : ch.StartPeriod === c.inputs.compare_start && ch.EndPeriod === c.inputs.compare_end, detail: c.errors.pnl_compare ? c.err('pnl_compare') : (ch.StartPeriod || '?') + ' to ' + (ch.EndPeriod || '?') }); }
    var notes = [], na = ['P&L by Tag Group (tags are not exposed by the Accounting API)'];
    if (cogs < 0) notes.push('Total for Cost of Sales is negative (a net credit), so Gross Profit is higher than Income — review the Cost of Sales postings.');
    if (m.onlyInCompare.length) notes.push(m.onlyInCompare.length + ' account(s) had activity only in the comparison period: ' + m.onlyInCompare.join(', '));
    this._lines = lines; this._titles = titles; this._extra = extra;
    return { checks: checks, notes: notes, na: na, title: c.view === 'pct' ? 'Profit and Loss as % of total income' : cmpOn ? 'Profit and Loss Comparison' : 'Profit and Loss' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = (this._titles || ['']).concat(extra.map(function (e) { return e.title; }));
    var per = QB.periodLine(c.inputs.start_date, c.inputs.end_date);
    var sh = QB.sheetFromLines('Profit and Loss', c.company, per, titles, lines.map(function (l) {
      var vals = (l.values || []).slice(0, titles.length - 1 - extra.length).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); }));
      return { kind: l.kind, depth: l.depth, label: l.kind === 'total' ? QB.totalFor(l.label) : l.label, values: vals };
    }), QB.footerStamp(c.inputs.basis, c.fetchedAt), (this._titles || ['']).slice(1).map(function () { return 'money'; }).concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })));
    return [sh];
  }
});
```

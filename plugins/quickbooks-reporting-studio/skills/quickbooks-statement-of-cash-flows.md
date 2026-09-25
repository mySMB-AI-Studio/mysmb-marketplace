---
name: quickbooks-statement-of-cash-flows
description: QuickBooks Online Statement of Cash Flows (Q19) as a live, validated report in QuickBooks styling. Use when the user asks for a statement of cash flows, cash flow statement, where the cash went, operating / investing / financing cash flow, or a cash waterfall.
---

# Statement of Cash Flows (Q19)

Use when the user asks for a statement of cash flows, cash flow statement, where the cash went, operating / investing / financing cash flow, or a cash waterfall. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_cash_flow`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Business overview › Statement of Cash Flows. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q19. Delivery: Wave 1.

## Discovery call

`get_report_cash_flow` with `start_date`, `end_date` — expect `group` OperatingActivities (with a Net Income row and an OperatingAdjustments section), InvestingActivities, FinancingActivities, CashIncrease, BeginningCash, EndingCash.

## Date defaults

Preset `this_fy_td`: `start_date` = FY start, `end_date` = `"today"`; compare dates = one year earlier.

## Members

| Member / view | How |
|---|---|
| Statement of Cash Flows | Default; Display columns by Months / Quarters / Years; Compare to |
| Accounting method | Not offered — QuickBooks presents this report on its own method; the footer shows the basis QuickBooks returned |

## Validation checks (STEP 4 — shown in the banner)

- Cash at end = Cash at beginning + Net cash increase
- Net cash increase = Operating + Investing + Financing
- Operating = Net Earnings + Σ adjustments
- Each 'Total for' = Σ its rows
- QuickBooks returned the requested period

## Save as

`fileName`: `quickbooks-statement-of-cash-flows.html` · `tags`: ["quickbooks","cash-flow","finance"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): August 2026: Net Earnings −A$175,286.75 with working-capital adjustments (Accounts Receivable, Prepaid expenses, Security Deposit, Accounts Payable, Doug's Amex Card, GST Liabilities Payable).
3. Compare the layout with the Q19 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "columns_by",
      "label": "Display columns by",
      "type": "enum",
      "options": [
        "Total",
        "Month",
        "Quarter",
        "Year"
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
      "default": "Executive"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "cash_flow",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_cash_flow"
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
        "summarize_column_by": {
          "kind": "input",
          "input": "columns_by"
        }
      }
    },
    {
      "id": "cash_flow_compare",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_cash_flow"
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
  title: 'Statement of Cash Flows', token: 'CASH_FLOW', route: 'reportv2', primary: 'cash_flow', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', columnsBy: 'columns_by', cmpStart: 'compare_start', cmpEnd: 'compare_end', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', columns_by: 'Total', compare_start: '2025-07-01', compare_end: '2026-06-30', persona: 'Executive',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { cash_flow: ['start_date', 'end_date', 'columns_by'], cash_flow_compare: ['compare_start', 'compare_end'], company_info: [], prefs: [] },
  tools: { cash_flow: 'get_report_cash_flow', cash_flow_compare: 'get_report_cash_flow (comparison period)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years']],
  compare: true,
  render: function (c) {
    var body = c.body, rep = c.data.cash_flow;
    if (c.errors.cash_flow) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('cash_flow')) + '</p>'; return { checks: [{ name: 'Statement of Cash Flows loaded', pass: false, detail: c.err('cash_flow') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this period', pass: null }] }; }
    var cols = QB.cols(rep), multi = cols.length > 2, cmpOn = c.compareMode !== 'none' && !multi;
    var m = QB.mergeCompare(rep, cmpOn ? c.data.cash_flow_compare : null), lines = m.lines;
    var T = function (g, re) { return QB.val(QB.find(lines, g, re)); };
    var op = T('OperatingActivities', /^net cash provided by operating activities$/i), inv = T('InvestingActivities', /^net cash provided by investing activities$/i) || 0, fin = T('FinancingActivities', /^net cash provided by financing activities$/i) || 0;
    var inc = T('CashIncrease', /^net cash (increase|decrease) for period$/i), beg = T('BeginningCash', /^cash at beginning of period$/i), end = T('EndingCash', /^cash at end of period$/i);
    var ni = QB.val(QB.find(lines, null, /^net (income|earnings)$/i, 'row')), adj = T('OperatingAdjustments', /^total adjustments/i) || 0;
    lines.forEach(function (l) { if (l.kind === 'row' && /^net income$/i.test(l.label)) l.label = 'Net Earnings'; });
    var extra = cmpOn ? QB.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year-to-date' }[c.compareMode]) : [];
    var titles = [''].concat(cols.slice(1).map(function (x) { return x.title || 'Total'; }));
    body.innerHTML = QB.kpis([{ label: 'Operating activities', value: op }, { label: 'Investing activities', value: inv }, { label: 'Financing activities', value: fin }, { label: 'Net cash increase', value: inc }, { label: 'Cash at end of period', value: end }], c) +
      '<div class="qb-scroll">' + QB.statement(lines, titles, c, extra) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>Opening cash to closing cash</h3><div id="ch1"></div></div>';
    QB.waterfall(document.getElementById('ch1'), { title: 'Cash waterfall', steps: [{ label: 'Opening cash', value: beg, total: true }, { label: 'Operating', value: op }, { label: 'Investing', value: inv }, { label: 'Financing', value: fin }, { label: 'Closing cash', value: end, total: true }] }, c);
    var ties = QB.sectionTies(rep), hd = QB.header(rep);
    var checks = [
      { name: 'Cash at end = Cash at beginning + Net cash increase', pass: end == null || beg == null || inc == null ? null : QB.near(end, beg + inc), detail: QB.money(end, c.currency, c.display) },
      { name: 'Net cash increase = Operating + Investing + Financing', pass: inc == null || op == null ? null : QB.near(inc, op + inv + fin), detail: QB.money(inc, c.currency, c.display) },
      { name: 'Operating = Net Earnings + Σ adjustments', pass: op == null || ni == null ? null : QB.near(op, ni + adj), detail: QB.money(ni, c.currency, c.display) + ' + ' + QB.money(adj, c.currency, c.display) },
      { name: "Each 'Total for' = Σ its rows", pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'QuickBooks returned the requested period', pass: !c.live ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') }
    ];
    if (cmpOn) checks.push({ name: 'Comparison deltas recomputed from the comparison period', pass: c.errors.cash_flow_compare ? false : !c.live ? null : QB.header(c.data.cash_flow_compare).StartPeriod === c.inputs.compare_start, detail: c.errors.cash_flow_compare ? c.err('cash_flow_compare') : c.inputs.compare_start + ' to ' + c.inputs.compare_end });
    this._x = { lines: lines, titles: titles, extra: extra };
    return { checks: checks, notes: ['Cash flows are presented by QuickBooks on its own method; no accounting-method control is offered because the report does not take one.'], title: cmpOn ? 'Statement of Cash Flows Comparison' : 'Statement of Cash Flows' };
  },
  excel: function (c) {
    var x = this._x || { lines: [], titles: [''], extra: [] }, titles = x.titles.concat(x.extra.map(function (e) { return e.title; }));
    return [QB.sheetFromLines('Statement of Cash Flows', c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), titles, x.lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.kind === 'total' ? QB.totalFor(l.label) : l.label, values: (l.values || []).slice(0, x.titles.length - 1).concat(x.extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), QB.footerStamp(QB.header(c.data.cash_flow).ReportBasis || 'Accrual', c.fetchedAt), x.titles.slice(1).map(function () { return 'money'; }).concat(x.extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});
```

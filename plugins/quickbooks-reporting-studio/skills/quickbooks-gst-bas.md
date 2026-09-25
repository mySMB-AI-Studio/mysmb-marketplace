---
name: quickbooks-gst-bas
description: QuickBooks Online GST and PAYG family (BAS) (Q28) as a live, validated report in QuickBooks styling. Use when the user asks for GST, a GST summary, BAS, BAS labels (G1, 1A, 1B, 9), GST payable or refund, the activity statement, or PAYG withholding.
---

# GST and PAYG family (BAS) (Q28)

Use when the user asks for GST, a GST summary, BAS, BAS labels (G1, 1A, 1B, 9), GST payable or refund, the activity statement, or PAYG withholding. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_tax_summary`, `get_report_balance_sheet`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Manage Taxes › GST Summary. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q28. Delivery: Wave 1.

## Discovery call

`get_report_tax_summary` with `start_date`, `end_date`, `accounting_method` — for an AU company expect rows labelled Net amount for G1 · Tax amount for G1 · GST-Free sales · G1 TOTAL SALES · 1A GST ON SALES · 1B GST ON PURCHASES · 8A · 8B · 9 REFUND OR PAYMENT DUE. KNOWN ISSUE: it has returned NoReportData on a live company — the report then says so and shows no figures.

## Date defaults

Preset `this_quarter` (current BAS quarter) or `last_quarter` when the user is preparing the BAS just lodged; dates = that quarter.

## Members

| Member / view | How |
|---|---|
| GST Summary | Report = GST Summary |
| PAYG Withholding Summary / Details / Amendment | Report = PAYG Withholding Summary shows an explicit N/A — payroll lives in Employment Hero |
| GST Details, GST Liability, GST Amendment, TPAR, Transactions without GST, Transaction Detail by Tax Code | Wave 2 members |

## Validation checks (STEP 4 — shown in the banner)

- 1A − 1B = 9
- G1 = net amount + tax amount + GST-free sales
- GST Liabilities on the balance sheet at period end (information)
- QuickBooks returned the requested period

## Save as

`fileName`: `quickbooks-gst-summary.html` · `tags`: ["quickbooks","gst","bas","tax"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Jul–Sep 2026: G1 A$140,305.00 · 1A A$12,755.00 · 1B A$19,687.77 · 9 Refund or payment due A$−6,932.77.
3. Compare the layout with the Q28 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "2026-09-30"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_quarter\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"summary\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "gst_summary",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_tax_summary"
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
      "id": "bs_end",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
      },
      "params": {
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
  title: 'GST Summary Report', token: 'GTM_SUM', route: 'reportv2', primary: 'gst_summary', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', basis: 'Accrual', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"summary","x":""}' },
  uses: { gst_summary: ['start_date', 'end_date', 'basis'], bs_end: ['end_date', 'basis'], company_info: [], prefs: [] },
  tools: { gst_summary: 'get_report_tax_summary (GST Summary)', bs_end: 'get_report_balance_sheet (GST Liabilities at period end)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['summary', 'GST Summary'], ['payg', 'PAYG Withholding Summary']],
  render: function (c) {
    var body = c.body, rep = c.data.gst_summary, money = function (v) { return QB.money(v, c.currency, c.display); };
    if (c.view === 'payg') {
      body.innerHTML = '<div class="qb-banner fail"><strong>PAYG withholding is not available from the connected QuickBooks tools.</strong> Payroll runs in Employment Hero (outside the QuickBooks Accounting API). Export QuickBooks › Reports › Manage Taxes › PAYG Withholding Summary to Excel and attach it to have it reproduced.</div>';
      return { checks: [{ name: 'PAYG Withholding data available', pass: null, detail: 'N/A — not in source (Employment Hero payroll)' }], na: ['PAYG Withholding Summary / Details / Amendment (payroll data lives in Employment Hero)'], title: 'PAYG Withholding Summary' };
    }
    if (c.errors.gst_summary) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('gst_summary')) + '</p>'; return { checks: [{ name: 'GST Summary loaded', pass: false, detail: c.err('gst_summary') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) {
      body.innerHTML = '<div class="qb-banner fail"><strong>QuickBooks returned no GST rows for this period.</strong> GST figures are unavailable — not zero. (Known connector behaviour: the Tax Summary report has returned no rows on a live company even with GST codes configured.) Use QuickBooks › Reports › GST Summary › Export to Excel as the fallback.</div>';
      return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null, detail: 'NoReportData' }], na: ['All BAS labels for this period (Tax Summary returned no rows)'] };
    }
    var b = QB.bas(rep), refund = b.nine != null && b.nine < 0;
    var bsl = c.data.bs_end ? QB.walk(c.data.bs_end) : [], gstLiab = QB.val(QB.find(bsl, null, /gst (liabilities|payable)/i, 'row'));
    body.innerHTML = QB.kpis([{ label: 'G1 Total sales', value: b.g1 }, { label: '1A GST on sales', value: b.a1 }, { label: '1B GST on purchases', value: b.b1 },
      { label: refund ? '9 Refund due from the ATO' : '9 Payment due to the ATO', value: b.nine == null ? null : Math.abs(b.nine) }], c) +
      (b.found ? '' : '<p class="qb-err">The Tax Summary rows do not carry BAS labels (G1, 1A, 1B, 9); they are shown as returned — verify on first run.</p>') +
      '<div class="qb-scroll">' + QB.statement(b.lines, ['', 'TOTAL'], c) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>GST collected vs paid</h3><div id="ch1"></div></div>';
    QB.bars(document.getElementById('ch1'), { title: 'GST collected vs paid', labels: ['1A GST on sales', '1B GST on purchases', '9 Net'], series: [{ name: 'This period', values: [b.a1, b.b1, b.nine] }] }, c);
    var hd = QB.header(rep), checks = [
      { name: '1A − 1B = 9', pass: b.a1 == null || b.b1 == null || b.nine == null ? null : QB.near(b.a1 - b.b1, b.nine), detail: money(b.a1) + ' − ' + money(b.b1) + ' = ' + money(b.nine) },
      { name: 'G1 = net amount + tax amount + GST-free sales', pass: b.g1 == null || b.net == null || b.tax == null ? null : QB.near(b.g1, b.net + b.tax + (b.free || 0)), detail: money(b.g1) },
      { name: 'GST Liabilities on the balance sheet at period end (information)', pass: null, detail: gstLiab == null ? (c.errors.bs_end ? c.err('bs_end') : 'N/A — not in source') : money(gstLiab) + ' — includes unpaid prior periods, so it need not equal label 9' },
      { name: 'QuickBooks returned the requested period', pass: !c.live ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }];
    this._x = b;
    return { checks: checks, notes: ['GST Agency: Australian Tax Office. Decision support for BAS preparation — not lodgement advice.'],
      na: ['PAYG withholding labels W1/W2/4 (payroll data lives in Employment Hero)', 'GST Details, GST Liability, GST Amendment, TPAR, Transactions without GST and Transaction Detail by Tax Code (Wave 2 members)'] };
  },
  excel: function (c) {
    var b = this._x; if (!b) return [];
    return [QB.sheetFromLines('GST Summary Report', c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), ['', 'TOTAL'], b.lines, QB.footerStamp(c.inputs.basis, c.fetchedAt).replace('Accrual basis', 'Accruals basis'))];
  }
});
```

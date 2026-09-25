---
name: quickbooks-gst-overview
description: QuickBooks Online GST overview (BAS centre) (Q15) as a live, validated report in QuickBooks styling. Use when the user asks for the GST overview, GST position, BAS centre, how much GST we owe or get back this quarter, or GST collected vs paid.
---

# GST overview (BAS centre) (Q15)

Use when the user asks for the GST overview, GST position, BAS centre, how much GST we owe or get back this quarter, or GST collected vs paid. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_tax_summary`, `get_report_balance_sheet`, `qbo_query`, `get_preferences`).

QuickBooks location: All apps › GST › Overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q15. Delivery: Wave 1.

## Discovery call

`get_report_tax_summary` for the current and previous period (same shape as the GST Summary).

## Date defaults

Preset `this_quarter`; compare = previous quarter (`c` = `prev_period`).

## Members

| Member / view | How |
|---|---|
| GST overview tiles (refund/payable, collected, paid) | Built |
| History | This and the previous period |
| To do / Payments tabs, Export workpapers, Prepare BAS or IAS | N/A — BAS centre actions are not in the Accounting API |

## Validation checks (STEP 4 — shown in the banner)

- Refund / payable = GST collected − GST paid
- Ties to GST Summary 1A / 1B (same source)
- Previous period loaded

## Save as

`fileName`: `quickbooks-gst-overview.html` · `tags`: ["quickbooks","gst","bas","dashboard"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Jul–Sep 2026: GST refund $6,932 (collected $12,755, paid $19,687).
3. Compare the layout with the Q15 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "compare_start",
      "label": "Previous period from",
      "type": "date",
      "default": "2026-04-01"
    },
    {
      "name": "compare_end",
      "label": "Previous period to",
      "type": "date",
      "default": "2026-06-30"
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_quarter\",\"a\":\"custom\",\"c\":\"prev_period\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "gst_current",
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
      "id": "gst_previous",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_tax_summary"
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
  title: 'GST overview', token: null, primary: 'gst_current', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', cmpStart: 'compare_start', cmpEnd: 'compare_end', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', compare_start: '2026-04-01', compare_end: '2026-06-30', basis: 'Accrual', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_quarter","a":"custom","c":"prev_period","v":"","x":""}' },
  uses: { gst_current: ['start_date', 'end_date', 'basis'], gst_previous: ['compare_start', 'compare_end', 'basis'], bs_end: ['end_date', 'basis'], company_info: [], prefs: [] },
  tools: { gst_current: 'get_report_tax_summary (this period)', gst_previous: 'get_report_tax_summary (previous period)', bs_end: 'get_report_balance_sheet (GST Liabilities)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  compare: true,
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); };
    if (c.errors.gst_current) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('gst_current')) + '</p>'; return { checks: [{ name: 'GST position loaded', pass: false, detail: c.err('gst_current') }] }; }
    if (!c.data.gst_current) return {};
    var cur = QB.noData(c.data.gst_current) ? null : QB.bas(c.data.gst_current), prev = c.data.gst_previous && !QB.noData(c.data.gst_previous) ? QB.bas(c.data.gst_previous) : null;
    if (!cur) { body.innerHTML = '<div class="qb-banner fail"><strong>QuickBooks returned no GST rows for this period.</strong> The GST position is unavailable — not zero.</div>'; return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null }] }; }
    var net = function (b) { return b && b.a1 != null && b.b1 != null ? Math.round((b.a1 - b.b1) * 100) / 100 : null; }, n = net(cur), refund = n != null && n < 0;
    var bsl = c.data.bs_end ? QB.walk(c.data.bs_end) : [], liab = QB.val(QB.find(bsl, null, /gst (liabilities|payable)/i, 'row'));
    body.innerHTML = QB.kpis([{ label: refund ? 'GST refund' : 'GST payable', value: n == null ? null : Math.abs(n), sub: QB.periodLine(c.inputs.start_date, c.inputs.end_date) },
      { label: 'GST collected', value: cur.a1 }, { label: 'GST paid', value: cur.b1 }, { label: 'GST liabilities (balance sheet)', value: liab }], c) +
      '<div class="qb-grid2"><div class="qb-card"><h3>Collected vs paid</h3><div id="ch1"></div></div><div class="qb-card"><h3>History</h3><div id="hist"></div></div></div>' +
      '<div class="qb-card detail-block"><h3>Run reports</h3><p>GST Summary (this period) — open the GST Summary report for the full BAS label layout. GST Details, GST Liability and PAYG run from QuickBooks (see Sources &amp; limitations).</p></div>';
    QB.bars(document.getElementById('ch1'), { title: 'GST collected vs paid', labels: ['This period', 'Previous period'], series: [{ name: 'Collected (1A)', values: [cur.a1, prev && prev.a1] }, { name: 'Paid (1B)', values: [cur.b1, prev && prev.b1] }] }, c);
    QB.grid(document.getElementById('hist'), { columns: [{ key: 'p', title: 'Period' }, { key: 'a', title: 'Collected', money: true }, { key: 'b', title: 'Paid', money: true }, { key: 'n', title: 'Net (1A − 1B)', money: true }],
      rows: [{ p: QB.periodLine(c.inputs.start_date, c.inputs.end_date), a: cur.a1, b: cur.b1, n: n }].concat(prev ? [{ p: QB.periodLine(c.inputs.compare_start, c.inputs.compare_end), a: prev.a1, b: prev.b1, n: net(prev) }] : []) }, c);
    var checks = [
      { name: 'Refund / payable = GST collected − GST paid', pass: n == null ? null : (cur.nine == null ? true : QB.near(n, cur.nine)), detail: money(cur.a1) + ' − ' + money(cur.b1) + ' = ' + money(n) },
      { name: 'Ties to GST Summary 1A / 1B (same Tax Summary source)', pass: cur.found ? true : null, detail: cur.found ? '1A ' + money(cur.a1) + ', 1B ' + money(cur.b1) : 'BAS labels not present — verify on first run' },
      { name: 'Previous period loaded', pass: c.errors.gst_previous ? false : prev ? true : null, detail: c.errors.gst_previous ? c.err('gst_previous') : QB.periodLine(c.inputs.compare_start, c.inputs.compare_end) }];
    this._x = { cur: cur, prev: prev, n: n };
    return { checks: checks, period: QB.periodLine(c.inputs.start_date, c.inputs.end_date),
      na: ['To do / Payments tabs, Export workpapers and "Prepare BAS or IAS for lodgment" (BAS centre actions are not exposed by the Accounting API)', 'Monthly collected-vs-paid split (Tax Summary does not summarise by month)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'GST overview', widths: [36, 18, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'GST overview', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [],
      [{ v: 'Period', s: 'bold' }, { v: 'GST collected (1A)', s: 'bold' }, { v: 'GST paid (1B)', s: 'bold' }, { v: 'Net', s: 'bold' }],
      [QB.periodLine(c.inputs.start_date, c.inputs.end_date), { v: x.cur.a1, s: 'money' }, { v: x.cur.b1, s: 'money' }, { f: 'B6-C6', v: x.n, s: 'moneyBold' }]].concat(x.prev ? [[QB.periodLine(c.inputs.compare_start, c.inputs.compare_end), { v: x.prev.a1, s: 'money' }, { v: x.prev.b1, s: 'money' }, { f: 'B7-C7', s: 'moneyBold' }]] : []) }];
  }
});
```

---
name: xero-business-health-scorecard
description: Build a live, validated Xero business health scorecard (kit report) that scores profitability, liquidity and working-capital KPIs, computed from real Profit and Loss, Balance Sheet and Executive Summary data, against editable targets. Use for "business health", "health check", "scorecard", "KPI targets", "how healthy is the business".
---
# Business Health Scorecard

Xero's own Business Health Scorecard has no endpoint on the `xero-accounting` connector — this report is **not** that score and must never claim to match it. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below. This is a kit report: it computes its own score from real `get_balance_sheet`, `get_profit_and_loss` and `get_executive_summary` data. It deliberately avoids `list_invoices` (no genuine aged-receivables/aged-payables drill-down here — see the Aged Receivables / Aged Payables skills for that) so every binding is a single-call Xero Report, which is what makes this safe to build on `XK.app` rather than a hand-authored bootstrap (see the reasoning in `xero-activity-statement`, which faces the opposite problem).

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_balance_sheet` once with `date` = today, `get_profit_and_loss` once with `fromDate` = the financial-year start and `toDate` = today, and `get_executive_summary` once with `date` = today. An error on `get_executive_summary` specifically is not fatal to the whole report — the scorecard still renders from Balance Sheet and Profit and Loss alone, with debtor/creditor days shown N/A. **`get_executive_summary`'s row labels are not confirmed live** — match them defensively (`/debtor days/i`, `/creditor days/i`, `/gross profit margin/i`, `/net profit margin/i`) and fall back to N/A rather than assuming a position; say so in Sources & limitations.

## Date defaults

`as_at` = the date asked for (default `"today"`). `fy_start` is derived by the kit from `as_at` and the organisation's financial year (leave its default). `compare_from` / `compare_to` are derived as the same-length period one year earlier (for revenue growth) — leave their defaults.

## Members

| Member / view | How |
|---|---|
| Business Health Scorecard | Default view — KPI cards + scorecard table |
| Edit a target | Type into the Target column (session-only — not saved across a reload; see Sources & limitations) |
| Another organisation | Organisation picker |
| Xero's own Business Health Scorecard | N/A in this version — no endpoint returns it; this report computes its own score instead, and says so in the header |
| Industry benchmarks | N/A in this version — no benchmark data source on this connector |

## Validation checks (shown in the banner)

- Gross margin = Gross Profit ÷ Trading Income (recomputed from Profit and Loss)
- Net margin = Net Profit ÷ Trading Income (recomputed from Profit and Loss)
- Current ratio = (Bank + Current Assets) ÷ Current Liabilities (recomputed from Balance Sheet)
- **Independent tie:** Gross margin and Net margin recomputed from Profit and Loss vs the same ratios reported on Xero's own Executive Summary (a separate Xero report) — shown as information when Executive Summary failed or didn't return a matching row
- Score = achieved targets ÷ applicable targets (a target is inapplicable, not failed, when its ratio's denominator is zero or negative, or the source figure is missing)
- Every ratio shown with N/A when its denominator is zero, negative or missing — never a fabricated status

## Save as

`fileName`: `xero-business-health-scorecard.html` · `tags`: ["xero","business-health-scorecard","kpi","scorecard"]

## QA test script (procedure only — no live access to run this)

1. On a QA organisation, ask for this report at the default date (today); confirm the discovery calls succeed and the report saves.
2. Confirm the header and Sources & limitations both say plainly that this is not Xero's own Business Health Scorecard.
3. Cross-check Gross margin and Net margin against Xero → Reporting → Executive Summary for the same organisation and date; confirm the independent-tie check reflects the actual agreement (or disagreement) rather than always showing Pass.
4. Cross-check Current ratio, Debtor days and Creditor days against Xero → Reporting → Balance Sheet / Executive Summary directly.
5. Force a denominator-zero case (an organisation or period with $0 trading income, or $0 current liabilities) and confirm the affected ratio and score both show N/A — never 0%, never a fabricated Pass or Fail.
6. Edit a target in the Target column and confirm the Status column and the overall score recompute immediately, client-side, with no refetch.
7. Reload the page and confirm targets reset to their defaults with a visible note explaining why (session-only, not yet a saved preference).
8. Switch organisation (LIB-002): confirm every figure, the header and the exports carry only that organisation's data.
9. Download PDF and Download Excel; confirm the Excel file has the scorecard table plus Validation and Parameters sheets.
10. Toggle Branding and the dark theme; switch View as to Client, then Bookkeeper.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "as_at",
      "label": "As at",
      "type": "date",
      "default": "today"
    },
    {
      "name": "fy_start",
      "label": "Financial year start",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "compare_from",
      "label": "Compare from (same-length period, prior year)",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "compare_to",
      "label": "Compare to (same-length period, prior year)",
      "type": "date",
      "default": "2025-09-25"
    },
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "bs",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
        },
        "paymentsOnly": {
          "kind": "static",
          "value": false
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_ytd",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "fy_start"
        },
        "toDate": {
          "kind": "input",
          "input": "as_at"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
        },
        "paymentsOnly": {
          "kind": "static",
          "value": false
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_py",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "compare_from"
        },
        "toDate": {
          "kind": "input",
          "input": "compare_to"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
        },
        "paymentsOnly": {
          "kind": "static",
          "value": false
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "exec_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_executive_summary"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
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
  title: 'Business Health Scorecard', primary: 'bs', dated: ['bs'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', fy_start: '2026-07-01', compare_from: '2025-07-01', compare_to: '2025-09-25', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { bs: ['as_at', 'org'], pnl_ytd: ['fy_start', 'as_at', 'org'], pnl_py: ['compare_from', 'compare_to', 'org'], exec_summary: ['as_at', 'org'], org: ['org'], connections: [] },
  tools: { bs: 'get_balance_sheet', pnl_ytd: 'get_profit_and_loss (financial year to date)', pnl_py: 'get_profit_and_loss (same-length period, prior year)', exec_summary: 'get_executive_summary', org: 'get_organisation', connections: 'list_connections' },
  derive: function (inp, fyMonth) {
    var fyStart = XK.fyStartOf(inp.as_at, fyMonth), cmp = XK.compare(fyStart, inp.as_at, 'prev_year', fyMonth);
    return { fy_start: fyStart, compare_from: cmp.start, compare_to: cmp.end };
  },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
    if (c.errors.bs || c.errors.pnl_ytd) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('bs') || c.err('pnl_ytd')) + '</p>'; return { checks: [{ name: 'Balance Sheet and Profit and Loss loaded', pass: false, detail: c.err('bs') || c.err('pnl_ytd') }] }; }
    if (!c.data.bs || !c.data.pnl_ytd) return {};

    var wb = XK.walk(c.data.bs), wp = XK.walk(c.data.pnl_ytd);
    var wpy = c.data.pnl_py && !c.errors.pnl_py ? XK.walk(c.data.pnl_py) : null;
    var we = c.data.exec_summary && !c.errors.exec_summary ? XK.walk(c.data.exec_summary) : null;

    function sumSections(w, res) {
      var found = false, total = 0;
      w.sections.forEach(function (s) { if (res.test(s.title)) { found = true; total += XK.sectionTotal(s); } });
      return found ? Math.round(total * 100) / 100 : null;
    }
    function ratio(n, d) { return n == null || d == null || d <= 0 ? null : n / d; }
    // Xero's own row wording for Executive Summary is not confirmed live — matched defensively, N/A if not found.
    function execPct(re) {
      if (!we) return null;
      var l = XK.find(we.lines, null, re, 'row') || XK.find(we.lines, null, re, 'total');
      if (!l) return null;
      var raw = (l.values || [])[0];
      if (raw == null) return null;
      var n = Number(String(raw).replace(/[%,]/g, ''));
      return isFinite(n) ? (Math.abs(n) > 1 ? n / 100 : n) : null;
    }
    function execDays(re) {
      if (!we) return null;
      var l = XK.find(we.lines, null, re, 'row') || XK.find(we.lines, null, re, 'total');
      var v = l ? XK.num((l.values || [])[0]) : null;
      return v;
    }

    var income = XK.find(wp.lines, null, /^(trading )?income$|^revenue$|^sales$/i, 'total');
    var incomeV = income ? XK.val(income) : sumSections(wp, /^(trading )?income$|^revenue$|^sales$/i);
    var gp = XK.find(wp.lines, null, /^gross profit$/i, 'total'); var gpV = gp ? XK.val(gp) : null;
    var np = XK.find(wp.lines, null, /^net (profit|loss)$/i, 'total'); var npV = np ? XK.val(np) : null;
    var incomePyLine = wpy ? XK.find(wpy.lines, null, /^(trading )?income$|^revenue$|^sales$/i, 'total') : null;
    var incomePyV = incomePyLine ? XK.val(incomePyLine) : null;

    var bank = sumSections(wb, /^bank$/i), currentAssets = sumSections(wb, /^current assets$/i);
    var caTotal = bank == null && currentAssets == null ? null : (bank || 0) + (currentAssets || 0);
    var currentLiab = sumSections(wb, /^current liabilities$/i);

    var grossMargin = ratio(gpV, incomeV), netMargin = ratio(npV, incomeV), currentRatio = ratio(caTotal, currentLiab);
    var revGrowth = incomeV != null && incomePyV != null && incomePyV !== 0 ? (incomeV - incomePyV) / Math.abs(incomePyV) : null;
    var debtorDays = execDays(/debtor days/i), creditorDays = execDays(/creditor days/i);
    var execGross = execPct(/gross profit margin/i), execNet = execPct(/net profit margin/i);

    var T = this._targets = this._targets || { gross: 0.5, net: 0.1, current: 1.5, debtor: 45, creditor: 30, growth: 0 };
    var rows = [
      { key: 'gross', metric: 'Gross margin', formula: 'Gross Profit ÷ Trading Income', actual: grossMargin, fmt: 'pct', better: 'higher', target: T.gross },
      { key: 'net', metric: 'Net margin', formula: 'Net Profit ÷ Trading Income', actual: netMargin, fmt: 'pct', better: 'higher', target: T.net },
      { key: 'current', metric: 'Current ratio', formula: '(Bank + Current Assets) ÷ Current Liabilities', actual: currentRatio, fmt: 'ratio', better: 'higher', target: T.current },
      { key: 'debtor', metric: 'Debtor days', formula: 'Xero Executive Summary — average days to collect', actual: debtorDays, fmt: 'days', better: 'lower', target: T.debtor },
      { key: 'creditor', metric: 'Creditor days', formula: 'Xero Executive Summary — average days to pay', actual: creditorDays, fmt: 'days', better: 'lower', target: T.creditor },
      { key: 'growth', metric: 'Revenue growth (YoY, FY to date)', formula: '(Income this FYTD − Income same period last year) ÷ |same period last year|', actual: revGrowth, fmt: 'pct', better: 'higher', target: T.growth }
    ];
    var applicable = rows.filter(function (r) { return r.actual != null; });
    applicable.forEach(function (r) { r.status = r.better === 'higher' ? (r.actual >= r.target ? 'On target' : 'Attention') : (r.actual <= r.target ? 'On target' : 'Attention'); });
    var achieved = applicable.filter(function (r) { return r.status === 'On target'; }).length;
    var score = applicable.length ? achieved / applicable.length : null;

    function fmtVal(v, fmt) { if (v == null) return 'N/A — not in source'; return fmt === 'pct' ? XK.pct(v) : fmt === 'days' ? Math.round(v) + ' days' : v.toFixed(2) + ':1'; }
    var tableRows = rows.map(function (r) {
      return '<tr><td>' + XK.h(r.metric) + '</td><td class="muted">' + XK.h(r.formula) + '</td><td class="num">' + fmtVal(r.actual, r.fmt) + '</td>' +
        '<td class="num"><input type="text" data-k="' + r.key + '" class="xk-filter" style="width:70px;text-align:right" value="' + XK.h(r.fmt === 'pct' ? Math.round(r.target * 100) : r.target) + '"></td>' +
        '<td>' + (r.actual == null ? '<span class="muted">N/A</span>' : r.status === 'On target' ? '<span class="chip up">On target</span>' : '<span class="chip down">Attention</span>') + '</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="xk-banner na" style="margin-bottom:14px"><strong>Not Xero\'s own Business Health Scorecard.</strong> Xero does not expose that proprietary score via this connector. This scorecard is computed independently from this organisation\'s Balance Sheet, Profit and Loss and Executive Summary data, against the editable targets below.</div>' +
      XK.kpis([{ label: 'Score', text: score == null ? 'N/A' : achieved + '/' + applicable.length + ' on target' }, { label: 'Gross margin', text: grossMargin == null ? 'N/A' : XK.pct(grossMargin) },
        { label: 'Net margin', text: netMargin == null ? 'N/A' : XK.pct(netMargin) }, { label: 'Current ratio', text: currentRatio == null ? 'N/A' : currentRatio.toFixed(2) + ':1' },
        { label: 'Debtor days', text: debtorDays == null ? 'N/A' : Math.round(debtorDays) + ' d' }], c) +
      '<div class="xk-scroll"><table class="xk-stmt"><thead><tr><th>Metric</th><th>Formula</th><th class="num">Actual</th><th class="num">Target (edit)</th><th>Status</th></tr></thead><tbody id="xk-scorecard-body">' + tableRows + '</tbody></table></div>';

    document.querySelectorAll('#xk-scorecard-body input[data-k]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = this.getAttribute('data-k'), v = Number(this.value), row = rows.filter(function (r) { return r.key === k; })[0];
        if (!isFinite(v) || !row) return;
        T[k] = row.fmt === 'pct' ? v / 100 : v;
        c.change({}, {}); // no input changed — just re-render from the same hydrated data with the new target
      });
    });

    var checks = [
      { name: 'Gross margin = Gross Profit ÷ Trading Income', pass: grossMargin == null ? null : true, detail: grossMargin == null ? 'Missing Trading Income or Gross Profit line' : money(gpV) + ' ÷ ' + money(incomeV) + ' = ' + XK.pct(grossMargin) },
      { name: 'Net margin = Net Profit ÷ Trading Income', pass: netMargin == null ? null : true, detail: netMargin == null ? 'Missing Trading Income or Net Profit line' : money(npV) + ' ÷ ' + money(incomeV) + ' = ' + XK.pct(netMargin) },
      { name: 'Current ratio = (Bank + Current Assets) ÷ Current Liabilities', pass: currentRatio == null ? null : true, detail: currentRatio == null ? 'Missing Current Liabilities (or it is zero/negative)' : money(caTotal) + ' ÷ ' + money(currentLiab) },
      execGross != null ? { name: 'Independent tie: Gross margin vs Xero Executive Summary', pass: grossMargin == null ? null : XK.near(grossMargin, execGross, 0.01), detail: XK.pct(grossMargin) + ' (computed) vs ' + XK.pct(execGross) + ' (Executive Summary)' }
        : { name: 'Independent tie: Gross margin vs Xero Executive Summary (information)', pass: null, info: true, detail: c.errors.exec_summary ? c.err('exec_summary') : 'Executive Summary did not return a matching Gross Profit Margin row' },
      execNet != null ? { name: 'Independent tie: Net margin vs Xero Executive Summary', pass: netMargin == null ? null : XK.near(netMargin, execNet, 0.01), detail: XK.pct(netMargin) + ' (computed) vs ' + XK.pct(execNet) + ' (Executive Summary)' }
        : { name: 'Independent tie: Net margin vs Xero Executive Summary (information)', pass: null, info: true, detail: c.errors.exec_summary ? c.err('exec_summary') : 'Executive Summary did not return a matching Net Profit Margin row' },
      { name: 'Score = achieved targets ÷ applicable targets', pass: score == null ? null : true, detail: score == null ? 'No applicable targets (every ratio was N/A)' : achieved + ' / ' + applicable.length + ' = ' + XK.pct(score) },
      { name: 'Revenue growth loaded (prior-year comparison period)', pass: c.errors.pnl_py ? false : wpy ? true : null, detail: c.errors.pnl_py ? c.err('pnl_py') : XK.periodLine(c.inputs.compare_from, c.inputs.compare_to) }
    ];
    this._rows = rows; this._applicable = applicable.length; this._achieved = achieved;
    return { checks: checks, na: ['Xero\'s own Business Health Scorecard (no endpoint on this connector — this is an independently computed scorecard)', 'Industry benchmarks (no benchmark data source on this connector)'],
      notes: ['Targets are edited for this browsing session only — they reset to the defaults shown above on reload.', 'Debtor days and Creditor days are read from Xero\'s Executive Summary and matched by row wording that has not been confirmed live; if Xero\'s wording differs, these show N/A.'],
      title: 'Business Health Scorecard' };
  },
  excel: function (c) {
    var rows = this._rows || [];
    function fmtVal(v, fmt) { if (v == null) return 'N/A'; return fmt === 'pct' ? XK.pct(v) : fmt === 'days' ? Math.round(v) + ' days' : v.toFixed(2) + ':1'; }
    var body = rows.map(function (r) { return [r.metric, r.formula, fmtVal(r.actual, r.fmt), fmtVal(r.target, r.fmt), r.actual == null ? 'N/A' : r.status]; });
    return [{
      name: 'Scorecard',
      rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business Health Scorecard (not Xero\'s own score)', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)],
        ['Score: ' + (this._applicable ? this._achieved + '/' + this._applicable + ' on target' : 'N/A')], [],
        ['Metric', 'Formula', 'Actual', 'Target', 'Status'].map(function (v) { return { v: v, s: 'bold' }; })].concat(body),
      widths: [26, 50, 16, 12, 12]
    }];
  }
});
```

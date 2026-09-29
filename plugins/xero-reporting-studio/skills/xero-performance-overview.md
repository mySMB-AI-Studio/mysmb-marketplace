---
name: xero-performance-overview
description: Build a live, validated Xero Performance Overview on the tested report kit — net profit, income, expenses, margins, expense mix, bank balance, debtor and creditor days with 12-month trends. Use for "performance overview", "business performance", "KPIs", "margins", "debtor days".
---
# Analytics — Performance Overview

Use when the user asks for a performance overview, business performance dashboard, KPI summary, margins, or debtor/creditor days. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_executive_summary`, `get_profit_and_loss`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Delivery: Wave 2 (Analytics dashboard). This is not a numbered Prompt Library statement (no P0x code) — it composes several connector calls rather than reading one Xero report.

**Data-shape caveat (read before relying on this skill live):** `get_executive_summary` is a real tool on this connector, but its exact `Reports[0].Rows` section and row wording has not been confirmed against a live response. This skill parses it the same way every other report is parsed (`XK.walk`, tolerant `Header`/`Section`/`Row`/`SummaryRow` matching per the foundation's *Reading Xero reports*), guessing at Xero's known Executive Summary layout (sections roughly titled Cash, Income/Profitability, Position, Debtors, Creditors; rows including Income, Less operating expenses, Net profit, Gross profit margin, Net profit margin, Average debtor days, Average creditor days). Every match is null-safe and falls back to the `get_profit_and_loss` / `get_balance_sheet` trend calls when a field isn't found. **The first live run must record the actual rows returned and the render function's regexes updated if Xero's wording differs** — see the QA test script.

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_executive_summary` once with `date` = today, `get_profit_and_loss` once with `toDate` = today, `periods` = 11, `timeframe` = `MONTH`, `standardLayout` = `true` (a 12-column monthly trend in one call), and `get_balance_sheet` once the same way (`date` = today, `periods` = 11, `timeframe` = `MONTH`, `standardLayout` = `true`). An error on any one call is that section's failure only — every other section still renders (this dashboard has no single "primary" report the way a financial statement does).

## Date defaults

`as_at_date` = the date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. The 12-month trend always ends at `as_at_date`; there is no separate trend-length control in this version (`periods` is fixed at 11 in the bindings — see *Interactivity*).

## Controls and views

| Control | Behaviour |
|---|---|
| As at | Preset + editable date (today / end of last month / end of last quarter / end of last financial year / custom) — the anchor for the headline KPIs and the end of the 12-month trend |
| Organisation | Picker (LIB-002), every organisation on this Xero connection |
| Accounting basis | N/A in this version — figures are accrual (Xero's default for the Executive Summary and standard P&L/Balance Sheet layout); say so plainly |
| Trend window (12 months) | Fixed in this version — not a control. Making it user-adjustable would need a numeric-stepper control the tested kit does not have yet |
| View as | Client / Bookkeeper / Practitioner / Executive (summary vs detail mode, from the shared kit) |

## Validation checks (shown in the banner)

- Net Profit = Income − Operating Expenses, from the Executive Summary's own three lines (N/A if any of the three is missing)
- **Independent tie:** Cash/bank balance from the Executive Summary vs Total Bank from the Balance Sheet trend at the same date (N/A unless both sources returned a figure)
- Debtor days (recomputed: Accounts Receivable ÷ sales × days in period) vs the Executive Summary's own debtor-days figure — shown for information only; the two methods can legitimately differ
- Creditor days (recomputed: Accounts Payable ÷ cost of sales × days in period) vs the Executive Summary's own creditor-days figure — information only
- The Profit and Loss and Balance Sheet trend calls return the same number of monthly columns (needed for the combined debtor/creditor-days trend chart; that chart is hidden and marked N/A when they don't match)
- Every section total = Σ its account rows, across every source that returned rows

## Save as

`fileName`: `xero-performance-overview.html` · `tags`: ["xero","performance-overview","analytics","dashboard"]

## QA test script (no golden set — new dashboard)

1. On a connected Xero organisation, ask for this report; confirm the four discovery calls (`get_organisation`, `list_connections`, `get_executive_summary`, `get_profit_and_loss`, `get_balance_sheet`) all resolve or fail individually without blocking the rest of the page.
2. **Record `get_executive_summary`'s actual response** (its `Reports[0].Rows` section titles and row labels). Compare against the regexes in this file's Report config (`render` function, the block that reads `wEx`). If Xero's wording differs — e.g. "Net profit" vs "Net Profit", or the Cash/Debtors/Creditors sections use different titles — update the regexes here before shipping this to a client.
3. Cross-check the headline cards (Net Profit, Total Income, Total Operating Expenses, Bank balance) against Xero → Business overview / Reporting → Executive Summary for the same date.
4. Confirm the 12-month trend charts (Net profit trend, Income vs expenses, Bank balance trend) show 12 (or however many Xero actually returned) points ending at the As-at date, oldest to newest left to right — Xero's own column order for a `periods`/`timeframe` report has not been confirmed live; if the chart reads newest-to-oldest, flip the `chronological()` helper in the Report config from `reverse()` to a no-op.
5. Confirm the operating-expense donut sums to the Total Operating Expenses card, and the "this month vs prior month" bars match the trend chart's two most recent points.
6. Validation banner: real checks pass, or show N/A with a stated reason (this report will show more N/A lines than P&L/Balance Sheet until the Executive Summary shape is confirmed — that is expected and by design, not a bug).
7. Change the As-at control and organisation picker; confirm every section refetches and re-validates. Toggle Branding, dark theme, and View as.
8. Download PDF and Download Excel (Performance Overview + Monthly Trend sheets, plus Validation and Parameters). Download/Share a snapshot and confirm it freezes correctly.
9. Cross-client isolation (LIB-002): switching organisation refetches everything for that organisation only.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "as_at_date",
      "label": "As at",
      "type": "date",
      "default": "today"
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
      "id": "exec_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_executive_summary"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at_date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_trend",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "toDate": {
          "kind": "input",
          "input": "as_at_date"
        },
        "periods": {
          "kind": "static",
          "value": 11
        },
        "timeframe": {
          "kind": "static",
          "value": "MONTH"
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
      "id": "bs_trend",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at_date"
        },
        "periods": {
          "kind": "static",
          "value": 11
        },
        "timeframe": {
          "kind": "static",
          "value": "MONTH"
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
  title: 'Performance Overview', primary: 'exec_summary', dated: ['exec_summary'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at_date', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at_date: '2026-09-25', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { exec_summary: ['as_at_date', 'org'], pnl_trend: ['as_at_date', 'org'], bs_trend: ['as_at_date', 'org'], org: ['org'], connections: [] },
  tools: { exec_summary: 'get_executive_summary', pnl_trend: 'get_profit_and_loss (12-month trend)', bs_trend: 'get_balance_sheet (12-month trend)', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
    var chronological = function (arr) { return arr.slice().reverse(); }; // Xero's periods/timeframe columns are ASSUMED most-recent-first — unconfirmed live, see QA step 4
    var wEx = c.data.exec_summary && !c.errors.exec_summary ? XK.walk(c.data.exec_summary) : null;
    var wP = c.data.pnl_trend && !c.errors.pnl_trend ? XK.walk(c.data.pnl_trend) : null;
    var wB = c.data.bs_trend && !c.errors.bs_trend ? XK.walk(c.data.bs_trend) : null;
    if (!wEx && !wP && !wB) {
      var msg0 = c.err('exec_summary') || c.err('pnl_trend') || c.err('bs_trend') || 'Loading…';
      body.innerHTML = '<p class="xk-err">' + XK.h(msg0) + '</p>';
      return { checks: [{ name: 'Performance data loaded', pass: false, detail: msg0 }] };
    }

    // --- helpers ---
    function sectionSeries(w, re, n) { var out = []; for (var i = 0; i < n; i++) out.push(w ? XK.sectionBy(w, re, i) : null); return out; }
    function lineSeries(line, n) { var out = []; for (var i = 0; i < n; i++) out.push(line ? XK.val(line, i) : null); return out; }
    function daysCalc(numerator, denom, days) {
      if (numerator == null || denom == null || denom <= 0 || days == null) return null;
      var v = (numerator / denom) * days; return v < 0 ? null : Math.round(v);
    }
    function asFraction(v) { return v == null || !isFinite(v) ? null : (Math.abs(v) > 1.5 ? v / 100 : v); } // Xero may return a fraction or percentage points — unconfirmed

    // --- Executive Summary headline (guessed section/row wording — see the data-shape caveat above) ---
    var exNetProfit = wEx ? XK.val(XK.find(wEx.lines, null, /^net profit$/i)) : null;
    var exIncome = wEx ? XK.val(XK.find(wEx.lines, null, /^income$/i)) : null;
    var exExpenses = wEx ? XK.val(XK.find(wEx.lines, null, /operating expenses/i)) : null;
    var exGP = asFraction(wEx ? XK.val(XK.find(wEx.lines, null, /gross profit margin/i)) : null);
    var exNPM = asFraction(wEx ? XK.val(XK.find(wEx.lines, null, /net profit margin/i)) : null);
    var exBank = wEx ? XK.val(XK.find(wEx.lines, null, /cash surplus|total cash|^bank$/i)) : null;
    var exDebtorDays = wEx ? XK.val(XK.find(wEx.lines, null, /debtor days|average debtor/i)) : null;
    var exCreditorDays = wEx ? XK.val(XK.find(wEx.lines, null, /creditor days|average creditor/i)) : null;

    // --- Profit and Loss trend (column 0 = most recent per the same assumption) ---
    var nColsP = wP ? wP.columns.length : 0;
    var pIncome0 = wP ? XK.sectionBy(wP, /^(trading )?income$|^revenue$|^sales$/i, 0) : null;
    var pCos0 = wP ? XK.sectionBy(wP, /cost of sales/i, 0) : null;
    var pOpex0 = wP ? XK.sectionBy(wP, /operating expenses|^(less )?expenses$/i, 0) : null;
    var pNetProfitLine = wP ? XK.find(wP.lines, null, /^net (profit|loss)$/i, 'total') : null;
    var pNetProfit0 = pNetProfitLine ? XK.val(pNetProfitLine, 0) : null;
    var pNetProfit1 = pNetProfitLine && nColsP > 1 ? XK.val(pNetProfitLine, 1) : null;

    // --- Balance Sheet trend ---
    var nColsB = wB ? wB.columns.length : 0;
    var bBank0 = wB ? XK.sectionBy(wB, /^bank$/i, 0) : null;
    var arLine = wB ? XK.find(wB.lines, null, /^accounts receivable$/i, 'row') : null;
    var apLine = wB ? XK.find(wB.lines, null, /^accounts payable$/i, 'row') : null;
    var ar0 = arLine ? XK.val(arLine, 0) : null;
    var ap0 = apLine ? XK.val(apLine, 0) : null;

    // --- headline (Executive Summary preferred, trend calls fill any gap) ---
    var pick = function (a, b) { return a != null ? a : b; };
    var netProfit = pick(exNetProfit, pNetProfit0);
    var income = pick(exIncome, pIncome0);
    var expenses = pick(exExpenses, pOpex0);
    var bank = pick(exBank, bBank0);
    var grossProfit = (income != null && pCos0 != null) ? Math.round((income - pCos0) * 100) / 100 : null;
    var netMarginComputed = income ? netProfit / income : null;
    var grossMarginComputed = (income && grossProfit != null) ? grossProfit / income : null;

    // --- recomputed debtor/creditor days for the selected period ---
    var d0 = XK.parse(c.inputs.as_at_date), eomDate = XK.eom(d0.getUTCFullYear(), d0.getUTCMonth() + 1);
    var isMonthEnd = XK.iso(eomDate) === c.inputs.as_at_date;
    var daysUsed = isMonthEnd ? eomDate.getUTCDate() : d0.getUTCDate();
    var debtorDays = daysCalc(ar0, pIncome0, daysUsed);
    var creditorDays = daysCalc(ap0, pCos0 != null ? pCos0 : pOpex0, daysUsed);

    var kpiRow = [
      { label: 'Net Profit', value: netProfit, delta: (netProfit != null && pNetProfit1) ? (netProfit - pNetProfit1) / Math.abs(pNetProfit1) : null },
      { label: 'Total Income', value: income },
      { label: 'Total Operating Expenses', value: expenses },
      { label: 'Bank / cash balance', value: bank },
      { label: 'Net margin', money: false, text: netMarginComputed != null ? XK.pct(netMarginComputed) : 'N/A' },
      { label: 'Gross margin', money: false, text: grossMarginComputed != null ? XK.pct(grossMarginComputed) : 'N/A' },
      { label: 'Debtor days', money: false, text: debtorDays != null ? (debtorDays + ' days') : 'N/A' },
      { label: 'Creditor days', money: false, text: creditorDays != null ? (creditorDays + ' days') : 'N/A' }
    ];
    var empty = !wEx && !wP && !wB;
    body.innerHTML = XK.kpis(kpiRow, c) +
      (empty ? '<p class="muted">No performance data returned for this period.</p>' : '') +
      '<div class="xk-grid2"><div class="xk-card"><h3>Net profit trend</h3><div id="ch1"></div></div><div class="xk-card"><h3>Income vs operating expenses</h3><div id="ch2"></div></div></div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:12px"><div class="xk-card"><h3>Operating expense mix (latest month)</h3><div id="ch3"></div></div><div class="xk-card"><h3>This month vs prior month</h3><div id="ch4"></div></div></div>' +
      '<div class="xk-card detail-block" style="margin-top:12px"><h3>Bank balance trend</h3><div id="ch5"></div></div>';

    var incomeSeries = wP ? sectionSeries(wP, /^(trading )?income$|^revenue$|^sales$/i, nColsP) : [];
    var opexSeries = wP ? sectionSeries(wP, /operating expenses|^(less )?expenses$/i, nColsP) : [];
    var cosSeries = wP ? sectionSeries(wP, /cost of sales/i, nColsP) : [];
    var netProfitSeries = pNetProfitLine ? lineSeries(pNetProfitLine, nColsP) : [];
    var labelsP = wP ? wP.columns.slice(0, nColsP) : [];
    var bankSeries = wB ? sectionSeries(wB, /^bank$/i, nColsB) : [];
    var labelsB = wB ? wB.columns.slice(0, nColsB) : [];

    XK.line(document.getElementById('ch1'), { title: 'Net profit trend', labels: chronological(labelsP), series: [{ name: 'Net Profit', values: chronological(netProfitSeries) }] }, c);
    XK.line(document.getElementById('ch2'), { title: 'Income vs operating expenses', labels: chronological(labelsP), series: [{ name: 'Income', values: chronological(incomeSeries) }, { name: 'Operating Expenses', values: chronological(opexSeries) }] }, c);
    var opexSec = wP ? wP.sections.filter(function (s) { return /operating expenses|^(less )?expenses$/i.test(s.title); })[0] : null;
    var opexItems = opexSec ? opexSec.rows.map(function (l) { return { label: l.label, value: Math.abs(XK.val(l, 0) || 0) }; }) : [];
    XK.donut(document.getElementById('ch3'), { title: 'Operating expense mix', items: opexItems, centre: money(expenses) }, c);
    var barSeries = [{ name: 'This month', values: [pIncome0, pOpex0, pNetProfit0] }];
    if (wP && nColsP > 1) barSeries.push({ name: 'Prior month', values: [XK.sectionBy(wP, /^(trading )?income$|^revenue$|^sales$/i, 1), XK.sectionBy(wP, /operating expenses|^(less )?expenses$/i, 1), pNetProfit1] });
    XK.bars(document.getElementById('ch4'), { title: 'This month vs prior month', labels: ['Income', 'Operating Expenses', 'Net Profit'], series: barSeries }, c);
    XK.line(document.getElementById('ch5'), { title: 'Bank balance trend', labels: chronological(labelsB), series: [{ name: 'Bank balance', values: chronological(bankSeries) }] }, c);

    // --- debtor/creditor days trend: only when the two trend calls line up column-for-column ---
    var aligned = wP && wB && nColsP === nColsB;
    if (aligned) {
      body.innerHTML += '<div class="xk-card detail-block" style="margin-top:12px"><h3>Debtor / creditor days trend (approx. — flat 30.4-day month)</h3><div id="ch6"></div></div>';
      var AVG_DAYS = 30.4, arSeries = lineSeries(arLine, nColsB), apSeries = lineSeries(apLine, nColsB);
      var debtorDaysSeries = incomeSeries.map(function (inc, i) { return daysCalc(arSeries[i], inc, AVG_DAYS); });
      var creditorDaysSeries = cosSeries.map(function (cos, i) { return daysCalc(apSeries[i], cos, AVG_DAYS); });
      XK.line(document.getElementById('ch6'), { title: 'Debtor / creditor days trend', labels: chronological(labelsP), series: [{ name: 'Debtor days', values: chronological(debtorDaysSeries) }, { name: 'Creditor days', values: chronological(creditorDaysSeries) }] }, c);
    }

    // --- checks ---
    var tieCounts = { checked: 0, failed: [] };
    [wEx, wP, wB].forEach(function (w) { if (!w) return; var t = XK.linesTies(w.lines); tieCounts.checked += t.checked; tieCounts.failed = tieCounts.failed.concat(t.failed); });
    var checks = [
      { name: 'Net Profit = Income − Operating Expenses (Executive Summary)', pass: (exNetProfit == null || exIncome == null || exExpenses == null) ? null : XK.near(exNetProfit, exIncome - exExpenses), detail: (exNetProfit == null || exIncome == null || exExpenses == null) ? 'Executive Summary did not return all three lines — see Sources & limitations' : money(exNetProfit) + ' = ' + money(exIncome) + ' − ' + money(exExpenses) },
      { name: 'Cash/bank balance ties to the Balance Sheet Bank total at ' + c.inputs.as_at_date, pass: (exBank == null || bBank0 == null) ? null : XK.near(exBank, bBank0), detail: exBank == null ? 'Executive Summary did not return a cash figure — bank balance shown from the Balance Sheet only' : bBank0 == null ? 'Balance Sheet trend did not return a Bank section' : money(exBank) + ' vs ' + money(bBank0) },
      { name: 'Debtor days (recomputed) vs Executive Summary (information)', pass: null, info: true, detail: exDebtorDays == null ? 'Executive Summary did not return a debtor-days figure — showing the recomputed figure only' : (debtorDays == null ? 'Recomputed figure unavailable' : debtorDays + ' days (recomputed) vs Xero\'s own ' + exDebtorDays + ' days — methods can differ') },
      { name: 'Creditor days (recomputed) vs Executive Summary (information)', pass: null, info: true, detail: exCreditorDays == null ? 'Executive Summary did not return a creditor-days figure — showing the recomputed figure only' : (creditorDays == null ? 'Recomputed figure unavailable' : creditorDays + ' days (recomputed) vs Xero\'s own ' + exCreditorDays + ' days — methods can differ') },
      { name: 'Profit and Loss and Balance Sheet trends cover the same number of months', pass: (wP && wB) ? nColsP === nColsB : null, detail: (wP && wB) ? (nColsP + ' vs ' + nColsB + ' columns') : 'One or both trend calls unavailable' },
      { name: 'Every section total = Σ its account rows (all sources)', pass: tieCounts.checked ? tieCounts.failed.length === 0 : null, detail: tieCounts.failed.length ? 'Mismatch: ' + tieCounts.failed.join(', ') : tieCounts.checked + ' sections checked' }
    ];
    var notes = ['Figures are accrual only in this version — there is no cash/accrual toggle here yet.',
      'get_executive_summary\'s exact row wording is unconfirmed live; unmatched fields fall back to the Profit and Loss / Balance Sheet trend calls (see the top of this skill).'];
    this._kpi = { netProfit: netProfit, income: income, expenses: expenses, bank: bank, netMarginComputed: netMarginComputed, grossMarginComputed: grossMarginComputed, debtorDays: debtorDays, creditorDays: creditorDays };
    this._trend = { labels: chronological(labelsP), income: chronological(incomeSeries), opex: chronological(opexSeries), netProfit: chronological(netProfitSeries), bankLabels: chronological(labelsB), bank: chronological(bankSeries) };
    return { checks: checks, notes: notes, na: ['Xero Analytics/Syft widgets, AI insights and industry benchmarks (not in this connector)', 'Tracking-category breakdowns (not in this version)', 'A trend-window length control (fixed at 12 months in this version)'],
      title: 'Performance Overview' };
  },
  excel: function (c) {
    var k = this._kpi || {}, t = this._trend || { labels: [], income: [], opex: [], netProfit: [], bankLabels: [], bank: [] };
    var summaryRows = [
      { kind: 'row', depth: 0, label: 'Net Profit', values: [k.netProfit] },
      { kind: 'row', depth: 0, label: 'Total Income', values: [k.income] },
      { kind: 'row', depth: 0, label: 'Total Operating Expenses', values: [k.expenses] },
      { kind: 'row', depth: 0, label: 'Bank / cash balance', values: [k.bank] },
      { kind: 'row', depth: 0, label: 'Net margin', values: [k.netMarginComputed], fmt: 'pct' },
      { kind: 'row', depth: 0, label: 'Gross margin', values: [k.grossMarginComputed], fmt: 'pct' },
      { kind: 'row', depth: 0, label: 'Debtor days (recomputed)', values: [k.debtorDays] },
      { kind: 'row', depth: 0, label: 'Creditor days (recomputed)', values: [k.creditorDays] }
    ];
    var sheets = [XK.sheetFromLines('Performance Overview', c.company, XK.asOfLine(c.inputs.as_at_date), ['', 'Value'], summaryRows, XK.footerStamp('Accrual', c.fetchedAt, c.currency), ['money'])];
    if (t.labels.length) {
      var titlesP = [''].concat(t.labels);
      var trendRows = [
        { kind: 'row', depth: 0, label: 'Total Income', values: t.income },
        { kind: 'row', depth: 0, label: 'Operating Expenses', values: t.opex },
        { kind: 'row', depth: 0, label: 'Net Profit', values: t.netProfit }
      ];
      sheets.push(XK.sheetFromLines('Monthly Trend', c.company, 'Monthly trend to ' + c.inputs.as_at_date, titlesP, trendRows, '', t.labels.map(function () { return 'money'; })));
    }
    if (t.bankLabels.length) {
      var titlesB = [''].concat(t.bankLabels);
      sheets.push(XK.sheetFromLines('Bank Balance Trend', c.company, 'Monthly bank balance to ' + c.inputs.as_at_date, titlesB, [{ kind: 'row', depth: 0, label: 'Bank balance', values: t.bank }], '', t.bankLabels.map(function () { return 'money'; })));
    }
    return sheets;
  }
});
```

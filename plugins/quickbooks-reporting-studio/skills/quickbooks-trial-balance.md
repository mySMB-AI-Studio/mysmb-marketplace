---
name: quickbooks-trial-balance
description: QuickBooks Online Trial Balance family (Q22) as a live, validated report in QuickBooks styling. Use when the user asks for a trial balance, TB, debits and credits by account, or to check the books balance.
---

# Trial Balance family (Q22)

Use when the user asks for a trial balance, TB, debits and credits by account, or to check the books balance. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_trial_balance`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › For my accountant › Trial Balance. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q22. Delivery: Wave 2 story (Train 02) — delivered early because it was already validated on 18 Sep.

## Discovery call

`get_report_trial_balance` with `end_date`, `accounting_method` — expect columns '' | Debit | Credit, Data rows per account and a GrandTotal TOTAL row.

## Date defaults

As-of preset `today`: `as_at` = `"today"`; `fy_start` = FY start of `as_at`.

## Members

| Member / view | How |
|---|---|
| Trial Balance | Default |
| Adjusted Trial Balance | N/A — adjusting-entry columns are not exposed |
| Custom Summary Report | Use Profit and Loss / Balance Sheet with Display columns by |

## Validation checks (STEP 4 — shown in the banner)

- Σ debits = Σ credits
- TOTAL row = Σ account rows (debit and credit)
- QuickBooks returned the requested date

## Save as

`fileName`: `quickbooks-trial-balance.html` · `tags`: ["quickbooks","trial-balance","finance"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): As of 31 Aug 2026: TOTAL A$4,021,894.41 / A$4,021,894.41 (Wise-AUD A$147,337.00 · A/R A$91,905.00 · A/P A$175,222.57 …).
3. Compare the layout with the Q22 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "trial_balance",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_trial_balance"
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
  title: 'Trial Balance', token: 'TRIAL_BAL', route: 'report/builder', primary: 'trial_balance', company: 'company_info', prefs: 'prefs',
  inputs: { asAt: 'as_at', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', fy_start: '2026-07-01', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { trial_balance: ['fy_start', 'as_at', 'basis'], company_info: [], prefs: [] },
  tools: { trial_balance: 'get_report_trial_balance', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  derive: function (inp, fyMonth) { return { fy_start: QB.fyStartOf(inp.as_at, fyMonth) }; },
  render: function (c) {
    var body = c.body, rep = c.data.trial_balance;
    if (c.errors.trial_balance) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('trial_balance')) + '</p>'; return { checks: [{ name: 'Trial Balance loaded', pass: false, detail: c.err('trial_balance') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this date', pass: null }] }; }
    var lines = QB.walk(rep), rows = lines.filter(function (l) { return l.kind === 'row'; }), tot = QB.find(lines, 'GrandTotal', /^total$/i);
    var dr = QB.sum(rows.map(function (l) { return l.values[0]; })), cr = QB.sum(rows.map(function (l) { return l.values[1]; }));
    var tDr = tot ? tot.values[0] : null, tCr = tot ? tot.values[1] : null;
    body.innerHTML = QB.kpis([{ label: 'Total debits', value: tDr }, { label: 'Total credits', value: tCr }, { label: 'Difference', value: tDr != null && tCr != null ? Math.round((tDr - tCr) * 100) / 100 : null, sub: '0.00 = balanced' }, { label: 'Accounts', money: false, value: rows.length }], c) +
      '<div class="qb-scroll">' + QB.statement(lines.map(function (l) { return l.kind === 'total' ? Object.assign({}, l, { label: 'TOTAL' }) : l; }), ['', 'Debit', 'Credit'], c) + '</div>';
    var hd = QB.header(rep);
    this._x = { lines: lines };
    return { checks: [
      { name: 'Σ debits = Σ credits', pass: tDr == null || tCr == null ? null : QB.near(tDr, tCr), detail: QB.money(tDr, c.currency, c.display) + ' / ' + QB.money(tCr, c.currency, c.display) },
      { name: 'TOTAL row = Σ account rows (debit and credit)', pass: tDr == null ? null : QB.near(tDr, dr) && QB.near(tCr, cr), detail: QB.money(dr, c.currency, c.display) + ' / ' + QB.money(cr, c.currency, c.display) },
      { name: 'QuickBooks returned the requested date', pass: !c.live ? null : hd.EndPeriod === c.inputs.as_at, detail: 'As of ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }],
      na: ['Adjusted Trial Balance (adjusting-entry columns are not exposed by the Accounting API)', 'Custom Summary Report (use Profit and Loss or Balance Sheet with Display columns by)'], period: QB.asOfLine(c.inputs.as_at) };
  },
  excel: function (c) {
    var lines = (this._x || { lines: [] }).lines, n = lines.filter(function (l) { return l.kind === 'row'; }).length;
    var sh = QB.sheetFromLines('Trial Balance', c.company, QB.asOfLine(c.inputs.as_at), ['', 'Debit', 'Credit'], lines.filter(function (l) { return l.kind === 'row'; }), null);
    sh.rows.push([{ v: 'TOTAL', s: 'bold' }, { f: 'SUM(B6:B' + (5 + n) + ')', s: 'moneyBold' }, { f: 'SUM(C6:C' + (5 + n) + ')', s: 'moneyBold' }]);
    sh.rows.push([], [{ v: QB.footerStamp(c.inputs.basis, c.fetchedAt), s: 'muted' }]);
    return [sh];
  }
});
```

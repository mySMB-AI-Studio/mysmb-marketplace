---
name: xero-trial-balance
description: Build a live, validated Xero Trial Balance on the tested report kit — as-at date, accrual/cash basis and an organisation picker. Use for "trial balance", "TB", "debits and credits", "account balances as at".
---
# Trial Balance

Use when the user asks for a trial balance, TB, debits and credits by account, or account balances as at a date. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_trial_balance`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Trial Balance. Not in the original Xero Reports Prompt Library v1.2 (P01–P15) — added to cover a gap in the original 15-report library.

**Note on tier:** this skill uses the same shared report kit (`{{KIT}}`/`{{CFG}}`) as Profit and Loss (P06) and Balance Sheet (P07) below, because `get_trial_balance` needs only the kit's existing `asAt` / `basis` / `org` / `persona` / `display` input roles — no new control the kit doesn't already support. The foundation file's own intro paragraph still names only P06/P07 as "kit reports"; that line was not edited as part of adding this skill (out of scope here), so treat this as the kit mechanism extended to a third report rather than a formally re-declared kit list.

## Discovery call

Call `get_organisation` once, `list_connections` once, and `get_trial_balance` once with `date` = today. The connector facts confirm `get_trial_balance` returns the same `{Reports:[{Rows:[...]}]}` shape as every other report tool, but its exact section/column layout (whether accounts are grouped into titled sections by account type the way the Balance Sheet is, and whether amounts arrive as separate Debit/Credit columns or one signed column) has **not been exercised live** — read `w.columns` (from the Header row, via `XK.walk`) and match by label (`/debit/i`, `/credit/i`) rather than assuming a fixed column count or position. An error is a failed call: report its message.

## Date defaults

`as_at` = the balance date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. No `fy_start` is needed — the Current Year Earnings tie below reads the Balance Sheet's own figure directly, it does not recompute a financial-year-to-date P&L.

## Members

| Member / view | How |
|---|---|
| Trial Balance | Report = Trial Balance (default, only view) |
| Cash basis | Accounting method = Cash (Xero payments only) |
| Another organisation | Organisation picker |
| Comparison, tracking columns, YTD vs period columns | N/A in this version — `get_trial_balance` takes no `periods` / comparison parameter; say so |

## Validation checks (shown in the banner)

- Total Debits = Total Credits — shown only when the call returns separate Debit/Credit columns (detected from the Header row); N/A, with the actual column names disclosed, when it does not
- Every section total = Σ its account rows — only when Xero grouped rows into titled sections; N/A otherwise
- Parent group totals = Σ their sections — only when the report nests sections under a parent group the way the Balance Sheet does; N/A otherwise
- **Independent tie:** Current Year Earnings on the Trial Balance (only when a matching account row is found) = Current Year Earnings on the Balance Sheet at the same date (a separate Xero report; accrual basis only) — informational, never Fail, when no matching row is found; the exact account label Xero uses on a Trial Balance was not confirmed live
- No "comparison period loaded" check here — the tool has no comparison parameter

## Save as

`fileName`: `xero-trial-balance.html` · `tags`: ["xero","trial-balance","financial-statement"]

## QA test script (golden set)

1. On a connected organisation, ask for this report as at today (or a stated date); confirm the discovery call succeeded and the report saved.
2. This report is new and has no golden-set figures yet. On the QA organisation, check the totals this renderer shows (Total Debits/Total Credits, or the single-column total, whichever the connector actually returns) against Xero → Reporting → Trial Balance for the same date, and confirm the column layout the renderer detected matches what Xero's own screen shows — this is the first live check of that shape.
3. Validation banner: every applicable check passes, or shows N/A / information with a stated reason — confirm the Debit = Credit check specifically either passes or is honestly N/A (never silently wrong, never a false Pass).
4. Change every control and confirm the report refetches and still validates; switch Accounting method; switch View as to Client, then Bookkeeper; toggle Branding and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen.
6. Download or Share from the report window: the snapshot keeps the date and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

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
      "name": "basis",
      "label": "Accounting basis",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"tb\"}"
    }
  ],
  "bindings": [
    {
      "id": "tb",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_trial_balance"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
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
      "id": "tb_cash",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_trial_balance"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
        },
        "paymentsOnly": {
          "kind": "static",
          "value": true
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bs_tie",
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
  title: 'Trial Balance', primary: 'tb', dated: ['tb', 'tb_cash'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', basis: 'basis', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"tb"}' },
  uses: { tb: ['as_at', 'org'], tb_cash: ['as_at', 'org'], bs_tie: ['as_at', 'org'], org: ['org'], connections: [] },
  tools: { tb: 'get_trial_balance', tb_cash: 'get_trial_balance (cash basis)', bs_tie: 'get_balance_sheet (Current Year Earnings tie, same date)', org: 'get_organisation', connections: 'list_connections' },
  compare: false,
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash';
    var id = cash ? 'tb_cash' : 'tb';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Trial Balance loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var w = XK.walk(c.data[id]);
    // Column detection is defensive: the exact Debit/Credit layout get_trial_balance returns was not verified live before this skill was written.
    var dCol = -1, cCol = -1;
    (w.columns || []).forEach(function (h, i) { var s = String(h || '').toLowerCase(); if (dCol < 0 && /debit/.test(s)) dCol = i; if (cCol < 0 && /credit/.test(s)) cCol = i; });
    var hasDC = dCol >= 0 && cCol >= 0, rows = w.lines.filter(function (l) { return l.kind === 'row'; });
    var totalDebit = hasDC ? XK.sum(rows.map(function (l) { return l.values[dCol]; })) : null;
    var totalCredit = hasDC ? XK.sum(rows.map(function (l) { return l.values[cCol]; })) : null;
    var kpis = hasDC ? [{ label: 'Total Debits', value: totalDebit }, { label: 'Total Credits', value: totalCredit }] : [];
    kpis.push({ label: 'Accounts shown', text: String(rows.length) });
    var titles = [''].concat(w.columns && w.columns.length ? w.columns : ['Value']);
    body.innerHTML = XK.kpis(kpis, c) + '<div class="xk-scroll">' + XK.statement(w.lines, titles, c, []) + '</div>';

    // Checks. Debit=Credit is the fundamental identity when the connector splits the columns; section/parent ties re-add
    // Xero's own totals from the account rows exactly as the P&L/Balance Sheet kit reports do; the independent tie matches
    // Current Year Earnings against a separate Balance Sheet call for the same date, when a matching row can be found.
    var ties = XK.linesTies(w.lines), par = XK.parentTies(w);
    var cyeLine = XK.currentYearEarnings(w.lines), cye = null;
    if (cyeLine) cye = hasDC ? Math.round(((cyeLine.values[cCol] || 0) - (cyeLine.values[dCol] || 0)) * 100) / 100 : XK.val(cyeLine, 0);
    var bsErr = c.errors.bs_tie, bsW = c.data.bs_tie ? XK.walk(c.data.bs_tie) : null, bsCyeLine = bsW ? XK.currentYearEarnings(bsW.lines) : null, bsCye = bsCyeLine ? XK.val(bsCyeLine) : null;
    var checks = [
      { name: 'Total Debits = Total Credits', pass: hasDC ? XK.near(totalDebit, totalCredit) : null, detail: hasDC ? money(totalDebit) + ' vs ' + money(totalCredit) : 'Xero returned column(s) ' + ((w.columns || []).join(', ') || '(none)') + ' instead of separate Debit/Credit columns on this call' },
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.checked ? (ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections') : 'Xero did not group this Trial Balance into titled sections' },
      { name: 'Parent group totals = Σ their sections', pass: par.checked ? par.failed.length === 0 : null, detail: par.checked ? (par.failed.length ? par.failed.join('; ') : par.checked + ' groups') : 'No nested parent groups in this report' },
      !cash && cyeLine ? { name: 'Current Year Earnings (Trial Balance) = Current Year Earnings (Balance Sheet) at ' + c.inputs.as_at, pass: bsErr || bsCye == null ? null : XK.near(cye, bsCye), detail: bsErr ? c.err('bs_tie') : bsCye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(cye) + ' vs ' + money(bsCye) }
        : { name: 'Current Year Earnings tie (information)', pass: null, info: true, detail: cash ? 'The tie is checked on the accrual basis' : 'No row on this Trial Balance matched the Current Year Earnings label — the exact account naming was not verified live' }
    ];
    var notes = [];
    if (!hasDC) notes.push('This call returned column(s) ' + ((w.columns || []).join(', ') || '(none)') + ' rather than separate Debit/Credit columns — shown as Xero returned it; the Debit = Credit check is N/A rather than guessed.');
    if (cash) notes.push('Cash basis: Xero\'s Trial Balance with payments only (paymentsOnly = true).');
    this._lines = w.lines; this._cols = titles;
    return { checks: checks, notes: notes, na: [], title: 'Trial Balance' };
  },
  excel: function (c) {
    var lines = this._lines || [], titles = this._cols || ['', 'Value'];
    return [XK.sheetFromLines('Trial Balance', c.company, XK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: l.values };
    }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), titles.slice(1).map(function () { return 'money'; }))];
  }
});
```

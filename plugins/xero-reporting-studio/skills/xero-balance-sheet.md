---
name: xero-balance-sheet
description: Build a live, validated Xero Balance Sheet (P07) on the tested report kit — as-at presets, accrual/cash basis, comparison column and an organisation picker. Use for "balance sheet", "financial position", "net assets", "assets and liabilities", or a balance sheet comparison.
---
# Balance Sheet (P07)

Use when the user asks for a balance sheet, statement of financial position, net assets, assets and liabilities as at a date, or a balance sheet comparison. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_balance_sheet`, `get_profit_and_loss`, `get_organisation`, `list_connections`).

Xero location: Reporting → Balance Sheet. Library: Xero Reports Prompt Library v1.2 → Prompts → P07. Delivery: Wave 1 (delivery order 2).

## Discovery call

Call `get_organisation` once, `list_connections` once, and `get_balance_sheet` once with `date` = today and `standardLayout` = `true`. Expect `{Reports:[{Rows:[Header, Section "Assets" (no rows — a group), Section "Bank" / "Current Assets" / "Fixed Assets" …, untitled Section "Total Assets", …, "Net Assets", Section "Equity"]}]}`. Xero may add a comparative column; the kit reads the first value column only. An error is a failed call: report its message.

## Date defaults

`as_at` = the balance date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. `fy_start` is derived by the kit from `as_at` and the organisation's financial year — leave its default. `compare_as_at` is set by the Compare to control.

## Members

| Member / view | How |
|---|---|
| Balance Sheet | Report = Balance Sheet (default) |
| Balance Sheet summary | Report = Summary (totals only) |
| Compare with last year / last month end | Compare to = Previous year / Previous month end |
| Cash basis | Accounting method = Cash (Xero payments only — receivables and payables excluded) |
| Another organisation | Organisation picker |
| Presentation currency, tracking options | N/A in this version — the Balance Sheet is in the organisation's base currency |

## Validation checks (shown in the banner)

- Total Assets = Total Liabilities + Total Equity (the equation and its difference stated)
- Net Assets = Total Assets − Total Liabilities = Total Equity
- Total Bank = Σ bank account rows
- Every section total = Σ its account rows
- Total Assets and Total Liabilities = Σ their sections
- **Independent tie:** Current Year Earnings = P&L Net Profit from the financial-year start to the as-at date (a separate Xero report; accrual basis)
- Comparison date loaded (when Compare to is on)

## Save as

`fileName`: `xero-balance-sheet.html` · `tags`: ["xero","balance-sheet","P07","financial-statement"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Hammerjack Pty Limited as at 30 June 2026 (As at = End of last financial year): Total Bank 2,217,113 · Accounts Receivable 1,793,117 · Total Assets 5,983,122 · Accounts Payable 1,348,681 · GST 637,113 · Total Current Liabilities 2,053,702. On Irvine Jackson Pty Ltd in QA, check that every validation line passes and the figures match Xero → Reporting → Balance Sheet for the same date.
3. Validation banner: every check passes (the independent tie included), or shows N/A / information with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch Accounting method; switch View as to Client, then Bookkeeper; toggle Branding and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
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
      "name": "compare_as_at",
      "label": "Compare as at",
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"bs\"}"
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
      "id": "bs_cash",
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
          "value": true
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bs_compare",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "compare_as_at"
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
      "id": "bs_compare_cash",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "compare_as_at"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
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
  title: 'Balance Sheet', primary: 'bs', org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', basis: 'basis', cmpAsAt: 'compare_as_at', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', compare_as_at: '2025-09-25', fy_start: '2026-07-01', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"bs"}' },
  uses: { bs: ['as_at', 'org'], bs_cash: ['as_at', 'org'], bs_compare: ['compare_as_at', 'org'], bs_compare_cash: ['compare_as_at', 'org'], pnl_ytd: ['fy_start', 'as_at', 'org'], org: ['org'], connections: [] },
  tools: { bs: 'get_balance_sheet', bs_cash: 'get_balance_sheet (cash basis)', bs_compare: 'get_balance_sheet (comparison date)', bs_compare_cash: 'get_balance_sheet (comparison date, cash basis)', pnl_ytd: 'get_profit_and_loss (financial year to date, for the Current Year Earnings tie)', org: 'get_organisation', connections: 'list_connections' },
  compare: true,
  views: [['bs', 'Balance Sheet'], ['summary', 'Summary (totals only)']],
  derive: function (inp, fyMonth) { return { fy_start: XK.fyStartOf(inp.as_at, fyMonth) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash';
    var id = cash ? 'bs_cash' : 'bs', cid = cash ? 'bs_compare_cash' : 'bs_compare';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var cmpOn = c.compareMode !== 'none', w = XK.walk(c.data[id]), wc = cmpOn && c.data[cid] ? XK.walk(c.data[cid]) : null;
    var key = function (l) { return l.kind + '|' + (l.id || l.label) + '|' + l.group; }, cmap = {}, seen = {};
    if (wc) wc.lines.forEach(function (l) { cmap[key(l)] = l.values[0]; });
    var lines = w.lines.map(function (l) { seen[key(l)] = 1; return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? (cmap[key(l)] != null ? cmap[key(l)] : wc ? 0 : null) : null }); });
    if (wc) wc.lines.forEach(function (l) {
      if (l.kind !== 'row' || seen[key(l)]) return;
      var tot = -1, last = -1; lines.forEach(function (x, i) { if (x.group === l.group) { last = i; if (x.kind === 'total' && tot < 0) tot = i; } });
      if (last >= 0) lines.splice(tot >= 0 ? tot : last + 1, 0, Object.assign({}, l, { values: [0], cmp: l.values[0] }));
    });
    var all = lines;
    if (c.view === 'summary') lines = lines.filter(function (l) { return l.kind !== 'row'; });
    var tv = function (group, re) { var l = XK.find(w.lines, group, re, 'total'); return l ? XK.val(l) : null; };
    var A = tv('Assets', /^total assets$/i), L = tv('Liabilities', /^total liabilities$/i), E = tv('Equity', /^total equity$/i), NA = tv(null, /^net assets$/i);
    var bankSec = w.sections.filter(function (s) { return /^bank$/i.test(s.title); })[0];
    var extra = cmpOn ? XK.compareCols(c.compareMode === 'prev_year' ? 'Previous year' : 'Previous month end') : [];
    body.innerHTML = XK.kpis([{ label: 'Total Assets', value: A }, { label: 'Total Liabilities', value: L }, { label: 'Net Assets', value: NA }, { label: 'Total Equity', value: E }], c) +
      '<div class="xk-scroll">' + XK.statement(lines, ['', w.columns[0] || XK.asOfLine(c.inputs.as_at).replace(/^As at /, '')], c, extra) + '</div>' +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Assets vs liabilities + equity</h3><div id="ch1"></div></div>';
    var LE = L != null && E != null ? Math.round((L + E) * 100) / 100 : null;
    XK.bars(document.getElementById('ch1'), { title: 'Assets vs liabilities + equity', labels: ['Assets', 'Liabilities', 'Equity', 'Liabilities + Equity'], series: [{ name: XK.asOfLine(c.inputs.as_at), values: [A, L, E, LE] }] }, c);

    // Checks. Xero sends its own totals; these re-add them from the rows. The independent tie matches Current Year Earnings
    // against the Profit and Loss from the financial-year start (a separate Xero report).
    var ties = XK.linesTies(w.lines), par = XK.parentTies(w), plErr = c.errors.pnl_ytd;
    var pl = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null, npl = pl ? XK.find(pl.lines, null, /^net (profit|loss)$/i, 'total') : null, np = npl ? XK.val(npl) : null;
    var cyeLine = XK.currentYearEarnings(w.lines), cye = cyeLine ? XK.val(cyeLine) : null;
    var bankSum = bankSec ? XK.sum(bankSec.rows.map(function (l) { return l.values[0]; })) : null, bankTot = bankSec ? XK.sectionTotal(bankSec) : null;
    var checks = [
      { name: 'Total Assets = Total Liabilities + Total Equity', pass: A == null || LE == null ? null : XK.near(A, LE), detail: A == null || LE == null ? 'Xero returned no Total Assets / Total Liabilities / Total Equity line' : money(A) + ' = ' + money(L) + ' + ' + money(E) + (XK.near(A, LE) ? ' (difference ' + money(0) + ')' : ' — difference ' + money(Math.round((A - LE) * 100) / 100)) },
      { name: 'Net Assets = Total Assets − Total Liabilities = Total Equity', pass: NA == null || A == null || L == null || E == null ? null : XK.near(NA, A - L) && XK.near(NA, E), detail: NA == null ? 'No Net Assets line' : money(NA) },
      { name: 'Total Bank = Σ bank account rows', pass: bankSec && bankSec.summary ? XK.near(bankTot, bankSum) : null, detail: bankSec ? money(bankTot) + ' — ' + bankSec.rows.length + ' account' + (bankSec.rows.length === 1 ? '' : 's') : 'No Bank section' },
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Total Assets and Total Liabilities = Σ their sections', pass: par.checked ? par.failed.length === 0 : null, detail: par.failed.length ? par.failed.join('; ') : par.checked + ' groups' },
      !cash ? { name: 'Current Year Earnings = P&L Net Profit ' + c.inputs.fy_start + ' to ' + c.inputs.as_at, pass: plErr || np == null || cye == null ? null : XK.near(cye, np), detail: plErr ? c.err('pnl_ytd') : cye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(cye) + ' vs ' + money(np) }
        : { name: 'Current Year Earnings vs P&L Net Profit (information)', pass: null, info: true, detail: 'The tie is checked on the accrual basis' }
    ];
    if (cmpOn) checks.push({ name: 'Comparison date loaded', pass: c.errors[cid] ? false : c.data[cid] ? true : null, detail: c.errors[cid] ? c.err(cid) : c.inputs.compare_as_at });
    var notes = [];
    if (cash) notes.push('Cash basis: Xero\'s Balance Sheet with payments only (paymentsOnly = true) — receivables and payables are excluded.');
    var od = bankSec ? bankSec.rows.filter(function (l) { return l.values[0] < 0; }) : [];
    if (od.length) notes.push('Overdrawn bank account(s): ' + od.map(function (l) { return l.label + ' ' + money(l.values[0]); }).join(', ') + '.');
    this._lines = c.view === 'summary' ? lines : all; this._extra = extra;
    return { checks: checks, notes: notes, na: [],
      title: cmpOn ? 'Balance Sheet Comparison' : c.view === 'summary' ? 'Balance Sheet Summary' : 'Balance Sheet' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Balance'].concat(extra.map(function (e) { return e.title; }));
    return [XK.sheetFromLines('Balance Sheet', c.company, XK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});
```

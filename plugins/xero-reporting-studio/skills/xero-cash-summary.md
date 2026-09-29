---
name: xero-cash-summary
description: Build a live Cash Summary on the tested report kit from Xero's Bank Summary — period and comparison presets, per-bank-account movement, an organisation picker and a Balance Sheet tie. Use for "cash summary", "cash received and spent", "cash movement", "bank summary".
---
# Cash Summary

Use when the user asks for a cash summary, cash received and spent, cash movement, or a bank summary. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_bank_summary`, `get_profit_and_loss`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Cash Summary. **There is no Cash Summary endpoint on the connector** — this report is an honest substitute assembled from `get_bank_summary` (per bank account: Opening Balance, Cash Received, Cash Spent, Closing Balance for one date range; there is no `periods` param, so this version shows one selected period as a single total, not a month-by-month grid — say so plainly rather than approximate a breakdown the connector cannot produce).

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_bank_summary` once with `fromDate` = the financial-year start, `toDate` = today, `get_profit_and_loss` once with the same dates and `paymentsOnly` = `true` (cash-basis context), and `get_balance_sheet` once at `toDate` (for the Total Bank tie). Expect `get_bank_summary` to return the same `{ Reports: [{ ReportTitles, ReportDate, Rows }] }` shape as every other Xero report tool, with one row per bank account and a Total row. An error is a failed call: report its message.

## Date defaults

`from_date` = start of the period asked for (default: the financial-year start from `get_organisation`); `to_date` = end of the period (default `"today"`). Set the display preset `p` to match (`this_fy_td` by default; `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). Comparison dates are set by the kit from the Compare to control; leave their defaults.

## Members

| Member / view | How |
|---|---|
| Cash Summary for a period | Report period (from/to) |
| Compare with previous period / same period last year / year to date | Compare to = Previous period / Previous year / Year to date |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Category breakdown of receipts/payments | Shown as a cash-basis Profit and Loss reconciling line, not an invented split — see *Validation checks* |
| Month-by-month columns | N/A in this version — `get_bank_summary` takes one date range per call and has no `periods` parameter; say so |
| Investing / financing / equity sections | N/A — not in source |

## Validation checks (shown in the banner)

- Total Opening Balance, Cash Received, Cash Spent and Closing Balance each = Σ their per-account rows (Xero's own Total row re-added)
- Closing balance = Opening balance + Cash received + Cash spent (Xero is assumed to report Cash Spent as a negative value, matching its usual sign convention — **not live-verified for this report**; if this check fails consistently, the sign should be flipped)
- **Independent tie:** Total Closing Balance = Total Bank on the Balance Sheet at the same date (a separate Xero report; small gaps can reflect unreconciled statement lines or timing)
- Comparison period loaded (when Compare to is on)

## Save as

`fileName`: `xero-cash-summary.html` · `tags`: ["xero","cash-summary","cash","bank-summary"]

## QA test script (golden set)

This report has not been exercised against a live Xero connection yet. Someone with connector access should:

1. On Hammerjack Pty Limited, ask for this report at This financial year to date; confirm the discovery call succeeds (`get_bank_summary`, `get_profit_and_loss`, `get_balance_sheet`, `get_organisation`, `list_connections`) and the report saves.
2. Record the actual per-bank-account Opening/Received/Spent/Closing figures from Xero → Reporting → Bank Summary for the same dates and confirm this report's table matches exactly (Cash Spent's sign convention is the one item to confirm first — see the note above).
3. On Irvine Jackson Pty Ltd in QA, confirm every validation line passes (the Balance Sheet Total Bank tie included) or shows a stated N/A / information reason.
4. Change the period, switch Compare to through each option, and confirm the report refetches and still validates; switch View as to Client, then Bookkeeper; toggle Branding and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets in addition to the Cash Summary sheet).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "from_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "today"
    },
    {
      "name": "compare_from",
      "label": "Compare from",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "compare_to",
      "label": "Compare to",
      "type": "date",
      "default": "2025-09-29"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "cash_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "from_date"
        },
        "toDate": {
          "kind": "input",
          "input": "to_date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "cash_summary_compare",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
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
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_cash",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "from_date"
        },
        "toDate": {
          "kind": "input",
          "input": "to_date"
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
      "id": "bs_end",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "to_date"
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
  title: 'Cash Summary', primary: 'cash_summary', dated: ['cash_summary'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', cmpStart: 'compare_from', cmpEnd: 'compare_to', org: 'org', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-29', compare_from: '2025-07-01', compare_to: '2025-09-29', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { cash_summary: ['from_date', 'to_date', 'org'], cash_summary_compare: ['compare_from', 'compare_to', 'org'], pnl_cash: ['from_date', 'to_date', 'org'], bs_end: ['to_date', 'org'], org: ['org'], connections: [] },
  tools: { cash_summary: 'get_bank_summary', cash_summary_compare: 'get_bank_summary (comparison period)', pnl_cash: 'get_profit_and_loss (cash basis, for category context)', bs_end: 'get_balance_sheet (Total Bank tie)', org: 'get_organisation', connections: 'list_connections' },
  compare: true,
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
    if (c.errors.cash_summary) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('cash_summary')) + '</p>'; return { checks: [{ name: 'Bank summary loaded', pass: false, detail: c.err('cash_summary') }] }; }
    if (!c.data.cash_summary) return {};
    var w = XK.walk(c.data.cash_summary), cmpOn = c.compareMode !== 'none', wc = cmpOn && c.data.cash_summary_compare ? XK.walk(c.data.cash_summary_compare) : null;
    var cols = w.columns.length ? w.columns : ['Opening Balance', 'Cash Received', 'Cash Spent', 'Closing Balance'];
    function idxOf(re, fb) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return fb; }
    var iOpen = idxOf(/open/i, 0), iRecv = idxOf(/receiv|deposit/i, 1), iSpent = idxOf(/spent|paid/i, 2), iClose = idxOf(/clos/i, cols.length - 1);
    var lines = w.lines.filter(function (l) { return l.kind !== 'header'; }).map(function (l) { var tot = /^total/i.test(l.label); return Object.assign({}, l, { kind: tot ? 'total' : 'row', depth: tot ? 0 : 1 }); });
    var acctLines = lines.filter(function (l) { return l.kind === 'row'; }), totalLine = lines.filter(function (l) { return l.kind === 'total'; })[0];
    var empty = !acctLines.length;
    function colSum(idx) { return XK.sum(acctLines.map(function (l) { return l.values[idx]; })); }
    var totOpen = totalLine ? totalLine.values[iOpen] : (acctLines.length ? colSum(iOpen) : null);
    var totRecv = totalLine ? totalLine.values[iRecv] : (acctLines.length ? colSum(iRecv) : null);
    var totSpent = totalLine ? totalLine.values[iSpent] : (acctLines.length ? colSum(iSpent) : null);
    var totClose = totalLine ? totalLine.values[iClose] : (acctLines.length ? colSum(iClose) : null);
    // Xero's Bank Summary is assumed to report Cash Spent as a negative value (outflows shown negative), matching its usual
    // convention elsewhere — not live-verified for this report. If the check below fails consistently, flip the sign here.
    var netMove = (totRecv != null && totSpent != null) ? Math.round((totRecv + totSpent) * 100) / 100 : null;
    var impliedClose = (totOpen != null && netMove != null) ? Math.round((totOpen + netMove) * 100) / 100 : null;

    var cmp = null;
    if (cmpOn && wc) {
      var cLines = wc.lines.filter(function (l) { return l.kind !== 'header'; });
      var cAcct = cLines.filter(function (l) { return !/^total/i.test(l.label); }), cTotalLine = cLines.filter(function (l) { return /^total/i.test(l.label); })[0];
      var cColSum = function (idx) { return XK.sum(cAcct.map(function (l) { return l.values[idx]; })); };
      cmp = { open: cTotalLine ? cTotalLine.values[iOpen] : cColSum(iOpen), recv: cTotalLine ? cTotalLine.values[iRecv] : cColSum(iRecv), spent: cTotalLine ? cTotalLine.values[iSpent] : cColSum(iSpent), close: cTotalLine ? cTotalLine.values[iClose] : cColSum(iClose) };
    }
    var deltaClose = (cmp && cmp.close != null && totClose != null && cmp.close) ? (totClose - cmp.close) / Math.abs(cmp.close) : null;

    body.innerHTML = XK.kpis([
      { label: 'Total Opening Balance', value: totOpen },
      { label: 'Total Cash Received', value: totRecv },
      { label: 'Total Cash Spent', value: totSpent },
      { label: 'Total Closing Balance', value: totClose, delta: deltaClose }
    ], c) + (empty ? '<p class="muted">Xero returned no bank accounts for this period.</p>' : '<div class="xk-scroll">' + XK.statement(lines, [''].concat(cols), c) + '</div>') +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Cash received vs spent</h3><div id="ch1"></div></div>';
    XK.bars(document.getElementById('ch1'), { title: 'Cash received vs spent', labels: ['Opening', 'Received', 'Spent', 'Closing'], series: [{ name: 'This period', values: [totOpen, totRecv, totSpent, totClose] }].concat(cmp ? [{ name: 'Comparison', values: [cmp.open, cmp.recv, cmp.spent, cmp.close] }] : []) }, c);

    function tieCol(idx, label) {
      if (!totalLine || !acctLines.length) return { name: 'Total ' + label + ' = Σ accounts', pass: null, detail: 'No Total row from Xero to check against' };
      var s = colSum(idx), t = totalLine.values[idx];
      return { name: 'Total ' + label + ' = Σ accounts', pass: t == null ? null : XK.near(t, s), detail: t == null ? 'No ' + label + ' on the Total row' : money(t) + ' vs Σ ' + money(s) };
    }
    var bsErr = c.errors.bs_end, bsLines = c.data.bs_end ? XK.walk(c.data.bs_end).lines : null;
    var bsBank = bsLines ? XK.find(bsLines, 'Bank', null, 'total') : null, bsBankVal = bsBank ? XK.val(bsBank) : null;
    var checks = [
      tieCol(iOpen, 'Opening Balance'), tieCol(iRecv, 'Cash Received'), tieCol(iSpent, 'Cash Spent'), tieCol(iClose, 'Closing Balance'),
      { name: 'Closing balance = Opening balance + Cash received + Cash spent', pass: impliedClose == null || totClose == null ? null : XK.near(impliedClose, totClose), detail: impliedClose == null || totClose == null ? 'Xero returned no Closing Balance / Total row' : money(totClose) + ' vs computed ' + money(impliedClose) + ' (assumes Xero reports Cash Spent as a negative value)' },
      { name: 'Total Closing Balance vs Balance Sheet Total Bank at ' + c.inputs.to_date, pass: bsErr || bsBankVal == null || totClose == null ? null : XK.near(totClose, bsBankVal), detail: bsErr ? c.err('bs_end') : bsBankVal == null ? 'No Bank total on the Balance Sheet' : money(totClose) + ' vs ' + money(bsBankVal) + ' — small gaps can reflect unreconciled statement lines or timing' }
    ];
    if (cmpOn) checks.push({ name: 'Comparison period loaded', pass: c.errors.cash_summary_compare ? false : c.data.cash_summary_compare ? true : null, detail: c.errors.cash_summary_compare ? c.err('cash_summary_compare') : XK.periodLine(c.inputs.compare_from, c.inputs.compare_to) });

    var plErr = c.errors.pnl_cash, plw = c.data.pnl_cash ? XK.walk(c.data.pnl_cash) : null;
    var plNetLine = plw ? XK.find(plw.lines, null, /^net (profit|loss)$/i, 'total') : null, plNet = plNetLine ? XK.val(plNetLine) : null;
    var otherMove = (netMove != null && plNet != null) ? Math.round((netMove - plNet) * 100) / 100 : null;
    var notes = ['Cash-basis Net Profit (get_profit_and_loss, paymentsOnly=true): ' + (plErr ? c.err('pnl_cash') : plNet == null ? 'N/A' : money(plNet)) + '. Other (balance-sheet) movements — GST, loans, transfers, asset purchases, calculated as net cash movement minus cash-basis net profit, not an invented category split: ' + (otherMove == null ? 'N/A' : money(otherMove)) + '.'];

    this._lines = lines; this._cols = cols;
    return { checks: checks, notes: notes,
      na: ['Monthly/period-by-period breakdown — get_bank_summary has no periods parameter; this report shows one period as a single total', 'Investing / financing / equity sections — not in source', 'Xero\'s own Cash Summary report — this is a substitute built from get_bank_summary, not the native report'],
      title: cmpOn ? 'Cash Summary Comparison' : 'Cash Summary', period: XK.periodLine(c.inputs.from_date, c.inputs.to_date) };
  },
  excel: function (c) {
    var lines = this._lines || [], cols = this._cols || [];
    return [XK.sheetFromLines('Cash Summary', c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date), [''].concat(cols), lines, XK.footerStamp('Accrual', c.fetchedAt, c.currency))];
  }
});
```

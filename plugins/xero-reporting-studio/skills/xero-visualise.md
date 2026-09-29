---
name: xero-visualise
description: Build live Xero charts (kit report) for Profitability, Cash, Accounts and KPIs from real trend data, with an honest no-data state for External data and Industry benchmarks. Use for "visualise", "chart", "graph my Xero data", "trend", "show me a chart of".
---
# Visualise

Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below. Six modes exist; four have real data behind them and are built as one `XK.app` kit report with a mode switch (the kit's `views` control). **External data** and **Industry benchmarks** have no data source on the `xero-accounting` connector at all — they render a plain "no data source; provide your own cited figures" state, never a fabricated chart, and consume no bindings.

- **Profitability**: `get_profit_and_loss` with `periods` / `timeframe` — one call returns the whole multi-month trend (no fan-out needed).
- **Cash**: `get_bank_summary` for the selected range's cash in / cash out / opening / closing (one call, current range only — `get_bank_summary` has no `periods` param, so a multi-period *cash-in/cash-out* trend would need one call per period; that fan-out is out of scope here). The bank-**balance** trend instead comes from `get_balance_sheet`'s own `periods` / `timeframe` (the Bank section across columns), which needs only one call.
- **Accounts**: `get_balance_sheet` (point-in-time Accounts Receivable / Accounts Payable rows) plus `list_invoices` for the open-items composition (first 100 open items per side, ordered by due date — see *Data facts* below; the same method as the Aged Receivables / Aged Payables skills, capped to one page here since composition is illustrative, not a lodgement figure).
- **KPIs**: margins and current ratio from `get_profit_and_loss` / `get_balance_sheet`; debtor and creditor days from `get_executive_summary` (row wording not confirmed live — defensive match, N/A fallback).
- **External data / Industry benchmarks**: no tool call. Say so; never invent, estimate or reuse illustrative figures. If the user supplies their own figures with a cited source, that becomes user-authored content in the same document, clearly separated from Xero data, never charted as if it came from Xero.

## Data facts (why these choices)

- `get_profit_and_loss` / `get_balance_sheet` accept `periods` (integer) + `timeframe` (`MONTH`|`QUARTER`|`YEAR`) and return one multi-column report ending at `toDate` — this is the trend mechanism, and it needs only one binding per report, unlike `get_bank_summary` which explicitly has none.
- `list_invoices` has no page-size or date-range param beyond `page`; the Accounts mode composition is capped to the first 100 open items per side (page 1, `order: DueDate ASC`, static). This is disclosed, not silently truncated — unlike a date-windowed report (see `xero-activity-statement`), an "open items" snapshot doesn't collapse to zero when capped, so a single static page is a defensible, kit-compatible design here.

## Discovery call

Call `get_organisation`, `list_connections`, `get_profit_and_loss` (`toDate` = today, `periods` = 6, `timeframe` = MONTH, `standardLayout` = true), `get_balance_sheet` (same `periods`/`timeframe`), `get_bank_summary` (`fromDate`/`toDate` = the trend window), `get_executive_summary` (`date` = today), and one `list_invoices` call each for `Type=="ACCREC"` and `Type=="ACCPAY"` (`statuses: AUTHORISED`). An error on any one binding does not block the other modes — each mode's checks are scoped to the bindings it actually uses.

## Date defaults

`to_date` = end of the window (default `"today"`). `periods` = trend length in months (default 6; offered as 3 / 6 / 12 via the Trend length control). `from_date` is derived by the kit as `periods − 1` months before `to_date`'s month start — leave its default.

## Members

| Member / view | How |
|---|---|
| Profitability / Cash / Accounts / KPIs | Report = the mode picker |
| External data / Industry benchmarks | Report = the mode picker; renders a no-data state with a way for the user to add their own cited figures |
| Trend length | Trend length control (3 / 6 / 12 months) |
| Another organisation | Organisation picker |
| Series toggles, tabs | Client-side over already-hydrated data — no extra bindings |

## Validation checks (shown in the banner)

- Profitability: every section total = Σ its account rows; the trend's Net Profit line = the running Σ of its own sections (recomputed per column, not re-displayed)
- Cash: bank summary's own totals = Σ its per-account rows; the Balance Sheet Bank-section trend loaded
- Accounts: Accounts Receivable / Accounts Payable balances loaded from the Balance Sheet; open-items coverage stated as "first 100 open items — see Sources & limitations" whenever a side returns exactly 100 rows
- KPIs: **independent tie** — Gross margin and Net margin recomputed from Profit and Loss vs the same ratios on Xero's own Executive Summary (a separate Xero report)
- External data / Industry benchmarks: no check — an information line states there is no connector data source

## Save as

`fileName`: `xero-visualise.html` · `tags`: ["xero","visualise","charts","dashboard"]

## QA test script (procedure only — no live access to run this)

1. On a QA organisation, open each of the six modes in turn; confirm Profitability, Cash, Accounts and KPIs render real charts from the discovery data, and External data / Industry benchmarks render the no-data state with no chart at all.
2. Cross-check the Profitability trend's most recent column against `xero-profit-and-loss` for the same month; cross-check the Cash mode's current-range KPI cards against Xero → Reporting → Cash Summary (or the Bank Summary report) for the same range.
3. Cross-check Accounts mode's Accounts Receivable / Accounts Payable figures against Xero → Reporting → Balance Sheet for the same date.
4. Force the Accounts open-items coverage check: use an organisation/side with more than 100 open items and confirm the "first 100" note appears rather than a silently partial composition chart.
5. Change Trend length (3 / 6 / 12) and confirm every mode's chart re-renders with the new window; switch organisation (LIB-002) and confirm every mode's figures, header and exports carry only that organisation's data.
6. Download PDF and Download Excel from at least two modes; confirm the Excel file's sheet matches the active mode and still carries Validation and Parameters sheets.
7. Toggle Branding and the dark theme; switch View as to Client, then Bookkeeper.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "today"
    },
    {
      "name": "from_date",
      "label": "Trend start (derived)",
      "type": "date",
      "default": "2026-04-01"
    },
    {
      "name": "periods",
      "label": "Trend length (months)",
      "type": "number",
      "default": 6,
      "min": 3,
      "max": 12
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"profitability\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl_trend",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "toDate": {
          "kind": "input",
          "input": "to_date"
        },
        "periods": {
          "kind": "input",
          "input": "periods"
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
          "input": "to_date"
        },
        "periods": {
          "kind": "input",
          "input": "periods"
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
      "id": "bank_summary",
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
      "id": "exec_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_executive_summary"
      },
      "params": {
        "date": {
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
      "id": "open_receivables",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCREC\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "open_payables",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCPAY\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
        },
        "page": {
          "kind": "static",
          "value": 1
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
  title: 'Visualise', primary: 'pnl_trend', dated: ['pnl_trend'], org: 'org', conns: 'connections',
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { to_date: '2026-09-25', from_date: '2026-04-01', periods: 6, org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"custom","c":"none","v":"profitability"}' },
  uses: { pnl_trend: ['to_date', 'periods', 'org'], bs_trend: ['to_date', 'periods', 'org'], bank_summary: ['from_date', 'to_date', 'org'], exec_summary: ['to_date', 'org'], open_receivables: ['org'], open_payables: ['org'], org: ['org'], connections: [] },
  tools: { pnl_trend: 'get_profit_and_loss (trend)', bs_trend: 'get_balance_sheet (trend)', bank_summary: 'get_bank_summary (current range)', exec_summary: 'get_executive_summary', open_receivables: 'list_invoices (open ACCREC, page 1)', open_payables: 'list_invoices (open ACCPAY, page 1)', org: 'get_organisation', connections: 'list_connections' },
  views: [['profitability', 'Profitability'], ['cash', 'Cash'], ['accounts', 'Accounts'], ['kpis', 'KPIs'], ['external', 'External data'], ['benchmarks', 'Industry benchmarks']],
  enums: [{ label: 'Trend length', input: 'periods', options: [['3', '3 months'], ['6', '6 months'], ['12', '12 months']] }],
  derive: function (inp) {
    var d = XK.parse(inp.to_date), n = Math.max(1, Number(inp.periods) || 6) - 1;
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1 - n;
    while (m <= 0) { m += 12; y -= 1; }
    return { from_date: y + '-' + String(m).padStart(2, '0') + '-01' };
  },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, view = c.view || 'profitability';

    function sumSections(w, re) { var found = false, total = 0; w.sections.forEach(function (s) { if (re.test(s.title)) { found = true; total += XK.sectionTotal(s); } }); return found ? Math.round(total * 100) / 100 : null; }
    function bankSeries(w) {
      var sec = w.sections.filter(function (s) { return /^bank$/i.test(s.title); })[0]; if (!sec) return null;
      var n = w.columns.length, out = []; for (var i = 0; i < n; i++) out.push(XK.sum(sec.rows.map(function (l) { return l.values[i]; })));
      return out;
    }
    function execPct(we, re) {
      if (!we) return null; var l = XK.find(we.lines, null, re, 'row') || XK.find(we.lines, null, re, 'total'); if (!l) return null;
      var raw = (l.values || [])[0]; if (raw == null) return null; var n = Number(String(raw).replace(/[%,]/g, '')); return isFinite(n) ? (Math.abs(n) > 1 ? n / 100 : n) : null;
    }
    function execDays(we, re) { if (!we) return null; var l = XK.find(we.lines, null, re, 'row') || XK.find(we.lines, null, re, 'total'); return l ? XK.num((l.values || [])[0]) : null; }

    if (view === 'external' || view === 'benchmarks') {
      var label = view === 'external' ? 'External data' : 'Industry benchmarks';
      body.innerHTML = '<div class="xk-banner na"><strong>' + XK.h(label) + ': no data source.</strong> The xero-accounting connector has no ' + (view === 'external' ? 'external-data' : 'industry-benchmark') + ' tool. Nothing is charted here from Xero. If you have your own figures with a cited source, add them to this document yourself — never as if Xero returned them.</div>';
      return { checks: [{ name: label + ' (information)', pass: null, info: true, detail: 'No connector endpoint — nothing plotted' }], na: [label + ' (no data source on this connector)'], title: 'Visualise — ' + label };
    }

    if (view === 'profitability') {
      if (c.errors.pnl_trend) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl_trend')) + '</p>'; return { checks: [{ name: 'Profitability trend loaded', pass: false, detail: c.err('pnl_trend') }] }; }
      if (!c.data.pnl_trend) return {};
      var w = XK.walk(c.data.pnl_trend);
      var inc = XK.find(w.lines, null, /^(trading )?income$|^revenue$|^sales$/i, 'total'), gp = XK.find(w.lines, null, /^gross profit$/i, 'total'), np = XK.find(w.lines, null, /^net (profit|loss)$/i, 'total');
      var last = w.columns.length - 1, incL = inc ? inc.values[last] : null, gpL = gp ? gp.values[last] : null, npL = np ? np.values[last] : null;
      body.innerHTML = XK.kpis([{ label: 'Trading Income (latest month)', value: incL }, { label: 'Gross Profit (latest month)', value: gpL }, { label: 'Net Profit (latest month)', value: npL },
        { label: 'Net margin (latest month)', text: incL ? XK.pct(npL / incL) : 'N/A' }], c) +
        '<div class="xk-card"><h3>Trend — Trading Income, Gross Profit, Net Profit</h3><div id="viz-pnl"></div></div>';
      XK.line(document.getElementById('viz-pnl'), { title: 'Profitability trend', labels: w.columns, series: [inc, gp, np].filter(Boolean).map(function (l, i) { return { name: l.label, values: l.values }; }) }, c);
      var ties = XK.linesTies(w.lines), run = XK.runningTies(w);
      this._sheet = XK.sheetFromLines('Profitability trend', c.company, XK.rangeLabel(c.inputs.from_date, c.inputs.to_date), [''].concat(w.columns), w.lines, XK.footerStamp('Accrual', c.fetchedAt, c.currency));
      return { checks: [
        { name: 'Every section total = Σ its account rows (each month)', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
        { name: 'Net Profit = running Σ of its own sections (each month)', pass: run.checked ? run.failed.length === 0 : null, detail: run.failed.length ? run.failed.join('; ') : run.checked + ' line(s)' }
      ], na: [], title: 'Visualise — Profitability' };
    }

    if (view === 'cash') {
      if (c.errors.bank_summary && c.errors.bs_trend) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('bank_summary')) + '</p>'; return { checks: [{ name: 'Cash data loaded', pass: false, detail: c.err('bank_summary') }] }; }
      var wbank = c.data.bank_summary ? XK.walk(c.data.bank_summary) : null, wbs = c.data.bs_trend ? XK.walk(c.data.bs_trend) : null;
      var accounts = wbank ? wbank.lines.filter(function (l) { return l.kind === 'row'; }) : [];
      var cols = wbank ? wbank.columns : [];
      var idxOf = function (re) { var i = -1; cols.forEach(function (t, j) { if (re.test(t)) i = j; }); return i; };
      var iOpen = idxOf(/open/i), iRecv = idxOf(/received/i), iSpent = idxOf(/spent/i), iClose = idxOf(/clos/i);
      var totalOf = function (i) { return i < 0 ? null : XK.sum(accounts.map(function (l) { return l.values[i]; })); };
      var openBal = totalOf(iOpen), recv = totalOf(iRecv), spent = totalOf(iSpent), closeBal = totalOf(iClose);
      var series = wbs ? bankSeries(wbs) : null;
      body.innerHTML = XK.kpis([{ label: 'Opening balance', value: openBal }, { label: 'Cash received', value: recv }, { label: 'Cash spent', value: spent }, { label: 'Closing balance', value: closeBal }], c) +
        (accounts.length ? '<div class="xk-scroll">' + XK.statement(accounts, [''].concat(cols), c) + '</div>' : '<p class="muted">No bank accounts returned for this range.</p>') +
        '<div class="xk-card" style="margin-top:16px"><h3>Bank balance trend (Balance Sheet)</h3><div id="viz-bank"></div></div>';
      if (series && wbs) XK.line(document.getElementById('viz-bank'), { title: 'Bank balance trend', labels: wbs.columns, series: [{ name: 'Bank balance', values: series }] }, c);
      else document.getElementById('viz-bank') && (document.getElementById('viz-bank').innerHTML = '<p class="muted">Data appears once it\'s available.</p>');
      var checkClose = openBal != null && recv != null && spent != null && closeBal != null ? XK.near(closeBal, openBal + recv - spent) : null;
      return { checks: [
        { name: 'Closing balance = Opening + Cash received − Cash spent (Σ across bank accounts)', pass: checkClose, detail: checkClose == null ? 'Bank Summary did not return one of these columns' : money(openBal) + ' + ' + money(recv) + ' − ' + money(spent) + ' = ' + money(closeBal) },
        { name: 'Balance Sheet Bank-section trend loaded', pass: c.errors.bs_trend ? false : series ? true : null, detail: c.errors.bs_trend ? c.err('bs_trend') : series ? (wbs.columns.length + ' month(s)') : 'No Bank section on the Balance Sheet' }
      ], na: [], title: 'Visualise — Cash' };
    }

    if (view === 'accounts') {
      if (c.errors.bs_trend) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('bs_trend')) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err('bs_trend') }] }; }
      if (!c.data.bs_trend) return {};
      var wa = XK.walk(c.data.bs_trend), lastCol = wa.columns.length - 1;
      var ar = XK.find(wa.lines, null, /^accounts receivable$/i, 'row'), ap = XK.find(wa.lines, null, /^accounts payable$/i, 'row');
      var arV = ar ? ar.values[lastCol] : null, apV = ap ? ap.values[lastCol] : null;
      var recvRows = (c.data.open_receivables && !c.errors.open_receivables && c.data.open_receivables.Invoices) || [];
      var payRows = (c.data.open_payables && !c.errors.open_payables && c.data.open_payables.Invoices) || [];
      function bucket(rows) {
        var b = { 'Not yet due': 0, '1–30 days overdue': 0, '31–60 days overdue': 0, '61–90 days overdue': 0, '90+ days overdue': 0 };
        rows.forEach(function (r) {
          var due = r.DueDateString ? String(r.DueDateString).slice(0, 10) : XK.isoDate(r.DueDate), amt = XK.num(r.AmountDue) || 0;
          if (!due) return;
          var days = Math.round((XK.parse(c.inputs.to_date) - XK.parse(due)) / 86400000);
          var k = days <= 0 ? 'Not yet due' : days <= 30 ? '1–30 days overdue' : days <= 60 ? '31–60 days overdue' : days <= 90 ? '61–90 days overdue' : '90+ days overdue';
          b[k] += amt;
        });
        return b;
      }
      var arB = bucket(recvRows), apB = bucket(payRows);
      body.innerHTML = XK.kpis([{ label: 'Accounts Receivable', value: arV }, { label: 'Accounts Payable', value: apV }], c) +
        '<div class="xk-grid2"><div class="xk-card"><h3>Receivables composition (open items)</h3><div id="viz-ar"></div></div><div class="xk-card"><h3>Payables composition (open items)</h3><div id="viz-ap"></div></div></div>';
      XK.donut(document.getElementById('viz-ar'), { title: 'Receivables composition', items: Object.keys(arB).map(function (k) { return { label: k, value: arB[k] }; }) }, c);
      XK.donut(document.getElementById('viz-ap'), { title: 'Payables composition', items: Object.keys(apB).map(function (k) { return { label: k, value: apB[k] }; }) }, c);
      var checks = [
        { name: 'Accounts Receivable loaded from the Balance Sheet', pass: arV == null ? null : true, detail: arV == null ? 'No Accounts Receivable row on this layout' : money(arV) },
        { name: 'Accounts Payable loaded from the Balance Sheet', pass: apV == null ? null : true, detail: apV == null ? 'No Accounts Payable row on this layout' : money(apV) }
      ];
      if (recvRows.length === 100) checks.push({ name: 'Receivables composition coverage', pass: null, detail: 'First 100 open items only (page 1) — composition may be incomplete if more are open' });
      if (payRows.length === 100) checks.push({ name: 'Payables composition coverage', pass: null, detail: 'First 100 open items only (page 1) — composition may be incomplete if more are open' });
      return { checks: checks, na: [], title: 'Visualise — Accounts' };
    }

    if (view === 'kpis') {
      if (c.errors.pnl_trend || c.errors.bs_trend) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl_trend') || c.err('bs_trend')) + '</p>'; return { checks: [{ name: 'Profit and Loss / Balance Sheet loaded', pass: false, detail: c.err('pnl_trend') || c.err('bs_trend') }] }; }
      if (!c.data.pnl_trend || !c.data.bs_trend) return {};
      var wk = XK.walk(c.data.pnl_trend), wbk = XK.walk(c.data.bs_trend), we = c.data.exec_summary && !c.errors.exec_summary ? XK.walk(c.data.exec_summary) : null;
      var lastK = wk.columns.length - 1, lastBk = wbk.columns.length - 1;
      var incLine = XK.find(wk.lines, null, /^(trading )?income$|^revenue$|^sales$/i, 'total'), gpLine = XK.find(wk.lines, null, /^gross profit$/i, 'total'), npLine = XK.find(wk.lines, null, /^net (profit|loss)$/i, 'total');
      var incV = incLine ? incLine.values[lastK] : null, gpV = gpLine ? gpLine.values[lastK] : null, npV = npLine ? npLine.values[lastK] : null;
      var grossMargin = incV ? gpV / incV : null, netMargin = incV ? npV / incV : null;
      var bank = sumSections(wbk, /^bank$/i), curA = sumSections(wbk, /^current assets$/i), curL = sumSections(wbk, /^current liabilities$/i);
      var caTotal = bank == null && curA == null ? null : (bank || 0) + (curA || 0);
      var currentRatio = curL && curL > 0 ? caTotal / curL : null;
      var debtorDays = execDays(we, /debtor days/i), creditorDays = execDays(we, /creditor days/i);
      var execGross = execPct(we, /gross profit margin/i), execNet = execPct(we, /net profit margin/i);
      body.innerHTML = XK.kpis([{ label: 'Gross margin', text: grossMargin == null ? 'N/A' : XK.pct(grossMargin) }, { label: 'Net margin', text: netMargin == null ? 'N/A' : XK.pct(netMargin) },
        { label: 'Current ratio', text: currentRatio == null ? 'N/A' : currentRatio.toFixed(2) + ':1' }, { label: 'Debtor days', text: debtorDays == null ? 'N/A' : Math.round(debtorDays) + ' d' },
        { label: 'Creditor days', text: creditorDays == null ? 'N/A' : Math.round(creditorDays) + ' d' }], c) +
        '<p class="xk-src"><i></i>Gross margin = Gross Profit ÷ Trading Income · Net margin = Net Profit ÷ Trading Income · Current ratio = (Bank + Current Assets) ÷ Current Liabilities · Debtor/Creditor days = Xero Executive Summary</p>';
      var checks = [
        execGross != null ? { name: 'Independent tie: Gross margin vs Xero Executive Summary', pass: grossMargin == null ? null : XK.near(grossMargin, execGross, 0.01), detail: XK.pct(grossMargin) + ' vs ' + XK.pct(execGross) }
          : { name: 'Independent tie: Gross margin vs Xero Executive Summary (information)', pass: null, info: true, detail: 'Executive Summary unavailable or did not return a matching row' },
        execNet != null ? { name: 'Independent tie: Net margin vs Xero Executive Summary', pass: netMargin == null ? null : XK.near(netMargin, execNet, 0.01), detail: XK.pct(netMargin) + ' vs ' + XK.pct(execNet) }
          : { name: 'Independent tie: Net margin vs Xero Executive Summary (information)', pass: null, info: true, detail: 'Executive Summary unavailable or did not return a matching row' }
      ];
      return { checks: checks, na: [], title: 'Visualise — KPIs' };
    }
    return {};
  },
  excel: function (c) {
    return this._sheet ? [this._sheet] : [{ name: 'Visualise', rows: [['This mode\'s export is view-only in this version — switch to Profitability to export the trend sheet, or use Download PDF for a print snapshot of any mode.']] }];
  }
});
```

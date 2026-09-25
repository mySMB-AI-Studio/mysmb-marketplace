---
name: quickbooks-performance-centre
description: QuickBooks Online Performance centre (KPI charts) (Q06) as a live, validated report in QuickBooks styling. Use when the user asks for the performance centre, KPI charts, revenue / expenses / gross profit / net profit over time, current ratio, quick ratio, or a KPI dashboard.
---

# Performance centre (KPI charts) (Q06)

Use when the user asks for the performance centre, KPI charts, revenue / expenses / gross profit / net profit over time, current ratio, quick ratio, or a KPI dashboard. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `get_report_balance_sheet`, `get_report_cash_flow`, `get_report_aged_receivables`, `get_report_aged_payables`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Performance centre. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q06. Delivery: Wave 1.

## Discovery call

`get_report_profit_and_loss`, `get_report_balance_sheet` and `get_report_cash_flow`, each with `summarize_column_by` = Month; ageing reports.

## Date defaults

Preset `this_fy_td`; compare dates one year earlier.

## Members

| Member / view | How |
|---|---|
| Expenses / Revenue / Gross profit / Net profit over time | Built, with Compare to |
| Cash flow | Net cash flow by month |
| A/R and A/P by ageing periods | Built on QuickBooks' 30-day bands |
| Current ratio / Quick ratio by time | Built with a 1.00 target line |
| Revenue / expense targets | N/A — needs a budget (Budgets family, Wave 2) |
| Quick-add charts and custom chart builder | N/A in this version |

## Validation checks (STEP 4 — shown in the banner)

- Chart totals = underlying P&L totals (Σ months = Total column)
- Net cash flow chart = Statement of Cash Flows total
- Current ratio = current assets ÷ current liabilities (latest month)
- A/R and A/P ageing bands sum to their totals

## Save as

`fileName`: `quickbooks-performance-centre.html` · `tags`: ["quickbooks","kpi","dashboard"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): This year to date: Total expenses A$1,628,002.07 · Total revenue A$110,333.35 · Gross profit −A$18,498.38 · Net profit −A$1,637,546.28 · Net cash flow A$20,292.19 · A/R A$39,105.00 · A/P A$265,179.79 · Current ratio 1.00 · Quick ratio 1.00.
3. Compare the layout with the Q06 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "compare_start",
      "label": "Compare from",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "compare_end",
      "label": "Compare to",
      "type": "date",
      "default": "2025-09-25"
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl_monthly",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
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
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Month"
        }
      }
    },
    {
      "id": "pnl_compare",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
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
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Month"
        }
      }
    },
    {
      "id": "bs_monthly",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
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
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Month"
        }
      }
    },
    {
      "id": "cash_flow_monthly",
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
          "kind": "static",
          "value": "Month"
        }
      }
    },
    {
      "id": "aged_receivables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_receivables"
      },
      "params": {}
    },
    {
      "id": "aged_payables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_payables"
      },
      "params": {}
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
  title: 'Performance centre', token: null, primary: 'pnl_monthly', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', cmpStart: 'compare_start', cmpEnd: 'compare_end', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', compare_start: '2025-07-01', compare_end: '2025-09-25', persona: 'Executive',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","x":""}' },
  uses: { pnl_monthly: ['start_date', 'end_date', 'basis'], pnl_compare: ['compare_start', 'compare_end', 'basis'], bs_monthly: ['start_date', 'end_date', 'basis'], cash_flow_monthly: ['start_date', 'end_date'], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { pnl_monthly: 'get_report_profit_and_loss (by month)', pnl_compare: 'get_report_profit_and_loss (comparison, by month)', bs_monthly: 'get_report_balance_sheet (month ends)', cash_flow_monthly: 'get_report_cash_flow (by month)', aged_receivables: 'get_report_aged_receivables', aged_payables: 'get_report_aged_payables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  compare: true,
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, cmpOn = c.compareMode !== 'none';
    if (c.errors.pnl_monthly) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl_monthly')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl_monthly') }] }; }
    if (!c.data.pnl_monthly) return {};
    function monthly(rep) { // {labels, idx, totalIdx, lines}
      if (!rep) return null; var cols = QB.cols(rep), mc = cols.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), tc = cols.slice(1).filter(function (x) { return /^total$/i.test(x.title); })[0];
      return { labels: mc.map(function (x) { return x.title; }), idx: mc.map(function (x) { return x.i - 1; }), t: tc ? tc.i - 1 : null, lines: QB.walk(rep) };
    }
    var P = monthly(c.data.pnl_monthly), PC = cmpOn ? monthly(c.data.pnl_compare) : null, B = monthly(c.data.bs_monthly), CF = monthly(c.data.cash_flow_monthly);
    var ser = function (M, g, re) { if (!M) return []; var l = QB.find(M.lines, g, re); return M.idx.map(function (i) { return l ? l.values[i] : null; }); };
    var tot = function (M, g) { if (!M) return null; var l = QB.find(M.lines, g); return l ? (M.t != null ? l.values[M.t] : QB.sum(M.idx.map(function (i) { return l.values[i]; }))) : null; };
    var expS = ser(P, 'Expenses'), revS = ser(P, 'Income'), gpS = ser(P, 'GrossProfit'), npS = ser(P, 'NetIncome');
    var ca = ser(B, 'CurrentAssets'), cl = ser(B, 'CurrentLiabilities'), bank = ser(B, 'BankAccounts'), arB = ser(B, 'AR');
    var cr = ca.map(function (v, i) { return v != null && cl[i] ? Math.round((v / cl[i]) * 100) / 100 : null; }), qr = ca.map(function (v, i) { return cl[i] ? Math.round((((bank[i] || 0) + (arB[i] || 0)) / cl[i]) * 100) / 100 : null; });
    function aged(id) { var rep = c.data[id]; if (!rep) return null; var cols = QB.cols(rep), ls = QB.walk(rep), gt = QB.find(ls, 'GrandTotal', /^total$/i); return { bands: cols.slice(1, cols.length - 1).map(function (x) { return x.title; }), tot: gt ? gt.values : [], rows: ls.filter(function (l) { return l.kind === 'row'; }) }; }
    var ar = aged('aged_receivables'), ap = aged('aged_payables');
    var card = function (id, title, kpi) { return '<div class="qb-card"><h3>' + QB.h(title) + '</h3><div class="qb-kpi" style="border:0;padding:0"><div class="val">' + kpi + '</div></div><div id="' + id + '"></div></div>'; };
    var cfNet = tot(CF, 'CashIncrease'), lastCR = cr.length ? cr[cr.length - 1] : null, lastQR = qr.length ? qr[qr.length - 1] : null;
    body.innerHTML = '<div class="qb-grid2">' + card('c1', 'Expenses over time', money(tot(P, 'Expenses'))) + card('c2', 'Revenue over time', money(tot(P, 'Income'))) + card('c3', 'Gross profit over time', money(tot(P, 'GrossProfit'))) + card('c4', 'Net profit over time', money(tot(P, 'NetIncome'))) +
      card('c5', 'Cash flow', money(cfNet)) + card('c6', 'A/R by ageing periods', money(ar && ar.tot.length ? ar.tot[ar.tot.length - 1] : null)) + card('c7', 'A/P by ageing periods', money(ap && ap.tot.length ? ap.tot[ap.tot.length - 1] : null)) +
      card('c8', 'Current ratio by time', lastCR == null ? 'N/A — not in source' : lastCR.toFixed(2)) + card('c9', 'Quick ratio by time', lastQR == null ? 'N/A — not in source' : lastQR.toFixed(2)) + '</div>';
    var L = P.labels, cmpSer = function (g) { return cmpOn && PC ? [{ name: 'Comparison', values: ser(PC, g).slice(0, L.length) }] : []; };
    QB.line(document.getElementById('c1'), { title: 'Expenses over time', labels: L, series: [{ name: 'Expenses', values: expS }].concat(cmpSer('Expenses')) }, c);
    QB.line(document.getElementById('c2'), { title: 'Revenue over time', labels: L, series: [{ name: 'Revenue', values: revS }].concat(cmpSer('Income')) }, c);
    QB.bars(document.getElementById('c3'), { title: 'Gross profit over time', labels: L, series: [{ name: 'Gross profit', values: gpS }].concat(cmpSer('GrossProfit')) }, c);
    QB.bars(document.getElementById('c4'), { title: 'Net profit over time', labels: L, series: [{ name: 'Net profit', values: npS }].concat(cmpSer('NetIncome')) }, c);
    if (c.errors.cash_flow_monthly) document.getElementById('c5').innerHTML = '<p class="qb-err">' + QB.h(c.err('cash_flow_monthly')) + '</p>'; else QB.bars(document.getElementById('c5'), { title: 'Net cash flow', labels: CF ? CF.labels : [], series: [{ name: 'Net cash flow', values: ser(CF, 'CashIncrease') }] }, c);
    [['c6', ar, 'aged_receivables'], ['c7', ap, 'aged_payables']].forEach(function (x) { var el = document.getElementById(x[0]); if (c.errors[x[2]]) { el.innerHTML = '<p class="qb-err">' + QB.h(c.err(x[2])) + '</p>'; return; } if (x[1]) QB.bars(el, { title: 'Ageing periods', labels: x[1].bands, series: [{ name: 'Balance', values: x[1].tot.slice(0, x[1].bands.length) }] }, c); });
    var fmtRatio = Object.assign({}, c.display);
    QB.line(document.getElementById('c8'), { title: 'Current ratio', labels: B ? B.labels : [], series: [{ name: 'Current ratio', values: cr }, { name: 'Target 1.00', values: cr.map(function () { return 1; }) }] }, { currency: '', display: Object.assign(fmtRatio, { cents: 1 }) });
    QB.line(document.getElementById('c9'), { title: 'Quick ratio', labels: B ? B.labels : [], series: [{ name: 'Quick ratio', values: qr }, { name: 'Target 1.00', values: qr.map(function () { return 1; }) }] }, { currency: '', display: fmtRatio });
    var sumOk = function (M, g) { if (!M || M.t == null) return null; var l = QB.find(M.lines, g); return l ? QB.near(l.values[M.t], QB.sum(M.idx.map(function (i) { return l.values[i]; })), 0.05) : null; };
    var agedOk = function (a) { return a && a.tot.length ? QB.near(a.tot[a.tot.length - 1], QB.sum(a.tot.slice(0, a.bands.length))) : null; };
    var checks = [
      { name: 'Chart totals = underlying P&L totals (Σ months = Total column)', pass: [sumOk(P, 'Income'), sumOk(P, 'Expenses'), sumOk(P, 'GrossProfit'), sumOk(P, 'NetIncome')].every(function (x) { return x !== false; }) ? (sumOk(P, 'Income') == null ? null : true) : false, detail: 'Revenue ' + money(tot(P, 'Income')) + ', net profit ' + money(tot(P, 'NetIncome')) },
      { name: 'Net cash flow chart = Statement of Cash Flows total', pass: sumOk(CF, 'CashIncrease'), detail: money(cfNet) },
      { name: 'Current ratio = current assets ÷ current liabilities (latest month)', pass: lastCR == null ? null : QB.near(lastCR, Math.round((ca[ca.length - 1] / cl[cl.length - 1]) * 100) / 100), detail: lastCR == null ? (c.errors.bs_monthly ? c.err('bs_monthly') : '') : lastCR.toFixed(2) },
      { name: 'A/R and A/P ageing bands sum to their totals', pass: agedOk(ar) === false || agedOk(ap) === false ? false : agedOk(ar) == null && agedOk(ap) == null ? null : true, detail: '' }];
    this._x = { P: P, B: B, CF: CF, cr: cr, qr: qr, ser: ser, expS: expS, revS: revS, gpS: gpS, npS: npS };
    return { checks: checks, notes: ['Quick ratio = (bank + accounts receivable) ÷ current liabilities.', 'A/R and A/P charts use QuickBooks\' 30-day ageing bands (the Performance centre\'s 7-day bands are not exposed by the Accounting API).'],
      na: ['Revenue and expense targets (need a budget — Budgets family, Wave 2)', 'Quick-add and custom chart builder (the charts above are the Performance centre set)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Performance centre', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], [{ v: 'Month', s: 'bold' }, { v: 'Revenue', s: 'bold' }, { v: 'Expenses', s: 'bold' }, { v: 'Gross profit', s: 'bold' }, { v: 'Net profit', s: 'bold' }, { v: 'Current ratio', s: 'bold' }, { v: 'Quick ratio', s: 'bold' }]];
    x.P.labels.forEach(function (lb, i) { rows.push([lb, { v: x.revS[i], s: 'money' }, { v: x.expS[i], s: 'money' }, { v: x.gpS[i], s: 'money' }, { v: x.npS[i], s: 'money' }, x.cr[i] == null ? null : { v: x.cr[i], s: 'none' }, x.qr[i] == null ? null : { v: x.qr[i], s: 'none' }]); });
    return [{ name: 'Performance centre', rows: rows, widths: [14, 16, 16, 16, 16, 14, 14] }];
  }
});
```

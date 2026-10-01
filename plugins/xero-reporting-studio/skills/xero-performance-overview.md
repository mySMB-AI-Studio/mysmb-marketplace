---
name: xero-performance-overview
description: Build a live, validated Xero Analytics Performance overview (P11) on the tested report kit — 12 months vs the prior 12: net profit, income, expenses, net and gross margins, operating expenses breakdown, bank balances, debtors and creditors days, each with a monthly chart and an insight line. Use for "performance overview", "how are we performing", "rolling 12 months", "margins", "debtor days".
---
# Performance overview (P11)

Use when the user asks for a performance overview, rolling 12-month performance, margins, debtor or creditor days, or how the business is performing. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_profit_and_loss`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Dashboards → Performance overview. Library: Xero Reports Prompt Library v1.2 → Prompts → P11. Delivery: Wave 1 (delivery order 8).

## Discovery call

Call `get_organisation` and `list_connections` once, and `get_profit_and_loss` once with `fromDate` / `toDate` = last month and `periods` = 11, `timeframe` = `MONTH`, `standardLayout` = `true` — expect 12 monthly columns (newest first). An error is a failed call: report its message.

## Date defaults

`end_date` = the last day of the latest month (default: end of last month; display preset `a` = `end_last_month`, `end_this_month`, `end_last_quarter`, `end_last_fy` or `custom`). The other date inputs are derived by the kit — leave their defaults.

## Members

| Member / view | How |
|---|---|
| Performance overview | Nine widgets, 3 columns: Net profit or loss, Total income, Total expenses, Net profit margin, Gross profit margin, Operating expenses breakdown, Bank accounts balance, Debtors days, Creditors days |
| Another end month | Month ending control |

## Validation checks (shown in the banner)

- Xero returned 12 monthly columns (current and prior year)
- **Independent tie:** Σ monthly net profit, income and expenses = the 12-month Profit and Loss (a separate report)
- Margins = profit ÷ income (formula stated)
- Debtors days = AR ÷ 12-month income × 365; creditors days = AP ÷ 12-month expenses × 365
- Balance Sheet balances

## Save as

`fileName`: `xero-performance-overview.html` · `tags`: ["xero","performance-overview","P11","analytics"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Hammerjack Pty Limited, 12 months Sep 2025–Aug 2026: Net profit 4,648,499 vs 546,645 (up 750.37%) · Income 24,194,793 vs 21,407,671 (up 13.02%) · Expenses 19,546,294 vs 20,861,026 (down 6.30%) · NP margin 19% vs 3% · GP margin 25% vs 9% · Bank balances 3,936,863 · Debtor days 22 vs 11 · Creditor days 97 vs 19. On Irvine Jackson Pty Ltd in QA, every check passes.
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
      "name": "end_date",
      "label": "Month ending",
      "type": "date",
      "default": "2026-08-31"
    },
    {
      "name": "m_start",
      "label": "Month start",
      "type": "date",
      "default": "2026-08-01"
    },
    {
      "name": "prior_end",
      "label": "Prior year month ending",
      "type": "date",
      "default": "2025-08-31"
    },
    {
      "name": "prior_m_start",
      "label": "Prior year month start",
      "type": "date",
      "default": "2025-08-01"
    },
    {
      "name": "window_start",
      "label": "12 months from",
      "type": "date",
      "default": "2025-09-01"
    },
    {
      "name": "org",
      "label": "Organisation",
      "type": "string",
      "maxLength": 64,
      "default": ""
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":0,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"end_last_month\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl_12",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "m_start"
        },
        "toDate": {
          "kind": "input",
          "input": "end_date"
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
      "id": "pnl_p12",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "prior_m_start"
        },
        "toDate": {
          "kind": "input",
          "input": "prior_end"
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
      "id": "pnl_total",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "window_start"
        },
        "toDate": {
          "kind": "input",
          "input": "end_date"
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
      "id": "bs",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "end_date"
        },
        "periods": {
          "kind": "static",
          "value": 1
        },
        "timeframe": {
          "kind": "static",
          "value": "YEAR"
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
  title: 'Performance overview', primary: 'pnl_12', dated: ['bs'], org: 'org', conns: 'connections',
  inputs: { asAt: 'end_date', org: 'org', display: 'display' },
  defaults: { end_date: '2026-08-31', m_start: '2026-08-01', prior_end: '2025-08-31', prior_m_start: '2025-08-01', window_start: '2025-09-01', org: '',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_last_month","c":"none","v":""}' },
  uses: { pnl_12: ['m_start', 'end_date', 'org'], pnl_p12: ['prior_m_start', 'prior_end', 'org'], pnl_total: ['window_start', 'end_date', 'org'], bs: ['end_date', 'org'], org: ['org'], connections: [] },
  tools: { pnl_12: 'get_profit_and_loss (12 monthly columns: periods 11, MONTH)', pnl_p12: 'get_profit_and_loss (the prior 12 months)', pnl_total: 'get_profit_and_loss (the 12 months as one total — tie)', bs: 'get_balance_sheet (end of the month and a year earlier)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_last_month', 'End of last month'], ['end_this_month', 'End of this month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']],
  derive: function (inp) {
    var e = inp.end_date, back = function (s, k) { var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1 - k, 1)), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, last = XK.eom(y, m).getUTCDate(), eomIn = +p[2] === XK.eom(+p[0], +p[1]).getUTCDate(); return y + '-' + String(m).padStart(2, '0') + '-' + String(eomIn ? last : Math.min(+p[2], last)).padStart(2, '0'); };
    var pe = back(e, 12); return { m_start: e.slice(0, 8) + '01', prior_end: pe, prior_m_start: pe.slice(0, 8) + '01', window_start: back(e, 11).slice(0, 8) + '01' };
  },
  render: function (c) {
    var body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); }, pct = function (v) { return v == null || !isFinite(v) ? 'N/A' : Math.round(v * 100) + '%'; };
    var end = c.inputs.end_date, months = XK.monthsEnding(end, 12), keys = months.map(function (m) { return m.key; });
    var pkeys = XK.monthsEnding(c.inputs.prior_end, 12).map(function (m) { return m.key; });
    if (c.errors.pnl_12) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl_12')) + '</p>'; return { checks: [{ name: 'Monthly Profit and Loss loaded', pass: false, detail: c.err('pnl_12') }] }; }
    if (!c.data.pnl_12) return {};
    var w = XK.walk(c.data.pnl_12), wp = c.data.pnl_p12 ? XK.walk(c.data.pnl_p12) : null, mc = XK.monthCols(w), mcp = wp ? XK.monthCols(wp) : null;
    var series = function (walked, mcols, ks, f) { return ks.map(function (k) { var i = mcols && mcols.idx[k]; return i == null ? null : f(XK.plParts(walked, i)); }); };
    var S = function (f) { return { cur: series(w, mc, keys, f), pri: wp ? series(wp, mcp, pkeys, f) : keys.map(function () { return null; }) }; };
    var tot = function (a) { return a.some(function (v) { return v == null; }) ? null : XK.sum(a); };
    var np = S(function (p) { return p.np; }), inc = S(function (p) { return p.income; }), exp = S(function (p) { return p.expenses; }), gp = S(function (p) { return p.gp == null ? p.trading - p.cos : p.gp; }), trd = S(function (p) { return p.trading; });
    var T = { np: [tot(np.cur), tot(np.pri)], inc: [tot(inc.cur), tot(inc.pri)], exp: [tot(exp.cur), tot(exp.pri)], gp: [tot(gp.cur), tot(gp.pri)], trd: [tot(trd.cur), tot(trd.pri)] };
    var margin = function (a, b) { return a == null || !b ? null : a / b; };
    var M = { npm: [margin(T.np[0], T.inc[0]), margin(T.np[1], T.inc[1])], gpm: [margin(T.gp[0], T.trd[0]), margin(T.gp[1], T.trd[1])] };
    var bsw = c.data.bs ? XK.walk(c.data.bs) : null, b0 = bsw ? XK.bsParts(bsw, 0) : null, b1 = bsw && bsw.columns.length > 1 ? XK.bsParts(bsw, 1) : null;
    var days = function (bal, flow) { return bal == null || !flow ? null : bal / flow * 365; };
    var cogs = function (i) { return exp.cur && T.exp[i] != null ? T.exp[i] : null; };
    var DD = [days(b0 && b0.ar, T.inc[0]), days(b1 && b1.ar, T.inc[1])], CD = [days(b0 && b0.ap, T.exp[0]), days(b1 && b1.ap, T.exp[1])];
    var lbl = function (ks) { return 'Total ' + XK.monthLabel(ks[0]) + ' to ' + XK.monthLabel(ks[11]); };
    var delta = function (a, b) { return a == null || b == null || !b ? null : (a - b) / Math.abs(b); };
    var up = function (dv, goodUp) { if (dv == null) return ''; var good = goodUp ? dv >= 0 : dv <= 0; return '<span class="chip ' + (good ? 'up' : 'down') + '">' + (dv >= 0 ? '▲ ' : '▼ ') + Math.abs(dv * 100).toFixed(2) + '% ' + (dv >= 0 ? 'Up' : 'Down') + '</span>'; };
    var best = function (a) { var bi = -1; a.forEach(function (v, i) { if (v != null && (bi < 0 || v > a[bi])) bi = i; }); return bi; };
    var insight = function (name, cur, pri, arr, isMoney) { var dv = delta(cur, pri), bi = best(arr); return (dv == null ? name + ': no prior-year comparison.' : name + ' is ' + (dv >= 0 ? 'up ' : 'down ') + Math.abs(dv * 100).toFixed(1) + '% on the prior 12 months') + (bi >= 0 && isMoney ? '; the highest month was ' + XK.monthLabel(keys[bi]) + ' (' + money(arr[bi]) + ').' : '.'); };
    var W = [];
    var widget = function (id, title, cur, pri, fmtv, goodUp, ins) { W.push('<div class="xk-card xk-widget"><h3>' + title + '</h3><div class="cur">' + fmtv(cur) + '</div><div class="pri">' + lbl(keys) + '</div><div class="pri">Prior: ' + fmtv(pri) + ' · ' + lbl(pkeys) + '</div>' + up(delta(cur, pri), goodUp) + '<div id="' + id + '"></div><div class="insight">AI insight: ' + XK.h(ins) + '</div></div>'); };
    widget('pf-np', 'Net profit or loss', T.np[0], T.np[1], money, true, insight('Net profit', T.np[0], T.np[1], np.cur, true));
    widget('pf-inc', 'Total income', T.inc[0], T.inc[1], money, true, insight('Income', T.inc[0], T.inc[1], inc.cur, true));
    widget('pf-exp', 'Total expenses', T.exp[0], T.exp[1], money, false, insight('Expenses', T.exp[0], T.exp[1], exp.cur, true));
    widget('pf-npm', 'Net profit margin', M.npm[0], M.npm[1], pct, true, 'Net profit ÷ total income: ' + pct(M.npm[0]) + ' against ' + pct(M.npm[1]) + ' a year earlier.');
    widget('pf-gpm', 'Gross profit margin', M.gpm[0], M.gpm[1], pct, true, 'Gross profit ÷ trading income: ' + pct(M.gpm[0]) + ' against ' + pct(M.gpm[1]) + ' a year earlier.');
    // operating expenses breakdown, latest month
    var li = mc ? mc.idx[keys[11]] : null, opexRows = li == null ? [] : w.lines.filter(function (l) { return l.kind === 'row' && XK.isDeduction(l.group) && !/cost of sales/i.test(l.group); }).map(function (l) { return { label: l.label, value: l.values[li] }; }).filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    W.push('<div class="xk-card xk-widget"><h3>Operating expenses breakdown</h3><div class="pri">' + XK.monthLabel(keys[11]) + '</div><div id="pf-opex"></div><div class="insight">AI insight: ' + XK.h(opexRows.length ? opexRows[0].label + ' is the largest operating expense in ' + XK.monthLabel(keys[11]) + ' (' + money(opexRows[0].value) + ', ' + pct(opexRows[0].value / XK.sum(opexRows.map(function (x) { return x.value; }))) + ').' : 'No operating expenses this month.') + '</div></div>');
    W.push('<div class="xk-card xk-widget"><h3>Bank accounts balance</h3><div class="cur">' + (b0 && b0.bank != null ? money(b0.bank) : 'N/A') + '</div><div class="pri">At ' + XK.asOfLine(end).replace(/^As at /, '') + '</div><div id="pf-bank"></div><div class="insight">AI insight: ' + XK.h(b0 && b1 && b0.bank != null && b1.bank != null ? 'Cash is ' + (b0.bank >= b1.bank ? 'up ' : 'down ') + money(Math.abs(b0.bank - b1.bank)) + ' on a year earlier.' : 'Bank balances from the Balance Sheet.') + '</div></div>');
    widget('pf-dd', 'Debtors days', DD[0], DD[1], function (v) { return v == null ? 'N/A' : Math.round(v) + ' days'; }, false, 'Accounts receivable ÷ income over the 12 months × 365.');
    widget('pf-cd', 'Creditors days', CD[0], CD[1], function (v) { return v == null ? 'N/A' : Math.round(v) + ' days'; }, true, 'Accounts payable ÷ expenses over the 12 months × 365.');
    body.innerHTML = '<p class="muted">Monthly · 12 months ending ' + XK.monthLabel(keys[11]) + ' · compared with the same 12 months a year earlier</p><div class="xk-grid3">' + W.join('') + '</div>';
    var labs = keys.map(function (k) { return XK.monthLabel(k).slice(0, 3); }), two = function (id, a, fmt) { XK.bars(document.getElementById(id), { title: id, labels: labs, fmt: fmt, series: [{ name: 'Current', values: a.cur }, { name: 'Prior year', values: a.pri }] }, c); };
    two('pf-np', np); two('pf-inc', inc); two('pf-exp', exp);
    var ratio = function (a, b) { return a.map(function (v, i) { return v == null || !b[i] ? null : v / b[i] * 100; }); }, pc = function (v) { return Math.round(v) + '%'; };
    XK.line(document.getElementById('pf-npm'), { title: 'Net profit margin', labels: labs, fmt: pc, series: [{ name: 'Current', values: ratio(np.cur, inc.cur) }, { name: 'Prior year', values: ratio(np.pri, inc.pri) }] }, c);
    XK.line(document.getElementById('pf-gpm'), { title: 'Gross profit margin', labels: labs, fmt: pc, series: [{ name: 'Current', values: ratio(gp.cur, trd.cur) }, { name: 'Prior year', values: ratio(gp.pri, trd.pri) }] }, c);
    XK.donut(document.getElementById('pf-opex'), { title: 'Operating expenses', items: opexRows, centre: money(XK.sum(opexRows.map(function (x) { return x.value; }))) }, c);
    if (b0) XK.donut(document.getElementById('pf-bank'), { title: 'Bank accounts', items: b0.bankRows.map(function (r) { return { label: r.label, value: r.value }; }), centre: money(b0.bank) }, c);
    var dd = function (id, a) { XK.bars(document.getElementById(id), { title: id, labels: ['Current', 'Prior'], fmt: function (v) { return Math.round(v) + ' days'; }, series: [{ name: 'Days', values: [a[0] == null ? null : Math.round(a[0]), a[1] == null ? null : Math.round(a[1])] }] }, c); };
    dd('pf-dd', DD); dd('pf-cd', CD);

    // Checks
    var pt = c.data.pnl_total ? XK.plParts(XK.walk(c.data.pnl_total)) : null, has12 = mc && keys.every(function (k) { return mc.idx[k] != null; }), hasP = mcp && pkeys.every(function (k) { return mcp.idx[k] != null; });
    var checks = [
      { name: 'Xero returned 12 monthly columns (current and prior year)', pass: has12 && (!wp || hasP), detail: (mc ? mc.keys.length : 0) + ' + ' + (mcp ? mcp.keys.length : 0) + ' month columns' + (has12 ? '' : ' — expected ' + XK.monthLabel(keys[0]) + '…' + XK.monthLabel(keys[11])) },
      { name: 'Σ monthly net profit = the 12-month Profit and Loss', pass: pt && T.np[0] != null ? XK.near(T.np[0], pt.np, 0.05) : null, detail: pt ? money(T.np[0]) + ' vs ' + money(pt.np) : c.err('pnl_total') },
      { name: 'Σ monthly income and expenses = the 12-month Profit and Loss', pass: pt && T.inc[0] != null ? XK.near(T.inc[0], pt.income, 0.05) && XK.near(T.exp[0], pt.expenses, 0.05) : null, detail: pt ? money(T.inc[0]) + ' / ' + money(T.exp[0]) : 'N/A' },
      { name: 'Margins = profit ÷ income (net: net profit ÷ total income; gross: gross profit ÷ trading income)', pass: T.inc[0] ? XK.near(M.npm[0] * T.inc[0], T.np[0], 0.05) : null, detail: 'Net ' + pct(M.npm[0]) + ' · Gross ' + pct(M.gpm[0]) },
      { name: 'Debtors days = accounts receivable ÷ 12-month income × 365; creditors days = accounts payable ÷ 12-month expenses × 365', pass: b0 && b0.ar != null ? XK.near(DD[0] * T.inc[0] / 365, b0.ar, 0.05) : null, detail: b0 ? 'AR ' + money(b0.ar) + ', AP ' + money(b0.ap) : c.err('bs') },
      { name: 'Balance Sheet balances (Total Assets = Total Liabilities + Total Equity)', pass: b0 && b0.totalAssets != null ? XK.near(b0.totalAssets, b0.totalLiabilities + b0.equity) : null, detail: b0 ? money(b0.totalAssets) : 'N/A' }
    ];
    this._x = { keys: keys, np: np, inc: inc, exp: exp, T: T, M: M, DD: DD, CD: CD };
    return { checks: checks, notes: ['Accrual basis, ' + c.currency + '. Each widget compares the 12 months ending ' + XK.monthLabel(keys[11]) + ' with the same months a year earlier.', 'AI insights are written from the figures shown only.'],
      na: ['Xero Analytics widget settings (columns, filters) beyond the monthly view'], period: '12 months ending ' + XK.asOfLine(end).replace(/^As at /, '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Performance overview', s: 'bold' }], ['12 months ending ' + XK.monthLabel(x.keys[11])], [], [{ v: 'Month', s: 'bold' }, { v: 'Income', s: 'bold' }, { v: 'Expenses', s: 'bold' }, { v: 'Net profit', s: 'bold' }, { v: 'Prior-year net profit', s: 'bold' }]];
    var rows = head.concat(x.keys.map(function (k, i) { return [XK.monthLabel(k), { v: x.inc.cur[i], s: 'money' }, { v: x.exp.cur[i], s: 'money' }, { v: x.np.cur[i], s: 'money' }, { v: x.np.pri[i], s: 'money' }]; }));
    rows.push([{ v: 'Total', s: 'bold' }, { v: x.T.inc[0], s: 'moneyBold' }, { v: x.T.exp[0], s: 'moneyBold' }, { v: x.T.np[0], s: 'moneyBold' }, { v: x.T.np[1], s: 'moneyBold' }]);
    rows.push([], ['Net profit margin', { v: x.M.npm[0], s: 'pct' }, null, 'Prior', { v: x.M.npm[1], s: 'pct' }], ['Gross profit margin', { v: x.M.gpm[0], s: 'pct' }, null, 'Prior', { v: x.M.gpm[1], s: 'pct' }], ['Debtors days', x.DD[0] == null ? null : Math.round(x.DD[0]), null, 'Prior', x.DD[1] == null ? null : Math.round(x.DD[1])], ['Creditors days', x.CD[0] == null ? null : Math.round(x.CD[0]), null, 'Prior', x.CD[1] == null ? null : Math.round(x.CD[1])]);
    return [{ name: 'Performance overview', rows: rows, widths: [26, 16, 16, 16, 20] }];
  }
});
```

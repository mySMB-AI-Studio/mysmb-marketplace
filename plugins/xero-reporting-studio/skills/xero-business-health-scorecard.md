---
name: xero-business-health-scorecard
description: Build a live, validated Xero Business health scorecard (P14) on the tested report kit — health score, pinned net profit and current ratio, insight chips, and a scorecard of 12 metrics (equation, this month vs last, target, status, importance). Use for "business health scorecard", "health score", "KPI scorecard", "targets", "current ratio".
---
# Business health scorecard (P14)

Use when the user asks for a business health scorecard, a health score, a KPI scorecard against targets, or how the business is tracking against its targets. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_profit_and_loss`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Business health scorecard. Library: Xero Reports Prompt Library v1.2 → Prompts → P14. Delivery: Wave 2 (delivery order 12).

## Discovery call

Call `get_organisation` and `list_connections` once, and `get_profit_and_loss` once for last month. An error is a failed call: report its message.

## Date defaults

`end_date` = the month end (default: end of last month; preset `a` = `end_last_month`, `end_this_month` or `custom`). **Targets** go in the `targets` input as JSON: `{"cr":2,"dd":"decrease","cd":"off"}` — metric ids `income, gp, np, gpm, npm, opex, cash, cr, qr, dd, cd, debt`; a number is a target value, `increase` / `decrease` a direction vs the previous month (the default), `off` removes the metric. Set it from what the user says; never invent targets.

## Members

| Member / view | How |
|---|---|
| Actuals vs target | Default view |
| Actuals | Report = Actuals (no targets or status) |
| Insight chips | Explain my health score · Recommend useful metrics · Identify weaknesses and risks · How can I improve — answered from the figures only |

## Validation checks (shown in the banner)

- Score = targets achieved ÷ targets with a result
- Every status recomputed from actual vs target
- Every metric shows its equation
- **Independent tie:** the month's net profit = the movement in Current Year Earnings on the Balance Sheet
- Xero returned both month-end balance sheets

## Save as

`fileName`: `xero-business-health-scorecard.html` · `tags`: ["xero","business-health-scorecard","P14","analytics"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Hammerjack Pty Limited, Aug 2026: score 86% Excellent (12 targets) · Net profit 2,041,446 (+1639.7% vs prior month) · Current ratio 3 (+57.36%) · Total income 2,095,529 (✗ 118,898 down) · Debtor days 26 (✗) · Creditor days 837 (✓). Xero's targets are set in Xero; give the same targets to compare. On Irvine Jackson Pty Ltd in QA, every check passes.
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
      "name": "prev_end",
      "label": "Previous month end",
      "type": "date",
      "default": "2026-07-31"
    },
    {
      "name": "prev_start",
      "label": "Previous month start",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "targets",
      "label": "Targets",
      "type": "string",
      "maxLength": 500,
      "default": "{}"
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"end_last_month\",\"c\":\"none\",\"v\":\"target\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl",
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
      "id": "pnl_prev",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "prev_start"
        },
        "toDate": {
          "kind": "input",
          "input": "prev_end"
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
  title: 'Business health scorecard', primary: 'pnl', dated: ['bs'], org: 'org', conns: 'connections',
  inputs: { asAt: 'end_date', org: 'org', display: 'display' },
  defaults: { end_date: '2026-08-31', m_start: '2026-08-01', prev_end: '2026-07-31', prev_start: '2026-07-01', targets: '{}', org: '',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_last_month","c":"none","v":"target"}' },
  uses: { pnl: ['m_start', 'end_date', 'org'], pnl_prev: ['prev_start', 'prev_end', 'org'], bs: ['end_date', 'org'], org: ['org'], connections: [] },
  tools: { pnl: 'get_profit_and_loss (the month)', pnl_prev: 'get_profit_and_loss (the previous month)', bs: 'get_balance_sheet (month end and previous month end: periods 1, MONTH)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_last_month', 'End of last month'], ['end_this_month', 'End of this month'], ['custom', 'Custom']],
  views: [['target', 'Actuals vs target'], ['actuals', 'Actuals']],
  derive: function (inp) { var p = inp.end_date.split('-'), pe = new Date(Date.UTC(+p[0], +p[1] - 1, 0)).toISOString().slice(0, 10); return { m_start: inp.end_date.slice(0, 8) + '01', prev_end: pe, prev_start: pe.slice(0, 8) + '01' }; },
  render: function (c) {
    var self = this, body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); };
    if (c.errors.pnl || c.errors.bs) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl') || c.err('bs')) + '</p>'; return { checks: [{ name: 'Profit and Loss and Balance Sheet loaded', pass: false, detail: c.err('pnl') || c.err('bs') }] }; }
    if (!c.data.pnl || !c.data.bs) return {};
    var end = c.inputs.end_date, mon = XK.monthLabel(end.slice(0, 7)), pmon = XK.monthLabel(c.inputs.prev_end.slice(0, 7)), dim = +end.slice(8), pdim = +c.inputs.prev_end.slice(8);
    var bw = XK.walk(c.data.bs), cur = { pl: XK.plParts(XK.walk(c.data.pnl)), bs: XK.bsParts(bw, 0), days: dim }, prv = { pl: c.data.pnl_prev ? XK.plParts(XK.walk(c.data.pnl_prev)) : null, bs: bw.columns.length > 1 ? XK.bsParts(bw, 1) : null, days: pdim };
    var div = function (a, b) { return a == null || b == null || !b ? null : a / b; };
    var MET = [
      { id: 'income', sec: 'Core profitability', name: 'Total income', eq: 'Σ income accounts', f: function (x) { return x.pl && x.pl.income; }, t: 'm', dir: 'increase', imp: 'High' },
      { id: 'gp', sec: 'Core profitability', name: 'Gross profit', eq: 'Trading income − Cost of sales', f: function (x) { return x.pl && (x.pl.gp != null ? x.pl.gp : x.pl.trading - x.pl.cos); }, t: 'm', dir: 'increase', imp: 'Medium' },
      { id: 'np', sec: 'Core profitability', name: 'Net profit', eq: 'Total income − Total expenses', f: function (x) { return x.pl && x.pl.np; }, t: 'm', dir: 'increase', imp: 'High' },
      { id: 'gpm', sec: 'Core profitability', name: 'Gross profit margin', eq: 'Gross profit ÷ Trading income', f: function (x) { return x.pl && div(x.pl.gp != null ? x.pl.gp : x.pl.trading - x.pl.cos, x.pl.trading); }, t: '%', dir: 'increase', imp: 'Medium' },
      { id: 'npm', sec: 'Core profitability', name: 'Net profit margin', eq: 'Net profit ÷ Total income', f: function (x) { return x.pl && div(x.pl.np, x.pl.income); }, t: '%', dir: 'increase', imp: 'High' },
      { id: 'opex', sec: 'Core profitability', name: 'Operating expenses', eq: 'Σ operating expense accounts', f: function (x) { return x.pl && x.pl.opex; }, t: 'm', dir: 'decrease', imp: 'Medium' },
      { id: 'cash', sec: 'Liquidity', name: 'Cash balance', eq: 'Σ bank accounts', f: function (x) { return x.bs && x.bs.bank; }, t: 'm', dir: 'increase', imp: 'High' },
      { id: 'cr', sec: 'Liquidity', name: 'Current ratio', eq: 'Current assets ÷ Current liabilities', f: function (x) { return x.bs && div(x.bs.currentAssets, x.bs.currentLiabilities); }, t: 'x', dir: 'increase', imp: 'High' },
      { id: 'qr', sec: 'Liquidity', name: 'Quick ratio', eq: '(Bank + Accounts receivable) ÷ Current liabilities', f: function (x) { return x.bs && div((x.bs.bank || 0) + (x.bs.ar || 0), x.bs.currentLiabilities); }, t: 'x', dir: 'increase', imp: 'Medium' },
      { id: 'dd', sec: 'Efficiency', name: 'Debtor days', eq: 'Accounts receivable ÷ Total income × days in month', f: function (x) { return x.bs && x.pl && x.pl.income ? x.bs.ar / x.pl.income * x.days : null; }, t: 'd', dir: 'decrease', imp: 'Medium' },
      { id: 'cd', sec: 'Efficiency', name: 'Creditor days', eq: 'Accounts payable ÷ Total expenses × days in month', f: function (x) { return x.bs && x.pl && x.pl.expenses ? x.bs.ap / x.pl.expenses * x.days : null; }, t: 'd', dir: 'increase', imp: 'Low' },
      { id: 'debt', sec: 'Leverage', name: 'Debt ratio', eq: 'Total liabilities ÷ Total assets', f: function (x) { return x.bs && div(x.bs.totalLiabilities, x.bs.totalAssets); }, t: '%', dir: 'decrease', imp: 'Low' }];
    var T = {}; try { T = JSON.parse(c.inputs.targets || '{}') || {}; } catch (e) { T = {}; }
    var show = function (v, t) { return v == null || !isFinite(v) ? 'N/A' : t === 'm' ? money(v) : t === '%' ? (v * 100).toFixed(1) + '%' : t === 'd' ? Math.round(v) + ' days' : v.toFixed(2); };
    var rows = MET.filter(function (m) { return T[m.id] !== 'off'; }).map(function (m) {
      var a = m.f(cur), b = m.f(prv), tg = T[m.id] != null ? T[m.id] : m.dir, dir = typeof tg === 'number' ? m.dir : String(tg).toLowerCase(), num = typeof tg === 'number' ? tg : null;
      var achieved = a == null ? null : num != null ? (dir === 'decrease' ? a <= num : a >= num) : b == null ? null : dir === 'decrease' ? a <= b : a >= b;
      return { m: m, a: a, b: b, target: num != null ? (dir === 'decrease' ? '≤ ' : '≥ ') + show(num, m.t) : dir === 'decrease' ? 'Decrease' : 'Increase', dir: dir, num: num, achieved: achieved, delta: a != null && b != null ? a - b : null };
    });
    var scored = rows.filter(function (r) { return r.achieved != null; }), won = scored.filter(function (r) { return r.achieved; }).length, score = scored.length ? won / scored.length : null;
    var grade = score == null ? 'N/A' : score >= 0.8 ? 'Excellent' : score >= 0.6 ? 'Good' : score >= 0.4 ? 'Fair' : 'Needs attention';
    var pin = function (id) { var r = rows.filter(function (x) { return x.m.id === id; })[0]; if (!r) return ''; var dv = r.a != null && r.b ? (r.a - r.b) / Math.abs(r.b) : null; return '<div class="xk-card xk-widget"><h3>' + r.m.name + '</h3><div class="cur">' + show(r.a, r.m.t) + '</div>' + (dv != null ? '<span class="chip ' + (dv >= 0 ? 'up' : 'down') + '">' + (dv >= 0 ? '▲ ' : '▼ ') + Math.abs(dv * 100).toFixed(2) + '% vs ' + pmon + '</span>' : '') + '<div id="hs-pin-' + id + '"></div></div>'; };
    var ring = score == null ? '' : '<svg viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="Health score"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="60" cy="60" r="50" fill="none" stroke="var(--c1)" stroke-width="12" stroke-dasharray="' + (314.16 * score).toFixed(1) + ' 314.16" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" class="donut-c">' + Math.round(score * 100) + '%</text></svg>';
    var CHIPS = [['explain', 'Explain my health score'], ['recommend', 'Recommend useful metrics to add'], ['risks', 'Identify weaknesses and risks'], ['improve', 'How can I improve']];
    var missed = rows.filter(function (r) { return r.achieved === false; }), hit = rows.filter(function (r) { return r.achieved === true; });
    var ans = { explain: 'Your score is ' + won + ' of ' + scored.length + ' targets (' + (score == null ? 'N/A' : Math.round(score * 100) + '%') + ', ' + grade + ') for ' + mon + '. Achieved: ' + (hit.map(function (r) { return r.m.name; }).join(', ') || 'none') + '. Missed: ' + (missed.map(function (r) { return r.m.name; }).join(', ') || 'none') + '.',
      recommend: 'Useful metrics you could add as targets: cash runway (cash ÷ average monthly net outflow), expense ratio (total expenses ÷ total income) and revenue growth month on month — tell me a target for each.',
      risks: missed.length ? missed.map(function (r) { return r.m.name + ' moved ' + (r.delta >= 0 ? 'up ' : 'down ') + show(Math.abs(r.delta), r.m.t) + ' vs ' + pmon + ' (target: ' + r.target.toLowerCase() + ')'; }).join('; ') + '.' : 'No metric missed its target in ' + mon + '.',
      improve: missed.length ? missed.map(function (r) { return r.m.name + ': ' + ({ income: 'follow up quotes and repeat customers', gp: 'review pricing and cost of sales', np: 'review the largest expense accounts', gpm: 'check supplier prices and discounts', npm: 'reduce operating costs relative to income', opex: 'review subscriptions and discretionary spend', cash: 'chase overdue invoices', cr: 'pay down short-term liabilities or hold more cash', qr: 'collect receivables sooner', dd: 'shorten payment terms and chase overdue invoices', cd: 'use supplier terms fully', debt: 'reduce borrowing' }[r.m.id]); }).join('; ') + '.' : 'Every target was achieved — consider raising the targets.' };
    var sections = []; rows.forEach(function (r) { if (sections.indexOf(r.m.sec) < 0) sections.push(r.m.sec); });
    var tview = c.view !== 'actuals';
    var tab = '<table class="xk-grid"><thead><tr><th>Metric</th><th>Equation (fx)</th><th class="num">' + pmon + '</th><th class="num">' + mon + '</th>' + (tview ? '<th>Target</th><th>Status</th><th>Importance</th>' : '') + '</tr></thead><tbody>' +
      sections.map(function (s) { return '<tr class="k-header"><td colspan="' + (tview ? 7 : 4) + '"><strong>' + XK.h(s) + '</strong></td></tr>' + rows.filter(function (r) { return r.m.sec === s; }).map(function (r) {
        return '<tr><td>' + XK.h(r.m.name) + '</td><td class="muted">' + XK.h(r.m.eq) + '</td><td class="num">' + show(r.b, r.m.t) + '</td><td class="num">' + show(r.a, r.m.t) + '</td>' + (tview ? '<td>' + XK.h(r.target) + '</td><td class="' + (r.achieved ? 'xk-ok' : r.achieved === false ? 'xk-bad' : 'muted') + '">' + (r.achieved == null ? '– N/A' : (r.achieved ? '✓ ' : '✗ ') + (r.delta == null ? '' : show(Math.abs(r.delta), r.m.t) + (r.delta >= 0 ? ' up' : ' down') + ' vs ' + pmon)) + '</td><td>' + r.m.imp + '</td>' : '') + '</tr>'; }).join(''); }).join('') + '</tbody></table>';
    body.innerHTML = '<div class="xk-grid3"><div class="xk-card xk-widget"><h3>Business health score</h3><div class="cur">' + grade + '</div><div class="pri">' + won + ' of ' + scored.length + ' targets achieved · ' + mon + '</div>' + ring + '</div>' + pin('np') + pin('cr') + '</div>' +
      '<div class="xk-card detail-block">' + CHIPS.map(function (ch) { return '<button type="button" class="xk-chip' + (self._chip === ch[0] ? ' on' : '') + '" data-chip="' + ch[0] + '">' + ch[1] + '</button>'; }).join('') + (self._chip ? '<p id="hs-ins">' + XK.h(ans[self._chip]) + '</p>' : '') + '</div>' +
      '<div class="xk-card"><h3>Scorecard — ' + mon + '</h3><div class="xk-scroll">' + tab + '</div><p class="muted">Targets: change them by asking, e.g. "set a current ratio target of 2" or "turn off creditor days".</p></div>';
    body.querySelectorAll('.xk-chip').forEach(function (b) { b.addEventListener('click', function () { self._chip = self._chip === b.getAttribute('data-chip') ? null : b.getAttribute('data-chip'); c.change({}, {}); }); });
    ['np', 'cr'].forEach(function (id) { var r = rows.filter(function (x) { return x.m.id === id; })[0], el = document.getElementById('hs-pin-' + id); if (r && el) XK.bars(el, { title: r.m.name, labels: [pmon, mon], fmt: function (v) { return show(v, r.m.t); }, series: [{ name: r.m.name, values: [r.b, r.a] }] }, c); });
    // Checks
    var recomputed = rows.every(function (r) { var a2 = r.m.f(cur); if (a2 == null) return r.achieved == null; var ok2 = r.num != null ? (r.dir === 'decrease' ? a2 <= r.num : a2 >= r.num) : (r.b == null ? null : r.dir === 'decrease' ? a2 <= r.b : a2 >= r.b); return ok2 === r.achieved; });
    var fyFirst = c.inputs.m_start === XK.fyStartOf(end, c.fy.month), cyeMove = cur.bs && cur.bs.cye != null ? (fyFirst ? cur.bs.cye : prv.bs && prv.bs.cye != null ? cur.bs.cye - prv.bs.cye : null) : null;
    var checks = [
      { name: 'Score = targets achieved ÷ targets with a result', pass: score == null ? null : XK.near(score, won / scored.length, 0.0001), detail: won + '/' + scored.length + ' = ' + (score == null ? 'N/A' : (score * 100).toFixed(1) + '%') },
      { name: 'Every status recomputed from actual vs target', pass: recomputed, detail: rows.length + ' metrics' },
      { name: 'Every metric shows its equation', pass: rows.every(function (r) { return !!r.m.eq; }), detail: rows.length + ' equations' },
      { name: 'Net profit for ' + mon + ' = the movement in Current Year Earnings on the Balance Sheet', pass: cyeMove == null || cur.pl.np == null ? null : XK.near(cur.pl.np, cyeMove), detail: cyeMove == null ? 'Current Year Earnings not on both month ends' : money(cur.pl.np) + ' vs ' + money(cyeMove) },
      { name: 'Xero returned both month-end balance sheets', pass: bw.columns.length >= 2, detail: bw.columns.join(', ') }
    ];
    this._x = { rows: rows, mon: mon, pmon: pmon, score: score, won: won, scored: scored.length, grade: grade, show: show };
    return { checks: checks, notes: ['Targets default to the direction Xero uses (increase or decrease vs the previous month); numeric targets can be set in chat.', 'Insights are written from the figures shown only.'], na: [], period: mon + ' vs ' + pmon };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business health scorecard', s: 'bold' }], [x.mon + ' · score ' + x.won + '/' + x.scored + ' (' + (x.score == null ? 'N/A' : Math.round(x.score * 100) + '%') + ', ' + x.grade + ')'], [],
      [{ v: 'Section', s: 'bold' }, { v: 'Metric', s: 'bold' }, { v: 'Equation', s: 'bold' }, { v: x.pmon, s: 'bold' }, { v: x.mon, s: 'bold' }, { v: 'Target', s: 'bold' }, { v: 'Status', s: 'bold' }, { v: 'Importance', s: 'bold' }]]
      .concat(x.rows.map(function (r) { return [r.m.sec, r.m.name, r.m.eq, x.show(r.b, r.m.t), x.show(r.a, r.m.t), r.target, r.achieved == null ? 'N/A' : r.achieved ? 'Achieved' : 'Missed', r.m.imp]; }));
    return [{ name: 'Health scorecard', rows: rows, widths: [20, 24, 40, 14, 14, 14, 12, 12] }];
  }
});
```

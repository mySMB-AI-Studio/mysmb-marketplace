---
name: xero-visualise
description: Build a live, validated Xero Visualise report (P15) on the tested report kit — six graph explorers: Profitability, Cash, Accounts, External data, KPIs and Industry benchmarks, monthly for 12 months. Use for "visualise", "chart my income and expenses", "graph", "trend", "KPI chart", "compare with benchmarks".
---
# Visualise (P15)

Use when the user asks to visualise or chart income, expenses, cash, accounts, KPIs, external metrics or benchmarks over time. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_profit_and_loss`, `get_balance_sheet`, `get_bank_summary`, `get_organisation`, `list_connections`).

Xero location: Reporting → Visualise. Library: Xero Reports Prompt Library v1.2 → Prompts → P15. Delivery: Wave 2 (delivery order 13).

## Discovery call

Call `get_organisation` and `list_connections` once, and `get_profit_and_loss` once with last month and `periods` = 11, `timeframe` = `MONTH`. An error is a failed call: report its message.

## Date defaults

`end_date` = the latest month end (default: end of last month). Tab = display `v`: `profitability` (default), `cash`, `accounts`, `external`, `kpis`, `benchmarks`. **External data** goes in the `ext` input as JSON `{"Staff employed":{"2026-07":12,"2026-08":13}}`; **benchmarks** in `bench` as `{"gpm":{"low":0.3,"high":0.4,"source":"…"}}` (ids `dd, cd, gpm, npm, cr, qr`) — only from figures and a source the user gives you.

## Members

| Member / view | How |
|---|---|
| Profitability | Graph picker: Income vs Expenses (default), Sales, Cost of sales, Other income, Operating expenses, Gross profit, Net profit; insight chips |
| Cash | Cash in vs cash out and net cash flow by month; bank account selector |
| Accounts | P&L totals or one account; line / column / stacked / doughnut |
| External data | User-supplied series beside income (N/A until given) |
| KPIs | Debtors days, creditors days, margins, current and quick ratio — with the formula |
| Industry benchmarks | Metric with the user's benchmark band and its source (N/A until given) |

## Validation checks (shown in the banner)

- Xero returned 12 monthly columns (Profit and Loss and Balance Sheet)
- **Independent tie:** every plotted month re-adds to the 12-month Profit and Loss
- The ratio shows its formula (KPIs / benchmarks)
- Benchmark comparison states its source
- Every month of the Bank Summary loaded (Cash tab)

## Save as

`fileName`: `xero-visualise.html` · `tags`: ["xero","visualise","P15","analytics"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Hammerjack Pty Limited sample titles: "Income vs Expenses · Monthly ending 31 Aug 2026"; KPI legend Debtors days / Creditors days; external series "Staff employed". On Irvine Jackson Pty Ltd in QA, every tab loads and every check passes.
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
      "name": "window_start",
      "label": "12 months from",
      "type": "date",
      "default": "2025-09-01"
    },
    {
      "name": "ext",
      "label": "External data",
      "type": "string",
      "maxLength": 500,
      "default": "{}"
    },
    {
      "name": "bench",
      "label": "Benchmarks",
      "type": "string",
      "maxLength": 300,
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"end_last_month\",\"c\":\"none\",\"v\":\"profitability\",\"o\":\"\"}"
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
      "id": "bs_12",
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
      "id": "bank",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
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
  title: 'Visualise', primary: 'pnl_12', dated: ['bs_12'], org: 'org', conns: 'connections',
  inputs: { asAt: 'end_date', org: 'org', display: 'display' },
  defaults: { end_date: '2026-08-31', m_start: '2026-08-01', window_start: '2025-09-01', ext: '{}', bench: '{}', org: '',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_last_month","c":"none","v":"profitability","o":""}' },
  uses: { pnl_12: ['m_start', 'end_date', 'org'], bs_12: ['end_date', 'org'], bank: ['m_start', 'end_date', 'org'], pnl_total: ['window_start', 'end_date', 'org'], org: ['org'], connections: [] },
  fan: { bank: function (inp, c) { return c.view === 'cash' ? XK.monthsEnding(inp.end_date, 12).map(function (m) { return { key: m.key, inputs: { m_start: m.start, end_date: m.end < inp.end_date ? m.end : inp.end_date } }; }) : []; } },
  tools: { pnl_12: 'get_profit_and_loss (12 monthly columns)', bs_12: 'get_balance_sheet (12 month-ends)', bank: 'get_bank_summary (per month, Cash tab)', pnl_total: 'get_profit_and_loss (the 12 months as one — tie)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_last_month', 'End of last month'], ['end_this_month', 'End of this month'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']],
  views: [['profitability', 'Profitability'], ['cash', 'Cash'], ['accounts', 'Accounts'], ['external', 'External data'], ['kpis', 'KPIs'], ['benchmarks', 'Industry benchmarks']],
  derive: function (inp) { var p = inp.end_date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 12, 1)); return { m_start: inp.end_date.slice(0, 8) + '01', window_start: d.toISOString().slice(0, 10) }; },
  render: function (c) {
    var self = this, body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); };
    if (c.errors.pnl_12) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl_12')) + '</p>'; return { checks: [{ name: 'Monthly Profit and Loss loaded', pass: false, detail: c.err('pnl_12') }] }; }
    if (!c.data.pnl_12) return {};
    var end = c.inputs.end_date, keys = XK.monthsEnding(end, 12).map(function (m) { return m.key; }), labs = keys.map(function (k) { return XK.monthLabel(k).slice(0, 3); }), ending = ' · Monthly ending ' + XK.asOfLine(end).replace(/^As at /, '');
    var w = XK.walk(c.data.pnl_12), mc = XK.monthCols(w), bw = c.data.bs_12 ? XK.walk(c.data.bs_12) : null, bmc = bw ? XK.monthCols(bw) : null;
    var P = keys.map(function (k) { var i = mc && mc.idx[k]; return i == null ? null : XK.plParts(w, i); }), B = keys.map(function (k) { var i = bmc && bmc.idx[k]; return i == null ? null : XK.bsParts(bw, i); });
    var ser = function (f) { return P.map(function (p) { return p ? f(p) : null; }); }, bser = function (f) { return B.map(function (b, i) { return b && P[i] ? f(b, P[i], +XK.monthsEnding(end, 12)[i].end.slice(8)) : null; }); };
    var view = c.view || 'profitability', opt = function (id, def) { return c.opt(id) || def; }, pick = function (id, list, cur) { return '<select id="vz-' + id + '">' + list.map(function (o) { return '<option value="' + XK.h(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + XK.h(o[1]) + '</option>'; }).join('') + '</select>'; };
    var tabs = '<div class="xk-tabs">' + (this.views || []).map(function (v) { return '<button type="button" class="xk-tab' + (v[0] === view ? ' on' : '') + '" data-v="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>';
    var html = '', after = [], extraChecks = [], chips = null, insight = {};
    var gp = function (p) { return p.gp != null ? p.gp : p.trading - p.cos; }, div = function (a, b) { return a == null || !b ? null : a / b; };
    if (view === 'profitability') {
      var G = [['ie', 'Income vs Expenses'], ['trading', 'Sales'], ['cos', 'Cost of sales'], ['otherIncome', 'Other income'], ['opex', 'Operating expenses'], ['gp', 'Gross profit'], ['np', 'Net profit']], g = opt('g', 'ie'), gl = G.filter(function (x) { return x[0] === g; })[0] || G[0];
      var series = g === 'ie' ? [{ name: 'Income', values: ser(function (p) { return p.income; }), color: 'var(--c1)' }, { name: 'Expenses', values: ser(function (p) { return p.expenses; }), color: 'var(--c3)' }] : [{ name: gl[1], values: ser(function (p) { return g === 'gp' ? gp(p) : p[g]; }) }];
      html = '<div class="xk-card"><h3>' + XK.h(gl[1] + ending) + '</h3><p class="muted">Explore income, expenses, sales, cost of sales, other income and expenses. Graph: ' + pick('g', G, g) + '</p><div id="vz-ch"></div></div>';
      after.push(function () { XK.bars(document.getElementById('vz-ch'), { title: gl[1], labels: labs, series: series }, c); });
      var inc = ser(function (p) { return p.income; }), ex = ser(function (p) { return p.expenses; }), np = ser(function (p) { return p.np; }), first = function (a) { return a.filter(function (v) { return v != null; })[0]; }, lastv = function (a) { return a.filter(function (v) { return v != null; }).slice(-1)[0]; };
      chips = [['trends', 'Explain the trends in my income and expenses'], ['perf', 'How is my business performing'], ['improve', 'How can I improve profit']];
      insight = { trends: 'Income went from ' + money(first(inc)) + ' in ' + labs[0] + ' to ' + money(lastv(inc)) + ' in ' + labs[11] + '; expenses from ' + money(first(ex)) + ' to ' + money(lastv(ex)) + '.',
        perf: 'Over the 12 months net profit was ' + money(XK.sum(np.filter(function (v) { return v != null; }))) + ' on income of ' + money(XK.sum(inc.filter(function (v) { return v != null; }))) + ' (' + XK.pct(div(XK.sum(np.filter(function (v) { return v != null; })), XK.sum(inc.filter(function (v) { return v != null; })))) + ' net margin).',
        improve: (function () { var rows = w.lines.filter(function (l) { return l.kind === 'row' && XK.isDeduction(l.group); }).map(function (l) { return { label: l.label, v: XK.sum(l.values.filter(function (v) { return v != null; })) }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 3); return 'Your three largest costs over the 12 months: ' + rows.map(function (r) { return r.label + ' ' + money(r.v); }).join(', ') + '. Reducing any of these or lifting prices raises profit directly.'; })() };
    } else if (view === 'cash') {
      var fan = c.fan('bank'), acct = opt('acct', ''), rowsOf = function (v) { return XK.walk(v).lines.filter(function (l) { return l.kind === 'row'; }); };
      var accs = fan && fan[fan.length - 1] && fan[fan.length - 1].value ? rowsOf(fan[fan.length - 1].value).map(function (l) { return [l.label, l.label]; }) : [];
      var mm = fan ? fan.map(function (it) { if (it.error || !it.value) return null; var rs = rowsOf(it.value).filter(function (l) { return !acct || l.label === acct; }); return { rin: XK.sum(rs.map(function (l) { return l.values[1]; })), rout: XK.sum(rs.map(function (l) { return l.values[2]; })) }; }) : null;
      html = '<div class="xk-card"><h3>Cash in vs Cash out' + ending + '</h3><p class="muted">Explore cash in, cash out and net cash flow (Xero\'s Bank Summary; includes transfers between your accounts). Bank account: ' + pick('acct', [['', 'All accounts']].concat(accs), acct) + '</p>' + (fan == null ? '<p class="muted">' + (c.live ? 'Loading the 12 months…' : 'N/A in a snapshot — open the live report') + '</p>' : '<div id="vz-ch"></div>') + '</div>';
      if (mm) after.push(function () { XK.bars(document.getElementById('vz-ch'), { title: 'Cash in vs cash out', labels: labs, series: [{ name: 'Cash in', values: mm.map(function (m) { return m && m.rin; }), color: 'var(--pos)' }, { name: 'Cash out', values: mm.map(function (m) { return m && -m.rout; }), color: 'var(--neg)' }, { name: 'Net cash flow', values: mm.map(function (m) { return m && Math.round((m.rin - m.rout) * 100) / 100; }), color: 'var(--c3)' }] }, c); });
      extraChecks.push({ name: 'Every month of the Bank Summary loaded', pass: fan == null ? null : fan.every(function (it) { return !it.error; }), detail: fan == null ? (c.live ? 'Loading' : 'N/A in a snapshot') : fan.filter(function (it) { return it.error; }).length + ' failed' });
    } else if (view === 'accounts') {
      var CT = [['line', 'Line'], ['column', 'Column'], ['stacked', 'Stacked'], ['doughnut', 'Doughnut']], ct = opt('ct', 'column'), acc = opt('acc', '');
      var TOT = [['Total Trading Income', function (p) { return p.trading; }], ['Total Cost of Sales', function (p) { return p.cos; }], ['Gross Profit', gp], ['Total Other Income', function (p) { return p.otherIncome; }], ['Total Operating Expenses', function (p) { return p.opex; }]];
      var accRows = w.lines.filter(function (l) { return l.kind === 'row'; }), accSeries = acc ? (function () { var l = accRows.filter(function (x) { return x.label === acc; })[0]; return l ? [{ name: l.label, values: keys.map(function (k) { var i = mc && mc.idx[k]; return i == null ? null : l.values[i]; }) }] : []; })() : TOT.map(function (t) { return { name: t[0], values: ser(t[1]) }; });
      html = '<div class="xk-card"><h3>' + XK.h((acc || 'Profit and Loss totals') + ending) + '</h3><p class="muted">View P&amp;L totals and accounts and explore trends. Chart: ' + pick('ct', CT, ct) + ' Series: ' + pick('acc', [['', 'P&L totals']].concat(accRows.map(function (l) { return [l.label, l.label]; })), acc) + '</p><div id="vz-ch"></div></div>';
      after.push(function () { var el = document.getElementById('vz-ch');
        if (ct === 'doughnut') XK.donut(el, { title: 'Totals', items: accSeries.map(function (s) { return { label: s.name, value: XK.sum(s.values.filter(function (v) { return v != null; })) }; }) }, c);
        else if (ct === 'line') XK.line(el, { title: 'Accounts', labels: labs, series: accSeries }, c);
        else XK.bars(el, { title: 'Accounts', labels: labs, stacked: ct === 'stacked', series: accSeries }, c); });
    } else if (view === 'external') {
      var ext = {}; try { ext = JSON.parse(c.inputs.ext || '{}') || {}; } catch (e) { ext = {}; }
      var names = Object.keys(ext), en = opt('xs', names[0] || '');
      html = '<div class="xk-card"><h3>External data' + ending + '</h3><p class="muted">Custom metrics from outside Xero, shown beside your financials.</p>' + (names.length ? 'Metric: ' + pick('xs', names.map(function (n) { return [n, n]; }), en) + '<div id="vz-ch"></div><div id="vz-ch2"></div>' : '<p>N/A — no external data yet. Tell the agent your figures, e.g. "Staff employed: Jul 12, Aug 13", and it adds them to this report.</p>') + '</div>';
      if (names.length) after.push(function () { var s = ext[en] || {}; XK.line(document.getElementById('vz-ch'), { title: en, labels: labs, fmt: function (v) { return String(v); }, series: [{ name: en, values: keys.map(function (k) { return s[k] == null ? null : +s[k]; }) }] }, c);
        XK.bars(document.getElementById('vz-ch2'), { title: 'Income', labels: labs, series: [{ name: 'Total income', values: ser(function (p) { return p.income; }) }] }, c); });
    } else if (view === 'kpis' || view === 'benchmarks') {
      var K = [['dd', 'Debtors days', 'Accounts receivable ÷ total income × days in month', function (b, p, d) { return p.income ? b.ar / p.income * d : null; }, function (v) { return Math.round(v) + ' days'; }],
        ['cd', 'Creditors days', 'Accounts payable ÷ total expenses × days in month', function (b, p, d) { return p.expenses ? b.ap / p.expenses * d : null; }, function (v) { return Math.round(v) + ' days'; }],
        ['gpm', 'Gross profit margin', 'Gross profit ÷ trading income', function (b, p) { return div(gp(p), p.trading); }, function (v) { return (v * 100).toFixed(1) + '%'; }],
        ['npm', 'Net profit margin', 'Net profit ÷ total income', function (b, p) { return div(p.np, p.income); }, function (v) { return (v * 100).toFixed(1) + '%'; }],
        ['cr', 'Current ratio', 'Current assets ÷ current liabilities', function (b) { return div(b.currentAssets, b.currentLiabilities); }, function (v) { return v.toFixed(2); }],
        ['qr', 'Quick ratio', '(Bank + accounts receivable) ÷ current liabilities', function (b) { return div((b.bank || 0) + (b.ar || 0), b.currentLiabilities); }, function (v) { return v.toFixed(2); }]];
      var kid = view === 'kpis' ? opt('k', 'dd') : opt('bm', 'gpm'), kd = K.filter(function (x) { return x[0] === kid; })[0] || K[0], vals = bser(kd[3]);
      var bench = {}; try { bench = JSON.parse(c.inputs.bench || '{}') || {}; } catch (e) { bench = {}; } var bm = view === 'benchmarks' ? bench[kd[0]] : null;
      html = '<div class="xk-card"><h3>' + kd[1] + ending + '</h3><p class="muted">' + (view === 'kpis' ? 'Financial ratios for performance, return, efficiency and leverage. Ratio: ' + pick('k', K.map(function (x) { return [x[0], x[1]]; }), kd[0]) : 'Compare your performance with similar businesses. Metric: ' + pick('bm', K.map(function (x) { return [x[0], x[1]]; }), kd[0])) + '</p><p><strong>Formula:</strong> ' + XK.h(kd[1] + ' = ' + kd[2]) + '</p>' +
        (view === 'benchmarks' && !bm ? '<p>N/A — industry benchmarks are not in the Xero API. Tell the agent a benchmark range and its source (e.g. "gross profit margin benchmark 30–40%, ATO small business benchmarks 2024") to add the band.</p>' : '') + (bm && bm.source ? '<p class="muted">Benchmark: ' + XK.h(kd[4](+bm.low) + ' – ' + kd[4](+bm.high)) + ' · source: ' + XK.h(bm.source) + '</p>' : '') + '<div id="vz-ch"></div></div>';
      after.push(function () { XK.line(document.getElementById('vz-ch'), { title: kd[1], labels: labs, fmt: kd[4], series: [{ name: kd[1], values: vals }], band: bm ? { low: keys.map(function () { return +bm.low; }), high: keys.map(function () { return +bm.high; }), name: 'Benchmark (' + (bm.source || 'source not given') + ')' } : null }, c); });
      if (view === 'benchmarks') extraChecks.push({ name: 'Benchmark comparison states its source', pass: bm ? !!bm.source : null, detail: bm ? (bm.source || 'No source given') : 'No benchmark provided' });
      extraChecks.push({ name: 'The ratio shows its formula', pass: true, detail: kd[1] + ' = ' + kd[2] });
    }
    body.innerHTML = tabs + html + (chips ? '<div class="xk-card detail-block">' + chips.map(function (ch) { return '<button type="button" class="xk-chip' + (self._chip === ch[0] ? ' on' : '') + '" data-chip="' + ch[0] + '">' + ch[1] + '</button>'; }).join('') + (self._chip && insight[self._chip] ? '<p id="vz-ins">' + XK.h(insight[self._chip]) + '</p>' : '') + '</div>' : '');
    after.forEach(function (f) { f(); });
    body.querySelectorAll('.xk-tab').forEach(function (b) { b.addEventListener('click', function () { c.change({}, { v: b.getAttribute('data-v') }); }); });
    body.querySelectorAll('select[id^="vz-"]').forEach(function (s) { s.addEventListener('change', function () { c.setOpt(s.id.slice(3), this.value); }); });
    body.querySelectorAll('.xk-chip').forEach(function (b) { b.addEventListener('click', function () { self._chip = self._chip === b.getAttribute('data-chip') ? null : b.getAttribute('data-chip'); c.change({}, {}); }); });
    // Checks
    var pt = c.data.pnl_total ? XK.plParts(XK.walk(c.data.pnl_total)) : null, has12 = mc && keys.every(function (k) { return mc.idx[k] != null; }), npS = ser(function (p) { return p.np; });
    var checks = [
      { name: 'Xero returned 12 monthly columns (Profit and Loss and Balance Sheet)', pass: !!has12 && (!bw || (bmc && keys.every(function (k) { return bmc.idx[k] != null; }))), detail: (mc ? mc.keys.length : 0) + ' P&L · ' + (bmc ? bmc.keys.length : 0) + ' Balance Sheet columns' },
      { name: 'Every plotted month re-adds to the 12-month Profit and Loss', pass: pt && has12 ? XK.near(XK.sum(npS), pt.np, 0.05) && XK.near(XK.sum(ser(function (p) { return p.income; })), pt.income, 0.05) : null, detail: pt ? money(XK.sum(npS.filter(function (v) { return v != null; }))) + ' vs ' + money(pt.np) + ' net profit' : c.err('pnl_total') }
    ].concat(extraChecks);
    this._x = { keys: keys, P: P };
    return { checks: checks, notes: ['Every series is computed from Xero\'s monthly Profit and Loss and Balance Sheet; insights use the figures shown only.'], na: view === 'benchmarks' ? ['Industry benchmark data (not in the Xero API — supplied by you)'] : [], period: '12 months ending ' + XK.asOfLine(end).replace(/^As at /, ''),
      title: 'Visualise — ' + ((this.views || []).filter(function (v) { return v[0] === view; })[0] || ['', ''])[1] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Visualise', s: 'bold' }], ['12 months ending ' + XK.monthLabel(x.keys[11])], [], [{ v: 'Month', s: 'bold' }, { v: 'Trading income', s: 'bold' }, { v: 'Total income', s: 'bold' }, { v: 'Cost of sales', s: 'bold' }, { v: 'Operating expenses', s: 'bold' }, { v: 'Total expenses', s: 'bold' }, { v: 'Net profit', s: 'bold' }]]
      .concat(x.keys.map(function (k, i) { var p = x.P[i]; return [XK.monthLabel(k)].concat(p ? [p.trading, p.income, p.cos, p.opex, p.expenses, p.np].map(function (v) { return { v: v, s: 'money' }; }) : []); }));
    return [{ name: 'Visualise', rows: rows, widths: [14, 16, 16, 16, 18, 16, 16] }];
  }
});
```

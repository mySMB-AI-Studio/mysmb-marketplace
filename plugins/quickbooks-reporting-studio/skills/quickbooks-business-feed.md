---
name: quickbooks-business-feed
description: QuickBooks Online Business feed (Q01) as a live, validated report in QuickBooks styling. Use when the user asks for the business feed, what's new in the business, a 'report ready' summary of last month, or quick insights on profit, spending, money owed and bills.
---

# Business feed (Q01)

Use when the user asks for the business feed, what's new in the business, a 'report ready' summary of last month, or quick insights on profit, spending, money owed and bills. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `get_report_aged_receivables`, `get_report_aged_payables`, `qbo_query`, `get_preferences`).

QuickBooks location: Feed › Business feed. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q01. Delivery: Wave 2 (Train 04).

## Discovery call

`get_report_profit_and_loss` by Month for the last six complete months; both ageing reports.

## Date defaults

No manual dates: the six-month window is set on every open.

## Members

| Member / view | How |
|---|---|
| Report ready — Profit and Loss card | Net profit, income and expenses for last month with a net-profit sparkline |
| Insight cards | Net profit vs the month before, biggest expense change, money owed to you, bills to pay — worded from the figures only |
| Intuit Intelligence assistants, Ask a question | N/A — use mySidekick or the QuickBooks Reporting Specialist |

## Validation checks (STEP 4 — shown in the banner)

- Card figures equal the P&L for the same month (net = income − cost of sales − expenses − other expenses)
- Monthly columns sum to the P&L total

## Save as

`fileName`: `quickbooks-business-feed.html` · `tags`: ["quickbooks","feed","insights"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): 'Report ready' card: Net profit from August −A$175,286.75 with income and expense lines.
3. Compare the layout with the Q01 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "feed_start",
      "label": "Trend from",
      "type": "date",
      "default": "2026-03-01"
    },
    {
      "name": "feed_end",
      "label": "Trend to",
      "type": "date",
      "default": "2026-08-31"
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
      "default": "Client"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
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
          "input": "feed_start"
        },
        "end_date": {
          "kind": "input",
          "input": "feed_end"
        },
        "accounting_method": {
          "kind": "static",
          "value": "Accrual"
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
  title: 'Business feed', token: null, primary: 'pnl_monthly', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { feed_start: '2026-03-01', feed_end: '2026-08-31', persona: 'Client',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: { pnl_monthly: ['feed_start', 'feed_end'], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { pnl_monthly: 'get_report_profit_and_loss (last 6 complete months, by month)', aged_receivables: 'get_report_aged_receivables', aged_payables: 'get_report_aged_payables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  // Six complete months ending last month, recomputed on every open.
  roll: function (inp, fy) { var lm = QB.preset('last_month', fy), e = QB.parse(lm.end); return { feed_start: QB.iso(new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() - 5, 1))), feed_end: lm.end }; },
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); };
    if (c.errors.pnl_monthly) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl_monthly')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl_monthly') }] }; }
    var rep = c.data.pnl_monthly; if (!rep) return {};
    var cols = QB.cols(rep), mc = cols.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), tc = cols.slice(1).filter(function (x) { return /^total$/i.test(x.title); })[0], ls = QB.walk(rep);
    var at = function (g, i) { var l = QB.find(ls, g); return l ? l.values[i] || 0 : 0; };
    var months = mc.map(function (x) { var i = x.i - 1; var inc = at('Income', i) + at('OtherIncome', i); return { label: x.title, start: x.start, inc: Math.round(inc * 100) / 100, net: at('NetIncome', i), exp: Math.round((inc - at('NetIncome', i)) * 100) / 100 }; });
    if (!months.length) { body.innerHTML = '<p class="muted">Nothing new right now.</p>'; return { checks: [{ name: 'Card figures equal the P&L for the same month', pass: null }] }; }
    var last = months[months.length - 1], prev = months[months.length - 2];
    var mName = last.start ? QB.MONTHS[QB.parse(last.start).getUTCMonth()] : last.label;
    var cards = [];
    cards.push('<div class="qb-card"><div class="muted">Report ready</div><h3>Profit and Loss</h3><p><strong>Net profit from ' + QB.h(mName) + ' ' + money(last.net) + '</strong></p><p>Income ' + money(last.inc) + ' · Expenses ' + money(last.exp) + '</p><div id="spark"></div><p class="muted">Ask the QuickBooks Reporting Specialist for the ' + QB.h(mName) + ' Profit and Loss to open the full report.</p></div>');
    if (prev) { var d = prev.net ? (last.net - prev.net) / Math.abs(prev.net) : null; cards.push('<div class="qb-card"><div class="muted">Insight</div><h3>Net profit vs the month before</h3><p>' + QB.h(mName) + ' ' + money(last.net) + ' compared with ' + money(prev.net) + (d == null ? '' : ' (' + (d >= 0 ? 'up ' : 'down ') + QB.pct(Math.abs(d), 0) + ')') + '.</p></div>'); }
    var expLines = ls.filter(function (l) { return l.kind === 'row' && /expenses|cost of sales/i.test(l.path[0] || ''); }), li = last && mc.length ? mc[mc.length - 1].i - 1 : null, pi = mc.length > 1 ? mc[mc.length - 2].i - 1 : null;
    if (li != null && pi != null) { var mv = expLines.map(function (l) { return { label: l.label, d: (l.values[li] || 0) - (l.values[pi] || 0) }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); })[0];
      if (mv && mv.d) cards.push('<div class="qb-card"><div class="muted">Insight</div><h3>Biggest expense change</h3><p>' + QB.h(mv.label) + ' ' + (mv.d > 0 ? 'rose' : 'fell') + ' by ' + money(Math.abs(mv.d)) + ' from the month before.</p></div>'); }
    var gt = function (id) { var r = c.data[id]; if (!r) return null; var ls2 = QB.walk(r), g = QB.find(ls2, 'GrandTotal', /^total$/i), cols2 = QB.cols(r); return g ? { total: g.values[g.values.length - 1], current: g.values[0], over: Math.round(((g.values[g.values.length - 1] || 0) - (g.values[0] || 0)) * 100) / 100 } : null; };
    var ar = gt('aged_receivables'), ap = gt('aged_payables');
    if (ar) cards.push('<div class="qb-card"><div class="muted">Insight</div><h3>Money owed to you</h3><p>' + money(ar.total) + ' outstanding, ' + money(ar.over) + ' overdue.</p></div>');
    if (ap) cards.push('<div class="qb-card"><div class="muted">Insight</div><h3>Bills to pay</h3><p>' + money(ap.total) + ' owed to suppliers, ' + money(ap.over) + ' overdue.</p></div>');
    body.innerHTML = '<div class="qb-grid2">' + cards.join('') + '</div>';
    QB.line(document.getElementById('spark'), { title: 'Net profit by month', labels: months.map(function (m) { return m.label; }), series: [{ name: 'Net profit', values: months.map(function (m) { return m.net; }) }] }, c);
    var sumOk = tc ? ['Income', 'NetIncome'].every(function (g) { var l = QB.find(ls, g); return !l || QB.near(l.values[tc.i - 1], QB.sum(mc.map(function (x) { return l.values[x.i - 1]; })), 0.05); }) : null;
    var checks = [
      { name: 'Card figures equal the P&L for the same month (net = income − cost of sales − expenses − other expenses)', pass: (function () { var i = mc[mc.length - 1].i - 1; return QB.near(last.net, last.inc - at('COGS', i) - at('Expenses', i) - at('OtherExpenses', i)); })(), detail: mName + ': net ' + money(last.net) + ', income ' + money(last.inc) },
      { name: 'Monthly columns sum to the P&L total', pass: sumOk, detail: months.length + ' months' }];
    this._x = { months: months };
    return { checks: checks, period: QB.periodLine(c.inputs.feed_start, c.inputs.feed_end),
      notes: ['Insight wording is generated from the figures shown — no forecasts or advice.'], na: ['Intuit Intelligence assistants and "Ask a question" (use mySidekick or the QuickBooks Reporting Specialist instead)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Business feed', widths: [16, 18, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business feed — net profit by month', s: 'bold' }], [QB.periodLine(c.inputs.feed_start, c.inputs.feed_end)], [], [{ v: 'Month', s: 'bold' }, { v: 'Income', s: 'bold' }, { v: 'Expenses', s: 'bold' }, { v: 'Net profit', s: 'bold' }]].concat(x.months.map(function (m) { return [m.label, { v: m.inc, s: 'money' }, { v: m.exp, s: 'money' }, { v: m.net, s: 'money' }]; })) }];
  }
});
```

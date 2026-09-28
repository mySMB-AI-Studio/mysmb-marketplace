---
name: quickbooks-projects
description: QuickBooks Online Projects family (Q29) as a live, validated report in QuickBooks styling. Use when the user asks for project profitability, the project profitability summary, profit or margin by project, or estimates vs actuals by project.
---

# Projects family (Q29)

Use when the user asks for project profitability, the project profitability summary, profit or margin by project, or estimates vs actuals by project. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `list_customer`, `list_estimate`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Projects. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q29. Delivery: Wave 3 (Train 05).

## Discovery call

Same as the Projects overview: P&L by Customers + `list_customer` + `list_estimate`.

## Date defaults

Preset `this_fy_td`.

## Members

| Member / view | How |
|---|---|
| Project Profitability Summary | Project | Income | Costs | Profit | Margin % |
| Estimates vs. actuals by project | Report = Estimates vs actuals by project |

## Validation checks (STEP 4 — shown in the banner)

- Profit = income − costs (each project)
- Σ customer and project columns = P&L total

## Save as

`fileName`: `quickbooks-project-profitability.html` · `tags`: ["quickbooks","projects"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Layout per QBO documentation: Project | Income | Costs | Profit | Margin %.
3. Compare the layout with the Q29 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"profitability\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl_by_customer",
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
          "value": "Customers"
        }
      }
    },
    {
      "id": "customers",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_customer"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Active = true"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "estimates",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_estimate"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
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
  title: 'Project Profitability Summary', token: 'PROJECT_PROFITABILITY', route: 'reportv2', primary: 'pnl_by_customer', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', persona: 'Executive',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"profitability","x":""}' },
  uses: { pnl_by_customer: ['start_date', 'end_date', 'basis'], customers: [], estimates: [], company_info: [], prefs: [] },
  tools: { pnl_by_customer: 'get_report_profit_and_loss (Display columns by Customers)', customers: 'list_customer (projects flagged IsProject)', estimates: 'list_estimate (latest 1,000)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['overview', 'Projects overview'], ['profitability', 'Project Profitability Summary'], ['estimates', 'Estimates vs actuals by project']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'profitability';
    if (c.errors.pnl_by_customer) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl_by_customer')) + '</p>'; return { checks: [{ name: 'Profit and Loss by customer loaded', pass: false, detail: c.err('pnl_by_customer') }] }; }
    if (!c.data.pnl_by_customer) return {};
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    var custs = q('customers', 'Customer'), flagged = custs.some(function (x) { return x.IsProject !== undefined; });
    var projects = custs.filter(function (x) { return flagged ? x.IsProject === true : x.Job === true; });
    var rep = c.data.pnl_by_customer, cols = QB.cols(rep), ls = QB.walk(rep), tcol = cols.filter(function (x) { return /^total$/i.test(x.title); })[0];
    var at = function (g, i) { var l = QB.find(ls, g); return l ? l.values[i] || 0 : 0; };
    var colFor = function (p) { return cols.filter(function (x) { return x.i > 0 && (x.key === p.Id || x.title === p.FullyQualifiedName || x.title === p.DisplayName); })[0]; };
    var ests = q('estimates', 'Estimate');
    var rows = projects.map(function (p) {
      var col = colFor(p), i = col ? col.i - 1 : null;
      var inc = i == null ? 0 : Math.round((at('Income', i) + at('OtherIncome', i)) * 100) / 100, cost = i == null ? 0 : Math.round((at('COGS', i) + at('Expenses', i) + at('OtherExpenses', i)) * 100) / 100, prof = i == null ? 0 : at('NetIncome', i);
      var est = QB.sum(ests.filter(function (e) { return (e.CustomerRef || {}).value === p.Id; }).map(function (e) { return e.TotalAmt; }));
      return { name: (p.FullyQualifiedName || p.DisplayName || '').split(':').pop(), parent: (p.FullyQualifiedName || '').split(':').slice(0, -1).join(':'), inc: inc, cost: cost, prof: prof, margin: inc ? prof / inc : null, est: est, vsEst: est ? inc - est : null, hasCol: !!col };
    });
    var totInc = QB.sum(rows.map(function (r) { return r.inc; })), totProf = QB.sum(rows.map(function (r) { return r.prof; }));
    if (!projects.length) { body.innerHTML = '<p class="muted">Data appears once it\'s available. (No projects — turn on Projects in QuickBooks › Settings › Advanced, or this company has none yet.)</p>'; return { checks: [{ name: 'Projects exist', pass: null, detail: 'None' }], na: ['Project figures (no projects in this company)'] }; }
    body.innerHTML = QB.kpis([{ label: 'Total income (projects)', value: totInc }, { label: 'Total profit (projects)', value: totProf }, { label: 'Margin', text: totInc ? QB.pct(totProf / totInc) : 'N/A — not in source' }, { label: 'Projects', money: false, value: projects.length }], c) + '<div id="g1"></div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3 id="t1"></h3><div id="ch1"></div></div><div class="qb-card"><h3>Margin per project</h3><div id="ch2"></div></div></div>';
    var g = document.getElementById('g1');
    if (v === 'estimates') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Project' }, { key: 'est', title: 'Estimates', money: true }, { key: 'inc', title: 'Actual income', money: true }, { key: 'vsEst', title: 'Actual − estimate', money: true }], rows: rows, total: { name: 'TOTAL', est: QB.sum(rows.map(function (r) { return r.est; })), inc: totInc } }, c);
    else if (v === 'overview') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Project' }, { key: 'parent', title: 'Customer' }, { key: 'inc', title: 'Income', money: true }, { key: 'prof', title: 'Profit', money: true }], rows: rows }, c);
    else QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Project' }, { key: 'inc', title: 'Income', money: true }, { key: 'cost', title: 'Costs', money: true }, { key: 'prof', title: 'Profit', money: true }, { key: 'margin', title: 'Margin %', fmt: function (x) { return QB.pct(x); } }], rows: rows, total: { name: 'TOTAL', inc: totInc, cost: QB.sum(rows.map(function (r) { return r.cost; })), prof: totProf, margin: totInc ? totProf / totInc : null } }, c);
    document.getElementById('t1').textContent = v === 'profitability' ? 'Income vs costs per project' : 'Estimates vs actual income';
    QB.bars(document.getElementById('ch1'), { title: 'Projects', labels: rows.map(function (r) { return r.name.slice(0, 16); }), series: v === 'profitability' ? [{ name: 'Income', values: rows.map(function (r) { return r.inc; }) }, { name: 'Costs', values: rows.map(function (r) { return r.cost; }) }] : [{ name: 'Actual income', values: rows.map(function (r) { return r.inc; }) }, { name: 'Estimates', values: rows.map(function (r) { return r.est; }) }] }, c);
    QB.bars(document.getElementById('ch2'), { title: 'Margin per project', labels: rows.map(function (r) { return r.name.slice(0, 16); }), series: [{ name: 'Margin %', values: rows.map(function (r) { return r.margin == null ? null : Math.round(r.margin * 1000) / 10; }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 0 }) });
    var profOk = rows.every(function (r) { return QB.near(r.prof, r.inc - r.cost, 0.05); });
    var split = tcol ? ['Income', 'NetIncome'].every(function (gname) { var l = QB.find(ls, gname); if (!l) return true; return QB.near(l.values[tcol.i - 1], QB.sum(cols.filter(function (x) { return x.i > 0 && x !== tcol; }).map(function (x) { return l.values[x.i - 1]; })), 0.05); }) : null;
    var missing = rows.filter(function (r) { return !r.hasCol; }).map(function (r) { return r.name; });
    var checks = [
      { name: 'Profit = income − costs (each project)', pass: rows.length ? profOk : null, detail: rows.length + ' projects' },
      { name: 'Σ customer and project columns = P&L total (projects + other customers + not specified)', pass: split, detail: money(tcol ? at('Income', tcol.i - 1) : null) + ' total income' }];
    this._x = { rows: rows, totInc: totInc, totProf: totProf };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1],
      notes: [flagged ? 'Projects are the customers QuickBooks flags as projects.' : 'This connection does not return the project flag; sub-customers (jobs) are treated as projects — verify on first run.'].concat(missing.length ? [missing.length + ' project(s) had no activity in the period: ' + missing.join(', ')] : []),
      na: ['Project time and payroll costs broken out separately ("See info based on" in QuickBooks) — they are included in costs where QuickBooks posts them to the project'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var n = x.rows.length;
    return [{ name: 'Project Profitability', widths: [34, 16, 16, 16, 12, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Project Profitability Summary', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], [{ v: 'Project', s: 'bold' }, { v: 'Income', s: 'bold' }, { v: 'Costs', s: 'bold' }, { v: 'Profit', s: 'bold' }, { v: 'Margin %', s: 'bold' }, { v: 'Estimates', s: 'bold' }]]
      .concat(x.rows.map(function (r, i) { var R = 6 + i; return [r.name, { v: r.inc, s: 'money' }, { v: r.cost, s: 'money' }, { f: 'B' + R + '-C' + R, v: r.prof, s: 'money' }, r.margin == null ? null : { v: r.margin, s: 'pct' }, { v: r.est, s: 'money' }]; }), [[{ v: 'TOTAL', s: 'bold' }, { f: 'SUM(B6:B' + (5 + n) + ')', v: x.totInc, s: 'moneyBold' }, { f: 'SUM(C6:C' + (5 + n) + ')', s: 'moneyBold' }, { f: 'SUM(D6:D' + (5 + n) + ')', v: x.totProf, s: 'moneyBold' }]]) }];
  }
});
```

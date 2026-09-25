---
name: quickbooks-budgets
description: QuickBooks Online Budgets (Budget vs Actuals) (Q08) as a live, validated report in QuickBooks styling. Use when the user asks for budget vs actuals, a budget report, the budget overview, profit and loss budget performance, or how the business is tracking against budget.
---

# Budgets (Budget vs Actuals) (Q08)

Use when the user asks for budget vs actuals, a budget report, the budget overview, profit and loss budget performance, or how the business is tracking against budget. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`list_budget`, `get_report_profit_and_loss`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Financial planning › Budgets. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q08. Delivery: Wave 2 (Train 04).

## Discovery call

`list_budget` — expect `QueryResponse.Budget[]` with Name, StartDate, EndDate, BudgetType ProfitAndLoss and BudgetDetail[] {BudgetDate, Amount, AccountRef}; then `get_report_profit_and_loss` by Month for that budget's dates.

## Date defaults

Set `start_date` / `end_date` to the chosen budget's StartDate / EndDate (default: the budget covering today). The page follows the budget the reader selects.

## Members

| Member / view | How |
|---|---|
| Budget vs Actuals | Report = Budget vs Actuals (Actual | Budget | Over budget | % of budget) |
| Budget Overview | Report = Budget Overview (account × month grid) |
| Profit and Loss Budget Performance | Report = P&L Budget Performance (this month and year to date) |
| Create a budget, Import budget | N/A — the connector reads budgets but does not create them |

## Validation checks (STEP 4 — shown in the banner)

- Actual = Profit and Loss (each account, budget period)
- Σ months = annual budget (each account and in total)

## Save as

`fileName`: `quickbooks-budget-vs-actuals.html` · `tags`: ["quickbooks","budget","planning"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): No budget in the sample company (empty state captured) — the report says so and points to QuickBooks › Budgets.
3. Compare the layout with the Q08 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "label": "Budget from",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "end_date",
      "label": "Budget to",
      "type": "date",
      "default": "2027-06-30"
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"bva\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "budgets",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_budget"
      },
      "params": {
        "maxResults": {
          "kind": "static",
          "value": 100
        }
      }
    },
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
  title: 'Budget vs Actuals', token: null, primary: 'pnl_monthly', company: 'company_info', prefs: 'prefs',
  inputs: { basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2027-06-30', basis: 'Accrual', persona: 'Executive',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":1,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"bva","x":""}' },
  uses: { pnl_monthly: ['start_date', 'end_date', 'basis'], budgets: [], company_info: [], prefs: [] },
  tools: { budgets: 'list_budget', pnl_monthly: 'get_report_profit_and_loss (budget period, by month)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['bva', 'Budget vs Actuals'], ['overview', 'Budget Overview'], ['performance', 'Profit and Loss Budget Performance']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'bva';
    if (c.errors.budgets) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('budgets')) + '</p>'; return { checks: [{ name: 'Budgets loaded', pass: false, detail: c.err('budgets') }] }; }
    var list = ((c.data.budgets && c.data.budgets.QueryResponse && c.data.budgets.QueryResponse.Budget) || []).filter(function (b) { return !b.BudgetType || b.BudgetType === 'ProfitAndLoss'; });
    if (!list.length) { body.innerHTML = '<div class="qb-banner fail"><strong>No Profit and Loss budget in QuickBooks.</strong> Create one in QuickBooks › Reports › Financial planning › Budgets, then refresh this report.</div>'; return { checks: [{ name: 'A Profit and Loss budget exists', pass: null, detail: 'None found' }], na: ['Budget figures (no budget in QuickBooks)'] }; }
    if (c.errors.pnl_monthly) { body.innerHTML = '<p class="qb-err">Actuals are unavailable — not zero: ' + QB.h(c.err('pnl_monthly')) + '</p>'; return { checks: [{ name: 'Actual = Profit and Loss (each account, budget period)', pass: false, detail: c.err('pnl_monthly') }] }; }
    if (!c.data.pnl_monthly) return {};
    var sel = list.filter(function (b) { return b.Id === c.display.x; })[0] || list.filter(function (b) { return b.StartDate === c.inputs.start_date; })[0] || list[0];
    // Budget: account x month (subdivided budgets — customer / class / location — are summed per account)
    var months = [], acc = {}, order = [];
    (sel.BudgetDetail || []).forEach(function (d) { var m = String(d.BudgetDate).slice(0, 7), a = (d.AccountRef || {}).value || (d.AccountRef || {}).name; if (months.indexOf(m) < 0) months.push(m); if (!acc[a]) { acc[a] = { id: a, name: (d.AccountRef || {}).name || a, m: {} }; order.push(a); } acc[a].m[m] = Math.round(((acc[a].m[m] || 0) + (Number(d.Amount) || 0)) * 100) / 100; });
    months.sort();
    var rep = c.data.pnl_monthly, cols = rep ? QB.cols(rep) : [], mcols = cols.slice(1).filter(function (x) { return x.start; }), ls = rep ? QB.walk(rep) : [];
    var actRow = function (a) { for (var i = 0; i < ls.length; i++) if (ls[i].kind === 'row' && (ls[i].id === a.id || ls[i].label === a.name)) return ls[i]; return null; };
    var actM = function (a, m) { var r = actRow(a); if (!r) return 0; var col = mcols.filter(function (x) { return x.start.slice(0, 7) === m; })[0]; return col ? r.values[col.i - 1] || 0 : 0; };
    var rows = order.map(function (k) { var a = acc[k], bud = QB.sum(months.map(function (m) { return a.m[m] || 0; })), act = QB.sum(months.map(function (m) { return actM(a, m); })); return { name: a.name, act: act, bud: bud, over: Math.round((act - bud) * 100) / 100, pctOf: bud ? act / bud : null, a: a }; });
    var totA = QB.sum(rows.map(function (r) { return r.act; })), totB = QB.sum(rows.map(function (r) { return r.bud; }));
    var picker = '<label class="ctl" style="display:inline-flex;margin-bottom:12px">Budget<select id="w-budget">' + list.map(function (b) { return '<option value="' + QB.h(b.Id) + '"' + (b.Id === sel.Id ? ' selected' : '') + '>' + QB.h(b.Name + ' (' + b.StartDate + ' to ' + b.EndDate + ')') + '</option>'; }).join('') + '</select></label>';
    var nowM = c.today.slice(0, 7), cur = months.indexOf(nowM) >= 0 ? nowM : months[months.length - 1], ytd = months.filter(function (m) { return m <= cur; });
    var html = picker + QB.kpis([{ label: 'Actual', value: totA }, { label: 'Budget', value: totB }, { label: 'Over budget', value: Math.round((totA - totB) * 100) / 100 }, { label: '% of budget', text: totB ? QB.pct(totA / totB) : 'N/A — not in source' }], c) + '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3>Actual vs budget</h3><div id="ch1"></div></div>';
    body.innerHTML = html;
    var g = document.getElementById('g1');
    if (v === 'overview') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Account' }].concat(months.map(function (m) { return { key: m, title: m, money: true }; }), [{ key: 'bud', title: 'Total', money: true }]), rows: rows.map(function (r) { var o = { name: r.name, bud: r.bud }; months.forEach(function (m) { o[m] = r.a.m[m] || 0; }); return o; }) }, c);
    else if (v === 'performance') QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Account' }, { key: 'ma', title: cur + ' actual', money: true }, { key: 'mb', title: cur + ' budget', money: true }, { key: 'ya', title: 'YTD actual', money: true }, { key: 'yb', title: 'YTD budget', money: true }, { key: 'yv', title: 'YTD over budget', money: true }],
      rows: rows.map(function (r) { var ya = QB.sum(ytd.map(function (m) { return actM(r.a, m); })), yb = QB.sum(ytd.map(function (m) { return r.a.m[m] || 0; })); return { name: r.name, ma: actM(r.a, cur), mb: r.a.m[cur] || 0, ya: ya, yb: yb, yv: Math.round((ya - yb) * 100) / 100 }; }) }, c);
    else QB.grid(g, { filter: true, columns: [{ key: 'name', title: 'Account' }, { key: 'act', title: 'Actual', money: true }, { key: 'bud', title: 'Budget', money: true }, { key: 'over', title: 'Over budget', money: true }, { key: 'pctOf', title: '% of budget', fmt: function (x) { return QB.pct(x); } }], rows: rows, total: { name: 'TOTAL', act: totA, bud: totB, over: Math.round((totA - totB) * 100) / 100, pctOf: totB ? totA / totB : null } }, c);
    QB.bars(document.getElementById('ch1'), { title: 'Actual vs budget', labels: rows.map(function (r) { return r.name.slice(0, 16); }), series: [{ name: 'Actual', values: rows.map(function (r) { return r.act; }) }, { name: 'Budget', values: rows.map(function (r) { return r.bud; }) }] }, c);
    var s = document.getElementById('w-budget'); if (s) s.addEventListener('change', function () { var b = list.filter(function (x) { return x.Id === s.value; })[0]; if (b) c.change({ start_date: b.StartDate, end_date: b.EndDate }, { x: b.Id }); });
    if (c.live && (c.inputs.start_date !== sel.StartDate || c.inputs.end_date !== sel.EndDate)) setTimeout(function () { c.change({ start_date: sel.StartDate, end_date: sel.EndDate }, { x: sel.Id }); }, 0);
    var plTot = function (id) { var l = null; for (var i = 0; i < ls.length; i++) if (ls[i].kind === 'row' && (ls[i].id === id)) { l = ls[i]; break; } return l ? QB.val(l) : null; };
    var actOk = rows.every(function (r) { var t = plTot(r.a.id); return t == null || QB.near(r.act, t, 0.05); });
    var monthsOk = rows.every(function (r) { return QB.near(r.bud, QB.sum(months.map(function (m) { return r.a.m[m] || 0; }))); }) && QB.near(totB, QB.sum((sel.BudgetDetail || []).map(function (d) { return Number(d.Amount) || 0; })));
    var checks = [
      { name: 'Actual = Profit and Loss (each account, budget period)', pass: rep ? actOk : null, detail: c.errors.pnl_monthly ? c.err('pnl_monthly') : money(totA) },
      { name: 'Σ months = annual budget (each account and in total)', pass: monthsOk, detail: money(totB) + ' across ' + months.length + ' months' }];
    this._x = { rows: rows, months: months, sel: sel, totA: totA, totB: totB };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1] + ' — ' + sel.Name, period: QB.periodLine(sel.StartDate, sel.EndDate),
      notes: [(sel.BudgetDetail || []).some(function (d) { return d.CustomerRef || d.ClassRef || d.DepartmentRef; }) ? 'This budget is subdivided (customer / class / location); amounts are summed per account.' : 'Budget entries: ' + (sel.BudgetEntryType || 'Monthly') + '.'],
      na: ['Create a budget and Import budget (the connector reads budgets but does not create them)', 'Balance Sheet budgets'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Budget vs Actuals — ' + x.sel.Name, s: 'bold' }], [QB.periodLine(x.sel.StartDate, x.sel.EndDate)], [], [{ v: 'Account', s: 'bold' }, { v: 'Actual', s: 'bold' }, { v: 'Budget', s: 'bold' }, { v: 'Over budget', s: 'bold' }, { v: '% of budget', s: 'bold' }]];
    var n = x.rows.length;
    return [{ name: 'Budget vs Actuals', widths: [40, 16, 16, 16, 12], rows: head.concat(x.rows.map(function (r, i) { var R = 6 + i; return [r.name, { v: r.act, s: 'money' }, { v: r.bud, s: 'money' }, { f: 'B' + R + '-C' + R, v: r.over, s: 'money' }, r.pctOf == null ? null : { v: r.pctOf, s: 'pct' }]; }), [[{ v: 'TOTAL', s: 'bold' }, { f: 'SUM(B6:B' + (5 + n) + ')', v: x.totA, s: 'moneyBold' }, { f: 'SUM(C6:C' + (5 + n) + ')', v: x.totB, s: 'moneyBold' }, { f: 'B' + (6 + n) + '-C' + (6 + n), s: 'moneyBold' }]]) },
      { name: 'Budget Overview', widths: [40].concat(x.months.map(function () { return 12; })), rows: [[{ v: 'Account', s: 'bold' }].concat(x.months.map(function (m) { return { v: m, s: 'bold' }; }))].concat(x.rows.map(function (r) { return [r.name].concat(x.months.map(function (m) { return { v: r.a.m[m] || 0, s: 'money' }; })); })) }];
  }
});
```

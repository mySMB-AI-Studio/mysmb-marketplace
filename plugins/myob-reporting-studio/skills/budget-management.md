---
name: MYOB Budget Management
description: MYOB Budget Management (M01) as a live, validated report in MYOB styling. Use when the user asks for budgets, the budget, budget management, monthly budgets by category, or budget vs actual.
---
# Budget Management (M01)

Use when the user asks for budgets, the budget, budget management, monthly budgets by category, or budget vs actual. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Budget Management**. Template: `myob-reporting-studio` / `budget-management` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_budget`, `get_profit_and_loss_3m`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → Budget management. Library: MYOB Reports Prompt Library v1.2 → Prompts → M01. Delivery: Wave 2 (P2).

## Discovery call

Call `get_budget` once with `financial_year` (the year the financial year ends: 2027 = July 2026 – June 2027; MYOB holds the current and the next year only), `get_profit_and_loss_3m` once from the year's start to the end of last month (the actuals), `list_accounts` once and `list_company_files` once. `get_budget` returns `Budgets[]` of `{Account, MonthlyBudgets: [{Year, Month, Amount}]}` (calendar year and month) and `LastMonthInFinancialYear`.

## Date defaults

Input `budget_year` = `current` | `next` (the Budget year select); `financial_year`, `fy_start` and `act_end` are worked out from it and today, so a saved report rolls into the next year — never type them. The view is display `v` (`budget` | `actual`).

## Members

| Member / view | How |
|---|---|
| Budget by month | Income, cost of sales, expenses, other income and expenses per category for the 12 months and the year, with gross and net profit each month |
| Balance sheet budgets | Listed under the P&L budget when MYOB holds any |
| Budget vs actual | Report = Budget vs actual (year to date): the whole months so far — budget, actual, variance $ and % |
| Earlier years, job budgets | N/A — MYOB's API keeps the current and next financial year only |

## Validation checks (shown in the banner)

- MYOB's budget is for the financial year asked for, and its year ends where the report's does (`LastMonthInFinancialYear`)
- Every budget month falls in the financial year
- Every budgeted category is in the chart of accounts
- Each category's total = Σ its months; section totals = Σ their categories; net profit = the section formula, every month

## Save as

`fileName`: `myob-budget-management.html` · `tags`: ["myob","budget","M01"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com FY2027: 11 categories budgeted; budget vs actual compares July and August 2026.
3. Validation banner: every check passes (the independent tie included), or shows N/A with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch View as to Client, then Bookkeeper; toggle Style and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): the saved report and every export carry only this company file's figures and name.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "budget_year",
      "label": "Budget year",
      "type": "enum",
      "options": [
        "current",
        "next"
      ],
      "default": "current"
    },
    {
      "name": "financial_year",
      "label": "Financial year (worked out from the budget year)",
      "type": "number",
      "min": 2000,
      "max": 2100,
      "default": 2027
    },
    {
      "name": "fy_start",
      "label": "Financial year start (worked out)",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "act_end",
      "label": "Actuals to (end of last month, worked out)",
      "type": "date",
      "default": "2026-08-31"
    },
    {
      "name": "company_file",
      "label": "Company file",
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
      "default": "{\"cents\":0,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"budget\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "budget",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_budget"
      },
      "params": {
        "financial_year": {
          "kind": "input",
          "input": "financial_year"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "pnl",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "fy_start"
        },
        "to_date": {
          "kind": "input",
          "input": "act_end"
        },
        "reporting_basis": {
          "kind": "static",
          "value": "Accrual"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "accounts",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_accounts"
      },
      "params": {
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "company_files",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_company_files"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
// Budget Management (M01): the account budgets MYOB holds for the current or the next financial year (GeneralLedger/AccountBudget),
// month by month as a P&L budget (plus any balance-sheet budgets), and budget vs actual for the whole months of the year so far, the
// actuals from MYOB's Profit and Loss. The year is chosen as current / next and worked out from today, so a saved report rolls over.
MK.app({
  title: 'Budget Management', primary: 'budget', files: 'company_files',
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { budget_year: 'current', financial_year: 2027, fy_start: '2026-07-01', act_end: '2026-08-31', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"custom","c":"none","v":"budget","x":""}' },
  uses: { budget: ['financial_year', 'company_file'], pnl: ['fy_start', 'act_end', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { budget: 'get_budget (the account budgets for the financial year)', pnl: 'get_profit_and_loss_3m (actuals: the year\'s start to the end of last month)', accounts: 'list_accounts (classifications)', company_files: 'list_company_files' },
  enums: [{ input: 'budget_year', label: 'Budget year', options: [['current', 'This financial year'], ['next', 'Next financial year']] }],
  views: [['budget', 'Budget by month'], ['actual', 'Budget vs actual (year to date)']],
  derive: function (inp, fm) { var t = MK.asAt('today'), y = +t.slice(0, 4), m = +t.slice(5, 7), fy = (fm > 1 && m >= fm ? y + 1 : y) + (inp.budget_year === 'next' ? 1 : 0);
    var s = (fm > 1 ? fy - 1 : fy) + '-' + (fm < 10 ? '0' : '') + fm + '-01', lm = MK.asAt('end_last_month'); return { financial_year: fy, fy_start: s, act_end: lm >= s ? lm : s }; },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, inp = c.inputs, fy = +inp.financial_year, fm = c.fy.month;
    if (c.errors.budget) { body.innerHTML = '<p class="mk-err">' + h(c.err('budget')) + '</p>'; return { checks: [{ name: 'Budget loaded', pass: false, detail: c.err('budget') }] }; }
    var B = c.data.budget; if (!B) return {};
    var idx = MK.accounts(c.data.accounts), PLC = /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/, M = [], k;
    for (k = 0; k < 12; k++) { var mo = (fm - 1 + k) % 12 + 1; M.push(((fm > 1 ? fy - 1 : fy) + (fm > 1 && mo < fm ? 1 : 0)) + '-' + (mo < 10 ? '0' : '') + mo); }
    var lbl = M.map(function (ym) { return MK.MONTHS[+ym.slice(5) - 1].slice(0, 3) + ' ' + ym.slice(2, 4); }), out = 0, per = '1 ' + MK.MONTHS[fm - 1] + ' ' + M[0].slice(0, 4) + ' – ' + MK.iso(MK.eom(+M[11].slice(0, 4), +M[11].slice(5))).slice(8) + ' ' + MK.MONTHS[+M[11].slice(5) - 1] + ' ' + M[11].slice(0, 4);
    var rows = (B.Budgets || []).map(function (b) { var v = M.map(function () { return 0; });
      (b.MonthlyBudgets || []).forEach(function (x) { var i = M.indexOf(x.Year + '-' + (x.Month < 10 ? '0' : '') + x.Month); if (i < 0) out++; else v[i] = r2(v[i] + (MK.num(x.Amount) || 0)); });
      var ci = MK.classOf(b.Account || {}, idx); return { a: b.Account || {}, v: v, cls: ci.cls || '', listed: ci.from === 'accounts' }; });
    var rep = function (f) { return { AccountsBreakdown: rows.map(function (r) { return { Account: r.a, AccountTotal: f(r) }; }) }; };
    var reps = M.map(function (x, i) { return rep(function (r) { return r.v[i]; }); }).concat([rep(function (r) { return MK.sum(r.v); })]);
    var pl = MK.breakdown(reps, idx, MK.PL_LAYOUT), last = function (g) { return pl.totals[g] ? pl.totals[g][12] : 0; }, bs = rows.filter(function (r) { return r.cls && !PLC.test(r.cls); }), unc = rows.filter(function (r) { return !r.listed; });
    var view = c.view || 'budget', html, x = { sheets: [] }, sumNp = function (b, i) { return b.totals.Income[i] - b.totals.CostOfSales[i] - b.totals.Expense[i] + b.totals.OtherIncome[i] - b.totals.OtherExpense[i]; };
    var ytdM = M.filter(function (ym) { return ym <= String(inp.act_end).slice(0, 7) && inp.act_end > inp.fy_start; }), cmp = null;
    if (!rows.length) html = '<p class="muted">No budget is set up in MYOB for the financial year ' + h(per) + ' (FY' + fy + ').</p>';
    else if (view === 'actual') {
      if (!ytdM.length) html = '<p class="muted">No whole month of the financial year ' + h(per) + ' has ended yet, so there is nothing to compare.</p>';
      else if (c.errors.pnl) html = '<p class="mk-err">' + h(c.err('pnl')) + '</p>';
      else if (c.data.pnl) { var n = ytdM.length; cmp = MK.breakdown([rep(function (r) { return MK.sum(r.v.slice(0, n)); }), c.data.pnl], idx, MK.PL_LAYOUT);
        var np = cmp.calc.NetProfit || [0, 0], ex = [{ title: 'Variance ($)', value: function (l) { return r2(l.values[1] - l.values[0]); } }, { title: 'Variance (%)', fmt: 'pct', value: function (l) { var d = r2(l.values[1] - l.values[0]); return l.values[0] ? (Math.abs(d) < 0.005 ? 0 : d) / Math.abs(l.values[0]) : null; } }];
        html = MK.kpis([{ label: 'Budgeted net profit', value: np[0] }, { label: 'Actual net profit', value: np[1] }, { label: 'Variance', value: r2(np[1] - np[0]) }, { label: 'Months compared', value: lbl[0] + (n > 1 ? ' – ' + lbl[n - 1] : ''), money: false }], c) +
          '<div class="mk-scroll" style="margin-top:12px">' + MK.statement(cmp.lines, ['', 'Budget', 'Actual'], c, ex) + '</div>';
        x.sheets.push(MK.sheetFromLines('Budget vs actual', c.company, lbl[0] + ' – ' + lbl[n - 1], ['', 'Budget', 'Actual'], cmp.lines, MK.footerStamp('Accrual', c.fetchedAt), ['money', 'money'])); }
      else html = '';
    } else {
      html = MK.kpis([{ label: 'Budgeted income', value: r2(last('Income') + last('OtherIncome')) }, { label: 'Budgeted expenses', value: r2(last('CostOfSales') + last('Expense') + last('OtherExpense')) }, { label: 'Budgeted net profit', value: pl.calc.NetProfit ? pl.calc.NetProfit[12] : 0 }, { label: 'Categories budgeted', value: rows.length, money: false }], c) +
        '<div class="mk-scroll" style="margin-top:12px">' + MK.statement(pl.lines, [''].concat(lbl).concat(['Total']), c) + '</div>' +
        (bs.length ? '<h3 style="margin-top:20px">Balance sheet budgets</h3><div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Category</th>' + lbl.map(function (l) { return '<th class="num">' + h(l) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
          bs.map(function (r) { return '<tr class="k-row"><td>' + h((r.a.DisplayID || '') + ' ' + (r.a.Name || '')) + '</td>' + r.v.concat([MK.sum(r.v)]).map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '');
      x.sheets.push(MK.sheetFromLines('Budget', c.company, 'Financial year ' + per, [''].concat(lbl).concat(['Total']), pl.lines.concat(bs.map(function (r) { return { kind: 'row', depth: 1, label: (r.a.DisplayID || '') + ' ' + (r.a.Name || '') + ' (balance sheet)', values: r.v.concat([MK.sum(r.v)]) }; })), MK.footerStamp('Accrual', c.fetchedAt), lbl.concat(['Total']).map(function () { return 'money'; })));
    }
    body.innerHTML = html; this._x = x;
    var ties = MK.linesTies(pl.lines), cols = (pl.calc.NetProfit || []).filter(function (v, i) { return !MK.near(v, sumNp(pl, i)); });
    var rowsOk = pl.totals.Income ? Object.keys(pl.totals).every(function (g) { return MK.near(pl.totals[g][12], MK.sum(pl.totals[g].slice(0, 12))); }) : true, lastM = B.LastMonthInFinancialYear;
    var yrOk = +B.FinancialYear === fy && (lastM == null || +lastM % 12 + 1 === fm);
    return { checks: [
      { name: 'MYOB\'s budget is for the financial year asked for, and its year ends where the report\'s does', pass: yrOk, detail: 'FY' + B.FinancialYear + (lastM != null ? ', last month ' + MK.MONTHS[(+lastM + 11) % 12] : '') + (yrOk ? '' : ' — the report expected FY' + fy + ' ending ' + MK.MONTHS[(fm + 10) % 12]) },
      { name: 'Every budget month falls in the financial year', pass: rows.length ? out === 0 : null, detail: out ? out + ' month(s) outside ' + per : rows.length ? rows.length + ' categories × 12 months' : 'No budget set up' },
      { name: 'Every budgeted category is in the chart of accounts', pass: c.errors.accounts ? null : rows.length ? unc.length === 0 : null, detail: c.errors.accounts ? c.err('accounts') : unc.length ? unc.map(function (r) { return r.a.DisplayID || r.a.Name; }).join(', ') : rows.length + ' categories' },
      { name: 'Each category\'s total = Σ its months; section totals = Σ their categories; net profit = the section formula, every month', pass: rows.length ? ties.failed.length === 0 && rowsOk && cols.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : rows.length ? '13 columns' : 'No budget set up' }],
      title: view === 'actual' ? 'Budget vs Actual' : 'Budget Management', period: 'Financial year ' + per,
      notes: ['The account budgets MYOB holds for FY' + fy + ' (MYOB keeps the current and next financial year only), in each category\'s normal balance.' + (view === 'actual' ? ' Actuals are MYOB\'s Profit and Loss from ' + inp.fy_start + ' to ' + inp.act_end + ', compared with the budget for the same whole months.' : '')],
      na: ['Budgets for earlier years (MYOB\'s API keeps the current and next financial year only)', 'Job and category (tracking) budgets'] };
  },
  excel: function () { return (this._x || {}).sheets || []; }
});
```

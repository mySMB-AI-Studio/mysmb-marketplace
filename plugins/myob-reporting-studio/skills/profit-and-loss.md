---
name: MYOB Profit and Loss
description: MYOB Profit and loss (M04) as a live, validated report in MYOB styling. Use when the user asks for a profit and loss, P&L, income statement, trading statement, net profit, income and expenses for a period, or a P&L comparison with last year.
---
# Profit and loss (M04)

Use when the user asks for a profit and loss, P&L, income statement, trading statement, net profit, income and expenses for a period, or a P&L comparison with last year. Load `myob-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `myob-accounting` connector (`get_profit_and_loss_3m`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → Profit and loss. Library: MYOB Reports Prompt Library v1.2 → Prompts → M04. Delivery: Wave 1 (P1, delivery order 1).

## Discovery call

Call `get_profit_and_loss_3m` once with `from_date` = the financial-year start, `to_date` = today and `reporting_basis` = `Accrual`, and call `list_company_files` once. Expect `{StartDate, EndDate, ReportingBasis, AccountsBreakdown:[{Account:{UID,Name,DisplayID}, AccountTotal}]}` — one total per account and **no section totals** (the kit classifies each account with `list_accounts` and adds them up). An empty `AccountsBreakdown` means no activity, not an error. `{"__error": …}` is a failed call.

## Date defaults

`from_date` = start of the period asked for (default: financial-year start, e.g. `2026-07-01`); `to_date` = end of the period (default `"today"`). Set the display preset `p` to match (`this_fy_td` by default; `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). Comparison dates are set by the kit from the Compare to control; leave their defaults.

## Members

| Member / view | How |
|---|---|
| Profit and loss | Report = Profit and Loss (default) |
| Profit and loss as % of income | Report = P&L as % of income |
| Profit and loss comparison | Compare to = Previous period / Previous year / Year to date (adds comparison, $ change and % change columns) |
| Cash basis | Accounting method = Cash |
| Breakdown by month / category / job | N/A — the MYOB API P&L summary returns one total per account (say so; offer the total view) |

## Validation checks (shown in the banner)

- Every account on the P&L is classified (Income, Cost of Sales, Expense, Other Income, Other Expense from the chart of accounts)
- Section totals = Σ their accounts
- Gross Profit = Income − Cost of Sales; Net Profit = Gross Profit − Expenses + Other Income − Other Expenses
- **Independent tie:** for a financial-year-to-date range, Net Profit = Current Year Earnings on the Balance Sheet at the end date (a separate MYOB report); other ranges show this as information
- Comparison period loaded (when Compare to is on)

## Save as

`fileName`: `myob-profit-and-loss.html` · `tags`: ["myob","profit-and-loss","M04","financial-statement"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com, 1 Jul – 9 Sep 2026 accrual: Sales / Total income / Gross profit 2,115.43; Electricity & Gas 290.91; Office Supplies 132.27; Telephone & Internet 81.77; Total expenses 504.95; Net profit 1,610.48; last year 0.00. Live on 28 Sep 2026 (FY to date): Income 4,317.25, Expenses 2,134.49, Net profit 2,182.76.
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
      "name": "compare_from",
      "label": "Compare from",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "compare_to",
      "label": "Compare to",
      "type": "date",
      "default": "2026-06-30"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"pl\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "pnl_compare",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "compare_from"
        },
        "to_date": {
          "kind": "input",
          "input": "compare_to"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bs_end",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "to_date"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
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
MK.app({
  title: 'Profit and Loss', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', cmpStart: 'compare_from', cmpEnd: 'compare_to', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', basis: 'Accrual', compare_from: '2025-07-01', compare_to: '2026-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"pl"}' },
  uses: { pnl: ['from_date', 'to_date', 'basis', 'company_file'], pnl_compare: ['compare_from', 'compare_to', 'basis', 'company_file'], bs_end: ['to_date', 'basis', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss_3m', pnl_compare: 'get_profit_and_loss_3m (comparison period)', bs_end: 'get_balance_sheet (Current Year Earnings at the end date)', accounts: 'list_accounts (classifications)', company_files: 'list_company_files' },
  compare: true,
  views: [['pl', 'Profit and Loss'], ['pct', 'P&L as % of income']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); };
    if (c.errors.pnl) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('pnl')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }] }; }
    if (!c.data.pnl) return {};
    var cmpOn = c.compareMode !== 'none', idx = MK.accounts(c.data.accounts);
    var b = MK.breakdown(cmpOn ? [c.data.pnl, c.data.pnl_compare] : [c.data.pnl], idx, MK.PL_LAYOUT);
    var lines = b.lines.map(function (l) { return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? l.values[1] : null }); });
    var tot = function (k) { return b.totals[k] ? b.totals[k][0] : 0; }, calc = function (k) { return b.calc[k] ? b.calc[k][0] : null; };
    var inc = tot('Income'), cos = tot('CostOfSales'), exp = tot('Expense'), oi = tot('OtherIncome'), oe = tot('OtherExpense'), gp = calc('GrossProfit'), np = calc('NetProfit');
    var npCmp = cmpOn && b.calc.NetProfit ? b.calc.NetProfit[1] : null;
    var extra = cmpOn ? MK.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year to date' }[c.compareMode]) : [];
    if (c.view === 'pct') extra.push({ title: '% of Income', fmt: 'pct', value: function (l) { return inc ? MK.val(l) / inc : null; } });
    var empty = !b.rows.length;
    body.innerHTML = MK.kpis([{ label: 'Total Income', value: inc }, { label: 'Gross Profit', value: gp }, { label: 'Total Expenses', value: exp },
      { label: 'Net Profit', value: np, delta: npCmp ? (np - npCmp) / Math.abs(npCmp) : null }, { label: 'Net margin', text: inc ? MK.pct(np / inc) : '—' }], c) +
      (empty ? '<p class="muted">MYOB recorded no income or expenses in this period.</p>' : '') +
      '<div class="mk-scroll">' + MK.statement(lines, ['', 'Total'], c, extra) + '</div>' +
      '<div class="mk-grid2 detail-block" style="margin-top:16px"><div class="mk-card"><h3>Income vs expenses</h3><div id="ch1"></div></div><div class="mk-card"><h3>Income to net profit</h3><div id="ch2"></div></div></div>';
    MK.bars(document.getElementById('ch1'), { title: 'Income vs expenses', labels: ['Income', 'Cost of Sales', 'Expenses', 'Net Profit'], series: [{ name: 'This period', values: [inc, cos, exp, np] }].concat(cmpOn && b.totals.Income ? [{ name: 'Comparison', values: [b.totals.Income[1], b.totals.CostOfSales[1], b.totals.Expense[1], npCmp] }] : []) }, c);
    MK.waterfall(document.getElementById('ch2'), { title: 'Income to net profit', steps: [{ label: 'Income', value: inc, total: true }, { label: 'Cost of Sales', value: -cos }, { label: 'Expenses', value: -exp }, { label: 'Other income', value: oi }, { label: 'Other exp.', value: -oe }, { label: 'Net Profit', value: np, total: true }] }, c);

    // Checks. Independent tie-out: for a financial-year-to-date range, Net Profit = Current Year Earnings on the Balance Sheet
    // at the end date (a separate MYOB report). Other ranges can't be tied to the Balance Sheet, so that line is information.
    var fyStart = MK.fyStartOf(c.inputs.to_date, c.fy.month), ytd = c.inputs.from_date === fyStart, cyeLine = null, bsErr = c.errors.bs_end;
    if (c.data.bs_end) cyeLine = MK.currentYearEarnings(MK.breakdown([c.data.bs_end], idx, MK.BS_LAYOUT).lines);
    var cye = cyeLine ? MK.val(cyeLine) : null, ties = MK.linesTies(lines);
    var checks = [
      { name: 'Every account on the P&L is classified', pass: c.errors.accounts ? null : b.unclassified.length === 0, detail: c.errors.accounts ? 'Chart of accounts unavailable — classified by account number' : b.unclassified.length ? b.unclassified.length + ' unclassified: ' + b.unclassified.map(function (r) { return r.code + ' ' + r.name; }).join(', ') : b.rows.length + ' accounts' },
      { name: 'Section totals = Σ their accounts', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Gross Profit = Income − Cost of Sales; Net Profit = Gross Profit − Expenses + Other Income − Other Expenses', pass: np == null ? null : MK.near(np, inc - cos - exp + oi - oe) && MK.near(gp, inc - cos), detail: money(np) },
      ytd ? { name: 'Net Profit = Current Year Earnings on the Balance Sheet at ' + c.inputs.to_date, pass: bsErr || cye == null ? null : MK.near(np, cye), detail: bsErr ? c.err('bs_end') : cye == null ? 'No Current Year Earnings account on the Balance Sheet' : money(np) + ' vs ' + money(cye) }
        : { name: 'Net Profit vs Balance Sheet Current Year Earnings (information)', pass: null, info: true, detail: 'Ties only for a financial-year-to-date range (from ' + fyStart + ')' }
    ];
    if (cmpOn) checks.push({ name: 'Comparison period loaded', pass: c.errors.pnl_compare ? false : c.data.pnl_compare ? true : null, detail: c.errors.pnl_compare ? c.err('pnl_compare') : MK.periodLine(c.inputs.compare_from, c.inputs.compare_to) });
    var notes = [];
    if (b.byCode) notes.push(b.byCode + ' account(s) were classified by account number because the chart of accounts did not list them.');
    if (b.headersSkipped.length) notes.push(b.headersSkipped.length + ' header account(s) returned by MYOB were left out so their totals are not counted twice.');
    if (cos < 0) notes.push('Cost of Sales is negative (a net credit) — review the Cost of Sales postings.');
    this._lines = lines; this._extra = extra;
    return { checks: checks, notes: notes, na: ['Monthly or periodic breakdown columns (the MYOB API P&L summary returns one total per account)', 'Category (tracking) and job splits'],
      title: c.view === 'pct' ? 'Profit and Loss as % of income' : cmpOn ? 'Profit and Loss Comparison' : 'Profit and Loss' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Total'].concat(extra.map(function (e) { return e.title; }));
    return [MK.sheetFromLines('Profit and Loss', c.company, MK.periodLine(c.inputs.from_date, c.inputs.to_date), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), MK.footerStamp(c.inputs.basis, c.fetchedAt), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});
```

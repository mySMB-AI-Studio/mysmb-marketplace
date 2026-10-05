---
name: MYOB Trial Balance
description: MYOB Trial Balance (M03) as a live, validated report in MYOB styling. Use when the user asks for a trial balance, TB, debits and credits by account, or every category's balance as at a date.
---
# Trial Balance (M03)

Use when the user asks for a trial balance, TB, debits and credits by account, or every category's balance as at a date. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Trial Balance**. Template: `myob-reporting-studio` / `trial-balance` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_balance_sheet`, `get_profit_and_loss_3m`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → Trial balance. Library: MYOB Reports Prompt Library v1.2 → Prompts → M03. Delivery: Wave 1 (P1, delivery order 12).

## Discovery call

Call `get_balance_sheet` once with `date` = today and `reporting_basis` = `Accrual`, and `list_company_files` once. MYOB's API has no trial balance report: the report takes balance-sheet accounts from the Balance Sheet at the date and income and expense accounts from the Profit and Loss for the financial year to that date. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`as_at` = the balance date (default `"today"`; display preset `a` = `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom`). `fy_start` and `prev_fy_start` are derived by the kit — leave them. For a cash-basis request set `basis` to `Cash`. The view is display `v` (`tb` | `class` | `list`).

## Members

| Member / view | How |
|---|---|
| Trial balance | Every category with its debit or credit balance as at the date (balance-sheet categories at the date, income and expense year to date) |
| By classification | Report = By classification (debit and credit totals per classification) |
| Categories list | Report = Categories list (the whole chart of accounts — also its own template, MYOB Categories List) |
| Activity columns for a date range | See the General ledger (MYOB's trial balance activity detail is not in the API) |

## Validation checks (shown in the banner)

- Total debits = total credits (balance-sheet accounts at the date + income and expense accounts year to date — two MYOB reports); last financial year's profit not yet closed is shown as its own line when it is exactly the difference
- **Independent tie:** Current Year Earnings on the Balance Sheet = net profit for the financial year to date
- Every account is classified (chart of accounts)

## Save as

`fileName`: `myob-trial-balance.html` · `tags`: ["myob","trial-balance","M03","financial-statement"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com, September 2026: 1-1110 Business Bank Account #1 credit 555.45 · 1-1200 Accounts Receivable debit 2,326.96 · GST credit 161.03 · 4-1400 Sales credit 2,115.43 · 6-1430 Electricity & Gas 290.91; debits = credits.
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
      "name": "as_at",
      "label": "As at",
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
      "name": "fy_start",
      "label": "Financial year start",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "prev_fy_start",
      "label": "Last financial year start",
      "type": "date",
      "default": "2025-07-01"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"tb\"}"
    }
  ],
  "bindings": [
    {
      "id": "bs",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
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
      "id": "pnl_ytd",
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
          "input": "as_at"
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
      "id": "pnl_since_prev",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "prev_fy_start"
        },
        "to_date": {
          "kind": "input",
          "input": "as_at"
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
  title: 'Trial Balance', primary: 'bs', files: 'company_files',
  inputs: { asAt: 'as_at', basis: 'basis', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', basis: 'Accrual', fy_start: '2026-07-01', prev_fy_start: '2025-07-01', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"tb"}' },
  uses: { bs: ['as_at', 'basis', 'company_file'], pnl_ytd: ['fy_start', 'as_at', 'basis', 'company_file'], pnl_since_prev: ['prev_fy_start', 'as_at', 'basis', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bs: 'get_balance_sheet (asset, liability and equity balances at the date)', pnl_ytd: 'get_profit_and_loss_3m (income and expense accounts, financial year to the date)', pnl_since_prev: 'get_profit_and_loss_3m (from last financial year start — last year\'s profit, if not yet closed)', accounts: 'list_accounts (classification)', company_files: 'list_company_files' },
  views: [['tb', 'Trial Balance'], ['class', 'By classification'], ['list', 'Categories list']],
  derive: function (inp, fyMonth) { var f = MK.fyStartOf(inp.as_at, fyMonth); return { fy_start: f, prev_fy_start: (Number(f.slice(0, 4)) - 1) + f.slice(4) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var need = ['bs', 'pnl_ytd'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Balance Sheet and Profit and Loss loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.bs || !c.data.pnl_ytd) return {};
    var idx = MK.accounts(c.data.accounts), bsB = MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT), plB = MK.breakdown([c.data.pnl_ytd], idx, MK.PL_LAYOUT);
    var DR = { Asset: 1, Expense: 1, CostOfSales: 1, OtherExpense: 1 }, ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'CostOfSales', 'Expense', 'OtherIncome', 'OtherExpense'];
    var LABEL = { Asset: 'Assets', Liability: 'Liabilities', Equity: 'Equity', Income: 'Income', CostOfSales: 'Cost of Sales', Expense: 'Expenses', OtherIncome: 'Other Income', OtherExpense: 'Other Expenses' };
    // every account once: balance-sheet accounts at the date, income and expense accounts for the financial year to the date. Current
    // Year Earnings is left out — the income and expense accounts are its detail (counting both would double the year's profit).
    var cyeRow = bsB.rows.filter(function (r) { return !r.header && MK.CYE_RE.test(r.name); })[0], cye = cyeRow ? cyeRow.values[0] : null;
    var rows = bsB.rows.filter(function (r) { return !r.header && r !== cyeRow && /^(Asset|Liability|Equity)$/.test(r.cls); }).concat(plB.rows.filter(function (r) { return !r.header && /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/.test(r.cls); }))
      .map(function (r) { var v = r.values[0] || 0, debit = DR[r.cls] ? v >= 0 : v < 0; return { code: r.code, name: r.name, cls: r.cls, label: LABEL[r.cls] || r.cls, debit: debit && Math.abs(v) >= 0.005 ? r2(Math.abs(v)) : null, credit: !debit && Math.abs(v) >= 0.005 ? r2(Math.abs(v)) : null, value: v }; });
    var unclassified = bsB.unclassified.concat(plB.unclassified);
    // last financial year's profit not yet closed into Retained Earnings: MYOB's account summary leaves it out, so debits ≠ credits by it
    var plTwo = c.data.pnl_since_prev ? MK.breakdown([c.data.pnl_since_prev], idx, MK.PL_LAYOUT) : null, prevNp = plTwo ? r2(plTwo.calc.NetProfit[0] - plB.calc.NetProfit[0]) : null;
    var sum = function (k) { return MK.sum(rows.map(function (r) { return r[k]; })); }, Dr = sum('debit'), Cr = sum('credit'), gap = r2(Dr - Cr), unclosed = Math.abs(gap) >= 0.01 && prevNp != null && MK.near(gap, prevNp);
    if (unclosed) { rows.push({ code: '', name: 'Prior year earnings not yet closed to Retained Earnings', cls: 'Equity', label: 'Equity', debit: gap < 0 ? -gap : null, credit: gap > 0 ? gap : null, value: gap, calc: true }); Dr = sum('debit'); Cr = sum('credit'); }
    rows.sort(function (a, b) { return ORDER.indexOf(a.cls) - ORDER.indexOf(b.cls) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }); });
    var shown = c.display.zeros ? rows : rows.filter(function (r) { return r.debit != null || r.credit != null; });
    var byClass = ORDER.map(function (k) { var l = rows.filter(function (r) { return r.cls === k; }); return { label: LABEL[k], debit: MK.sum(l.map(function (r) { return r.debit; })), credit: MK.sum(l.map(function (r) { return r.credit; })), n: l.length }; }).filter(function (x) { return x.n; });
    body.innerHTML = MK.kpis([{ label: 'Total debits', value: Dr }, { label: 'Total credits', value: Cr }, { label: 'Difference', value: r2(Dr - Cr) }, { label: 'Accounts', value: rows.length, money: false }], c) +
      (unclosed ? '<p class="muted">Last financial year\'s profit (' + money(gap) + ') has not been closed into Retained Earnings in this file (the year was not rolled over); it is shown as its own line so the trial balance can be read.</p>' : '') +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (c.view === 'class' ? 'By classification' : (c.view === 'list' ? 'Categories list — ' : 'Trial Balance — ') + MK.asOfLine(c.inputs.as_at).replace(/^As at /, '')) + '</h3><div id="tb-grid"></div></div>';
    // Categories list (M10): the whole chart of accounts in MYOB's order — header accounts as labels, inactive accounts marked — with each
    // account's balance at the date (the reports above) and its current balance today (list_accounts, a separate MYOB endpoint)
    var at = {}; bsB.rows.concat(plB.rows).forEach(function (r) { if (!r.header) { if (r.uid) at[r.uid] = r.values[0]; if (r.code) at['#' + r.code] = r.values[0]; } });
    var chart = idx.list.slice().sort(function (a, b) { return ORDER.indexOf(a.Classification) - ORDER.indexOf(b.Classification) || String(a.DisplayID).localeCompare(String(b.DisplayID), undefined, { numeric: true }); });
    var L = chart.map(function (a) { var v = a.IsHeader ? null : (a.UID in at ? at[a.UID] : at['#' + a.DisplayID] != null ? at['#' + a.DisplayID] : 0); return { code: a.DisplayID || '', name: a.Name || '', cls: a.Classification, type: a.Type || '', active: a.IsActive === false ? 'No' : 'Yes', head: !!a.IsHeader, depth: Math.max(0, (Number(a.Level) || 1) - 1), at: v == null ? null : r2(v), now: a.IsHeader || a.CurrentBalance == null ? null : r2(MK.num(a.CurrentBalance) || 0) }; });
    if (c.view === 'list') {
      var showL = L.filter(function (r) { return r.head || c.display.zeros || Math.abs(r.at || 0) >= 0.005 || Math.abs(r.now || 0) >= 0.005; }), t = '';
      ORDER.forEach(function (k) { var g = showL.filter(function (r) { return r.cls === k; }); if (!g.length) return;
        t += '<tr class="k-header"><td colspan="5">' + MK.h(LABEL[k]) + '</td></tr>' + g.map(function (r) { return r.head ? '<tr class="k-header"><td style="padding-left:' + (8 + r.depth * 16) + 'px">' + MK.h(r.code) + '</td><td colspan="4">' + MK.h(r.name) + '</td></tr>' : '<tr class="k-row detail-block"><td style="padding-left:' + (8 + r.depth * 16) + 'px">' + MK.h(r.code) + '</td><td>' + MK.h(r.name) + (r.active === 'No' ? ' <span class="muted">(inactive)</span>' : '') + '</td><td>' + MK.h(r.type) + '</td><td class="num">' + money(r.at) + '</td><td class="num">' + (r.now == null ? '' : money(r.now)) + '</td></tr>'; }).join('') +
          '<tr class="k-total"><td colspan="3">Total ' + MK.h(LABEL[k]) + '</td><td class="num">' + money(MK.sum(g.map(function (r) { return r.at; }))) + '</td><td class="num">' + money(MK.sum(g.map(function (r) { return r.now; }))) + '</td></tr>'; });
      document.getElementById('tb-grid').innerHTML = '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Account No.</th><th>Account</th><th>Type</th><th class="num">Balance ' + MK.h(MK.asOfLine(c.inputs.as_at).replace(/^As at /, '')) + '</th><th class="num">Current balance (today)</th></tr></thead><tbody>' + (t || '<tr><td colspan="5" class="muted">MYOB returned no chart of accounts.</td></tr>') + '</tbody></table></div>';
    } else if (c.view === 'class') MK.grid(document.getElementById('tb-grid'), { rows: byClass, columns: [{ key: 'label', title: 'Classification' }, { key: 'debit', title: 'Debit', money: true }, { key: 'credit', title: 'Credit', money: true }], total: { label: 'Total', debit: Dr, credit: Cr } }, c);
    else MK.grid(document.getElementById('tb-grid'), { rows: shown, filter: true, columns: [{ key: 'code', title: 'Account No.' }, { key: 'name', title: 'Account' }, { key: 'label', title: 'Classification' }, { key: 'debit', title: 'Debit', money: true }, { key: 'credit', title: 'Credit', money: true }], total: { code: 'Total', debit: Dr, credit: Cr }, empty: 'No account balances at this date.' }, c);
    var np = plB.calc.NetProfit[0];
    var checks = [
      { name: 'Total debits = total credits (balance-sheet accounts at the date + income and expense accounts year to date — two MYOB reports)', pass: MK.near(Dr, Cr), detail: money(Dr) + ' vs ' + money(Cr) + (unclosed ? ' (with last year\'s unclosed profit ' + money(gap) + ')' : MK.near(Dr, Cr) ? '' : ' — difference ' + money(r2(Dr - Cr))) },
      { name: 'Current Year Earnings on the Balance Sheet = net profit for the financial year to date (the P&L accounts above)', pass: cye == null ? null : MK.near(cye, np), detail: cye == null ? 'N/A — no Current Year Earnings account on the Balance Sheet' : money(cye) + ' vs ' + money(np) },
      { name: 'Every account is classified (chart of accounts)', pass: unclassified.length === 0, detail: unclassified.length ? unclassified.length + ' account(s) unclassified, e.g. ' + unclassified[0].name : rows.length + ' accounts' }
    ];
    if (c.view === 'list') { // balance-sheet categories (not Current Year Earnings or retained earnings, which move at a rollover): today's current balance = the Balance Sheet today
      var bsL = L.filter(function (r) { return !r.head && /^(Asset|Liability|Equity)$/.test(r.cls) && r.now != null && !MK.CYE_RE.test(r.name) && !/retained (earnings|profits)/i.test(r.name); }), off = bsL.filter(function (r) { return !MK.near(r.at, r.now); }), today = c.inputs.as_at === c.today;
      checks.push({ name: 'Balance-sheet categories: current balance (list_accounts) = the Balance Sheet today (two MYOB endpoints)', pass: !today || !idx.loaded ? null : off.length === 0, detail: !idx.loaded ? (c.err('accounts') || 'Chart of accounts unavailable') : !today ? 'N/A — current balances are today\'s; set the date to today to compare' : off.length ? off.length + ' differ, e.g. ' + off[0].code + ' ' + money(off[0].now) + ' vs ' + money(off[0].at) : bsL.length + ' categories' });
    }
    this._x = { rows: rows, Dr: Dr, Cr: Cr, L: L };
    return { checks: checks, title: { tb: 'Trial Balance', class: 'Trial Balance', list: 'Categories List' }[c.view] || this.title, notes: ['MYOB\'s API has no trial balance report: balance-sheet accounts come from the Balance Sheet at the date, and income and expense accounts from the Profit and Loss for the financial year to that date (' + c.inputs.fy_start + ' to ' + c.inputs.as_at + '). Current Year Earnings is shown through the income and expense accounts.', 'Debit or credit follows each account\'s normal balance; a contra balance moves to the other column.'],
      na: ['Year-end adjustments (the reports are run without them)', 'Opening-balance and journal columns (MYOB\'s trial balance detail is not in the API)'], period: MK.asOfLine(c.inputs.as_at) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Trial Balance', s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], [], ['Account No.', 'Account', 'Classification', 'Debit', 'Credit'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.rows.map(function (r) { return [r.code, r.name, r.label, r.debit == null ? '' : { v: r.debit, s: 'money' }, r.credit == null ? '' : { v: r.credit, s: 'money' }]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', { v: x.Dr, s: 'moneyBold' }, { v: x.Cr, s: 'moneyBold' }]]);
    var cl = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Categories List', s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], [], ['Account No.', 'Account', 'Classification', 'Type', 'Active', 'Header', 'Balance at the date', 'Current balance (today)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.L.map(function (r) { return [r.code, r.name, r.cls, r.type, r.active, r.head ? 'Yes' : '', r.at == null ? '' : { v: r.at, s: 'money' }, r.now == null ? '' : { v: r.now, s: 'money' }]; }));
    return [{ name: 'Trial Balance', rows: rows, widths: [12, 36, 16, 16, 16] }, { name: 'Categories list', rows: cl, widths: [12, 36, 16, 16, 8, 8, 18, 18] }];
  }
});
```

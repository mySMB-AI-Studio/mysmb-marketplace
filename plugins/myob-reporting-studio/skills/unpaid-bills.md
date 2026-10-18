---
name: MYOB Unpaid Bills
description: MYOB Unpaid Bills (M40) as a live, validated report in MYOB styling. Use when the user asks for unpaid bills, what they owe suppliers, outstanding purchase bills, a payment run list, or payables by supplier with ageing.
---
# Unpaid Bills (M40)

Use when the user asks for unpaid bills, what they owe suppliers, outstanding purchase bills, a payment run list, or payables by supplier with ageing. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Unpaid Bills**. Template: `myob-reporting-studio` / `unpaid-bills` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_bills`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Purchases → Unpaid bills. Library: MYOB Reports Prompt Library v1.2 → Prompts → M40. Delivery: Wave 2 (P2).

## Discovery call

Call `list_bills` once with `status` = `Open`, and `list_company_files` once. Expect `{Count, Items:[{Number, Date, SupplierInvoiceNumber, Supplier{Name, DisplayID, UID}, BalanceDueAmount, TotalAmount, TotalTax, Terms{DueDate}, Status}]}`. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

Always as at today — MYOB's API gives today's open balances (the kit sets `as_at`; leave it). The ageing method is `method` (`Bill date` — MYOB's default — or `Due date`). The view is display `v` (`suppliers` | `bills`).

## Members

| Member / view | How |
|---|---|
| Unpaid bills | Supplier name | Supplier number | 0 - 30 | 31 - 60 | 61 - 90 | 90+ | Total due, one row per supplier, totals row |
| Bills | Report = Bills (each open bill with its age) |
| Ageing by due date | Ageing method = Days since due date (adds a Not due column) |
| As at an earlier date | N/A — MYOB's API gives today's open balances |

## Validation checks (shown in the banner)

- Each supplier's total due = Σ its age buckets, and the report total = Σ the bills
- **Independent tie:** total due = the payables account (type Accounts Payable) on the Balance Sheet
- Every unpaid bill has a supplier (and a due date when ageing by due date)

## Save as

`fileName`: `myob-unpaid-bills.html` · `tags`: ["myob","unpaid-bills","M40","payables"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com as at 9 Sep 2026: no unpaid bills (the sample file is empty — the columns mirror Unpaid invoices); on a file with bills, the total due = the payables account.
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
      "name": "method",
      "label": "Ageing method",
      "type": "enum",
      "options": [
        "Bill date",
        "Due date"
      ],
      "default": "Bill date"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"suppliers\"}"
    }
  ],
  "bindings": [
    {
      "id": "bills",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bills"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "Open"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
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
MK.app({
  title: 'Unpaid Bills', primary: 'bs', files: 'company_files',
  // no as-at control: MYOB's API gives today's open balances, so the report is always as at today (as_at feeds the Balance Sheet tie)
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', method: 'Bill date', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"suppliers"}' },
  uses: { bills: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bills: 'list_bills (open purchase bills — every page)', bs: 'get_balance_sheet (the payables account today, for the tie)', accounts: 'list_accounts (which accounts are payables)', company_files: 'list_company_files' },
  enums: [{ input: 'method', label: 'Ageing method', options: [['Bill date', 'Days since bill date'], ['Due date', 'Days since due date']] }],
  roll: function () { return { as_at: MK.asAt('today') }; }, // MYOB's API gives today's open balances, so the report is always as at today
  views: [['suppliers', 'By supplier'], ['bills', 'Bills']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, asAt = c.inputs.as_at, byDue = c.inputs.method === 'Due date';
    if (c.errors.bills) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('bills')) + '</p>'; return { checks: [{ name: 'Open bills loaded', pass: false, detail: c.err('bills') }] }; }
    if (!c.data.bills) return {};
    var days = function (a) { return Math.round((MK.parse(asAt) - MK.parse(a)) / 86400000); };
    var COLS = byDue ? ['Not due', '1 - 30', '31 - 60', '61 - 90', '90+'] : ['0 - 30', '31 - 60', '61 - 90', '90+'];
    var bucket = function (d) { return byDue ? (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4) : (d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3); };
    var inv = MK.items(c.data.bills).filter(function (i) { return i && (MK.num(i.BalanceDueAmount) || 0) !== 0; }).map(function (i) {
      var date = MK.isoDate(i.Date), due = MK.isoDate((i.Terms || {}).DueDate) || date, cu = i.Supplier || {}, bal = MK.num(i.BalanceDueAmount) || 0, tot = MK.num(i.TotalAmount) || 0;
      var age = days(byDue ? due : date); return { number: i.Number || '', date: date, due: due, supplier: cu.Name || '(no supplier)', cid: cu.UID || cu.Name || '', cno: MK.cardId(cu.DisplayID), balance: r2(bal), total: tot, tax: tot ? r2(bal * (MK.num(i.TotalTax) || 0) / tot) : 0, age: age, b: bucket(age), noDue: !(i.Terms || {}).DueDate }; });
    var byC = {}; inv.forEach(function (x) { var k = x.cid; if (!byC[k]) byC[k] = { name: x.supplier, no: x.cno, b: COLS.map(function () { return 0; }), total: 0, n: 0 }; var y = byC[k]; y.b[x.b] = r2(y.b[x.b] + x.balance); y.total = r2(y.total + x.balance); y.n++; });
    var cust = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var tot = COLS.map(function (_, j) { return MK.sum(cust.map(function (x) { return x.b[j]; })); }), all = MK.sum(inv.map(function (x) { return x.balance; }));
    // the payables account(s) on the Balance Sheet: Type AccountsPayable in the chart of accounts
    var idx = MK.accounts(c.data.accounts), bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null;
    var arRows = bsB ? bsB.rows.filter(function (r) { return !r.header && (r.type === 'AccountsPayable' || (!idx.loaded && /payable|creditors/i.test(r.name))); }) : [], control = arRows.length ? MK.sum(arRows.map(function (r) { return r.values[0]; })) : null;
    var view = c.view || 'suppliers', colObjs = COLS.map(function (t, j) { return { key: 'b' + j, title: t, money: true }; });
    body.innerHTML = MK.kpis([{ label: 'Total due', value: all }, { label: 'Suppliers', value: cust.length, money: false }, { label: 'Bills', value: inv.length, money: false }, { label: COLS[COLS.length - 1] + ' days', value: tot[COLS.length - 1] }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>Unpaid bills — ' + MK.asOfLine(asAt).replace(/^As at /, '') + ' · ' + (byDue ? 'days since due date' : 'days since bill date') + '</h3><div id="ar-grid"></div></div>' +
      '<div class="mk-card detail-block" style="margin-top:16px"><h3>Ageing</h3><div id="ar-chart"></div></div>';
    if (view === 'bills') MK.grid(document.getElementById('ar-grid'), { rows: inv.map(function (x) { return Object.assign({}, x, { bucketT: COLS[x.b] }); }).sort(function (a, b) { return b.age - a.age; }), filter: true,
      columns: [{ key: 'supplier', title: 'Supplier name' }, { key: 'number', title: 'Bill no.' }, { key: 'date', title: 'Date' }, { key: 'due', title: 'Due date' }, { key: 'age', title: 'Days', num: true }, { key: 'bucketT', title: 'Age' }, { key: 'balance', title: 'Total due ($)', money: true }],
      total: { supplier: 'Total', balance: all }, empty: 'No unpaid bills.' }, c);
    else MK.grid(document.getElementById('ar-grid'), { rows: cust.map(function (x) { var o = { name: x.name, no: x.no, total: x.total }; x.b.forEach(function (v, j) { o['b' + j] = v; }); return o; }), filter: true,
      columns: [{ key: 'name', title: 'Supplier name' }, { key: 'no', title: 'Supplier number' }].concat(colObjs).concat([{ key: 'total', title: 'Total due ($)', money: true }]),
      total: (function () { var o = { name: 'Total', total: all }; tot.forEach(function (v, j) { o['b' + j] = v; }); return o; })(), empty: 'No unpaid bills.' }, c);
    MK.bars(document.getElementById('ar-chart'), { title: 'Total due by age', labels: COLS, series: [{ name: 'Total due', values: tot }] }, c);
    var rowBad = cust.filter(function (x) { return !MK.near(MK.sum(x.b), x.total); });
    var checks = [
      { name: 'Each supplier\'s total due = Σ its age buckets, and the report total = Σ the bills', pass: rowBad.length === 0 && MK.near(MK.sum(tot), all), detail: rowBad.length ? rowBad.length + ' supplier(s) differ' : money(all) + ' over ' + inv.length + ' bill(s)' },
      control == null ? { name: 'Total due = the payables account on the Balance Sheet', pass: null, detail: c.err('bs') || 'N/A — no payables account found in the chart of accounts' }
        : { name: 'Total due = the payables account on the Balance Sheet (' + arRows.map(function (r) { return r.code || r.name; }).join(', ') + ')', pass: MK.near(all, control), detail: money(all) + ' vs ' + money(control) + (MK.near(all, control) ? '' : ' — out of balance ' + money(r2(all - control)) + ': see Payables reconciliation') },
      { name: 'Every unpaid bill has a supplier' + (byDue ? ' and a due date' : ''), pass: inv.every(function (x) { return x.cid && (!byDue || !x.noDue); }), detail: inv.filter(function (x) { return !x.cid || (byDue && x.noDue); }).length + ' without' }
    ];
    this._x = { cust: cust, inv: inv, COLS: COLS, tot: tot, all: all };
    return { checks: checks, notes: ['Open purchase bills with their balance due today, aged by ' + (byDue ? 'days since the due date (not yet due in its own column)' : 'days since the bill date (MYOB\'s default)') + '. Tax outstanding on a part-paid bill is pro rata.'],
      na: ['Unpaid bills as at an earlier date (MYOB\'s API gives today\'s open balances)'], period: MK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Unpaid bills', s: 'bold' }], [MK.asOfLine(c.inputs.as_at) + ' · ' + (c.inputs.method === 'Due date' ? 'days since due date' : 'days since bill date')], [],
      ['Supplier name', 'Supplier number'].concat(x.COLS).concat(['Total due ($)']).map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.cust.map(function (r) { return [r.name, r.no].concat(r.b.map(function (v) { return { v: v, s: 'money' }; })).concat([{ v: r.total, s: 'money' }]); }))
      .concat([[{ v: 'Total', s: 'bold' }, ''].concat(x.tot.map(function (v) { return { v: v, s: 'moneyBold' }; })).concat([{ v: x.all, s: 'moneyBold' }])]);
    var inv = [[{ v: 'Supplier name', s: 'bold' }, { v: 'Bill no.', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Days', s: 'bold' }, { v: 'Total due ($)', s: 'bold' }]].concat(x.inv.map(function (r) { return [r.supplier, r.number, r.date, r.due, r.age, { v: r.balance, s: 'money' }]; }));
    return [{ name: 'Unpaid bills', rows: rows, widths: [32, 16, 14, 14, 14, 14, 14, 16] }, { name: 'Bills', rows: inv, widths: [32, 14, 12, 12, 8, 16] }];
  }
});
```

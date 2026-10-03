---
name: MYOB Purchase Register
description: MYOB Purchase Register (M46) as a live, validated report in MYOB styling. Use when the user asks for a purchase register, a list of purchase bills for a period, or bills by status.
---
# Purchase Register (M46)

Use when the user asks for a purchase register, a list of purchase bills for a period, or bills by status. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Purchase Register**. Template: `myob-reporting-studio` / `purchase-register` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_bills`, `list_journal_transactions`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Purchases → Purchase register. Library: MYOB Reports Prompt Library v1.2 → Prompts → M46. Delivery: Wave 2 (P2).

## Discovery call

Call `list_bills` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `status` = `All`, `Open` or `Closed`. `as_at` is set by the kit. The view is display `v` (`register` | `suppliers`).

## Members

| Member / view | How |
|---|---|
| Purchase register | Date | PO No. | Supplier Inv No. | Supplier name | Amount | Amount due | Status, totals row |
| Supplier purchases | Report = Supplier purchases (M43) |
| Purchase orders, quotes and the Received column | N/A — the connector reads bills only |

## Validation checks (shown in the banner)

- **Independent tie:** Σ bill amounts (with tax) = the credits to the payables account in the period's journals
- Σ amount due = the payables account on the Balance Sheet (when every open bill is in the period; information otherwise)
- Counts by status add up to the bills listed

## Save as

`fileName`: `myob-purchase-register.html` · `tags`: ["myob","purchase-register","M46","purchases"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com 1 Jul – 9 Sep 2026: no bills on the sample file; on a file with bills, Σ bills = the payables account's credits in the period.
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
      "name": "as_at",
      "label": "Balances as at",
      "type": "date",
      "default": "today"
    },
    {
      "name": "status",
      "label": "Bill status",
      "type": "enum",
      "options": [
        "All",
        "Open",
        "Closed"
      ],
      "default": "All"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"register\"}"
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
          "value": "All"
        },
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "open",
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
      "id": "journals",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_journal_transactions"
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
  title: 'Purchase Register', primary: 'bs', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', as_at: '2026-09-28', status: 'All', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"register"}' },
  uses: { bills: ['from_date', 'to_date', 'company_file'], open: ['company_file'], journals: ['from_date', 'to_date', 'company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bills: 'list_bills (purchase bills dated in the period — every status, every page)', open: 'list_bills (every open bill — current balances)', journals: 'list_journal_transactions (the payables account\'s postings in the period, for the tie)', bs: 'get_balance_sheet (the payables account today)', accounts: 'list_accounts (which accounts are payables)', company_files: 'list_company_files' },
  enums: [{ input: 'status', label: 'Bill status', options: [['All', 'All bills'], ['Open', 'Open'], ['Closed', 'Closed']] }],
  roll: function () { return { as_at: MK.asAt('today') }; },
  views: [['register', 'Purchase register'], ['suppliers', 'Supplier purchases']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date, st = c.inputs.status || 'All';
    if (c.errors.bills) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('bills')) + '</p>'; return { checks: [{ name: 'Bills loaded', pass: false, detail: c.err('bills') }] }; }
    if (!c.data.bills) return {};
    var doc = function (b) { var su = b.Supplier || {}, tot = MK.num(b.TotalAmount) || 0, tax = MK.num(b.TotalTax) || 0, sub = MK.num(b.Subtotal), incl = !!b.IsTaxInclusive; return { date: MK.isoDate(b.Date), number: b.Number || '', sinv: b.SupplierInvoiceNumber || '', supplier: su.Name || '(no supplier)', sid: su.UID || su.Name || '', sno: MK.cardId(su.DisplayID), total: r2(tot), due: r2(MK.num(b.BalanceDueAmount) || 0), status: b.Status || '', tax: r2(tax), buy: r2(sub != null ? (incl ? sub - tax : sub) : tot - tax) }; };
    var all = MK.items(c.data.bills).filter(Boolean).map(doc), inP = all.filter(function (d) { return d.date >= from && d.date <= to; }), list = inP.filter(function (d) { return st === 'All' || d.status === st; });
    list.sort(function (a, b) { return a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)); });
    var open = c.data.open ? MK.items(c.data.open).filter(Boolean).map(doc) : null, bal = {}; (open || []).forEach(function (d) { bal[d.sid] = r2((bal[d.sid] || 0) + d.due); });
    var byS = {}; list.forEach(function (d) { if (!byS[d.sid]) byS[d.sid] = { name: d.supplier, no: d.sno, buy: 0, tax: 0, n: 0, sid: d.sid }; var y = byS[d.sid]; y.buy = r2(y.buy + d.buy); y.tax = r2(y.tax + d.tax); y.n++; });
    var sup = Object.keys(byS).map(function (k) { var y = byS[k]; y.balance = open ? (bal[y.sid] || 0) : null; return y; }).sort(function (a, b) { return b.buy - a.buy || a.name.localeCompare(b.name); });
    var T = { total: MK.sum(list.map(function (d) { return d.total; })), due: MK.sum(list.map(function (d) { return d.due; })), buy: MK.sum(list.map(function (d) { return d.buy; })), tax: MK.sum(list.map(function (d) { return d.tax; })) };
    var counts = {}; list.forEach(function (d) { counts[d.status] = (counts[d.status] || 0) + 1; });
    var view = c.view || 'register', top = sup[0], share = top && T.buy ? top.buy / T.buy : null;
    body.innerHTML = MK.kpis(view === 'suppliers' ? [{ label: 'Purchases (ex tax)', value: T.buy }, { label: 'Tax', value: T.tax }, { label: 'Suppliers', value: sup.length, money: false }, { label: 'Largest supplier share', text: share == null ? 'N/A' : MK.pct(share, 0) + ' · ' + top.name }]
      : [{ label: 'Bills', value: list.length, money: false }, { label: 'Amount', value: T.total }, { label: 'Amount due', value: T.due }, { label: 'By status', text: Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(' · ') || 'None' }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'suppliers' ? 'Supplier purchases' : 'Purchase register') + ' — ' + MK.h(MK.periodLine(from, to)) + (st !== 'All' ? ' · ' + st + ' bills' : '') + '</h3><div id="pg-grid"></div></div>' +
      (view === 'suppliers' ? '<div class="mk-card detail-block" style="margin-top:16px"><h3>Purchases by supplier (top 10)</h3><div id="pg-chart"></div></div>' : '');
    if (view === 'suppliers') {
      MK.grid(document.getElementById('pg-grid'), { rows: sup, filter: true, columns: [{ key: 'name', title: 'Supplier name' }, { key: 'no', title: 'Supplier number' }, { key: 'buy', title: 'Purchase amount ($)', money: true }, { key: 'tax', title: 'Tax ($)', money: true }, { key: 'balance', title: 'Current balance ($)', money: true }],
        total: { name: 'Total', buy: T.buy, tax: T.tax, balance: open ? MK.sum(sup.map(function (x) { return x.balance; })) : null }, empty: 'No purchases in this period.' }, c);
      MK.bars(document.getElementById('pg-chart'), { title: 'Purchases by supplier', labels: sup.slice(0, 10).map(function (x) { return x.name; }), series: [{ name: 'Purchase amount', values: sup.slice(0, 10).map(function (x) { return x.buy; }) }] }, c);
    } else MK.grid(document.getElementById('pg-grid'), { rows: list, filter: true, columns: [{ key: 'date', title: 'Date' }, { key: 'number', title: 'PO No.' }, { key: 'sinv', title: 'Supplier Inv No.' }, { key: 'supplier', title: 'Supplier name' }, { key: 'total', title: 'Amount ($)', money: true }, { key: 'due', title: 'Amount due ($)', money: true }, { key: 'status', title: 'Status' }],
      total: { date: 'Total', total: T.total, due: T.due }, empty: 'No bills in this period.' }, c);
    // ties: the bills to the payables account's movement in the period's journals, leaving out supplier payments (two MYOB sources); amount due to the payables
    // account on the Balance Sheet (when the register holds every open bill)
    var idx = MK.accounts(c.data.accounts), isAP = function (a) { var x = (a.UID && idx.byUid[a.UID]) || (a.DisplayID && idx.byCode[a.DisplayID]); return x ? x.Type === 'AccountsPayable' : !idx.loaded && /payable|creditors/i.test(a.Name || ''); };
    var cr = c.data.journals ? MK.sum([].concat.apply([], MK.items(c.data.journals).map(function (t) { var dt = MK.isoDate(t.DateOccurred); return dt >= from && dt <= to && !/^Cash/i.test(t.JournalType || '') ? (t.Lines || []).filter(function (l) { return isAP(l.Account || {}); }).map(function (l) { var a = Math.abs(MK.num(l.Amount) || 0); return l.IsCredit ? a : -a; }) : []; }))) : null;
    var bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null, apRows = bsB ? bsB.rows.filter(function (r) { return !r.header && r.type === 'AccountsPayable'; }) : [], control = apRows.length ? MK.sum(apRows.map(function (r) { return r.values[0]; })) : null;
    var allOpenIn = open ? open.every(function (d) { return d.date >= from && d.date <= to; }) : false, totAll = MK.sum(inP.map(function (d) { return d.total; }));
    var checks = [
      { name: 'Σ bill amounts (with tax) = the payables account\'s movement in the period\'s journals, leaving out supplier payments (a separate MYOB source)', pass: cr == null ? null : MK.near(totAll, cr), detail: cr == null ? (c.err('journals') || 'N/A') : money(totAll) + ' vs ' + money(cr) + (MK.near(totAll, cr) ? '' : ' — difference ' + money(r2(cr - totAll)) + ': a general journal or other posting to the payables account') },
      !allOpenIn || st === 'Closed' ? { name: 'Σ amount due vs the payables account (information — the period does not hold every open bill)', pass: null, info: true, detail: money(T.due) + ' due in the period' + (control != null ? '; payables account ' + money(control) : '') }
        : { name: 'Σ amount due = the payables account on the Balance Sheet (every open bill is in the period)', pass: control == null ? null : MK.near(T.due, control), detail: control == null ? (c.err('bs') || 'N/A') : money(T.due) + ' vs ' + money(control) },
      { name: 'Counts by status add up to the bills listed', pass: Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0) === list.length, detail: Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(', ') || 'none' },
      view === 'suppliers' && open ? { name: 'Every supplier\'s current balance (open bills, as on Unpaid bills) adds up to the payables account on the Balance Sheet', pass: control == null ? null : MK.near(MK.sum(Object.keys(bal).map(function (k) { return bal[k]; })), control), detail: money(MK.sum(Object.keys(bal).map(function (k) { return bal[k]; }))) + ' on ' + open.length + ' open bill(s)' + (control == null ? '' : ' vs ' + money(control)) } : null
    ].filter(Boolean);
    this._x = { list: list, sup: sup, T: T, view: view };
    return { checks: checks, title: view === 'suppliers' ? 'Supplier Purchases' : 'Purchase Register', notes: ['Purchase bills dated in the period (MYOB\'s generic bill list); purchase amount = the subtotal before tax.' + (view === 'suppliers' ? ' Current balance is each supplier\'s balance due on every open bill today.' : '')],
      na: ['Purchase orders and quotes, and the Received column (the connector reads bills only)', 'Supplier purchases (detail, M44) — bill lines are not confirmed in the connector\'s bill list'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (n) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: n, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    var reg = head('Purchase register').concat([['Date', 'PO No.', 'Supplier Inv No.', 'Supplier name', 'Amount ($)', 'Amount due ($)', 'Status'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.list.map(function (d) { return [d.date, d.number, d.sinv, d.supplier, mv(d.total), mv(d.due), d.status]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', '', { v: x.T.total, s: 'moneyBold' }, { v: x.T.due, s: 'moneyBold' }]]);
    var sp = head('Supplier purchases').concat([['Supplier name', 'Supplier number', 'Purchase amount ($)', 'Tax ($)', 'Current balance ($)'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.sup.map(function (r) { return [r.name, r.no, mv(r.buy), mv(r.tax), mv(r.balance)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', { v: x.T.buy, s: 'moneyBold' }, { v: x.T.tax, s: 'moneyBold' }]]);
    return x.view === 'suppliers' ? [{ name: 'Supplier purchases', rows: sp, widths: [32, 16, 18, 14, 18] }, { name: 'Purchase register', rows: reg, widths: [12, 12, 16, 32, 16, 16, 10] }] : [{ name: 'Purchase register', rows: reg, widths: [12, 12, 16, 32, 16, 16, 10] }, { name: 'Supplier purchases', rows: sp, widths: [32, 16, 18, 14, 18] }];
  }
});
```

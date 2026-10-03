---
name: MYOB Sales Register
description: MYOB Sales Register (M38) as a live, validated report in MYOB styling. Use when the user asks for a sales register, a list of sales invoices for a period, or invoices by status.
---
# Sales Register (M38)

Use when the user asks for a sales register, a list of sales invoices for a period, or invoices by status. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Sales Register**. Template: `myob-reporting-studio` / `sales-register` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_invoices`, `get_profit_and_loss_3m`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Sales → Sales register. Library: MYOB Reports Prompt Library v1.2 → Prompts → M38. Delivery: Wave 1 (P1, delivery order 10).

## Discovery call

Call `list_invoices` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `status` = `All`, `Open` or `Closed`. `as_at` is set by the kit. The view is display `v` (`register` | `customers`).

## Members

| Member / view | How |
|---|---|
| Sales register | Date | Invoice No. | Customer PO No. | Customer name | Total amount | Amount due | Status, totals row |
| Customer sales | Report = Customer sales (M35) |
| Quotes and orders | N/A — the connector reads invoices only |

## Validation checks (shown in the banner)

- **Independent tie:** Σ sale amount (ex tax) = Income on the Profit and Loss for the period
- Σ amount due = the receivables account on the Balance Sheet (when every open invoice is in the period; information otherwise)
- Counts by status add up to the invoices listed

## Save as

`fileName`: `myob-sales-register.html` · `tags`: ["myob","sales-register","M38","sales"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com 1 Jul – 9 Sep 2026: 12 invoices, all Open (INV00000011 01/07/2026 Daniel Lee 1,375.00 · INV00000012 20/07/2026 Michael Thompson 528.00 …) · Total 2,326.96 / 2,326.96.
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
      "label": "Sale status",
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
      "id": "inv",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_invoices"
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
        "name": "list_invoices"
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
  title: 'Sales Register', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', as_at: '2026-09-28', status: 'All', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"register"}' },
  uses: { inv: ['from_date', 'to_date', 'company_file'], open: ['company_file'], pnl: ['from_date', 'to_date', 'company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { inv: 'list_invoices (sales invoices dated in the period — every status, every page)', open: 'list_invoices (every open invoice — current balances)', pnl: 'get_profit_and_loss_3m (income for the period, for the tie)', bs: 'get_balance_sheet (the receivables account today)', accounts: 'list_accounts (income and receivables accounts)', company_files: 'list_company_files' },
  enums: [{ input: 'status', label: 'Sale status', options: [['All', 'All invoices'], ['Open', 'Open'], ['Closed', 'Closed']] }],
  roll: function () { return { as_at: MK.asAt('today') }; },
  views: [['register', 'Sales register'], ['customers', 'Customer sales']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date, st = c.inputs.status || 'All';
    if (c.errors.inv) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('inv')) + '</p>'; return { checks: [{ name: 'Invoices loaded', pass: false, detail: c.err('inv') }] }; }
    if (!c.data.inv) return {};
    var doc = function (i) { var cu = i.Customer || {}, tot = MK.num(i.TotalAmount) || 0, tax = MK.num(i.TotalTax) || 0, sub = MK.num(i.Subtotal), incl = !!i.IsTaxInclusive; return { date: MK.isoDate(i.Date), number: i.Number || '', po: i.CustomerPurchaseOrderNumber || '', customer: cu.Name || '(no customer)', cid: cu.UID || cu.Name || '', cno: cu.DisplayID || '', total: r2(tot), due: r2(MK.num(i.BalanceDueAmount) || 0), status: i.Status || '', tax: r2(tax), sale: r2(sub != null ? (incl ? sub - tax : sub) : tot - tax) }; };
    var all = MK.items(c.data.inv).filter(Boolean).map(doc), inP = all.filter(function (d) { return d.date >= from && d.date <= to; }), list = inP.filter(function (d) { return st === 'All' || d.status === st; });
    list.sort(function (a, b) { return a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)); });
    var open = c.data.open ? MK.items(c.data.open).filter(Boolean).map(doc) : null, bal = {}; (open || []).forEach(function (d) { bal[d.cid] = r2((bal[d.cid] || 0) + d.due); });
    var byC = {}; list.forEach(function (d) { if (!byC[d.cid]) byC[d.cid] = { name: d.customer, no: d.cno, sale: 0, tax: 0, n: 0, cid: d.cid }; var y = byC[d.cid]; y.sale = r2(y.sale + d.sale); y.tax = r2(y.tax + d.tax); y.n++; });
    var cust = Object.keys(byC).map(function (k) { var y = byC[k]; y.balance = open ? (bal[y.cid] || 0) : null; return y; }).sort(function (a, b) { return b.sale - a.sale || a.name.localeCompare(b.name); });
    var T = { total: MK.sum(list.map(function (d) { return d.total; })), due: MK.sum(list.map(function (d) { return d.due; })), sale: MK.sum(list.map(function (d) { return d.sale; })), tax: MK.sum(list.map(function (d) { return d.tax; })) };
    var counts = {}; list.forEach(function (d) { counts[d.status] = (counts[d.status] || 0) + 1; });
    var view = c.view || 'register', top = cust[0], share = top && T.sale ? top.sale / T.sale : null;
    body.innerHTML = MK.kpis(view === 'customers' ? [{ label: 'Sales (ex tax)', value: T.sale }, { label: 'Tax', value: T.tax }, { label: 'Customers', value: cust.length, money: false }, { label: 'Largest customer share', text: share == null ? 'N/A' : MK.pct(share, 0) + ' · ' + top.name }]
      : [{ label: 'Invoices', value: list.length, money: false }, { label: 'Total amount', value: T.total }, { label: 'Amount due', value: T.due }, { label: 'By status', text: Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(' · ') || 'None' }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'customers' ? 'Customer sales' : 'Sales register') + ' — ' + MK.h(MK.periodLine(from, to)) + (st !== 'All' ? ' · ' + st + ' invoices' : '') + '</h3><div id="sr-grid"></div></div>' +
      (view === 'customers' ? '<div class="mk-card detail-block" style="margin-top:16px"><h3>Sales by customer (top 10)</h3><div id="sr-chart"></div></div>' : '');
    if (view === 'customers') {
      MK.grid(document.getElementById('sr-grid'), { rows: cust, filter: true, columns: [{ key: 'name', title: 'Customer name' }, { key: 'no', title: 'Customer number' }, { key: 'sale', title: 'Sale amount ($)', money: true }, { key: 'tax', title: 'Tax ($)', money: true }, { key: 'balance', title: 'Current balance ($)', money: true }],
        total: { name: 'Total', sale: T.sale, tax: T.tax, balance: open ? MK.sum(cust.map(function (x) { return x.balance; })) : null }, empty: 'No sales in this period.' }, c);
      MK.bars(document.getElementById('sr-chart'), { title: 'Sales by customer', labels: cust.slice(0, 10).map(function (x) { return x.name; }), series: [{ name: 'Sale amount', values: cust.slice(0, 10).map(function (x) { return x.sale; }) }] }, c);
    } else MK.grid(document.getElementById('sr-grid'), { rows: list, filter: true, columns: [{ key: 'date', title: 'Date' }, { key: 'number', title: 'Invoice No.' }, { key: 'po', title: 'Customer PO No.' }, { key: 'customer', title: 'Customer name' }, { key: 'total', title: 'Total amount ($)', money: true }, { key: 'due', title: 'Amount due ($)', money: true }, { key: 'status', title: 'Status' }],
      total: { date: 'Total', total: T.total, due: T.due }, empty: 'No invoices in this period.' }, c);
    // ties: sales to the P&L's income for the period; amount due to the receivables account (when the register holds every open invoice)
    var idx = MK.accounts(c.data.accounts), plB = c.data.pnl ? MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT) : null, income = plB ? plB.totals.Income[0] : null;
    var bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null, arRows = bsB ? bsB.rows.filter(function (r) { return !r.header && r.type === 'AccountReceivable'; }) : [], control = arRows.length ? MK.sum(arRows.map(function (r) { return r.values[0]; })) : null;
    var allOpenIn = open ? open.every(function (d) { return d.date >= from && d.date <= to; }) : false, saleAll = MK.sum(inP.map(function (d) { return d.sale; }));
    var checks = [
      { name: 'Σ sale amount (ex tax) = Income on the Profit and Loss for the period (a separate MYOB report)', pass: income == null ? null : MK.near(saleAll, income), detail: income == null ? (c.err('pnl') || 'N/A') : money(saleAll) + ' vs ' + money(income) + (MK.near(saleAll, income) ? '' : ' — difference ' + money(r2(income - saleAll)) + ': income from receive money or journals, or invoice lines on other accounts') },
      !allOpenIn || st === 'Closed' ? { name: 'Σ amount due vs the receivables account (information — the period does not hold every open invoice)', pass: null, info: true, detail: money(T.due) + ' due in the period' + (control != null ? '; receivables account ' + money(control) : '') }
        : { name: 'Σ amount due = the receivables account on the Balance Sheet (every open invoice is in the period)', pass: control == null ? null : MK.near(T.due, control), detail: control == null ? (c.err('bs') || 'N/A') : money(T.due) + ' vs ' + money(control) },
      { name: 'Counts by status add up to the invoices listed', pass: Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0) === list.length, detail: Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(', ') || 'none' },
      view === 'customers' && open ? { name: 'Every customer\'s current balance (open invoices, as on Unpaid invoices) adds up to the receivables account on the Balance Sheet', pass: control == null ? null : MK.near(MK.sum(Object.keys(bal).map(function (k) { return bal[k]; })), control), detail: money(MK.sum(Object.keys(bal).map(function (k) { return bal[k]; }))) + ' on ' + open.length + ' open invoice(s)' + (control == null ? '' : ' vs ' + money(control)) } : null
    ].filter(Boolean);
    this._x = { list: list, cust: cust, T: T, view: view };
    return { checks: checks, title: view === 'customers' ? 'Customer Sales' : 'Sales Register', notes: ['Sales invoices dated in the period (MYOB\'s generic invoice list); sale amount = the subtotal before tax.' + (view === 'customers' ? ' Current balance is each customer\'s balance due on every open invoice today.' : '')],
      na: ['Quotes and orders (the connector reads invoices only)', 'Salesperson (employee) filter — not in the invoice list'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (n) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: n, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    var reg = head('Sales register').concat([['Date', 'Invoice No.', 'Customer PO No.', 'Customer name', 'Total amount ($)', 'Amount due ($)', 'Status'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.list.map(function (d) { return [d.date, d.number, d.po, d.customer, mv(d.total), mv(d.due), d.status]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', '', { v: x.T.total, s: 'moneyBold' }, { v: x.T.due, s: 'moneyBold' }]]);
    var cus = head('Customer sales').concat([['Customer name', 'Customer number', 'Sale amount ($)', 'Tax ($)', 'Current balance ($)'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.cust.map(function (r) { return [r.name, r.no, mv(r.sale), mv(r.tax), mv(r.balance)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', { v: x.T.sale, s: 'moneyBold' }, { v: x.T.tax, s: 'moneyBold' }]]);
    return x.view === 'customers' ? [{ name: 'Customer sales', rows: cus, widths: [32, 16, 16, 14, 18] }, { name: 'Sales register', rows: reg, widths: [12, 12, 14, 32, 16, 16, 10] }] : [{ name: 'Sales register', rows: reg, widths: [12, 12, 14, 32, 16, 16, 10] }, { name: 'Customer sales', rows: cus, widths: [32, 16, 16, 14, 18] }];
  }
});
```

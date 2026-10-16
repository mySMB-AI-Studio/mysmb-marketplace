---
name: MYOB Supplier Purchases (Detail)
description: MYOB Supplier Purchases (Detail) (M44) as a live, validated report in MYOB styling. Use when the user asks for supplier purchases detail, what was bought from each supplier, bill lines by supplier, or purchases by item or account for a period.
---
# Supplier Purchases (Detail) (M44)

Use when the user asks for supplier purchases detail, what was bought from each supplier, bill lines by supplier, or purchases by item or account for a period. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Supplier Purchases (Detail)**. Template: `myob-reporting-studio` / `myob-supplier-purchases-detail` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_bill_lines`, `list_bills`, `list_tax_codes`, `list_company_files`).

MYOB location: Reporting → Reports → Purchases → Supplier purchases (detail). Library: MYOB Reports Prompt Library v1.2 → Prompts → M44. Delivery: Wave 2 (P2).

## Discovery call

Call `list_bill_lines` once for the period (`status` = `All`) — one row per bill line across every layout — plus `list_bills` once (the tie) and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: this financial year to date — display preset `p` = `this_fy_td`, or another preset / `custom`). The view is display `v`: `supplier` (default) or `item` (purchases by item / account).

## Members

| Member / view | How |
|---|---|
| Supplier purchases (detail) | Every bill line by supplier: date, bill, item or account, description, quantity, unit price, amount ex tax, tax code |
| Purchases by item / account | Report = Purchases by item / account |
| Summary by supplier | See MYOB Supplier Purchases |

## Validation checks (shown in the banner)

- **Independent tie:** each bill's lines add up to its amount on MYOB's bill list (layout lines vs the bill list — two MYOB sources)
- Every bill in the period has its lines
- All the period's lines were returned

## Save as

`fileName`: `myob-supplier-purchases-detail.html` · `tags`: ["myob","supplier-purchases","detail","M44","purchases"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: MYOB Supplier purchases (detail) for the same period.
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"supplier\"}"
    }
  ],
  "bindings": [
    {
      "id": "lines",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bill_lines"
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
        "status": {
          "kind": "static",
          "value": "All"
        },
        "max_lines": {
          "kind": "static",
          "value": 5000
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bills",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bills"
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
        "status": {
          "kind": "static",
          "value": "All"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "tax_codes",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_tax_codes"
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
// Bill lines — Supplier Purchases (Detail) (M44), from MYOB's bill layout lines (list_bill_lines).
// Tie: each bill's lines add up to its amount on MYOB's bill list (two MYOB sources).
MK.app({
  title: 'Supplier Purchases (Detail)', primary: 'lines', files: 'company_files', optional: ['tax_codes'],
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"supplier"}' },
  uses: { lines: ['from_date', 'to_date', 'company_file'], bills: ['from_date', 'to_date', 'company_file'], tax_codes: ['company_file'], company_files: [] },
  tools: { lines: 'list_bill_lines (every bill line in the period, all layouts)', bills: 'list_bills (the bills in the period, for the tie)', tax_codes: 'list_tax_codes (rates, to take tax out of tax-inclusive lines)', company_files: 'list_company_files' },
  views: [['supplier', 'Supplier purchases (detail)'], ['item', 'Purchases by item / account']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['lines', 'bills'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Bill lines and bills loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.lines || !c.data.bills) return {};
    var rate = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t && t.Code) rate[String(t.Code).toUpperCase()] = MK.num(t.Rate) || 0; });
    var rateOf = function (code) { code = String(code || '').toUpperCase(); return code in rate ? rate[code] : code === 'GST' || code === 'CAP' ? 10 : 0; };
    var L = c.data.lines, lines = MK.items(L).filter(function (l) { return l && (l.Type === 'Transaction' || l.Type === 'Freight') && MK.isoDate(l.Date) >= from && MK.isoDate(l.Date) <= to; }).map(function (l) {
      var tot = MK.num(l.Total) || 0, code = (l.TaxCode || {}).Code || '', it = l.Item || null, ac = l.Account || {}, su = l.Supplier || {};
      return { date: MK.isoDate(l.Date), number: l.Number || '', doc: l.DocumentUID, supplier: su.Name || '(no supplier)', item: it ? (it.Number ? it.Number + ' ' : '') + (it.Name || '') : l.Type === 'Freight' ? 'Freight' : (ac.DisplayID ? ac.DisplayID + ' ' : '') + (ac.Name || l.Description || ''),
        desc: l.Description || '', qty: MK.num(l.Quantity), price: MK.num(l.UnitPrice), total: tot, ex: l.IsTaxInclusive ? r2(tot * 100 / (100 + rateOf(code))) : tot, code: code }; });
    var exT = MK.sum(lines.map(function (x) { return x.ex; })), byI = {}, sups = {};
    lines.forEach(function (x) { var y = byI[x.item] || (byI[x.item] = { item: x.item, qty: 0, amount: 0, n: 0 }); y.qty = r2(y.qty + (x.qty || 0)); y.amount = r2(y.amount + x.ex); y.n++; sups[x.supplier] = r2((sups[x.supplier] || 0) + x.ex); });
    var items = Object.keys(byI).map(function (k) { return byI[k]; }).sort(function (a, b) { return b.amount - a.amount || a.item.localeCompare(b.item); });
    var view = c.view || 'supplier';
    body.innerHTML = MK.kpis([{ label: 'Purchases (ex tax)', value: exT }, { label: 'Suppliers', value: Object.keys(sups).length, money: false }, { label: 'Items / accounts', value: items.length, money: false }, { label: 'Lines', value: lines.length, money: false }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'item' ? 'Purchases by item / account' : 'Supplier purchases (detail)') + ' — ' + MK.h(MK.periodLine(from, to)) + '</h3><div id="bd-grid"></div></div>';
    var g = document.getElementById('bd-grid');
    if (view === 'item') MK.grid(g, { rows: items.map(function (y) { return { item: y.item, qty: y.qty || null, amount: y.amount, n: y.n }; }), filter: true, empty: 'No bill lines in this period.',
      columns: [{ key: 'item', title: 'Item / account' }, { key: 'qty', title: 'Units', num: true }, { key: 'amount', title: 'Amount (ex tax)', money: true }, { key: 'n', title: 'Lines', num: true }], total: { item: 'Total', amount: exT } }, c);
    else MK.grid(g, { rows: lines.slice().sort(function (a, b) { return a.supplier.localeCompare(b.supplier) || a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)); }), filter: true, empty: 'No bill lines in this period.',
      columns: [{ key: 'supplier', title: 'Supplier' }, { key: 'date', title: 'Date' }, { key: 'number', title: 'Bill No.' }, { key: 'item', title: 'Item / account' }, { key: 'desc', title: 'Description' }, { key: 'qty', title: 'Qty', num: true }, { key: 'price', title: 'Unit price', money: true }, { key: 'ex', title: 'Amount (ex tax)', money: true }, { key: 'code', title: 'Tax code' }],
      total: { supplier: 'Total', ex: exT } }, c);
    var bills = MK.items(c.data.bills).filter(function (b) { var dt = MK.isoDate(b.Date); return b && dt >= from && dt <= to; }), sumBy = {};
    lines.forEach(function (x) { sumBy[x.doc] = r2((sumBy[x.doc] || 0) + x.total); });
    var want = function (b) { return b.IsTaxInclusive ? MK.num(b.TotalAmount) || 0 : r2((MK.num(b.Subtotal) || 0) + (MK.num(b.Freight) || 0)); };
    var noLines = bills.filter(function (b) { return !(b.UID in sumBy) && Math.abs(want(b)) > 0.005; }), diff = bills.filter(function (b) { return b.UID in sumBy && !MK.near(sumBy[b.UID], want(b)); });
    var checks = [
      { name: 'Each bill’s lines add up to its amount on MYOB’s bill list (layout lines vs the bill list — two MYOB sources)', pass: bills.length ? !diff.length : null, detail: diff.length ? 'Differs: ' + diff.slice(0, 5).map(function (b) { return b.Number + ' (' + money(sumBy[b.UID]) + ' vs ' + money(want(b)) + ')'; }).join(', ') : bills.length + ' bill(s)' },
      { name: 'Every bill in the period has its lines', pass: bills.length ? !noLines.length : null, detail: noLines.length ? noLines.length + ' without lines, e.g. ' + noLines[0].Number : 'all ' + bills.length },
      { name: 'All the period’s lines were returned', pass: L.Truncated ? false : true, detail: L.Truncated ? 'More than ' + (L.Count || lines.length) + ' lines — choose a shorter period' : lines.length + ' line(s)' + (L.Errors ? '; layouts not read: ' + Object.keys(L.Errors).join(', ') : '') }
    ];
    if (L.Errors) checks.push({ name: 'Bill layouts MYOB did not return (information)', pass: null, info: true, detail: Object.keys(L.Errors).map(function (k) { return k + ': ' + L.Errors[k]; }).join('; ') });
    this._x = { lines: lines, items: items, exT: exT };
    return { checks: checks, title: view === 'item' ? 'Purchases by Item / Account' : 'Supplier Purchases (Detail)',
      notes: ['From MYOB’s bill lines (every layout). Amounts exclude tax: tax-inclusive lines have their tax code’s rate taken out. Lines with no item show their account.'],
      na: ['Purchase orders (bills only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; }, head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    var sd = head('Supplier purchases (detail)').concat([['Supplier', 'Date', 'Bill No.', 'Item / account', 'Description', 'Qty', 'Unit price', 'Amount (ex tax)', 'Tax code'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.lines.map(function (l) { return [l.supplier, l.date, l.number, l.item, l.desc, l.qty == null ? '' : l.qty, mv(l.price), mv(l.ex), l.code]; }));
    var it = head('Purchases by item / account').concat([['Item / account', 'Units', 'Amount (ex tax)', 'Lines'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.items.map(function (y) { return [y.item, y.qty || '', mv(y.amount), y.n]; }));
    return [{ name: 'Supplier detail', rows: sd, widths: [30, 12, 12, 34, 34, 8, 12, 16, 10] }, { name: 'By item', rows: it, widths: [40, 10, 16, 8] }];
  }
});
```

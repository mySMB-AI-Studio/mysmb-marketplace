---
name: MYOB Item Sales Analysis
description: MYOB Item Sales Analysis (M49) as a live, validated report in MYOB styling. Use when the user asks for item sales analysis, item margin or gross profit by item, item sales trend by month, or performance per product over time.
---
# Item Sales Analysis (M49)

Use when the user asks for item sales analysis, item margin or gross profit by item, item sales trend by month, or performance per product over time. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Item Sales Analysis**. Template: `myob-reporting-studio` / `item-sales-analysis` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_invoice_lines`, `list_invoices`, `list_tax_codes`, `list_items`, `list_company_files`).

MYOB location: Reporting → Reports → Inventory → Item sales analysis. Library: MYOB Reports Prompt Library v1.2 → Prompts → M49. Delivery: Wave 3 (P3).

## Discovery call

Call `list_invoice_lines` once for the period (`status` = `All`), `list_invoices` once, `list_items` once (`AverageCost` per item — the estimated cost) and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: this financial year to date; display preset `p` as for Item Sales). The view is display `v` (`analysis` by default).

## Members

| Member / view | How |
|---|---|
| Item sales analysis | Per item: sales ex tax per month, total, estimated cost (units × MYOB's current average cost), estimated gross margin and margin % |
| Cost at the time of each sale | N/A — the invoice lines carry no cost; estimated at the current average cost |

## Validation checks (shown in the banner)

- **Independent tie:** each invoice's lines add up to its amount on MYOB's invoice list
- Every invoice in the period has its lines
- All the period's lines were returned

## Save as

`fileName`: `myob-item-sales-analysis.html` · `tags`: ["myob","item-sales","margin","M49","inventory"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: MYOB Item sales analysis for the same period (margins differ where average cost has moved).
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"analysis\"}"
    }
  ],
  "bindings": [
    {
      "id": "lines",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_invoice_lines"
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
      "id": "inv",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_invoices"
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
      "id": "items",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_items"
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
// Invoice lines — Item Sales (M39), Item Sales Analysis (M49, variant ia) and Customer Sales (Detail) (M36, variant cd), from MYOB's
// invoice layout lines (list_invoice_lines). Tie: each invoice's lines add up to its amount on MYOB's invoice list (two MYOB sources).
MK.app({
  title: 'Item Sales Analysis', primary: 'lines', files: 'company_files', optional: ['tax_codes', 'items'],
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"analysis"}' },
  uses: { lines: ['from_date', 'to_date', 'company_file'], inv: ['from_date', 'to_date', 'company_file'], tax_codes: ['company_file'], items: ['company_file'], company_files: [] },
  tools: { lines: 'list_invoice_lines (every invoice line in the period, all layouts)', inv: 'list_invoices (the invoices in the period, for the tie)', tax_codes: 'list_tax_codes (rates, to take tax out of tax-inclusive lines)', items: 'list_items (average cost, for the estimated margin)', company_files: 'list_company_files' },
  views: [['item', 'Item sales'], ['analysis', 'Item sales analysis (by month)'], ['customer', 'Customer sales (detail)']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['lines', 'inv'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Invoice lines and invoices loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.lines || !c.data.inv) return {};
    var rate = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t && t.Code) rate[String(t.Code).toUpperCase()] = MK.num(t.Rate) || 0; });
    var rateOf = function (code) { code = String(code || '').toUpperCase(); return code in rate ? rate[code] : code === 'GST' || code === 'CAP' ? 10 : 0; };
    var L = c.data.lines, raw = MK.items(L).filter(function (l) { return l && (l.Type === 'Transaction' || l.Type === 'Freight') && MK.isoDate(l.Date) >= from && MK.isoDate(l.Date) <= to; });
    var lines = raw.map(function (l) { var tot = MK.num(l.Total) || 0, code = (l.TaxCode || {}).Code || '', ex = l.IsTaxInclusive ? r2(tot * 100 / (100 + rateOf(code))) : tot, it = l.Item || null, ac = l.Account || {}, cu = l.Customer || {};
      return { date: MK.isoDate(l.Date), month: MK.isoDate(l.Date).slice(0, 7), number: l.Number || '', doc: l.DocumentUID, customer: cu.Name || '(no customer)', item: it ? (it.Number ? it.Number + ' ' : '') + (it.Name || '') : l.Type === 'Freight' ? 'Freight' : '(no item) ' + ((ac.DisplayID ? ac.DisplayID + ' ' : '') + (ac.Name || l.Description || '')),
        itemNo: it ? it.Number || '' : '', desc: l.Description || '', qty: MK.num(l.Quantity), price: MK.num(l.UnitPrice), total: tot, ex: ex, code: code, isItem: !!it }; });
    var exT = MK.sum(lines.map(function (x) { return x.ex; }));
    // by item: quantity, sales ex tax, share, average price
    var byI = {}; lines.forEach(function (x) { var y = byI[x.item] || (byI[x.item] = { item: x.item, no: x.itemNo, qty: 0, sales: 0, n: 0, isItem: x.isItem, m: {} }); y.qty = r2(y.qty + (x.qty || 0)); y.sales = r2(y.sales + x.ex); y.n++; y.m[x.month] = r2((y.m[x.month] || 0) + x.ex); });
    var cost = {}; MK.items(c.data.items).forEach(function (it) { if (it && it.Number != null && MK.num(it.AverageCost) != null) cost[it.Number] = MK.num(it.AverageCost); });
    var items = Object.keys(byI).map(function (k) { var y = byI[k]; y.share = exT ? y.sales / exT : null; y.avg = y.qty ? r2(y.sales / y.qty) : null; if (y.isItem && y.no in cost) { y.cost = r2(y.qty * cost[y.no]); y.gm = r2(y.sales - y.cost); y.gmPct = y.sales ? y.gm / y.sales : null; } return y; }).sort(function (a, b) { return b.sales - a.sales || a.item.localeCompare(b.item); });
    var months = []; for (var d = MK.parse(from.slice(0, 7) + '-01'); MK.iso(d) <= to; d = MK.parse(MK.iso(MK.addDays(MK.eom(d.getUTCFullYear(), d.getUTCMonth() + 1), 1)))) months.push(MK.iso(d).slice(0, 7));
    var view = c.view || 'item', mon = function (k) { return MK.MONTHS[+k.slice(5) - 1].slice(0, 3) + ' ' + k.slice(2, 4); };
    var custs = {}; lines.forEach(function (x) { custs[x.customer] = r2((custs[x.customer] || 0) + x.ex); });
    body.innerHTML = MK.kpis([{ label: 'Sales (ex tax)', value: exT }, { label: view === 'customer' ? 'Customers' : 'Items', value: view === 'customer' ? Object.keys(custs).length : items.filter(function (y) { return y.isItem; }).length, money: false }, { label: 'Units sold', value: MK.sum(lines.map(function (x) { return x.qty || 0; })), money: false }, { label: 'Lines', value: lines.length, money: false }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + MK.h({ item: 'Item sales', analysis: 'Item sales analysis', customer: 'Customer sales (detail)' }[view]) + ' — ' + MK.h(MK.periodLine(from, to)) + '</h3><div id="il-grid"></div></div>';
    var g = document.getElementById('il-grid');
    if (view === 'customer') { var cl = lines.slice().sort(function (a, b) { return a.customer.localeCompare(b.customer) || a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)); });
      MK.grid(g, { rows: cl, filter: true, empty: 'No invoice lines in this period.', columns: [{ key: 'customer', title: 'Customer' }, { key: 'date', title: 'Date' }, { key: 'number', title: 'Invoice No.' }, { key: 'item', title: 'Item / account' }, { key: 'desc', title: 'Description' }, { key: 'qty', title: 'Qty', num: true }, { key: 'price', title: 'Unit price', money: true }, { key: 'ex', title: 'Amount (ex tax)', money: true }, { key: 'code', title: 'Tax code' }],
        total: { customer: 'Total', ex: exT } }, c); }
    else if (view === 'analysis') MK.grid(g, { rows: items.map(function (y) { var o = { item: y.item, sales: y.sales, cost: y.cost, gm: y.gm, gmPct: y.gmPct == null ? '' : MK.pct(y.gmPct, 1) }; months.forEach(function (k) { o[k] = y.m[k] || 0; }); return o; }), filter: true, empty: 'No invoice lines in this period.',
      columns: [{ key: 'item', title: 'Item' }].concat(months.map(function (k) { return { key: k, title: mon(k), money: true }; })).concat([{ key: 'sales', title: 'Total (ex tax)', money: true }, { key: 'cost', title: 'Est. cost', money: true }, { key: 'gm', title: 'Est. gross margin', money: true }, { key: 'gmPct', title: 'Margin %' }]),
      total: (function () { var t = { item: 'Total', sales: exT }; months.forEach(function (k) { t[k] = MK.sum(items.map(function (y) { return y.m[k] || 0; })); }); return t; })() }, c);
    else MK.grid(g, { rows: items.map(function (y) { return { item: y.item, qty: y.isItem ? y.qty : null, sales: y.sales, share: y.share == null ? '' : MK.pct(y.share, 1), avg: y.isItem ? y.avg : null }; }), filter: true, empty: 'No invoice lines in this period.',
      columns: [{ key: 'item', title: 'Item' }, { key: 'qty', title: 'Units sold', num: true }, { key: 'sales', title: 'Sales (ex tax)', money: true }, { key: 'share', title: '% of sales' }, { key: 'avg', title: 'Average price', money: true }], total: { item: 'Total', sales: exT } }, c);
    // checks: every invoice's lines = its amount on the invoice list (Subtotal + Freight; TotalAmount when tax-inclusive)
    var inv = MK.items(c.data.inv).filter(function (i) { var dt = MK.isoDate(i.Date); return i && dt >= from && dt <= to; }), sumBy = {};
    lines.forEach(function (x) { sumBy[x.doc] = r2((sumBy[x.doc] || 0) + x.total); });
    var want = function (i) { return i.IsTaxInclusive ? MK.num(i.TotalAmount) || 0 : r2((MK.num(i.Subtotal) || 0) + (MK.num(i.Freight) || 0)); };
    var noLines = inv.filter(function (i) { return !(i.UID in sumBy) && Math.abs(want(i)) > 0.005; }), diff = inv.filter(function (i) { return i.UID in sumBy && !MK.near(sumBy[i.UID], want(i)); });
    var checks = [
      { name: 'Each invoice’s lines add up to its amount on MYOB’s invoice list (layout lines vs the invoice list — two MYOB sources)', pass: inv.length ? !diff.length : null, detail: diff.length ? 'Differs: ' + diff.slice(0, 5).map(function (i) { return i.Number + ' (' + money(sumBy[i.UID]) + ' vs ' + money(want(i)) + ')'; }).join(', ') : inv.length + ' invoice(s)' },
      { name: 'Every invoice in the period has its lines', pass: inv.length ? !noLines.length : null, detail: noLines.length ? noLines.length + ' without lines, e.g. ' + noLines[0].Number : 'all ' + inv.length },
      { name: 'All the period’s lines were returned', pass: L.Truncated ? false : true, detail: L.Truncated ? 'More than ' + (L.Count || lines.length) + ' lines — choose a shorter period' : lines.length + ' line(s)' + (L.Errors ? '; layouts not read: ' + Object.keys(L.Errors).join(', ') : '') }
    ];
    if (L.Errors) checks.push({ name: 'Invoice layouts MYOB did not return (information)', pass: null, info: true, detail: Object.keys(L.Errors).map(function (k) { return k + ': ' + L.Errors[k]; }).join('; ') });
    this._x = { lines: lines, items: items, months: months, exT: exT, view: view };
    return { checks: checks, title: { item: 'Item Sales', analysis: 'Item Sales Analysis', customer: 'Customer Sales (Detail)' }[view],
      notes: ['From MYOB’s invoice lines (every layout). Amounts exclude tax: tax-inclusive lines have their tax code’s rate taken out. Lines with no item are grouped by account. In the analysis, estimated cost = units × MYOB’s current average cost for the item.'],
      na: ['Cost of sales at the time of each sale (the invoice lines carry no cost — the analysis estimates it at MYOB’s current average cost)', 'Sales orders and quotes (invoices only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; }, head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    var it = head('Item sales').concat([['Item', 'Units sold', 'Sales (ex tax)', '% of sales'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.items.map(function (y) { return [y.item, y.isItem ? y.qty : '', mv(y.sales), y.share == null ? '' : Math.round(y.share * 1000) / 10]; }));
    var an = head('Item sales analysis').concat([[{ v: 'Item', s: 'bold' }].concat(x.months.map(function (k) { return { v: k, s: 'bold' }; })).concat([{ v: 'Total', s: 'bold' }])]).concat(x.items.map(function (y) { return [y.item].concat(x.months.map(function (k) { return mv(y.m[k] || 0); })).concat([mv(y.sales)]); }));
    var cd = head('Customer sales (detail)').concat([['Customer', 'Date', 'Invoice No.', 'Item / account', 'Description', 'Qty', 'Unit price', 'Amount (ex tax)', 'Tax code'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.lines.map(function (l) { return [l.customer, l.date, l.number, l.item, l.desc, l.qty == null ? '' : l.qty, mv(l.price), mv(l.ex), l.code]; }));
    return [{ name: 'Item sales', rows: it, widths: [40, 12, 16, 12] }, { name: 'By month', rows: an, widths: [40].concat(x.months.map(function () { return 14; })).concat([16]) }, { name: 'Customer detail', rows: cd, widths: [28, 12, 12, 34, 34, 8, 12, 16, 10] }];
  }
});
```

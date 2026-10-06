---
name: MYOB Items Register
description: MYOB Items Register (M50) as a live, validated report in MYOB styling. Use when the user asks for the items register, stock movements, item transactions, purchases and sales of an item, or how stock levels changed.
---
# Items Register (M50)

Use when the user asks for the items register, stock movements, item transactions, purchases and sales of an item, or how stock levels changed. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Items Register**. Template: `myob-reporting-studio` / `items-register` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_items`, `list_invoice_lines`, `list_bill_lines`, `list_inventory_adjustments`, `list_company_files`).

MYOB location: Reporting → Reports → Inventory → Items register. Library: MYOB Reports Prompt Library v1.2 → Prompts → M50. Delivery: Wave 3 (P3).

## Discovery call

Call `list_items` once, `list_invoice_lines` and `list_bill_lines` once each from the period start to today, `list_inventory_adjustments` once for the same dates, and `list_company_files` once. Only lines for inventoried items move stock; MYOB keeps only today's on hand, so the opening quantity is worked back from it.

## Date defaults

`from_date` = the period start (default: this month; display preset `p`); `to_date` = the end shown (movements are always read to today). The view is display `v` (`register` | `summary`); `x` = an item UID.

## Members

| Member / view | How |
|---|---|
| Items register | Per inventoried item: opening quantity, each purchase, sale and adjustment (date, reference, customer / supplier / memo, quantity) with the running on hand, and the closing quantity |
| Summary by item | Report = Summary by item (opening, purchased, sold, adjusted, closing) |
| Item picker | Item select above the report |
| Movement cost and value, transfers and builds | N/A — quantities only; not in the connector |

## Validation checks (shown in the banner)

- No item has a negative opening quantity (worked back from today's on hand — a negative means movements are missing)
- Every movement names an item in MYOB's item list
- For information: lines that do not move stock (services, lines without an item)

## Save as

`fileName`: `myob-items-register.html` · `tags`: ["myob","inventory","M50","register"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Confirm on a file with stock that the closing quantity today equals MYOB's on hand and the opening is not negative.
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
      "default": "2026-09-01"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"register\",\"x\":\"\"}"
    }
  ],
  "bindings": [
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
      "id": "inv_lines",
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
          "kind": "context",
          "source": "now.date"
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
      "id": "bill_lines",
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
          "kind": "context",
          "source": "now.date"
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
      "id": "adjustments",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_inventory_adjustments"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "context",
          "source": "now.date"
        },
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
// Items Register (M50): every stock movement of each inventoried item — purchases (bill lines, +), sales (invoice lines, −) and
// inventory adjustments (signed) — with a running quantity. MYOB keeps only today's on hand, so the movements are read from the
// period start to today and the opening quantity is worked back from today's on hand; a negative opening means movements are missing.
MK.app({
  title: 'Items Register', primary: 'items', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"register","x":""}' },
  uses: { items: ['company_file'], inv_lines: ['from_date', 'company_file'], bill_lines: ['from_date', 'company_file'], adjustments: ['from_date', 'company_file'], company_files: [] },
  tools: { items: 'list_items (today\'s on hand)', inv_lines: 'list_invoice_lines (sales, from the period start to today)', bill_lines: 'list_bill_lines (purchases, from the period start to today)', adjustments: 'list_inventory_adjustments (from the period start to today)', company_files: 'list_company_files' },
  views: [['register', 'Items register'], ['summary', 'Summary by item']],
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date, r3 = function (v) { return Math.round(v * 1000) / 1000; }, q = function (v) { return v == null ? '' : r3(v).toLocaleString('en-AU'); };
    var need = ['items', 'inv_lines', 'bill_lines', 'adjustments'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Items and movements loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.items || !c.data.inv_lines || !c.data.bill_lines || !c.data.adjustments) return {};
    var I = {}; MK.items(c.data.items).forEach(function (x) { if (x.IsInventoried) I[x.UID || x.Number] = { uid: x.UID || x.Number, no: x.Number || '', name: x.Name || '', oh: MK.num(x.QuantityOnHand) || 0 }; });
    var byNo = {}; Object.keys(I).forEach(function (k) { byNo[I[k].no] = I[k]; });
    var find = function (it) { return it ? I[it.UID] || byNo[it.Number] || null : null; }, M = [], unknown = 0, skipped = 0;
    var take = function (it, row) { if (!it) { skipped++; return; } var i = find(it); if (!i) { if (it.UID || it.Number) { var known = MK.items(c.data.items).some(function (x) { return x.UID === it.UID || x.Number === it.Number; }); if (known) skipped++; else unknown++; } return; } row.key = i.uid; M.push(row); };
    MK.items(c.data.bill_lines).forEach(function (l) { var qn = MK.num(l.Quantity) || 0; take(l.Item, { date: MK.isoDate(l.Date), type: 'Purchase', ref: l.Number || '', who: (l.Supplier || {}).Name || '', qty: qn }); });
    MK.items(c.data.inv_lines).forEach(function (l) { var qn = MK.num(l.Quantity) || 0; take(l.Item, { date: MK.isoDate(l.Date), type: 'Sale', ref: l.Number || '', who: (l.Customer || {}).Name || '', qty: -qn }); });
    MK.items(c.data.adjustments).forEach(function (a) { (a.Lines || []).forEach(function (l) { take(l.Item, { date: MK.isoDate(a.Date), type: 'Adjustment', ref: a.InventoryJournalNumber || '', who: l.Memo || a.Memo || '', qty: MK.num(l.Quantity) || 0 }); }); });
    M.sort(function (a, b) { return a.date.localeCompare(b.date) || a.type.localeCompare(b.type); });
    var keys = Object.keys(I).sort(function (a, b) { return String(I[a].no).localeCompare(String(I[b].no), undefined, { numeric: true }); }), sel = c.display.x && I[c.display.x] ? c.display.x : '';
    var R = keys.filter(function (k) { return !sel || k === sel; }).map(function (k) { var all = M.filter(function (m) { return m.key === k; }), open = r3(I[k].oh - all.reduce(function (s, m) { return s + m.qty; }, 0)), run = open;
      var rows = all.filter(function (m) { return m.date >= from && m.date <= to; }).map(function (m) { run = r3(run + m.qty); return Object.assign({ bal: run }, m); });
      var sum = function (t) { return r3(rows.filter(function (m) { return m.type === t; }).reduce(function (s, m) { return s + m.qty; }, 0)); };
      return { i: I[k], open: open, rows: rows, close: run, buy: sum('Purchase'), sell: sum('Sale'), adj: sum('Adjustment') }; })
      // items with no stock and no movement in the period are left out (unless picked)
      .filter(function (r) { return sel || r.rows.length || r.open || r.close; });
    var view = c.view || 'register', neg = R.filter(function (r) { return r.open < -0.0005; }), hc = function (v) { return '<td class="num' + (v < 0 ? ' neg' : '') + '">' + q(v) + '</td>'; };
    var trunc = !!(c.data.inv_lines.Truncated || c.data.bill_lines.Truncated);
    var html = MK.kpis([{ label: 'Items', money: false, value: R.length }, { label: 'Purchased', money: false, value: q(R.reduce(function (s, r) { return s + r.buy; }, 0)) }, { label: 'Sold', money: false, value: q(-R.reduce(function (s, r) { return s + r.sell; }, 0)) }, { label: 'Adjusted', money: false, value: q(R.reduce(function (s, r) { return s + r.adj; }, 0)) }], c) +
      (trunc ? '<div class="mk-banner fail" style="margin-top:12px">MYOB returned the maximum number of lines, so some movements may be missing — choose a later start date.</div>' : '') +
      '<label class="ctl" style="display:inline-flex;margin:12px 0">Item<select id="ir-item"><option value="">All inventoried items</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(I[k].no + ' ' + I[k].name) + '</option>'; }).join('') + '</select></label>';
    if (view === 'summary') html += '<table class="mk-grid"><thead><tr><th>Item no.</th><th>Item</th><th class="num">Opening</th><th class="num">Purchased</th><th class="num">Sold</th><th class="num">Adjusted</th><th class="num">Closing</th></tr></thead><tbody>' +
      R.map(function (r) { return '<tr><td>' + h(r.i.no) + '</td><td>' + h(r.i.name) + '</td>' + hc(r.open) + hc(r.buy) + hc(-r.sell) + hc(r.adj) + hc(r.close) + '</tr>'; }).join('') + '</tbody></table>';
    else html += '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Customer / supplier / memo</th><th class="num">Quantity</th><th class="num">On hand</th></tr></thead>' + R.map(function (r) {
      return '<tbody><tr class="k-header"><td colspan="5">' + h(r.i.no + ' ' + r.i.name) + '</td>' + hc(r.open) + '</tr>' + r.rows.map(function (m) { return '<tr class="k-row detail-block"><td>' + h(m.date) + '</td><td>' + h(m.type) + '</td><td>' + h(m.ref) + '</td><td>' + h(m.who) + '</td>' + hc(m.qty) + hc(m.bal) + '</tr>'; }).join('') +
        '<tr class="k-total"><td colspan="4">Total for ' + h(r.i.name) + '</td>' + hc(r3(r.close - r.open)) + hc(r.close) + '</tr></tbody>'; }).join('') + (R.length ? '' : '<tbody><tr><td colspan="6" class="muted">No inventoried items in MYOB.</td></tr></tbody>') + '</table></div>';
    body.innerHTML = html;
    document.getElementById('ir-item').addEventListener('change', function () { c.change({}, { x: this.value }); });
    this._x = { R: R };
    return { checks: [
      { name: 'No item has a negative opening quantity (worked back from today\'s on hand)', pass: R.length ? neg.length === 0 : null, detail: neg.length ? neg.map(function (r) { return r.i.no + ' ' + q(r.open); }).join(', ') + ' — movements are missing' : R.length + ' items' },
      { name: 'Every movement names an item in MYOB\'s item list', pass: unknown === 0, detail: unknown ? unknown + ' line(s) with an unknown item' : M.length + ' movements' },
      { name: 'Lines that do not move stock (services, lines without an item)', pass: null, info: true, detail: skipped + ' left out' }],
      title: sel ? 'Items Register — ' + I[sel].name : 'Items Register',
      notes: ['Purchases from bill lines, sales from invoice lines and adjustments from inventory journals, by date. MYOB keeps only today\'s on hand, so the opening quantity is today\'s on hand less every movement since the period start.'],
      na: ['Movement cost and value (quantities only)', 'Transfers between locations, builds and auto-builds (not in the connector)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Items Register', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Item', 'Date', 'Type', 'Reference', 'Customer / supplier / memo', 'Quantity', 'On hand'].map(function (t) { return { v: t, s: 'bold' }; })];
    x.R.forEach(function (r) { rows.push([{ v: r.i.no + ' ' + r.i.name, s: 'bold' }, '', 'Opening', '', '', '', r.open]); r.rows.forEach(function (m) { rows.push(['', m.date, m.type, m.ref, m.who, m.qty, m.bal]); }); });
    return [{ name: 'Items register', widths: [28, 12, 12, 12, 30, 10, 10], rows: rows }];
  }
});
```

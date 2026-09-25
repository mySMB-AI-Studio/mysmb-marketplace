---
name: quickbooks-inventory-overview
description: QuickBooks Online Inventory overview (Q14) as a live, validated report in QuickBooks styling. Use when the user asks for the inventory overview, what is low on stock or out of stock, what to reorder, or stock levels against reorder points.
---

# Inventory overview (Q14)

Use when the user asks for the inventory overview, what is low on stock or out of stock, what to reorder, or stock levels against reorder points. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`list_item`, `get_report_inventory_valuation_summary`, `list_account`, `list_purchase_order`, `qbo_query`, `get_preferences`).

QuickBooks location: All apps › Inventory › Overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q14. Delivery: Wave 3 (Train 05).

## Discovery call

`list_item` with Type = 'Inventory' — expect `QueryResponse.Item[]` with Name, Sku, QtyOnHand, ReorderPoint; `get_report_inventory_valuation_summary`. Verify on first run: the sample company had no inventory.

## Date defaults

No dates: QuickBooks values inventory as of today.

## Members

| Member / view | How |
|---|---|
| Low on stock | Quantity on hand at or below the reorder point, with quantity on order |
| Out of stock | Quantity on hand zero or below |
| Inventory Valuation reports | Switch Report to Inventory Valuation Summary, Inventory Status, Open Purchase Order List or Stocktake Worksheet |
| Create actions (add product, sales order, purchase order, adjust inventory, shipping label) | N/A — use QuickBooks |

## Validation checks (STEP 4 — shown in the banner)

- Inventory Valuation quantity = Σ item quantity on hand
- Σ asset value = Inventory Asset account
- Inventory Valuation TOTAL = Σ products
- Out-of-stock and low-stock counts equal the item query (information)

## Save as

`fileName`: `quickbooks-inventory-overview.html` · `tags`: ["quickbooks","inventory","dashboard"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Captured empty (0 low on stock / 0 out of stock) — verify on a company with inventory.
3. Compare the layout with the Q14 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"overview\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "inventory_items",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_item"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type = 'Inventory' AND Active = true"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "inventory_valuation",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_inventory_valuation_summary"
      },
      "params": {}
    },
    {
      "id": "inventory_asset_accounts",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_account"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "AccountSubType = 'Inventory'"
        },
        "maxResults": {
          "kind": "static",
          "value": 50
        }
      }
    },
    {
      "id": "purchase_orders",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_purchase_order"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 500
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
  title: 'Inventory overview', token: 'INVENTORY_VALUATION_SUMMARY', route: 'reportv2', primary: 'inventory_valuation', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Bookkeeper', display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"overview","x":""}' },
  uses: {},
  tools: { inventory_items: "list_item (Type = 'Inventory')", inventory_valuation: 'get_report_inventory_valuation_summary', inventory_asset_accounts: "list_account (AccountSubType = 'Inventory')", purchase_orders: 'list_purchase_order (latest 500)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['overview', 'Inventory overview'], ['valuation', 'Inventory Valuation Summary'], ['status', 'Inventory Status'], ['pos', 'Open Purchase Order List'], ['stocktake', 'Stocktake Worksheet']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'valuation';
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    if (c.errors.inventory_items) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('inventory_items')) + '</p>'; return { checks: [{ name: 'Inventory items loaded', pass: false, detail: c.err('inventory_items') }] }; }
    if (!c.data.inventory_items) return {};
    var items = q('inventory_items', 'Item'), qty = function (i) { return Number(i.QtyOnHand) || 0; };
    if (!items.length) { body.innerHTML = '<p class="muted">Data appears once it\'s available. (No inventory items — Inventory tracking may be off in QuickBooks › Settings › Sales.)</p>'; return { checks: [{ name: 'Inventory items exist', pass: null, detail: 'None' }] }; }
    var out = items.filter(function (i) { return qty(i) <= 0; }), low = items.filter(function (i) { return qty(i) > 0 && i.ReorderPoint != null && qty(i) <= Number(i.ReorderPoint); });
    var pos = q('purchase_orders', 'PurchaseOrder').filter(function (p) { return p.POStatus === 'Open'; }), onPo = {};
    pos.forEach(function (p) { (p.Line || []).forEach(function (l) { var d = l.ItemBasedExpenseLineDetail; if (d && d.ItemRef) onPo[d.ItemRef.value] = (onPo[d.ItemRef.value] || 0) + (Number(d.Qty) || 0); }); });
    var vr = c.data.inventory_valuation, vcols = vr ? QB.cols(vr).map(function (x) { return x.title; }) : [], ci = function (re) { for (var i = 1; i < vcols.length; i++) if (re.test(vcols[i])) return i - 1; return -1; };
    var qi = ci(/^qty/i), ai = ci(/asset value/i), si = ci(/^sku/i), avi = ci(/avg/i), vl = vr ? QB.walk(vr) : [], vrows = vl.filter(function (l) { return l.kind === 'row'; }), vgt = QB.find(vl, 'GrandTotal', /^total$/i);
    var valTot = vgt && ai >= 0 ? vgt.values[ai] : null, valQty = vgt && qi >= 0 ? vgt.values[qi] : null;
    var assetAcc = q('inventory_asset_accounts', 'Account'), assetBal = assetAcc.length ? QB.sum(assetAcc.map(function (a) { return Number(a.CurrentBalance) || 0; })) : null;
    var html = QB.kpis([{ label: 'Out of stock', money: false, value: out.length }, { label: 'Low on stock', money: false, value: low.length }, { label: 'Inventory asset value', value: valTot }, { label: 'Open purchase orders', money: false, value: pos.length }], c) + '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3 id="cht"></h3><div id="ch1"></div></div>';
    body.innerHTML = html;
    var g = document.getElementById('g1'), ch = document.getElementById('ch1');
    var prodRow = function (i) { return { n: i.Name, sku: i.Sku || '', q: qty(i), rp: i.ReorderPoint == null ? null : Number(i.ReorderPoint), po: onPo[i.Id] || 0 }; };
    if (v === 'overview') {
      g.innerHTML = '<div class="qb-grid2"><div class="qb-card"><h3>Low on stock (' + low.length + ')</h3><div id="g-low"></div></div><div class="qb-card"><h3>Out of stock (' + out.length + ')</h3><div id="g-out"></div></div></div>';
      var cols = [{ key: 'n', title: 'Product' }, { key: 'q', title: 'Qty', num: true, fmt: String }, { key: 'po', title: 'On PO', num: true, fmt: String }, { key: 'act', title: 'Action' }];
      QB.grid(document.getElementById('g-low'), { empty: 'Nothing low on stock.', columns: cols, rows: low.map(function (i) { var r = prodRow(i); r.act = r.po ? 'On order' : 'Reorder'; return r; }) }, c);
      QB.grid(document.getElementById('g-out'), { empty: 'Nothing out of stock.', columns: cols, rows: out.map(function (i) { var r = prodRow(i); r.act = r.po ? 'On order' : 'Reorder'; return r; }) }, c);
    } else if (v === 'valuation') {
      if (c.errors.inventory_valuation) g.innerHTML = '<p class="qb-err">' + QB.h(c.err('inventory_valuation')) + '</p>';
      else QB.grid(g, { filter: true, columns: [{ key: 'n', title: 'Product/Service' }, { key: 'sku', title: 'SKU' }, { key: 'q', title: 'Qty', num: true, fmt: function (x) { return x == null ? '' : String(x); } }, { key: 'val', title: 'Asset Value', money: true }, { key: 'avg', title: 'Calc. Avg', money: true }],
        rows: vrows.map(function (l) { return { n: l.label, sku: si >= 0 ? l.raw[si] : '', q: qi >= 0 ? l.values[qi] : null, val: ai >= 0 ? l.values[ai] : null, avg: avi >= 0 ? l.values[avi] : null }; }), total: { n: 'TOTAL', q: valQty, val: valTot } }, c);
    } else if (v === 'status') {
      QB.grid(g, { filter: true, columns: [{ key: 'n', title: 'Product' }, { key: 'sku', title: 'SKU' }, { key: 'q', title: 'Qty on hand', num: true, fmt: String }, { key: 'rp', title: 'Reorder point', num: true, fmt: function (x) { return x == null ? '' : String(x); } }, { key: 'po', title: 'Qty on PO', num: true, fmt: String }, { key: 'st', title: 'Status' }],
        rows: items.map(function (i) { var r = prodRow(i); r.st = r.q <= 0 ? 'Out of stock' : r.rp != null && r.q <= r.rp ? 'Low on stock' : 'In stock'; return r; }) }, c);
    } else if (v === 'pos') {
      QB.grid(g, { filter: true, empty: 'No open purchase orders.', columns: [{ key: 'n', title: 'Num' }, { key: 'd', title: 'Date' }, { key: 'due', title: 'Due' }, { key: 's', title: 'Supplier' }, { key: 'a', title: 'Amount', money: true }], rows: pos.map(function (p) { return { n: p.DocNumber, d: p.TxnDate, due: p.DueDate || '', s: (p.VendorRef || {}).name, a: p.TotalAmt }; }), total: { n: 'TOTAL', a: QB.sum(pos.map(function (p) { return p.TotalAmt; })) } }, c);
    } else {
      g.innerHTML = '<table class="qb-grid"><thead><tr><th>Product</th><th>SKU</th><th class="num">Qty on hand (QuickBooks)</th><th class="num">Counted</th><th class="num">Difference</th></tr></thead><tbody>' + items.map(function (i) { return '<tr><td>' + QB.h(i.Name) + '</td><td>' + QB.h(i.Sku || '') + '</td><td class="num">' + qty(i) + '</td><td class="num" style="min-width:90px;border-bottom:1px solid var(--ink)"></td><td class="num"></td></tr>'; }).join('') + '</tbody></table><p class="muted">Print this page (Download PDF) and count each product. Adjust quantities in QuickBooks › Inventory › Adjust inventory.</p>';
    }
    if (ch) { document.getElementById('cht').textContent = 'On hand vs reorder point'; QB.bars(ch, { title: 'On hand vs reorder point', labels: items.slice(0, 16).map(function (i) { return i.Name.slice(0, 14); }), series: [{ name: 'On hand', values: items.slice(0, 16).map(qty) }, { name: 'Reorder point', values: items.slice(0, 16).map(function (i) { return i.ReorderPoint == null ? 0 : Number(i.ReorderPoint); }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 0 }) }); }
    var itemQty = QB.sum(items.map(qty));
    var checks = [
      { name: 'Out-of-stock and low-stock counts equal the item query', pass: null, detail: out.length + ' out, ' + low.length + ' low of ' + items.length + ' inventory items (information — the lists are built from the item query)' },
      { name: 'Inventory Valuation quantity = Σ item quantity on hand', pass: valQty == null ? null : QB.near(valQty, itemQty, 0.001), detail: (valQty == null ? 'N/A' : valQty) + ' vs ' + itemQty },
      { name: 'Σ asset value = Inventory Asset account', pass: valTot == null || assetBal == null ? null : QB.near(valTot, assetBal, 1), detail: money(valTot) + ' vs ' + money(assetBal) },
      { name: 'Inventory Valuation TOTAL = Σ products', pass: valTot == null ? null : QB.near(valTot, QB.sum(vrows.map(function (l) { return ai >= 0 ? l.values[ai] : 0; }))), detail: vrows.length + ' products' }];
    this._x = { items: items, vrows: vrows, qi: qi, ai: ai, si: si, valTot: valTot, pos: pos, onPo: onPo };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1], period: QB.asOfLine(c.today),
      notes: ['QuickBooks values inventory as of today (the connector does not pass an as-of date to this report).'],
      na: ['Inventory Valuation Detail (not one of the Accounting API reports)', 'Open Purchase Order Detail by line (the list shows each open purchase order)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [QB.asOfLine(c.today)], []]; };
    return [{ name: 'Inventory Valuation', widths: [36, 14, 10, 16, 14], rows: head('Inventory Valuation Summary').concat([[{ v: 'Product/Service', s: 'bold' }, { v: 'SKU', s: 'bold' }, { v: 'Qty', s: 'bold' }, { v: 'Asset Value', s: 'bold' }]], x.vrows.map(function (l) { return [l.label, x.si >= 0 ? l.raw[x.si] : '', x.qi >= 0 ? { v: l.values[x.qi], s: 'none' } : null, x.ai >= 0 ? { v: l.values[x.ai], s: 'money' } : null]; }), [[{ v: 'TOTAL', s: 'bold' }, null, null, { v: x.valTot, s: 'moneyBold' }]]) },
      { name: 'Inventory Status', widths: [36, 14, 12, 14, 12], rows: [[{ v: 'Product', s: 'bold' }, { v: 'SKU', s: 'bold' }, { v: 'Qty on hand', s: 'bold' }, { v: 'Reorder point', s: 'bold' }, { v: 'Qty on PO', s: 'bold' }]].concat(x.items.map(function (i) { return [i.Name, i.Sku || '', { v: Number(i.QtyOnHand) || 0, s: 'none' }, i.ReorderPoint == null ? null : { v: Number(i.ReorderPoint), s: 'none' }, { v: x.onPo[i.Id] || 0, s: 'none' }]; })) }];
  }
});
```

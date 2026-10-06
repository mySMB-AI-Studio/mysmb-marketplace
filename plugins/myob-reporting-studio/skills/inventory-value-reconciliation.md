---
name: MYOB Inventory Value Reconciliation
description: MYOB Inventory Value Reconciliation (M52) as a live, validated report in MYOB styling. Use when the user asks to reconcile inventory, the inventory value reconciliation, whether stock value matches the balance sheet, or the inventory control account.
---
# Inventory Value Reconciliation (M52)

Use when the user asks to reconcile inventory, the inventory value reconciliation, whether stock value matches the balance sheet, or the inventory control account. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Inventory Value Reconciliation**. Template: `myob-reporting-studio` / `inventory-value-reconciliation` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_items`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Inventory → Inventory value reconciliation. Library: MYOB Reports Prompt Library v1.2 → Prompts → M52. Delivery: Wave 3 (P3).

## Discovery call

Call `list_items` once, `get_balance_sheet` once with `date` = today, `list_accounts` once and `list_company_files` once. The control account is each inventoried item's `AssetAccount` (else asset accounts named inventory or stock). Never infer the cause of a difference.

## Date defaults

`as_at` = the Balance Sheet date (default `"today"`). Item values are today's, so only today compares like with like — the report says so for any other date. The view is display `v` (`recon` by default).

## Members

| Member / view | How |
|---|---|
| Inventory value reconciliation | Items' value today vs the inventory account(s) at the date, the difference, the accounts and the items |
| A past date | Banner: the two sides are not for the same day; the tie is N/A |

## Validation checks (shown in the banner)

- **Independent tie (today):** the items' value = the inventory account(s) on the Balance Sheet
- Each item's value = on hand × average cost

## Save as

`fileName`: `myob-inventory-value-reconciliation.html` · `tags`: ["myob","inventory","M52","reconciliation"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Confirm on a file with stock that the difference is nil today, or that MYOB's own reconciliation report shows the same difference.
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"recon\",\"x\":\"\"}"
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
// Inventory — Stock on Hand (M48), Reorder (M47, variant), Item List (M51, variant) and Inventory Value Reconciliation (M52,
// variant), from MYOB's item list (list_items: today's quantities, average cost and value). Independent tie on every view: the items'
// value = the inventory account(s) on the Balance Sheet — exact only when the date is today (MYOB keeps today's item values only).
MK.app({
  title: 'Inventory Value Reconciliation', primary: 'items', files: 'company_files', kind: 'asat',
  inputs: { asAt: 'as_at', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"recon","x":""}' },
  uses: { items: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { items: 'list_items (every item — today\'s quantities, costs and values)', bs: 'get_balance_sheet (the inventory account at the date)', accounts: 'list_accounts (asset accounts)', company_files: 'list_company_files' },
  views: [['stock', 'Stock on hand'], ['reorder', 'Reorder'], ['list', 'Item list'], ['recon', 'Inventory value reconciliation']],
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, view = c.view || 'stock';
    if (c.errors.items) { body.innerHTML = '<p class="mk-err">' + h(c.err('items')) + '</p>'; return { checks: [{ name: 'Items loaded', pass: false, detail: c.err('items') }] }; }
    if (!c.data.items) return {};
    var n = function (v) { return MK.num(v) || 0; }, q = function (v) { return v == null ? '' : (Math.round(v * 1000) / 1000).toLocaleString('en-AU'); };
    var I = MK.items(c.data.items).map(function (x) { var b = x.BuyingDetails || {}, rs = b.RestockingInformation || {}, sup = rs.Supplier || {};
      return { no: x.Number || '', name: x.Name || '', active: x.IsActive !== false, inv: !!x.IsInventoried, sold: !!x.IsSold, bought: !!x.IsBought, oh: n(x.QuantityOnHand), cm: n(x.QuantityCommitted), oo: n(x.QuantityOnOrder), av: x.QuantityAvailable == null ? null : n(x.QuantityAvailable),
        avg: x.AverageCost == null ? null : n(x.AverageCost), value: n(x.CurrentValue), price: x.BaseSellingPrice != null ? n(x.BaseSellingPrice) : (x.SellingDetails || {}).BaseSellingPrice != null ? n(x.SellingDetails.BaseSellingPrice) : null,
        std: b.StandardCost == null ? null : n(b.StandardCost), last: b.LastPurchasePrice == null ? null : n(b.LastPurchasePrice), min: rs.MinimumLevelForRestockingAlert == null ? null : n(rs.MinimumLevelForRestockingAlert), oq: rs.DefaultOrderQuantity == null ? null : n(rs.DefaultOrderQuantity), sup: sup.Name || '', asset: x.AssetAccount || null }; })
      .sort(function (a, b) { return String(a.no).localeCompare(String(b.no), undefined, { numeric: true }); });
    var S = I.filter(function (i) { return i.inv; }), sv = MK.sum(S.map(function (i) { return i.value; })), today = c.inputs.as_at === c.today;
    // control account(s): the inventoried items' asset account; else asset accounts named inventory or stock
    var idx = MK.accounts(c.data.accounts), ctl = {}; S.forEach(function (i) { if (i.asset && (i.asset.UID || i.asset.DisplayID)) ctl[i.asset.UID || i.asset.DisplayID] = i.asset; });
    if (!Object.keys(ctl).length) idx.list.forEach(function (a) { if (!a.IsHeader && a.Classification === 'Asset' && /inventor|stock/i.test(a.Name || '')) ctl[a.UID || a.DisplayID] = a; });
    var bsRows = ((c.data.bs || {}).AccountsBreakdown || []).filter(function (r) { var a = r.Account || {}; return ctl[a.UID] || ctl[a.DisplayID]; }), cv = c.data.bs ? MK.sum(bsRows.map(function (r) { return n(r.AccountTotal); })) : null, nCtl = Object.keys(ctl).length;
    var tie = c.errors.bs ? { pass: null, detail: c.err('bs') } : !S.length ? { pass: null, detail: 'N/A — no inventoried items' } : !nCtl ? { pass: null, detail: 'N/A — no inventory account identified' } : !today ? { pass: null, detail: 'N/A — item values are today\'s; the Balance Sheet is at ' + c.inputs.as_at + ' (' + money(cv) + ')' } :
      { pass: MK.near(sv, cv), detail: money(sv) + ' vs ' + money(cv) + (MK.near(sv, cv) ? '' : ' — difference ' + money(r2(sv - cv)) + '; the data cannot tell a manual journal from a costing difference') };
    var cell = function (v, m) { return '<td class="num">' + (v == null ? '' : m ? money(v) : q(v)) + '</td>'; }, html = '', checks = [{ name: 'Items\' value = the inventory account(s) on the Balance Sheet (two MYOB sources)', pass: tie.pass, detail: tie.detail }];
    if (view === 'reorder') {
      var watched = S.filter(function (i) { return i.active && i.min != null; }), R = watched.filter(function (i) { return i.oh <= i.min; }).map(function (i) { return Object.assign({ short: r2(i.min - i.oh), cost: i.oq == null ? null : r2(i.oq * (i.last || i.std || i.avg || 0)) }, i); }).sort(function (a, b) { return b.short - a.short; });
      var none = S.filter(function (i) { return i.active && i.min == null; });
      html = MK.kpis([{ label: 'Items to reorder', money: false, value: R.length }, { label: 'Suggested order cost', value: MK.sum(R.map(function (r) { return r.cost; })) }, { label: 'Items without a minimum level', money: false, value: none.length }], c) +
        (none.length ? '<p class="muted">' + none.length + ' inventoried item(s) have no minimum level in MYOB, so they are not watched: ' + h(none.map(function (i) { return i.no; }).join(', ')) + '.</p>' : '') +
        '<table class="mk-grid"><thead><tr><th>Item no.</th><th>Item</th><th class="num">On hand</th><th class="num">Minimum</th><th class="num">Below minimum</th><th class="num">Order quantity</th><th>Supplier</th><th class="num">Est. cost</th></tr></thead><tbody>' +
        (R.length ? R.map(function (r) { return '<tr><td>' + h(r.no) + '</td><td>' + h(r.name) + '</td>' + cell(r.oh) + cell(r.min) + cell(r.short) + cell(r.oq) + '<td>' + h(r.sup) + '</td>' + cell(r.cost, 1) + '</tr>'; }).join('') : '<tr><td colspan="8" class="muted">No item is at or below its minimum level.</td></tr>') + '</tbody></table>';
      checks.push({ name: 'Every item listed is at or below its minimum level', pass: R.every(function (r) { return r.oh <= r.min; }), detail: R.length + ' of ' + watched.length + ' watched items' });
    } else if (view === 'list') {
      var act = c.display.x === 'active', L = I.filter(function (i) { return !act || i.active; });
      html = MK.kpis([{ label: 'Items', money: false, value: I.length }, { label: 'Inventoried', money: false, value: S.length }, { label: 'Inactive', money: false, value: I.filter(function (i) { return !i.active; }).length }, { label: 'Value on hand', value: sv }], c) +
        '<label style="display:block;margin:12px 0"><input type="checkbox" id="iv-active"' + (act ? ' checked' : '') + '> Active items only</label><table class="mk-grid"><thead><tr><th>Item no.</th><th>Item</th><th>Type</th><th class="num">Selling price</th><th class="num">Standard cost</th><th class="num">Average cost</th><th class="num">Value</th><th>Status</th></tr></thead><tbody>' +
        L.map(function (i) { return '<tr' + (i.active ? '' : ' class="muted"') + '><td>' + h(i.no) + '</td><td>' + h(i.name) + '</td><td>' + [i.bought ? 'Bought' : '', i.sold ? 'Sold' : '', i.inv ? 'Inventoried' : ''].filter(Boolean).join(' · ') + '</td>' + cell(i.price, 1) + cell(i.std, 1) + cell(i.avg, 1) + cell(i.inv ? i.value : null, 1) + '<td>' + (i.active ? 'Active' : 'Inactive') + '</td></tr>'; }).join('') + '</tbody></table>';
    } else if (view === 'recon') {
      html = (today ? '' : '<div class="mk-banner fail" style="margin-bottom:12px">Item values are today\'s, but the Balance Sheet is at ' + h(c.inputs.as_at) + ': the two sides are not for the same day.</div>') +
        MK.kpis([{ label: 'Items\' value (today)', value: sv }, { label: 'Inventory account(s) at the date', value: cv }, { label: 'Difference', value: cv == null ? null : r2(sv - cv) }], c) +
        '<h3>Inventory accounts</h3><table class="mk-grid"><thead><tr><th>Account</th><th class="num">Balance Sheet</th></tr></thead><tbody>' + (bsRows.length ? bsRows.map(function (r) { var a = r.Account || {}; return '<tr><td>' + h((a.DisplayID ? a.DisplayID + ' ' : '') + (a.Name || '')) + '</td>' + cell(n(r.AccountTotal), 1) + '</tr>'; }).join('') : '<tr><td colspan="2" class="muted">No inventory account identified on the Balance Sheet.</td></tr>') + '</tbody></table>' +
        '<h3 style="margin-top:20px">Items</h3><table class="mk-grid"><thead><tr><th>Item no.</th><th>Item</th><th class="num">On hand</th><th class="num">Average cost</th><th class="num">Value</th></tr></thead><tbody>' + S.map(function (i) { return '<tr><td>' + h(i.no) + '</td><td>' + h(i.name) + '</td>' + cell(i.oh) + cell(i.avg, 1) + cell(i.value, 1) + '</tr>'; }).join('') + '</tbody><tfoot><tr class="k-total"><td colspan="4">Total</td>' + cell(sv, 1) + '</tr></tfoot></table>';
      checks.push({ name: 'Each item\'s value = on hand × average cost', pass: S.length ? S.every(function (i) { return i.avg == null || MK.near(i.value, r2(i.oh * i.avg), Math.max(0.02, Math.abs(i.oh) * 0.005)); }) : null, detail: S.filter(function (i) { return i.avg != null && !MK.near(i.value, r2(i.oh * i.avg), Math.max(0.02, Math.abs(i.oh) * 0.005)); }).map(function (i) { return i.no; }).join(', ') || S.length + ' items' });
    } else {
      var A = S.filter(function (i) { return i.active; }), avail = function (i, plusOrder) { return r2(i.oh - i.cm + (plusOrder ? i.oo : 0)); };
      var f1 = A.every(function (i) { return i.av == null || MK.near(i.av, avail(i, false)); }), f2 = A.every(function (i) { return i.av == null || MK.near(i.av, avail(i, true)); });
      html = MK.kpis([{ label: 'Items in stock', money: false, value: A.filter(function (i) { return i.oh > 0; }).length }, { label: 'Out of stock', money: false, value: A.filter(function (i) { return i.oh <= 0; }).length }, { label: 'Committed', money: false, value: q(MK.sum(A.map(function (i) { return i.cm; }))) }, { label: 'Value on hand', value: sv }], c) +
        '<table class="mk-grid" style="margin-top:12px"><thead><tr><th>Item no.</th><th>Item</th><th class="num">On hand</th><th class="num">Committed</th><th class="num">On order</th><th class="num">Available</th><th class="num">Average cost</th><th class="num">Value</th></tr></thead><tbody>' +
        A.map(function (i) { return '<tr' + (i.oh <= 0 ? ' class="neg"' : '') + '><td>' + h(i.no) + '</td><td>' + h(i.name) + (i.oh <= 0 ? ' (no stock)' : '') + '</td>' + cell(i.oh) + cell(i.cm) + cell(i.oo) + cell(i.av) + cell(i.avg, 1) + cell(i.value, 1) + '</tr>'; }).join('') + '</tbody><tfoot><tr class="k-total"><td colspan="7">Total</td>' + cell(sv, 1) + '</tr></tfoot></table>';
      checks.push({ name: 'MYOB\'s available quantity = on hand − committed' + (f1 ? '' : f2 ? ' + on order' : ''), pass: A.length ? f1 || f2 : null, detail: f1 || f2 ? A.length + ' items' : A.filter(function (i) { return i.av != null && !MK.near(i.av, avail(i, false)) && !MK.near(i.av, avail(i, true)); }).map(function (i) { return i.no; }).join(', ') + ' — shown as MYOB returns them' });
    }
    body.innerHTML = html;
    var cb = document.getElementById('iv-active'); if (cb) cb.addEventListener('change', function () { c.change({}, { x: this.checked ? 'active' : '' }); });
    this._x = { I: I };
    return { checks: checks, title: { stock: 'Stock on Hand', reorder: 'Reorder', list: 'Item List', recon: 'Inventory Value Reconciliation' }[view], period: view === 'recon' ? MK.asOfLine(c.inputs.as_at) : 'Today',
      notes: ['From MYOB\'s item list: quantities, average cost and value are today\'s (MYOB keeps no history of them). The Balance Sheet is at the date chosen.'], na: ['Quantities and values at a past date', 'Locations and serial numbers (not in the item list)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Items', widths: [12, 30, 10, 10, 10, 10, 12, 14, 10, 30, 10], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Items', s: 'bold' }], ['Today'], [], ['Item no.', 'Item', 'On hand', 'Committed', 'On order', 'Available', 'Average cost', 'Value', 'Minimum', 'Supplier', 'Active'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.I.map(function (i) { return [i.no, i.name, i.oh, i.cm, i.oo, i.av == null ? '' : i.av, i.avg == null ? '' : { v: i.avg, s: 'money' }, { v: i.value, s: 'money' }, i.min == null ? '' : i.min, i.sup, i.active ? 'Yes' : 'No']; })) }];
  }
});
```

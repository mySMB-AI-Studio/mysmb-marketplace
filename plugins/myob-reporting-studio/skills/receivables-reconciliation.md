---
name: MYOB Receivables Reconciliation
description: MYOB Receivables Reconciliation (M33, M34) as a live, validated report in MYOB styling. Use when the user asks for a receivables reconciliation, to reconcile debtors or accounts receivable, whether the customer balances match the receivables account, or receivables exceptions.
---
# Receivables Reconciliation (M33, M34)

Use when the user asks for a receivables reconciliation, to reconcile debtors or accounts receivable, whether the customer balances match the receivables account, or receivables exceptions. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Receivables Reconciliation**. Report title: **MYOB Receivables Reconciliation**. Report title: **MYOB Receivables Reconciliation**. Template: `myob-reporting-studio` / `receivables-reconciliation` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_invoices`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Sales → Receivables reconciliation with tax / Receivables reconciliation exceptions. Library: MYOB Reports Prompt Library v1.2 → Prompts → M33, M34. Delivery: Wave 1 (P1, delivery order 5; M34 P2).

## Discovery call

Call `list_invoices` once with `status` = `Open`, and `get_balance_sheet` once with `date` = today, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

Always as at today (MYOB's API gives today's open balances; the kit sets `as_at`). Reconciliation with tax (M33) or exceptions (M34) is display `v` (`recon` | `exceptions`).

## Members

| Member / view | How |
|---|---|
| Receivables reconciliation with tax (M33) | Name | Amount outstanding | Tax outstanding per customer; Total; Receivables account; Out of balance amount |
| Receivables reconciliation exceptions (M34) | Report = Reconciliation exceptions (the tie-out and its possible causes) |
| As at an earlier date | N/A — MYOB's API gives today's open balances |

## Validation checks (shown in the banner)

- **Independent tie:** total outstanding − the receivables account (Balance Sheet) = out of balance amount, 0.00 expected
- Tax outstanding = each invoice's tax pro rata to what is still owed
- Each invoice: subtotal + tax = total

## Save as

`fileName`: `myob-receivables-reconciliation.html` · `tags`: ["myob","receivables","reconciliation","M33","M34"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com as at 9 Sep 2026: Daniel Lee 1,420.00 / 129.09 · Michael Thompson 534.75 / 48.61 · Total 2,326.96 / 211.53 · Receivables account 2,326.96 · Out of balance 0.00.
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"recon\"}"
    }
  ],
  "bindings": [
    {
      "id": "invoices",
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
  title: 'Receivables Reconciliation', primary: 'bs', files: 'company_files',
  // no as-at control: MYOB's API gives today's open balances, so the reconciliation is always as at today
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"recon"}' },
  uses: { invoices: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { invoices: 'list_invoices (open sales invoices — every page)', bs: 'get_balance_sheet (the receivables account today)', accounts: 'list_accounts (which accounts are receivables)', company_files: 'list_company_files' },
  roll: function () { return { as_at: MK.asAt('today') }; },
  views: [['recon', 'Reconciliation with tax'], ['exceptions', 'Reconciliation exceptions']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, asAt = c.inputs.as_at;
    if (c.errors.invoices) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('invoices')) + '</p>'; return { checks: [{ name: 'Open invoices loaded', pass: false, detail: c.err('invoices') }] }; }
    if (!c.data.invoices) return {};
    var inv = MK.items(c.data.invoices).filter(function (i) { return i && (MK.num(i.BalanceDueAmount) || 0) !== 0; }).map(function (i) {
      var cu = i.Customer || {}, bal = MK.num(i.BalanceDueAmount) || 0, tot = MK.num(i.TotalAmount) || 0, tax = MK.num(i.TotalTax) || 0;
      return { number: i.Number || '', date: MK.isoDate(i.Date), customer: cu.Name || '(no customer)', cid: cu.UID || cu.Name || '', balance: r2(bal), tax: tot ? r2(bal * tax / tot) : 0, total: tot, taxFull: tax, sub: MK.num(i.Subtotal) }; });
    var byC = {}; inv.forEach(function (x) { if (!byC[x.cid]) byC[x.cid] = { name: x.customer, amount: 0, tax: 0, docs: [] }; var y = byC[x.cid]; y.amount = r2(y.amount + x.balance); y.tax = r2(y.tax + x.tax); y.docs.push(x); });
    var cust = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var total = MK.sum(cust.map(function (x) { return x.amount; })), taxTot = MK.sum(cust.map(function (x) { return x.tax; }));
    var idx = MK.accounts(c.data.accounts), bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null;
    var arRows = bsB ? bsB.rows.filter(function (r) { return !r.header && (r.type === 'AccountReceivable' || (!idx.loaded && /receivable|debtors/i.test(r.name))); }) : [], control = arRows.length ? MK.sum(arRows.map(function (r) { return r.values[0]; })) : null;
    var oob = control == null ? null : r2(total - control), ok = oob != null && MK.near(oob, 0);
    var tie = '<table class="mk-grid" style="margin-top:12px"><tbody><tr class="k-total"><td>Total outstanding</td><td class="num">' + money(total) + '</td></tr><tr class="k-total"><td>Receivables account' + (arRows.length ? ' (' + MK.h(arRows.map(function (r) { return (r.code ? r.code + ' ' : '') + r.name; }).join(', ')) + ')' : '') + '</td><td class="num">' + (control == null ? 'N/A — not in source' : money(control)) + '</td></tr>' +
      '<tr class="k-total"><td>Out of balance amount</td><td class="num' + (oob != null && !ok ? ' neg' : '') + '">' + (oob == null ? 'N/A' : money(oob)) + '</td></tr></tbody></table><p><span class="chip ' + (ok ? 'up' : 'down') + '">' + (oob == null ? 'Not checked' : ok ? 'In balance' : 'Out of balance') + '</span></p>';
    var view = c.view || 'recon';
    body.innerHTML = MK.kpis([{ label: 'Total outstanding', value: total }, { label: 'Tax outstanding', value: taxTot }, { label: 'Receivables account', value: control }, { label: 'Out of balance', value: oob }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'exceptions' ? 'Receivables reconciliation exceptions' : 'Receivables reconciliation with tax') + ' — ' + MK.asOfLine(asAt).replace(/^As at /, '') + '</h3>' + (view === 'exceptions' ? tie + (ok ? '<p class="muted">No exceptions: the customers\' outstanding invoices equal the receivables account.</p>' : oob == null ? '' : '<p class="muted">Possible causes (not checked): a general journal or bank transaction posted straight to the receivables account; a customer payment or credit not applied to an invoice; an invoice dated after today.</p>') : '<div id="rr-grid"></div>' + tie) + '</div>';
    if (view !== 'exceptions') MK.grid(document.getElementById('rr-grid'), { rows: cust, filter: true, columns: [{ key: 'name', title: 'Name' }, { key: 'amount', title: 'Amount outstanding ($)', money: true }, { key: 'tax', title: 'Tax outstanding ($)', money: true }], total: { name: 'Total', amount: total, tax: taxTot }, empty: 'No outstanding invoices.' }, c);
    var taxDocs = inv.filter(function (x) { return x.total && x.sub != null && !MK.near(r2(x.sub + x.taxFull), x.total); });
    var checks = [
      control == null ? { name: 'Total outstanding − receivables account = out of balance (0.00 expected)', pass: null, detail: c.err('bs') || 'N/A — no receivables account found in the chart of accounts' }
        : { name: 'Total outstanding − receivables account = out of balance (0.00 expected; the Balance Sheet is a separate MYOB report)', pass: ok, detail: money(total) + ' − ' + money(control) + ' = ' + money(oob) },
      { name: 'Tax outstanding = Σ the invoices\' tax, pro rata to what is still owed', pass: MK.near(taxTot, MK.sum(inv.map(function (x) { return x.tax; }))), detail: money(taxTot) + ' on ' + inv.length + ' invoice(s)' },
      { name: 'Each invoice: subtotal + tax = total', pass: taxDocs.length === 0, detail: taxDocs.length ? taxDocs.length + ' invoice(s) differ, e.g. ' + taxDocs[0].number : inv.length + ' invoice(s)' }
    ];
    this._x = { cust: cust, total: total, taxTot: taxTot, control: control, oob: oob };
    return { checks: checks, notes: ['Open sales invoices with their balance due today, by customer; tax outstanding is each invoice\'s tax in proportion to what is still owed. The receivables account is every account of type Accounts Receivable on the Balance Sheet today.'],
      na: ['A reconciliation as at an earlier date (MYOB\'s API gives today\'s open balances)'], period: MK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; };
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Receivables reconciliation with tax', s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], [], ['Name', 'Amount outstanding ($)', 'Tax outstanding ($)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.cust.map(function (r) { return [r.name, mv(r.amount), mv(r.tax)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, { v: x.total, s: 'moneyBold' }, { v: x.taxTot, s: 'moneyBold' }], [{ v: 'Receivables account', s: 'bold' }, mv(x.control)], [{ v: 'Out of balance amount', s: 'bold' }, mv(x.oob)]]);
    return [{ name: 'Receivables reconciliation', rows: rows, widths: [36, 22, 20] }];
  }
});
```

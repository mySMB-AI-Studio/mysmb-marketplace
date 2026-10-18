---
name: MYOB Bank Activity
description: MYOB Bank Activity (M15) as a live, validated report in MYOB styling. Use when the user asks for bank activity, the transactions on a bank or credit-card account with a running balance, money in and out of the bank, or spend and receive money for a period.
---
# Bank Activity (M15)

Use when the user asks for bank activity, the transactions on a bank or credit-card account with a running balance, money in and out of the bank, or spend and receive money for a period. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Bank Activity**. Template: `myob-reporting-studio` / `bank-activity` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_journal_transactions`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Banking → Bank activity. Library: MYOB Reports Prompt Library v1.2 → Prompts → M15. Delivery: Wave 2 (P2).

## Discovery call

Call `list_journal_transactions` once with `from_date` / `to_date` = the period, `list_accounts` once (bank and credit-card accounts) and `list_company_files` once. When the user names an account, set `display.x` to its `UID`; otherwise leave `x` empty (every bank and credit-card account).

## Date defaults

`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`activity` | `summary`).

## Members

| Member / view | How |
|---|---|
| Bank activity | Per bank and credit-card account: opening balance, each journal line (date, ID No., type — spend, receive, transfer, payment —, description, money in, money out, running balance) and the closing balance |
| Summary by account | Report = Summary by account (opening, in, out, closing, Balance Sheet) |
| Account picker | Account select above the report |

## Validation checks (shown in the banner)

- **Independent tie:** every bank and credit-card account — opening (Balance Sheet the day before) + money in − money out = the closing Balance Sheet
- There is at least one bank or credit-card account

## Save as

`fileName`: `myob-bank-activity.html` · `tags`: ["myob","bank-activity","M15","banking"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com September 2026: 1-1110 Business Bank Account #1 opening + September activity = the 28 September balance.
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
      "name": "prev_day",
      "label": "Day before the period",
      "type": "date",
      "default": "2026-08-31"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"activity\",\"x\":\"\"}"
    }
  ],
  "bindings": [
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
      "id": "bs_open",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "prev_day"
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
      "id": "bs_close",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
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
// Bank Activity (M15): every journal line on the bank and credit-card accounts in the period, per account, with money in, money out,
// the transaction type (spend, receive, transfer, payment… from the journal's source) and a running balance from MYOB's opening
// balance. Opening + activity must equal the closing balance on the Balance Sheet for every account (two MYOB reports).
MK.app({
  title: 'Bank Activity', primary: 'journals', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', prev_day: '2026-08-31', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"activity","x":""}' },
  uses: { journals: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { journals: 'list_journal_transactions (every journal in the period — every page)', bs_open: 'get_balance_sheet (opening balances: the day before the period)', bs_close: 'get_balance_sheet (closing balances: the period end)', accounts: 'list_accounts (bank and credit-card accounts)', company_files: 'list_company_files' },
  views: [['activity', 'Bank activity'], ['summary', 'Summary by account']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.journals) { body.innerHTML = '<p class="mk-err">' + h(c.err('journals')) + '</p>'; return { checks: [{ name: 'Journal transactions loaded', pass: false, detail: c.err('journals') }] }; }
    if (!c.data.journals || !c.data.accounts) return {};
    var idx = MK.accounts(c.data.accounts), A = idx.list.filter(function (a) { return !a.IsHeader && (a.Type === 'Bank' || a.Type === 'CreditCard'); }).sort(function (a, b) { return String(a.DisplayID).localeCompare(String(b.DisplayID), undefined, { numeric: true }); });
    var bsv = function (rep, a) { var v = null; ((rep || {}).AccountsBreakdown || []).forEach(function (r) { var x = r.Account || {}; if ((x.UID && x.UID === a.UID) || (x.DisplayID && x.DisplayID === a.DisplayID)) v = r2(MK.num(r.AccountTotal) || 0); }); return v == null && rep ? 0 : v; };
    var TYPE = { SpendMoney: 'Spend money', ReceiveMoney: 'Receive money', TransferMoney: 'Transfer money', CustomerPayment: 'Customer payment', SupplierPayment: 'Supplier payment', Paycheque: 'Pay run', GeneralJournal: 'General journal', SaleInvoice: 'Sale', Bill: 'Purchase' };
    var L = {}; A.forEach(function (a) { L[a.UID] = []; });
    MK.items(c.data.journals).forEach(function (t) { (t.Lines || []).forEach(function (l) { var a = l.Account || {}, acc = A.filter(function (x) { return x.UID === a.UID || (!a.UID && x.DisplayID === a.DisplayID); })[0]; if (!acc) return;
      var amt = r2(Math.abs(MK.num(l.Amount) || 0)), src = (t.SourceTransaction || {}).TransactionType || t.JournalType || '';
      L[acc.UID].push({ date: MK.isoDate(t.DateOccurred || t.DatePosted), id: t.DisplayID || '', type: TYPE[src] || src, desc: l.LineDescription || t.Description || '', min: l.IsCredit ? null : amt, mout: l.IsCredit ? amt : null }); }); });
    // a bank account's balance rises with money in; a credit card's balance (what is owed) rises with money out
    var R = A.map(function (a) { var card = a.Type === 'CreditCard', open = bsv(c.data.bs_open, a), ls = L[a.UID].sort(function (x, y) { return x.date.localeCompare(y.date) || String(x.id).localeCompare(String(y.id), undefined, { numeric: true }); }), run = open;
      ls.forEach(function (l) { if (run != null) run = r2(run + (card ? -1 : 1) * ((l.min || 0) - (l.mout || 0))); l.bal = run; });
      return { a: a, card: card, open: open, lines: ls, min: MK.sum(ls.map(function (l) { return l.min; })), mout: MK.sum(ls.map(function (l) { return l.mout; })), end: run, close: bsv(c.data.bs_close, a) }; });
    var sel = c.display.x && R.some(function (r) { return r.a.UID === c.display.x; }) ? c.display.x : '', S = R.filter(function (r) { return !sel || r.a.UID === sel; }), view = c.view || 'activity';
    var cell = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; };
    var html = MK.kpis([{ label: 'Opening balance', value: S.length === 1 ? S[0].open : null, text: S.length === 1 ? null : S.length + ' accounts' }, { label: 'Money in', value: MK.sum(S.map(function (r) { return r.min; })) }, { label: 'Money out', value: MK.sum(S.map(function (r) { return r.mout; })) }, { label: 'Closing balance', value: S.length === 1 ? S[0].close : null, text: S.length === 1 ? null : 'Per account below' }], c) +
      '<label class="ctl" style="display:inline-flex;margin:12px 0">Account<select id="ba-acc"><option value="">All bank and credit-card accounts</option>' + R.map(function (r) { return '<option value="' + h(r.a.UID) + '"' + (r.a.UID === sel ? ' selected' : '') + '>' + h(r.a.DisplayID + ' ' + r.a.Name) + '</option>'; }).join('') + '</select></label>';
    if (view === 'summary') html += '<div class="mk-scroll"><table class="mk-grid"><thead><tr><th>Account</th><th>Type</th><th class="num">Opening ($)</th><th class="num">Money in ($)</th><th class="num">Money out ($)</th><th class="num">Closing ($)</th><th class="num">Balance Sheet ($)</th></tr></thead><tbody>' +
      S.map(function (r) { return '<tr><td>' + h(r.a.DisplayID + ' ' + r.a.Name) + '</td><td>' + (r.card ? 'Credit card' : 'Bank') + '</td>' + cell(r.open) + cell(r.min) + cell(r.mout) + cell(r.end) + '<td class="num' + (r.end != null && r.close != null && !MK.near(r.end, r.close) ? ' neg' : '') + '">' + (r.close == null ? '' : money(r.close)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    else html += '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Date</th><th>ID No.</th><th>Type</th><th>Description</th><th class="num">Money in ($)</th><th class="num">Money out ($)</th><th class="num">Balance ($)</th></tr></thead>' +
      S.map(function (r) { return '<tbody><tr class="k-header"><td colspan="6">' + h(r.a.DisplayID + ' ' + r.a.Name) + (r.card ? ' (credit card — balance owed)' : '') + '</td>' + cell(r.open) + '</tr>' +
        r.lines.map(function (l) { return '<tr class="k-row detail-block"><td>' + h(l.date) + '</td><td>' + h(l.id) + '</td><td>' + h(l.type) + '</td><td>' + h(l.desc) + '</td>' + cell(l.min) + cell(l.mout) + cell(l.bal) + '</tr>'; }).join('') +
        '<tr class="k-total"><td colspan="4">Total for ' + h(r.a.Name) + (r.end != null && r.close != null && !MK.near(r.end, r.close) ? ' <span class="mk-err">(Balance Sheet ' + money(r.close) + ')</span>' : '') + '</td>' + cell(r.min) + cell(r.mout) + cell(r.end) + '</tr></tbody>'; }).join('') + (S.length ? '' : '<tbody><tr><td colspan="7" class="muted">No bank or credit-card accounts in the chart.</td></tr></tbody>') + '</table></div>';
    body.innerHTML = html;
    document.getElementById('ba-acc').addEventListener('change', function () { c.change({}, { x: this.value }); });
    var bad = R.filter(function (r) { return r.end != null && r.close != null && !MK.near(r.end, r.close); }), ok = c.data.bs_open && c.data.bs_close;
    this._x = { S: S };
    return { checks: [
      { name: 'Every bank and credit-card account: opening + money in − money out = the closing Balance Sheet (two MYOB reports)', pass: !ok ? null : R.length ? bad.length === 0 : null, detail: !ok ? (c.err('bs_open') || c.err('bs_close') || 'N/A') : bad.length ? bad.map(function (r) { return r.a.DisplayID + ' ' + money(r.end) + ' vs ' + money(r.close); }).join('; ') : R.length + ' accounts' },
      { name: 'There is at least one bank or credit-card account', pass: R.length > 0, detail: R.length + ' account(s)' }],
      title: sel ? 'Bank Activity — ' + S[0].a.Name : 'Bank Activity',
      notes: ['From MYOB\'s journals (the general ledger), not the bank feed: see Bank Transactions for feed lines and their coding. The opening and closing balances come from MYOB\'s Balance Sheet; a credit card\'s balance is the amount owed.'],
      na: ['Cleared or reconciled flag per line (see Bank Reconciliation Status)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Bank Activity', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Account', 'Date', 'ID No.', 'Type', 'Description', 'Money in ($)', 'Money out ($)', 'Balance ($)'].map(function (t) { return { v: t, s: 'bold' }; })], mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    x.S.forEach(function (r) { rows.push([{ v: r.a.DisplayID + ' ' + r.a.Name, s: 'bold' }, 'Opening', '', '', '', '', '', mv(r.open)]); r.lines.forEach(function (l) { rows.push(['', l.date, l.id, l.type, l.desc, mv(l.min), mv(l.mout), mv(l.bal)]); }); });
    return [{ name: 'Bank activity', widths: [30, 12, 12, 16, 36, 14, 14, 14], rows: rows }];
  }
});
```

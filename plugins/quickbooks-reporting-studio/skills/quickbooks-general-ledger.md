---
name: quickbooks-general-ledger
description: QuickBooks Online General Ledger and transaction-list family (Q23) as a live, validated report in QuickBooks styling. Use when the user asks for the general ledger, GL, ledger detail for an account, the journal report, a transaction list by date, the account list or the chart of accounts.
---

# General Ledger and transaction-list family (Q23)

Use when the user asks for the general ledger, GL, ledger detail for an account, the journal report, a transaction list by date, the account list or the chart of accounts. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_general_ledger`, `get_report_journal_report`, `get_report_transaction_list`, `get_report_account_list`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › For my accountant. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q23. Delivery: Wave 2 (Train 03).

## Discovery call

`get_report_general_ledger` with `start_date`, `end_date`, `accounting_method` — expect one section per account whose Rows start with a 'Beginning Balance' Data row, columns Date | Transaction Type | Num | Name | Memo/Description | Split | Amount | Balance, and a 'Total for <account>' Summary.

## Date defaults

Preset `last_month`. Keep General Ledger periods to a month or a quarter — large periods return many rows.

## Members

| Member / view | How |
|---|---|
| General Ledger | Report = General Ledger |
| General Ledger Summary | Report = General Ledger Summary (beginning, net movement, ending per account) |
| Journal | Report = Journal (get_report_journal_report) |
| Transaction List by Date | Report = Transaction List by Date |
| Account List | Report = Account List |
| Adjusting Journal Entries, Recent / Recent Automatic Transactions, Recurring Template List, Invalid Journal Entries, Uncoded Transactions, Reconciliation Reports, Transaction List with Splits, Transaction Detail by Account | N/A or later members — not exposed as Accounting API reports |

## Validation checks (STEP 4 — shown in the banner)

- Balance = beginning + Σ amounts (every account)
- 'Total for <account>' amount = Σ its transactions
- Journal: Σ debits = Σ credits (Journal view)

## Save as

`fileName`: `quickbooks-general-ledger.html` · `tags`: ["quickbooks","general-ledger","accountant"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): PHP Bank: opening −A$8.52 → closing −A$2.69; loan payments to the Philippines Branch Office; Wise transfers.
3. Compare the layout with the Q23 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "start_date",
      "label": "From",
      "type": "date",
      "default": "2026-08-01"
    },
    {
      "name": "end_date",
      "label": "To",
      "type": "date",
      "default": "2026-08-31"
    },
    {
      "name": "basis",
      "label": "Accounting method",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"compact\",\"p\":\"last_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"gl\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "general_ledger",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_general_ledger"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "journal",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_journal_report"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "transaction_list",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_transaction_list"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
    },
    {
      "id": "account_list",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_account_list"
      },
      "params": {}
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
  title: 'General Ledger', token: 'GEN_LEDGER', route: 'report/builder', primary: 'general_ledger', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', basis: 'Accrual', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"compact","p":"last_month","a":"custom","c":"none","v":"gl","x":""}' },
  uses: { general_ledger: ['start_date', 'end_date', 'basis'], journal: ['start_date', 'end_date', 'basis'], transaction_list: ['start_date', 'end_date', 'basis'], account_list: [], company_info: [], prefs: [] },
  tools: { general_ledger: 'get_report_general_ledger', journal: 'get_report_journal_report', transaction_list: 'get_report_transaction_list', account_list: 'get_report_account_list', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['gl', 'General Ledger'], ['summary', 'General Ledger Summary'], ['journal', 'Journal'], ['txlist', 'Transaction List by Date'], ['accounts', 'Account List']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'gl';
    var need = { gl: 'general_ledger', summary: 'general_ledger', journal: 'journal', txlist: 'transaction_list', accounts: 'account_list' }[v];
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(need)) + '</p>'; return { checks: [{ name: 'Report data loaded', pass: false, detail: c.err(need) }] }; }
    if (!c.data[need]) return {};
    // General Ledger: one section per account — Beginning Balance row, transaction rows, 'Total for <account>' (Amount, Balance)
    var gl = c.data.general_ledger, glc = gl ? QB.cols(gl) : [], ai = glc.map(function (x) { return x.title; }).indexOf('Amount') - 1, bi = glc.map(function (x) { return x.title; }).indexOf('Balance') - 1;
    var accts = [];
    (gl && gl.Rows && gl.Rows.Row || []).forEach(function (sec) {
      if (!sec.Header || !sec.Rows) return;
      var name = (sec.Header.ColData[0] || {}).value || '', rows = QB.walk({ Rows: sec.Rows }), beg = null, amts = [], last = null;
      rows.forEach(function (r) { if (r.kind !== 'row') return; if (/^beginning balance$/i.test(r.label)) { beg = r.values[bi]; return; } amts.push(r.values[ai] || 0); last = r.values[bi]; });
      var sum = sec.Summary ? sec.Summary.ColData.map(function (x) { return QB.num(x.value); }) : [];
      accts.push({ name: name, beg: beg || 0, amount: QB.sum(amts), end: last != null ? last : beg, totAmt: sum[ai + 1], totBal: sum[bi + 1], n: amts.length, rows: rows });
    });
    var html = '', na = [];
    if (v === 'gl') {
      html = '<div class="qb-scroll"><table class="qb-grid"><thead><tr>' + glc.map(function (x, i) { return '<th' + (i >= ai + 1 ? ' class="num"' : '') + '>' + QB.h(x.title || 'Date') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        accts.map(function (a) { return '<tr class="k-header"><td colspan="' + glc.length + '">' + QB.h(a.name) + ' <span class="muted">(' + a.n + ')</span></td></tr>' +
          a.rows.filter(function (r) { return r.kind === 'row'; }).map(function (r) { return '<tr class="detail-block"><td>' + QB.h(r.label) + '</td>' + r.raw.map(function (x, i) { return i === ai || i === bi ? '<td class="num">' + money(QB.num(x)) + '</td>' : '<td>' + QB.h(x) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '<tr class="k-total"><td colspan="' + (ai + 1) + '">Total for ' + QB.h(a.name) + '</td><td class="num">' + money(a.totAmt) + '</td><td class="num">' + money(a.totBal) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    } else if (v === 'summary') {
      QB.grid(body, { filter: true, columns: [{ key: 'name', title: 'Account' }, { key: 'beg', title: 'Beginning balance', money: true }, { key: 'amount', title: 'Net movement', money: true }, { key: 'end', title: 'Ending balance', money: true }, { key: 'n', title: 'Transactions', num: true }], rows: accts }, c);
      na.push('Debit and credit columns in the GL Summary (the General Ledger returns signed amounts)');
    } else if (v === 'journal') {
      var jl = QB.walk(c.data.journal), gt = QB.find(jl, 'GrandTotal', /^total$/i);
      html = '<div class="qb-scroll"><table class="qb-grid"><thead><tr><th>Date</th><th>Transaction type</th><th>Num</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>' +
        jl.map(function (l) { if (l.kind === 'header') return '<tr class="k-header"><td>' + QB.h(l.label) + '</td><td>' + QB.h(l.raw[0]) + '</td><td>' + QB.h(l.raw[1]) + '</td><td colspan="3"></td></tr>'; if (l.kind === 'row') return '<tr class="detail-block"><td></td><td></td><td></td><td>' + QB.h(l.raw[2]) + '</td><td class="num">' + money(l.values[3]) + '</td><td class="num">' + money(l.values[4]) + '</td></tr>';
          return '<tr class="k-total"><td colspan="4">' + QB.h(l.label || '') + '</td><td class="num">' + money(l.values[3]) + '</td><td class="num">' + money(l.values[4]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      c._jdr = gt ? gt.values[3] : null; c._jcr = gt ? gt.values[4] : null;
    } else if (v === 'txlist') {
      var tl = c.data.transaction_list, tc = QB.cols(tl).map(function (x) { return x.title; }), rows = QB.walk(tl).filter(function (l) { return l.kind === 'row'; });
      QB.grid(body, { filter: true, columns: tc.map(function (t, i) { return { key: 'c' + i, title: t || 'Date', money: /amount/i.test(t) }; }), rows: rows.map(function (l) { var o = { c0: l.label }; l.raw.forEach(function (x, i) { o['c' + (i + 1)] = /amount/i.test(tc[i + 1] || '') ? QB.num(x) : x; }); return o; }) }, c);
    } else {
      var al = c.data.account_list, acs = QB.cols(al).map(function (x) { return x.title; }), ar = QB.walk(al).filter(function (l) { return l.kind === 'row'; });
      QB.grid(body, { filter: true, columns: acs.map(function (t, i) { return { key: 'c' + i, title: t || 'Account', money: /balance/i.test(t) }; }), rows: ar.map(function (l) { var o = { c0: l.label }; l.raw.forEach(function (x, i) { o['c' + (i + 1)] = /balance/i.test(acs[i + 1] || '') ? QB.num(x) : x; }); return o; }) }, c);
    }
    if (html) body.innerHTML = html;
    var balOk = accts.every(function (a) { return QB.near(a.end, a.beg + a.amount); }), totOk = accts.every(function (a) { return a.totAmt == null || QB.near(a.totAmt, a.amount); });
    var bad = accts.filter(function (a) { return !QB.near(a.end, a.beg + a.amount); }).map(function (a) { return a.name; });
    var checks = [
      { name: 'Balance = beginning + Σ amounts (every account)', pass: accts.length ? balOk : null, detail: bad.length ? 'Mismatch: ' + bad.join(', ') : accts.length + ' accounts' },
      { name: "'Total for <account>' amount = Σ its transactions", pass: accts.length ? totOk : null, detail: '' }];
    if (v === 'journal') checks.push({ name: 'Journal: Σ debits = Σ credits', pass: c._jdr == null ? null : QB.near(c._jdr, c._jcr), detail: money(c._jdr) + ' / ' + money(c._jcr) });
    this._x = { accts: accts, v: v };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', 'General Ledger'])[1],
      notes: ['Large periods return many rows — keep the period to a month or a quarter for a fast report.'],
      na: na.concat(['Adjusting Journal Entries, Recent / Recent Automatic Transactions, Recurring Template List, Invalid Journal Entries, Uncoded Transactions and Reconciliation Reports (not exposed as Accounting API reports)']) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'General Ledger Summary', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], [{ v: 'Account', s: 'bold' }, { v: 'Beginning balance', s: 'bold' }, { v: 'Net movement', s: 'bold' }, { v: 'Ending balance', s: 'bold' }]];
    x.accts.forEach(function (a) { rows.push([a.name, { v: a.beg, s: 'money' }, { v: a.amount, s: 'money' }, { v: a.end, s: 'money' }]); });
    var detail = [[{ v: 'Account', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Type', s: 'bold' }, { v: 'Num', s: 'bold' }, { v: 'Name', s: 'bold' }, { v: 'Memo', s: 'bold' }, { v: 'Split', s: 'bold' }, { v: 'Amount', s: 'bold' }, { v: 'Balance', s: 'bold' }]];
    x.accts.forEach(function (a) { a.rows.filter(function (r) { return r.kind === 'row'; }).forEach(function (r) { detail.push([a.name, r.label].concat(r.raw.slice(0, 5), [{ v: QB.num(r.raw[5]), s: 'money' }, { v: QB.num(r.raw[6]), s: 'money' }])); }); });
    return [{ name: 'GL Summary', rows: rows, widths: [40, 18, 18, 18] }, { name: 'General Ledger', rows: detail, widths: [28, 12, 16, 10, 24, 28, 24, 16, 16] }];
  }
});
```

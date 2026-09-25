---
name: quickbooks-client-overview
description: QuickBooks Online Client overview (accountant-only) (Q16) as a live, validated report in QuickBooks styling. Use when the user (an accountant or bookkeeper) asks for the client overview, a books health check, common issues, undeposited funds, uncategorised transactions, negative accounts, opening balance equity or transaction volume.
---

# Client overview (accountant-only) (Q16)

Use when the user (an accountant or bookkeeper) asks for the client overview, a books health check, common issues, undeposited funds, uncategorised transactions, negative accounts, opening balance equity or transaction volume. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`list_account`, `get_report_aged_receivables`, `get_report_aged_payables`, `get_report_transaction_list`, `qbo_query`, `get_preferences`).

QuickBooks location: All apps › Accounting › Client overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q16. Delivery: Wave 2 (Train 03).

## Discovery call

`list_account` (Active = true) — expect `QueryResponse.Account[]` with Name, AccountType, AccountSubType, Classification and CurrentBalance; plus both ageing reports and `get_report_transaction_list` for the last 30 days.

## Date defaults

No manual dates: the transaction-volume window (last 30 days) is set on every open.

## Members

| Member / view | How |
|---|---|
| Banking activity | 'In QuickBooks' balances per bank and card account; bank balance, unaccepted, unreconciled and reconciled-through are N/A (not in the Accounting API) |
| Common issues | Undeposited funds, uncategorised asset/income/expense, A/R and A/P ageing over 90 days, opening balance equity, negative asset and liability accounts, GST liabilities payable |
| Transaction volume | Last 30 days by transaction type |
| Books review, Prep for taxes | N/A — QuickBooks Accountant workflows |

## Validation checks (STEP 4 — shown in the banner)

- A/P ageing over 90 days = A/P ageing report 91-and-over band
- A/R ageing over 90 days = A/R ageing report 91-and-over band
- Transaction volume = Σ by type
- Unreconciled counts equal bank-feed queries (N/A — not in the API)

## Save as

`fileName`: `quickbooks-client-overview.html` · `tags`: ["quickbooks","accountant","books-review"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Banking: Wise-AUD A$145,221.70 in QuickBooks · ANZ A$99.00 · Doug's Amex A$16,708.64. Common issues: A/P ageing over 90 days −A$46,500.00 (10 transactions); negative asset/liability accounts 2.
3. Compare the layout with the Q16 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "tx_start",
      "label": "Transaction volume from",
      "type": "date",
      "default": "2026-08-27"
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
      "default": "Practitioner"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "accounts",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_account"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Active = true"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "aged_receivables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_receivables"
      },
      "params": {}
    },
    {
      "id": "aged_payables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_payables"
      },
      "params": {}
    },
    {
      "id": "transactions_30d",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_transaction_list"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "tx_start"
        },
        "end_date": {
          "kind": "context",
          "source": "now.date"
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
  title: 'Client overview', token: null, primary: 'aged_receivables', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { tx_start: '2026-08-27', persona: 'Practitioner',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: { transactions_30d: ['tx_start'], accounts: [], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { accounts: 'list_account (active)', aged_receivables: 'get_report_aged_receivables', aged_payables: 'get_report_aged_payables', transactions_30d: 'get_report_transaction_list (last 30 days)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  roll: function () { return { tx_start: QB.preset('last_30', 7).start }; },
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); };
    var accts = (c.data.accounts && c.data.accounts.QueryResponse && c.data.accounts.QueryResponse.Account) || [];
    if (c.errors.accounts) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('accounts')) + '</p>'; return { checks: [{ name: 'Chart of accounts loaded', pass: false, detail: c.err('accounts') }] }; }
    function aged(id) { var rep = c.data[id]; if (!rep) return null; var cols = QB.cols(rep), ls = QB.walk(rep), gt = QB.find(ls, 'GrandTotal', /^total$/i), last = cols.length - 3; // band before Total = 91 and over
      var rows = ls.filter(function (l) { return l.kind === 'row'; }); return { band: cols[last + 1] ? cols[last + 1].title : '91 and over', over90: gt ? gt.values[last] : null, rowsOver: rows.filter(function (r) { return r.values[last]; }).length, sumRows: QB.sum(rows.map(function (r) { return r.values[last]; })) }; }
    var ar = aged('aged_receivables'), ap = aged('aged_payables');
    var bank = accts.filter(function (a) { return a.AccountType === 'Bank' || a.AccountType === 'Credit Card'; });
    var find = function (re, sub) { return accts.filter(function (a) { return re.test(a.Name) || (sub && a.AccountSubType === sub); }); };
    var undep = find(/^undeposited funds$/i, 'UndepositedFunds'), uncat = find(/^uncategori[sz]ed (asset|income|expense)/i), obe = find(/^opening balance equity$/i), gst = find(/gst (liabilities|payable)/i);
    var negAL = accts.filter(function (a) { return (a.Classification === 'Asset' || a.Classification === 'Liability') && a.AccountType !== 'Credit Card' && Number(a.CurrentBalance) < 0; });
    var bal = function (list) { return QB.sum(list.map(function (a) { return Number(a.CurrentBalance) || 0; })); };
    var issues = [
      { issue: 'Undeposited funds', detail: undep.length ? money(bal(undep)) + ' waiting to be deposited' : 'No Undeposited Funds account', flag: bal(undep) !== 0 },
      { issue: 'Uncategorised asset / income / expense', detail: uncat.map(function (a) { return a.Name + ' ' + money(a.CurrentBalance); }).join(' · ') || 'None', flag: uncat.some(function (a) { return Number(a.CurrentBalance); }) },
      { issue: 'A/R ageing over 90 days', detail: ar ? money(ar.over90) + ' (' + ar.rowsOver + ' customer' + (ar.rowsOver === 1 ? '' : 's') + ')' : c.err('aged_receivables') || '', flag: ar && ar.over90 > 0 },
      { issue: 'A/P ageing over 90 days', detail: ap ? money(ap.over90) + ' (' + ap.rowsOver + ' supplier' + (ap.rowsOver === 1 ? '' : 's') + ')' : c.err('aged_payables') || '', flag: ap && ap.over90 > 0 },
      { issue: 'Opening balance equity', detail: obe.length ? money(bal(obe)) : 'No Opening Balance Equity account', flag: bal(obe) !== 0 },
      { issue: 'Negative asset and liability accounts', detail: negAL.length ? negAL.length + ': ' + negAL.map(function (a) { return a.Name + ' ' + money(a.CurrentBalance); }).join(' · ') : 'None', flag: negAL.length > 0 },
      { issue: 'GST Liabilities Payable', detail: gst.length ? money(bal(gst)) : 'No GST liability account', flag: false }];
    var tl = c.data.transactions_30d, tc = tl ? QB.cols(tl).map(function (x) { return x.title; }) : [], ti = tc.indexOf('Transaction Type') - 1, byType = {};
    var txRows = tl ? QB.walk(tl).filter(function (l) { return l.kind === 'row'; }) : [];
    txRows.forEach(function (r) { var k = ti >= 0 ? r.raw[ti] : 'Transaction'; byType[k] = (byType[k] || 0) + 1; });
    var types = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; });
    body.innerHTML = QB.kpis([{ label: 'Issues to review', money: false, value: issues.filter(function (i) { return i.flag; }).length }, { label: 'Bank & card accounts', money: false, value: bank.length }, { label: 'Transactions (30 days)', money: false, value: txRows.length }], c) +
      '<div class="qb-card"><h3>Banking activity</h3><div id="g1"></div></div><div class="qb-card"><h3>Common issues</h3><div id="g2"></div></div><div class="qb-card detail-block"><h3>Transaction volume <span class="muted">· last 30 days</span></h3><div id="ch1"></div></div>';
    QB.grid(document.getElementById('g1'), { columns: [{ key: 'n', title: 'Account' }, { key: 't', title: 'Type' }, { key: 'b', title: 'In QuickBooks', money: true }, { key: 'f', title: 'Bank balance' }, { key: 'u', title: 'Unaccepted' }, { key: 'r', title: 'Unreconciled' }, { key: 'd', title: 'Reconciled through' }],
      rows: bank.map(function (a) { return { n: a.Name, t: a.AccountType, b: a.CurrentBalance, f: 'N/A', u: 'N/A', r: 'N/A', d: 'N/A' }; }), empty: 'No bank or credit card accounts.' }, c);
    QB.grid(document.getElementById('g2'), { columns: [{ key: 's', title: '', html: true }, { key: 'issue', title: 'Issue' }, { key: 'detail', title: 'Detail' }], rows: issues.map(function (i) { return { s: i.flag ? '<span class="qb-err" aria-label="needs review">●</span>' : '<span class="muted" aria-label="ok">○</span>', issue: i.issue, detail: i.detail }; }) }, c);
    if (c.errors.transactions_30d) document.getElementById('ch1').innerHTML = '<p class="qb-err">' + QB.h(c.err('transactions_30d')) + '</p>';
    else QB.bars(document.getElementById('ch1'), { title: 'Transaction volume by type', labels: types, series: [{ name: 'Transactions', values: types.map(function (k) { return byType[k]; }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 0 }) });
    var checks = [
      { name: 'A/P ageing over 90 days = A/P ageing report ' + (ap ? ap.band : '91 and over') + ' band', pass: ap && ap.over90 != null ? QB.near(ap.over90, ap.sumRows) : null, detail: ap ? money(ap.over90) : '' },
      { name: 'A/R ageing over 90 days = A/R ageing report ' + (ar ? ar.band : '91 and over') + ' band', pass: ar && ar.over90 != null ? QB.near(ar.over90, ar.sumRows) : null, detail: ar ? money(ar.over90) : '' },
      { name: 'Transaction volume = Σ by type', pass: tl ? txRows.length === types.reduce(function (s, k) { return s + byType[k]; }, 0) : null, detail: txRows.length + ' transactions' },
      { name: 'Unreconciled counts equal bank-feed queries', pass: null, detail: 'N/A — reconciliation and bank-feed data are not exposed by the Accounting API' }];
    this._x = { bank: bank, issues: issues, byType: byType, types: types };
    return { checks: checks, period: QB.asOfLine(c.today), notes: ['Accountant view: intended for the Practitioner and Bookkeeper personas.'],
      na: ['Bank balance, unaccepted and unreconciled counts, and reconciled-through dates (bank feeds and reconciliations are not in the Accounting API)', 'Books review and Prep for taxes workflows (QuickBooks Accountant only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Client overview', widths: [40, 20, 60], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Client overview', s: 'bold' }], [QB.asOfLine(c.today)], [], [{ v: 'Common issues', s: 'bold' }, { v: 'Needs review', s: 'bold' }, { v: 'Detail', s: 'bold' }]].concat(x.issues.map(function (i) { return [i.issue, i.flag ? 'Yes' : 'No', i.detail]; }), [[], [{ v: 'Account', s: 'bold' }, { v: 'In QuickBooks', s: 'bold' }]], x.bank.map(function (a) { return [a.Name, { v: a.CurrentBalance, s: 'money' }]; }), [[], [{ v: 'Transaction type (30 days)', s: 'bold' }, { v: 'Count', s: 'bold' }]], x.types.map(function (k) { return [k, { v: x.byType[k], s: 'none' }]; })) }];
  }
});
```

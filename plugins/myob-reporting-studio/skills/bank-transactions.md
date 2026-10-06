---
name: MYOB Bank Transactions
description: MYOB Bank Transactions (M16) as a live, validated report in MYOB styling. Use when the user asks for bank transactions, bank feed lines, the bank statement lines, or transactions from the bank feed for a period.
---
# Bank Transactions (M16)

Use when the user asks for bank transactions, bank feed lines, the bank statement lines, or transactions from the bank feed for a period. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Bank Transactions**. Template: `myob-reporting-studio` / `bank-transactions` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_bank_statement_lines`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Banking → Bank transactions. Library: MYOB Reports Prompt Library v1.2 → Prompts → M16. Delivery: Wave 2 (P2).

## Discovery call

Call `list_bank_statement_lines` once with `status` = `All` and `from_date` / `to_date` = the period, and `list_company_files` once. Expect `{Date, Description, Account, Amount, IsCredit, Status (Uncoded / Coded / Hidden), Reference}` per line — `IsCredit` = money in. An empty list can mean bank feeds are not set up: say so.

## Date defaults

`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`transactions` | `coding`); `x` = an account UID.

## Members

| Member / view | How |
|---|---|
| Bank transactions | Per account in date order: date, description, reference, status, money in, money out, a running total from the start of the range |
| Coding | Report = Coding (also its own template, MYOB Coding) |
| Account picker | Account select above the report |
| Statement opening and closing balance | N/A — not in the feed lines |

## Validation checks (shown in the banner)

- Lines by status add up to every line (count and amount)
- Every line has a coding status
- For information: coded feed lines vs the ledger's movement on each account (they differ when entries have no feed line)

## Save as

`fileName`: `myob-bank-transactions.html` · `tags`: ["myob","bank-transactions","M16","banking"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com September 2026: coded lines equal the ledger movement on each feed account; recent lines uncoded.
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"transactions\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "lines",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bank_statement_lines"
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
// Bank Transactions (M16) and Coding (M18, the variant opening on the coding view): MYOB's bank-feed statement lines
// (list_bank_statement_lines — Banking/Statement), not journal postings: per account in date order with the coding status, and
// grouped by status with the uncoded backlog first. IsCredit = money in. The feed has no opening balance, so the running column is a
// total from the start of the range.
MK.app({
  title: 'Bank Transactions', primary: 'lines', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', prev_day: '2026-08-31', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"transactions","x":""}' },
  uses: { lines: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { lines: 'list_bank_statement_lines (every status, dated in the period — every page)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (account names and types)', company_files: 'list_company_files' },
  views: [['transactions', 'Bank transactions'], ['coding', 'Coding']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.lines) { body.innerHTML = '<p class="mk-err">' + h(c.err('lines')) + '</p>'; return { checks: [{ name: 'Bank statement lines loaded', pass: false, detail: c.err('lines') }] }; }
    if (!c.data.lines) return {};
    var idx = MK.accounts(c.data.accounts), Ls = MK.items(c.data.lines).map(function (x) { var a = x.Account || {}, k = a.UID || a.DisplayID || a.Name || '?', amt = r2(Math.abs(MK.num(x.Amount) || 0)), full = (a.UID && idx.byUid[a.UID]) || (a.DisplayID && idx.byCode[a.DisplayID]) || a;
      return { key: k, acc: (full.DisplayID ? full.DisplayID + ' ' : '') + (full.Name || 'N/A'), card: full.Type === 'CreditCard', date: MK.isoDate(x.Date), desc: x.Description || '', ref: x.Reference || '', status: x.Status || 'Unknown', min: x.IsCredit ? amt : null, mout: x.IsCredit ? null : amt, net: x.IsCredit ? amt : -amt }; })
      .sort(function (a, b) { return a.acc.localeCompare(b.acc) || a.date.localeCompare(b.date); });
    var accs = {}; Ls.forEach(function (l) { accs[l.key] = accs[l.key] || l.acc; });
    var sel = c.display.x && accs[c.display.x] ? c.display.x : '', S = Ls.filter(function (l) { return !sel || l.key === sel; }), view = c.view || 'transactions', ST = ['Uncoded', 'Coded', 'Hidden'];
    Object.keys(S.reduce(function (o, l) { o[l.status] = 1; return o; }, {})).forEach(function (s) { if (ST.indexOf(s) < 0) ST.push(s); });
    var by = function (s) { var g = S.filter(function (l) { return l.status === s; }); return { n: g.length, net: MK.sum(g.map(function (l) { return l.net; })), g: g }; };
    var cell = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; }, rowsOf = function (g, run) { var t = 0; return g.map(function (l) { t = r2(t + l.net); return '<tr class="k-row detail-block"><td>' + h(l.date) + '</td><td>' + h(l.desc) + '</td><td>' + h(l.ref) + '</td><td>' + (l.status === 'Uncoded' ? '<strong>Uncoded</strong>' : h(l.status)) + '</td>' + cell(l.min) + cell(l.mout) + (run ? cell(t) : '') + '</tr>'; }).join(''); };
    var head = function (run) { return '<thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Status</th><th class="num">Money in ($)</th><th class="num">Money out ($)</th>' + (run ? '<th class="num">Running total ($)</th>' : '') + '</tr></thead>'; };
    var u = by('Uncoded'), html = MK.kpis(ST.map(function (s) { var b = by(s); return { label: s + ' (' + b.n + ')', value: b.net }; }).concat([{ label: 'Lines', money: false, value: S.length }]), c) +
      (u.n ? '<div class="mk-banner fail" style="margin-top:12px"><strong>' + u.n + ' uncoded line' + (u.n > 1 ? 's' : '') + '</strong> to code in MYOB (Banking › Bank transactions).</div>' : '') +
      '<label class="ctl" style="display:inline-flex;margin:12px 0">Account<select id="bt-acc"><option value="">All bank and credit-card accounts</option>' + Object.keys(accs).sort(function (a, b) { return accs[a].localeCompare(accs[b]); }).map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(accs[k]) + '</option>'; }).join('') + '</select></label>';
    if (view === 'coding') html += ST.map(function (s) { var b = by(s); return b.n ? '<h3>' + h(s) + ' (' + b.n + ')</h3><div class="mk-scroll"><table class="mk-stmt">' + head(false) + '<tbody>' + rowsOf(b.g, false) + '</tbody><tfoot><tr class="k-total"><td colspan="4">Total ' + h(s.toLowerCase()) + '</td>' + cell(MK.sum(b.g.map(function (l) { return l.min; }))) + cell(MK.sum(b.g.map(function (l) { return l.mout; }))) + '</tr></tfoot></table></div>' : ''; }).join('');
    else html += '<div class="mk-scroll"><table class="mk-stmt">' + head(true) + Object.keys(accs).filter(function (k) { return !sel || k === sel; }).map(function (k) { var g = S.filter(function (l) { return l.key === k; });
      return '<tbody><tr class="k-header"><td colspan="7">' + h(accs[k]) + '</td></tr>' + rowsOf(g, true) + '<tr class="k-total"><td colspan="4">Total for ' + h(accs[k]) + '</td>' + cell(MK.sum(g.map(function (l) { return l.min; }))) + cell(MK.sum(g.map(function (l) { return l.mout; }))) + cell(MK.sum(g.map(function (l) { return l.net; }))) + '</tr></tbody>'; }).join('') + (S.length ? '' : '<tbody><tr><td colspan="7" class="muted">No bank-feed lines in this period.</td></tr></tbody>') + '</table></div>';
    body.innerHTML = html + (S.length ? '' : '<p class="muted">MYOB returned no bank-feed lines for this period (bank feeds may not be set up for these accounts).</p>');
    document.getElementById('bt-acc').addEventListener('change', function () { c.change({}, { x: this.value }); });
    // ties: the status groups add up to every line; for information, coded lines against the ledger's movement on the account
    var sumN = ST.reduce(function (n, s) { return n + by(s).n; }, 0), sumV = r2(ST.reduce(function (v, s) { return v + by(s).net; }, 0)), noStatus = S.filter(function (l) { return !l.status || l.status === 'Unknown'; }).length;
    var mv = function (rep, k) { var v = 0, a = idx.byUid[k] || idx.byCode[k] || {}; ((rep || {}).AccountsBreakdown || []).forEach(function (r) { var x = r.Account || {}; if ((x.UID && x.UID === a.UID) || (x.DisplayID && x.DisplayID === a.DisplayID)) v = MK.num(r.AccountTotal) || 0; }); return v; };
    var info = c.data.bs_open && c.data.bs_close ? Object.keys(accs).filter(function (k) { return !sel || k === sel; }).map(function (k) { var coded = MK.sum(Ls.filter(function (l) { return l.key === k && l.status === 'Coded'; }).map(function (l) { return l.net; })), card = (Ls.filter(function (l) { return l.key === k; })[0] || {}).card, led = r2((card ? -1 : 1) * (mv(c.data.bs_close, k) - mv(c.data.bs_open, k)));
      return accs[k] + ': coded ' + money(coded) + ' vs ledger ' + money(led) + (MK.near(coded, led) ? ' ✓' : ''); }).join('; ') : null;
    this._x = { S: S, ST: ST };
    return { checks: [
      { name: 'Lines by status add up to every line (count and amount)', pass: sumN === S.length && MK.near(sumV, MK.sum(S.map(function (l) { return l.net; }))), detail: S.length + ' lines · net ' + money(sumV) },
      { name: 'Every line has a coding status', pass: S.length ? noStatus === 0 : null, detail: noStatus ? noStatus + ' without one' : S.length + ' lines' },
      { name: 'Coded feed lines vs the ledger\'s movement on each account (Balance Sheet, two dates)', pass: null, info: true, detail: info || 'N/A — Balance Sheet unavailable' }],
      title: (view === 'coding' ? 'Coding' : 'Bank Transactions') + (sel ? ' — ' + accs[sel] : ''),
      notes: ['MYOB\'s bank-feed lines (Banking › Bank transactions), not journal postings — see Bank Activity for the ledger. The running total starts at zero on the first day of the range; the feed has no opening balance.', 'Coded lines and the ledger can differ when transactions were entered without a feed line, or coded lines are dated differently; the information line shows both.'],
      na: ['Opening and closing statement balance (not in the feed lines)', 'Allocation detail of coded lines (the journal is in Bank Activity)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Bank transactions', widths: [30, 12, 40, 16, 12, 14, 14], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Bank Transactions', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Account', 'Date', 'Description', 'Reference', 'Status', 'Money in ($)', 'Money out ($)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.S.map(function (l) { return [l.acc, l.date, l.desc, l.ref, l.status, l.min == null ? '' : { v: l.min, s: 'money' }, l.mout == null ? '' : { v: l.mout, s: 'money' }]; })) }];
  }
});
```

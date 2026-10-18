---
name: MYOB Balance Sheet
description: MYOB Balance Sheet (M02) as a live, validated report in MYOB styling. Use when the user asks for a balance sheet, statement of financial position, net assets, assets and liabilities as at a date, or a balance sheet comparison.
---
# Balance Sheet (M02)

Use when the user asks for a balance sheet, statement of financial position, net assets, assets and liabilities as at a date, or a balance sheet comparison. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Balance Sheet**. Template: `myob-reporting-studio` / `balance-sheet` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_balance_sheet`, `get_profit_and_loss_3m`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → Balance sheet. Library: MYOB Reports Prompt Library v1.2 → Prompts → M02. Delivery: Wave 1 (P1, delivery order 2).

## Discovery call

Call `get_balance_sheet` once with `date` = today and `reporting_basis` = `Accrual`, and call `list_company_files` once. Expect `{AsOfDate, AccountsBreakdown:[{Account:{UID,Name,DisplayID}, AccountTotal}]}` — no totals; values are positive in each account's normal balance (an overdrawn bank is negative). The Equity section includes MYOB's Current Year Earnings account (this year's profit to date). `{"__error": …}` is a failed call.

## Date defaults

`as_at` = the balance date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. `fy_start` is derived by the kit from `as_at` — leave its default. `compare_as_at` is set by the Compare to control.

## Members

| Member / view | How |
|---|---|
| Balance sheet | Report = Balance Sheet (default) |
| Balance sheet summary | Report = Summary (totals only) |
| Comparison with last year / last month end | Compare to = Previous year / Previous month end |
| Category levels 1–4, Consolidate | N/A — the MYOB API returns account totals only (header groupings are not reported); one company file per report |

## Validation checks (shown in the banner)

- Total Assets = Total Liabilities + Total Equity. If they differ by exactly last financial year's net profit (a file not yet rolled over — MYOB's account summary then omits it), the report adds a computed equity line "Prior year earnings not yet closed to Retained Earnings" and an information line to roll over the year; any other difference fails and shows last year's profit for diagnosis
- Every account on the Balance Sheet is classified
- Section totals = Σ their accounts
- **Independent tie:** Current Year Earnings = P&L Net Profit from the financial-year start to the as-at date (a separate MYOB report)
- Comparison date loaded (when Compare to is on)

## Save as

`fileName`: `myob-balance-sheet.html` · `tags`: ["myob","balance-sheet","M02","financial-statement"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com as at 9 Sep 2026: Bank (555.45); Accounts receivable 2,326.96; Total assets 1,771.51; GST 161.03; Total liabilities 161.03; Net assets / Current year earnings / Total equity 1,610.48. Live on 28 Sep 2026: Total assets 3,896.01 (receivables 4,328.96, bank (432.95)), Total liabilities 1,713.25, Total equity 2,182.76.
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
      "name": "compare_as_at",
      "label": "Compare as at",
      "type": "date",
      "default": "2025-09-28"
    },
    {
      "name": "fy_start",
      "label": "Financial year start",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "prev_fy_start",
      "label": "Last financial year start",
      "type": "date",
      "default": "2025-07-01"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"bs\"}"
    }
  ],
  "bindings": [
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
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bs_compare",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "compare_as_at"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "pnl_ytd",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "fy_start"
        },
        "to_date": {
          "kind": "input",
          "input": "as_at"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "pnl_since_prev",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "prev_fy_start"
        },
        "to_date": {
          "kind": "input",
          "input": "as_at"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
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
  title: 'Balance Sheet', primary: 'bs', files: 'company_files',
  inputs: { asAt: 'as_at', basis: 'basis', cmpAsAt: 'compare_as_at', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', basis: 'Accrual', compare_as_at: '2025-09-28', fy_start: '2026-07-01', prev_fy_start: '2025-07-01', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"bs"}' },
  uses: { bs: ['as_at', 'basis', 'company_file'], bs_compare: ['compare_as_at', 'basis', 'company_file'], pnl_ytd: ['fy_start', 'as_at', 'basis', 'company_file'], pnl_since_prev: ['prev_fy_start', 'as_at', 'basis', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bs: 'get_balance_sheet', bs_compare: 'get_balance_sheet (comparison date)', pnl_ytd: 'get_profit_and_loss_3m (financial year to date, for the Current Year Earnings tie)', pnl_since_prev: 'get_profit_and_loss_3m (from last financial year start — last year\'s profit, if not yet closed)', accounts: 'list_accounts (classifications)', company_files: 'list_company_files' },
  compare: true,
  views: [['bs', 'Balance Sheet'], ['summary', 'Summary (totals only)']],
  derive: function (inp, fyMonth) { var f = MK.fyStartOf(inp.as_at, fyMonth); return { fy_start: f, prev_fy_start: (Number(f.slice(0, 4)) - 1) + f.slice(4) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); };
    if (c.errors.bs) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('bs')) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err('bs') }] }; }
    if (!c.data.bs) return {};
    var cmpOn = c.compareMode !== 'none', idx = MK.accounts(c.data.accounts);
    var b = MK.breakdown(cmpOn ? [c.data.bs, c.data.bs_compare] : [c.data.bs], idx, MK.BS_LAYOUT);
    var lines = b.lines.map(function (l) { return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? l.values[1] : null }); });
    if (c.view === 'summary') lines = lines.filter(function (l) { return l.kind !== 'row'; });
    var A = b.totals.Asset[0], L = b.totals.Liability[0], E = b.totals.Equity[0], NA = b.calc.NetAssets[0];
    // Last financial year's profit not yet closed into Retained Earnings (the file was not rolled over): MYOB's per-account summary
    // leaves it out, so A ≠ L + E by exactly that amount. Measured as P&L(last FY start → as-at) − P&L(this FY start → as-at).
    var plYtd = c.data.pnl_ytd ? MK.breakdown([c.data.pnl_ytd], idx, MK.PL_LAYOUT) : null, plTwo = c.data.pnl_since_prev ? MK.breakdown([c.data.pnl_since_prev], idx, MK.PL_LAYOUT) : null;
    var prevNp = plYtd && plTwo ? Math.round((plTwo.calc.NetProfit[0] - plYtd.calc.NetProfit[0]) * 100) / 100 : null, gap = Math.round((A - L - E) * 100) / 100;
    var unclosed = Math.abs(gap) >= 0.01 && prevNp != null && MK.near(gap, prevNp) && !cmpOn;
    if (unclosed) {
      var eTot = lines.filter(function (l) { return l.kind === 'total' && l.group === 'Equity'; })[0], at = lines.indexOf(eTot);
      if (at >= 0) lines.splice(at, 0, { kind: 'row', depth: 1, label: 'Prior year earnings not yet closed to Retained Earnings', group: 'EquityCalc', path: ['Equity'], values: [gap], calc: true });
      if (eTot) eTot.values = [Math.round((E + gap) * 100) / 100];
      E = Math.round((E + gap) * 100) / 100;
    }
    var cyeLine = MK.currentYearEarnings(lines.length && c.view !== 'summary' ? lines : b.lines), cye = cyeLine ? MK.val(cyeLine) : null;
    var pl = c.data.pnl_ytd ? MK.breakdown([c.data.pnl_ytd], idx, MK.PL_LAYOUT) : null, np = pl ? pl.calc.NetProfit[0] : null;
    var extra = cmpOn ? MK.compareCols(c.compareMode === 'prev_year' ? 'Previous year' : 'Previous month end') : [];
    body.innerHTML = MK.kpis([{ label: 'Total Assets', value: A }, { label: 'Total Liabilities', value: L }, { label: 'Net Assets', value: NA }, { label: 'Total Equity', value: E }], c) +
      '<div class="mk-scroll">' + MK.statement(lines, ['', MK.asOfLine(c.inputs.as_at).replace(/^As at /, '')], c, extra) + '</div>' +
      '<div class="mk-card detail-block" style="margin-top:16px"><h3>Assets vs liabilities + equity</h3><div id="ch1"></div></div>';
    MK.bars(document.getElementById('ch1'), { title: 'Assets vs liabilities + equity', labels: ['Assets', 'Liabilities', 'Equity', 'Liabilities + Equity'], series: [{ name: MK.asOfLine(c.inputs.as_at), values: [A, L, E, Math.round((L + E) * 100) / 100] }] }, c);
    var ties = MK.linesTies(b.lines), plErr = c.errors.pnl_ytd;
    var checks = [
      { name: 'Total Assets = Total Liabilities + Total Equity', pass: b.rows.length ? MK.near(A, L + E) : null, detail: money(A) + ' vs ' + money(Math.round((L + E) * 100) / 100) + (!unclosed && Math.abs(gap) >= 0.01 ? ' — difference ' + money(gap) + (prevNp != null ? '; last financial year\'s net profit is ' + money(prevNp) : '') : '') },
      unclosed ? { name: 'Last financial year\'s profit not yet closed to Retained Earnings (information)', pass: null, info: true, detail: money(gap) + ' = P&L net profit ' + MK.fyStartOf(c.inputs.prev_fy_start, c.fy.month) + ' to the day before ' + c.inputs.fy_start + ' — roll over the financial year in MYOB to move it into Retained Earnings' } : null,
      { name: 'Every account on the Balance Sheet is classified', pass: c.errors.accounts ? null : b.unclassified.length === 0, detail: c.errors.accounts ? 'Chart of accounts unavailable — classified by account number' : b.unclassified.length ? b.unclassified.map(function (r) { return r.code + ' ' + r.name; }).join(', ') : b.rows.length + ' accounts' },
      { name: 'Section totals = Σ their accounts', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Current Year Earnings = P&L Net Profit ' + c.inputs.fy_start + ' to ' + c.inputs.as_at, pass: plErr || np == null || cye == null ? null : MK.near(cye, np), detail: plErr ? c.err('pnl_ytd') : cye == null ? 'No Current Year Earnings account on the Balance Sheet' : money(cye) + ' vs ' + money(np) }
    ];
    checks = checks.filter(Boolean);
    if (cmpOn) checks.push({ name: 'Comparison date loaded', pass: c.errors.bs_compare ? false : c.data.bs_compare ? true : null, detail: c.errors.bs_compare ? c.err('bs_compare') : c.inputs.compare_as_at });
    var notes = MK.signNotes(b.totals);
    if (unclosed) notes.push('Equity includes ' + money(gap) + ' of last financial year\'s profit that MYOB has not yet closed into Retained Earnings (computed from the P&L; the MYOB API reports account balances only).');
    if (b.byCode) notes.push(b.byCode + ' account(s) were classified by account number because the chart of accounts did not list them.');
    if (b.headersSkipped.length) notes.push(b.headersSkipped.length + ' header account(s) returned by MYOB were left out so their totals are not counted twice.');
    var neg = b.rows.filter(function (r) { return r.cls === 'Asset' && r.values[0] < 0 && /^(Bank)$/.test(r.type || ''); });
    if (neg.length) notes.push('Overdrawn bank account(s): ' + neg.map(function (r) { return r.name + ' ' + money(r.values[0]); }).join(', ') + '.');
    this._lines = lines; this._extra = extra;
    return { checks: checks, notes: notes, na: ['Sub-section subtotals such as Current Assets (the MYOB API returns account totals only; header-account groupings are not reported)'],
      title: cmpOn ? 'Balance Sheet Comparison' : c.view === 'summary' ? 'Balance Sheet Summary' : 'Balance Sheet' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Balance'].concat(extra.map(function (e) { return e.title; }));
    return [MK.sheetFromLines('Balance Sheet', c.company, MK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), MK.footerStamp(c.inputs.basis, c.fetchedAt), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});
```

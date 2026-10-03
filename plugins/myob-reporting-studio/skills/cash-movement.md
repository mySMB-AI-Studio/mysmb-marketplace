---
name: MYOB Cash Movement
description: MYOB Cash Movement (M05) as a live, validated report in MYOB styling. Use when the user asks for cash movement, where the cash went, cash in and out, or how the bank balance changed over a period.
---
# Cash Movement (M05)

Use when the user asks for cash movement, where the cash went, cash in and out, or how the bank balance changed over a period. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Cash Movement**. Template: `myob-reporting-studio` / `cash-movement` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_profit_and_loss_3m`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → Cash movement. Library: MYOB Reports Prompt Library v1.2 → Prompts → M05. Delivery: Wave 1 (P1, delivery order 3).

## Discovery call

Call `get_profit_and_loss_3m` once for the period (`reporting_basis` = `Accrual`), `get_balance_sheet` once at the period end, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` as for the Profit and Loss). `prev_day` is derived by the kit — leave it. The view is display `v` (`cm` | `bank`).

## Members

| Member / view | How |
|---|---|
| Cash movement | The P&L for the period, then the change in every non-bank account as its effect on cash, Net Cash Movement in (Out), opening and closing bank balances |
| Bank accounts | Report = Bank accounts (opening, movement, closing per bank account) |
| Comparison with last year, monthly breakdown | Not yet |

## Validation checks (shown in the banner)

- **Independent tie:** closing bank balance = opening bank balance + net cash movement (bank accounts on two Balance Sheets vs the P&L and every other account's change)
- Net cash movement = net profit + the change in every non-bank account
- Every account is classified, with at least one bank account
- A year-end close inside the period is shown for information

## Save as

`fileName`: `myob-cash-movement.html` · `tags`: ["myob","cash-movement","M05","cash"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com 1 Jul – 9 Sep 2026: Net profit 1,610.48; receivables up 2,326.96 (uses cash); GST up 161.03; bank closing (555.45) = opening 0.00 + net cash movement (555.45).
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
      "name": "prev_day",
      "label": "Day before the period",
      "type": "date",
      "default": "2026-06-30"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"cm\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_profit_and_loss_3m"
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
MK.app({
  title: 'Cash Movement', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', prev_day: '2026-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"cm"}' },
  uses: { pnl: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss_3m (the period)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (which accounts are bank accounts)', company_files: 'list_company_files' },
  views: [['cm', 'Cash movement'], ['bank', 'Bank accounts']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['pnl', 'bs_open', 'bs_close'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Profit and Loss and both Balance Sheets loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.pnl || !c.data.bs_open || !c.data.bs_close) return {};
    var idx = MK.accounts(c.data.accounts), pl = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT), bs = MK.breakdown([c.data.bs_open, c.data.bs_close], idx, MK.BS_LAYOUT);
    // MYOB's layout: the P&L for the period, then each balance-sheet account's movement as its effect on cash (MK.cashMoves).
    var cf = MK.cashMoves(bs, pl, from, to, c.fy && c.fy.month), np = cf.np, fyCross = cf.fyCross, rollAdj = cf.rollAdj;
    var sec = function (cls, label) { var l = cf.moves.filter(function (r) { return r.cls === cls; }).map(function (r) { return { label: (r.code ? r.code + ' ' : '') + r.name, value: r.effect }; }).filter(function (x) { return Math.abs(x.value) >= 0.005 || c.display.zeros; }); return { label: label, rows: l, total: MK.sum(l.map(function (x) { return x.value; })) }; };
    var A = sec('Asset', 'Assets (increase uses cash)'), L = sec('Liability', 'Liabilities (increase provides cash)'), E = sec('Equity', 'Equity (excluding this year\'s profit)');
    var net = cf.net, bank = cf.bank, open = cf.open, close = cf.close, bankMove = r2(close - open);
    var tr = function (label, v, cls) { return '<tr class="' + (cls || '') + '"><td>' + MK.h(label) + '</td><td class="num">' + money(v) + '</td></tr>'; };
    var plRows = pl.lines.filter(function (l) { return l.kind !== 'header'; }).map(function (l) { return tr(l.kind === 'row' ? '  ' + (l.code ? l.code + ' ' : '') + l.label : l.label, l.values[0], l.kind === 'total' ? 'k-total' : ''); }).join('');
    var block = function (s) { return '<tr class="k-head"><td colspan="2"><strong>' + MK.h(s.label) + '</strong></td></tr>' + s.rows.map(function (x) { return tr('  ' + x.label, x.value); }).join('') + tr('Total ' + s.label.replace(/ \(.*\)$/, ''), s.total, 'k-total'); };
    var view = c.view || 'cm';
    body.innerHTML = MK.kpis([{ label: 'Net profit', value: np }, { label: 'Net cash movement', value: net }, { label: 'Opening bank', value: open }, { label: 'Closing bank', value: close }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'bank' ? 'Bank accounts' : 'Cash movement') + ' — ' + MK.h(MK.periodLine(from, to)) + '</h3>' + (view === 'bank' ? '<div id="cm-bank"></div>'
        : '<div class="mk-scroll"><table class="mk-grid"><tbody>' + plRows + block(A) + block(L) + block(E) + tr('Net Cash Movement in (Out)', net, 'k-total') + tr('Opening Balance (bank accounts)', open) + tr('Closing Balance (bank accounts)', close, 'k-total') + '</tbody></table></div>') + '</div>';
    if (view === 'bank') MK.grid(document.getElementById('cm-bank'), { rows: bank.map(function (r) { return { code: r.code, name: r.name, open: r.open, move: r2(r.close - r.open), close: r.close }; }), columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Bank account' }, { key: 'open', title: 'Opening balance', money: true }, { key: 'move', title: 'Movement', money: true }, { key: 'close', title: 'Closing balance', money: true }], total: { code: 'Total', open: open, move: bankMove, close: close } }, c);
    var checks = [
      { name: 'Closing balance = opening balance + net cash movement (bank accounts on two Balance Sheets vs the P&L and every other account\'s movement)', pass: MK.near(close, r2(open + net)), detail: money(open) + ' + ' + money(net) + ' = ' + money(r2(open + net)) + ' vs ' + money(close) + (MK.near(close, r2(open + net)) ? '' : ' — difference ' + money(r2(close - open - net))) },
      { name: 'Net cash movement = net profit + the change in every non-bank account (as laid out)', pass: MK.near(net, r2(np + A.total + L.total + E.total)), detail: money(np) + ' + ' + money(r2(A.total + L.total + E.total)) },
      { name: 'Every account is classified, and there is at least one bank account', pass: bs.unclassified.length === 0 && bank.length > 0, detail: bank.length + ' bank account(s)' + (bs.unclassified.length ? '; ' + bs.unclassified.length + ' unclassified' : '') },
      fyCross ? { name: 'The year-end close moved this year\'s profit into Retained Earnings without cash (information)', pass: null, info: true, detail: 'Retained Earnings and Current Year Earnings are left out of the movement; ' + (Math.abs(rollAdj) < 0.01 ? 'they net to the profit' : 'check ' + money(rollAdj)) } : null
    ].filter(Boolean);
    this._x = { np: np, A: A, L: L, E: E, net: net, open: open, close: close, pl: pl };
    return { checks: checks, notes: ['Bank accounts are the accounts of type Bank in the chart of accounts. Each other balance-sheet account\'s change between the day before the period and its end is shown as its effect on cash.'], na: ['Comparison with last year', 'Breakdown by month'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return { v: v, s: 'money' }; }, rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash movement', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    x.pl.lines.filter(function (l) { return l.kind !== 'header'; }).forEach(function (l) { rows.push([l.kind === 'total' ? { v: l.label, s: 'bold' } : (l.code ? l.code + ' ' : '') + l.label, mv(l.values[0])]); });
    [x.A, x.L, x.E].forEach(function (s) { rows.push([{ v: s.label, s: 'bold' }]); s.rows.forEach(function (r) { rows.push([r.label, mv(r.value)]); }); rows.push([{ v: 'Total', s: 'bold' }, { v: s.total, s: 'moneyBold' }]); });
    rows.push([{ v: 'Net Cash Movement in (Out)', s: 'bold' }, { v: x.net, s: 'moneyBold' }], ['Opening Balance', mv(x.open)], [{ v: 'Closing Balance', s: 'bold' }, { v: x.close, s: 'moneyBold' }]);
    return [{ name: 'Cash movement', rows: rows, widths: [44, 18] }];
  }
});
```

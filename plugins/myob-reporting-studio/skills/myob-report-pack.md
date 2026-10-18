---
name: MYOB Report Pack
description: MYOB Report Pack (M60) as a live, validated report in MYOB styling. Use when the user asks for a report pack, a management report, a monthly board or owner pack, or the balance sheet, profit and loss and cash movement together in one document.
---
# Report Pack (M60)

Use when the user asks for a report pack, a management report, a monthly board or owner pack, or the balance sheet, profit and loss and cash movement together in one document. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Report Pack**. Template: `myob-reporting-studio` / `myob-report-pack` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_profit_and_loss_3m`, `get_balance_sheet`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Report packs → Management Report. Library: MYOB Reports Prompt Library v1.2 → Prompts → M60. Delivery: Wave 1 (P1, delivery order 15).

## Discovery call

Call `get_profit_and_loss_3m` once for the period (`reporting_basis` = `Accrual`), `get_balance_sheet` once at the period end, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the period (default: last month — a monthly pack; display preset `p` = `last_month`, `this_month`, `last_quarter`, `this_fy_td`, `last_fy` or `custom`). `prev_day` is derived by the kit — leave it. Pages are display `x`: one letter per page in order — `C` cover, `T` contents, `S` executive summary, `B` balance sheet, `P` profit & loss, `M` cash movement, `D` disclaimer (default `CTSBPM`; add `D` for a disclaimer page).

## Members

| Member / view | How |
|---|---|
| Management Report | Cover page → Table of contents → Executive summary (income, expenses, net profit, cash and a chart) → Balance sheet → Profit & loss → Cash movement, one set of preferences for every page; each page prints on its own sheet |
| Pages | Include, exclude and reorder pages in the report (Pages); a full-page disclaimer is optional |
| PDF style templates, saving a pack template | N/A — MYOB actions, not reproduced (Branding and Customise cover the styling) |

## Validation checks (shown in the banner)

- Balance sheet: Total Assets = Total Liabilities + Total Equity
- **Independent tie:** net profit (P&L) = the Current Year Earnings movement on the Balance Sheet (two Balance Sheets) = the P&L line of Cash movement
- **Independent tie:** Cash movement — closing bank = opening bank + net cash movement
- P&L section totals = Σ their accounts, and every account is classified

## Save as

`fileName`: `myob-report-pack.html` · `tags`: ["myob","report-pack","M60","management-report"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Template "Management Report" by MYOB: pages Cover · Contents · Balance sheet · Profit & loss · Cash movement; mySMB.com figures as in MYOB Balance Sheet, Profit and Loss and Cash Movement for the same period.
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
      "default": "2026-08-01"
    },
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "2026-08-31"
    },
    {
      "name": "prev_day",
      "label": "Day before the period",
      "type": "date",
      "default": "2026-07-31"
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
      "default": "Executive"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"last_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"CTSBPM\"}"
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
  title: 'Report Pack', primary: 'pnl', files: 'company_files', noHead: true,
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-08-01', to_date: '2026-08-31', prev_day: '2026-07-31', company_file: '', persona: 'Executive',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"last_month","a":"custom","c":"none","v":"","x":"CTSBPM"}' },
  uses: { pnl: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss_3m (the period)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (classifications and bank accounts)', company_files: 'list_company_files' },
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    if (!document.getElementById('rp-css')) { var st = document.createElement('style'); st.id = 'rp-css'; st.textContent = '.rp-page{margin-top:28px}.rp-page h2{font-size:18px;margin:0 0 4px}.rp-cover{text-align:center;padding:56px 0 40px}.rp-co{font-size:28px;font-weight:700}.rp-ti{font-size:20px;margin:8px 0;color:var(--accent)}.rp-toc li{padding:4px 0}.rp-edit summary{cursor:pointer;font-weight:600}.rp-edit button{font:inherit;border:1px solid var(--line);background:var(--card);border-radius:4px;cursor:pointer}.rp-mini{margin:0 0 8px}@media print{.rp-page:not(.first){break-before:page}}'; document.head.appendChild(st); } // the pack's own page styles
    var body = c.body, d = c.display, h = MK.h, money = function (v) { return MK.money(v, c.currency, d); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['pnl', 'bs_open', 'bs_close'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Profit and Loss and both Balance Sheets loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.pnl || !c.data.bs_open || !c.data.bs_close) return {};
    var idx = MK.accounts(c.data.accounts), pl = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT), bs = MK.breakdown([c.data.bs_close], idx, MK.BS_LAYOUT), bs2 = MK.breakdown([c.data.bs_open, c.data.bs_close], idx, MK.BS_LAYOUT);
    var cf = MK.cashMoves(bs2, pl, from, to, c.fy && c.fy.month), per = MK.periodLine(from, to), asAt = MK.asOfLine(to).replace(/^As at /, '');
    var inc = r2(pl.totals.Income[0] + pl.totals.OtherIncome[0]), exp = r2(pl.totals.CostOfSales[0] + pl.totals.Expense[0] + pl.totals.OtherExpense[0]), np = pl.calc.NetProfit[0];
    var A = bs.totals.Asset[0], L = bs.totals.Liability[0], E = bs.totals.Equity[0], gap = r2(A - L - E);
    // the pages: MYOB's Management Report (cover, contents, balance sheet, profit & loss, cash movement), the proposed executive summary,
    // and an optional disclaimer page — included and ordered by display.x (one letter per page)
    var PG = { C: 'Cover page', T: 'Table of contents', S: 'Executive summary', B: 'Balance sheet', P: 'Profit & loss', M: 'Cash movement', D: 'Disclaimer' }, ALL = 'CTSBPMD';
    var order = String(d.x || 'CTSBPM').split('').filter(function (k, i, a) { return PG[k] && a.indexOf(k) === i; }), sec = order.filter(function (k) { return k !== 'C' && k !== 'T'; });
    var cmRows = function () { var g = function (cls) { return cf.moves.filter(function (r) { return r.cls === cls && (Math.abs(r.effect) >= 0.005 || d.zeros); }); }, t = function (l) { return MK.sum(l.map(function (r) { return r.effect; })); }, tr = function (lbl, v, k) { return '<tr class="k-' + (k || 'row') + '"><td' + (k ? '' : ' style="padding-left:26px"') + '>' + h(lbl) + '</td><td class="num">' + money(v) + '</td></tr>'; };
      return '<table class="mk-stmt"><thead><tr><th scope="col"></th><th scope="col" class="num">' + h(per) + '</th></tr></thead><tbody>' + tr('Net Profit', np, 'total') + [['Asset', 'Assets (increase uses cash)'], ['Liability', 'Liabilities (increase provides cash)'], ['Equity', 'Equity (excluding this year\'s profit)']].map(function (s) { var l = g(s[0]); return '<tr class="k-header"><td>' + h(s[1]) + '</td><td></td></tr>' + l.map(function (r) { return tr((r.code ? r.code + ' ' : '') + r.name, r.effect); }).join('') + tr('Total', t(l), 'total'); }).join('') +
        tr('Net Cash Movement in (Out)', cf.net, 'total') + tr('Opening Balance (bank accounts)', cf.open, 'total') + tr('Closing Balance (bank accounts)', cf.close, 'total') + '</tbody></table>'; };
    var page = function (k) {
      if (k === 'C') return '<div class="rp-cover"><div class="rp-co">' + h(c.company || 'N/A — not in source') + '</div><div class="rp-ti">Management Report</div><div>' + h(per) + '</div><div class="muted">Generated ' + h(MK.asOfLine(c.today).replace(/^As at /, '')) + ' · ' + (d.style === 'mysmb' ? 'mySMB Reporting · data from MYOB Business' : 'Prepared from MYOB Business') + '</div></div>';
      if (k === 'T') return '<h2>Contents</h2><ol class="rp-toc">' + sec.map(function (s) { return '<li><a href="#rp-' + s + '">' + h(PG[s]) + '</a></li>'; }).join('') + '</ol>';
      if (k === 'S') return '<h2>Executive summary</h2>' + MK.kpis([{ label: 'Income (with other income)', value: inc, sub: per }, { label: 'Expenses (with cost of sales)', value: exp, sub: per }, { label: 'Net profit', value: np, sub: per }, { label: 'Cash (bank accounts)', value: cf.close, sub: 'At ' + asAt }], c) + '<div id="rp-chart"></div>';
      if (k === 'B') return '<h2>Balance sheet</h2><p class="muted">As at ' + h(asAt) + '</p><div class="mk-scroll">' + MK.statement(bs.lines, ['', asAt], c) + '</div>';
      if (k === 'P') return '<h2>Profit &amp; loss</h2><p class="muted">' + h(per) + '</p><div class="mk-scroll">' + MK.statement(pl.lines, ['', per], c) + '</div>';
      if (k === 'M') return '<h2>Cash movement</h2><p class="muted">' + h(per) + '</p><div class="mk-scroll">' + cmRows() + '</div>';
      return '<h2>Disclaimer</h2><p>This report has been prepared from ' + h(c.company || 'the business') + '\'s MYOB records for management purposes only. It has not been audited or reviewed, and it is not tax, legal or financial advice. Figures are as recorded in MYOB when the report was generated.</p>';
    };
    var editor = '<details class="mk-card noprint rp-edit"><summary>Pages (' + order.length + ' of 7)</summary><ul class="mk-bul">' + order.concat(ALL.split('').filter(function (k) { return order.indexOf(k) < 0; })).map(function (k) { var on = order.indexOf(k) >= 0, i = order.indexOf(k);
      return '<li><label><input type="checkbox" data-pg="' + k + '"' + (on ? ' checked' : '') + '> ' + h(PG[k]) + '</label>' + (on && i > 0 ? '<button type="button" data-up="' + k + '" title="Move up">↑</button>' : '') + '</li>'; }).join('') + '</ul></details>';
    body.innerHTML = editor + (order.indexOf('C') < 0 ? '<p class="rp-mini"><strong>' + h(c.company || 'N/A — not in source') + '</strong> · Management Report · ' + h(per) + '</p>' : '') +
      order.map(function (k, i) { return '<section class="rp-page' + (i ? '' : ' first') + (k === 'S' || k === 'C' || k === 'T' ? '' : ' keep-detail') + '" id="rp-' + k + '">' + page(k) + '</section>'; }).join('');
    var ch = document.getElementById('rp-chart'); if (ch) MK.bars(ch, { title: 'Income, expenses and net profit', labels: ['Income', 'Expenses', 'Net profit'], series: [{ name: per, values: [inc, exp, np] }] }, c);
    var setPages = function (o) { c.change({}, { x: o.join('') }); };
    body.querySelectorAll('input[data-pg]').forEach(function (el) { el.addEventListener('change', function () { var k = el.getAttribute('data-pg'); setPages(el.checked ? order.concat([k]) : order.filter(function (x) { return x !== k; })); }); });
    body.querySelectorAll('button[data-up]').forEach(function (el) { el.addEventListener('click', function () { var k = el.getAttribute('data-up'), i = order.indexOf(k), o = order.slice(); o[i] = o[i - 1]; o[i - 1] = k; setPages(o); }); });
    // pack-level cross-check: net profit (P&L) = the Current Year Earnings movement (two Balance Sheets) = the P&L line of Cash movement
    var cye2 = bs2.rows.filter(function (r) { return MK.CYE_RE.test(r.name); })[0];
    var fyStart = MK.fyStartOf(to, (c.fy && c.fy.month) || 7), cyeMove = !cye2 ? null : !cf.fyCross ? r2(cye2.values[1] - cye2.values[0]) : fyStart === from ? cye2.values[1] : null;
    var ties = MK.linesTies(pl.lines), tieCm = r2(cf.open + cf.net);
    var checks = [
      { name: 'Balance sheet: Total Assets = Total Liabilities + Total Equity', pass: MK.near(A, r2(L + E)), detail: money(A) + ' vs ' + money(r2(L + E)) + (MK.near(gap, 0) ? '' : ' — difference ' + money(gap) + ' (if it is last financial year\'s profit, roll over the year in MYOB; see MYOB Balance Sheet)') },
      cyeMove == null ? { name: 'Net profit = the Current Year Earnings movement on the Balance Sheet', pass: null, detail: !cye2 ? 'N/A — no Current Year Earnings account' : 'N/A — the period starts before and ends after a financial-year start' }
        : { name: 'Net profit (P&L) = the Current Year Earnings movement on the Balance Sheet (two Balance Sheets) = the P&L line of Cash movement', pass: MK.near(np, cyeMove) && MK.near(np, cf.np), detail: money(np) + ' vs ' + money(cyeMove) + ' vs ' + money(cf.np) },
      { name: 'Cash movement: closing bank = opening bank + net cash movement', pass: MK.near(cf.close, tieCm), detail: money(cf.open) + ' + ' + money(cf.net) + ' vs ' + money(cf.close) },
      { name: 'Profit & loss section totals = Σ their accounts, and every account is classified', pass: ties.failed.length === 0 && pl.unclassified.length === 0 && bs.unclassified.length === 0, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : (pl.unclassified.length + bs.unclassified.length) + ' unclassified' }
    ];
    this._x = { pl: pl, bs: bs, cf: cf, per: per, asAt: asAt, order: order };
    return { checks: checks, period: per, notes: ['One pack, one set of preferences (Customise applies to every page). Pages: ' + order.map(function (k) { return PG[k]; }).join(' → ') + '. Download PDF prints each page on its own sheet.'], na: ['PDF style templates and saving a pack template (MYOB actions, not reproduced)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var cm = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash movement', s: 'bold' }], [x.per], [], [{ v: 'Net Profit', s: 'bold' }, { v: x.cf.np, s: 'moneyBold' }]].concat(x.cf.moves.map(function (r) { return [(r.code ? r.code + ' ' : '') + r.name, { v: r.effect, s: 'money' }]; }))
      .concat([[{ v: 'Net Cash Movement in (Out)', s: 'bold' }, { v: x.cf.net, s: 'moneyBold' }], ['Opening Balance', { v: x.cf.open, s: 'money' }], [{ v: 'Closing Balance', s: 'bold' }, { v: x.cf.close, s: 'moneyBold' }]]);
    return [MK.sheetFromLines('Balance sheet', c.company, 'As at ' + x.asAt, ['', x.asAt], x.bs.lines), MK.sheetFromLines('Profit & loss', c.company, x.per, ['', x.per], x.pl.lines), { name: 'Cash movement', rows: cm, widths: [44, 18] }];
  }
});
```

---
name: MYOB Payroll Register
description: MYOB Payroll Register (M21) as a live, validated report in MYOB styling. Use when the user asks for a payroll register, per-employee payroll, each employee's pays for a period, or gross, tax, net and super by employee.
---
# Payroll Register (M21)

Use when the user asks for a payroll register, per-employee payroll, each employee's pays for a period, or gross, tax, net and super by employee. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Payroll Register**. Template: `myob-reporting-studio` / `payroll-register` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_payroll_advices`, `get_payroll_category_summary`, `list_journal_transactions`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Payroll → Payroll register. Library: MYOB Reports Prompt Library v1.2 → Prompts → M21. Delivery: Wave 3 (P3).

## Discovery call

As for MYOB Pay Run History: `list_payroll_advices` once, `get_payroll_category_summary` once, `list_company_files` once..

## Date defaults

`from_date` / `to_date` = the period by payment date (default: this financial year to date). The view is display `v` (`register` by default).

## Members

| Member / view | How |
|---|---|
| Payroll register | Every paycheque: employee, payment date, period end, gross, PAYG, deductions, net, super, hours |

## Validation checks (shown in the banner)

- **Independent tie:** wages and PAYG = MYOB's payroll category summary
- Pay runs add up to the paycheques

## Save as

`fileName`: `myob-payroll-register.html` · `tags`: ["myob","payroll","register","M21"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: MYOB Payroll register for the same period.
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
      "name": "adv_from",
      "label": "Pay advices from (derived)",
      "type": "date",
      "default": "2026-05-17"
    },
    {
      "name": "adv_to",
      "label": "Pay advices to (derived)",
      "type": "date",
      "default": "2026-11-12"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"register\"}"
    }
  ],
  "bindings": [
    {
      "id": "adv",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_payroll_advices"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "adv_from"
        },
        "to_date": {
          "kind": "input",
          "input": "adv_to"
        },
        "include_advices": {
          "kind": "static",
          "value": true
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "cats",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_payroll_category_summary"
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
// Payroll — Pay Run History (M23), Payroll Register (M21, variant), Payroll Summary (M20, variant), Accrual by Fund (M25/M26, variant)
// and Superannuation Payments (M27, variant), from MYOB's pay advices (list_payroll_advices). MYOB's API has no pay-run list, so a pay
// run is the paycheques sharing a payment date and pay period. Tie: wages and tax on the paycheques = MYOB's payroll category summary.
MK.app({
  title: 'Payroll Register', primary: 'adv', files: 'company_files', optional: ['cats', 'journals', 'accounts'],
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', adv_from: '2026-05-17', adv_to: '2026-11-12', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"register"}' },
  uses: { adv: ['adv_from', 'adv_to', 'company_file'], cats: ['from_date', 'to_date', 'company_file'], journals: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { adv: 'list_payroll_advices (every paycheque in the period)', cats: 'get_payroll_category_summary (the tie)', journals: 'list_journal_transactions (super payments from the super payable account)', accounts: 'list_accounts (the super payable account)', company_files: 'list_company_files' },
  // pay runs go by payment date (as MYOB's payroll reports and BAS W1 / W2 do); the advices tool filters by pay period, so it is asked for
  // a window 45 days wider each side and the paycheques are kept by payment date
  derive: function (inp) { var d = function (s, n) { return MK.iso(MK.addDays(MK.parse(s), n)); }; return { adv_from: d(inp.from_date, -45), adv_to: d(inp.to_date, 45) }; },
  views: [['runs', 'Pay run history'], ['register', 'Payroll register'], ['summary', 'Payroll summary'], ['items', 'Pay item transactions'], ['fund', 'Accrual by fund'], ['super', 'Superannuation payments']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.adv) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('adv')) + '</p>'; return { checks: [{ name: 'Pay advices loaded', pass: false, detail: c.err('adv') }] }; }
    if (!c.data.adv) return {};
    var typ = function (a, t) { return MK.sum((a.Lines || []).filter(function (l) { return (l.PayrollCategory || {}).Type === t; }).map(function (l) { return MK.num(l.Amount) || 0; })); };
    var pays = MK.items(c.data.adv).filter(Boolean).map(function (a) { var e = a.Employee || {}, f = a.SuperannuationFund || {};
      return { emp: e.Name || '(no name)', eid: e.UID || e.Name, paid: MK.isoDate(a.PaymentDate), ps: MK.isoDate(a.PayPeriodStartDate), pe: MK.isoDate(a.PayPeriodEndDate), gross: MK.num(a.GrossPay) || 0, net: MK.num(a.NetPay) || 0, wage: typ(a, 'Wage'), tax: typ(a, 'Tax'), ded: typ(a, 'Deduction'), sup: typ(a, 'Superannuation'),
        hours: MK.sum((a.Lines || []).filter(function (l) { return (l.PayrollCategory || {}).Type === 'Wage'; }).map(function (l) { return MK.num(l.Hours) || 0; })), fund: f.Name || '(no fund)', lines: a.Lines || [] }; }).filter(function (p) { return p.paid >= from && p.paid <= to; }).sort(function (x, y) { return x.paid.localeCompare(y.paid) || x.emp.localeCompare(y.emp); });
    var runsBy = {}; pays.forEach(function (p) { var k = p.paid + '|' + p.ps + '|' + p.pe, r = runsBy[k] || (runsBy[k] = { paid: p.paid, period: MK.periodLine(p.ps, p.pe), n: 0, gross: 0, tax: 0, ded: 0, net: 0, sup: 0, hours: 0 }); r.n++; ['gross', 'tax', 'ded', 'net', 'sup', 'hours'].forEach(function (f) { r[f] = r2(r[f] + p[f]); }); });
    var runs = Object.keys(runsBy).sort().map(function (k) { return runsBy[k]; }), T = {}; ['gross', 'tax', 'ded', 'net', 'sup', 'hours', 'wage'].forEach(function (f) { T[f] = MK.sum(pays.map(function (p) { return p[f]; })); });
    var cats = {}; pays.forEach(function (p) { p.lines.forEach(function (l) { var pc = l.PayrollCategory || {}, k = (pc.Type || '?') + '|' + (pc.Name || '?'), y = cats[k] || (cats[k] = { type: pc.Type || '', name: pc.Name || '', amount: 0, hours: 0, emps: {} }); y.amount = r2(y.amount + (MK.num(l.Amount) || 0)); y.hours = r2(y.hours + (MK.num(l.Hours) || 0)); y.emps[p.eid] = 1; }); });
    var catRows = Object.keys(cats).map(function (k) { var y = cats[k]; return { type: y.type, name: y.name, amount: y.amount, hours: y.hours || null, n: Object.keys(y.emps).length }; }).sort(function (a, b) { return a.type.localeCompare(b.type) || b.amount - a.amount; });
    var funds = {}; pays.forEach(function (p) { if (!p.sup) return; var k = p.fund + '|' + p.eid, y = funds[k] || (funds[k] = { fund: p.fund, emp: p.emp, sup: 0, n: 0 }); y.sup = r2(y.sup + p.sup); y.n++; });
    var fundRows = Object.keys(funds).map(function (k) { return funds[k]; }).sort(function (a, b) { return a.fund.localeCompare(b.fund) || a.emp.localeCompare(b.emp); });
    // super paid: debits to the super payable account(s) in cash payment journals (MYOB's API has no super payment list)
    var idx = MK.accounts(c.data.accounts), isSup = function (a) { var x = (a.UID && idx.byUid[a.UID]) || (a.DisplayID && idx.byCode[a.DisplayID]) || a; return /super/i.test(x.Name || '') && (x.Classification ? x.Classification === 'Liability' : /^2-/.test(a.DisplayID || '')); };
    var supPaid = [], J = MK.items(c.data.journals); J.forEach(function (j) { if (!/^Cash/i.test(j.JournalType || '')) return; var d = MK.isoDate(j.DateOccurred); if (d < from || d > to) return; (j.Lines || []).forEach(function (l) { if (l.Account && !l.IsCredit && isSup(l.Account)) supPaid.push({ date: d, desc: j.Description || '', account: (l.Account.DisplayID ? l.Account.DisplayID + ' ' : '') + (l.Account.Name || ''), amount: MK.num(l.Amount) || 0 }); }); });
    var paidT = MK.sum(supPaid.map(function (x) { return x.amount; })), view = c.view || 'runs', g = function (id) { return document.getElementById(id); };
    var head = { runs: 'Pay run history', register: 'Payroll register', summary: 'Payroll summary', items: 'Pay item transactions', fund: 'Accrual by fund', super: 'Superannuation payments' }[view];
    // Pay item transactions (M30): every paycheque line grouped by pay item, employees within it
    var items = {}; pays.forEach(function (p) { p.lines.forEach(function (l) { var pc = l.PayrollCategory || {}, k = (pc.Name || '?') + '|' + (pc.Type || ''); (items[k] = items[k] || { name: pc.Name || '?', type: pc.Type || '', rows: [] }).rows.push({ emp: p.emp, paid: p.paid, pe: p.pe, hours: MK.num(l.Hours) || null, amount: MK.num(l.Amount) || 0 }); }); });
    var itemKeys = Object.keys(items).sort(function (a, b) { return items[a].type.localeCompare(items[b].type) || items[a].name.localeCompare(items[b].name); }), allLines = MK.sum(pays.map(function (p) { return MK.sum(p.lines.map(function (l) { return MK.num(l.Amount) || 0; })); }));
    body.innerHTML = MK.kpis(view === 'super' ? [{ label: 'Super accrued', value: T.sup }, { label: 'Super paid', value: paidT }, { label: 'Accrued − paid', value: r2(T.sup - paidT) }, { label: 'Payments', value: supPaid.length, money: false }]
      : [{ label: 'Gross pay', value: T.gross }, { label: 'PAYG withheld', value: T.tax }, { label: 'Net pay', value: T.net }, { label: 'Superannuation', value: T.sup }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + head + ' — ' + MK.h(MK.periodLine(from, to)) + '</h3><div id="py-grid"></div>' + (view === 'fund' ? '<h3 style="margin-top:16px">By employee</h3><div id="py-grid2"></div>' : '') + '</div>';
    if (!pays.length) g('py-grid').innerHTML = '<p class="muted">No pay runs in MYOB for this period.</p>';
    else if (view === 'register') MK.grid(g('py-grid'), { rows: pays, filter: true, columns: [{ key: 'emp', title: 'Employee' }, { key: 'paid', title: 'Payment date' }, { key: 'pe', title: 'Period end' }, { key: 'gross', title: 'Gross pay', money: true }, { key: 'tax', title: 'PAYG withheld', money: true }, { key: 'ded', title: 'Deductions', money: true }, { key: 'net', title: 'Net pay', money: true }, { key: 'sup', title: 'Super', money: true }, { key: 'hours', title: 'Hours', num: true }],
      total: { emp: 'Total', gross: T.gross, tax: T.tax, ded: T.ded, net: T.net, sup: T.sup, hours: T.hours } }, c);
    else if (view === 'items') g('py-grid').innerHTML = '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Employee</th><th>Payment date</th><th>Period end</th><th class="num">Hours</th><th class="num">Amount</th></tr></thead><tbody>' + itemKeys.map(function (k) { var it = items[k];
      return '<tr class="k-header"><td colspan="5">' + MK.h(it.name) + (it.type ? ' <span class="muted">(' + MK.h(it.type) + ')</span>' : '') + '</td></tr>' + it.rows.map(function (r) { return '<tr class="k-row detail-block"><td style="padding-left:26px">' + MK.h(r.emp) + '</td><td>' + r.paid + '</td><td>' + r.pe + '</td><td class="num">' + (r.hours == null ? '' : r.hours) + '</td><td class="num">' + money(r.amount) + '</td></tr>'; }).join('') +
        '<tr class="k-total"><td colspan="3">Total for ' + MK.h(it.name) + '</td><td class="num">' + (MK.sum(it.rows.map(function (r) { return r.hours; })) || '') + '</td><td class="num">' + money(MK.sum(it.rows.map(function (r) { return r.amount; }))) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    else if (view === 'summary') MK.grid(g('py-grid'), { rows: catRows, columns: [{ key: 'type', title: 'Type' }, { key: 'name', title: 'Payroll category' }, { key: 'amount', title: 'Amount', money: true }, { key: 'hours', title: 'Hours', num: true }, { key: 'n', title: 'Employees', num: true }] }, c);
    else if (view === 'fund') { var byF = {}; fundRows.forEach(function (y) { byF[y.fund] = r2((byF[y.fund] || 0) + y.sup); });
      MK.grid(g('py-grid'), { rows: Object.keys(byF).map(function (k) { return { fund: k, sup: byF[k] }; }), columns: [{ key: 'fund', title: 'Super fund' }, { key: 'sup', title: 'Super accrued', money: true }], total: { fund: 'Total', sup: T.sup } }, c);
      MK.grid(g('py-grid2'), { rows: fundRows, columns: [{ key: 'fund', title: 'Super fund' }, { key: 'emp', title: 'Employee' }, { key: 'n', title: 'Pays', num: true }, { key: 'sup', title: 'Super accrued', money: true }] }, c); }
    else if (view === 'super') MK.grid(g('py-grid'), { rows: supPaid, empty: 'No payments from the super payable account in this period.', columns: [{ key: 'date', title: 'Date' }, { key: 'desc', title: 'Description' }, { key: 'account', title: 'Account' }, { key: 'amount', title: 'Paid', money: true }], total: { date: 'Total', amount: paidT } }, c);
    else MK.grid(g('py-grid'), { rows: runs, columns: [{ key: 'paid', title: 'Payment date' }, { key: 'period', title: 'Pay period' }, { key: 'n', title: 'Employees', num: true }, { key: 'gross', title: 'Gross pay', money: true }, { key: 'tax', title: 'PAYG withheld', money: true }, { key: 'ded', title: 'Deductions', money: true }, { key: 'net', title: 'Net pay', money: true }, { key: 'sup', title: 'Super', money: true }, { key: 'hours', title: 'Hours', num: true }],
      total: { paid: 'Total', n: pays.length, gross: T.gross, tax: T.tax, ded: T.ded, net: T.net, sup: T.sup, hours: T.hours } }, c);
    // checks
    var cs = c.data.cats, cb = cs && Array.isArray(cs.PayrollCategoryBreakdown) ? cs.PayrollCategoryBreakdown : null, csum = function (t) { return MK.sum((cb || []).filter(function (x) { return (x.PayrollCategory || {}).Type === t; }).map(function (x) { return MK.num(x.Amount) || 0; })); };
    var netBad = pays.filter(function (p) { return !MK.near(p.net, r2(p.gross - p.tax - p.ded)); });
    var checks = [
      !cb ? { name: 'Wages and tax on the paycheques = MYOB’s payroll category summary (information)', pass: null, info: true, detail: c.errors.cats ? 'Category summary unavailable (' + c.err('cats') + ')' : 'N/A' }
        : { name: 'Wages and PAYG on the paycheques = MYOB’s payroll category summary for the period (two MYOB reports)', pass: MK.near(T.wage, csum('Wage')) && MK.near(T.tax, csum('Tax')), detail: 'Wages ' + money(T.wage) + ' vs ' + money(csum('Wage')) + ' · PAYG ' + money(T.tax) + ' vs ' + money(csum('Tax')) },
      { name: 'Pay runs add up to the paycheques', pass: pays.length ? MK.near(MK.sum(runs.map(function (r) { return r.gross; })), T.gross) : null, detail: runs.length + ' pay run(s), ' + pays.length + ' paycheque(s)' },
      { name: 'Each paycheque: net pay = gross − PAYG − deductions (information)', pass: null, info: true, detail: !pays.length ? 'N/A — no pay runs' : netBad.length ? netBad.length + ' differ (e.g. ' + netBad[0].emp + ' ' + netBad[0].paid + ': ' + money(netBad[0].net) + ' vs ' + money(r2(netBad[0].gross - netBad[0].tax - netBad[0].ded)) + ') — salary sacrifice or other pay items' : 'all ' + pays.length }
    ];
    if (view === 'items') checks.push({ name: 'Pay item totals = every paycheque line', pass: pays.length ? MK.near(MK.sum(itemKeys.map(function (k) { return MK.sum(items[k].rows.map(function (r) { return r.amount; })); })), allLines) : null, detail: itemKeys.length + ' pay items' });
    if (view === 'super') checks.push({ name: 'Super accrued (paycheques) vs paid from the super payable account (information — MYOB’s API has no super payment list)', pass: null, info: true, detail: money(T.sup) + ' accrued vs ' + money(paidT) + ' paid — a payment usually clears the previous quarter’s accrual' + (J.length ? '' : '; journals unavailable') });
    this._x = { pays: pays, runs: runs, catRows: catRows, fundRows: fundRows, supPaid: supPaid, T: T, paidT: paidT };
    return { checks: checks, title: { runs: 'Pay Run History', register: 'Payroll Register', summary: 'Payroll Summary', items: 'Pay Item Transactions', fund: 'Accrual by Fund', super: 'Superannuation Payments' }[view],
      notes: ['From MYOB’s pay advices (one per paycheque). MYOB’s API has no pay-run list: a pay run is the paycheques sharing a payment date and pay period, listed by payment date. Dates of birth are not shown.', 'Superannuation payments are the cash payments from the super payable account (an approximation — MYOB’s API has no super payment list).'],
      na: ['Leave balances and entitlement accruals (see Leave balance)', 'Pay slips and STP lodgement (MYOB’s app only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; }, b = function (a) { return a.map(function (t) { return { v: t, s: 'bold' }; }); }, head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    return [{ name: 'Pay runs', rows: head('Pay run history').concat([b(['Payment date', 'Pay period', 'Employees', 'Gross pay', 'PAYG withheld', 'Deductions', 'Net pay', 'Super', 'Hours'])]).concat(x.runs.map(function (r) { return [r.paid, r.period, r.n, mv(r.gross), mv(r.tax), mv(r.ded), mv(r.net), mv(r.sup), r.hours]; })), widths: [14, 28, 10, 14, 14, 12, 14, 12, 8] },
      { name: 'Register', rows: head('Payroll register').concat([b(['Employee', 'Payment date', 'Period end', 'Gross pay', 'PAYG withheld', 'Deductions', 'Net pay', 'Super', 'Hours'])]).concat(x.pays.map(function (p) { return [p.emp, p.paid, p.pe, mv(p.gross), mv(p.tax), mv(p.ded), mv(p.net), mv(p.sup), p.hours]; })), widths: [24, 14, 14, 14, 14, 12, 14, 12, 8] },
      { name: 'Summary', rows: head('Payroll summary').concat([b(['Type', 'Payroll category', 'Amount', 'Hours', 'Employees'])]).concat(x.catRows.map(function (r) { return [r.type, r.name, mv(r.amount), r.hours || '', r.n]; })), widths: [16, 30, 14, 10, 10] },
      { name: 'By fund', rows: head('Accrual by fund').concat([b(['Super fund', 'Employee', 'Pays', 'Super accrued'])]).concat(x.fundRows.map(function (r) { return [r.fund, r.emp, r.n, mv(r.sup)]; })), widths: [28, 24, 8, 14] },
      { name: 'Super paid', rows: head('Superannuation payments').concat([b(['Date', 'Description', 'Account', 'Paid'])]).concat(x.supPaid.map(function (r) { return [r.date, r.desc, r.account, mv(r.amount)]; })), widths: [12, 40, 30, 14] }];
  }
});
```

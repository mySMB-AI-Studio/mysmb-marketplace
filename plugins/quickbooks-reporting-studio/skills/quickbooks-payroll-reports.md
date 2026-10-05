---
name: quickbooks-payroll-reports
description: QuickBooks Online Payroll reports family (Q32) as a live, validated report in QuickBooks styling. Use when the user asks for payroll reports, gross to net, pay run totals or a pay run audit, a payrun comparison, PAYG withholding or the BAS W1 / W2 figures, pay categories, payroll deductions, or super contributions by employee or by fund.
---

# Payroll reports family (Q32)

Use when the user asks for payroll reports, gross to net, pay run totals or a pay run audit, a payrun comparison, PAYG withholding or the BAS W1 / W2 figures, pay categories, payroll deductions, or super contributions by employee or by fund. Load `quickbooks-report-foundation` first and follow its *Build a report* steps. Report title: **QuickBooks Payroll Reports**. Template: `quickbooks-reporting-studio` / `quickbooks-payroll-reports` (for `artifact_from_template`); without that tool, use the blocks below. This skill needs the `employment-hero-payroll` connector (`list_businesses`, `list_pay_runs`, `get_report_gross_to_net`, `get_report_payg`, `get_report_pay_categories`, `get_report_super_contributions`).

QuickBooks location: Reports › Standard reports › Payroll Reports (Employment Hero). Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q32. Delivery: Wave 4 (Feature F6).

Pay figures are shown. The connector removes tax file numbers, bank details, dates of birth, addresses and personal contact details. Say in the completion note that a downloaded or shared copy carries pay figures.

## Discovery call

`list_businesses` on the **`employment-hero-payroll`** connector (not QuickBooks) — expect an array of payroll businesses `{id, name, abn, payCycleFrequency}`. If the call fails with a connection error, tell the user to install the **Employment Hero Payroll** extension and connect it under Settings → Connections with their payroll API key, and stop. Do not call `qbo_query`: the report's client is the payroll business. When the user names one of several businesses, set the `business_id` input to its `id`; otherwise leave it blank (the first business).

## Date defaults

Preset `last_month` (pay runs are reported by date paid). For a BAS quarter use `last_quarter` or the quarter's dates; for a year, `last_fy` (1 July – 30 June).

## Members

| Member / view | How |
|---|---|
| Gross to Net Report | Report = Gross to Net (hours, gross, pre-tax deductions, taxable, PAYG, HELP, SFSS, post-tax deductions, net, super, employer contributions) |
| Deductions | Report = Deductions (pre-tax and post-tax, by deduction and employee) |
| Pay Categories Report | Report = Pay Categories (units, rate, amount and super by category, pay run and employee) |
| PAYG Withholding | Report = PAYG Withholding (by month and location, BAS W1 and W2 — draft, check before lodging) |
| Pay Run Audit Report | Report = Pay Run Audit (each finalised pay run: period, date paid, employees, gross, super) |
| Payrun Comparison Report | Report = Payrun Comparison (latest pay run vs the one before, by employee, with flags) |
| Super Contributions | Report = Super Contributions (by employee and type) and Super Contributions by Fund (fund, USI) |
| Employee and payroll business filters | Use the employee picker above the report; Client lists the payroll businesses the API key can see |
| Costing, Detailed Activity, Ordinary Time Earnings, Timesheets | N/A — not in the Employment Hero Payroll connector yet |

## Validation checks (STEP 4 — shown in the banner)

- Net = gross − pre-tax deductions − PAYG − HELP − SFSS − post-tax deductions (every employee)
- Pay category breakdown = gross earnings (every employee)
- Σ employees = Employment Hero totals
- W2 = tax withheld on Gross to Net; W1 = gross earnings on Gross to Net
- Σ pay categories = gross earnings
- Σ pay runs = Σ pay categories
- Super guarantee = SGC on Gross to Net; Σ by fund = Σ by employee

## Save as

`fileName`: `quickbooks-payroll-reports.html` · `tags`: ["quickbooks","payroll","employment-hero","payg"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Not captured (external payroll app) — compare Gross to Net, PAYG Withholding and Super Contributions with the same reports in Employment Hero Payroll for the same dates.
3. Compare the layout with the Q32 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "business_id",
      "label": "Payroll business ID (blank = the first)",
      "type": "string",
      "maxLength": 12,
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"last_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"gross_to_net\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "businesses",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "list_businesses"
      },
      "params": {}
    },
    {
      "id": "pay_runs",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "list_pay_runs"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        },
        "finalised_only": {
          "kind": "static",
          "value": true
        }
      }
    },
    {
      "id": "gross_to_net",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_gross_to_net"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        }
      }
    },
    {
      "id": "payg",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_payg"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        }
      }
    },
    {
      "id": "pay_categories",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_pay_categories"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        }
      }
    },
    {
      "id": "super_employee",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_super_contributions"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        },
        "group_by": {
          "kind": "static",
          "value": "employee"
        }
      }
    },
    {
      "id": "super_fund",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_super_contributions"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "from_date": {
          "kind": "input",
          "input": "start_date"
        },
        "to_date": {
          "kind": "input",
          "input": "end_date"
        },
        "group_by": {
          "kind": "static",
          "value": "fund"
        }
      }
    }
  ]
}
```

## Report config ({{CFG}})

```js
QB.app({
  title: 'Payroll Reports', primary: 'gross_to_net', prepared: 'Prepared from Employment Hero Payroll', footer: 'Employment Hero Payroll · by date paid',
  mechanism: 'employment-hero-payroll connector — mySMB custom MCP on the Employment Hero Payroll (KeyPay) AU API. QuickBooks Online AU payroll runs in Employment Hero, outside the QuickBooks Accounting API',
  friendly: { needs_connection: 'Connect Employment Hero Payroll (Settings → Connections) to see this data.', connection_unavailable: 'Employment Hero Payroll is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This payroll report is not available on the connected Employment Hero Payroll connector.', tool_error: 'Employment Hero Payroll returned an error for this section.' },
  fy: { month: 7, source: 'Australian payroll year' }, country: 'AU',
  clients: function (d) { return (Array.isArray(d.businesses) ? d.businesses : []).map(function (b) { return [String(b.id), b.name || b.legalName || 'Business ' + b.id]; }); },
  clientTitle: 'The payroll businesses this Employment Hero Payroll API key can see', clientNote: '(one payroll business per report — choose it in Client)', noCompany: 'Business name (Employment Hero returned no business for this API key)',
  period: function (d) { var g = d.gross_to_net || d.pay_categories || d.payg; return g && g.from ? { start: g.from, end: g.to } : null; },
  inputs: { start: 'start_date', end: 'end_date', client: 'business_id', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', business_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"last_month","a":"custom","c":"none","v":"gross_to_net","x":""}' },
  uses: { businesses: [], pay_runs: ['start_date', 'end_date', 'business_id'], gross_to_net: ['start_date', 'end_date', 'business_id'], payg: ['start_date', 'end_date', 'business_id'], pay_categories: ['start_date', 'end_date', 'business_id'], super_employee: ['start_date', 'end_date', 'business_id'], super_fund: ['start_date', 'end_date', 'business_id'] },
  tools: { businesses: 'list_businesses (employment-hero-payroll)', pay_runs: 'list_pay_runs (finalised, by date paid)', gross_to_net: 'get_report_gross_to_net', payg: 'get_report_payg', pay_categories: 'get_report_pay_categories', super_employee: 'get_report_super_contributions (by employee)', super_fund: 'get_report_super_contributions (by fund)' },
  views: [['gross_to_net', 'Gross to Net Report'], ['deductions', 'Deductions'], ['pay_categories', 'Pay Categories Report'], ['payg', 'PAYG Withholding'], ['pay_runs', 'Pay Run Audit Report'], ['comparison', 'Payrun Comparison Report'], ['super', 'Super Contributions'], ['super_fund', 'Super Contributions by Fund']],
  render: function (c) {
    var body = c.body, h = QB.h, D = c.data, v = c.view || 'gross_to_net', money = function (x) { return QB.money(x, c.currency, c.display); }, near = function (a, b) { return Math.abs((a || 0) - (b || 0)) < 0.005; };
    var NAMES = { gross_to_net: 'Gross to net', deductions: 'Gross to net', payg: 'PAYG withholding', pay_categories: 'Pay categories', pay_runs: 'Pay runs', comparison: 'Pay categories', super: 'Super contributions', super_fund: 'Super contributions by fund' };
    var need = { gross_to_net: 'gross_to_net', deductions: 'gross_to_net', payg: 'payg', pay_categories: 'pay_categories', pay_runs: 'pay_runs', comparison: 'pay_categories', super: 'super_employee', super_fund: 'super_fund' }[v];
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + h(NAMES[v]) + ' is unavailable — not zero: ' + h(c.err(need)) + '</p>'; return { checks: [{ name: NAMES[v] + ' loaded', pass: false, detail: c.err(need) }] }; }
    if (!D[need]) return {};
    var rowsOf = function (id) { return (D[id] && Array.isArray(D[id].rows) ? D[id].rows : []); };
    var nm = function (r) { return ((r.firstName || '') + ' ' + (r.surname || '')).trim() || 'Employee ' + r.employeeId; };
    var T = function (r, total, flat) { return typeof r[total] === 'number' ? r[total] : typeof r[flat] === 'number' ? r[flat] : 0; };
    var sumK = function (a, f) { return QB.sum(a.map(f)); }, dt = function (s) { return s ? String(s).slice(0, 10) : ''; };
    var g2n = rowsOf('gross_to_net'), cats = rowsOf('pay_categories'), summary = c.persona === 'Client' || c.persona === 'Executive';
    // Employee filter (display x): '' = everyone. PAYG and pay runs have no employee, so the picker hides there.
    var people = {}; [g2n, cats, rowsOf('super_employee'), rowsOf('super_fund')].forEach(function (a) { a.forEach(function (r) { if (r.employeeId != null && !people[r.employeeId]) people[r.employeeId] = nm(r); }); });
    if (c.display.x && !people[c.display.x]) people[c.display.x] = 'Employee ' + c.display.x + ' (no pay in this period)'; // the filter survives a period change
    var sel = c.display.x ? String(c.display.x) : '', mine = function (a) { return sel ? a.filter(function (r) { return String(r.employeeId) === sel; }) : a; };
    var keys = Object.keys(people).sort(function (a, b) { return people[a].localeCompare(people[b]); });
    var html = v === 'payg' || v === 'pay_runs' ? '' : '<label class="ctl" style="display:inline-flex;margin-bottom:12px">Employee<select id="w-emp"><option value="">All employees</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(people[k]) + '</option>'; }).join('') + '</select></label>';
    var checks = [], x = { view: v, title: (this.views.filter(function (w) { return w[0] === v; })[0] || ['', ''])[1] }, chart = null;
    var G = function (r) { return { name: nm(r), id: r.employeeId, hours: r.totalHours, gross: T(r, 'totalGrossEarnings', 'grossEarnings'), pre: T(r, 'totalPreTaxDeductions', 'preTaxDeductions'), taxable: r.taxableEarnings, payg: r.payg || 0, help: r.help || 0, sfss: r.sfss || 0, post: T(r, 'totalPostTaxDeductions', 'postTaxDeductions'), net: r.netEarnings, sgc: r.sgc, er: r.employerContribution, raw: r }; };
    var tot = function (rows, ks, label) { var t = {}; t[ks[0]] = label || 'TOTAL'; ks.slice(1).forEach(function (k) { t[k] = sumK(rows, function (r) { return typeof r[k] === 'number' ? r[k] : null; }); }); return t; };
    var col = function (k, t, m) { return { key: k, title: t, money: m !== false && m !== 'n', num: m === 'n' }; };
    if (v === 'gross_to_net') {
      var R = mine(g2n).map(G);
      var cols = summary ? [col('name', 'Employee', false), col('gross', 'Gross earnings'), col('wh', 'Tax withheld'), col('net', 'Net earnings'), col('sgc', 'Super (SGC)')]
        : [col('name', 'Employee', false), col('hours', 'Hours', 'n'), col('gross', 'Gross earnings'), col('pre', 'Pre-tax deductions'), col('taxable', 'Taxable earnings'), col('payg', 'PAYG'), col('help', 'HELP'), col('sfss', 'SFSS'), col('post', 'Post-tax deductions'), col('net', 'Net earnings'), col('sgc', 'Super (SGC)'), col('er', 'Employer contributions')];
      R.forEach(function (r) { r.wh = QB.sum([r.payg, r.help, r.sfss]); });
      var tt = tot(R, ['name', 'hours', 'gross', 'pre', 'taxable', 'payg', 'help', 'sfss', 'post', 'net', 'sgc', 'er', 'wh']);
      html += QB.kpis([{ label: 'Gross earnings', value: tt.gross }, { label: 'Tax withheld (PAYG, HELP, SFSS)', value: tt.wh }, { label: 'Net pay', value: tt.net }, { label: 'Super (SGC)', value: tt.sgc }, { label: 'Employees paid', money: false, value: R.length }], c);
      chart = { title: 'Gross to net by employee', labels: R.map(function (r) { return r.name.slice(0, 16); }), series: [{ name: 'Net earnings', values: R.map(function (r) { return r.net; }) }, { name: 'Tax withheld', values: R.map(function (r) { return r.wh; }) }, { name: 'Deductions', values: R.map(function (r) { return QB.sum([r.pre, r.post]); }) }] };
      x.cols = cols; x.rows = R; x.total = tt; x.empty = 'No pay in this period.';
      var bad = R.filter(function (r) { return !near(r.net, r.gross - r.pre - r.payg - r.help - r.sfss - r.post); });
      checks.push({ name: 'Net = gross − pre-tax deductions − PAYG − HELP − SFSS − post-tax deductions (every employee)', pass: R.length ? !bad.length : null, detail: bad.length ? bad[0].name + ': net ' + money(bad[0].net) + ' vs ' + money(bad[0].gross - bad[0].pre - bad[0].payg - bad[0].help - bad[0].sfss - bad[0].post) : R.length + ' employees' });
      var withBd = R.filter(function (r) { return r.raw.grossEarnings && typeof r.raw.grossEarnings === 'object'; }), bd = withBd.filter(function (r) { var s = 0, k; for (k in r.raw.grossEarnings) if (typeof r.raw.grossEarnings[k] === 'number') s += r.raw.grossEarnings[k]; return !near(s, r.gross); });
      checks.push({ name: 'Pay category breakdown = gross earnings (every employee)', pass: withBd.length ? !bd.length : null, detail: bd.length ? bd[0].name + ' does not add up' : withBd.length ? withBd.length + ' employees' : 'No breakdown in the report' });
      var ct = D.gross_to_net.totals || {};
      checks.push({ name: 'Σ employees = Employment Hero totals (gross, net)', pass: sel || !g2n.length ? null : near(tt.gross, ct.grossEarnings) && near(tt.net, ct.netEarnings), detail: sel ? 'Employee filter on' : money(tt.gross) + ' gross · ' + money(tt.net) + ' net' + (near(tt.gross, ct.grossEarnings) ? '' : ' (connector total ' + money(ct.grossEarnings) + ')') });
    } else if (v === 'deductions') {
      var L = [];
      mine(g2n).forEach(function (r) { [['preTaxDeductions', 'Pre-tax'], ['postTaxDeductions', 'Post-tax']].forEach(function (p) { var o = r[p[0]]; if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { if (typeof o[k] === 'number' && o[k]) L.push({ ded: k, type: p[1], name: nm(r), amount: o[k] }); }); }); });
      L.sort(function (a, b) { return a.ded.localeCompare(b.ded) || a.name.localeCompare(b.name); });
      var pre = sumK(L.filter(function (l) { return l.type === 'Pre-tax'; }), function (l) { return l.amount; }), post = sumK(L.filter(function (l) { return l.type === 'Post-tax'; }), function (l) { return l.amount; });
      html += QB.kpis([{ label: 'Pre-tax deductions', value: pre }, { label: 'Post-tax deductions', value: post }, { label: 'Deduction lines', money: false, value: L.length }], c);
      x.cols = [col('ded', 'Deduction', false), col('type', 'Type', false), col('name', 'Employee', false), col('amount', 'Amount')]; x.rows = L; x.total = { ded: 'TOTAL', amount: QB.sum([pre, post]) }; x.empty = 'No deductions in this period.';
      var R2 = mine(g2n).map(G), want = sumK(R2, function (r) { return QB.sum([r.pre, r.post]); }), hasBd = mine(g2n).some(function (r) { return r.preTaxDeductions && typeof r.preTaxDeductions === 'object'; });
      checks.push({ name: 'Σ deduction lines = pre-tax + post-tax deductions on Gross to Net', pass: hasBd ? near(QB.sum([pre, post]), want) : (R2.length ? null : true), detail: hasBd ? money(QB.sum([pre, post])) : R2.length ? 'Employment Hero returned no deduction breakdown' : 'No pay in this period' });
    } else if (v === 'payg') {
      var P = rowsOf('payg'), W1 = sumK(P, function (r) { return r.grossEarnings; }), W2 = sumK(P, function (r) { return r.payg; });
      html += '<div class="qb-banner na" style="margin-bottom:12px"><strong>Draft — check before lodging.</strong> BAS W1 is gross earnings as Employment Hero reports them; salary sacrificed to super is under pre-tax deductions. Check W1 and W2 against Employment Hero\'s PAYG Withholding report.</div>';
      html += QB.kpis([{ label: 'W1 Total salary, wages and other payments', value: W1 }, { label: 'W2 Amounts withheld', value: W2 }, { label: 'Taxable earnings', value: sumK(P, function (r) { return r.taxableEarnings; }) }], c);
      x.cols = [col('month', 'Month', false), col('location', 'Location', false), col('grossEarnings', 'Gross earnings'), col('taxExemptEarnings', 'Tax-exempt earnings'), col('preTaxDeductions', 'Pre-tax deductions'), col('taxableEarnings', 'Taxable earnings'), col('payg', 'PAYG withheld')];
      x.rows = P; x.total = tot(P, ['month', 'grossEarnings', 'taxExemptEarnings', 'preTaxDeductions', 'taxableEarnings', 'payg']); x.empty = 'No PAYG withholding in this period.';
      chart = { title: 'W1 and W2 by month', labels: P.map(function (r) { return String(r.month || '').slice(0, 16); }), series: [{ name: 'W1 gross', values: P.map(function (r) { return r.grossEarnings; }) }, { name: 'W2 withheld', values: P.map(function (r) { return r.payg; }) }] };
      checks.push({ name: 'W1 and W2 = Σ months', pass: near(W1, D.payg.W1_grossWages) && near(W2, D.payg.W2_paygWithheld), detail: 'W1 ' + money(W1) + ' · W2 ' + money(W2) });
      if (c.errors.gross_to_net || !D.gross_to_net) checks.push({ name: 'W2 = tax withheld on Gross to Net', pass: null, detail: 'Gross to Net unavailable' });
      else { var gt = D.gross_to_net.totals || {}, all = QB.sum([gt.payg, gt.help, gt.sfss]);
        checks.push({ name: 'W2 = tax withheld on Gross to Net', pass: near(W2, all) || near(W2, gt.payg), detail: money(W2) + (near(W2, all) ? ' = PAYG ' + money(gt.payg) + ' + HELP ' + money(gt.help) + ' + SFSS ' + money(gt.sfss) : ' vs PAYG ' + money(gt.payg) + ' (with HELP and SFSS ' + money(all) + ')') });
        checks.push({ name: 'W1 = gross earnings on Gross to Net', pass: near(W1, gt.grossEarnings), detail: money(W1) + ' vs ' + money(gt.grossEarnings) }); }
    } else if (v === 'pay_categories') {
      var C = mine(cats), by = {}, order = [];
      C.forEach(function (r) { var k = r.payCategory || '(no category)'; if (!by[k]) { by[k] = { cat: k, units: 0, amount: 0, superAmount: 0, lines: [] }; order.push(k); } by[k].units += Number(r.units) || 0; by[k].amount += Number(r.amount) || 0; by[k].superAmount += Number(r.superAmount) || 0; by[k].lines.push(r); });
      order.sort();
      var tA = sumK(C, function (r) { return r.amount; }), tS = sumK(C, function (r) { return r.superAmount; });
      html += QB.kpis([{ label: 'Earnings', value: tA }, { label: 'Super on earnings', value: tS }, { label: 'Pay categories', money: false, value: order.length }], c);
      var t = '<div class="qb-scroll"><table class="qb-stmt"><thead><tr><th>Pay category</th><th>Pay run</th><th class="num">Units</th><th class="num">Rate</th><th class="num">Amount</th><th class="num">Super</th></tr></thead><tbody>';
      order.forEach(function (k) { var g = by[k];
        t += '<tr class="k-header"><td colspan="6">' + h(k) + '</td></tr>';
        g.lines.forEach(function (r) { t += '<tr class="k-row detail-block"><td style="padding-left:26px">' + h(nm(r)) + '</td><td>' + h(r.payRun || dt(r.datePaid)) + '</td><td class="num">' + h(r.units) + '</td><td class="num">' + money(r.rate) + '</td><td class="num">' + money(r.amount) + '</td><td class="num">' + money(r.superAmount) + '</td></tr>'; });
        t += '<tr class="k-total"><td colspan="2">Total for ' + h(k) + '</td><td class="num">' + h(QB.sum([g.units])) + '</td><td></td><td class="num">' + money(QB.sum([g.amount])) + '</td><td class="num">' + money(QB.sum([g.superAmount])) + '</td></tr>'; });
      t += (order.length ? '<tr class="k-total"><td colspan="4">TOTAL</td><td class="num">' + money(tA) + '</td><td class="num">' + money(tS) + '</td></tr>' : '<tr><td colspan="6" class="muted">No pay category amounts in this period.</td></tr>') + '</tbody></table></div>';
      x.html = t; x.cols = [col('cat', 'Pay category', false), col('units', 'Units', 'n'), col('amount', 'Amount'), col('superAmount', 'Super')]; x.rows = order.map(function (k) { return { cat: k, units: QB.sum([by[k].units]), amount: QB.sum([by[k].amount]), superAmount: QB.sum([by[k].superAmount]) }; }); x.total = { cat: 'TOTAL', amount: tA, superAmount: tS };
      chart = { title: 'Earnings by pay category', labels: order.map(function (k) { return k.slice(0, 16); }), series: [{ name: 'Amount', values: order.map(function (k) { return QB.sum([by[k].amount]); }) }] };
      if (c.errors.gross_to_net || !D.gross_to_net) checks.push({ name: 'Σ pay categories = gross earnings on Gross to Net', pass: null, detail: 'Gross to Net unavailable' });
      else { var gg = sumK(mine(g2n).map(G), function (r) { return r.gross; }); checks.push({ name: 'Σ pay categories = gross earnings on Gross to Net', pass: near(tA, gg), detail: money(tA) + ' vs ' + money(gg) }); }
    } else if (v === 'pay_runs') {
      var runs = ((D.pay_runs && D.pay_runs.payRuns) || []).slice().sort(function (a, b) { return dt(a.datePaid) < dt(b.datePaid) ? -1 : 1; }), byDate = {};
      cats.forEach(function (r) { var k = dt(r.datePaid); byDate[k] = byDate[k] || { gross: 0, sup: 0, emp: {} }; byDate[k].gross += Number(r.amount) || 0; byDate[k].sup += Number(r.superAmount) || 0; byDate[k].emp[r.employeeId] = 1; });
      var sameDay = {}; runs.forEach(function (r) { sameDay[dt(r.datePaid)] = (sameDay[dt(r.datePaid)] || 0) + 1; });
      var PR = runs.map(function (r) { var b = byDate[dt(r.datePaid)], one = sameDay[dt(r.datePaid)] === 1; return { id: r.id, period: dt(r.payPeriodStarting) + ' to ' + dt(r.payPeriodEnding), paid: dt(r.datePaid), fin: r.isFinalised ? 'Yes' : 'No', pub: r.paySlipsPublished ? 'Yes' : 'No', emps: b && one ? Object.keys(b.emp).length : null, gross: b && one ? QB.sum([b.gross]) : null, sup: b && one ? QB.sum([b.sup]) : null, note: r.notation || '' }; });
      html += QB.kpis([{ label: 'Pay runs', money: false, value: PR.length }, { label: 'Gross earnings', value: sumK(PR, function (r) { return r.gross; }) }, { label: 'Super on earnings', value: sumK(PR, function (r) { return r.sup; }) }], c);
      x.cols = [col('id', 'Pay run', false), col('period', 'Pay period', false), col('paid', 'Date paid', false), col('fin', 'Finalised', false), col('pub', 'Pay slips published', false), col('emps', 'Employees', 'n'), col('gross', 'Gross earnings'), col('sup', 'Super'), col('note', 'Notation', false)];
      x.rows = PR; x.total = { id: 'TOTAL', gross: sumK(PR, function (r) { return r.gross; }), sup: sumK(PR, function (r) { return r.sup; }) }; x.empty = 'No finalised pay runs were paid in this period.';
      chart = { title: 'Gross earnings by pay run', labels: PR.map(function (r) { return r.paid.slice(5); }), series: [{ name: 'Gross', values: PR.map(function (r) { return r.gross; }) }] };
      var empty = PR.filter(function (r) { return r.gross == null && sameDay[r.paid] === 1; });
      var catTot = c.errors.pay_categories || !D.pay_categories ? null : sumK(cats, function (r) { return r.amount; }), multi = PR.some(function (r) { return sameDay[r.paid] > 1; });
      checks.push({ name: 'Σ pay runs = Σ pay categories (gross)', pass: catTot == null || multi ? null : near(x.total.gross, catTot), detail: catTot == null ? 'Pay categories unavailable' : multi ? 'Two pay runs share a date paid, so their totals cannot be separated' : money(x.total.gross) + ' vs ' + money(catTot) });
      checks.push({ name: 'Pay runs with no earnings lines', pass: null, info: true, detail: empty.length ? empty.map(function (r) { return '#' + r.id + ' paid ' + r.paid; }).join(', ') : 'None' });
    } else if (v === 'comparison') {
      var dates = Object.keys(cats.reduce(function (o, r) { o[dt(r.datePaid)] = 1; return o; }, {})).sort(), a = dates[dates.length - 2], b = dates[dates.length - 1];
      if (dates.length < 2) { html += '<div class="qb-banner na">This period has ' + (dates.length ? 'one pay run' : 'no pay runs') + '. Choose a period with at least two pay runs to compare the latest with the one before.</div>'; x.rows = []; x.cols = [col('name', 'Employee', false)]; checks.push({ name: 'Two pay runs to compare', pass: null, detail: dates.length + ' pay run(s) in the period' }); }
      else {
        var per = {}; mine(cats).forEach(function (r) { var k = r.employeeId; per[k] = per[k] || { name: nm(r), prev: 0, last: 0, ps: 0, ls: 0, inP: false, inL: false }; if (dt(r.datePaid) === a) { per[k].prev += Number(r.amount) || 0; per[k].ps += Number(r.superAmount) || 0; per[k].inP = true; } if (dt(r.datePaid) === b) { per[k].last += Number(r.amount) || 0; per[k].ls += Number(r.superAmount) || 0; per[k].inL = true; } });
        var CR = Object.keys(per).map(function (k) { var p = per[k], ch = QB.sum([p.last, -p.prev]); return { name: p.name, prev: QB.sum([p.prev]), last: QB.sum([p.last]), ch: ch, pc: p.prev ? ch / p.prev : null, sup: QB.sum([p.ls, -p.ps]), flag: !p.inL ? 'Not in the latest pay run' : !p.inP ? 'New in the latest pay run' : p.prev && Math.abs(ch / p.prev) >= 0.2 ? 'Change of 20% or more' : '' }; }).filter(function (r) { return r.prev || r.last; });
        CR.sort(function (p, q) { return p.name.localeCompare(q.name); });
        var tp = sumK(CR, function (r) { return r.prev; }), tl = sumK(CR, function (r) { return r.last; });
        html += QB.kpis([{ label: 'Previous pay run (' + a + ')', value: tp }, { label: 'Latest pay run (' + b + ')', value: tl, delta: tp ? (tl - tp) / tp : null }, { label: 'Change', value: QB.sum([tl, -tp]) }], c);
        x.cols = [col('name', 'Employee', false), col('prev', 'Gross ' + a), col('last', 'Gross ' + b), col('ch', 'Change'), { key: 'pc', title: 'Change %', num: true, fmt: function (q) { return q == null ? '' : QB.pct(q); } }, col('sup', 'Super change'), col('flag', 'Flag', false)];
        x.rows = CR; x.total = { name: 'TOTAL', prev: tp, last: tl, ch: QB.sum([tl, -tp]), sup: sumK(CR, function (r) { return r.sup; }) }; x.empty = 'No employees in these pay runs.';
        chart = { title: 'Gross by employee: previous vs latest pay run', labels: CR.map(function (r) { return r.name.slice(0, 16); }), series: [{ name: a, values: CR.map(function (r) { return r.prev; }) }, { name: b, values: CR.map(function (r) { return r.last; }) }] };
        var flagged = CR.filter(function (r) { return r.flag; });
        checks.push({ name: 'Σ employees = pay category totals for both pay runs', pass: sel ? null : near(tp, sumK(cats.filter(function (r) { return dt(r.datePaid) === a; }), function (r) { return r.amount; })) && near(tl, sumK(cats.filter(function (r) { return dt(r.datePaid) === b; }), function (r) { return r.amount; })), detail: sel ? 'Employee filter on' : money(tp) + ' → ' + money(tl) });
        checks.push({ name: 'Employees to review', pass: null, info: true, detail: flagged.length ? flagged.map(function (r) { return r.name + ' (' + r.flag.toLowerCase() + ')'; }).join('; ') : 'None' });
      }
    } else {
      var fund = v === 'super_fund', S2 = mine(rowsOf(fund ? 'super_fund' : 'super_employee'));
      var lab = function (s) { return String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2'); };
      var amt = function (r) { return Number(fund ? r.amount : r.accrualAmount) || 0; }, ag = {}, ord = [];
      S2.forEach(function (r) { var k = fund ? (r.superFundName || '(no fund)') + '|' + nm(r) + '|' + (r.paymentType || '') : nm(r) + '|' + (r.accrualType || ''); if (!ag[k]) { ag[k] = fund ? { fund: r.superFundName || '(no fund)', usi: r.superFundNumber || '', name: nm(r), type: lab(r.paymentType), amount: 0 } : { name: nm(r), type: lab(r.accrualType), amount: 0, n: 0, status: {} }; ord.push(k); } ag[k].amount += amt(r); if (!fund) { ag[k].n++; ag[k].status[lab(r.status)] = 1; } });
      ord.sort(); var SR = ord.map(function (k) { var o = ag[k]; o.amount = QB.sum([o.amount]); if (!fund) o.status = Object.keys(o.status).join(', '); return o; }), stot = sumK(SR, function (r) { return r.amount; });
      var sg = sumK(S2.filter(function (r) { return /guarantee/i.test(fund ? r.paymentType : r.accrualType); }), amt);
      html += QB.kpis([{ label: 'Super contributions', value: stot }, { label: 'Super guarantee', value: sg }, { label: fund ? 'Funds' : 'Employees', money: false, value: Object.keys(SR.reduce(function (o, r) { o[fund ? r.fund : r.name] = 1; return o; }, {})).length }], c);
      x.cols = fund ? [col('fund', 'Super fund', false), col('usi', 'USI', false), col('name', 'Employee', false), col('type', 'Payment type', false), col('amount', 'Amount')] : [col('name', 'Employee', false), col('type', 'Contribution type', false), col('n', 'Pay runs', 'n'), col('status', 'Status', false), col('amount', 'Amount')];
      x.rows = SR; x.total = fund ? { fund: 'TOTAL', amount: stot } : { name: 'TOTAL', amount: stot }; x.empty = 'No super contributions in this period.';
      var grp = {}; SR.forEach(function (r) { var k = fund ? r.fund : r.name; grp[k] = (grp[k] || 0) + r.amount; });
      chart = { title: fund ? 'Super by fund' : 'Super by employee', labels: Object.keys(grp).map(function (k) { return k.slice(0, 16); }), series: [{ name: 'Super', values: Object.keys(grp).map(function (k) { return QB.sum([grp[k]]); }) }] };
      checks.push({ name: 'Σ lines = Employment Hero total', pass: sel ? null : near(stot, (D[fund ? 'super_fund' : 'super_employee'] || {}).total), detail: sel ? 'Employee filter on' : money(stot) });
      if (fund) { var other = c.errors.super_employee || !D.super_employee ? null : sumK(mine(rowsOf('super_employee')), function (r) { return r.accrualAmount; }); checks.push({ name: 'Σ by fund = Σ by employee', pass: other == null ? null : near(stot, other), detail: other == null ? 'Super by employee unavailable' : money(stot) + ' vs ' + money(other) }); }
      else { var sgc = c.errors.gross_to_net || !D.gross_to_net ? null : sumK(mine(g2n), function (r) { return r.sgc; }); checks.push({ name: 'Super guarantee = SGC on Gross to Net', pass: sgc == null ? null : near(sg, sgc), detail: sgc == null ? 'Gross to Net unavailable' : money(sg) + ' vs ' + money(sgc) }); }
    }
    html += '<div id="g1"></div>' + (chart ? '<div class="qb-card" style="margin-top:16px"><h3>' + h(chart.title) + '</h3><div id="ch1"></div></div>' : '');
    body.innerHTML = html;
    var g1 = document.getElementById('g1');
    if (x.html) g1.innerHTML = x.html; else QB.grid(g1, { filter: true, columns: x.cols, rows: x.rows || [], total: x.rows && x.rows.length ? x.total : null, empty: x.empty }, c);
    if (chart) QB.bars(document.getElementById('ch1'), chart, c);
    var es = document.getElementById('w-emp'); if (es) es.addEventListener('change', function () { c.change({}, { x: es.value }); });
    this._x = x;
    return { checks: checks, title: x.title + (sel ? ' — ' + people[sel] : ''),
      notes: ['Figures are by date paid, from Employment Hero Payroll. Australian QuickBooks Online payroll runs there, not in the QuickBooks Accounting API.', 'Pay figures are shown. The connector removes tax file numbers, bank details, dates of birth, addresses and personal contact details before the report sees them. A downloaded or shared copy carries these pay figures — share it only with people who may see payroll.'],
      na: ['Costing Report, Detailed Activity Report, Ordinary Time Earnings Report and Timesheets Report (not in the Employment Hero Payroll connector yet)', 'Location and pay schedule filters (one payroll business per report)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x || !x.cols) return [];
    var L = function (i) { return String.fromCharCode(65 + i); }, head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: x.title, s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []];
    var rows = head.concat([x.cols.map(function (k) { return { v: k.title, s: 'bold' }; })]), first = rows.length + 1;
    (x.rows || []).forEach(function (r) { rows.push(x.cols.map(function (k) { var val = r[k.key]; return k.money ? (val == null ? null : { v: val, s: 'money' }) : (val == null ? '' : val); })); });
    var lastR = rows.length;
    if ((x.rows || []).length) rows.push(x.cols.map(function (k, i) { return i === 0 ? { v: 'TOTAL', s: 'bold' } : k.money ? { f: 'SUM(' + L(i) + first + ':' + L(i) + lastR + ')', s: 'moneyBold' } : null; }));
    return [{ name: x.title.slice(0, 31), widths: x.cols.map(function (k) { return k.money ? 16 : 24; }), rows: rows }];
  }
});
```

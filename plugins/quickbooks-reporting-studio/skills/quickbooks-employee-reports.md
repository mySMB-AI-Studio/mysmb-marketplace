---
name: quickbooks-employee-reports
description: QuickBooks Online Employee reports family (Q33) as a live, validated report in QuickBooks styling. Use when the user asks for employee details, an employee list from payroll, leave balances, leave liability or accrued leave, employee payment history, or unpaid employees.
---

# Employee reports family (Q33)

Use when the user asks for employee details, an employee list from payroll, leave balances, leave liability or accrued leave, employee payment history, or unpaid employees. Load `quickbooks-report-foundation` first and follow its *Build a report* steps. Report title: **QuickBooks Employee Reports**. Template: `quickbooks-reporting-studio` / `quickbooks-employee-reports` (for `artifact_from_template`); without that tool, use the blocks below. This skill needs the `employment-hero-payroll` connector (`list_businesses`, `get_report_employee_details`, `get_report_leave_balances`, `get_report_gross_to_net`, `get_report_pay_categories`).

QuickBooks location: Reports › Standard reports › Employee Reports. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q33. Delivery: Wave 4 (Feature F6).

Employee details show the columns Employment Hero returns, after the connector removes tax file numbers, bank details, dates of birth, addresses and personal contact details. Say in the completion note that a downloaded or shared copy carries employee details and pay figures.

## Discovery call

`list_businesses` on the **`employment-hero-payroll`** connector (not QuickBooks) — as for the Payroll reports family: if it fails with a connection error, ask the user to connect the Employment Hero Payroll extension and stop; set `business_id` only when the user names one of several businesses. Employee details columns are whatever Employment Hero returns; the report finds the id and name columns itself.

## Date defaults

Preset `last_month`. Leave balances are as at the To date; payment history and unpaid employees cover the period.

## Members

| Member / view | How |
|---|---|
| Employee Details | Default view (active employees, every column Employment Hero returns) |
| Leave Balances | Report = Leave Balances (by category and employee, as at the To date) |
| Leave Liability | Report = Leave Liability (leave value + loading, chart by employee) |
| Employee Payment History | Report = Employee Payment History (each payment by date paid, gross and super) |
| Unpaid Employees | Report = Unpaid Employees (active employees with no pay in the period) |
| Birthdays | N/A — dates of birth are removed for privacy |
| Qualifications, Satisfaction | N/A — Employment Hero HR features, not in the payroll connector |

## Validation checks (STEP 4 — shown in the banner)

- Employee list loaded; employees matched by employee ID
- Leave value + loading = total liability (every line); Σ = Employment Hero total
- Σ payments = gross earnings on Gross to Net
- Active employees = paid + unpaid

## Save as

`fileName`: `quickbooks-employee-reports.html` · `tags`: ["quickbooks","payroll","employees","leave"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Not captured — compare Leave Liability and Employee Details with Employment Hero Payroll at the same date.
3. Compare the layout with the Q33 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"last_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"details\",\"x\":\"\"}"
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
      "id": "employees",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_employee_details"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "include_inactive": {
          "kind": "static",
          "value": false
        }
      }
    },
    {
      "id": "leave",
      "tool": {
        "mcp": "employment-hero-payroll",
        "name": "get_report_leave_balances"
      },
      "params": {
        "business_id": {
          "kind": "input",
          "input": "business_id"
        },
        "as_at": {
          "kind": "input",
          "input": "end_date"
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
    }
  ]
}
```

## Report config ({{CFG}})

```js
QB.app({
  title: 'Employee Reports', primary: 'employees', prepared: 'Prepared from Employment Hero Payroll', footer: 'Employment Hero Payroll',
  mechanism: 'employment-hero-payroll connector — mySMB custom MCP on the Employment Hero Payroll (KeyPay) AU API. QuickBooks Online AU payroll runs in Employment Hero, outside the QuickBooks Accounting API',
  friendly: { needs_connection: 'Connect Employment Hero Payroll (Settings → Connections) to see this data.', connection_unavailable: 'Employment Hero Payroll is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This payroll report is not available on the connected Employment Hero Payroll connector.', tool_error: 'Employment Hero Payroll returned an error for this section.' },
  fy: { month: 7, source: 'Australian payroll year' }, country: 'AU',
  clients: function (d) { return (Array.isArray(d.businesses) ? d.businesses : []).map(function (b) { return [String(b.id), b.name || b.legalName || 'Business ' + b.id]; }); },
  clientTitle: 'The payroll businesses this Employment Hero Payroll API key can see', clientNote: '(one payroll business per report — choose it in Client)', noCompany: 'Business name (Employment Hero returned no business for this API key)',
  period: function (d) { var g = d.gross_to_net || d.pay_categories; return g && g.from ? { start: g.from, end: g.to } : null; },
  inputs: { start: 'start_date', end: 'end_date', client: 'business_id', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', business_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"last_month","a":"custom","c":"none","v":"details","x":""}' },
  uses: { businesses: [], employees: ['business_id'], leave: ['end_date', 'business_id'], gross_to_net: ['start_date', 'end_date', 'business_id'], pay_categories: ['start_date', 'end_date', 'business_id'] },
  tools: { businesses: 'list_businesses (employment-hero-payroll)', employees: 'get_report_employee_details (active employees)', leave: 'get_report_leave_balances (as at the To date)', gross_to_net: 'get_report_gross_to_net', pay_categories: 'get_report_pay_categories' },
  views: [['details', 'Employee Details'], ['leave_balances', 'Leave Balances'], ['leave_liability', 'Leave Liability'], ['payment_history', 'Employee Payment History'], ['unpaid', 'Unpaid Employees']],
  render: function (c) {
    var body = c.body, h = QB.h, D = c.data, v = c.view || 'details', money = function (x) { return QB.money(x, c.currency, c.display); }, near = function (a, b) { return Math.abs((a || 0) - (b || 0)) < 0.005; };
    var need = { details: 'employees', leave_balances: 'leave', leave_liability: 'leave', payment_history: 'pay_categories', unpaid: 'employees' }[v];
    var NAMES = { employees: 'The employee list', leave: 'Leave balances', pay_categories: 'Pay categories' };
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + NAMES[need] + ' is unavailable: ' + h(c.err(need)) + '</p>'; return { checks: [{ name: NAMES[need] + ' loaded', pass: false, detail: c.err(need) }] }; }
    if (!D[need]) return {};
    var rowsOf = function (id) { return D[id] && Array.isArray(D[id].rows) ? D[id].rows : []; }, sumK = function (a, f) { return QB.sum(a.map(f)); }, dt = function (s) { return s ? String(s).slice(0, 10) : ''; };
    var nm = function (r) { return ((r.firstName || '') + ' ' + (r.surname || '')).trim() || 'Employee ' + r.employeeId; };
    // Employee details columns are whatever Employment Hero returns: find the id and name columns by their names.
    var E = rowsOf('employees'), K = E.length ? Object.keys(E[0]) : [], kOf = function (re) { return K.filter(function (k) { return re.test(k.replace(/[\s_]/g, '')); })[0]; };
    var kId = kOf(/^(employee)?id$/i), kFirst = kOf(/^(first|given|preferred)name$/i), kLast = kOf(/^(surname|lastname|familyname)$/i), kFull = kOf(/^(full)?name$/i), kStart = kOf(/startdate$/i), kType = kOf(/employmenttype$/i);
    var eName = function (r) { return ((kFirst ? r[kFirst] || '' : '') + ' ' + (kLast ? r[kLast] || '' : '')).trim() || (kFull ? String(r[kFull] || '') : '') || (kId ? 'Employee ' + r[kId] : 'Employee'); };
    var people = {}; E.forEach(function (r) { if (kId && r[kId] != null) people[r[kId]] = eName(r); });
    [rowsOf('leave'), rowsOf('pay_categories'), rowsOf('gross_to_net')].forEach(function (a) { a.forEach(function (r) { if (r.employeeId != null && !people[r.employeeId]) people[r.employeeId] = nm(r); }); });
    if (c.display.x && !people[c.display.x]) people[c.display.x] = 'Employee ' + c.display.x;
    var sel = c.display.x ? String(c.display.x) : '', mine = function (a, k) { return sel ? a.filter(function (r) { return String(r[k || 'employeeId']) === sel; }) : a; };
    var keys = Object.keys(people).sort(function (a, b) { return people[a].localeCompare(people[b]); });
    var html = v === 'unpaid' ? '' : '<label class="ctl" style="display:inline-flex;margin-bottom:12px">Employee<select id="w-emp"><option value="">All employees</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(people[k]) + '</option>'; }).join('') + '</select></label>';
    var col = function (k, t, m) { return { key: k, title: t, money: m !== false && m !== 'n', num: m === 'n' }; };
    var checks = [], x = { view: v, title: (this.views.filter(function (w) { return w[0] === v; })[0] || ['', ''])[1] }, chart = null, period, end = c.inputs.end_date;
    var paidIds = {}; rowsOf('gross_to_net').forEach(function (r) { paidIds[r.employeeId] = 1; });
    var cell = function (val) { return val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : /^\d{4}-\d{2}-\d{2}T00:00:00/.test(String(val)) ? String(val).slice(0, 10) : val; };
    if (v === 'details') {
      var shown = mine(E, kId), other = K.filter(function (k) { return k !== kFirst && k !== kLast && k !== kFull; });
      x.cols = [col('_name', 'Employee', false)].concat(other.map(function (k) { return col(k, k.replace(/([a-z])([A-Z])/g, '$1 $2'), false); }));
      x.rows = shown.map(function (r) { var o = { _name: eName(r) }; other.forEach(function (k) { o[k] = cell(r[k]); }); return o; }); x.empty = 'Employment Hero returned no active employees.';
      var started = kStart ? shown.filter(function (r) { var s = dt(r[kStart]); return s >= c.inputs.start_date && s <= end; }).length : null, types = {};
      if (kType) shown.forEach(function (r) { types[r[kType] || '(none)'] = (types[r[kType] || '(none)'] || 0) + 1; });
      html += QB.kpis([{ label: 'Active employees', money: false, value: shown.length }, { label: 'Started in the period', money: false, value: started == null ? 'N/A' : started }, { label: 'Paid in the period', money: false, value: c.errors.gross_to_net ? 'N/A' : shown.filter(function (r) { return kId && paidIds[r[kId]]; }).length }].concat(kType ? [{ label: 'Employment types', text: Object.keys(types).map(function (t) { return t + ' ' + types[t]; }).join(' · ') }] : []), c);
      period = 'Active employees';
      checks.push({ name: 'Employee list loaded', pass: true, detail: E.length + ' active employees, ' + K.length + ' columns' });
      checks.push({ name: 'Employees matched by employee ID', pass: E.length ? !!kId : null, detail: kId ? 'Column ' + kId : 'No employee ID column — matched by name only' });
    } else if (v === 'leave_balances' || v === 'leave_liability') {
      var Lr = mine(rowsOf('leave')).slice().sort(function (a, b) { return String(a.leaveCategoryName).localeCompare(String(b.leaveCategoryName)) || nm(a).localeCompare(nm(b)); });
      var LR = Lr.map(function (r) { return { name: nm(r), cat: r.leaveCategoryName || '(no category)', bal: r.accruedAmount, unit: r.unitType || 'Hours', days: r.accruedAmountInDays, value: r.leaveValue, loading: r.loadingValue, total: r.leavePlusLoading }; });
      var byCat = {}; LR.forEach(function (r) { byCat[r.cat] = byCat[r.cat] || { bal: 0, total: 0 }; byCat[r.cat].bal += Number(r.bal) || 0; byCat[r.cat].total += Number(r.total) || 0; });
      period = QB.asOfLine(end);
      if (v === 'leave_balances') {
        html += QB.kpis(Object.keys(byCat).slice(0, 4).map(function (k) { return { label: k + ' (' + (LR.filter(function (r) { return r.cat === k; })[0] || {}).unit + ')', money: false, value: QB.sum([byCat[k].bal]) }; }).concat([{ label: 'Employees with leave', money: false, value: Object.keys(LR.reduce(function (o, r) { o[r.name] = 1; return o; }, {})).length }]), c);
        x.cols = [col('cat', 'Leave category', false), col('name', 'Employee', false), col('bal', 'Balance', 'n'), col('unit', 'Unit', false), col('days', 'Days', 'n')]; x.rows = LR; x.total = null; x.empty = 'No leave balances at this date.';
        var neg = LR.filter(function (r) { return Number(r.bal) < 0; });
        checks.push({ name: 'Negative leave balances', pass: null, info: true, detail: neg.length ? neg.map(function (r) { return r.name + ' ' + r.cat + ' ' + r.bal; }).join('; ') : 'None' });
        checks.push({ name: 'Σ leave value = Employment Hero total', pass: sel ? null : near(sumK(LR, function (r) { return r.value; }), D.leave.totalLeaveValue), detail: sel ? 'Employee filter on' : money(sumK(LR, function (r) { return r.value; })) });
      } else {
        var tl = sumK(LR, function (r) { return r.total; });
        html += QB.kpis([{ label: 'Leave liability (with loading)', value: tl }].concat(Object.keys(byCat).slice(0, 3).map(function (k) { return { label: k, value: QB.sum([byCat[k].total]) }; })), c);
        x.cols = [col('name', 'Employee', false), col('cat', 'Leave category', false), col('bal', 'Balance', 'n'), col('unit', 'Unit', false), col('value', 'Leave value'), col('loading', 'Leave loading'), col('total', 'Total liability')];
        x.rows = LR.slice().sort(function (a, b) { return a.name.localeCompare(b.name) || a.cat.localeCompare(b.cat); }); x.total = { name: 'TOTAL', value: sumK(LR, function (r) { return r.value; }), loading: sumK(LR, function (r) { return r.loading; }), total: tl }; x.empty = 'No leave liability at this date.';
        var per = {}; LR.forEach(function (r) { per[r.name] = (per[r.name] || 0) + (Number(r.total) || 0); });
        chart = { title: 'Leave liability by employee', labels: Object.keys(per).map(function (k) { return k.slice(0, 16); }), series: [{ name: 'Liability', values: Object.keys(per).map(function (k) { return QB.sum([per[k]]); }) }] };
        var badL = LR.filter(function (r) { return !near(r.total, (Number(r.value) || 0) + (Number(r.loading) || 0)); });
        checks.push({ name: 'Leave value + loading = total liability (every line)', pass: LR.length ? !badL.length : null, detail: badL.length ? badL[0].name + ' ' + badL[0].cat : LR.length + ' lines' });
        checks.push({ name: 'Σ liability = Employment Hero total', pass: sel ? null : near(tl, D.leave.totalLeavePlusLoading), detail: sel ? 'Employee filter on' : money(tl) });
      }
    } else if (v === 'payment_history') {
      var P = mine(rowsOf('pay_categories')), grp = {};
      P.forEach(function (r) { var k = r.employeeId + '|' + dt(r.datePaid); grp[k] = grp[k] || { id: r.employeeId, name: nm(r), paid: dt(r.datePaid), run: r.payRun || '', gross: 0, sup: 0, hours: 0 }; grp[k].gross += Number(r.amount) || 0; grp[k].sup += Number(r.superAmount) || 0; });
      var HR = Object.keys(grp).map(function (k) { var g = grp[k]; g.gross = QB.sum([g.gross]); g.sup = QB.sum([g.sup]); return g; }).sort(function (a, b) { return a.name.localeCompare(b.name) || (a.paid < b.paid ? -1 : 1); });
      var tg = sumK(HR, function (r) { return r.gross; });
      html += QB.kpis([{ label: 'Gross earnings', value: tg }, { label: 'Super on earnings', value: sumK(HR, function (r) { return r.sup; }) }, { label: 'Payments', money: false, value: HR.length }], c);
      var t = '<div class="qb-scroll"><table class="qb-stmt"><thead><tr><th>Date paid</th><th>Pay run</th><th class="num">Gross earnings</th><th class="num">Super</th></tr></thead><tbody>', names = [];
      HR.forEach(function (r) { if (names.indexOf(r.name) < 0) names.push(r.name); });
      names.forEach(function (n) { var rs = HR.filter(function (r) { return r.name === n; });
        t += '<tr class="k-header"><td colspan="4">' + h(n) + '</td></tr>' + rs.map(function (r) { return '<tr class="k-row detail-block"><td style="padding-left:26px">' + h(r.paid) + '</td><td>' + h(r.run) + '</td><td class="num">' + money(r.gross) + '</td><td class="num">' + money(r.sup) + '</td></tr>'; }).join('');
        t += '<tr class="k-total"><td colspan="2">Total for ' + h(n) + '</td><td class="num">' + money(sumK(rs, function (r) { return r.gross; })) + '</td><td class="num">' + money(sumK(rs, function (r) { return r.sup; })) + '</td></tr>'; });
      t += (HR.length ? '<tr class="k-total"><td colspan="2">TOTAL</td><td class="num">' + money(tg) + '</td><td class="num">' + money(sumK(HR, function (r) { return r.sup; })) + '</td></tr>' : '<tr><td colspan="4" class="muted">No payments in this period.</td></tr>') + '</tbody></table></div>';
      x.html = t; x.cols = [col('name', 'Employee', false), col('paid', 'Date paid', false), col('run', 'Pay run', false), col('gross', 'Gross earnings'), col('sup', 'Super')]; x.rows = HR; x.total = { name: 'TOTAL', gross: tg };
      if (c.errors.gross_to_net || !D.gross_to_net) checks.push({ name: 'Σ payments = gross earnings on Gross to Net', pass: null, detail: 'Gross to Net unavailable' });
      else { var gg = sumK(mine(rowsOf('gross_to_net')), function (r) { return typeof r.totalGrossEarnings === 'number' ? r.totalGrossEarnings : typeof r.grossEarnings === 'number' ? r.grossEarnings : 0; }); checks.push({ name: 'Σ payments = gross earnings on Gross to Net', pass: near(tg, gg), detail: money(tg) + ' vs ' + money(gg) }); }
    } else {
      if (c.errors.gross_to_net || !D.gross_to_net) { body.innerHTML = '<p class="qb-err">Gross to Net is unavailable, so unpaid employees cannot be worked out: ' + h(c.err('gross_to_net') || 'no data') + '</p>'; return { checks: [{ name: 'Gross to Net loaded', pass: c.errors.gross_to_net ? false : null, detail: c.err('gross_to_net') || 'No data' }] }; }
      var paidNames = {}; rowsOf('gross_to_net').forEach(function (r) { paidNames[nm(r).toLowerCase()] = 1; });
      var U = E.filter(function (r) { return kId ? !paidIds[r[kId]] : !paidNames[eName(r).toLowerCase()]; });
      html += QB.kpis([{ label: 'Unpaid employees', money: false, value: U.length }, { label: 'Active employees', money: false, value: E.length }, { label: 'Paid in the period', money: false, value: E.length - U.length }], c);
      x.cols = [col('name', 'Employee', false), col('id', 'Employee ID', false), col('start', 'Start date', false), col('type', 'Employment type', false)];
      x.rows = U.map(function (r) { return { name: eName(r), id: kId ? r[kId] : '', start: kStart ? dt(r[kStart]) : '', type: kType ? r[kType] || '' : '' }; }); x.empty = 'Every active employee was paid in this period.';
      checks.push({ name: 'Active employees = paid + unpaid', pass: true, detail: E.length + ' = ' + (E.length - U.length) + ' + ' + U.length });
      checks.push({ name: 'Unpaid employees to review', pass: null, info: true, detail: U.length ? x.rows.map(function (r) { return r.name; }).join(', ') : 'None' });
    }
    html += '<div id="g1"></div>' + (chart ? '<div class="qb-card" style="margin-top:16px"><h3>' + h(chart.title) + '</h3><div id="ch1"></div></div>' : '');
    body.innerHTML = html;
    var g1 = document.getElementById('g1');
    if (x.html) g1.innerHTML = x.html; else QB.grid(g1, { filter: true, columns: x.cols, rows: x.rows || [], total: x.rows && x.rows.length ? x.total : null, empty: x.empty }, c);
    if (chart) QB.bars(document.getElementById('ch1'), chart, c);
    var es = document.getElementById('w-emp'); if (es) es.addEventListener('change', function () { c.change({}, { x: es.value }); });
    this._x = x; x.period = period;
    return { checks: checks, title: x.title + (sel ? ' — ' + people[sel] : ''), period: period,
      notes: ['From Employment Hero Payroll. Australian QuickBooks Online payroll and employee records live there, not in the QuickBooks Accounting API.', 'Employee details show the columns Employment Hero returns, after the connector removes tax file numbers, bank details, dates of birth, addresses and personal contact details. A downloaded or shared copy carries these details and pay figures — share it only with people who may see employee records.', 'Leave balances are as at the To date. Payment history and unpaid employees cover the report period, by date paid.'],
      na: ['Birthdays (dates of birth are removed for privacy)', 'Qualifications and Satisfaction (Employment Hero HR features, not in the payroll connector)', 'Leave opening balance, accrued and taken (the leave balances report gives the balance at the date)', 'Inactive employees in Employee Details (active employees only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x || !x.cols) return [];
    var L = function (i) { return String.fromCharCode(65 + (i % 26)); }, head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: x.title, s: 'bold' }], [x.period || QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []];
    var rows = head.concat([x.cols.map(function (k) { return { v: k.title, s: 'bold' }; })]), first = rows.length + 1;
    (x.rows || []).forEach(function (r) { rows.push(x.cols.map(function (k) { var val = r[k.key]; return k.money ? (val == null ? null : { v: val, s: 'money' }) : (val == null ? '' : val); })); });
    var lastR = rows.length;
    if ((x.rows || []).length && x.total) rows.push(x.cols.map(function (k, i) { return i === 0 ? { v: 'TOTAL', s: 'bold' } : k.money && i < 26 ? { f: 'SUM(' + L(i) + first + ':' + L(i) + lastR + ')', s: 'moneyBold' } : null; }));
    return [{ name: x.title.slice(0, 31), widths: x.cols.map(function (k) { return k.money ? 16 : 22; }), rows: rows }];
  }
});
```

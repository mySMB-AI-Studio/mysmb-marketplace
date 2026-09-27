---
name: quickbooks-employees-and-time
description: QuickBooks Online Employees and time family (Q31) as a live, validated report in QuickBooks styling. Use when the user asks for time activities, timesheets, hours by employee, billable hours, recent or edited time entries, time by pay type, or the employee contact list.
---

# Employees and time family (Q31)

Use when the user asks for time activities, timesheets, hours by employee, billable hours, recent or edited time entries, time by pay type, or the employee contact list. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Employees / Payroll · Time. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q31. Delivery: Wave 4 (Feature F6).

## Discovery call

`qbo_query` with the dataBindings TimeActivity query — expect `QueryResponse.TimeActivity[]` with TxnDate, NameOf (Employee | Vendor), EmployeeRef / VendorRef, CustomerRef, ItemRef, BillableStatus, HourlyRate, Hours + Minutes (or StartTime / EndTime + breaks). **If QuickBooks rejects the field list** (the query fails with a query-syntax error), change the `time_activities` binding to `list_time_activity` (`orderBy` = `TxnDate DESC`, `maxResults` = 1000) and the `employees` binding to `list_employee` (`maxResults` = 1000); the config reads the same response. The field lists keep pay rates and personal details out of the report.

## Date defaults

Preset `this_month`. Time has no accounting basis.

## Members

| Member / view | How |
|---|---|
| Time Activities by Employee Detail | Employee | Date | Customer | Product/Service | Description | Rate | Duration | Billable | Amount, "Total for" each employee |
| Timesheet Detail | Report = Timesheet Detail (start, end, break, duration) |
| Recent/Edited Time Activities | Report = Recent/Edited — created or last modified in the period |
| Time Summary by Pay Type | Report = Time Summary by Pay Type — N/A unless QuickBooks Payroll pay types are on the time activities (AU payroll is in Employment Hero) |
| Employee Contact List | Report = Employee Contact List (phone, mobile, email, address, employee ID — active employees) |
| Employee filter | Employee picker above the report |

## Validation checks (STEP 4 — shown in the banner)

- Σ hours per employee = total hours
- Billable + non-billable hours = total hours
- Every time activity names an employee or supplier
- All time activities in the period were loaded (latest 1,000)

## Save as

`fileName`: `quickbooks-time-activities.html` · `tags`: ["quickbooks","time","employees"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Layout per QBO documentation: Employee | Date | Customer | Product/Service | Duration | Billable.
3. Compare the layout with the Q31 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "2026-09-01"
    },
    {
      "name": "end_date",
      "label": "To",
      "type": "date",
      "default": "2026-09-30"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_month\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"by_employee\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "time_activities",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "qbo_query"
      },
      "params": {
        "query": {
          "kind": "static",
          "value": "SELECT Id, TxnDate, NameOf, EmployeeRef, VendorRef, CustomerRef, ItemRef, ClassRef, DepartmentRef, BillableStatus, HourlyRate, Hours, Minutes, BreakHours, BreakMinutes, StartTime, EndTime, Description, PayrollItemRef, MetaData FROM TimeActivity ORDER BY TxnDate DESC MAXRESULTS 1000"
        }
      }
    },
    {
      "id": "employees",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "qbo_query"
      },
      "params": {
        "query": {
          "kind": "static",
          "value": "SELECT Id, DisplayName, GivenName, FamilyName, PrimaryPhone, Mobile, PrimaryEmailAddr, PrimaryAddr, EmployeeNumber, Active FROM Employee MAXRESULTS 1000"
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
  title: 'Time Activities by Employee Detail', token: 'TIME_ACTIVITIES_BY_EMPLOYEE', route: 'reportv2', primary: 'time_activities', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-09-01', end_date: '2026-09-30', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_month","a":"custom","c":"none","v":"by_employee","x":""}' },
  uses: { time_activities: [], employees: [], company_info: [], prefs: [] },
  tools: { time_activities: 'qbo_query (TimeActivity, latest 1,000)', employees: 'qbo_query (Employee contact fields)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['by_employee', 'Time Activities by Employee Detail'], ['timesheet', 'Timesheet Detail'], ['recent', 'Recent/Edited Time Activities'], ['pay_type', 'Time Summary by Pay Type'], ['contacts', 'Employee Contact List']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'by_employee', h = QB.h;
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    if (v !== 'contacts' && c.errors.time_activities) { body.innerHTML = '<p class="qb-err">Time activities are unavailable — not zero: ' + h(c.err('time_activities')) + '</p>'; return { checks: [{ name: 'Σ hours per employee = total hours', pass: false, detail: c.err('time_activities') }] }; }
    if (v === 'contacts' && c.errors.employees) { body.innerHTML = '<p class="qb-err">Employees are unavailable: ' + h(c.err('employees')) + '</p>'; return { checks: [{ name: 'Employee list loaded', pass: false, detail: c.err('employees') }] }; }
    if (!c.data.time_activities && !c.data.employees) return {};
    var hrs = function (t) {
      if (t.Hours != null || t.Minutes != null) return (Number(t.Hours) || 0) + (Number(t.Minutes) || 0) / 60;
      if (t.StartTime && t.EndTime) { var d = (Date.parse(t.EndTime) - Date.parse(t.StartTime)) / 3600000 - ((Number(t.BreakHours) || 0) + (Number(t.BreakMinutes) || 0) / 60); return d > 0 ? d : 0; }
      return 0;
    };
    var hm = function (x) { if (x == null) return ''; var m = Math.round(x * 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
    var tm = function (s) { return s ? String(s).slice(11, 16) : ''; };
    var dt = function (s) { return s ? String(s).slice(0, 10) : ''; };
    var all = q('time_activities', 'TimeActivity'), emps = q('employees', 'Employee');
    var S = c.inputs.start_date, E = c.inputs.end_date;
    var rows = all.map(function (t) {
      var vend = t.NameOf === 'Vendor', ref = (vend ? t.VendorRef : t.EmployeeRef) || null, x = hrs(t), bill = t.BillableStatus === 'Billable' || t.BillableStatus === 'HasBeenBilled', rate = Number(t.HourlyRate) || 0;
      return { t: t, date: dt(t.TxnDate), who: ref ? ref.name || ('#' + ref.value) : null, key: ref ? (vend ? 'V' : 'E') + ':' + ref.value : '', kind: vend ? 'Supplier' : 'Employee', customer: (t.CustomerRef || {}).name || '', item: (t.ItemRef || {}).name || '',
        desc: t.Description || '', hours: Math.round(x * 10000) / 10000, bill: bill, status: t.BillableStatus || 'NotBillable', rate: bill && rate ? rate : null, amount: bill && rate ? Math.round(rate * x * 100) / 100 : null,
        start: tm(t.StartTime), end: tm(t.EndTime), brk: (t.BreakHours != null || t.BreakMinutes != null) ? (Number(t.BreakHours) || 0) + (Number(t.BreakMinutes) || 0) / 60 : null,
        pay: (t.PayrollItemRef || {}).name || null, created: (t.MetaData || {}).CreateTime || '', updated: (t.MetaData || {}).LastUpdatedTime || '' };
    });
    var inP = rows.filter(function (r) { return r.date >= S && r.date <= E; });
    // Employee filter (display x): '' = everyone
    var people = {}; inP.forEach(function (r) { if (r.key && !people[r.key]) people[r.key] = r.who + (r.kind === 'Supplier' ? ' (supplier)' : ''); });
    emps.forEach(function (e) { var k = 'E:' + e.Id; if (!people[k]) people[k] = e.DisplayName || ((e.GivenName || '') + ' ' + (e.FamilyName || '')).trim(); });
    var sel = c.display.x && people[c.display.x] ? c.display.x : '';
    var shown = sel ? inP.filter(function (r) { return r.key === sel; }) : inP;
    var keys = Object.keys(people).sort(function (a, b) { return people[a].localeCompare(people[b]); });
    var picker = '<label class="ctl" style="display:inline-flex;margin-bottom:12px">Employee<select id="w-emp"><option value="">All employees and suppliers</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(people[k]) + '</option>'; }).join('') + '</select></label>';
    var groups = {}, order = []; shown.forEach(function (r) { var k = r.key || '(no name)'; if (!groups[k]) { groups[k] = { name: r.who || 'No employee or supplier', rows: [], kind: r.kind }; order.push(k); } groups[k].rows.push(r); });
    order.sort(function (a, b) { return groups[a].name.localeCompare(groups[b].name); });
    order.forEach(function (k) { var g = groups[k]; g.rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); g.hours = g.rows.reduce(function (s, r) { return s + r.hours; }, 0); g.bill = g.rows.filter(function (r) { return r.bill; }).reduce(function (s, r) { return s + r.hours; }, 0); g.amount = QB.sum(g.rows.map(function (r) { return r.amount; })); });
    var totH = shown.reduce(function (s, r) { return s + r.hours; }, 0), billH = shown.filter(function (r) { return r.bill; }).reduce(function (s, r) { return s + r.hours; }, 0), nonH = shown.filter(function (r) { return !r.bill; }).reduce(function (s, r) { return s + r.hours; }, 0);
    var html = picker;
    if (v !== 'contacts') html += QB.kpis([{ label: 'Total hours', text: hm(totH) }, { label: 'Billable hours', text: hm(billH) }, { label: 'Billable %', text: totH ? QB.pct(billH / totH) : 'N/A — no time' }, { label: 'Billable amount', value: QB.sum(shown.map(function (r) { return r.amount; })) }, { label: 'People with time', money: false, value: order.length }], c);
    html += '<div id="g1"></div>' + (v !== 'contacts' ? '<div class="qb-card" style="margin-top:16px"><h3>Hours by employee</h3><div id="ch1"></div></div>' : '');
    body.innerHTML = html;
    var g1 = document.getElementById('g1');
    if (v === 'contacts') {
      var addr = function (a) { return a ? [a.Line1, a.Line2, a.City, a.CountrySubDivisionCode, a.PostalCode].filter(Boolean).join(', ') : ''; };
      var list = emps.filter(function (e) { return !sel || 'E:' + e.Id === sel; }).map(function (e) { return { name: e.DisplayName || ((e.GivenName || '') + ' ' + (e.FamilyName || '')).trim(), phone: (e.PrimaryPhone || {}).FreeFormNumber || '', mobile: (e.Mobile || {}).FreeFormNumber || '', email: (e.PrimaryEmailAddr || {}).Address || '', address: addr(e.PrimaryAddr), num: e.EmployeeNumber || '' }; });
      QB.grid(g1, { filter: true, columns: [{ key: 'name', title: 'Employee' }, { key: 'phone', title: 'Phone' }, { key: 'mobile', title: 'Mobile' }, { key: 'email', title: 'Email' }, { key: 'address', title: 'Address' }, { key: 'num', title: 'Employee ID' }], rows: list, empty: 'No active employees in QuickBooks.' }, c);
      this._contacts = list;
    } else if (v === 'timesheet') {
      QB.grid(g1, { filter: true, columns: [{ key: 'who', title: 'Employee' }, { key: 'date', title: 'Date' }, { key: 'start', title: 'Start' }, { key: 'end', title: 'End' }, { key: 'brk', title: 'Break', num: true, fmt: hm }, { key: 'hours', title: 'Duration', num: true, fmt: hm }, { key: 'customer', title: 'Customer' }, { key: 'item', title: 'Product/Service' }, { key: 'status', title: 'Billable', fmt: function (x) { return x === 'NotBillable' ? 'No' : x === 'HasBeenBilled' ? 'Billed' : 'Yes'; } }, { key: 'desc', title: 'Description' }],
        rows: shown.slice().sort(function (a, b) { return (a.who || '').localeCompare(b.who || '') || (a.date < b.date ? -1 : 1); }), total: { who: 'TOTAL', hours: totH }, empty: 'No time activities in this period.' }, c);
    } else if (v === 'recent') {
      var ed = rows.filter(function (r) { var u = dt(r.updated); return u >= S && u <= E && (!sel || r.key === sel); }).sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
      QB.grid(g1, { filter: true, columns: [{ key: 'updated', title: 'Last modified', fmt: function (x) { return String(x).slice(0, 16).replace('T', ' '); } }, { key: 'created', title: 'Created', fmt: function (x) { return String(x).slice(0, 16).replace('T', ' '); } }, { key: 'edited', title: 'Edited' }, { key: 'date', title: 'Date' }, { key: 'who', title: 'Name' }, { key: 'customer', title: 'Customer' }, { key: 'item', title: 'Product/Service' }, { key: 'hours', title: 'Duration', num: true, fmt: hm }, { key: 'status', title: 'Billable', fmt: function (x) { return x === 'NotBillable' ? 'No' : 'Yes'; } }],
        rows: ed.map(function (r) { return Object.assign({}, r, { edited: r.created && r.updated && r.created.slice(0, 16) !== r.updated.slice(0, 16) ? 'Edited' : 'New' }); }), empty: 'No time activities were created or edited in this period.' }, c);
    } else if (v === 'pay_type') {
      var withPay = shown.filter(function (r) { return r.pay; });
      if (!withPay.length) g1.innerHTML = '<div class="qb-banner"><strong>Pay types are not in this QuickBooks company.</strong> Time Summary by Pay Type needs QuickBooks Payroll pay types on each time activity. In Australia payroll runs in Employment Hero, so QuickBooks time activities carry no pay type — N/A — not in source.</div>';
      else { var pt = {}; withPay.forEach(function (r) { var k = r.who + '|' + r.pay; pt[k] = pt[k] || { who: r.who, pay: r.pay, hours: 0 }; pt[k].hours += r.hours; }); QB.grid(g1, { filter: true, columns: [{ key: 'who', title: 'Employee' }, { key: 'pay', title: 'Pay type' }, { key: 'hours', title: 'Hours', num: true, fmt: hm }], rows: Object.keys(pt).map(function (k) { return pt[k]; }), total: { who: 'TOTAL', hours: withPay.reduce(function (s, r) { return s + r.hours; }, 0) } }, c); }
    } else {
      var t = '<div class="qb-scroll"><table class="qb-stmt"><thead><tr><th>Date</th><th>Customer</th><th>Product/Service</th><th>Description</th><th class="num">Rate</th><th class="num">Duration</th><th>Billable</th><th class="num">Amount</th></tr></thead><tbody>';
      order.forEach(function (k) { var g = groups[k];
        t += '<tr class="k-header"><td colspan="8">' + h(g.name + (g.kind === 'Supplier' ? ' (supplier)' : '')) + '</td></tr>';
        g.rows.forEach(function (r) { t += '<tr class="k-row detail-block"><td style="padding-left:26px">' + h(r.date) + '</td><td>' + h(r.customer) + '</td><td>' + h(r.item) + '</td><td>' + h(r.desc) + '</td><td class="num">' + (r.rate == null ? '' : money(r.rate)) + '</td><td class="num">' + hm(r.hours) + '</td><td>' + (r.bill ? 'Yes' : 'No') + '</td><td class="num">' + (r.amount == null ? '' : money(r.amount)) + '</td></tr>'; });
        t += '<tr class="k-total"><td colspan="5">Total for ' + h(g.name) + '</td><td class="num">' + hm(g.hours) + '</td><td></td><td class="num">' + money(g.amount) + '</td></tr>'; });
      t += (order.length ? '<tr class="k-total"><td colspan="5">TOTAL</td><td class="num">' + hm(totH) + '</td><td></td><td class="num">' + money(QB.sum(shown.map(function (r) { return r.amount; }))) + '</td></tr>' : '<tr><td colspan="8" class="muted">No time activities in this period.</td></tr>') + '</tbody></table></div>';
      g1.innerHTML = t;
    }
    if (v !== 'contacts') QB.bars(document.getElementById('ch1'), { title: 'Hours by employee', labels: order.map(function (k) { return groups[k].name.slice(0, 16); }), series: [{ name: 'Billable', values: order.map(function (k) { return Math.round(groups[k].bill * 100) / 100; }) }, { name: 'Non-billable', values: order.map(function (k) { return Math.round((groups[k].hours - groups[k].bill) * 100) / 100; }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 1, k: 0 }) });
    var es = document.getElementById('w-emp'); if (es) es.addEventListener('change', function () { c.change({}, { x: es.value }); });
    // STEP 4 checks
    var sumPeople = order.reduce(function (s, k) { return s + groups[k].hours; }, 0), noName = inP.filter(function (r) { return !r.key; }).length;
    var capped = all.length >= 1000, oldest = all.length ? all.map(function (r) { return dt(r.TxnDate); }).sort()[0] : null, complete = !capped || (oldest && oldest < S);
    var checks = v === 'contacts' ? [{ name: 'Employee list loaded', pass: c.data.employees ? true : null, detail: emps.length + ' active employees' }] : [
      { name: 'Σ hours per employee = total hours', pass: Math.abs(sumPeople - totH) < 0.005, detail: hm(totH) + ' across ' + order.length + (order.length === 1 ? ' person' : ' people') },
      { name: 'Billable + non-billable hours = total hours', pass: Math.abs(billH + nonH - totH) < 0.005, detail: hm(billH) + ' + ' + hm(nonH) },
      { name: 'Every time activity names an employee or supplier', pass: inP.length ? noName === 0 : null, detail: noName ? noName + ' without a name' : inP.length + ' time activities' },
      { name: 'All time activities in the period were loaded', pass: complete, detail: capped ? (complete ? 'Latest 1,000 reach back before the period' : 'QuickBooks returned the latest 1,000 time activities; the oldest is ' + oldest + ', after the period start — shorten the period') : all.length + ' time activities in QuickBooks' }];
    this._x = { groups: groups, order: order, shown: shown, totH: totH, hm: hm, view: v };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1] + (sel ? ' — ' + people[sel] : ''), period: v === 'contacts' ? 'Active employees' : undefined,
      notes: ['Durations are hours:minutes. Time entered as start and end times is the difference less breaks.', 'Contacts show only the fields QuickBooks holds for the contact list (phone, mobile, email, address, employee ID); pay, tax and personal details are not requested.'].concat(inP.some(function (r) { return r.kind === 'Supplier'; }) ? ['Supplier (contractor) time is included and marked (supplier).'] : []),
      na: ['Time Summary by Pay Type when QuickBooks Payroll is not used (AU payroll is in Employment Hero)', 'Payroll, leave and pay details (Employment Hero)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    if (x.view === 'contacts') { var L = this._contacts || []; return [{ name: 'Employee Contact List', widths: [30, 18, 18, 32, 50, 14], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Employee Contact List', s: 'bold' }], [], [{ v: 'Employee', s: 'bold' }, { v: 'Phone', s: 'bold' }, { v: 'Mobile', s: 'bold' }, { v: 'Email', s: 'bold' }, { v: 'Address', s: 'bold' }, { v: 'Employee ID', s: 'bold' }]].concat(L.map(function (e) { return [e.name, e.phone, e.mobile, e.email, e.address, e.num]; })) }]; }
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Time Activities by Employee Detail', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], [{ v: 'Employee', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Customer', s: 'bold' }, { v: 'Product/Service', s: 'bold' }, { v: 'Description', s: 'bold' }, { v: 'Rate', s: 'bold' }, { v: 'Hours', s: 'bold' }, { v: 'Billable', s: 'bold' }, { v: 'Amount', s: 'bold' }]];
    var subs = [];
    x.order.forEach(function (k) { var g = x.groups[k], first = rows.length + 1;
      g.rows.forEach(function (r) { rows.push([g.name, r.date, r.customer, r.item, r.desc, r.rate == null ? null : { v: r.rate, s: 'money' }, Math.round(r.hours * 100) / 100, r.bill ? 'Yes' : 'No', r.amount == null ? null : { v: r.amount, s: 'money' }]); });
      var R = rows.length + 1, lastR = R - 1; subs.push(R);
      rows.push([{ v: 'Total for ' + g.name, s: 'bold' }, null, null, null, null, null, { f: lastR >= first ? 'SUM(G' + first + ':G' + lastR + ')' : '0', s: 'bold' }, null, { f: lastR >= first ? 'SUM(I' + first + ':I' + lastR + ')' : '0', s: 'moneyBold' }]); });
    rows.push([{ v: 'TOTAL', s: 'bold' }, null, null, null, null, null, { f: subs.length ? subs.map(function (r) { return 'G' + r; }).join('+') : '0', v: Math.round(x.totH * 100) / 100, s: 'bold' }, null, { f: subs.length ? subs.map(function (r) { return 'I' + r; }).join('+') : '0', s: 'moneyBold' }]);
    return [{ name: 'Time by employee', widths: [28, 12, 26, 24, 36, 12, 10, 10, 14], rows: rows }];
  }
});
```

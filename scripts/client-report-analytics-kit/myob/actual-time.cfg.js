// CRA-12 Actual Time (MYOB): the hours recorded in the company file's timesheets for a period, by employee, by job / activity /
// customer, and by month, with the hours not yet processed in a pay run. Source: list_timesheets (myhub-mcp-servers
// myob-accounting, Payroll/TimeSheet: Employee, StartDate, EndDate, Lines[] with PayrollCategory, optional Job / Activity /
// Customer, Entries[] with Date, Hours, Processed). The connector keeps every weekly sheet that overlaps the dates, so each daily
// entry is filtered to the period here. This is the client's own staff time as MYOB records it, not the practice's time on the
// client (that needs a practice-management time source, which the platform doesn't have).
var CRA = MK.app({
  title: 'MYOB Actual Time', primary: 'timesheets', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { timesheets: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { timesheets: 'list_timesheets (weekly sheets overlapping the period; daily entries in the period)', company_files: 'list_company_files' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    var SCOPE = 'Time recorded in this company file\'s timesheets (the client\'s own staff time), not the practice\'s time on this client — that needs a practice-management time source.';
    if (c.errors.timesheets) { body.innerHTML = '<p class="mk-err">' + h(c.err('timesheets')) + '</p>'; this._x = null; return { checks: [{ name: 'Timesheets loaded', pass: false, detail: c.err('timesheets') }] }; }
    if (!c.data.timesheets) return {};
    var r2 = function (v) { return Math.round(v * 100) / 100; }, hrs = function (v) { return (Math.round(v * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var task = function (l) {
      if (l.Job) return 'Job ' + [l.Job.Number, l.Job.Name].filter(Boolean).join(' ');
      if (l.Activity) return 'Activity ' + (l.Activity.Name || l.Activity.DisplayID || '');
      if (l.Customer) return 'Customer ' + (l.Customer.Name || '');
      return 'No job, activity or customer';
    };
    var sheets = MK.items(c.data.timesheets), entries = [], outside = 0;
    sheets.forEach(function (s) {
      var emp = (s.Employee || {}).Name || (s.Employee || {}).DisplayID || '(no employee)';
      (s.Lines || []).forEach(function (l) {
        (l.Entries || []).forEach(function (e) {
          var d = MK.isoDate(e.Date), hr = MK.num(e.Hours) || 0; if (!hr) return;
          if (!d || d < from || d > to) { outside++; return; }
          entries.push({ emp: emp, task: task(l), cat: (l.PayrollCategory || {}).Name || '', date: d, hours: hr, processed: e.Processed === true });
        });
      });
    });
    var months = []; for (var k = from.slice(0, 7); k <= to.slice(0, 7);) { months.push(k); var y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } k = y + '-' + String(m).padStart(2, '0'); }
    var mlabel = function (k) { return MK.MONTHS[+k.slice(5, 7) - 1].slice(0, 3) + ' ' + k.slice(2, 4); };
    var byEmp = {}, byTask = {};
    entries.forEach(function (e) {
      var E = byEmp[e.emp] || (byEmp[e.emp] = { name: e.emp, hours: 0, open: 0, m: {} }); E.hours += e.hours; if (!e.processed) E.open += e.hours; E.m[e.date.slice(0, 7)] = (E.m[e.date.slice(0, 7)] || 0) + e.hours;
      var T = byTask[e.task] || (byTask[e.task] = { name: e.task, hours: 0, emps: {} }); T.hours += e.hours; T.emps[e.emp] = 1;
    });
    var emps = Object.keys(byEmp).map(function (n) { return byEmp[n]; }).sort(function (a, b) { return b.hours - a.hours || (a.name < b.name ? -1 : 1); });
    var tasks = Object.keys(byTask).map(function (n) { return byTask[n]; }).sort(function (a, b) { return b.hours - a.hours || (a.name < b.name ? -1 : 1); });
    var grand = r2(entries.reduce(function (s, e) { return s + e.hours; }, 0)), open = r2(entries.filter(function (e) { return !e.processed; }).reduce(function (s, e) { return s + e.hours; }, 0));
    var tagged = r2(tasks.filter(function (t) { return t.name !== 'No job, activity or customer'; }).reduce(function (s, t) { return s + t.hours; }, 0));
    var mTot = {}; months.forEach(function (k) { mTot[k] = r2(emps.reduce(function (s, e) { return s + (e.m[k] || 0); }, 0)); });
    var empTot = r2(emps.reduce(function (s, e) { return s + e.hours; }, 0)), taskTot = r2(tasks.reduce(function (s, t) { return s + t.hours; }, 0)), monthTot = r2(months.reduce(function (s, k) { return s + mTot[k]; }, 0));
    var share = function (v) { return grand ? MK.pct(v / grand) : '—'; };
    var empRows = emps.map(function (e) { return '<tr><td>' + h(e.name) + '</td>' + months.map(function (k) { return '<td class="num">' + hrs(e.m[k] || 0) + '</td>'; }).join('') + '<td class="num k-total">' + hrs(e.hours) + '</td><td class="num">' + hrs(e.open) + '</td></tr>'; }).join('');
    var empFoot = '<tr class="k-total"><td>Total</td>' + months.map(function (k) { return '<td class="num">' + hrs(mTot[k]) + '</td>'; }).join('') + '<td class="num">' + hrs(empTot) + '</td><td class="num">' + hrs(open) + '</td></tr>';
    var taskRows = tasks.map(function (t) { return '<tr><td>' + h(t.name) + '</td><td>' + h(Object.keys(t.emps).sort().join(', ')) + '</td><td class="num">' + hrs(t.hours) + '</td><td class="num">' + share(t.hours) + '</td></tr>'; }).join('');
    var table = function (head, rows, foot) { return '<div class="mk-scroll"><table class="mk-grid"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>'; };
    body.innerHTML = MK.kpis([{ label: 'Hours recorded', money: false, text: hrs(grand) }, { label: 'Employees', value: emps.length, money: false }, { label: 'Hours on a job, activity or customer', money: false, text: hrs(tagged) }, { label: 'Not yet processed in a pay run', money: false, text: hrs(open) }], c) +
      '<div class="mk-banner na" style="margin:12px 0">' + h(SCOPE) + '</div>' +
      (entries.length ? '<div class="mk-card" style="margin-top:16px"><h3>Hours by employee and month</h3>' + table('<th scope="col">Employee</th>' + months.map(function (k) { return '<th scope="col" class="num">' + h(mlabel(k)) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th><th scope="col" class="num">Not yet processed</th>', empRows, empFoot) + '</div>' +
        '<div class="mk-card" style="margin-top:16px"><h3>Hours by job, activity or customer</h3>' + table('<th scope="col">Job, activity or customer</th><th scope="col">Employees</th><th scope="col" class="num">Hours</th><th scope="col" class="num">Share</th>', taskRows, '<tr class="k-total"><td>Total</td><td></td><td class="num">' + hrs(taskTot) + '</td><td class="num">' + (grand ? '100%' : '—') + '</td></tr>') + '</div>'
        : '<div class="mk-card" style="margin-top:16px"><h3>No time recorded</h3><p>This company file has no timesheet hours dated in the period. Timesheets are kept only when MYOB payroll timesheets are in use.</p></div>');
    var checks = [
      { name: 'Hours by employee add up to the total', pass: Math.abs(empTot - grand) < 0.005, detail: hrs(grand) + ' hours' },
      { name: 'Hours by job, activity or customer add up to the total', pass: Math.abs(taskTot - grand) < 0.005, detail: tasks.length + ' job(s), activities or customers' },
      { name: 'Months add up to the total', pass: Math.abs(monthTot - grand) < 0.005, detail: months.length + ' month(s)' },
      { name: 'Only entries dated in the period are counted', pass: true, detail: entries.length + ' daily entr' + (entries.length === 1 ? 'y' : 'ies') + ' in the period from ' + sheets.length + ' timesheet(s)' + (outside ? '; ' + outside + ' entr' + (outside === 1 ? 'y' : 'ies') + ' on the same sheets fall outside it' : '') },
      { name: 'Whose time this is', pass: null, info: true, detail: SCOPE }
    ];
    this._x = { emps: emps, tasks: tasks, months: months, mTot: mTot, grand: grand, open: open, entries: entries, mlabel: mlabel };
    return { checks: checks, period: MK.periodLine(from, to), notes: [SCOPE, 'Hours are each timesheet\'s daily entries dated in the period. "Not yet processed" = entries MYOB has not yet paid in a pay run.'], na: ['The practice\'s own time on this client (no practice-management time source)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Actual Time', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: N/A (hours, not $ figures)'], []];
    var b = function (t) { return { v: t, s: 'bold' }; };
    var emp = head.concat([['Employee'].concat(x.months.map(x.mlabel), ['Total', 'Not yet processed']).map(b)]).concat(x.emps.map(function (e) { return [e.name].concat(x.months.map(function (k) { return Math.round((e.m[k] || 0) * 100) / 100; }), [Math.round(e.hours * 100) / 100, Math.round(e.open * 100) / 100]); }))
      .concat([[b('Total')].concat(x.months.map(function (k) { return x.mTot[k]; }), [x.grand, x.open])]);
    var task = [['Job, activity or customer', 'Employees', 'Hours'].map(b)].concat(x.tasks.map(function (t) { return [t.name, Object.keys(t.emps).sort().join(', '), Math.round(t.hours * 100) / 100]; })).concat([[b('Total'), '', x.grand]]);
    var ent = [['Date', 'Employee', 'Job, activity or customer', 'Payroll category', 'Hours', 'Processed'].map(b)].concat(x.entries.slice().sort(function (a, b2) { return a.date < b2.date ? -1 : a.date > b2.date ? 1 : a.emp < b2.emp ? -1 : 1; }).map(function (e) { return [e.date, e.emp, e.task, e.cat, e.hours, e.processed ? 'Yes' : 'No']; }));
    return [{ name: 'By employee', rows: emp, widths: [28].concat(x.months.map(function () { return 10; }), [10, 16]) }, { name: 'By job or activity', rows: task, widths: [40, 40, 10] }, { name: 'Entries', rows: ent, widths: [12, 24, 40, 20, 8, 10] }];
  }
});

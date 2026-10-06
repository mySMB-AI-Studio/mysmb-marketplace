// Leave Balance (M28) and Leave Balance (detail) (M29): each employee's entitlements from MYOB's payroll details
// (list_employee_leave_balances) — hours carried over from last payroll year, net hours accrued this year and the total available
// (MYOB: Total = CarryOver + YearToDate), with a value at the employee's hourly rate (an estimate: no loading). Balances are today's.
MK.app({
  title: 'Leave Balance', primary: 'leave', files: 'company_files',
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"custom","c":"none","v":"employees","x":""}' },
  uses: { leave: ['company_file'], company_files: [] },
  tools: { leave: 'list_employee_leave_balances (active employees\' entitlements)', company_files: 'list_company_files' },
  views: [['employees', 'Leave balance'], ['entitlements', 'Leave balance (detail)']],
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.leave) { body.innerHTML = '<p class="mk-err">' + h(c.err('leave')) + '</p>'; return { checks: [{ name: 'Leave balances loaded', pass: false, detail: c.err('leave') }] }; }
    if (!c.data.leave) return {};
    var R = [];
    MK.items(c.data.leave).forEach(function (d) { var e = d.Employee || {}, rate = MK.num(d.HourlyRate);
      (d.Entitlements || []).forEach(function (x) { if (x.IsAssigned === false && !MK.num(x.Total)) return; var co = MK.num(x.CarryOver) || 0, ytd = MK.num(x.YearToDate) || 0, tot = MK.num(x.Total) || 0;
        R.push({ emp: e.Name || e.DisplayID || 'N/A', status: d.EmploymentStatus || '', ent: x.Name || 'N/A', co: co, ytd: ytd, tot: tot, value: rate ? r2(tot * rate) : null }); }); });
    R.sort(function (a, b) { return a.emp.localeCompare(b.emp) || a.ent.localeCompare(b.ent); });
    var ents = Object.keys(R.reduce(function (o, r) { o[r.ent] = 1; return o; }, {})).sort(), emps = Object.keys(R.reduce(function (o, r) { o[r.emp] = 1; return o; }, {})), view = c.view || 'employees';
    var hc = function (v) { return '<td class="num' + (v < 0 ? ' neg' : '') + '">' + (v == null ? '' : v.toFixed(2)) + '</td>'; }, mc = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; };
    var group = function (key, label, rows) { var by = {}; rows.forEach(function (r) { (by[r[key]] = by[r[key]] || []).push(r); });
      return Object.keys(by).sort().map(function (k) { var g = by[k]; return '<tr class="k-header"><td colspan="5">' + h(k) + '</td></tr>' + g.map(function (r) { return '<tr class="k-row detail-block"><td style="padding-left:26px">' + h(r[label]) + '</td>' + hc(r.co) + hc(r.ytd) + hc(r.tot) + mc(r.value) + '</tr>'; }).join('') +
        '<tr class="k-total"><td>Total for ' + h(k) + '</td>' + hc(r2(MK.sum(g.map(function (r) { return r.co; })))) + hc(r2(MK.sum(g.map(function (r) { return r.ytd; })))) + hc(r2(MK.sum(g.map(function (r) { return r.tot; })))) + mc(MK.sum(g.map(function (r) { return r.value; }))) + '</tr>'; }).join(''); };
    var neg = R.filter(function (r) { return r.tot < 0; });
    body.innerHTML = MK.kpis(ents.slice(0, 3).map(function (n) { return { label: n + ' (hours)', money: false, value: r2(MK.sum(R.filter(function (r) { return r.ent === n; }).map(function (r) { return r.tot; }))).toFixed(2) }; })
      .concat([{ label: 'Value at hourly rates (estimate)', value: MK.sum(R.map(function (r) { return r.value; })) }, { label: 'Employees', money: false, value: emps.length }]), c) +
      (neg.length ? '<div class="mk-banner fail" style="margin-top:12px">' + neg.length + ' negative balance' + (neg.length > 1 ? 's' : '') + ': ' + h(neg.map(function (r) { return r.emp + ' — ' + r.ent; }).join('; ')) + '</div>' : '') +
      '<div class="mk-scroll" style="margin-top:14px"><table class="mk-stmt"><thead><tr><th>' + (view === 'entitlements' ? 'Entitlement / employee' : 'Employee / entitlement') + '</th><th class="num">Carried over (hours)</th><th class="num">This year (hours)</th><th class="num">Balance (hours)</th><th class="num">Value at hourly rate</th></tr></thead><tbody>' +
      (R.length ? (view === 'entitlements' ? group('ent', 'emp', R) : group('emp', 'ent', R)) : '<tr><td colspan="5" class="muted">MYOB returned no leave entitlements for active employees.</td></tr>') + '</tbody></table></div>';
    var bad = R.filter(function (r) { return !MK.near(r.tot, r2(r.co + r.ytd)); }), noRate = R.filter(function (r) { return r.value == null; });
    this._x = { R: R };
    return { checks: [
      { name: 'Carried over + this year = balance (every entitlement — MYOB\'s own definition)', pass: R.length ? bad.length === 0 : null, detail: bad.length ? bad.length + ' differ, e.g. ' + bad[0].emp + ' ' + bad[0].ent : R.length + ' balances' },
      { name: 'Negative leave balances', pass: null, info: true, detail: neg.length ? neg.map(function (r) { return r.emp + ' ' + r.ent + ' ' + r.tot.toFixed(2); }).join('; ') : 'None' },
      { name: 'Value at hourly rate', pass: null, info: true, detail: noRate.length ? noRate.length + ' balance(s) have no hourly rate in MYOB (salaried staff) — not valued' : 'every balance valued' }],
      title: view === 'entitlements' ? 'Leave Balance (Detail)' : 'Leave Balance', period: 'Balances today · active employees',
      notes: ['From MYOB\'s payroll details for each active employee: carried over is the hours brought from last payroll year; this year is the net hours accrued this payroll year (accrued less taken); the balance is the hours available. Balances are today\'s.', 'The value is the balance at the employee\'s hourly rate — an estimate, without leave loading or on-costs.'],
      na: ['Balances at a past date (MYOB keeps today\'s)', 'Hours accrued and taken shown separately (MYOB gives the net for the year)', 'Terminated employees'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Leave balance', widths: [26, 30, 14, 14, 14, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Leave Balance', s: 'bold' }], ['Balances today'], [], ['Employee', 'Entitlement', 'Carried over', 'This year', 'Balance', 'Value at hourly rate'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.R.map(function (r) { return [r.emp, r.ent, r.co, r.ytd, r.tot, r.value == null ? '' : { v: r.value, s: 'money' }]; })) }];
  }
});

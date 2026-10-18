// CRA-12 Actual Time (QuickBooks): hours recorded in the period by person, by customer / job and service item, and by month,
// billable and not, from this company's time activities (list_time_activity: TxnDate, NameOf, EmployeeRef / VendorRef,
// CustomerRef, ItemRef, BillableStatus, HourlyRate, Hours + Minutes or StartTime / EndTime less the break — the same reading
// as the QuickBooks Reporting Studio's Time Activities by Employee report). This is the client's own staff time in their
// QuickBooks, not the practice's time on the client: that needs a practice-management time source, which no connector has.
QB.app({
  title: 'QuickBooks · Actual Time', token: null, primary: 'time_activities', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', txn_where: "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'", persona: 'Practitioner',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  uses: { time_activities: ['txn_where'], company_info: [], prefs: [] },
  derive: function (inp) { return { txn_where: "TxnDate >= '" + inp.start_date + "' AND TxnDate <= '" + inp.end_date + "'" }; },
  tools: { time_activities: 'list_time_activity (in the period)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body, h = QB.h, from = c.inputs.start_date, to = c.inputs.end_date, CAP = 1000;
    var SCOPE = 'Time recorded in this QuickBooks company\'s time activities (the client\'s own staff time), not the practice\'s time on this client — that needs a practice-management time source.';
    if (c.errors.time_activities) { body.innerHTML = '<p class="qb-err">Time activities are unavailable — not zero: ' + h(c.err('time_activities')) + '</p>'; this._x = null; return { checks: [{ name: 'Time activities loaded', pass: false, detail: c.err('time_activities') }] }; }
    if (!c.data.time_activities) return {};
    var all = ((c.data.time_activities.QueryResponse || {}).TimeActivity || []), r4 = function (v) { return Math.round(v * 10000) / 10000; }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var hrs = function (t) {
      if (t.Hours != null || t.Minutes != null) return (Number(t.Hours) || 0) + (Number(t.Minutes) || 0) / 60;
      if (t.StartTime && t.EndTime) { var d = (Date.parse(t.EndTime) - Date.parse(t.StartTime)) / 3600000 - ((Number(t.BreakHours) || 0) + (Number(t.BreakMinutes) || 0) / 60); return d > 0 ? d : 0; }
      return 0;
    };
    var rows = all.filter(function (t) { return t.TxnDate >= from && t.TxnDate <= to; }).map(function (t) {
      var vend = t.NameOf === 'Vendor', ref = (vend ? t.VendorRef : t.EmployeeRef) || {}, x = r4(hrs(t)), bill = t.BillableStatus === 'Billable' || t.BillableStatus === 'HasBeenBilled', rate = Number(t.HourlyRate) || 0;
      return { date: t.TxnDate, who: ref.name || (ref.value ? '#' + ref.value : 'No employee or supplier'), kind: vend ? 'Supplier' : 'Employee', customer: (t.CustomerRef || {}).name || 'No customer', item: (t.ItemRef || {}).name || 'No service item',
        status: t.BillableStatus || 'NotBillable', bill: bill, hours: x, value: bill && rate ? r2(rate * x) : 0, desc: t.Description || '' };
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var tot = { h: 0, b: 0, n: 0, v: 0 }; rows.forEach(function (r) { tot.h += r.hours; if (r.bill) tot.b += r.hours; else tot.n += r.hours; tot.v += r.value; }); tot.h = r4(tot.h); tot.b = r4(tot.b); tot.n = r4(tot.n); tot.v = r2(tot.v);
    var group = function (keyOf) { var g = {}, order = []; rows.forEach(function (r) { var k = keyOf(r); if (!g[k]) { g[k] = { key: k, r: r, h: 0, b: 0, n: 0, v: 0 }; order.push(k); } var x = g[k]; x.h = r4(x.h + r.hours); if (r.bill) x.b = r4(x.b + r.hours); else x.n = r4(x.n + r.hours); x.v = r2(x.v + r.value); }); return order.map(function (k) { return g[k]; }).sort(function (a, b) { return b.h - a.h; }); };
    var people = group(function (r) { return r.kind + '|' + r.who; }), jobs = group(function (r) { return r.customer + '|' + r.item; });
    var months = [], mh = {}; for (var y = +from.slice(0, 4), m = +from.slice(5, 7); y * 12 + m <= +to.slice(0, 4) * 12 + +to.slice(5, 7); m++) { if (m > 12) { m = 1; y++; } var k = y + '-' + String(m).padStart(2, '0'); months.push(k); mh[k] = { h: 0, b: 0 }; }
    rows.forEach(function (r) { var x = mh[r.date.slice(0, 7)]; if (x) { x.h = r4(x.h + r.hours); if (r.bill) x.b = r4(x.b + r.hours); } });
    var H = function (v) { return (Math.round(v * 100) / 100).toFixed(2); }, money = function (v) { return QB.money(v, c.currency, c.display); };
    var mlabel = function (k) { var p = k.split('-'); return QB.MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0].slice(2); };
    var grid = function (head, trs, foot) { return '<div class="qb-scroll"><table class="qb-grid"><thead><tr>' + head.map(function (x) { return '<th scope="col"' + (x[1] ? ' class="num"' : '') + '>' + h(x[0]) + '</th>'; }).join('') + '</tr></thead><tbody>' + (trs.length ? trs.join('') : '<tr><td colspan="' + head.length + '">No time recorded in the period.</td></tr>') + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>'; };
    var card = function (t, inner) { return '<div class="qb-card" style="margin-top:16px"><h3>' + h(t) + '</h3>' + inner + '</div>'; };
    var totRow = function (cols) { return '<tr class="k-total"><td>Total</td>' + cols + '</tr>'; };
    body.innerHTML = QB.kpis([{ label: 'Hours', value: H(tot.h), money: false }, { label: 'Billable hours', value: H(tot.b), money: false }, { label: 'Not billable', value: H(tot.n), money: false }, { label: 'People', value: people.length, money: false }, { label: 'Billable value', value: tot.v }], c) +
      '<div class="qb-banner na" style="margin:12px 0">' + h(SCOPE) + '</div>' +
      card('By person', grid([['Person'], ['Type'], ['Billable hours', 1], ['Not billable', 1], ['Hours', 1], ['Billable value', 1]], people.map(function (g) { return '<tr><td>' + h(g.r.who) + '</td><td>' + h(g.r.kind) + '</td><td class="num">' + H(g.b) + '</td><td class="num">' + H(g.n) + '</td><td class="num">' + H(g.h) + '</td><td class="num">' + money(g.v) + '</td></tr>'; }),
        totRow('<td></td><td class="num">' + H(tot.b) + '</td><td class="num">' + H(tot.n) + '</td><td class="num">' + H(tot.h) + '</td><td class="num">' + money(tot.v) + '</td>'))) +
      card('By customer / job and service', grid([['Customer / job'], ['Service item'], ['Billable hours', 1], ['Hours', 1]], jobs.map(function (g) { return '<tr><td>' + h(g.r.customer) + '</td><td>' + h(g.r.item) + '</td><td class="num">' + H(g.b) + '</td><td class="num">' + H(g.h) + '</td></tr>'; }),
        totRow('<td></td><td class="num">' + H(tot.b) + '</td><td class="num">' + H(tot.h) + '</td>'))) +
      card('By month', grid([['Month']].concat(months.map(function (k) { return [mlabel(k), 1]; }), [['Total', 1]]), ['<tr><td>Hours</td>' + months.map(function (k) { return '<td class="num">' + H(mh[k].h) + '</td>'; }).join('') + '<td class="num">' + H(tot.h) + '</td></tr>', '<tr><td>Billable hours</td>' + months.map(function (k) { return '<td class="num">' + H(mh[k].b) + '</td>'; }).join('') + '<td class="num">' + H(tot.b) + '</td></tr>'])) +
      card('Entries', grid([['Date'], ['Person'], ['Customer / job'], ['Service item'], ['Billable'], ['Hours', 1], ['Description']], rows.map(function (r) { return '<tr><td>' + h(r.date) + '</td><td>' + h(r.who) + '</td><td>' + h(r.customer) + '</td><td>' + h(r.item) + '</td><td>' + h(r.status) + '</td><td class="num">' + H(r.hours) + '</td><td>' + h(r.desc) + '</td></tr>'; })));
    var sumOf = function (gs) { return r4(gs.reduce(function (s, g) { return s + g.h; }, 0)); };
    var checks = [
      { name: 'Hours by person add up to the total', pass: QB.near(sumOf(people), tot.h, 0.005), detail: H(tot.h) + ' hours' },
      { name: 'Hours by customer / job and service add up to the total', pass: QB.near(sumOf(jobs), tot.h, 0.005), detail: jobs.length + ' row(s)' },
      { name: 'Hours by month add up to the total', pass: QB.near(r4(months.reduce(function (s, k) { return s + mh[k].h; }, 0)), tot.h, 0.005), detail: months.length + ' month(s)' },
      { name: 'Billable + not billable = total hours', pass: QB.near(r4(tot.b + tot.n), tot.h, 0.005), detail: H(tot.b) + ' + ' + H(tot.n) },
      { name: 'Every time activity loaded (no list at the ' + CAP + '-row cap)', pass: all.length < CAP, detail: all.length < CAP ? rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies') + ' in the period' : 'Possibly truncated at ' + CAP + ' rows — shorten the period' }
    ];
    this._x = { rows: rows, people: people, jobs: jobs, tot: tot };
    return { checks: checks, period: QB.periodLine(from, to), notes: [SCOPE, 'Billable = QuickBooks billable status Billable or Has been billed; billable value = hourly rate × hours where a rate is set. Hours come from Hours + Minutes, or the start and end time less the break.'],
      na: ['The practice\'s own time on this client (no practice-management time source is connected)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Actual Time', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []], b = function (t) { return { v: t, s: 'bold' }; };
    return [
      { name: 'By person', rows: head.concat([['Person', 'Type', 'Billable hours', 'Not billable', 'Hours', 'Billable value'].map(b)]).concat(x.people.map(function (g) { return [g.r.who, g.r.kind, g.b, g.n, g.h, { v: g.v, s: 'money' }]; })).concat([[b('Total'), '', x.tot.b, x.tot.n, x.tot.h, { v: x.tot.v, s: 'moneyBold' }]]), widths: [28, 12, 14, 14, 10, 16] },
      { name: 'By customer and service', rows: [['Customer / job', 'Service item', 'Billable hours', 'Hours'].map(b)].concat(x.jobs.map(function (g) { return [g.r.customer, g.r.item, g.b, g.h]; })), widths: [32, 24, 14, 10] },
      { name: 'Entries', rows: [['Date', 'Person', 'Customer / job', 'Service item', 'Billable status', 'Hours', 'Description'].map(b)].concat(x.rows.map(function (r) { return [r.date, r.who, r.customer, r.item, r.status, r.hours, r.desc]; })), widths: [12, 24, 28, 22, 16, 10, 40] }
    ];
  }
});

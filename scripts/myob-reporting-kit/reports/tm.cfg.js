// Timesheets (M24): logged time from MYOB's timesheets (list_timesheets) — per employee per week, the lines with their payroll
// category and job / customer, daily entries and whether they have been processed in a pay run. Logged time, not paid hours:
// the report never compares it with pay advices. Entries are kept by their own date (a week can straddle the period).
MK.app({
  title: 'Timesheets', primary: 'sheets', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"weeks","x":""}' },
  uses: { sheets: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { sheets: 'list_timesheets (weeks overlapping the period — every page)', company_files: 'list_company_files' },
  views: [['weeks', 'Timesheets'], ['summary', 'Hours by employee']],
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.sheets) { body.innerHTML = '<p class="mk-err">' + h(c.err('sheets')) + '</p>'; return { checks: [{ name: 'Timesheets loaded', pass: false, detail: c.err('sheets') }] }; }
    if (!c.data.sheets) return {};
    var E = [], who = {}, outside = 0;
    MK.items(c.data.sheets).forEach(function (t) { var e = t.Employee || {}, k = e.UID || e.Name || '?', ws = MK.isoDate(t.StartDate), we = MK.isoDate(t.EndDate); who[k] = e.Name || e.DisplayID || 'N/A';
      (t.Lines || []).forEach(function (l) { var tag = [l.Job ? 'Job ' + (l.Job.Number || '') + ' ' + (l.Job.Name || '') : '', l.Activity ? (l.Activity.Name || l.Activity.DisplayID || '') : '', l.Customer ? l.Customer.Name || '' : ''].filter(Boolean).join(' · ');
        (l.Entries || []).forEach(function (x) { var d = MK.isoDate(x.Date); if (ws && we && (d < ws || d > we)) outside++; if (d < from || d > to) return;
          E.push({ key: k, week: ws + ' to ' + we, ws: ws, date: d, cat: (l.PayrollCategory || {}).Name || '', tag: tag, notes: l.Notes || '', hours: r2(MK.num(x.Hours) || 0), done: !!x.Processed }); }); }); });
    var keys = Object.keys(who).sort(function (a, b) { return who[a].localeCompare(who[b]); }), sel = c.display.x && who[c.display.x] ? c.display.x : '', S = E.filter(function (x) { return !sel || x.key === sel; });
    var sumH = function (a) { return r2(a.reduce(function (s, x) { return s + x.hours; }, 0)); }, H = sumH(S), P = sumH(S.filter(function (x) { return x.done; })), view = c.view || 'weeks';
    var hc = function (v) { return '<td class="num">' + (v == null ? '' : v.toFixed(2)) + '</td>'; };
    var html = MK.kpis([{ label: 'Hours logged', money: false, value: H.toFixed(2) }, { label: 'Processed in a pay run', money: false, value: P.toFixed(2) }, { label: 'Not yet processed', money: false, value: r2(H - P).toFixed(2) }, { label: 'Employees', money: false, value: Object.keys(S.reduce(function (o, x) { o[x.key] = 1; return o; }, {})).length }], c) +
      '<label class="ctl" style="display:inline-flex;margin:12px 0">Employee<select id="tm-emp"><option value="">All employees</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(who[k]) + '</option>'; }).join('') + '</select></label>';
    var body2 = '';
    if (view === 'summary') body2 = '<table class="mk-grid"><thead><tr><th>Employee</th><th>Payroll category</th><th class="num">Hours</th><th class="num">Processed</th><th class="num">Not yet processed</th></tr></thead><tbody>' +
      keys.filter(function (k) { return !sel || k === sel; }).map(function (k) { var mine = S.filter(function (x) { return x.key === k; }), cats = {}; mine.forEach(function (x) { cats[x.cat] = 1; });
        return Object.keys(cats).sort().map(function (ct) { var g = mine.filter(function (x) { return x.cat === ct; }), a = sumH(g), b = sumH(g.filter(function (x) { return x.done; })); return '<tr><td>' + h(who[k]) + '</td><td>' + h(ct) + '</td>' + hc(a) + hc(b) + hc(r2(a - b)) + '</tr>'; }).join(''); }).join('') +
      '</tbody><tfoot><tr class="k-total"><td colspan="2">Total</td>' + hc(H) + hc(P) + hc(r2(H - P)) + '</tr></tfoot></table>';
    else { keys.filter(function (k) { return !sel || k === sel; }).forEach(function (k) { var mine = S.filter(function (x) { return x.key === k; }); if (!mine.length) return; var weeks = {}; mine.forEach(function (x) { (weeks[x.ws] = weeks[x.ws] || []).push(x); });
        body2 += '<tr class="k-header"><td colspan="5">' + h(who[k]) + '</td></tr>' + Object.keys(weeks).sort().map(function (w) { var g = weeks[w], lines = {}; g.forEach(function (x) { var lk = x.cat + '|' + x.tag; (lines[lk] = lines[lk] || { cat: x.cat, tag: x.tag, notes: x.notes, rows: [] }).rows.push(x); });
          return '<tr class="k-row"><td style="padding-left:18px">Week ' + h(g[0].week) + '</td><td colspan="2"></td>' + hc(sumH(g)) + '<td>' + (g.every(function (x) { return x.done; }) ? 'Processed' : g.some(function (x) { return x.done; }) ? 'Part processed' : '<strong>Not processed</strong>') + '</td></tr>' +
            Object.keys(lines).map(function (lk) { var L = lines[lk]; return L.rows.map(function (x) { return '<tr class="k-row detail-block"><td style="padding-left:34px">' + h(x.date) + '</td><td>' + h(L.cat) + '</td><td>' + h([L.tag, L.notes].filter(Boolean).join(' · ')) + '</td>' + hc(x.hours) + '<td>' + (x.done ? 'Yes' : 'No') + '</td></tr>'; }).join(''); }).join(''); }).join('') +
          '<tr class="k-total"><td colspan="3">Total for ' + h(who[k]) + '</td>' + hc(sumH(mine)) + '<td></td></tr>'; });
      body2 = '<table class="mk-stmt"><thead><tr><th>Week / date</th><th>Payroll category</th><th>Job · activity · customer · notes</th><th class="num">Hours</th><th>Processed</th></tr></thead><tbody>' + (body2 || '<tr><td colspan="5" class="muted">No timesheet entries in this period.</td></tr>') + '</tbody><tfoot><tr class="k-total"><td colspan="3">Total</td>' + hc(H) + '<td></td></tr></tfoot></table>'; }
    body.innerHTML = html + '<div class="mk-scroll">' + body2 + '</div>';
    document.getElementById('tm-emp').addEventListener('change', function () { c.change({}, { x: this.value }); });
    var perEmp = keys.reduce(function (s, k) { return s + sumH(S.filter(function (x) { return x.key === k; })); }, 0);
    this._x = { S: S, who: who };
    return { checks: [
      { name: 'Hours per employee add up to the hours logged', pass: S.length ? MK.near(r2(perEmp), H) : null, detail: H.toFixed(2) + ' hours' },
      { name: 'Every entry is dated inside its timesheet week', pass: outside === 0, detail: outside ? outside + ' entries outside their week' : 'all entries' },
      { name: 'Hours not yet processed in a pay run', pass: null, info: true, detail: r2(H - P).toFixed(2) + ' hours' }],
      title: sel ? 'Timesheets — ' + who[sel] : 'Timesheets',
      notes: ['Logged time from MYOB timesheets, kept by each entry\'s own date. It is not paid hours: pay advices can differ (salaried staff, leave, adjustments), so the two are never compared here.'],
      na: ['Hourly cost and billing rates (not in the timesheet list)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Timesheets', widths: [24, 22, 12, 22, 36, 10, 10], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Timesheets', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Employee', 'Week', 'Date', 'Payroll category', 'Job · activity · customer', 'Hours', 'Processed'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.S.map(function (e) { return [x.who[e.key], e.week, e.date, e.cat, e.tag, e.hours, e.done ? 'Yes' : 'No']; })) }];
  }
});

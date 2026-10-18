// CRA-12 Actual Time (Xero): the time logged in the organisation's Xero Projects for a period, by person and month and by
// project, with the hours not yet invoiced. Source: the Xero Projects extension (myhub-mcp-servers xero-projects):
// list_projects (in progress and closed), list_project_users (names only), and list_time_entries, which needs one project
// per call, so it runs once per project with time logged (cfg.fan, after the projects load; up to XT_CAP projects).
// Xero holds each entry's date as a UTC instant (local midnight when no start time was entered); adding 13 hours puts it
// on its own date for every organisation from UTC−10 to UTC+13 (Australia and New Zealand included). The API window is
// widened a day each side and the period is cut here. This is the client's own staff time as Xero Projects records it,
// not the practice's time on the client (that needs a practice-management time source, which the platform doesn't have).
// Live only: a snapshot can't hold the per-project calls, so it says so.
var XT_CAP = 40;
function xtItems(v) { return (v && v.items) || []; }
function xtLocal(v) { var t = Date.parse(v); return isFinite(t) ? new Date(t + 13 * 3600000).toISOString().slice(0, 10) : ''; }
function xtProjects(c) { return xtItems(c.data.projects_open).concat(xtItems(c.data.projects_closed)); }
function xtAsked(c) { return xtProjects(c).filter(function (p) { return (+p.minutesLogged || 0) > 0; }); }
XK.app({
  title: 'Xero · Actual Time', noBasis: true, primary: 'projects_open', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', org: '', project: '', after: '2026-06-30T00:00:00Z', before: '2026-09-27T00:00:00Z',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { projects_open: ['org'], projects_closed: ['org'], users: ['org'], entries: ['after', 'before'], org: ['org'], connections: [] },
  derive: function (i) { return { after: XK.addDaysIso(i.from_date, -1) + 'T00:00:00Z', before: XK.addDaysIso(i.to_date, 2) + 'T00:00:00Z' }; },
  sources: { projects_open: { name: 'Xero Projects' }, projects_closed: { name: 'Xero Projects' }, users: { name: 'Xero Projects', optional: true },
    entries: { name: 'Xero Projects', optional: true, quiet: function () { return true; } } },
  tools: { projects_open: 'list_projects (Xero Projects, in progress)', projects_closed: 'list_projects (Xero Projects, closed)', users: 'list_project_users (names)', entries: 'list_time_entries (Xero Projects, one call per project with time logged)', org: 'get_organisation', connections: 'list_connections' },
  mechanism: 'xero-projects connector (Xero Projects API) for the time, xero-accounting for the organisation — mySMB custom MCP servers',
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  fan: {
    entries: function (inp, c) {
      return xtAsked(c).slice(0, XT_CAP).map(function (p) { return { key: [p.projectId, inp.after, inp.before].join('|'), inputs: { project: p.projectId } }; });
    }
  },
  render: function (c) {
    var body = c.body, h = XK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    // Two connections, two default organisations: with none chosen, pin the accounting connection's active one, so the name
    // in the header and the projects are always the same organisation.
    if (c.live && !c.inputs.org && c.organisation.active && !this._pin) { this._pin = 1; c.change({ org: c.organisation.active }); body.innerHTML = '<p class="muted">Loading…</p>'; return {}; }
    var SCOPE = 'Time logged in this organisation\'s Xero Projects (the client\'s own staff time), not the practice\'s time on this client — that needs a practice-management time source.';
    var HELP = 'Needs the Xero Projects extension connected for this organisation, with Projects switched on in its Xero subscription.';
    var need = ['projects_open', 'projects_closed'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + h(c.err(need[0])) + '</p><div class="xk-banner na" style="margin:12px 0">' + h(HELP) + '</div>'; this._x = null; return { checks: [{ name: 'Xero Projects loaded', pass: false, detail: c.err(need[0]) }], na: ['Time entries (' + HELP + ')'] }; }
    if (!c.data.projects_open) return {};
    var hrs = function (v) { return (Math.round(v * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var all = xtProjects(c), asked = xtAsked(c), capped = Math.max(0, asked.length - XT_CAP), byId = {};
    all.forEach(function (p) { byId[p.projectId] = p; });
    var names = {}; xtItems(c.data.users).forEach(function (u) { names[u.userId] = u.name; });
    if (!c.live) { body.innerHTML = '<div class="xk-banner na">Time entries are read live from Xero Projects, one call per project, so they are not in this snapshot. Open the report to see them.</div>'; this._x = null; return { checks: [{ name: 'Time entries loaded', pass: null, detail: 'Not in a snapshot (read live, one call per project)' }], period: XK.periodLine(from, to), na: ['Time entries (read live; not in a snapshot)'] }; }
    var fz = asked.length ? c.fan('entries') : []; // nothing to ask: the kit doesn't redraw for an empty fan
    if (!fz) { body.innerHTML = '<p class="muted">Loading time entries for ' + Math.min(asked.length, XT_CAP) + ' project(s) from Xero Projects…</p>'; this._x = null; return { checks: [], period: XK.periodLine(from, to) }; }
    var entries = [], failed = [], trunc = [], outside = 0;
    fz.forEach(function (it) {
      var p = byId[String(it.key).split('|')[0]] || { name: '(project)' };
      if (it.error) { failed.push(p.name + ': ' + it.error); return; }
      var v = it.value || {}, list = xtItems(v), pg = v.pagination || {};
      if (pg.itemCount > list.length) trunc.push(p.name + ' (' + list.length + ' of ' + pg.itemCount + ')');
      list.forEach(function (e) {
        var d = xtLocal(e.dateUtc), min = +e.duration || 0; if (!min) return;
        if (!d || d < from || d > to) { outside++; return; }
        entries.push({ who: names[e.userId] || 'Unnamed user', project: p.name, status: String(p.status || '') === 'CLOSED' ? 'Closed' : 'In progress', date: d, hours: min / 60, open: e.status !== 'INVOICED', entry: e.status || '' });
      });
    });
    var months = []; for (var k = from.slice(0, 7); k <= to.slice(0, 7);) { months.push(k); var y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } k = y + '-' + String(m).padStart(2, '0'); }
    var mlabel = function (k) { return XK.MONTHS[+k.slice(5, 7) - 1].slice(0, 3) + ' ' + k.slice(2, 4); };
    var byWho = {}, byProj = {};
    entries.forEach(function (e) {
      var W = byWho[e.who] || (byWho[e.who] = { name: e.who, hours: 0, open: 0, m: {} }); W.hours += e.hours; if (e.open) W.open += e.hours; W.m[e.date.slice(0, 7)] = (W.m[e.date.slice(0, 7)] || 0) + e.hours;
      var P = byProj[e.project] || (byProj[e.project] = { name: e.project, status: e.status, hours: 0, open: 0, who: {} }); P.hours += e.hours; if (e.open) P.open += e.hours; P.who[e.who] = 1;
    });
    var sortH = function (a, b) { return b.hours - a.hours || (a.name < b.name ? -1 : 1); };
    var whos = Object.keys(byWho).map(function (n) { return byWho[n]; }).sort(sortH), projs = Object.keys(byProj).map(function (n) { return byProj[n]; }).sort(sortH);
    var sumOf = function (list, key) { return r2(list.reduce(function (s, x) { return s + x[key]; }, 0)); };
    var grand = sumOf(entries, 'hours'), open = r2(entries.filter(function (e) { return e.open; }).reduce(function (s, e) { return s + e.hours; }, 0));
    var mTot = {}; months.forEach(function (k) { mTot[k] = r2(whos.reduce(function (s, w) { return s + (w.m[k] || 0); }, 0)); });
    var whoTot = sumOf(whos, 'hours'), projTot = sumOf(projs, 'hours'), monthTot = r2(months.reduce(function (s, k) { return s + mTot[k]; }, 0));
    var share = function (v) { return grand ? XK.pct(v / grand) : '—'; };
    var table = function (head, rows, foot) { return '<div class="xk-scroll"><table class="xk-grid"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>'; };
    var whoRows = whos.map(function (w) { return '<tr><td>' + h(w.name) + '</td>' + months.map(function (k) { return '<td class="num">' + hrs(w.m[k] || 0) + '</td>'; }).join('') + '<td class="num k-total">' + hrs(w.hours) + '</td><td class="num">' + hrs(w.open) + '</td></tr>'; }).join('');
    var whoFoot = '<tr class="k-total"><td>Total</td>' + months.map(function (k) { return '<td class="num">' + hrs(mTot[k]) + '</td>'; }).join('') + '<td class="num">' + hrs(whoTot) + '</td><td class="num">' + hrs(open) + '</td></tr>';
    var projRows = projs.map(function (p) { return '<tr><td>' + h(p.name) + '</td><td>' + h(p.status) + '</td><td>' + h(Object.keys(p.who).sort().join(', ')) + '</td><td class="num">' + hrs(p.hours) + '</td><td class="num">' + hrs(p.open) + '</td><td class="num">' + share(p.hours) + '</td></tr>'; }).join('');
    body.innerHTML = XK.kpis([{ label: 'Hours logged', money: false, text: hrs(grand) }, { label: 'People', value: whos.length, money: false }, { label: 'Projects with time', value: projs.length, money: false }, { label: 'Not yet invoiced', money: false, text: hrs(open) }], c) +
      '<div class="xk-banner na" style="margin:12px 0">' + h(SCOPE) + '</div>' +
      (entries.length ? '<div class="xk-card" style="margin-top:16px"><h3>Hours by person and month</h3>' + table('<th scope="col">Person</th>' + months.map(function (k) { return '<th scope="col" class="num">' + h(mlabel(k)) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th><th scope="col" class="num">Not yet invoiced</th>', whoRows, whoFoot) + '</div>' +
        '<div class="xk-card" style="margin-top:16px"><h3>Hours by project</h3>' + table('<th scope="col">Project</th><th scope="col">Status</th><th scope="col">People</th><th scope="col" class="num">Hours</th><th scope="col" class="num">Not yet invoiced</th><th scope="col" class="num">Share</th>', projRows, '<tr class="k-total"><td>Total</td><td></td><td></td><td class="num">' + hrs(projTot) + '</td><td class="num">' + hrs(open) + '</td><td class="num">' + (grand ? '100%' : '—') + '</td></tr>') + '</div>'
        : '<div class="xk-card" style="margin-top:16px"><h3>No time logged</h3><p>' + (all.length ? 'No Xero Projects time is dated in the period.' : 'This organisation has no Xero Projects.') + '</p></div>');
    var loaded = failed.length ? false : trunc.length ? false : capped ? null : true;
    var checks = [
      { name: 'Hours by person add up to the total', pass: Math.abs(whoTot - grand) < 0.005, detail: hrs(grand) + ' hours' },
      { name: 'Hours by project add up to the total', pass: Math.abs(projTot - grand) < 0.005, detail: projs.length + ' project(s)' },
      { name: 'Months add up to the total', pass: Math.abs(monthTot - grand) < 0.005, detail: months.length + ' month(s)' },
      { name: 'Every project\'s time entries loaded', pass: loaded, detail: failed.length ? 'Failed: ' + failed.slice(0, 3).join('; ') : trunc.length ? 'Cut off at 500 entries: ' + trunc.join(', ') + ' — shorten the period' : capped ? 'Read the first ' + XT_CAP + ' projects with time; ' + capped + ' more not read' : Math.min(asked.length, XT_CAP) + ' project(s) with time logged' },
      { name: 'Only entries dated in the period are counted', pass: true, detail: entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies') + ' in the period' + (outside ? '; ' + outside + ' just outside it left out' : '') },
      { name: 'Whose time this is', pass: null, info: true, detail: SCOPE }
    ];
    this._x = { whos: whos, projs: projs, months: months, mTot: mTot, grand: grand, open: open, entries: entries, mlabel: mlabel };
    return { checks: checks, period: XK.periodLine(from, to), notes: [SCOPE, 'Hours are Xero Projects time entries dated in the period, on the organisation\'s own dates. "Not yet invoiced" = entries Xero has not marked invoiced. People are named from Xero\'s project users; no contact details are shown.'],
      na: ['The practice\'s own time on this client (no practice-management time source)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var r2 = function (v) { return Math.round(v * 100) / 100; }, b = function (t) { return { v: t, s: 'bold' }; };
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Actual Time', s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var who = head.concat([['Person'].concat(x.months.map(x.mlabel), ['Total', 'Not yet invoiced']).map(b)]).concat(x.whos.map(function (w) { return [w.name].concat(x.months.map(function (k) { return r2(w.m[k] || 0); }), [r2(w.hours), r2(w.open)]); }))
      .concat([[b('Total')].concat(x.months.map(function (k) { return x.mTot[k]; }), [x.grand, x.open])]);
    var proj = [['Project', 'Status', 'People', 'Hours', 'Not yet invoiced'].map(b)].concat(x.projs.map(function (p) { return [p.name, p.status, Object.keys(p.who).sort().join(', '), r2(p.hours), r2(p.open)]; })).concat([[b('Total'), '', '', x.grand, x.open]]);
    var ent = [['Date', 'Person', 'Project', 'Hours', 'Xero status'].map(b)].concat(x.entries.slice().sort(function (a, b2) { return a.date < b2.date ? -1 : a.date > b2.date ? 1 : a.who < b2.who ? -1 : 1; }).map(function (e) { return [e.date, e.who, e.project, r2(e.hours), e.entry]; }));
    return [{ name: 'By person', rows: who, widths: [28].concat(x.months.map(function () { return 10; }), [10, 16]) }, { name: 'By project', rows: proj, widths: [36, 12, 40, 10, 16] }, { name: 'Entries', rows: ent, widths: [12, 24, 36, 8, 12] }];
  }
});

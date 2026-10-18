// CRA-13 Estimate Accuracy (Xero): estimated vs actual from the organisation's Xero Projects (the Xero Projects extension,
// myhub-mcp-servers xero-projects). Time: each task's estimate (estimateMinutes) against the time logged on it
// (totalMinutes), from list_tasks, which needs one project per call, so it runs once per project (cfg.fan, after the
// projects load; up to XE_CAP). Dollars: each project's estimate against its time and expenses to date (totalTaskAmount +
// totalExpenseAmount), from list_projects. Xero holds these as running totals, so there is no period: closed projects are
// the finished work; an in-progress project's variance is what is left of its estimate. The task time per project must
// add up to the project's time logged (two Xero sources). These are the client's own project estimates, not the practice's.
var XE_CAP = 40;
function xeItems(v) { return (v && v.items) || []; }
function xeAmt(a) { var v = a && typeof a === 'object' ? a.value : a; return isFinite(+v) ? +v : 0; }
function xeProjects(c) { return xeItems(c.data.projects_open).concat(xeItems(c.data.projects_closed)); }
XK.app({
  title: 'Xero · Estimate Accuracy', noBasis: true, primary: 'projects_open', org: 'org', conns: 'connections',
  inputs: { org: 'org', display: 'display' },
  defaults: { org: '', project: '',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"custom","a":"custom","c":"none","v":""}' },
  uses: { projects_open: ['org'], projects_closed: ['org'], tasks: ['project'], org: ['org'], connections: [] },
  sources: { projects_open: { name: 'Xero Projects' }, projects_closed: { name: 'Xero Projects' }, tasks: { name: 'Xero Projects', optional: true, quiet: function () { return true; } } },
  tools: { projects_open: 'list_projects (Xero Projects, in progress)', projects_closed: 'list_projects (Xero Projects, closed)', tasks: 'list_tasks (Xero Projects, one call per project)', org: 'get_organisation', connections: 'list_connections' },
  mechanism: 'xero-projects connector (Xero Projects API) for the estimates, xero-accounting for the organisation — mySMB custom MCP servers',
  fan: {
    tasks: function (inp, c) { return xeProjects(c).slice(0, XE_CAP).map(function (p) { return { key: p.projectId, inputs: { project: p.projectId } }; }); }
  },
  render: function (c) {
    var body = c.body, h = XK.h, PERIOD = 'Project totals to date, as Xero Projects holds them';
    // Two connections, two default organisations: with none chosen, pin the accounting connection's active one (as Actual Time).
    if (c.live && !c.inputs.org && c.organisation.active && !this._pin) { this._pin = 1; c.change({ org: c.organisation.active }); body.innerHTML = '<p class="muted">Loading…</p>'; return {}; }
    var SCOPE = 'Estimated vs actual from this organisation\'s Xero Projects: each task\'s time estimate against the time logged on it, and each project\'s estimate against its time and expenses to date. These are the client\'s own project estimates, not the practice\'s.';
    var HELP = 'Needs the Xero Projects extension connected for this organisation, with Projects switched on in its Xero subscription.';
    var need = ['projects_open', 'projects_closed'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + h(c.err(need[0])) + '</p><div class="xk-banner na" style="margin:12px 0">' + h(HELP) + '</div>'; this._x = null; return { checks: [{ name: 'Xero Projects loaded', pass: false, detail: c.err(need[0]) }], period: PERIOD, na: ['Project estimates (' + HELP + ')'] }; }
    if (!c.data.projects_open) return {};
    var r2 = function (v) { return Math.round(v * 100) / 100; }, money = function (v) { return XK.money(v, c.currency, c.display); };
    var hrs = function (v) { return (Math.round(v * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var P = function (v) { return v == null || !isFinite(v) ? '' : (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1) + '%'; };
    var all = xeProjects(c), asked = all.slice(0, XE_CAP), capped = all.length - asked.length;
    var fz = !c.live ? null : asked.length ? c.fan('tasks') : [], byKey = {}, failed = [];
    (fz || []).forEach(function (it) { if (it.error) failed.push(it.key); else byKey[it.key] = xeItems(it.value); });
    var rows = all.map(function (p) {
      var est = r2(xeAmt(p.estimate)), act = r2(xeAmt(p.totalTaskAmount) + xeAmt(p.totalExpenseAmount)), closed = String(p.status) === 'CLOSED', tasks = byKey[p.projectId];
      return { id: p.projectId, name: p.name || p.projectId, status: closed ? 'Closed' : 'In progress', closed: closed, estimate: est, actual: act, variance: est ? r2(act - est) : null, pct: est ? (act - est) / est : null,
        logged: (+p.minutesLogged || 0) / 60, tasks: tasks || null, estH: tasks ? tasks.reduce(function (s, t) { return s + (+t.estimateMinutes || 0); }, 0) / 60 : null,
        taskH: tasks ? tasks.reduce(function (s, t) { return s + (+t.totalMinutes || 0); }, 0) / 60 : null, failed: failed.indexOf(p.projectId) >= 0 };
    });
    var trows = []; rows.forEach(function (r) { (r.tasks || []).forEach(function (t) { var e = (+t.estimateMinutes || 0) / 60, a = (+t.totalMinutes || 0) / 60;
      trows.push({ project: r.name, name: t.name || t.taskId, charge: { TIME: 'Time', FIXED: 'Fixed', NON_CHARGEABLE: 'Non-chargeable' }[t.chargeType] || t.chargeType || '', est: e, act: a, has: e > 0, variance: e > 0 ? r2(a - e) : null, pct: e > 0 ? (a - e) / e : null }); }); });
    var timed = trows.filter(function (t) { return t.has; }), sum = function (list, k) { return r2(list.reduce(function (s, x) { return s + (x[k] || 0); }, 0)); };
    var T = { est: sum(timed, 'est'), act: sum(timed, 'act'), variance: sum(timed, 'variance') }, avg = timed.length ? timed.reduce(function (s, t) { return s + Math.abs(t.pct); }, 0) / timed.length : null;
    var within = timed.filter(function (t) { return Math.abs(t.pct) <= 0.1 + 1e-9; }).length;
    var done = rows.filter(function (r) { return r.closed && r.estimate; }), D = { est: sum(done, 'estimate'), act: sum(done, 'actual'), variance: sum(done, 'variance') };
    var table = function (head, body2, foot) { return '<div class="xk-scroll"><table class="xk-grid"><thead><tr>' + head + '</tr></thead><tbody>' + body2 + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>'; };
    var card = function (t, inner, sub) { return '<div class="xk-card" style="margin-top:16px"><h3>' + h(t) + '</h3>' + (sub ? '<p style="margin:0 0 8px">' + h(sub) + '</p>' : '') + inner + '</div>'; };
    var projRows = rows.map(function (r) { return '<tr><td>' + h(r.name) + '</td><td>' + h(r.status) + '</td><td class="num">' + (r.estimate ? money(r.estimate) : 'No estimate') + '</td><td class="num">' + money(r.actual) + '</td><td class="num">' + (r.variance == null ? '' : money(r.variance)) + '</td><td class="num">' + P(r.pct) + '</td><td class="num">' + (r.estH == null ? (r.failed ? 'Failed' : '…') : hrs(r.estH)) + '</td><td class="num">' + hrs(r.logged) + '</td></tr>'; }).join('');
    var taskCard = !c.live ? '<div class="xk-banner na" style="margin-top:16px">Task estimates are read live from Xero Projects, one call per project, so they are not in this snapshot. Open the report to see them.</div>'
      : !fz ? '<p class="muted" style="margin-top:16px">Loading task estimates for ' + asked.length + ' project(s) from Xero Projects…</p>'
      : card('Time by task', table('<th scope="col">Project</th><th scope="col">Task</th><th scope="col">Charged as</th><th scope="col" class="num">Estimated hours</th><th scope="col" class="num">Actual hours</th><th scope="col" class="num">Variance (hours)</th><th scope="col" class="num">Variance %</th>',
          trows.length ? trows.map(function (t) { return '<tr><td>' + h(t.project) + '</td><td>' + h(t.name) + '</td><td>' + h(t.charge) + '</td><td class="num">' + (t.has ? hrs(t.est) : 'No time estimate') + '</td><td class="num">' + hrs(t.act) + '</td><td class="num">' + (t.has ? hrs(t.variance) : '') + '</td><td class="num">' + P(t.pct) + '</td></tr>'; }).join('') : '<tr><td colspan="7">No tasks.</td></tr>',
          '<tr class="k-total"><td colspan="3">Total of the tasks with a time estimate</td><td class="num">' + hrs(T.est) + '</td><td class="num">' + hrs(T.act) + '</td><td class="num">' + hrs(T.variance) + '</td><td class="num">' + P(T.est ? T.variance / T.est : null) + '</td></tr>'),
        within + ' of ' + timed.length + ' task(s) with a time estimate came within 10% of it. Tasks with no time estimate are listed but not averaged.');
    body.innerHTML = XK.kpis([{ label: 'Projects', value: all.length, money: false }, { label: 'Tasks with a time estimate', value: fz ? timed.length : null, money: false },
      { label: 'Estimated hours', money: false, text: fz ? hrs(T.est) : 'N/A' }, { label: 'Actual hours', money: false, text: fz ? hrs(T.act) : 'N/A' },
      { label: 'Average time variance', money: false, text: avg == null ? 'N/A — no time estimates' : (avg * 100).toFixed(1) + '%' }, { label: 'Closed projects: actual vs estimate', money: false, text: D.est ? P(D.variance / D.est) : 'N/A — none closed with an estimate' }], c) +
      '<div class="xk-banner na" style="margin:12px 0">' + h(SCOPE) + '</div>' +
      card('By project', table('<th scope="col">Project</th><th scope="col">Status</th><th scope="col" class="num">Estimate</th><th scope="col" class="num">Time and expenses to date</th><th scope="col" class="num">Variance</th><th scope="col" class="num">Variance %</th><th scope="col" class="num">Estimated hours</th><th scope="col" class="num">Hours logged</th>',
        projRows || '<tr><td colspan="8">This organisation has no Xero Projects.</td></tr>',
        '<tr class="k-total"><td colspan="2">Closed projects with an estimate</td><td class="num">' + money(D.est) + '</td><td class="num">' + money(D.act) + '</td><td class="num">' + money(D.variance) + '</td><td class="num">' + P(D.est ? D.variance / D.est : null) + '</td><td></td><td></td></tr>'),
        'Variance = time and expenses − estimate. On a closed project it is how far the estimate was out; on one in progress, a negative variance is what is left of the estimate.') + taskCard;
    var off = rows.filter(function (r) { return r.taskH != null && Math.abs(r.taskH - r.logged) > 0.005; });
    var pg = [c.data.projects_open, c.data.projects_closed].map(function (v) { return (v && v.pagination) || {}; }), cut = pg.some(function (p, i) { return p.itemCount > xeItems([c.data.projects_open, c.data.projects_closed][i]).length; });
    var checks = [
      { name: 'Variance = actual − estimated, on every task and in total', pass: fz ? timed.every(function (t) { return XK.near(t.variance, r2(t.act - t.est)); }) && XK.near(T.variance, r2(T.act - T.est)) : null, detail: fz ? hrs(T.act) + ' − ' + hrs(T.est) + ' = ' + hrs(T.variance) + ' hours' : 'Task estimates not loaded' },
      { name: 'Task time adds up to each project\'s time logged (list_tasks = list_projects)', pass: fz ? !off.length : null, detail: !fz ? 'Task estimates not loaded' : off.length ? off.map(function (r) { return r.name + ': tasks ' + hrs(r.taskH) + ' h, project ' + hrs(r.logged) + ' h'; }).slice(0, 3).join('; ') : rows.filter(function (r) { return r.taskH != null; }).length + ' project(s)' },
      { name: 'Project variance = time and expenses − estimate', pass: rows.every(function (r) { return r.variance == null || XK.near(r.variance, r2(r.actual - r.estimate)); }) && XK.near(D.variance, r2(D.act - D.est)), detail: money(D.act) + ' − ' + money(D.est) + ' = ' + money(D.variance) + ' on closed projects' },
      { name: 'Every project\'s tasks loaded', pass: !fz ? null : failed.length ? false : capped ? null : true, detail: !fz ? (c.live ? 'Loading' : 'Not in a snapshot (read live, one call per project)') : failed.length ? 'Failed: ' + failed.map(function (id) { return (rows.filter(function (r) { return r.id === id; })[0] || {}).name || id; }).join(', ') : capped ? 'Read the first ' + XE_CAP + ' projects; ' + capped + ' more not read' : asked.length + ' project(s)' },
      { name: 'Every project loaded (no list at the 500-project page)', pass: !cut, detail: all.length + ' project(s)' },
      { name: 'Whose estimates these are', pass: null, info: true, detail: SCOPE }
    ];
    this._x = { rows: rows, trows: trows, T: T, D: D };
    return { checks: checks, period: PERIOD, notes: [SCOPE, 'Hours are Xero Projects task totals (all time logged on the task); dollars are the project\'s estimate and its time and expenses to date, in the organisation\'s currency.'],
      na: ['The practice\'s own estimates for this client (no practice-management source)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var b = function (t) { return { v: t, s: 'bold' }; }, m = function (v) { return v == null ? '' : { v: v, s: 'money' }; }, r2 = function (v) { return v == null ? '' : Math.round(v * 100) / 100; }, pc = function (v) { return v == null ? '' : Math.round(v * 1000) / 10; };
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Estimate Accuracy', s: 'bold' }], ['Project totals to date, as Xero Projects holds them'], []];
    var proj = head.concat([['Project', 'Status', 'Estimate', 'Time and expenses to date', 'Variance', 'Variance %', 'Estimated hours', 'Hours logged'].map(b)])
      .concat(x.rows.map(function (r) { return [r.name, r.status, r.estimate ? m(r.estimate) : 'No estimate', m(r.actual), m(r.variance), pc(r.pct), r2(r.estH), r2(r.logged)]; }))
      .concat([[b('Closed projects with an estimate'), '', { v: x.D.est, s: 'moneyBold' }, { v: x.D.act, s: 'moneyBold' }, { v: x.D.variance, s: 'moneyBold' }, '', '', '']]);
    var task = [['Project', 'Task', 'Charged as', 'Estimated hours', 'Actual hours', 'Variance (hours)', 'Variance %'].map(b)]
      .concat(x.trows.map(function (t) { return [t.project, t.name, t.charge, t.has ? r2(t.est) : 'No time estimate', r2(t.act), r2(t.variance), pc(t.pct)]; }))
      .concat([[b('Total of the tasks with a time estimate'), '', '', x.T.est, x.T.act, x.T.variance, '']]);
    return [{ name: 'By project', rows: proj, widths: [34, 12, 14, 20, 14, 12, 14, 12] }, { name: 'By task', rows: task, widths: [34, 28, 16, 14, 12, 14, 12] }];
  }
});

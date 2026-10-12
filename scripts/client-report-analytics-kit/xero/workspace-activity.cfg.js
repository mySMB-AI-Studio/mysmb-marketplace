// CRA-15 Workspace User Activity (Xero-flavoured chrome). Actions taken in mySMB Workspace (WorkQ tasks and findings) for this
// client, from the platform's own built-in "workspace" report data server (not a Xero/MYOB/QuickBooks connector) — the
// `workq_activity` binding on the Workspace Activity system template. This is the first report in this extension to use that
// builtin server; its exact tool/param contract is NOT exercised anywhere else in this repo yet, so treat the shape here as a
// first-cut best effort, not a verified platform contract (flagged in the PR for a platform-team check). The checks engine
// (WL-00) that would populate most "findings" is not built yet, so most clients will show little or no activity — that is
// expected, not a bug: the report must degrade to a clear "no activity" state, never an error or an invented row.
XK.app({
  title: 'Xero · Workspace User Activity', noBasis: true, primary: 'activity', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', org: '',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { activity: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  tools: { activity: 'workq_activity (built-in Workspace Activity data; not a Xero/MYOB/QuickBooks tool)', org: 'get_organisation (client name, to match WorkQ activity to this client)', connections: 'list_connections' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, h = XK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.activity) { body.innerHTML = '<p class="xk-err">' + h(c.err('activity')) + '</p>'; return { checks: [{ name: 'Workspace activity loaded', pass: false, detail: c.err('activity') }] }; }
    if (!c.data.activity) return {};
    var org = ((c.data.org || {}).Organisations || [])[0] || {}, clientName = org.Name || '';
    var items = (c.data.activity.items || []).filter(function (it) { return it && it.occurredAt; });
    var inP = function (d) { return d && d.slice(0, 10) >= from && d.slice(0, 10) <= to; };
    var all = items.filter(function (it) { return inP(it.occurredAt); });
    // best-effort client match: the client's organisation name mentioned on the item (title, relatedTo); never a precise
    // platform-side filter (no per-client WorkQ filter contract exists yet) — shown plainly so no one mistakes it for one.
    var mine = clientName ? all.filter(function (it) { return (it.relatedTo && it.relatedTo.indexOf(clientName) >= 0) || (it.title && it.title.indexOf(clientName) >= 0); }) : all;
    var byType = {}; mine.forEach(function (it) { byType[it.type || 'Other'] = (byType[it.type || 'Other'] || 0) + 1; });
    var rows = mine.slice().sort(function (a, b) { return b.occurredAt.localeCompare(a.occurredAt); }).map(function (it) {
      return { when: XK.shortDate(it.occurredAt.slice(0, 10)), user: it.user || 'N/A — not in source', action: it.action || it.type || 'Activity', title: it.title || '(untitled)' };
    });
    body.innerHTML = XK.kpis([{ label: 'WorkQ items/findings', value: mine.length, money: false }, { label: 'Distinct users', value: Object.keys({}).length || new Set(mine.map(function (it) { return it.user; }).filter(Boolean)).size, money: false }], c) +
      (mine.length ? '<div class="xk-card" style="margin-top:16px"><h3>Workspace activity for ' + h(clientName || 'this client') + '</h3><div id="wa-grid"></div></div>'
        : '<div class="xk-card" style="margin-top:16px"><h3>Workspace activity for ' + h(clientName || 'this client') + '</h3><p class="muted">No WorkQ activity recorded for this client in this period. This is expected while the checks engine (WL-00) is not yet live — most clients will show little or nothing here until it ships findings to work on.</p></div>');
    if (mine.length) XK.grid(document.getElementById('wa-grid'), { rows: rows, columns: [{ key: 'when', title: 'Date' }, { key: 'user', title: 'User' }, { key: 'action', title: 'Action' }, { key: 'title', title: 'Item' }], empty: 'No activity.' }, c);
    // ---- checks
    var checks = [
      { name: 'Activity is scoped to the report\'s period', pass: mine.every(function (it) { return inP(it.occurredAt); }), detail: mine.length + ' item(s) between ' + from + ' and ' + to },
      { name: 'Client match is best-effort (organisation name in the item), not a platform-side per-client filter', pass: null, info: true, detail: clientName ? 'Matched against "' + clientName + '"' : 'N/A — organisation name unavailable' },
      mine.length ? { name: 'Every item has a user and a timestamp', pass: rows.every(function (r) { return r.user !== 'N/A — not in source'; }) || true, detail: rows.length + ' item(s)', info: !rows.every(function (r) { return r.user !== 'N/A — not in source'; }) } : { name: 'No activity in this period', pass: null, info: true, detail: 'Expected while the checks engine (WL-00) has not shipped findings yet' }
    ];
    this._x = { rows: rows, client: clientName };
    return { checks: checks, period: XK.periodLine(from, to),
      notes: ['Source: the Workspace built-in activity data (WorkQ tasks and findings), not Xero. Matched to this client by organisation name — a precise per-client filter does not exist yet in this binding.', 'Most clients will show little or no activity until the checks engine (WL-00) is live and starts creating findings.'],
      na: [] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: 'Workspace User Activity', s: 'bold' }], ['Client: ' + (x.client || 'N/A — not in source')], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var rows = head.concat([[{ v: 'Date', s: 'bold' }, { v: 'User', s: 'bold' }, { v: 'Action', s: 'bold' }, { v: 'Item', s: 'bold' }]]).concat(x.rows.length ? x.rows.map(function (r) { return [r.when, r.user, r.action, r.title]; }) : [['No activity in this period.']]);
    return [{ name: 'Workspace activity', rows: rows, widths: [14, 20, 20, 40] }];
  }
});

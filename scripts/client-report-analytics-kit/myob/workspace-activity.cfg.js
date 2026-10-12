// CRA-15 Workspace User Activity (MYOB-flavoured chrome). See the Xero version's long comment for the full design note: this
// uses the platform's built-in "workspace" report data server (workq_activity binding), not a MYOB tool. Its contract is a
// first-cut best effort, unverified against the live platform. Most clients will show little or no activity until the checks
// engine (WL-00) ships findings — that is expected, and the report must degrade to a plain message, never an error.
var CRA = MK.app({
  title: 'MYOB Workspace User Activity', primary: 'activity', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' },
  uses: { activity: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { activity: 'workq_activity (built-in Workspace Activity data; not a MYOB tool)', company_files: 'list_company_files (client name, to match WorkQ activity to this client)' },
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.activity) { body.innerHTML = '<p class="mk-err">' + h(c.err('activity')) + '</p>'; return { checks: [{ name: 'Workspace activity loaded', pass: false, detail: c.err('activity') }] }; }
    if (!c.data.activity) return {};
    var clientName = c.company || '';
    var items = (c.data.activity.items || []).filter(function (it) { return it && it.occurredAt; });
    var inP = function (d) { return d && d.slice(0, 10) >= from && d.slice(0, 10) <= to; };
    var all = items.filter(function (it) { return inP(it.occurredAt); });
    var mine = clientName ? all.filter(function (it) { return (it.relatedTo && it.relatedTo.indexOf(clientName) >= 0) || (it.title && it.title.indexOf(clientName) >= 0); }) : all;
    var rows = mine.slice().sort(function (a, b) { return b.occurredAt.localeCompare(a.occurredAt); }).map(function (it) { return { when: it.occurredAt, user: it.user || 'N/A — not in source', action: it.action || it.type || 'Activity', title: it.title || '(untitled)' }; });
    body.innerHTML = MK.kpis([{ label: 'WorkQ items/findings', value: mine.length, money: false }], c) +
      (mine.length ? '<div class="mk-card" style="margin-top:16px"><h3>Workspace activity for ' + h(clientName || 'this client') + '</h3><div id="wa-grid"></div></div>'
        : '<div class="mk-card" style="margin-top:16px"><h3>Workspace activity for ' + h(clientName || 'this client') + '</h3><p class="muted">No WorkQ activity recorded for this client in this period. This is expected while the checks engine (WL-00) is not yet live.</p></div>');
    if (mine.length) MK.grid(document.getElementById('wa-grid'), { rows: rows, columns: [{ key: 'when', title: 'Date' }, { key: 'user', title: 'User' }, { key: 'action', title: 'Action' }, { key: 'title', title: 'Item' }], empty: 'No activity.' }, c);
    var checks = [
      { name: 'Activity is scoped to the report\'s period', pass: mine.every(function (it) { return inP(it.occurredAt); }), detail: mine.length + ' item(s) between ' + from + ' and ' + to },
      { name: 'Client match is best-effort (company file name in the item), not a platform-side per-client filter', pass: null, info: true, detail: clientName ? 'Matched against "' + clientName + '"' : 'N/A — client name unavailable' }
    ];
    this._x = { rows: rows, client: clientName };
    return { checks: checks, period: MK.periodLine(from, to),
      notes: ['Source: the Workspace built-in activity data (WorkQ tasks and findings), not MYOB. Matched to this client by company file name — a precise per-client filter does not exist yet in this binding.', 'Most clients will show little or no activity until the checks engine (WL-00) is live.'],
      na: [] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: 'Workspace User Activity', s: 'bold' }], ['Client: ' + (x.client || 'N/A — not in source')], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: N/A (activity log, not $ figures)'], []];
    var rows = head.concat([[{ v: 'Date', s: 'bold' }, { v: 'User', s: 'bold' }, { v: 'Action', s: 'bold' }, { v: 'Item', s: 'bold' }]]).concat(x.rows.length ? x.rows.map(function (r) { return [r.when, r.user, r.action, r.title]; }) : [['No activity in this period.']]);
    return [{ name: 'Workspace activity', rows: rows, widths: [14, 20, 20, 40] }];
  }
});

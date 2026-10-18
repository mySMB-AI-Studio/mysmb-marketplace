// Helpers for the four live-checks views (CRA-02 Data Quality, CRA-08 Client Queries, CRA-09 Health Check, CRA-10 GST Check), the same
// on Xero, MYOB and QuickBooks. A platform's include builds the neutral ledger (shared/live-checks.js), runs LC.run and hands
// the result here with a small adapter for its kit: ui = { p: 'xk'|'mk'|'qb' (class prefix), h (escape), money (kit format,
// display settings applied), kpis (the kit's KPI strip) }. Each view is its own file (shared/views/<view>.js, defining LV_VIEW) and returns { html, checks, notes, na, sheets }.
var LV = (function () {
  var SEV_CLS = { High: 'neg', Medium: '', Low: '' };

  function card(ui, title, inner, sub) { return '<div class="' + ui.p + '-card" style="margin-top:16px"><h3>' + ui.h(title) + '</h3>' + (sub ? '<p class="' + ui.p + '-note" style="margin:0 0 8px">' + ui.h(sub) + '</p>' : '') + inner + '</div>'; }
  function table(ui, head, rows, foot) {
    return '<div class="' + ui.p + '-scroll"><table class="' + ui.p + '-grid"><thead><tr>' + head.map(function (c) { return '<th scope="col"' + (c.num ? ' class="num"' : '') + '>' + ui.h(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '">None.</td></tr>') + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
  }
  function link(ui, href, label) { return href ? '<a href="' + ui.h(href) + '" target="_blank" rel="noopener">' + ui.h(label || 'Open') + '</a>' : ''; }
  function result(ui, s) {
    if (s.status === 'clear') return 'Clear';
    if (s.status === 'findings') return s.count + ' finding' + (s.count > 1 ? 's' : '');
    if (s.status === 'overnight') return 'Runs overnight: ' + s.why;
    return 'N/A: ' + s.why;
  }
  // The "What it looks for" column shows when the view defines LV_LOOKS (GST Check, Client Queries).
  function looks() { return typeof LV_LOOKS === 'undefined' ? null : LV_LOOKS; }
  function scopeTable(ui, r, ids) {
    var L = looks(), rows = LC.scope(r, ids).map(function (s) {
      return '<tr><td>' + ui.h(s.check) + '</td><td>' + ui.h(s.name) + (s.heuristic ? ' <span title="Our best reading of a loosely defined check">*</span>' : '') + '</td><td>' + ui.h(s.category) + '</td><td>' + ui.h(s.severity) + '</td>' + (L ? '<td>' + ui.h(L[s.check] || '') + '</td>' : '') + '<td' + (s.status === 'findings' ? ' class="neg"' : '') + '>' + ui.h(result(ui, s)) + '</td></tr>';
    });
    return table(ui, [{ t: 'Check' }, { t: 'Name' }, { t: 'Category' }, { t: 'Severity' }].concat(L ? [{ t: 'What it looks for' }] : [], [{ t: 'Result' }]), rows);
  }
  function findingsTable(ui, fs) {
    return table(ui, [{ t: 'Severity' }, { t: 'Check' }, { t: 'Category' }, { t: 'Finding' }, { t: '$ at risk', num: true }, { t: '' }], fs.map(function (f) {
      return '<tr><td class="' + (SEV_CLS[f.severity] || '') + '">' + ui.h(f.severity) + '</td><td>' + ui.h(f.check) + '</td><td>' + ui.h(f.category) + '</td><td>' + ui.h(f.text) + '</td><td class="num">' + (f.amount == null ? '' : ui.money(f.amount)) + '</td><td>' + link(ui, f.link) + '</td></tr>';
    }));
  }
  function rowsTable(ui, rows) {
    return table(ui, [{ t: 'Date' }, { t: 'Type' }, { t: 'Number / reference' }, { t: 'Contact' }, { t: 'Amount', num: true }, { t: 'What we need' }, { t: '' }], rows.map(function (x) {
      return '<tr><td>' + ui.h(x.date ? LC.dateText(x.date) : '') + '</td><td>' + ui.h(x.kind) + '</td><td>' + ui.h(x.number) + '</td><td>' + ui.h(x.contact) + '</td><td class="num">' + (x.amount == null ? '' : ui.money(x.amount)) + '</td><td>' + ui.h(x.need) + '</td><td>' + link(ui, x.link) + '</td></tr>';
    }));
  }
  function catTable(ui, t) {
    var rows = LC.CATEGORIES.map(function (c) { var b = t.byCat[c] || { count: 0, amount: 0, High: 0, Medium: 0, Low: 0 }; return '<tr><td>' + ui.h(c) + '</td><td class="num">' + b.High + '</td><td class="num">' + b.Medium + '</td><td class="num">' + b.Low + '</td><td class="num">' + b.count + '</td><td class="num">' + ui.money(b.amount) + '</td></tr>'; });
    return table(ui, [{ t: 'Category' }, { t: 'High', num: true }, { t: 'Medium', num: true }, { t: 'Low', num: true }, { t: 'Findings', num: true }, { t: '$ at risk', num: true }], rows,
      '<tr class="k-total"><td>Total</td><td class="num">' + t.High + '</td><td class="num">' + t.Medium + '</td><td class="num">' + t.Low + '</td><td class="num">' + t.count + '</td><td class="num">' + ui.money(t.amount) + '</td></tr>');
  }
  // Self-checks every view carries: the report's own arithmetic, never the findings (a finding is not a failed report).
  function selfChecks(r, ids, t) {
    var sc = LC.scope(r, ids), cats = LC.CATEGORIES.reduce(function (s, c) { return s + ((t.byCat[c] || {}).count || 0); }, 0);
    var amt = Math.round(LC.CATEGORIES.reduce(function (s, c) { return s + ((t.byCat[c] || {}).amount || 0); }, 0) * 100) / 100;
    return [
      { name: 'Findings by category add up to the total', pass: cats === t.count, detail: t.count + ' finding(s)' },
      { name: '$ at risk by category adds up to the total', pass: Math.abs(amt - t.amount) < 0.011, detail: LC.money(t.amount) },
      { name: 'Every check in scope is accounted for (run, N/A on this platform, or runs overnight)', pass: sc.length === ids.length && sc.every(function (s) { return s.status; }), detail: sc.filter(function (s) { return s.status === 'clear' || s.status === 'findings'; }).length + ' run live, ' + sc.filter(function (s) { return s.status === 'na'; }).length + ' N/A, ' + sc.filter(function (s) { return s.status === 'overnight'; }).length + ' overnight' }
    ];
  }
  var NOTE_LIVE = 'These checks run on the client\'s ledger every time the report opens, using the rules of the overnight checks engine (Bookkeeping for Xero). A finding fixed in the ledger is gone on the next open; findings dismissed in WorkQ are not read here.';
  function sheetFindings(fs) { return [['Severity', 'Check', 'Category', 'Name', 'Finding', '$ at risk', 'Link'].map(function (t) { return { v: t, s: 'bold' }; })].concat(fs.map(function (f) { return [f.severity, f.check, f.category, f.name, f.text, f.amount == null ? '' : { v: f.amount, s: 'money' }, f.link]; })); }
  function sheetScope(r, ids) { var L = looks(); return [['Check', 'Name', 'Category', 'Severity'].concat(L ? ['What it looks for'] : [], ['Result']).map(function (t) { return { v: t, s: 'bold' }; })].concat(LC.scope(r, ids).map(function (s) { return [s.check, s.name, s.category, s.severity].concat(L ? [L[s.check] || ''] : [], [result(null, s)]); })); }

  var NAMES = { 'data-quality': 'Data Quality', 'client-queries': 'Client Queries', 'gst-check': 'GST Check', 'health-check': 'Health Check' };
  return { view: function (view, ui, r, fin) { return LV_VIEW(ui, r, fin || {}); }, NAMES: NAMES,
    card: card, table: table, scopeTable: scopeTable, findingsTable: findingsTable, rowsTable: rowsTable, catTable: catTable, selfChecks: selfChecks, sheetFindings: sheetFindings, sheetScope: sheetScope, NOTE_LIVE: NOTE_LIVE };
})();

// CRA-00 Client catalogue (boxes) + CRA-16 platform-native library boxes. Returns the report document.
// Live data is only the client list (the viewer's own Xero / MYOB / QuickBooks connections, LIB-002); the boxes come
// from reports.js (this extension's templates) and libraries.json (the three reporting studios' templates, mk-libraries.js).
// Box behaviour follows decision D5: a box starts from "Use this report" on the template, or asks the agent; it does not
// look up a latest saved instance. Workspace has no client-portal visibility for reports, so that check is N/A.
const fs = require('fs'), path = require('path');
const { REPORTS, PLATFORM } = require('../reports.js');
const LIB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'libraries.json'), 'utf8'));

const CHIPS = ['Financial', 'Tax & BAS', 'Sales & purchases', 'Quality', 'Activity', 'Time', 'Platform reports'];
const NA = {
  wave2: 'Not available yet — coming in Wave 2',
  checks: 'Not available yet — needs the checks engine (Work list), coming next',
  time: 'Not available — no time source; Xero Practice Manager practices get it in Wave 3'
};
// [id, name, chip, state, one line] — the Index tab of the Prompt Library v1.1
const ITEMS = [
  ['CRA-01', 'Financial Overview', 'Financial', 'live', 'Revenue, gross and net profit, trends, bank balances and receivables / payables ageing for any period, cash or accrual.'],
  ['CRA-02', 'Data Quality', 'Quality', 'checks', 'Findings of the automated checks on this client: by category and severity, with $ at risk.'],
  ['CRA-03', 'Sales by Tracking Category', 'Sales & purchases', 'wave2', 'Sales by tracking category / class / job and its options, one category at a time.'],
  ['CRA-04', 'Purchases by Tracking Category', 'Sales & purchases', 'wave2', 'Purchases by tracking category / class / job and its options.'],
  ['CRA-05', 'Summary of Tax Amounts by Type', 'Tax & BAS', 'live', 'Total value per month for each tax type, reconciled to the GST figures, for BAS preparation review.'],
  ['CRA-06', 'Contact Details for BAS Preparation', 'Tax & BAS', 'wave2', 'All contacts with GST registration status and tax types used (registry match when the ABR lookup exists).'],
  ['CRA-07', 'BAS Related Transactions and GST', 'Tax & BAS', 'live', 'Every BAS-relevant transaction per tax type, by contact, source and GL account, tied to the GST figures.'],
  ['CRA-08', 'Client Queries', 'Quality', 'checks', 'Transactions that need information from the client (uncoded, missing attachment, unexplained), to view and send.'],
  ['CRA-09', 'Health Check', 'Quality', 'checks', "Key summary of the client's financial activity and data quality on one page."],
  ['CRA-10', 'GST Check', 'Tax & BAS', 'checks', 'Scope and method of the GST checks, with resolved vs unresolved GST risk.'],
  ['CRA-11', 'Activity Count', 'Activity', 'wave2', 'Transaction activity across key functions for the client.'],
  ['CRA-12', 'Actual Time', 'Time', 'time', 'Time allocated to this client by staff and task source.'],
  ['CRA-13', 'Estimate Accuracy', 'Time', 'time', "Estimated vs actual time for this client's work items."],
  ['CRA-14', 'Ledger User Activity', 'Activity', 'wave2', "What people have been doing in the client's accounting file (from the platform's audit log export)."],
  ['CRA-15', 'Workspace User Activity', 'Activity', 'wave2', "Actions taken in Workspace to resolve this client's findings and tasks."]
];
const live = {}; REPORTS.filter((r) => r.platform).forEach((r) => { (live[r.cra] = live[r.cra] || {})[r.platform] = { slug: r.slug, title: r.title }; });
const DATA = {
  chips: CHIPS, na: NA, platforms: PLATFORM,
  items: ITEMS.map(([id, name, chip, state, line]) => ({ id, name, chip, state, line, live: live[id] || null })),
  libraries: Object.fromEntries(Object.entries(LIB).map(([p, l]) => [p, { plugin: l.plugin, studio: PLATFORM[p] + ' Reporting Studio', reports: l.reports.map((r) => ({ slug: r.slug, title: r.title, code: r.code, line: r.blurb })) }]))
};

const CSS = `
:root{--bg:#FAFAFA;--surface:#FFFFFF;--soft:#F2F1ED;--ink:#000000;--muted:#5B6168;--line:#DADCE0;--accent:#34DFBA;--deep:#22669C;--hl:#B2EDE3;--live:#0E7C66;--na:#8A5A00;--na-bg:#FFF4DB;--fail:#B42318;--fail-bg:#FDECEA;--pass-bg:#E7F8F2}
:root[data-myhub-theme='dark']{--bg:#1E1E1E;--surface:#262626;--soft:#2E2E2E;--ink:#F2F2F2;--muted:#A6ADB4;--line:#3A3A3A;--accent:#34DFBA;--deep:#7DB8E8;--hl:#1F4A43;--live:#34DFBA;--na:#F5C66B;--na-bg:#3A2F14;--fail:#FF8A80;--fail-bg:#3B1E1C;--pass-bg:#173A31}
*{box-sizing:border-box}body{margin:0;padding:20px;font:14px/1.45 Roboto,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg)}
.hero{border-radius:12px;padding:16px 20px;color:#fff;background:linear-gradient(90deg,#34DFBA,#22669C)}
.hero h1{margin:0;font-size:22px}.hero p{margin:4px 0 0;opacity:.95}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}
select,input[type=search],button{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 10px}
button{cursor:pointer}button:disabled,select:disabled{opacity:.6;cursor:default}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border-radius:16px;padding:4px 12px}.chip[aria-pressed=true]{background:var(--hl);border-color:var(--accent)}
.banner{border-radius:8px;padding:10px 12px;margin:10px 0;background:var(--pass-bg)}.banner.fail{background:var(--fail-bg);color:var(--fail)}
.banner ul{margin:6px 0 0;padding-left:18px}
h2{font-size:18px;margin:18px 0 8px}h3{font-size:15px;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.box{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px}
.box .top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.id{color:var(--muted);font-size:12px}
.pill{display:inline-block;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:600}.pill.live{color:var(--live);background:var(--pass-bg)}.pill.na{color:var(--na);background:var(--na-bg)}
.badges{display:flex;gap:4px}.badge{font-size:11px;font-weight:700;border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--muted)}.badge.on{color:var(--ink);border-color:var(--deep);background:var(--hl)}
.how{font-size:12px;color:var(--muted);border-top:1px dashed var(--line);padding-top:6px}.how b{color:var(--ink)}
.muted{color:var(--muted)}.notice{background:var(--na-bg);color:var(--na);border-radius:8px;padding:8px 12px;margin:6px 0}
footer{margin-top:18px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:8px}
[hidden]{display:none!important}
@media print{.bar,button{display:none}body{background:#fff;padding:0}}
`;

const SCRIPT = `
(function () {
  var D = __DATA__;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var state = { clients: [], client: '', chip: 'All', q: '', notices: [], fetchedAt: null, sources: [] };
  var BINDING = { xero: 'xero_connections', myob: 'myob_company_files', quickbooks: 'quickbooks_company' };
  var TOOL = { xero: 'list_connections', myob: 'list_company_files', quickbooks: 'qbo_query (CompanyInfo)' };
  function items(v) { return Array.isArray(v) ? v : v && (v.Items || v.items || v.value) || []; }
  function clientsOf(p, v) {
    if (p === 'xero') return ((v && v.tenants) || []).filter(function (t) { return !t.tenantType || t.tenantType === 'ORGANISATION'; }).map(function (t) { return { id: t.tenantId, name: t.tenantName }; });
    if (p === 'myob') return items(v).map(function (f) { return { id: String(f.Id || f.id || ''), name: f.Name || f.name || '' }; });
    var ci = v && v.QueryResponse && v.QueryResponse.CompanyInfo && v.QueryResponse.CompanyInfo[0];
    return ci ? [{ id: String(ci.Id || 'company'), name: ci.CompanyName || ci.LegalName || 'QuickBooks company' }] : [];
  }
  function load(b) {
    state.clients = []; state.notices = []; state.sources = []; state.fetchedAt = b.fetchedAt || null;
    Object.keys(BINDING).forEach(function (p) {
      var id = BINDING[p], err = b.errors && b.errors[id], name = D.platforms[p];
      if (err) {
        state.notices.push(err.code === 'needs_connection' ? 'Connect ' + name + ' (Settings → Connections) to list its clients here.' : name + ' clients could not be listed: ' + (err.message || err.code));
        state.sources.push({ p: p, ok: false, n: 0 }); return;
      }
      var list = clientsOf(p, b.data && b.data[id]).filter(function (c) { return c.id && c.name; });
      if (p === 'quickbooks' && list.length) state.notices.push('QuickBooks shows one company per connection: ' + list[0].name + '. Another QuickBooks client needs its own connection.');
      list.forEach(function (c) { state.clients.push({ key: p + ':' + c.id, platform: p, name: c.name }); });
      state.sources.push({ p: p, ok: true, n: list.length });
    });
    var wanted = (b.inputs && b.inputs.client) || state.client;
    state.client = state.clients.some(function (c) { return c.key === wanted; }) ? wanted : (state.clients[0] ? state.clients[0].key : '');
    render();
  }
  function current() { for (var i = 0; i < state.clients.length; i++) if (state.clients[i].key === state.client) return state.clients[i]; return null; }
  function badges(on) { return '<span class="badges">' + ['xero', 'myob', 'quickbooks'].map(function (p) { return '<span class="badge' + (p === on ? ' on' : '') + '" title="' + esc(D.platforms[p]) + '">' + D.platforms[p].charAt(0) + '</span>'; }).join('') + '</span>'; }
  function match(text) { return !state.q || text.toLowerCase().indexOf(state.q.toLowerCase()) >= 0; }
  function itemBox(it, c) {
    var p = c && c.platform, t = it.live && p ? it.live[p] : null, isLive = it.state === 'live';
    var how = isLive ? (t ? 'Open: Reports → From your plugins → <b>' + esc(t.title) + '</b> → Use this report' + (p === 'quickbooks' ? '' : ', then pick <b>' + esc(c.name) + '</b>') + '.<br>Or ask the Client Report Analytics agent: <b>“' + esc(it.name) + ' for ' + esc(c.name) + '”</b>.' : 'Pick a client above to see how to open it.') : esc(D.na[it.state]);
    return '<article class="box" data-row="' + esc(it.id) + '"><div class="top"><div><h3>' + esc(it.name) + '</h3><span class="id">' + esc(it.id) + ' · ' + esc(it.chip) + '</span></div>' + badges(isLive ? p : null) + '</div>' +
      '<div><span class="pill ' + (isLive ? 'live">Live' : 'na">Not available') + '</span></div><div>' + esc(it.line) + '</div><div class="how">' + how + '</div></article>';
  }
  function libBox(r, lib, c) {
    return '<article class="box" data-row="' + esc(r.slug) + '"><div class="top"><div><h3>' + esc(r.title) + '</h3><span class="id">' + esc(r.code || 'Library') + ' · Platform reports</span></div>' + badges(c.platform) + '</div>' +
      '<div><span class="pill live">Live · ' + esc(lib.studio) + '</span></div>' + (r.line ? '<div>' + esc(r.line) + '</div>' : '') +
      '<div class="how">Ask the Client Report Analytics agent: <b>“Open the ' + esc(r.title) + ' for ' + esc(c.name) + '”</b>, or Reports → From your plugins → <b>' + esc(r.title) + '</b>. Needs the ' + esc(lib.studio) + ' extension installed.</div></article>';
  }
  function checks(c, shownItems, shownLib) {
    var ids = shownItems.map(function (i) { return i.id; }).concat(shownLib.map(function (r) { return r.slug; }));
    var unique = ids.filter(function (v, i) { return ids.indexOf(v) === i; }).length === ids.length;
    var expect = D.items.length + (c ? D.libraries[c.platform].reports.length : 0);
    var all = state.chip === 'All' && !state.q;
    return [
      { name: 'One box per catalogue row', pass: unique && (!all || ids.length === expect), detail: ids.length + ' boxes' + (all ? ' for ' + expect + ' rows (15 client reports' + (c ? ' + ' + D.libraries[c.platform].reports.length + ' ' + D.platforms[c.platform] + ' library reports' : '') + ')' : ' shown under the current filter') + (unique ? '' : '; a row appears twice') },
      { name: 'Clients come only from your own connections', pass: state.sources.some(function (s) { return s.ok; }) ? true : null, detail: state.sources.map(function (s) { return D.platforms[s.p] + ': ' + (s.ok ? s.n + ' via ' + TOOL[s.p] : 'not connected'); }).join(' · ') },
      { name: 'Boxes hidden from the client portal when toggled off', pass: null, detail: 'N/A — Workspace has no "Display in client portal" setting for reports yet, so no report is shown in a portal.' }
    ];
  }
  function render() {
    var c = current(), sel = $('client');
    sel.innerHTML = state.clients.length ? state.clients.map(function (x) { return '<option value="' + esc(x.key) + '"' + (x.key === state.client ? ' selected' : '') + '>' + esc(D.platforms[x.platform] + ' · ' + x.name) + '</option>'; }).join('') : '<option value="">No clients — connect Xero, MYOB or QuickBooks</option>';
    sel.disabled = MyHubReport.mode === 'snapshot' || !state.clients.length;
    $('chips').innerHTML = ['All'].concat(D.chips).map(function (ch) { return '<button class="chip" type="button" aria-pressed="' + (ch === state.chip) + '" data-chip="' + esc(ch) + '">' + esc(ch) + '</button>'; }).join('');
    $('notices').innerHTML = state.notices.map(function (n) { return '<div class="notice">' + esc(n) + '</div>'; }).join('');
    var shownItems = D.items.filter(function (it) { return (state.chip === 'All' || state.chip === it.chip) && match(it.id + ' ' + it.name + ' ' + it.line); });
    var lib = c ? D.libraries[c.platform] : null;
    var shownLib = lib && (state.chip === 'All' || state.chip === 'Platform reports') ? lib.reports.filter(function (r) { return match(r.title + ' ' + r.code + ' ' + r.line); }) : [];
    $('head').innerHTML = '<h2>Client' + (c ? ': ' + esc(c.name) + ' <span class="muted">(' + esc(D.platforms[c.platform]) + ')</span>' : '') + '</h2>';
    $('items').innerHTML = shownItems.map(function (it) { return itemBox(it, c); }).join('') || '<p class="muted">No client reports match.</p>';
    $('libhead').hidden = !shownLib.length;
    $('libhead').textContent = lib ? D.platforms[c.platform] + ' report library (' + lib.studio + ')' : '';
    $('lib').innerHTML = shownLib.map(function (r) { return libBox(r, lib, c); }).join('');
    var ck = checks(c, shownItems, shownLib), failed = ck.filter(function (k) { return k.pass === false; }).length;
    $('banner').className = 'banner' + (failed ? ' fail' : '');
    $('banner').innerHTML = '<b>' + (failed ? failed + ' check failed' : 'Checks passed') + '</b> · ' + ck.filter(function (k) { return k.pass === true; }).length + ' passed · ' + ck.filter(function (k) { return k.pass === null; }).length + ' for information<ul>' + ck.map(function (k) { return '<li>' + (k.pass === true ? '✓' : k.pass === false ? '✗' : 'ℹ') + ' ' + esc(k.name) + ' — ' + esc(k.detail) + '</li>'; }).join('') + '</ul>';
    $('foot').textContent = 'Client Report Analytics · Data as of ' + (state.fetchedAt ? new Date(state.fetchedAt).toLocaleString('en-AU') : '—') + ' · Clients from ' + state.sources.filter(function (s) { return s.ok; }).map(function (s) { return D.platforms[s.p] + ' ' + TOOL[s.p]; }).join(', ') + (state.sources.some(function (s) { return s.ok; }) ? '' : 'no connection') + '. Boxes open report templates ("Use this report"); the latest saved copy is not looked up. No sparklines yet: the catalogue does not run each report.';
  }
  function excel() {
    var c = current(), rows = [['Client Report Catalogue'], ['Client', c ? c.name + ' (' + D.platforms[c.platform] + ')' : 'None'], [], ['ID', 'Report', 'Group', 'State', 'How to open']];
    D.items.forEach(function (it) { var t = it.live && c ? it.live[c.platform] : null; rows.push([it.id, it.name, it.chip, it.state === 'live' ? 'Live' : D.na[it.state], t ? 'Use this report: ' + t.title : '']); });
    if (c) D.libraries[c.platform].reports.forEach(function (r) { rows.push([r.code, r.title, 'Platform reports', 'Live · ' + D.libraries[c.platform].studio, 'Use this report: ' + r.title]); });
    var x = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Catalogue"><Table>' + rows.map(function (r) { return '<Row>' + r.map(function (v) { return '<Cell><Data ss:Type="String">' + esc(v) + '</Data></Cell>'; }).join('') + '</Row>'; }).join('') + '</Table></Worksheet></Workbook>';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([x], { type: 'application/vnd.ms-excel' }));
    a.download = 'client-report-catalogue' + (c ? '-' + c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '') + '.xls';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  $('client').addEventListener('change', function (e) { state.client = e.target.value; if (MyHubReport.mode === 'live') MyHubReport.setInputs({ client: state.client }); render(); });
  $('chips').addEventListener('click', function (e) { var b = e.target.closest('[data-chip]'); if (b) { state.chip = b.getAttribute('data-chip'); render(); } });
  $('q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('pdf').addEventListener('click', function () { window.print(); });
  $('xls').addEventListener('click', excel);
  MyHubReport.onData(load);
})();
`;

module.exports = function build() {
  const data = JSON.stringify(DATA).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Client Report Catalogue</title>
<style>${CSS.trim()}</style>
</head>
<body>
<header class="hero"><h1>Client Report Catalogue</h1><p>Client Report Analytics · reports for one client from your Xero, MYOB and QuickBooks connections</p></header>
<div class="bar"><label>Client <select id="client" aria-label="Client"></select></label><input id="q" type="search" placeholder="Search reports" aria-label="Search reports"><button id="pdf" type="button">Download PDF</button><button id="xls" type="button">Download Excel</button></div>
<div id="chips" class="chips" role="toolbar" aria-label="Report groups"></div>
<div id="notices"></div>
<div id="banner" class="banner" role="region" aria-label="Validation">Loading your connections…</div>
<main><div id="head"></div><div id="items" class="grid"></div><h2 id="libhead" hidden></h2><div id="lib" class="grid"></div></main>
<footer id="foot"></footer>
<script>${SCRIPT.replace('__DATA__', () => data).trim()}</script>
</body>
</html>
`;
};

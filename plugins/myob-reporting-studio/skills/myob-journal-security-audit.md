---
name: MYOB Journal Security Audit
description: MYOB Journal Security Audit (M13) from the MYOB export the user attaches — who added, changed or deleted which transactions, with prior-period changes flagged. Use when the user asks for the journal security audit, who changed or deleted transactions, an audit trail, changes to transactions, or edits to a locked or prior period.
---
# Journal Security Audit (M13)

Use when the user asks for the journal security audit, who changed or deleted transactions, an audit trail, changes to transactions, or edits to a locked or prior period. MYOB's API does **not** expose this report, so it is built from the MYOB export the user attaches and saved as a **static** (frozen) page. Do not call MYOB tools for it.

MYOB location: Reporting → Reports → Business → Journal security audit. Library: MYOB Reports Prompt Library v1.2 → Prompts → M13. Delivery: Wave 2 (P2, delivery order 37).

## Build

1. If no export is attached, ask for it: *MYOB › Reporting › Reports › Business › Journal security audit › set Session date and Transaction date › Export › Excel, and attach the file here.*
2. Read the export. Take the business name and dates from its header; if the business is not in the file use `null` (the page shows "N/A — not in source"). For each row take: `actionDate` (Action date, ISO `YYYY-MM-DD HH:MM` when unambiguous), `user`, `action` (Added / Changed / Deleted / Reversed …, as written), `type` (transaction type), `txnDate` (Transaction date, `YYYY-MM-DD`), `memo`, `ref` (ID / reference, when present), `debit` and `credit` (numbers, or null). Do not invent, merge or drop rows.
3. Build the JSON: `{"company": …, "period": "Session date: <d Month yyyy> - <d Month yyyy>", "lockDate": "YYYY-MM-DD" or null (only if the user gives the file's lock date), "fileName": "<attached file name>", "rows": [ … ]}`. **Escape every `<` as `\u003c`** so text from the export can never close the script tag.
4. Replace `{{DATA}}` in the page below with that JSON — nothing else. Save with `artifact_save`: `title` = "MYOB Journal Security Audit", `description` = "<Business> · <period> · from the MYOB export", `fileName` = `myob-journal-security-audit.html`, `tags` = ["myob","M13","export"]. Do not pass `dataBindings` or `connectors`.
5. Completion note: the number of rows, the period, that the page is a frozen copy of the export (attach a new export to update it), and the validation result.

## Members

| Member / view | How |
|---|---|
| Journal security audit | Every row of the export: action date, user, action, type, transaction date, memo, debit, credit |
| Counts by user and by action | Tiles above the table and a bar chart of changes by user |
| Prior-period changes | A change or deletion of a transaction dated before the month it was changed in (or on or before the lock date, when given) is flagged |
| Filters | User, action, transaction type, search and action date from / to |
| Live data | N/A — MYOB's API does not expose the journal security audit |

## Validation (shown in the banner)

- Counts by action sum to the rows shown
- Every row has an action date, a user and an action

## QA test script

1. Attach an export from the golden-set file. Confirm every row appears once and the validation passes. Captured empty for the default period in the sample file — export a month with changes from the golden-set file and confirm every row appears once and the counts add up.
2. Use every filter, switch Branding to mySMB and back, and switch the workspace to the dark theme.
3. Include text with `<` or `</script>` in a row and confirm the page still renders.

## Page

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Journal Security Audit</title>
<style>:root{--accent:#6F2CBA;--btn:#5A1F9E;--btn-ink:#FFFFFF;--ink:#393A3D;--muted:#6B6C72;--line:#E3E5E8;--canvas:#F4F5F8;--card:#FFFFFF;--th:#6B6C72;--zebra:transparent;--neg:#D52B1E;--pos:#1B7F4B;--pass-bg:#EAF6E8;--fail-bg:#FDECEA;--band:#FFFFFF;--band-ink:#393A3D;--cover:#1B2A4A;--cover-ink:#FFFFFF;--c1:#6F2CBA;--c2:#9E9E9E;--c3:#00B0A0;--c4:#007A6E;--c5:#E0457B;--c6:#0077C5;--d1:#6F2CBA;--d2:#00B0A0;--d3:#B28DE6;--d4:#E0457B;--d5:#0077C5;--d6:#9E9E9E}
:root[data-myhub-theme='dark']{--accent:#A77BE8;--btn:#7A45C9;--btn-ink:#FFFFFF;--ink:#E6E8EB;--muted:#A3A7AE;--line:#33363C;--canvas:#16181B;--card:#1F2226;--th:#A3A7AE;--neg:#FF6B5E;--pos:#4CC38A;--pass-bg:#18301A;--fail-bg:#3A1B19;--band:#1F2226;--band-ink:#E6E8EB;--cover:#22324F;--cover-ink:#FFFFFF;--c1:#A77BE8;--c2:#80858D;--c3:#2BC4B3;--c4:#3CCFBF;--c5:#F06A96;--c6:#3FA2E8;--d1:#A77BE8;--d2:#2BC4B3;--d3:#CDB4F2;--d4:#F06A96;--d5:#3FA2E8;--d6:#80858D}
:root.style-mysmb{--accent:#00B0A0;--btn:#007A6E;--zebra:#E6F7F5;--band:#007A6E;--band-ink:#FFFFFF;--cover:#007A6E;--th-bg:#007A6E;--th-ink:#FFFFFF;--c1:#007A6E;--c2:#00B0A0;--c3:#6F2CBA;--c4:#9E9E9E;--c5:#1B7F4B;--c6:#C8102E;--d1:#007A6E;--d2:#00B0A0;--d3:#6F2CBA;--d4:#9E9E9E;--d5:#1B7F4B;--d6:#C8102E;--pos:#1B7F4B;--neg:#C8102E}
:root[data-myhub-theme='dark'].style-mysmb{--accent:#2BC4B3;--btn:#138A7D;--zebra:#15302D;--band:#0E5A52;--band-ink:#FFFFFF;--cover:#0E5A52;--th-bg:#0E5A52;--th-ink:#FFFFFF;--c1:#2BB3A3;--c2:#3CCFBF;--c3:#A77BE8;--c4:#80858D;--c5:#4CC38A;--c6:#FF6B5E;--d1:#2BB3A3;--d2:#3CCFBF;--d3:#A77BE8;--d4:#80858D;--d5:#4CC38A;--d6:#FF6B5E;--pos:#4CC38A;--neg:#FF6B5E}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--canvas);color:var(--ink);font:14px/1.45 "Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
#mk-controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:12px}
.ctl{display:flex;flex-direction:column;font-size:12px;color:var(--muted);gap:4px}
.ctl select,.ctl input[type=date],.mk-filter{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:4px;padding:6px 8px}
.ctl select:disabled,.ctl input:disabled{opacity:.6}
.seg{border:0;padding:0;margin:0;flex-direction:row;gap:0}
.seg legend{font-size:12px;color:var(--muted);padding:0 0 4px}
.seg label{border:1px solid var(--line);padding:6px 12px;color:var(--ink);cursor:pointer;font-size:13px}
.seg label:first-of-type{border-radius:4px 0 0 4px}.seg label:last-of-type{border-radius:0 4px 4px 0;border-left:0}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){background:var(--card);box-shadow:inset 0 0 0 2px var(--accent);font-weight:600}
.customise summary{cursor:pointer;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px 10px;font-size:13px}
.cz{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:6px 16px;padding:8px 0;font-size:13px;color:var(--ink)}
.btns{flex-direction:row;gap:8px;margin-left:auto}
.btns button,.btns a{font:inherit;font-size:13px;font-weight:600;border-radius:4px;padding:7px 14px;cursor:pointer;text-decoration:none;border:1px solid var(--btn);background:var(--card);color:var(--btn)}
.btns button#mk-xlsx{background:var(--btn);color:var(--btn-ink)}
#mk-status{font-size:12px;color:var(--muted);min-height:16px;margin:0 0 6px}
.mk-banner{border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;border:1px solid var(--line)}
.mk-banner.pass{background:var(--pass-bg)}.mk-banner.na{border-color:var(--muted)}.mk-banner.fail{background:var(--fail-bg);border-color:var(--neg)}
.mk-banner ul{margin:6px 0 0;padding-left:18px}.mk-banner li.bad{color:var(--neg);font-weight:600}.mk-banner li.na{color:var(--muted)}
.mk-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px 24px;margin-bottom:12px}
#mk-head{text-align:center;padding:8px 0 16px;background:var(--band);color:var(--band-ink);border-radius:6px}
:root.style-mysmb #mk-head{text-align:left;padding:14px 18px;margin-bottom:12px}
#mk-head .co{font-size:18px;font-weight:700}#mk-head .ti{font-size:14px}#mk-head .pe{font-size:14px;font-weight:600}
table{border-collapse:collapse;width:100%}
th{font-size:11px;font-variant:small-caps;letter-spacing:.04em;text-transform:lowercase;color:var(--th);font-weight:600;text-align:left;padding:8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card)}
.mk-grid th{cursor:pointer;user-select:none}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--zebra)}
.num{text-align:right;white-space:nowrap}
.k-header td{font-weight:600;border-bottom:0}.k-total td{font-weight:700;border-top:1px solid var(--ink)}
.neg{color:var(--neg)}
.muted{color:var(--muted)}.mk-err{color:var(--neg)}
.mk-scroll{overflow-x:auto}
.mk-filter{margin:0 0 8px;min-width:220px}
:root.dens-compact td{padding:3px 8px}:root.dens-compact body{font-size:12.5px}
.mk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.mk-kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.mk-kpi .lbl{font-size:11px;font-variant:small-caps;text-transform:lowercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.mk-kpi .val{font-size:22px;font-weight:700;margin-top:2px}.mk-kpi .sub{font-size:12px;color:var(--muted)}
.chip{display:inline-block;font-size:11px;font-weight:700;border-radius:10px;padding:1px 8px;margin-top:4px}
.chip.up{background:var(--pass-bg);color:var(--pos)}.chip.down{background:var(--fail-bg);color:var(--neg)}
.mk-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.mk-card h2,.mk-card h3{font-size:15px;margin:0 0 10px}
svg{width:100%;height:auto;max-height:300px;display:block;margin:0 auto}svg .axis{stroke:var(--line);stroke-width:1}svg .tick{fill:var(--muted);font-size:11px}
svg .donut-c{fill:var(--ink);font-size:15px;font-weight:700}
.mk-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--muted);margin-top:6px}
.mk-legend i,.mk-donut li i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.mk-donut{display:flex;gap:16px;align-items:center}.mk-donut svg{max-width:180px}.mk-donut ul{list-style:none;padding:0;margin:0;font-size:13px}.mk-donut li{margin:3px 0}
#mk-foot{color:var(--muted);font-size:12px;text-align:center;padding:12px 0 4px}
#mk-sources{font-size:12.5px;color:var(--muted)}#mk-sources h2{font-size:13px;color:var(--ink)}
.persona-summary .detail-block{display:none}
.persona-summary .keep-detail tr.detail-block{display:table-row}
.skel{height:14px;border-radius:4px;background:var(--line);margin:8px 0;opacity:.6}
.page{break-after:page}
@media (max-width:720px){.btns{margin-left:0}.cz{grid-template-columns:1fr}}
@media print{body{background:var(--card);padding:0}#mk-controls,#mk-status,.no-print,.mk-filter{display:none!important}.mk-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 portrait;margin:14mm}}
/* QuickBooks branding accents (the accent follows the house-style toggle and the optional brand colour) */
#mk-controls{border-top:3px solid var(--accent)}
main.mk-card{border-top:4px solid var(--accent)}
.mk-kpi{border-left:4px solid var(--accent)}
.mk-stmt thead th,.mk-grid thead th{border-bottom:2px solid var(--accent)}
.mk-src{font-size:12px;color:var(--muted);margin-top:4px}.mk-src i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:middle}
:root.style-mysmb #mk-head .mk-src{color:var(--band-ink);opacity:.85}:root.style-mysmb #mk-head .mk-src i{background:var(--band-ink)}
/* keep the right-hand amounts clear of the workspace's floating chat button */
@media (min-width:900px){body{padding-right:64px}}
@media print{body{padding-right:0}}
.mk-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;border-radius:10px;padding:1px 8px;margin-right:6px;vertical-align:middle;background:var(--accent);color:#FFFFFF}.mk-src .mk-badge+*{vertical-align:middle}
:root.style-mysmb .mk-stmt thead th,:root.style-mysmb .mk-grid thead th{background:var(--th-bg);color:var(--th-ink);border-bottom:0}
:root.style-mysmb #mk-head .ti{font-size:18px;font-weight:700}:root.style-mysmb #mk-head .co{font-size:14px}:root.style-mysmb .mk-badge{background:var(--band-ink);color:var(--band)}:root.style-mysmb .mk-kpi{border-left-color:var(--band)}
.mk-greet{font-size:20px;font-weight:600;margin:0 0 12px}
.mk-dash{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.mk-dash>.mk-card{margin:0;padding:16px 18px}.mk-dash>.wide{grid-column:1/-1}.mk-dash .wide svg{max-height:260px}.mk-next{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mk-next h3{margin:0 8px 0 0}
.mk-big{font-size:26px;font-weight:700;margin:2px 0 6px;font-variant-numeric:tabular-nums}.mk-big sup{font-size:.55em;font-weight:600;vertical-align:.6em}.mk-big.neg{color:var(--neg)}
.mk-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--line);margin:8px 0}.mk-bar i{display:block;height:100%}
.mk-bul{list-style:none;padding:0;margin:8px 0 0}.mk-bul li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px}.mk-bul b{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
.mk-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:8px}.mk-tiles .lbl{font-size:12px;color:var(--muted)}
@media print{.noprint{display:none}}</style>
</head>
<body class="persona-detail">
<div id="mk-controls" aria-label="Report filters">
<label class="ctl">Search<input type="search" id="q" class="mk-filter" placeholder="Search memo, type, reference" style="margin:0"></label>
<label class="ctl">User<select id="user"><option value="">All users</option></select></label>
<label class="ctl">Action<select id="action"><option value="">All actions</option></select></label>
<label class="ctl">Type<select id="type"><option value="">All types</option></select></label>
<label class="ctl">Action date from<input type="date" id="from"></label>
<label class="ctl">To<input type="date" id="to"></label>
<label class="ctl"><span><input type="checkbox" id="prior"> Prior-period changes only</span></label>
<label class="ctl">Branding<select id="style"><option value="myob">MYOB</option><option value="mysmb">mySMB</option></select></label>
<div class="ctl btns"><button type="button" id="pdf">Download PDF</button></div>
</div>
<div id="mk-banner" class="mk-banner pass" role="region" aria-label="Validation"></div>
<main class="mk-card"><header id="mk-head"></header><div id="mk-body"></div><footer id="mk-foot"></footer></main>
<section id="mk-sources" class="mk-card" aria-label="Sources and limitations"><h2>Sources &amp; limitations</h2><ul id="src"></ul></section>
<script>
var AUDIT = {{DATA}};
(function () {
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { if (v == null || v === '') return null; var n = Number(String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')); return isFinite(n) ? n : null; }
  function money(v) { return v == null ? '' : (v < 0 ? '(' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : ''); }
  var $ = function (id) { return document.getElementById(id); }, LOCK = AUDIT.lockDate || null;
  var rows = (AUDIT.rows || []).map(function (r) {
    var a = String(r.action == null ? '' : r.action).trim(), ad = String(r.actionDate == null ? '' : r.actionDate).trim(), td = String(r.txnDate == null ? '' : r.txnDate).slice(0, 10);
    var x = { actionDate: ad, user: String(r.user == null ? '' : r.user).trim(), action: a ? a.charAt(0).toUpperCase() + a.slice(1) : '', type: r.type || '', txnDate: td, memo: r.memo || '', ref: r.ref || '', debit: num(r.debit), credit: num(r.credit) };
    // a change or deletion of a transaction dated before the month it was changed in (or on or before the lock date, when given)
    x.prior = /^(chang|edit|delet|revers|void|remov)/i.test(x.action) && !!td && (LOCK ? td <= LOCK : !!ad && td < ad.slice(0, 7) + '-01');
    return x;
  });
  var uniq = function (k) { var o = {}; rows.forEach(function (r) { o[r[k] || '—'] = 1; }); return Object.keys(o).sort(); };
  uniq('user').forEach(function (u) { $('user').insertAdjacentHTML('beforeend', '<option>' + h(u) + '</option>'); });
  uniq('action').forEach(function (u) { $('action').insertAdjacentHTML('beforeend', '<option>' + h(u) + '</option>'); });
  uniq('type').forEach(function (u) { $('type').insertAdjacentHTML('beforeend', '<option>' + h(u) + '</option>'); });
  $('mk-head').innerHTML = '<div class="co">' + h(AUDIT.company || 'N/A — not in source') + '</div><div class="ti">Journal Security Audit</div><div class="pe">' + h(AUDIT.period || '') + '</div><div class="mk-src"><span class="mk-badge">MYOB</span>From the MYOB export</div>';
  $('mk-foot').textContent = 'From the MYOB Journal security audit export · ' + (AUDIT.fileName || 'attached file') + ' · ' + rows.length + ' rows';
  $('src').innerHTML = '<li>Source: MYOB › Reporting › Reports › Business › Journal security audit, exported and attached by the user (' + h(AUDIT.fileName || 'file') + '). MYOB\'s API does not expose the journal security audit, so this report is a frozen copy of that export — not live.</li>' +
    '<li>Business and session dates are read from the export header' + (AUDIT.company ? '' : ' — the business name was not in the export (N/A — not in source)') + '.</li>' +
    '<li>Prior-period changes: a change or deletion of a transaction dated ' + (LOCK ? 'on or before the lock date ' + h(LOCK) : 'before the month it was changed in (no lock date given)') + '.</li><li>Decision support only — not audit, tax or legal advice.</li>';
  function bars(o) {
    var keys = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, 12), mx = Math.max.apply(null, keys.map(function (k) { return o[k]; }).concat([1])), W = 640, rowH = 26;
    return '<svg viewBox="0 0 ' + W + ' ' + (keys.length * rowH + 8) + '" role="img" aria-label="Changes by user">' + keys.map(function (k, i) { var w = Math.max(2, (W - 220) * o[k] / mx); return '<text x="0" y="' + (i * rowH + 17) + '" class="tick">' + h(k.slice(0, 26)) + '</text><rect x="190" y="' + (i * rowH + 4) + '" width="' + w.toFixed(1) + '" height="16" fill="var(--c1)"><title>' + h(k + ': ' + o[k]) + '</title></rect><text x="' + (196 + w).toFixed(1) + '" y="' + (i * rowH + 17) + '" class="tick">' + o[k] + '</text>'; }).join('') + '</svg>';
  }
  function draw() {
    var q = $('q').value.trim().toLowerCase(), u = $('user').value, a = $('action').value, t = $('type').value, f = $('from').value, to = $('to').value, pr = $('prior').checked;
    var list = rows.filter(function (r) { var d = r.actionDate.slice(0, 10); return (!u || (r.user || '—') === u) && (!a || (r.action || '—') === a) && (!t || (r.type || '—') === t) && (!f || d >= f) && (!to || d <= to) && (!pr || r.prior) && (!q || (r.memo + ' ' + r.type + ' ' + r.ref + ' ' + r.user).toLowerCase().indexOf(q) >= 0); });
    var byAction = {}, byUser = {}, changes = {}; list.forEach(function (r) { byAction[r.action || '—'] = (byAction[r.action || '—'] || 0) + 1; byUser[r.user || '—'] = (byUser[r.user || '—'] || 0) + 1; if (!/^add/i.test(r.action)) changes[r.user || '—'] = (changes[r.user || '—'] || 0) + 1; });
    var kpi = function (l, v) { return '<div class="mk-kpi"><div class="lbl">' + h(l) + '</div><div class="val">' + h(v) + '</div></div>'; };
    var dr = list.reduce(function (s, r) { return s + (r.debit || 0); }, 0), cr = list.reduce(function (s, r) { return s + (r.credit || 0); }, 0);
    $('mk-body').innerHTML = '<div class="mk-kpis">' + kpi('Rows', list.length) + kpi('Users', Object.keys(byUser).length) + kpi('Prior-period changes', list.filter(function (r) { return r.prior; }).length) + kpi('Deletions', list.filter(function (r) { return /^delet/i.test(r.action); }).length) + '</div>' +
      '<h3>By action</h3><div class="mk-kpis">' + Object.keys(byAction).sort(function (x, y) { return byAction[y] - byAction[x]; }).map(function (k) { return kpi(k, byAction[k]); }).join('') + '</div>' +
      (Object.keys(changes).length ? '<div class="mk-card" style="margin:12px 0"><h3>Changes and deletions by user</h3>' + bars(changes) + '</div>' : '') +
      '<div class="mk-scroll"><table class="mk-grid"><thead><tr><th>Action date</th><th>User</th><th>Action</th><th>Type</th><th>Transaction date</th><th>Memo</th><th class="num">Debit ($)</th><th class="num">Credit ($)</th><th>Flag</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) { return '<tr' + (r.prior ? ' class="neg"' : '') + '><td>' + h(r.actionDate) + '</td><td>' + h(r.user) + '</td><td>' + h(r.action) + '</td><td>' + h(r.type) + (r.ref ? ' ' + h(r.ref) : '') + '</td><td>' + h(r.txnDate) + '</td><td>' + h(r.memo) + '</td><td class="num">' + money(r.debit) + '</td><td class="num">' + money(r.credit) + '</td><td>' + (r.prior ? 'Prior period' : '') + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr class="k-total"><td colspan="6">Total</td><td class="num">' + money(Math.round(dr * 100) / 100) + '</td><td class="num">' + money(Math.round(cr * 100) / 100) + '</td><td></td></tr></tfoot>' : '<tr><td colspan="9" class="muted">' + (rows.length ? 'No rows match.' : 'The export has no rows for this period.') + '</td></tr></tbody>') + '</table></div>';
    var sum = Object.keys(byAction).reduce(function (s, k) { return s + byAction[k]; }, 0), missing = rows.filter(function (r) { return !r.actionDate || !r.user || !r.action; }).length;
    var checks = [[sum === list.length, 'Counts by action sum to the rows shown', list.length + ' of ' + rows.length + ' rows'], [rows.length ? missing === 0 : null, 'Every row has an action date, a user and an action', missing ? missing + ' rows without one' : rows.length + ' rows']];
    var fails = checks.filter(function (c) { return c[0] === false; }).length, done = checks.filter(function (c) { return c[0] === true; }).length;
    $('mk-banner').className = 'mk-banner ' + (fails ? 'fail' : done ? 'pass' : 'na');
    $('mk-banner').innerHTML = '<strong>' + (fails ? '⚠ Validation: ' + fails + ' check' + (fails > 1 ? 's' : '') + ' failed' : '✓ Validation: ' + done + '/' + done + ' checks passed') + '</strong> · Snapshot from a MYOB export — not live<ul>' +
      checks.map(function (c) { return '<li class="' + (c[0] === false ? 'bad' : c[0] === true ? 'ok' : 'na') + '">' + (c[0] === false ? '✗ ' : c[0] === true ? '✓ ' : '– ') + h(c[1]) + ' — ' + h(c[2]) + '</li>'; }).join('') + '</ul>';
  }
  $('q').addEventListener('input', draw);
  ['user', 'action', 'type', 'from', 'to', 'prior'].forEach(function (id) { $(id).addEventListener('change', draw); });
  $('style').addEventListener('change', function () { document.documentElement.classList.toggle('style-mysmb', this.value === 'mysmb'); });
  $('pdf').addEventListener('click', function () { window.print(); });
  draw();
})();
</script>
</body>
</html>
```

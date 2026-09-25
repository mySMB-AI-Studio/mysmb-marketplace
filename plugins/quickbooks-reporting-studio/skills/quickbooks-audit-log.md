---
name: quickbooks-audit-log
description: QuickBooks Online Audit Log (Q21) from the QuickBooks Audit Log export the user attaches — events by type and user with filters. Use when the user asks for the audit log, who changed what, recent edits or deletions, user activity, or attaches a QuickBooks Audit Log export.
---

# Audit Log (Q21)

Use when the user asks for the audit log, who changed what, recent edits or deletions, user activity, or attaches a QuickBooks Audit Log export. The Audit Log is **not available through the QuickBooks Accounting API**, so this report is built from an export and saved as a **static** (frozen) page. Do not call QuickBooks tools for it.

QuickBooks location: Reports › Standard reports › Business overview › Audit Log. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q21. Delivery: Wave 3 (Train 06).

## Build

1. If no export is attached, ask for it: *QuickBooks › Reports › Audit Log › set User, Date Changed and Events › export (or print to PDF) and attach the file here.*
2. Read the export. Take the company name and date range from its header; if the company is not in the file use `null` (the page shows "N/A — not in source"). For each event row take: `date` (Date Changed, as written, ISO `YYYY-MM-DD HH:MM` when the date is unambiguous), `user`, `event` (the full Event / History text), `name` and `amount` (as text, when present). Do not invent, merge or drop rows.
3. Build the JSON: `{"company": …, "period": "<d Month yyyy> - <d Month yyyy>", "fileName": "<attached file name>", "rows": [ … ]}`. **Escape every `<` as `\u003c`** so event text can never close the script tag.
4. Replace `{{DATA}}` in the page below with that JSON — nothing else. Save with `artifact_save`: `title` = "<Company> — Audit Log — <period>", `fileName` = `quickbooks-audit-log.html`, `tags` = ["quickbooks","audit-log","export"]. Do not pass `dataBindings` or `connectors`.
5. Completion note: number of events, the period, that the page is a frozen copy of the export, and the top event types.

## Members

| Member / view | How |
|---|---|
| Audit Log | From the attached export: events by type and user, filters by user, event type, date and text |
| Intuit Intelligence Audit Log | N/A — not in the export |

## Validation (shown in the banner)

- Counts by event type sum to the events shown

## QA test script

1. Export the Audit Log for a week from the golden-set company and attach it. Confirm every row appears once and the counts by type add up.
2. Filter by user, event type and date; search a document number. Compare with QuickBooks: '10 Sept, 9:24 am — Melanie Burrows — Added Bill Payment (Cheque) to Yucheng Sun - USD for $1000.00'; system rows 'Online Banking Administration — Manually updated Online Banking accounts for Wise Business'.
3. Include an event whose text contains `<` or `</script>` and confirm the page still renders.

## Page

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audit Log</title>
<style>:root{--accent:#2CA01C;--btn:#236B32;--btn-ink:#FFFFFF;--ink:#393A3D;--muted:#6B6C72;--line:#E3E5E8;--canvas:#F4F5F8;--card:#FFFFFF;--th:#6B6C72;--zebra:transparent;--neg:#D52B1E;--pos:#2CA01C;--pass-bg:#EAF6E8;--fail-bg:#FDECEA;--band:#FFFFFF;--band-ink:#393A3D;--cover:#1B2A4A;--cover-ink:#FFFFFF;--c1:#2CA01C;--c2:#8D9096;--c3:#0077C5;--c4:#00A6A4;--c5:#7B61FF;--c6:#E0457B;--d1:#2CA01C;--d2:#00A6A4;--d3:#7B61FF;--d4:#E0457B;--d5:#0077C5;--d6:#8D9096}
:root[data-myhub-theme='dark']{--accent:#53C43F;--btn:#2E8B41;--btn-ink:#FFFFFF;--ink:#E6E8EB;--muted:#A3A7AE;--line:#33363C;--canvas:#16181B;--card:#1F2226;--th:#A3A7AE;--neg:#FF6B5E;--pos:#53C43F;--pass-bg:#18301A;--fail-bg:#3A1B19;--band:#1F2226;--band-ink:#E6E8EB;--cover:#22324F;--cover-ink:#FFFFFF;--c1:#53C43F;--c2:#80858D;--c3:#3FA2E8;--c4:#2CC7C4;--c5:#9A86FF;--c6:#F06A96;--d1:#53C43F;--d2:#2CC7C4;--d3:#9A86FF;--d4:#F06A96;--d5:#3FA2E8;--d6:#80858D}
:root.style-mysmb{--accent:#007A6E;--btn:#007A6E;--zebra:#E6F7F5;--band:#007A6E;--band-ink:#FFFFFF;--cover:#007A6E;--c1:#007A6E;--c3:#00B0A0;--d1:#007A6E;--d2:#00B0A0;--pos:#007A6E}
:root[data-myhub-theme='dark'].style-mysmb{--accent:#2BB3A3;--btn:#138A7D;--zebra:#15302D;--band:#0E5A52;--band-ink:#FFFFFF;--cover:#0E5A52;--c1:#2BB3A3;--c3:#3CCFBF;--d1:#2BB3A3;--d2:#3CCFBF;--pos:#2BB3A3}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--canvas);color:var(--ink);font:14px/1.45 "Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
#qb-controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:12px}
.ctl{display:flex;flex-direction:column;font-size:12px;color:var(--muted);gap:4px}
.ctl select,.ctl input[type=date],.qb-filter{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:4px;padding:6px 8px}
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
.btns button#qb-xlsx{background:var(--btn);color:var(--btn-ink)}
#qb-status{font-size:12px;color:var(--muted);min-height:16px;margin:0 0 6px}
.qb-banner{border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;border:1px solid var(--line)}
.qb-banner.pass{background:var(--pass-bg)}.qb-banner.fail{background:var(--fail-bg);border-color:var(--neg)}
.qb-banner ul{margin:6px 0 0;padding-left:18px}.qb-banner li.bad{color:var(--neg);font-weight:600}.qb-banner li.na{color:var(--muted)}
.qb-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px 24px;margin-bottom:12px}
#qb-head{text-align:center;padding:8px 0 16px;background:var(--band);color:var(--band-ink);border-radius:6px}
:root.style-mysmb #qb-head{text-align:left;padding:14px 18px;margin-bottom:12px}
#qb-head .co{font-size:18px;font-weight:700}#qb-head .ti{font-size:14px}#qb-head .pe{font-size:14px;font-weight:600}
table{border-collapse:collapse;width:100%}
th{font-size:11px;font-variant:small-caps;letter-spacing:.04em;text-transform:lowercase;color:var(--th);font-weight:600;text-align:left;padding:8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card)}
.qb-grid th{cursor:pointer;user-select:none}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--zebra)}
.num{text-align:right;white-space:nowrap}
.k-header td{font-weight:600;border-bottom:0}.k-total td{font-weight:700;border-top:1px solid var(--ink)}
.neg{color:var(--neg)}
.muted{color:var(--muted)}.qb-err{color:var(--neg)}
.qb-scroll{overflow-x:auto}
.qb-filter{margin:0 0 8px;min-width:220px}
:root.dens-compact td{padding:3px 8px}:root.dens-compact body{font-size:12.5px}
.qb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.qb-kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.qb-kpi .lbl{font-size:11px;font-variant:small-caps;text-transform:lowercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.qb-kpi .val{font-size:22px;font-weight:700;margin-top:2px}.qb-kpi .sub{font-size:12px;color:var(--muted)}
.chip{display:inline-block;font-size:11px;font-weight:700;border-radius:10px;padding:1px 8px;margin-top:4px}
.chip.up{background:var(--pass-bg);color:var(--pos)}.chip.down{background:var(--fail-bg);color:var(--neg)}
.qb-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.qb-card h2,.qb-card h3{font-size:15px;margin:0 0 10px}
svg{width:100%;height:auto;max-height:300px;display:block;margin:0 auto}svg .axis{stroke:var(--line);stroke-width:1}svg .tick{fill:var(--muted);font-size:11px}
svg .donut-c{fill:var(--ink);font-size:15px;font-weight:700}
.qb-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--muted);margin-top:6px}
.qb-legend i,.qb-donut li i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.qb-donut{display:flex;gap:16px;align-items:center}.qb-donut svg{max-width:180px}.qb-donut ul{list-style:none;padding:0;margin:0;font-size:13px}.qb-donut li{margin:3px 0}
#qb-foot{color:var(--muted);font-size:12px;text-align:center;padding:12px 0 4px}
#qb-sources{font-size:12.5px;color:var(--muted)}#qb-sources h2{font-size:13px;color:var(--ink)}
.persona-summary .detail-block{display:none}
.persona-summary .keep-detail tr.detail-block{display:table-row}
.skel{height:14px;border-radius:4px;background:var(--line);margin:8px 0;opacity:.6}
.page{break-after:page}
@media (max-width:720px){.btns{margin-left:0}.cz{grid-template-columns:1fr}}
@media print{body{background:var(--card);padding:0}#qb-controls,#qb-status,.no-print,.qb-filter{display:none!important}.qb-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 portrait;margin:14mm}}</style>
</head>
<body class="persona-detail">
<div id="qb-controls" aria-label="Audit log filters">
<label class="ctl">Search<input type="search" id="q" class="qb-filter" placeholder="Search events" style="margin:0"></label>
<label class="ctl">User<select id="user"><option value="">All users</option></select></label>
<label class="ctl">Events<select id="type"><option value="">All events</option></select></label>
<label class="ctl">From<input type="date" id="from"></label>
<label class="ctl">To<input type="date" id="to"></label>
<label class="ctl">Style<select id="style"><option value="qbo">QuickBooks look</option><option value="mysmb">mySMB house style</option></select></label>
<div class="ctl btns"><button type="button" id="pdf">Download PDF</button></div>
</div>
<div id="qb-banner" class="qb-banner pass" role="region" aria-label="Validation"></div>
<main class="qb-card"><header id="qb-head"></header><div id="qb-body"></div><footer id="qb-foot"></footer></main>
<section id="qb-sources" class="qb-card"><h2>Sources &amp; limitations</h2><ul id="src"></ul></section>
<script>
var AUDIT = {{DATA}};
(function () {
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var $ = function (id) { return document.getElementById(id); }, rows = (AUDIT.rows || []).map(function (r) { var t = r.type || (String(r.event || '').match(/^(Added|Edited|Deleted|Voided|Signed in|Signed out|Sent|Printed|Reconciled|Manually updated|Applied|Unapplied|Matched|Categorised|Categorized)\b/i) || [])[1] || 'Other'; return Object.assign({}, r, { type: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() }); });
  var uniq = function (k) { var o = {}; rows.forEach(function (r) { o[r[k] || '—'] = 1; }); return Object.keys(o).sort(); };
  uniq('user').forEach(function (u) { $('user').insertAdjacentHTML('beforeend', '<option>' + h(u) + '</option>'); });
  uniq('type').forEach(function (u) { $('type').insertAdjacentHTML('beforeend', '<option>' + h(u) + '</option>'); });
  $('qb-head').innerHTML = '<div class="co">' + h(AUDIT.company || 'N/A — not in source') + '</div><div class="ti">Audit Log</div><div class="pe">' + h(AUDIT.period || '') + '</div>';
  $('qb-foot').textContent = 'From the QuickBooks Audit Log export · ' + h(AUDIT.fileName || 'attached file') + ' · ' + rows.length + ' events';
  $('src').innerHTML = '<li>Source: QuickBooks › Reports › Audit Log export attached by the user (' + h(AUDIT.fileName || 'file') + '). The Audit Log is not available through the QuickBooks Accounting API, so this report is a frozen copy of that export.</li><li>Company and period are read from the export header' + (AUDIT.company ? '' : ' — the company name was not in the export (N/A — not in source)') + '.</li><li>Intuit Intelligence audit log: N/A — not in the export.</li><li>Decision support only — not audit, tax or legal advice.</li>';
  function draw() {
    var q = $('q').value.trim().toLowerCase(), u = $('user').value, t = $('type').value, f = $('from').value, to = $('to').value;
    var list = rows.filter(function (r) { var d = String(r.date || '').slice(0, 10); return (!u || (r.user || '—') === u) && (!t || r.type === t) && (!f || d >= f) && (!to || d <= to) && (!q || (r.event + ' ' + (r.name || '') + ' ' + (r.user || '')).toLowerCase().indexOf(q) >= 0); });
    var byType = {}, byUser = {}; list.forEach(function (r) { byType[r.type] = (byType[r.type] || 0) + 1; byUser[r.user || '—'] = (byUser[r.user || '—'] || 0) + 1; });
    var tile = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return '<div class="qb-kpi"><div class="lbl">' + h(k) + '</div><div class="val">' + o[k] + '</div></div>'; }).join(''); };
    $('qb-body').innerHTML = '<h3>Events by type</h3><div class="qb-kpis">' + tile(byType) + '</div><h3>Events by user</h3><div class="qb-kpis">' + tile(byUser) + '</div>' +
      '<div class="qb-scroll"><table class="qb-grid"><thead><tr><th>Date changed</th><th>User</th><th>Event</th><th>Name</th><th class="num">Amount</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) { return '<tr><td>' + h(r.date) + '</td><td>' + h(r.user) + '</td><td>' + h(r.event) + '</td><td>' + h(r.name || '') + '</td><td class="num">' + h(r.amount == null ? '' : r.amount) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">No events match.</td></tr>') + '</tbody></table></div>';
    var sum = Object.keys(byType).reduce(function (s, k) { return s + byType[k]; }, 0);
    $('qb-banner').className = 'qb-banner ' + (sum === list.length ? 'pass' : 'fail');
    $('qb-banner').innerHTML = '<strong>' + (sum === list.length ? '✓ Validation: counts by event type sum to the events shown' : '⚠ Validation: event counts do not add up') + '</strong> · ' + list.length + ' of ' + rows.length + ' events · Snapshot from an export — not live';
  }
  ['q'].forEach(function (id) { $(id).addEventListener('input', draw); });
  ['user', 'type', 'from', 'to'].forEach(function (id) { $(id).addEventListener('change', draw); });
  $('style').addEventListener('change', function () { document.documentElement.classList.toggle('style-mysmb', this.value === 'mysmb'); });
  $('pdf').addEventListener('click', function () { window.print(); });
  draw();
})();
</script>
</body>
</html>
```

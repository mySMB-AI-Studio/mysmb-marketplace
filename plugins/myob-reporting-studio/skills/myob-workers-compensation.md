---
name: MYOB Workers Compensation
description: MYOB Workers Compensation — Estimation of wages (M31) from the MYOB export the user attaches: estimated remuneration by state for a policy or renewal. Use when the user asks for workers compensation, the estimation of wages, estimated remuneration by state, or wages for a workers compensation policy or renewal.
---
# Workers Compensation (M31)

Use when the user asks for workers compensation, the estimation of wages, estimated remuneration by state, or wages for a workers compensation policy or renewal. MYOB's API does **not** expose this report, so it is built from the MYOB export the user attaches and saved as a **static** (frozen) page. Do not call MYOB tools for it.

MYOB location: Reporting → Reports → Payroll → Workers compensation (New) → Estimation of wages. Library: MYOB Reports Prompt Library v1.2 → Prompts → M31. Delivery: Wave 3 (P3, delivery order 52).

## Build

1. If no export is attached, ask for it: *MYOB › Reporting › Reports › Payroll › Workers compensation › open the estimation › Export (if MYOB offers it; otherwise a screenshot or the printed estimation), and attach the file here.*
2. Read the export. Take the business name and dates from its header; if the business is not in the file use `null` (the page shows "N/A — not in source"). One entry per estimation: `period` (Estimation period as written), `created` (Date created, `YYYY-MM-DD`), `states` = `[{"state": "NSW", "remuneration": number, "employees": number or null}]`, `total` (Total estimated remuneration, a number), and `employees` = `[{"name", "state", "remuneration"}]` only when the export lists employees. Pay figures may be shown; **never include tax file numbers, bank details, dates of birth, addresses or contact details**. Do not invent, merge or drop rows.
3. Build the JSON: `{"company": …, "fileName": "<attached file name>", "estimations": [ … ]}`. **Escape every `<` as `\u003c`** so text from the export can never close the script tag.
4. Replace `{{DATA}}` in the page below with that JSON — nothing else. Save with `artifact_save`: `title` = "MYOB Workers Compensation", `description` = "<Business> · <period> · from the MYOB export", `fileName` = `myob-workers-compensation.html`, `tags` = ["myob","M31","export"]. Do not pass `dataBindings` or `connectors`.
5. Completion note: the number of rows, the period, that the page is a frozen copy of the export (attach a new export to update it), and the validation result.

## Members

| Member / view | How |
|---|---|
| Estimation of wages | Each estimation: period, date created, states, total estimated remuneration |
| Remuneration by state | Table and bar chart per estimation |
| Employees | Per employee and state, when the export lists them |
| New estimation | N/A — an action in MYOB, not a report |
| Live data | N/A — MYOB's API does not expose workers compensation estimations |

## Validation (shown in the banner)

- Σ states = total estimated remuneration (every estimation)
- Σ employees = their state's remuneration (when employees are listed)

## QA test script

1. Attach an export from the golden-set file. Confirm every row appears once and the validation passes. Captured empty in the sample file ("No estimation reports created yet") — create an estimation in the golden-set file, export it and confirm the state totals add up to MYOB's total.
2. Use every filter, switch Branding to mySMB and back, and switch the workspace to the dark theme.
3. Include text with `<` or `</script>` in a row and confirm the page still renders.

## Page

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Workers Compensation</title>
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
<div id="mk-controls" aria-label="Report controls">
<label class="ctl">Estimation<select id="est"></select></label>
<label class="ctl">State<select id="state"><option value="">All states</option></select></label>
<label class="ctl">Branding<select id="style"><option value="myob">MYOB</option><option value="mysmb">mySMB</option></select></label>
<div class="ctl btns"><button type="button" id="pdf">Download PDF</button></div>
</div>
<div id="mk-banner" class="mk-banner pass" role="region" aria-label="Validation"></div>
<main class="mk-card"><header id="mk-head"></header><div id="mk-body"></div><footer id="mk-foot"></footer></main>
<section id="mk-sources" class="mk-card" aria-label="Sources and limitations"><h2>Sources &amp; limitations</h2><ul id="src"></ul></section>
<script>
var WC = {{DATA}};
(function () {
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { if (v == null || v === '') return null; var n = Number(String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')); return isFinite(n) ? n : null; }
  function money(v) { return v == null ? 'N/A' : (v < 0 ? '(' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : ''); }
  var r2 = function (n) { return Math.round(n * 100) / 100; }, $ = function (id) { return document.getElementById(id); };
  var E = (WC.estimations || []).map(function (e) {
    var st = (e.states || []).map(function (s) { return { state: String(s.state || '—'), rem: num(s.remuneration), emps: s.employees == null ? null : Number(s.employees) }; });
    return { period: e.period || '', created: String(e.created || '').slice(0, 10), total: num(e.total), states: st, employees: (e.employees || []).map(function (p) { return { name: p.name || '', state: String(p.state || '—'), rem: num(p.remuneration) }; }) };
  });
  E.forEach(function (e, i) { $('est').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + h(e.period || 'Estimation ' + (i + 1)) + (e.created ? ' (created ' + h(e.created) + ')' : '') + '</option>'); });
  $('est').disabled = E.length < 2;
  $('mk-foot').textContent = 'From the MYOB Workers compensation export · ' + (WC.fileName || 'attached file') + ' · ' + E.length + ' estimation' + (E.length === 1 ? '' : 's');
  $('src').innerHTML = '<li>Source: MYOB › Reporting › Reports › Payroll › Workers compensation › Estimation of wages, exported or printed and attached by the user (' + h(WC.fileName || 'file') + '). MYOB\'s API does not expose workers compensation estimations, so this report is a frozen copy — not live.</li>' +
    '<li>Estimated remuneration is MYOB\'s forecast for the policy period, not wages paid. Check the state definitions of remuneration with each state\'s insurer before you declare.</li>' +
    '<li>Pay figures are shown; tax file numbers, bank details, dates of birth, addresses and contact details are never included.</li><li>New estimation: N/A — an action in MYOB, not a report.</li><li>Decision support only — not audit, tax or legal advice.</li>';
  function bars(list) {
    var mx = Math.max.apply(null, list.map(function (s) { return s.rem || 0; }).concat([1])), W = 640, rowH = 28;
    return '<svg viewBox="0 0 ' + W + ' ' + (list.length * rowH + 8) + '" role="img" aria-label="Estimated remuneration by state">' + list.map(function (s, i) { var w = Math.max(2, (W - 260) * (s.rem || 0) / mx); return '<text x="0" y="' + (i * rowH + 18) + '" class="tick">' + h(s.state) + '</text><rect x="80" y="' + (i * rowH + 5) + '" width="' + w.toFixed(1) + '" height="18" fill="var(--c1)"><title>' + h(s.state + ': ' + money(s.rem)) + '</title></rect><text x="' + (86 + w).toFixed(1) + '" y="' + (i * rowH + 18) + '" class="tick">' + h(money(s.rem)) + '</text>'; }).join('') + '</svg>';
  }
  function draw() {
    var e = E[Number($('est').value || 0)], sf = $('state').value;
    $('mk-head').innerHTML = '<div class="co">' + h(WC.company || 'N/A — not in source') + '</div><div class="ti">Workers Compensation — Estimation of Wages</div><div class="pe">' + h(e ? e.period : '') + '</div><div class="mk-src"><span class="mk-badge">MYOB</span>From the MYOB export</div>';
    var checks = [];
    if (!e) {
      $('mk-body').innerHTML = '<p class="muted">No estimation reports created yet.</p>';
      checks.push([null, 'Σ states = total estimated remuneration (every estimation)', 'No estimations in the export']);
    } else {
      var opts = '<option value="">All states</option>' + e.states.map(function (s) { return '<option' + (s.state === sf ? ' selected' : '') + '>' + h(s.state) + '</option>'; }).join('');
      $('state').innerHTML = opts; $('state').disabled = !e.states.length;
      var st = e.states.filter(function (s) { return !sf || s.state === sf; }), sum = r2(e.states.reduce(function (s, x) { return s + (x.rem || 0); }, 0));
      var emps = e.employees.filter(function (p) { return !sf || p.state === sf; }), n = e.states.reduce(function (s, x) { return s + (x.emps || 0); }, 0);
      var kpi = function (l, v) { return '<div class="mk-kpi"><div class="lbl">' + h(l) + '</div><div class="val">' + h(v) + '</div></div>'; };
      $('mk-body').innerHTML = '<div class="mk-kpis">' + kpi('Total estimated remuneration', money(e.total)) + kpi('States', e.states.length) + kpi('Employees', n || e.employees.length || 'N/A') + kpi('Date created', e.created || 'N/A') + '</div>' +
        '<h3>Estimated remuneration by state</h3><div class="mk-scroll"><table class="mk-grid"><thead><tr><th>State</th><th class="num">Employees</th><th class="num">Estimated remuneration ($)</th><th class="num">Share</th></tr></thead><tbody>' +
        (st.length ? st.map(function (s) { return '<tr><td>' + h(s.state) + '</td><td class="num">' + (s.emps == null ? '' : s.emps) + '</td><td class="num">' + money(s.rem) + '</td><td class="num">' + (sum ? ((s.rem || 0) / sum * 100).toFixed(1) + '%' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">No states in this estimation.</td></tr>') +
        '</tbody><tfoot><tr class="k-total"><td>Total</td><td class="num">' + (st.reduce(function (s, x) { return s + (x.emps || 0); }, 0) || '') + '</td><td class="num">' + money(sf ? r2(st.reduce(function (s, x) { return s + (x.rem || 0); }, 0)) : e.total) + '</td><td></td></tr></tfoot></table></div>' +
        (st.length ? '<div class="mk-card" style="margin:12px 0"><h3>Estimated remuneration by state</h3>' + bars(st) + '</div>' : '') +
        (emps.length ? '<h3>Employees</h3><div class="mk-scroll"><table class="mk-grid"><thead><tr><th>Employee</th><th>State</th><th class="num">Estimated remuneration ($)</th></tr></thead><tbody>' + emps.map(function (p) { return '<tr><td>' + h(p.name) + '</td><td>' + h(p.state) + '</td><td class="num">' + money(p.rem) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
        '<h3>Estimation reports</h3><div class="mk-scroll"><table class="mk-grid"><thead><tr><th>Estimation period</th><th>Date created</th><th>Estimated states</th><th class="num">Total estimated remuneration ($)</th></tr></thead><tbody>' +
        E.map(function (x) { return '<tr><td>' + h(x.period) + '</td><td>' + h(x.created) + '</td><td>' + h(x.states.map(function (s) { return s.state; }).join(', ')) + '</td><td class="num">' + money(x.total) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var bad = E.filter(function (x) { return x.total == null || Math.abs(r2(x.states.reduce(function (s, y) { return s + (y.rem || 0); }, 0)) - x.total) >= 0.005; });
      checks.push([bad.length ? false : true, 'Σ states = total estimated remuneration (every estimation)', bad.length ? bad.map(function (x) { return (x.period || 'an estimation') + ': states ' + money(r2(x.states.reduce(function (s, y) { return s + (y.rem || 0); }, 0))) + ' vs total ' + money(x.total); }).join('; ') : E.length + ' estimation' + (E.length === 1 ? '' : 's')]);
      var listed = E.filter(function (x) { return x.employees.length; }), off = [];
      listed.forEach(function (x) { x.states.forEach(function (s) { var t = r2(x.employees.filter(function (p) { return p.state === s.state; }).reduce(function (a, p) { return a + (p.rem || 0); }, 0)); if (Math.abs(t - (s.rem || 0)) >= 0.005) off.push((x.period || '') + ' ' + s.state); }); });
      checks.push([listed.length ? !off.length : null, 'Σ employees = their state\'s remuneration (when employees are listed)', listed.length ? (off.length ? 'Does not add up: ' + off.join(', ') : 'Every state adds up') : 'The export lists no employees']);
    }
    var fails = checks.filter(function (c) { return c[0] === false; }).length, done = checks.filter(function (c) { return c[0] === true; }).length;
    $('mk-banner').className = 'mk-banner ' + (fails ? 'fail' : done ? 'pass' : 'na');
    $('mk-banner').innerHTML = '<strong>' + (fails ? '⚠ Validation: ' + fails + ' check' + (fails > 1 ? 's' : '') + ' failed' : done ? '✓ Validation: ' + done + '/' + done + ' check' + (done > 1 ? 's' : '') + ' passed' : '– Validation: no check could run') + '</strong> · Snapshot from a MYOB export — not live<ul>' +
      checks.map(function (c) { return '<li class="' + (c[0] === false ? 'bad' : c[0] === true ? 'ok' : 'na') + '">' + (c[0] === false ? '✗ ' : c[0] === true ? '✓ ' : '– ') + h(c[1]) + ' — ' + h(c[2]) + '</li>'; }).join('') + '</ul>';
  }
  $('est').addEventListener('change', function () { $('state').value = ''; draw(); });
  $('state').addEventListener('change', draw);
  $('style').addEventListener('change', function () { document.documentElement.classList.toggle('style-mysmb', this.value === 'mysmb'); });
  $('pdf').addEventListener('click', function () { window.print(); });
  draw();
})();
</script>
</body>
</html>
```

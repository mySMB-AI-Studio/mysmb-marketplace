---
name: quickbooks-report-foundation
description: Shared build recipe, controls contract, validation rules, QuickBooks styling and the tested report kit for every QuickBooks Online report (AGT-003). Load it together with the family skill for any QuickBooks report, dashboard or report pack.
---

# QuickBooks report foundation

Use when you build any QuickBooks Online report, dashboard or report pack. Load this skill first, then the family skill (for example `quickbooks-profit-and-loss`). This file carries the tested report kit and stylesheet, and every family skill carries its own tested `dataBindings` and report config. You assemble them. You do not write report code from scratch.

Spec: QuickBooks Reports Prompt Library v1.1 (Q00–Q39, Reporting Library Catalogue RPT/LIB rows, Operating Model v0.1). Waves 1 and 2 are built. Each family skill traces its FULL PROMPT sections to this build.

## Build a report (every family)

1. **Pick the family skill** that matches the request. (The reports catalogue, Q02, is a static page with its own steps.) If the family is not built yet, say so and offer the closest built report or a QuickBooks export (see the agent's routing table). Never approximate a report from adjacent data.
2. **Discovery call.** Call the family's primary tool once, with the family's default inputs, and call `qbo_query` with `SELECT * FROM CompanyInfo` once. You need three things from these calls:
   - Confirm that QuickBooks is connected. If a call fails with a connection error, tell the user to connect QuickBooks under Settings → Connections, and stop.
   - Check that the response has the shape the family skill describes (QuickBooks report JSON is `Header` / `Columns` / `Rows.Row[]`, with sections carrying `group`, `Header`, `Rows` and `Summary`).
   - Read `CompanyName` and `FiscalYearStartMonth` for the date defaults. Do not copy any returned figure into the document.
3. **dataBindings.** Copy the family's `dataBindings` JSON exactly. Change only the `default` values of date inputs, as the family skill's *Date defaults* line says. A date default is `YYYY-MM-DD` or `"today"`. Keep every input name, option, binding id, tool name and param. The `display` default is a JSON string: set `p` (period preset), `a` (as-of preset), `c` (compare mode) and `v` (report view or member) to match the request. Keep every other key.
4. **Report config.** Copy the family's report config JS exactly. Change only the `defaults` object so that it equals the manifest defaults, with `"today"` written as today's date (`YYYY-MM-DD`). If the discovery call showed a label or group the config does not recognise, you may widen the matching regular expression in `render`. Change nothing else.
5. **Assemble** one HTML document from the skeleton below. Replace `{{TITLE}}` with the report title, `{{CSS}}` with the stylesheet, `{{KIT}}` with the report kit and `{{CFG}}` with the report config, all verbatim. Never edit, shorten, reformat or "improve" the kit or the stylesheet: they are tested as one unit, and the platform validates the document against the bindings.
6. **Save** with `artifact_save`: `title` = "<Company> — <Report name> — <period>", `fileName` from the family skill, a one-line `description`, the family `tags`, `content` = the document and `dataBindings` = the manifest. Do not pass `connectors`, because a live report derives them. Never paste the HTML into chat.
7. **Completion note.** Keep it to 3–6 lines:
   - that the report is live and refreshes on open;
   - the controls the reader can change;
   - the validation checks and whether they passed on the discovery data;
   - any N/A items (the family skill lists them);
   - that Download PDF / Download Excel are in the report, and that the report window's Download and Share save a frozen snapshot.

The user never has to choose an output format. Every report is HTML with Download PDF (print to PDF) and Download Excel (.xlsx) buttons. If the user asks for Excel or PDF, build the report and point them to those buttons.

## Controls contract (LIB-002, Q38, Q39)

The kit renders the control row from the config, so every report has the same grammar:

- **Client selector (LIB-002).** It lists the companies this QuickBooks connection can access. The `quickbooks-accounting` connector is authorised for exactly one company (realm), so it shows that one company, taken from CompanyInfo. The report holds only that company's data. To switch client, connect another QuickBooks company under Settings → Connections. Never type or guess a client name. When CompanyInfo returns no name, the header says "N/A — not in source".
- **Period controls.** A Report period preset (Today … Last financial year, Last 30 days, Since 60/90/365 days ago, Custom) sits next to editable From / To dates. Or As of with presets (Today, End of last month, End of last quarter, End of last financial year, Custom). Presets use the company's financial-year start (CompanyInfo, then Preferences; 1 July only as a flagged fallback). **Relative presets roll forward**: a saved "This financial year to date" report is recomputed to today's window each time it is opened.
- Accounting method (Cash | Accrual) where the report takes it; Display columns by; Compare to (previous period / previous year / year-to-date, with $ and % change); Report (the family members); View as (persona).
- **Customise** (display only, never refetches): Show cents, Divide by 1000, Except zero amounts, negative style (-100 / (100) / 100-), Show in red, Header, Footer, Compact | 100% view, and Style (**QuickBooks look** by default, or the **mySMB house style** toggle). These live in the one `display` input so downloads keep them.
- **Delivery (Q39).** Download PDF (print stylesheet, A4), Download Excel (a real .xlsx: one sheet per table with a header block, A$ number format, bold totals, a Validation sheet and a Parameters sheet), Open in QuickBooks (a classic report deep link where the library gives a token). Host Download and Share produce a self-contained snapshot. Email is done from the workspace, not the report.
- **Parameter contract (Q38).** The Parameters sheet and the deep link use QuickBooks' classic `reportv2` names: `token`, `date_macro`, `low_date`, `high_date`, `cash_basis`, `divideby1000`, `hidecents`, `exceptzeros`, `negativenums`, `negativered`, `show_header_title` / `range` / `company`. The deep link carries only `token` + `date_macro` (a named preset). The `low_date` / `high_date` date format is unconfirmed, so verify the round trip on first run.
- **Persona modes.** Client and Executive give summary mode (account lines hidden; headline totals, charts and validation kept). Bookkeeper and Practitioner give detail mode. A failed check is never hidden.
- **Snapshot mode.** Downloads and share links freeze the data. The report reads the period and basis from the QuickBooks report Header (the data itself), disables the controls that refetch, keeps the display controls, and says the figures are frozen.

## Data and validation rules

- Only `quickbooks-accounting` tools. Never invent, estimate or reuse example figures. Anything missing is "N/A — not in source" and is listed under Sources & limitations. A tool that returns no rows is *unavailable*, not zero.
- Every family has STEP 4 checks. The kit recomputes them on every load and every control change and shows them in the validation banner: Pass, Fail (red, listed first) or N/A (cannot be computed), with the data timestamp, the financial-year source and the mechanism used.
- Sign and classification: QuickBooks can return credits where you expect debits (for example a negative Cost of Sales). The report shows the figures as QuickBooks returned them and adds a note. It never silently flips a sign.
- Connector limits that the reports state rather than work around: one company per connection; the ageing reports age as of today (`report_date`, `aging_period`, `num_periods`, `aging_method` and `past_due` are not passed by the connector yet); the Tax Summary has returned no rows on a live company; PAYG, payroll, employee and ATO reports live in Employment Hero; the Audit Log is UI-only.
- If the user needs data the connector does not expose, ask them for the QuickBooks export (Reports › open the report › set the controls › Export › Excel). Read the company, report name, period and basis from the export header and confirm them. Then save a STATIC report (no `dataBindings`) with `connectors: ["quickbooks-accounting"]` and say it is frozen.
- Financial output is decision support, not audit, tax or legal advice.

## Spec trace (applies to every family)

| Library v1.1 element | Where it is implemented |
|---|---|
| (a) Purpose & intended users | Persona modes (View as); family skill trigger |
| (b) Data, metrics, filters, calculations | Family `dataBindings` (tool mapping) and STEP 4 checks in the config |
| (c) Interactivity & controls | Kit control row (above). Every data control refetches through `MyHubReport.getData` with the full declared input set |
| (d) Layout, charts, appearance | Family config `render` + stylesheet (QuickBooks look; mySMB house-style toggle; light and dark themes) |
| (e) Source & connection mechanisms | Mechanism 4 only: the mySMB custom MCP on the Accounting API v3 (`quickbooks-accounting`). Mechanisms 1–3 (Intuit connector, Intuit open-source MCP, CData) and 5 (Spreadsheet Sync) do not exist inside a workspace; 6 = export fallback (above); 7 = Open in QuickBooks |
| (f) Screenshots | QA compares the report against the Shots tabs (family QA script) |
| (g) Priority / delivery order | Per family skill (Wave 1: Trains 01–02; Wave 2: Trains 03–04) |
| STEP 1 Confirm inputs | Declared inputs with defaults. Ask only for what cannot be defaulted, never for the output format |
| STEP 2 Get data | Live bindings, re-run as the viewer on every open |
| STEP 3 Build per layout spec | Family config `render` (QuickBooks row order, indented sub-accounts, bold "Total for" rows, header block, footer) |
| STEP 4 Validate | Validation banner (recomputed on every load and change) |
| STEP 5 Output — "self-contained, no runtime calls, embedded data window" | Replaced by the platform contract: a live report hydrates on open, and Download / Share produce a self-contained snapshot. The live report can show any period without a pre-embedded data window |

## Kit reference (for adapting a config after discovery)

`QB.app(cfg)` config keys: `title`, `token` / `route` (deep link), `primary` (binding whose Header gives the period in snapshots), `company` / `prefs` (binding ids), `inputs` (role → declared input name: start, end, asAt, basis, columnsBy, cmpStart, cmpEnd, cmpAsAt, persona, display), `defaults`, `uses` (binding id → the declared inputs it consumes; drives which bindings refetch), `tools` (shown in Sources), `columnsBy`, `compare`, `views`, `derive(inputs, fyMonth)`, `roll(inputs, fyMonth, display)`, `noHead`, `render(ctx)` → `{checks:[{name, pass:true|false|null, detail}], na:[], notes:[], title, period}`, `excel(ctx)` → sheets.

The `ctx` passed to `render` has: `data`, `errors`, `err(id)`, `inputs`, `display`, `view`, `compareMode`, `persona`, `company`, `fy`, `currency`, `live`, `today`, `body`, `change(patch, displayPatch)`.

Helpers: `QB.walk` / `find(lines, group, labelRegex, kind)` / `val` / `cols` / `header` / `noData` / `sectionTies` / `mergeCompare` / `compareCols` / `bas`; `money` / `pct` / `periodLine` / `asOfLine` / `footerStamp`; `statement` / `grid` / `kpis` / `bars` / `line` / `donut` / `waterfall`; `preset` / `asAt` / `compare` / `fyStartOf`; `xlsx` / `sheetFromLines`.

## Skeleton

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}}</title>
<style>{{CSS}}</style>
</head>
<body class="persona-detail">
<div id="qb-controls" aria-label="Report controls"></div>
<div id="qb-status" role="status" aria-live="polite">Loading QuickBooks data…</div>
<div id="qb-banner" class="qb-banner" role="region" aria-label="Validation"></div>
<main class="qb-card">
<header id="qb-head"></header>
<div id="qb-body"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
<footer id="qb-foot"></footer>
</main>
<section id="qb-sources" class="qb-card" aria-label="Sources and limitations"></section>
<script>{{KIT}}</script>
<script>{{CFG}}</script>
</body>
</html>
```

## Stylesheet ({{CSS}})

```css
:root{--accent:#2CA01C;--btn:#236B32;--btn-ink:#FFFFFF;--ink:#393A3D;--muted:#6B6C72;--line:#E3E5E8;--canvas:#F4F5F8;--card:#FFFFFF;--th:#6B6C72;--zebra:transparent;--neg:#D52B1E;--pos:#2CA01C;--pass-bg:#EAF6E8;--fail-bg:#FDECEA;--band:#FFFFFF;--band-ink:#393A3D;--cover:#1B2A4A;--cover-ink:#FFFFFF;--c1:#2CA01C;--c2:#8D9096;--c3:#0077C5;--c4:#00A6A4;--c5:#7B61FF;--c6:#E0457B;--d1:#2CA01C;--d2:#00A6A4;--d3:#7B61FF;--d4:#E0457B;--d5:#0077C5;--d6:#8D9096}
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
@media print{body{background:var(--card);padding:0}#qb-controls,#qb-status,.no-print,.qb-filter{display:none!important}.qb-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 portrait;margin:14mm}}
```

## Report kit ({{KIT}}) — copy verbatim

```js
var QB = (function () {
'use strict';
function num(v) {
if (v === null || v === undefined || v === '') return null;
var n = Number(String(v).replace(/,/g, ''));
return isFinite(n) ? n : null;
}
function cd(node) { return ((node && node.ColData) || []).map(function (c) { return c && c.value != null ? c.value : ''; }); }
function totalFor(label) { return /^Total\s+(?!for\s)/i.test(label) ? label.replace(/^Total\s+/i, 'Total for ') : label; }
function near(a, b, tol) { return a != null && b != null && Math.abs(a - b) <= (tol == null ? 0.01 : tol); }
function sum(arr) { var s = 0; arr.forEach(function (v) { if (v != null) s += v; }); return Math.round(s * 100) / 100; }
function cols(rep) {
return ((rep && rep.Columns && rep.Columns.Column) || []).map(function (c, i) {
var key = null, sd = null, ed = null;
(c.MetaData || []).forEach(function (m) { if (m.Name === 'ColKey') key = m.Value; if (m.Name === 'StartDate') sd = m.Value; if (m.Name === 'EndDate') ed = m.Value; });
return { i: i, title: c.ColTitle || '', type: c.ColType || '', key: key, start: sd, end: ed };
});
}
function walk(rep) {
var out = [];
function rec(rows, depth, path) {
(rows || []).forEach(function (r) {
var group = r.group || '';
if (r.Header || (r.Rows && r.Rows.Row)) {
var h = cd(r.Header), label = h[0] || '';
out.push({ kind: 'header', depth: depth, label: label, group: group, path: path.slice(), values: h.slice(1).map(num), raw: h.slice(1) });
rec(r.Rows && r.Rows.Row, depth + 1, path.concat(label));
if (r.Summary) { var s = cd(r.Summary); out.push({ kind: 'total', depth: depth, label: s[0] || '', group: group, path: path.slice(), values: s.slice(1).map(num), raw: s.slice(1) }); }
} else if (r.ColData) {
var d = cd(r), c0 = r.ColData[0] || {};
out.push({ kind: 'row', depth: depth, label: d[0] || '', id: c0.id || null, group: group, path: path.slice(), values: d.slice(1).map(num), raw: d.slice(1) });
} else if (r.Summary) {
var t = cd(r.Summary);
out.push({ kind: 'total', depth: depth, label: t[0] || '', group: group, path: path.slice(), values: t.slice(1).map(num), raw: t.slice(1) });
}
});
}
rec(rep && rep.Rows && rep.Rows.Row, 0, []);
return out;
}
function find(rows, group, labelRe, kind) {
var k = kind || 'total', i;
if (group) for (i = 0; i < rows.length; i++) if (rows[i].group === group && rows[i].kind === k) return rows[i];
if (labelRe) for (i = 0; i < rows.length; i++) if (rows[i].kind === k && labelRe.test(rows[i].label)) return rows[i];
return null;
}
function val(line, col) { return line ? line.values[col == null ? line.values.length - 1 : col] : null; }
function header(rep) { return (rep && rep.Header) || {}; }
function noData(rep) {
var o = header(rep).Option || [];
for (var i = 0; i < o.length; i++) if (o[i].Name === 'NoReportData' && String(o[i].Value) === 'true') return true;
return !(rep && rep.Rows && rep.Rows.Row && rep.Rows.Row.length);
}
function companyInfo(q) {
var list = q && q.QueryResponse && q.QueryResponse.CompanyInfo;
var ci = (list && list[0]) || (q && q.CompanyInfo) || null;
return ci ? { name: ci.CompanyName || ci.LegalName || null, legal: ci.LegalName || null, country: ci.Country || null, fyMonth: ci.FiscalYearStartMonth || null } : null;
}
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthIdx(m) {
if (m == null) return null;
if (typeof m === 'number') return m >= 1 && m <= 12 ? m : null;
var i = MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(String(m).toLowerCase());
return i >= 0 ? i + 1 : null;
}
function fiscalStart(ciResp, prefsResp) {
var ci = companyInfo(ciResp), m = ci && monthIdx(ci.fyMonth);
if (m) return { month: m, source: 'CompanyInfo' };
var p = prefsResp && (prefsResp.Preferences || prefsResp);
m = p && p.AccountingInfoPrefs && monthIdx(p.AccountingInfoPrefs.FirstMonthOfFiscalYear);
if (m) return { month: m, source: 'Preferences' };
return { month: 7, source: 'Fallback (1 July)' };
}
function homeCurrency(prefsResp, rep) {
var h = header(rep).Currency;
if (h) return h;
var p = prefsResp && (prefsResp.Preferences || prefsResp);
return (p && p.CurrencyPrefs && p.CurrencyPrefs.HomeCurrency && p.CurrencyPrefs.HomeCurrency.value) || 'AUD';
}
var SYM = { AUD: 'A$', NZD: 'NZ$', USD: 'US$', CAD: 'C$', GBP: '£', EUR: '€', PHP: '₱', SGD: 'S$', HKD: 'HK$', JPY: '¥', INR: '₹' };
function symbol(code) { return SYM[code] || (code ? code + ' ' : ''); }
var DISPLAY_DEFAULT = { cents: 1, k: 0, zeros: 1, neg: 'minus', red: 0, hdr: 1, ftr: 1, style: 'qbo', dens: '100', p: 'custom', a: 'custom', c: 'none', v: '', x: '' };
function readDisplay(str) {
var d = {}, k, src = {};
try { src = JSON.parse(str || '{}') || {}; } catch (e) { src = {}; }
for (k in DISPLAY_DEFAULT) d[k] = src[k] != null ? src[k] : DISPLAY_DEFAULT[k];
return d;
}
function writeDisplay(d) { var o = {}, k; for (k in DISPLAY_DEFAULT) o[k] = d[k]; return JSON.stringify(o); }
function money(v, cur, d) {
if (v === null || v === undefined || v === '') return '';
d = d || DISPLAY_DEFAULT;
var n = Number(v); if (!isFinite(n)) return String(v);
if (d.k) n = n / 1000;
var dp = d.cents && !d.k ? 2 : (d.k ? 1 : 0);
var abs = Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
var s = symbol(cur) + abs + (d.k ? 'k' : '');
if (n < 0 && Number(abs.replace(/,/g, '')) !== 0) s = d.neg === 'paren' ? '(' + s + ')' : d.neg === 'trail' ? s + '-' : '-' + s;
return s;
}
function pct(v, dp) { return v == null || !isFinite(v) ? '' : (v * 100).toFixed(dp == null ? 1 : dp) + '%'; }
function isNeg(v) { return v != null && Number(v) < 0; }
function iso(dt) { return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function parse(s) { var p = String(s).split('-'); return D(+p[0], +p[1], +p[2]); }
function addDays(dt, n) { return new Date(dt.getTime() + n * 86400000); }
function eom(y, m) { return D(y, m + 1, 0); }
function today() { var t = new Date(); return D(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
function fyStartOf(dt, fyMonth) {
var y = dt.getUTCFullYear(); if (dt.getUTCMonth() + 1 < fyMonth) y -= 1;
return D(y, fyMonth, 1);
}
var PRESETS = [
['today', 'Today'], ['this_week', 'This week'], ['this_week_td', 'This week to date'],
['this_month', 'This month'], ['this_month_td', 'This month to date'],
['this_quarter', 'This quarter'], ['this_quarter_td', 'This quarter to date'],
['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'],
['last_week', 'Last week'], ['last_month', 'Last month'], ['last_quarter', 'Last quarter'], ['last_fy', 'Last financial year'],
['last_30', 'Last 30 days'], ['since_60', 'Since 60 days ago'], ['since_90', 'Since 90 days ago'], ['since_365', 'Since 365 days ago'],
['custom', 'Custom']
];
function preset(key, fyMonth, now) {
var t = now ? parse(now) : today(), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, dow = (t.getUTCDay() + 6) % 7;
var qs = Math.floor((m - 1) / 3) * 3 + 1, fs = fyStartOf(t, fyMonth || 7), r;
switch (key) {
case 'today': r = [t, t]; break;
case 'this_week': r = [addDays(t, -dow), addDays(t, 6 - dow)]; break;
case 'this_week_td': r = [addDays(t, -dow), t]; break;
case 'this_month': r = [D(y, m, 1), eom(y, m)]; break;
case 'this_month_td': r = [D(y, m, 1), t]; break;
case 'this_quarter': r = [D(y, qs, 1), eom(y, qs + 2)]; break;
case 'this_quarter_td': r = [D(y, qs, 1), t]; break;
case 'this_fy': r = [fs, addDays(D(fs.getUTCFullYear() + 1, fs.getUTCMonth() + 1, 1), -1)]; break;
case 'this_fy_td': r = [fs, t]; break;
case 'last_week': r = [addDays(t, -dow - 7), addDays(t, -dow - 1)]; break;
case 'last_month': r = [D(y, m - 1, 1), eom(y, m - 1)]; break;
case 'last_quarter': r = [D(y, qs - 3, 1), eom(y, qs - 1)]; break;
case 'last_fy': r = [D(fs.getUTCFullYear() - 1, fs.getUTCMonth() + 1, 1), addDays(fs, -1)]; break;
case 'last_30': r = [addDays(t, -29), t]; break;
case 'since_60': r = [addDays(t, -60), t]; break;
case 'since_90': r = [addDays(t, -90), t]; break;
case 'since_365': r = [addDays(t, -365), t]; break;
default: return null;
}
return { start: iso(r[0]), end: iso(r[1]) };
}
var ASAT = [['today', 'Today'], ['end_last_month', 'End of last month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']];
function asAt(key, fyMonth, now) {
var t = now ? parse(now) : today(), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, qs = Math.floor((m - 1) / 3) * 3 + 1;
switch (key) {
case 'today': return iso(t);
case 'end_last_month': return iso(eom(y, m - 1));
case 'end_last_quarter': return iso(eom(y, qs - 1));
case 'end_last_fy': return iso(addDays(fyStartOf(t, fyMonth || 7), -1));
default: return null;
}
}
function compare(start, end, mode, fyMonth) {
var s = parse(start), e = parse(end), len;
if (mode === 'prev_year') return { start: iso(D(s.getUTCFullYear() - 1, s.getUTCMonth() + 1, Math.min(s.getUTCDate(), eom(s.getUTCFullYear() - 1, s.getUTCMonth() + 1).getUTCDate()))), end: iso(D(e.getUTCFullYear() - 1, e.getUTCMonth() + 1, Math.min(e.getUTCDate(), eom(e.getUTCFullYear() - 1, e.getUTCMonth() + 1).getUTCDate()))) };
if (mode === 'ytd') return { start: iso(fyStartOf(e, fyMonth || 7)), end: end };
if (s.getUTCDate() === 1 && iso(e) === iso(eom(e.getUTCFullYear(), e.getUTCMonth() + 1))) {
var months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
return { start: iso(D(s.getUTCFullYear(), s.getUTCMonth() + 1 - months, 1)), end: iso(addDays(s, -1)) };
}
len = Math.round((e - s) / 86400000);
return { start: iso(addDays(s, -len - 1)), end: iso(addDays(s, -1)) };
}
var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function periodLine(start, end) {
var s = parse(start), e = parse(end), sy = s.getUTCFullYear(), ey = e.getUTCFullYear();
var wholeStart = s.getUTCDate() === 1, wholeEnd = iso(e) === iso(eom(ey, e.getUTCMonth() + 1));
if (wholeStart && wholeEnd) {
if (sy === ey && s.getUTCMonth() === e.getUTCMonth()) return MON[s.getUTCMonth()] + ' ' + sy;
if (sy === ey) return MON[s.getUTCMonth()] + ' - ' + MON[e.getUTCMonth()] + ', ' + sy;
return MON[s.getUTCMonth()] + ' ' + sy + ' - ' + MON[e.getUTCMonth()] + ' ' + ey;
}
return s.getUTCDate() + ' ' + MON[s.getUTCMonth()] + ' ' + sy + ' - ' + e.getUTCDate() + ' ' + MON[e.getUTCMonth()] + ' ' + ey;
}
function asOfLine(d) { var x = parse(d); return 'As of ' + MON[x.getUTCMonth()] + ' ' + x.getUTCDate() + ', ' + x.getUTCFullYear(); }
function footerStamp(basis, fetchedAt) {
var t = fetchedAt ? new Date(fetchedAt) : new Date();
var wd = t.toLocaleDateString('en-AU', { weekday: 'long' });
var dm = t.getDate() + ' ' + MON[t.getMonth()] + ', ' + t.getFullYear();
var hm = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
var off = -t.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
var tz = 'GMT' + sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
return (basis === 'Cash' ? 'Cash basis' : 'Accrual basis') + ' | ' + wd + ', ' + dm + ' ' + hm + ' ' + tz;
}
function freshest(bundle) {
var f = bundle && bundle.fetchedAt;
if (f && typeof f === 'object') { var best = null, k; for (k in f) if (f[k] && (!best || f[k] > best)) best = f[k]; return best; }
return f || null;
}
var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function utf8(s) { return new TextEncoder().encode(s); }
function zip(files) {
var parts = [], central = [], off = 0;
function u16(v) { return [v & 255, (v >>> 8) & 255]; }
function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
files.forEach(function (f) {
var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
var head = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
parts.push(new Uint8Array(head), name, data);
central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
off += head.length + name.length + data.length;
});
var csize = 0; central.forEach(function (p) { csize += p.length; });
var end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
var all = parts.concat(central, [end]), total = 0; all.forEach(function (p) { total += p.length; });
var out = new Uint8Array(total), pos = 0; all.forEach(function (p) { out.set(p, pos); pos += p.length; });
return out;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function xlsx(sheets, cur) {
var sym = esc(symbol(cur || 'AUD').trim()).replace(/"/g, '');
var moneyFmt = '&quot;' + sym + '&quot;#,##0.00;-&quot;' + sym + '&quot;#,##0.00';
var STY = { none: 0, bold: 1, money: 2, moneyBold: 3, title: 4, pct: 5, muted: 6 };
var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
'<numFmts count="1"><numFmt numFmtId="164" formatCode="' + moneyFmt + '"/></numFmts>' +
'<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF6B6C72"/><name val="Arial"/></font></fonts>' +
'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
'<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
var files = [], wbSheets = '', wbRels = '', ct = '';
var used = {};
sheets.forEach(function (sh, si) {
var n = si + 1, rowsXml = '';
var nm = String(sh.name || ('Sheet' + n)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || ('Sheet' + n);
while (used[nm.toLowerCase()]) nm = nm.slice(0, 28) + ' ' + n;
used[nm.toLowerCase()] = 1;
(sh.rows || []).forEach(function (row, ri) {
var cells = '';
(row || []).forEach(function (c, ci) {
if (c === null || c === undefined || c === '') return;
var o = typeof c === 'object' ? c : { v: c }, ref = colName(ci) + (ri + 1), s = STY[o.s || (typeof o.v === 'number' ? 'money' : 'none')] || 0;
if (o.f) cells += '<c r="' + ref + '" s="' + s + '"><f>' + esc(o.f) + '</f>' + (typeof o.v === 'number' ? '<v>' + o.v + '</v>' : '') + '</c>';
else if (typeof o.v === 'number' && isFinite(o.v)) cells += '<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>';
else cells += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(new Array((o.indent || 0) + 1).join('   ') + (o.v == null ? '' : o.v)) + '</t></is></c>';
});
rowsXml += '<row r="' + (ri + 1) + '">' + cells + '</row>';
});
var colsXml = sh.widths ? '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + colsXml + '<sheetData>' + rowsXml + '</sheetData></worksheet>' });
wbSheets += '<sheet name="' + esc(nm) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
wbRels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
});
var k = sheets.length + 1;
wbRels += '<Relationship Id="rId' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
files.unshift(
{ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ct + '</Types>' },
{ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
{ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wbSheets + '</sheets></workbook>' },
{ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels + '</Relationships>' },
{ name: 'xl/styles.xml', data: styles }
);
return zip(files);
}
function sheetFromLines(title, company, period, colTitles, lines, footer, fmts) {
var rows = [[{ v: company || 'N/A — not in source', s: 'title' }], [{ v: title, s: 'bold' }], [period], [], colTitles.map(function (t) { return { v: t, s: 'bold' }; })];
lines.forEach(function (l) {
var bold = l.kind === 'total' || l.kind === 'header';
var r = [{ v: l.label, s: bold ? 'bold' : 'none', indent: l.depth }];
(l.values || []).forEach(function (v, i) { var f = fmts && fmts[i]; r.push(v == null ? null : { v: v, s: f === 'pct' ? 'pct' : bold ? 'moneyBold' : 'money' }); });
rows.push(r);
});
if (footer) { rows.push([]); rows.push([{ v: footer, s: 'muted' }]); }
var widths = [48]; colTitles.slice(1).forEach(function () { widths.push(18); });
return { name: title, rows: rows, widths: widths };
}
function download(bytes, name, mime) {
var blob = new Blob([bytes], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function reportv2Params(v) {
var d = v.display || DISPLAY_DEFAULT;
var p = { token: v.token, date_macro: v.dateMacro || null, low_date: v.start || null, high_date: v.end || v.asAt || null, cash_basis: v.basis === 'Cash' ? 'yes' : 'no',
divideby1000: d.k ? 'true' : 'false', hidecents: d.cents ? 'false' : 'true', exceptzeros: d.zeros ? 'false' : 'true',
negativenums: d.neg === 'paren' ? '2' : d.neg === 'trail' ? '3' : '1', negativered: d.red ? 'true' : 'false',
show_header_title: d.hdr ? 'true' : 'false', show_header_range: d.hdr ? 'true' : 'false', show_header_company: d.hdr ? 'true' : 'false' };
Object.keys(p).forEach(function (k) { if (p[k] == null) delete p[k]; });
return p;
}
var MACRO = { today: 'Today', this_week: 'This Week', this_week_td: 'This Week-to-date', this_month: 'This Month', this_month_td: 'This Month-to-date', this_quarter: 'This Quarter', this_quarter_td: 'This Quarter-to-date', this_fy: 'This Fiscal Year', this_fy_td: 'This Fiscal Year-to-date', last_week: 'Last Week', last_month: 'Last Month', last_quarter: 'Last Quarter', last_fy: 'Last Fiscal Year' };
function deepLink(token, route, presetKey) {
if (!token) return null;
var base = 'https://qbo.intuit.com/app/' + (route || 'reportv2') + '?token=' + encodeURIComponent(token);
return MACRO[presetKey] ? base + '&date_macro=' + encodeURIComponent(MACRO[presetKey]) : base;
}
function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function negCls(v, d) { return d && d.red && isNeg(v) ? ' neg' : ''; }
function isZeroLine(l) { return l.kind === 'row' && !(l.values || []).some(function (v) { return v != null && Math.abs(v) >= 0.005; }); }
function statement(lines, colTitles, ctx, extraCols) {
var d = ctx.display, cur = ctx.currency, ex = extraCols || [];
var th = colTitles.concat(ex.map(function (e) { return e.title; }));
var out = '<table class="qb-stmt"><thead><tr>' + th.map(function (t, i) { return '<th' + (i ? ' class="num"' : '') + ' scope="col">' + h(t) + '</th>'; }).join('') + '</tr></thead><tbody>';
lines.forEach(function (l) {
if (!d.zeros && isZeroLine(l)) return;
var label = l.kind === 'total' ? totalFor(l.label) : l.label;
out += '<tr class="k-' + l.kind + (l.kind === 'row' ? ' detail-block' : '') + '"><td style="padding-left:' + (8 + l.depth * 18) + 'px">' + h(label) + '</td>';
for (var i = 0; i < colTitles.length - 1; i++) { var v = (l.values || [])[i]; out += '<td class="num' + negCls(v, d) + '">' + (l.kind === 'header' ? '' : money(v, cur, d)) + '</td>'; }
ex.forEach(function (e) { var v = l.kind === 'header' ? null : e.value(l); out += '<td class="num' + negCls(v, d) + '">' + (v == null ? '' : e.fmt === 'pct' ? pct(v) : money(v, cur, d)) + '</td>'; });
out += '</tr>';
});
return out + '</tbody></table>';
}
function grid(el, spec, ctx) {
var st = { key: null, dir: 1, q: '' };
function draw() {
var rows = spec.rows.filter(function (r) { if (!st.q) return true; var q = st.q.toLowerCase(); return spec.columns.some(function (c) { return String(r[c.key] == null ? '' : r[c.key]).toLowerCase().indexOf(q) >= 0; }); });
if (st.key) rows = rows.slice().sort(function (a, b) { var x = a[st.key], y = b[st.key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
function cell(c, r, tag) {
var v = r[c.key], txt = c.fmt ? c.fmt(v, r) : c.money ? money(v, ctx.currency, ctx.display) : (v == null ? '' : v);
return '<' + tag + ' class="' + (c.num || c.money ? 'num' : '') + (c.money ? negCls(v, ctx.display) : '') + '">' + (c.html ? txt : h(txt)) + '</' + tag + '>';
}
var html = (spec.filter && spec.rows.length > 8 ? '<input class="qb-filter" type="search" placeholder="Filter…" aria-label="Filter rows" value="' + h(st.q) + '">' : '') +
'<div class="qb-scroll"><table class="qb-grid"><thead><tr>' + spec.columns.map(function (c) { return '<th scope="col" data-k="' + h(c.key) + '" class="' + (c.num || c.money ? 'num' : '') + '" aria-sort="' + (st.key === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + h(c.title) + (st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
(rows.length ? rows.map(function (r) { return '<tr>' + spec.columns.map(function (c) { return cell(c, r, 'td'); }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + spec.columns.length + '" class="muted">' + h(spec.empty || "Data appears once it's available.") + '</td></tr>') +
'</tbody>' + (spec.total ? '<tfoot><tr class="k-total">' + spec.columns.map(function (c) { return cell(c, spec.total, 'td'); }).join('') + '</tr></tfoot>' : '') + '</table></div>';
el.innerHTML = html;
el.querySelectorAll('th[data-k]').forEach(function (thEl) { thEl.addEventListener('click', function () { var k = thEl.getAttribute('data-k'); st.dir = st.key === k ? -st.dir : 1; st.key = k; draw(); }); });
var f = el.querySelector('.qb-filter'); if (f) f.addEventListener('input', function () { st.q = f.value; var pos = f.selectionStart; draw(); var g = el.querySelector('.qb-filter'); g.focus(); g.setSelectionRange(pos, pos); });
}
draw();
}
function scale(vals) { var mn = Math.min(0, Math.min.apply(null, vals)), mx = Math.max(0, Math.max.apply(null, vals)); if (mn === mx) mx = mn + 1; return { mn: mn, mx: mx }; }
function legend(series) { return '<div class="qb-legend">' + series.map(function (s, i) { return '<span><i style="background:var(--c' + (i + 1) + ')"></i>' + h(s.name) + '</span>'; }).join('') + '</div>'; }
function bars(el, o, ctx) {
var W = 640, H = 220, P = 28, all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
var sc = scale(all), n = o.labels.length, gw = (W - P * 2) / Math.max(n, 1), bw = Math.max(2, (gw * 0.7) / o.series.length);
function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Bar chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
o.labels.forEach(function (lb, i) {
o.series.forEach(function (s, j) { var v = s.values[i]; if (v == null) return; var x = P + gw * i + gw * 0.15 + bw * j, y0 = y(0), y1 = y(v);
svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="var(--c' + (j + 1) + ')"><title>' + h(s.name + ' · ' + lb + ': ' + money(v, ctx.currency, ctx.display)) + '</title></rect>'; });
if (n <= 16) svg += '<text x="' + (P + gw * i + gw / 2).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>';
});
el.innerHTML = svg + '</svg>' + legend(o.series);
}
function line(el, o, ctx) {
var W = 640, H = 220, P = 28, all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
var sc = scale(all), n = o.labels.length, step = (W - P * 2) / Math.max(n - 1, 1);
function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Line chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
o.series.forEach(function (s, j) {
var pts = s.values.map(function (v, i) { return v == null ? null : (P + step * i).toFixed(1) + ',' + y(v).toFixed(1); }).filter(Boolean);
if (o.area && j === 0 && pts.length) svg += '<polygon points="' + (P).toFixed(1) + ',' + y(0).toFixed(1) + ' ' + pts.join(' ') + ' ' + (P + step * (n - 1)).toFixed(1) + ',' + y(0).toFixed(1) + '" fill="var(--c1)" opacity=".18"/>';
svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--c' + (j + 1) + ')" stroke-width="2.5"' + (j ? ' stroke-dasharray="5 4"' : '') + '/>';
s.values.forEach(function (v, i) { if (v != null) svg += '<circle cx="' + (P + step * i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="var(--c' + (j + 1) + ')"><title>' + h(s.name + ' · ' + o.labels[i] + ': ' + money(v, ctx.currency, ctx.display)) + '</title></circle>'; });
});
o.labels.forEach(function (lb, i) { if (n <= 13 || i % Math.ceil(n / 12) === 0) svg += '<text x="' + (P + step * i).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>'; });
el.innerHTML = svg + '</svg>' + legend(o.series);
}
function donut(el, o, ctx) {
var items = o.items.filter(function (i) { return i.value > 0; }).sort(function (a, b) { return b.value - a.value; });
if (!items.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
if (items.length > 6) { var rest = items.slice(5); items = items.slice(0, 5).concat([{ label: '+' + rest.length + ' more', value: sum(rest.map(function (r) { return r.value; })) }]); }
var tot = sum(items.map(function (i) { return i.value; })), a0 = -Math.PI / 2, R = 80, r = 50, cx = 100, cy = 100, svg = '<svg viewBox="0 0 200 200" role="img" aria-label="' + h(o.title || 'Donut chart') + '">';
items.forEach(function (it, i) {
var a1 = a0 + (it.value / tot) * Math.PI * 2 - 1e-6, lg = a1 - a0 > Math.PI ? 1 : 0;
var p = [cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1), cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a0), cy + r * Math.sin(a0)].map(function (v) { return v.toFixed(2); });
svg += '<path d="M' + p[0] + ' ' + p[1] + ' A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + p[2] + ' ' + p[3] + ' L' + p[4] + ' ' + p[5] + ' A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + p[6] + ' ' + p[7] + 'Z" fill="var(--d' + (i + 1) + ')"><title>' + h(it.label + ': ' + money(it.value, ctx.currency, ctx.display)) + '</title></path>';
a0 = a1 + 1e-6;
});
el.innerHTML = '<div class="qb-donut">' + svg + '<text x="100" y="106" text-anchor="middle" class="donut-c">' + h(o.centre || '') + '</text></svg><ul>' +
items.map(function (it, i) { return '<li><i style="background:var(--d' + (i + 1) + ')"></i>' + h(it.label) + ': ' + money(it.value, ctx.currency, Object.assign({}, ctx.display, { cents: 0 })) + '</li>'; }).join('') + '</ul></div>';
}
function waterfall(el, o, ctx) {
var run = 0, bars2 = o.steps.map(function (s) { var from = s.total ? 0 : run, to = s.total ? s.value : run + s.value; run = to; return { label: s.label, from: from, to: to, total: s.total, v: s.value }; });
var vals = []; bars2.forEach(function (b) { vals.push(b.from, b.to); });
if (!vals.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
var W = 640, H = 220, P = 28, sc = scale(vals), gw = (W - P * 2) / bars2.length;
function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Waterfall') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
bars2.forEach(function (b, i) { var x = P + gw * i + gw * 0.2, y0 = y(b.from), y1 = y(b.to), c = b.total ? (b.v < 0 ? 'var(--neg)' : 'var(--c1)') : b.v < 0 ? 'var(--neg)' : 'var(--c2)';
svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + (gw * 0.6).toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="' + c + '"><title>' + h(b.label + ': ' + money(b.v, ctx.currency, ctx.display)) + '</title></rect><text x="' + (x + gw * 0.3).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(b.label) + '</text>'; });
el.innerHTML = svg + '</svg>';
}
function mergeCompare(mainRep, cmpRep) {
var a = walk(mainRep), b = cmpRep ? walk(cmpRep) : [], key = function (l) { return l.kind + '|' + l.path.join('>') + '|' + l.label; }, map = {}, seen = {};
b.forEach(function (l) { map[key(l)] = l; });
var lines = a.map(function (l) { var k = key(l), c = map[k]; seen[k] = 1; return Object.assign({}, l, { cmp: l.kind === 'header' ? null : c ? val(c) : 0 }); });
return { lines: lines, onlyInCompare: b.filter(function (l) { return l.kind === 'row' && !seen[key(l)] && val(l); }).map(function (l) { return l.label; }) };
}
function compareCols(title) {
return [{ title: title || 'Comparison', value: function (l) { return l.cmp; } },
{ title: '$ Change', value: function (l) { return l.cmp == null ? null : Math.round((val(l) - l.cmp) * 100) / 100; } },
{ title: '% Change', fmt: 'pct', value: function (l) { return l.cmp ? (val(l) - l.cmp) / Math.abs(l.cmp) : null; } }];
}
function sectionTies(rep, tol) {
var res = { checked: 0, failed: [] };
function rec(rows) {
(rows || []).forEach(function (r) {
if (!(r.Rows && r.Rows.Row)) return;
rec(r.Rows.Row);
if (!r.Summary) return;
var tot = cd(r.Summary).slice(1).map(num), acc = tot.map(function () { return 0; }), any = false;
r.Rows.Row.forEach(function (c) { var v = c.ColData ? cd(c).slice(1).map(num) : c.Summary ? cd(c.Summary).slice(1).map(num) : null; if (!v) return; any = true; v.forEach(function (x, i) { if (x != null) acc[i] += x; }); });
if (!any) return;
var hdr = cd(r.Header)[0] || cd(r.Summary)[0] || 'section';
if (r.Header) { var own = cd(r.Header).slice(1).map(num); own.forEach(function (x, i) { if (x != null) acc[i] += x; }); }
res.checked++;
tot.forEach(function (t, i) { if (t != null && !near(t, Math.round(acc[i] * 100) / 100, tol == null ? 0.05 : tol)) { if (res.failed.indexOf(hdr) < 0) res.failed.push(hdr); } });
});
}
rec(rep && rep.Rows && rep.Rows.Row);
return res;
}
function bas(rep) {
var lines = walk(rep), pick = function (re) { for (var i = 0; i < lines.length; i++) if (re.test(lines[i].label) && lines[i].kind !== 'header') return val(lines[i]); return null; };
return { lines: lines, net: pick(/^net amount for g1/i), tax: pick(/^tax amount for g1/i), free: pick(/^gst[- ]?free sales/i), g1: pick(/^g1 /i),
a1: pick(/^1a /i), b1: pick(/^1b /i), a8: pick(/^8a /i), b8: pick(/^8b /i), nine: pick(/^9 /i),
found: lines.some(function (l) { return /^(g1|1a|1b|9) /i.test(l.label); }) };
}
function kpis(items, ctx) { // [{label, value, delta:number|null (fraction), money:true|false, text}]
return '<div class="qb-kpis">' + items.map(function (k) {
var v = k.text != null ? h(k.text) : k.money === false ? h(k.value == null ? 'N/A' : k.value) : (k.value == null ? 'N/A — not in source' : money(k.value, ctx.currency, ctx.display));
var chip = k.delta == null || !isFinite(k.delta) ? '' : '<span class="chip ' + (k.delta >= 0 ? 'up' : 'down') + '">' + (k.delta >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(k.delta), 0) + '</span>';
return '<div class="qb-kpi"><div class="lbl">' + h(k.label) + '</div><div class="val' + negCls(k.value, ctx.display) + '">' + v + '</div>' + chip + (k.sub ? '<div class="sub">' + h(k.sub) + '</div>' : '') + '</div>';
}).join('') + '</div>';
}
var FRIENDLY = { needs_connection: 'Connect QuickBooks (Settings → Connections) to see this data.', connection_unavailable: 'QuickBooks is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This QuickBooks report is not available on the connected connector.', tool_error: 'QuickBooks returned an error for this section.', invalid_inputs: 'One of the report controls has an invalid value.' };
var MECHANISM = 'quickbooks-accounting connector — mySMB custom MCP on the QuickBooks Online Accounting API v3 (AGT-003)';
function app(cfg) {
var MH = window.MyHubReport, live = !!(MH && MH.mode !== 'snapshot');
var I = cfg.inputs || {}, S = { inputs: Object.assign({}, cfg.defaults), data: {}, errors: {}, fetchedAt: null, first: true, busy: 0 };
var $ = function (id) { return document.getElementById(id); };
function disp() { return readDisplay(I.display ? S.inputs[I.display] : ''); }
function setDisp(patch) { if (!I.display) return; var d = disp(), k; for (k in patch) d[k] = patch[k]; S.inputs[I.display] = writeDisplay(d); }
function fy() { return fiscalStart(S.data[cfg.company], S.data[cfg.prefs]); }
function err(id) { var e = S.errors[id]; return e ? (FRIENDLY[e.code] || e.message || 'Unavailable') + (e.code === 'tool_error' && e.message ? ' (' + e.message + ')' : '') : null; }
function announce() { if (MH && live) MH.setInputs(Object.assign({}, S.inputs)); }
function status(t) { var el = $('qb-status'); if (el) el.textContent = t || ''; }
function requery(changed) {
if (!MH || !live) return Promise.resolve();
var ids = Object.keys(cfg.uses || {}).filter(function (id) { return !changed || (cfg.uses[id] || []).some(function (n) { return changed.indexOf(n) >= 0; }); });
if (!ids.length) { render(); return Promise.resolve(); }
S.busy++; status('Loading…'); var inputs = Object.assign({}, S.inputs);
return Promise.all(ids.map(function (id) {
return MH.getData(id, inputs).then(function (v) { S.data[id] = v; delete S.errors[id]; }, function (e) { S.errors[id] = { code: (e && e.code) || 'tool_error', message: (e && e.message) || String(e) }; });
})).then(function () { S.fetchedAt = new Date().toISOString(); S.busy--; status(''); render(); });
}
function change(patch, dispPatch) {
var changed = [], k;
for (k in patch) if (k && S.inputs[k] !== patch[k]) { S.inputs[k] = patch[k]; changed.push(k); }
if (dispPatch) setDisp(dispPatch);
if (cfg.derive) { var dv = cfg.derive(Object.assign({}, S.inputs), fy().month, disp()) || {}; for (k in dv) if (S.inputs[k] !== dv[k]) { S.inputs[k] = dv[k]; changed.push(k); } }
var d = disp();
if (cfg.compare && d.c !== 'none') { // keep the comparison window aligned with the main window
if (I.cmpStart && I.start) { var c = compare(S.inputs[I.start], S.inputs[I.end], d.c, fy().month); if (S.inputs[I.cmpStart] !== c.start || S.inputs[I.cmpEnd] !== c.end) { S.inputs[I.cmpStart] = c.start; S.inputs[I.cmpEnd] = c.end; changed.push(I.cmpStart, I.cmpEnd); } }
if (I.cmpAsAt && I.asAt) { var ca = compareAsAt(S.inputs[I.asAt], d.c); if (S.inputs[I.cmpAsAt] !== ca) { S.inputs[I.cmpAsAt] = ca; changed.push(I.cmpAsAt); } }
}
announce();
if (changed.length) return requery(changed);
render(); return Promise.resolve();
}
function compareAsAt(asAtIso, mode) { var x = parse(asAtIso); return mode === 'prev_year' ? iso(D(x.getUTCFullYear() - 1, x.getUTCMonth() + 1, Math.min(x.getUTCDate(), eom(x.getUTCFullYear() - 1, x.getUTCMonth() + 1).getUTCDate()))) : iso(eom(x.getUTCFullYear(), x.getUTCMonth())); }
function rollPresets() {
if (!live) return null; var d = disp(), p = {}, f = fy().month;
if (I.start && d.p && d.p !== 'custom') { var r = preset(d.p, f); if (r && (r.start !== S.inputs[I.start] || r.end !== S.inputs[I.end])) { p[I.start] = r.start; p[I.end] = r.end; } }
if (I.asAt && d.a && d.a !== 'custom') { var a = asAt(d.a, f); if (a && a !== S.inputs[I.asAt]) p[I.asAt] = a; }
if (cfg.roll) { var cr = cfg.roll(Object.assign({}, S.inputs), f, d) || {}, k2; for (k2 in cr) if (cr[k2] !== S.inputs[k2]) p[k2] = cr[k2]; }
return Object.keys(p).length ? p : null;
}
function adoptHeader() {
var hd = header(S.data[cfg.primary]); if (!hd || !hd.ReportName) return;
if (!live) {
if (I.start && hd.StartPeriod) S.inputs[I.start] = hd.StartPeriod;
if (I.end && hd.EndPeriod) S.inputs[I.end] = hd.EndPeriod;
if (I.asAt && hd.EndPeriod) S.inputs[I.asAt] = hd.EndPeriod;
if (I.basis && (hd.ReportBasis === 'Cash' || hd.ReportBasis === 'Accrual')) S.inputs[I.basis] = hd.ReportBasis;
}
}
function opt(list, cur) { return list.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join(''); }
function controls() {
var el = $('qb-controls'); if (!el) return; var d = disp(), ci = companyInfo(S.data[cfg.company]), dis = live ? '' : ' disabled', x = '';
x += '<label class="ctl">Client<select id="qb-client" title="One QuickBooks company per connection — connect another company under Settings → Connections to switch."><option>' + h((ci && ci.name) || 'Connected QuickBooks company') + '</option></select></label>';
if (I.start) x += '<label class="ctl">Report period<select id="qb-preset"' + dis + '>' + opt(PRESETS, d.p) + '</select></label><label class="ctl">From<input type="date" id="qb-from" value="' + h(S.inputs[I.start]) + '"' + dis + '></label><label class="ctl">To<input type="date" id="qb-to" value="' + h(S.inputs[I.end]) + '"' + dis + '></label>';
if (I.asAt) x += '<label class="ctl">As of<select id="qb-asat-preset"' + dis + '>' + opt(ASAT, d.a) + '</select></label><label class="ctl">Date<input type="date" id="qb-asat" value="' + h(S.inputs[I.asAt]) + '"' + dis + '></label>';
if (I.basis) x += '<fieldset class="ctl seg"' + dis + '><legend>Accounting method</legend>' + ['Cash', 'Accrual'].map(function (b) { return '<label><input type="radio" name="qb-basis" value="' + b + '"' + (S.inputs[I.basis] === b ? ' checked' : '') + dis + '>' + b + '</label>'; }).join('') + '</fieldset>';
if (I.columnsBy && cfg.columnsBy) x += '<label class="ctl">Display columns by<select id="qb-cols"' + dis + '>' + opt(cfg.columnsBy, S.inputs[I.columnsBy]) + '</select></label>';
if (cfg.compare) x += '<label class="ctl">Compare to<select id="qb-cmp"' + dis + '>' + opt(I.asAt ? [['none', 'None'], ['prev_period', 'Previous month end'], ['prev_year', 'Previous year']] : [['none', 'None'], ['prev_period', 'Previous period'], ['prev_year', 'Previous year'], ['ytd', 'Year-to-date']], d.c) + '</select></label>';
(cfg.enums || []).forEach(function (e, i) { var rq = Object.keys(cfg.uses || {}).some(function (id) { return (cfg.uses[id] || []).indexOf(e.input) >= 0; }); x += '<label class="ctl">' + h(e.label) + '<select id="qb-enum-' + i + '"' + (rq ? dis : '') + '>' + opt(e.options, S.inputs[e.input]) + '</select></label>'; });
if (cfg.views) x += '<label class="ctl">Report<select id="qb-view">' + opt(cfg.views, d.v || cfg.views[0][0]) + '</select></label>';
if (I.persona) x += '<label class="ctl">View as<select id="qb-persona">' + opt([['Client', 'Client'], ['Bookkeeper', 'Bookkeeper'], ['Practitioner', 'Practitioner'], ['Executive', 'Executive']], S.inputs[I.persona]) + '</select></label>';
x += '<details class="ctl customise"><summary>Customise</summary><div class="cz">' +
'<label><input type="checkbox" id="qb-cents"' + (d.cents ? ' checked' : '') + '> Show cents</label><label><input type="checkbox" id="qb-k"' + (d.k ? ' checked' : '') + '> Divide by 1000</label>' +
'<label><input type="checkbox" id="qb-zeros"' + (d.zeros ? '' : ' checked') + '> Except zero amounts</label><label>Negative numbers<select id="qb-neg">' + opt([['minus', '-100'], ['paren', '(100)'], ['trail', '100-']], d.neg) + '</select></label>' +
'<label><input type="checkbox" id="qb-red"' + (d.red ? ' checked' : '') + '> Show in red</label><label><input type="checkbox" id="qb-hdr"' + (d.hdr ? ' checked' : '') + '> Header</label><label><input type="checkbox" id="qb-ftr"' + (d.ftr ? ' checked' : '') + '> Footer</label>' +
'<label>View<select id="qb-dens">' + opt([['compact', 'Compact'], ['100', '100%']], d.dens) + '</select></label><label>Style<select id="qb-style">' + opt([['qbo', 'QuickBooks look'], ['mysmb', 'mySMB house style']], d.style) + '</select></label></div></details>';
x += '<div class="ctl btns"><button type="button" id="qb-pdf">Download PDF</button><button type="button" id="qb-xlsx">Download Excel</button>' + (cfg.token ? '<a id="qb-open" target="_blank" rel="noopener" href="' + h(deepLink(cfg.token, cfg.route, d.p)) + '">Open in QuickBooks</a>' : '') + '</div>';
el.innerHTML = x; wire();
}
function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }
function wire() {
on('qb-preset', 'change', function () { var k = this.value, r = preset(k, fy().month), p = {}; if (r) { p[I.start] = r.start; p[I.end] = r.end; } change(p, { p: k }); });
on('qb-from', 'change', function () { var p = {}; p[I.start] = this.value; change(p, { p: 'custom' }); });
on('qb-to', 'change', function () { var p = {}; p[I.end] = this.value; change(p, { p: 'custom' }); });
on('qb-asat-preset', 'change', function () { var k = this.value, a = asAt(k, fy().month), p = {}; if (a) p[I.asAt] = a; change(p, { a: k }); });
on('qb-asat', 'change', function () { var p = {}; p[I.asAt] = this.value; change(p, { a: 'custom' }); });
document.querySelectorAll('input[name="qb-basis"]').forEach(function (r) { r.addEventListener('change', function () { var p = {}; p[I.basis] = this.value; change(p); }); });
on('qb-cols', 'change', function () { var p = {}; p[I.columnsBy] = this.value; change(p); });
on('qb-cmp', 'change', function () { change({}, { c: this.value }); });
(cfg.enums || []).forEach(function (e, i) { on('qb-enum-' + i, 'change', function () { var p = {}; p[e.input] = this.value; change(p); }); });
on('qb-view', 'change', function () { change({}, { v: this.value }); });
on('qb-persona', 'change', function () { var p = {}; p[I.persona] = this.value; change(p); });
[['qb-cents', 'cents'], ['qb-k', 'k'], ['qb-red', 'red'], ['qb-hdr', 'hdr'], ['qb-ftr', 'ftr']].forEach(function (c) { on(c[0], 'change', function () { var p = {}; p[c[1]] = this.checked ? 1 : 0; change({}, p); }); });
on('qb-zeros', 'change', function () { change({}, { zeros: this.checked ? 0 : 1 }); });
on('qb-neg', 'change', function () { change({}, { neg: this.value }); });
on('qb-dens', 'change', function () { change({}, { dens: this.value }); });
on('qb-style', 'change', function () { change({}, { style: this.value }); });
on('qb-pdf', 'click', function () { window.print(); });
on('qb-xlsx', 'click', function () { exportXlsx(); });
}
function ctx() {
var d = disp(), ci = companyInfo(S.data[cfg.company]), f = fy();
return { data: S.data, errors: S.errors, err: err, inputs: S.inputs, I: I, display: d, view: d.v || (cfg.views ? cfg.views[0][0] : ''), compareMode: cfg.compare ? d.c : 'none',
persona: I.persona ? S.inputs[I.persona] : 'Bookkeeper', company: ci && ci.name, fy: f, currency: homeCurrency(S.data[cfg.prefs], S.data[cfg.primary]), live: live,
fetchedAt: S.fetchedAt, lines: function (id) { return walk(S.data[id]); }, body: $('qb-body'), change: change, disp: disp, today: iso(today()) };
}
var last = { checks: [], na: [], notes: [] };
function render() {
var c = ctx(), d = c.display, root = document.documentElement;
root.classList.toggle('style-mysmb', d.style === 'mysmb'); root.classList.toggle('dens-compact', d.dens === 'compact');
document.body.classList.toggle('persona-summary', c.persona === 'Client' || c.persona === 'Executive');
document.body.classList.toggle('persona-detail', !(c.persona === 'Client' || c.persona === 'Executive'));
controls();
var out = {};
try { out = cfg.render(c) || {}; } catch (e) { if (c.body) c.body.innerHTML = '<p class="qb-err">This report could not render: ' + h(e.message) + '</p>'; out = { checks: [{ name: 'Report rendered', pass: false, detail: e.message }] }; }
last = { checks: out.checks || [], na: out.na || [], notes: out.notes || [] };
Object.keys(S.errors).forEach(function (id) {
if (id === cfg.company || id === cfg.prefs) return;
var msg = err(id);
if (last.checks.some(function (k) { return k.pass === false && k.detail === msg; })) return;
last.checks.unshift({ name: 'Data loaded: ' + ((cfg.tools || {})[id] || id), pass: false, detail: msg });
});
var hd = $('qb-head');
if (hd) { hd.hidden = !d.hdr || !!cfg.noHead; var per = out.period || (I.start ? periodLine(S.inputs[I.start], S.inputs[I.end]) : I.asAt ? asOfLine(S.inputs[I.asAt]) : ''); hd.innerHTML = '<div class="co">' + h(c.company || 'N/A — not in source') + '</div><div class="ti">' + h(out.title || cfg.title) + '</div><div class="pe">' + h(per) + '</div>'; }
var ft = $('qb-foot'); if (ft) { ft.hidden = !d.ftr; ft.textContent = footerStamp(I.basis ? S.inputs[I.basis] : (header(S.data[cfg.primary]).ReportBasis || 'Accrual'), S.fetchedAt); }
banner(c); sources(c);
}
function banner(c) {
var el = $('qb-banner'); if (!el) return; var ch = last.checks, fails = ch.filter(function (k) { return k.pass === false; }), done = ch.filter(function (k) { return k.pass === true; });
el.className = 'qb-banner ' + (fails.length ? 'fail' : 'pass');
el.innerHTML = '<strong>' + (fails.length ? '⚠ Validation: ' + fails.length + ' check' + (fails.length > 1 ? 's' : '') + ' failed' : '✓ Validation: ' + done.length + '/' + ch.length + ' checks passed') + '</strong>' +
' · Data as of ' + h(S.fetchedAt ? new Date(S.fetchedAt).toLocaleString('en-AU') : '—') + (live ? '' : ' · Snapshot: figures frozen at capture time') +
' · Financial year starts ' + h(MONTHS[c.fy.month - 1]) + ' (' + h(c.fy.source) + ')' +
'<ul>' + ch.map(function (k) { return '<li class="' + (k.pass === false ? 'bad' : k.pass === true ? 'ok' : 'na') + '">' + (k.pass === false ? '✗ ' : k.pass === true ? '✓ ' : '– ') + h(k.name) + (k.detail ? ' — ' + h(k.detail) : '') + '</li>'; }).join('') + '</ul>';
}
function sources(c) {
var el = $('qb-sources'); if (!el) return; var t = cfg.tools || {};
var items = Object.keys(t).map(function (id) { return h(t[id]) + (S.errors[id] ? ' — <span class="qb-err">' + h(err(id)) + '</span>' : ''); });
var na = last.na.slice(); if (!c.company) na.unshift('Company name (CompanyInfo returned no name)');
el.innerHTML = '<h2>Sources &amp; limitations</h2><ul><li>Mechanism: ' + h(MECHANISM) + '</li><li>Tool calls: ' + items.join(' · ') + '</li>' +
'<li>Basis: ' + h(I.basis ? S.inputs[I.basis] : 'n/a') + ' · Currency: ' + h(c.currency) + ' · Client: ' + h(c.company || 'N/A — not in source') + ' (one company per QuickBooks connection)</li>' +
(c.fy.source.indexOf('Fallback') === 0 ? '<li class="qb-err">Financial-year start could not be read from QuickBooks; assumed 1 July (Australia). Adjust the dates if this is wrong.</li>' : '') +
last.notes.map(function (n) { return '<li>' + h(n) + '</li>'; }).join('') +
(na.length ? '<li>N/A — not in source: ' + na.map(h).join('; ') + '</li>' : '') + '<li>Decision support only — not audit, tax or legal advice.</li></ul>';
}
function exportXlsx() {
var c = ctx(), sheets = [];
try { sheets = (cfg.excel && cfg.excel(c)) || []; } catch (e) { sheets = [{ name: 'Error', rows: [['Excel export failed: ' + e.message]] }]; }
sheets.push({ name: 'Validation', rows: [[{ v: 'Check', s: 'bold' }, { v: 'Result', s: 'bold' }, { v: 'Detail', s: 'bold' }]].concat(last.checks.map(function (k) { return [k.name, k.pass === true ? 'Pass' : k.pass === false ? 'FAIL' : 'N/A', k.detail || '']; })), widths: [60, 10, 60] });
var pr = reportv2Params({ token: cfg.token, start: I.start && S.inputs[I.start], end: I.end && S.inputs[I.end], asAt: I.asAt && S.inputs[I.asAt], basis: I.basis && S.inputs[I.basis], display: c.display });
sheets.push({ name: 'Parameters', rows: [[{ v: 'Parameter', s: 'bold' }, { v: 'Value', s: 'bold' }]].concat(Object.keys(pr).map(function (k) { return [k, String(pr[k])]; })).concat([[], ['Data as of', S.fetchedAt || ''], ['Source', MECHANISM]]), widths: [28, 60] });
var name = [(c.company || 'QuickBooks'), cfg.title, (I.start ? S.inputs[I.start] + ' to ' + S.inputs[I.end] : I.asAt ? 'as of ' + S.inputs[I.asAt] : '')].join(' - ').replace(/[\\\/:*?"<>|]+/g, ' ');
download(xlsx(sheets, c.currency), name + '.xlsx');
}
function boot(bundle) {
S.data = Object.assign({}, bundle.data || {}); S.errors = Object.assign({}, bundle.errors || {}); S.fetchedAt = bundle.fetchedAt || null;
adoptHeader(); status('');
if (S.first) { S.first = false; var roll = rollPresets(); if (roll) { change(roll); return; } announce(); }
render();
}
if (!MH) { status('Open this report in mySMB to load QuickBooks data.'); return { state: S }; }
MyHubReport.onData(boot);
if (MH.onRefresh) MH.onRefresh(function () { status('Refreshing…'); });
return { state: S, change: change, render: render, exportXlsx: exportXlsx, ctx: ctx };
}
return { bas: bas, sectionTies: sectionTies, fyStartOf: function (isoDate, m) { return iso(fyStartOf(parse(isoDate), m)); }, mergeCompare: mergeCompare, compareCols: compareCols, h: h, statement: statement, grid: grid, bars: bars, line: line, donut: donut, waterfall: waterfall, kpis: kpis, app: app, MONTHS: MONTHS, iso: iso, parse: parse, eom: eom, addDays: addDays,
num: num, cols: cols, walk: walk, find: find, val: val, header: header, noData: noData, totalFor: totalFor, near: near, sum: sum,
companyInfo: companyInfo, fiscalStart: fiscalStart, homeCurrency: homeCurrency, symbol: symbol,
DISPLAY_DEFAULT: DISPLAY_DEFAULT, readDisplay: readDisplay, writeDisplay: writeDisplay, money: money, pct: pct, isNeg: isNeg,
PRESETS: PRESETS, preset: preset, ASAT: ASAT, asAt: asAt, compare: compare, periodLine: periodLine, asOfLine: asOfLine, footerStamp: footerStamp, freshest: freshest,
xlsx: xlsx, sheetFromLines: sheetFromLines, download: download, reportv2Params: reportv2Params, deepLink: deepLink, MACRO: MACRO };
})();
```

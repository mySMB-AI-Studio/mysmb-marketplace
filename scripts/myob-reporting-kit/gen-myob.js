// node gen-myob.js [mysmb-marketplace root] (default: this repository)
// Writes the MYOB report foundation (build recipe + tested kit + the Phase A rules kept for prose skills) and one skill per
// kit-built family. A family that replaces a written specification keeps its file stem (the blueprint's skill ids do not change);
// a new one is named myob-… (so a Developer Instance Pull cannot collide with a standalone Dev Tools key) and is added to the
// agent's skills, with the blueprint's contentHash recomputed.
// reports/<skill>/ carries each kit report as a report template (artifact_from_template, "Use this report"): the same document
// the copy path assembles, and the skill's dataBindings.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..');
const SLUG = 'myob-reporting-studio', P = path.join(ROOT, 'plugins', SLUG), K = __dirname;
const FAM = require('./families.js'), STATIC = require('./families-static.js');
const rd =(f) => fs.readFileSync(path.join(K, f), 'utf8').replace(/\r\n/g, '\n');
const w = (rel, s) => { const f = path.join(P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
const kitCompact = rd('mk-kit.js').replace(/\nif \(typeof module[^\n]*\n?$/, '\n').split('\n').map((l) => l.replace(/^\s+/, '')).filter((l) => l && !/^\/\//.test(l)).join('\n');
new Function(kitCompact); // parses
const css = rd('mk.css').trim(), skeleton = rd('skeleton.html').trim(), prose = rd('foundation-prose.md').trim();
const fence = (lang, s) => '```' + lang + '\n' + s.trim() + '\n```';
const docOf = (f) => (skeleton + '\n').replace('{{TITLE}}', f.title).replace('{{CSS}}', () => css).replace('{{KIT}}', () => kitCompact.trim()).replace('{{CFG}}', () => rd('reports/' + f.report + '.cfg.js').trim());
// short skill names (ids are `${SLUG}:<name>`) — with every kit report on one line, the full ids passed the 1,500-character line limit
const built = FAM.map((f) => '`' + f.skill + '` (' + f.m + ')').join(', ');

const foundation = `---
name: myob-report-foundation
description: Shared build recipe, controls contract, validation rules, MYOB styling and the tested report kit for every MYOB report (AGT-002), plus the rules for report skills not yet on the kit. Load it with the report skill.
---
# MYOB report foundation

Use when you build any MYOB report, dashboard or report pack. Load this skill first, then the report skill. Two kinds of report skill exist:

- **Kit reports** (skill ids \`${SLUG}:<name>\`) — ${built}. The report skill carries a tested \`dataBindings\` manifest and a report config; this file carries the tested kit and stylesheet. **You assemble them — you do not write report code.** Follow *Build a kit report* below.
- **A guide and two export pages** — ${STATIC.map((f) => '`' + f.skill + '` (' + f.m + ')').join(', ')}. Follow the skill itself: the guide works through the kit reports, and an export page is filled from the MYOB export the user attaches (MYOB's API does not expose those reports).
- **Every other report skill** is still a written specification. Follow *Rules for report skills without a kit config* at the end of this file.

Spec: MYOB Reports Prompt Library v1.2 (M00–M63) with the v1.2 patch (one agent per platform; LIB-002 client selector; cross-client isolation). Connector: \`myob-accounting\` (the mySMB custom MCP on the MYOB Business / AccountRight API v2).

## Build a kit report

Every kit report skill names its **template**: the extension \`${SLUG}\` and the report skill's own name as the slug (for example \`profit-and-loss\`). The template is the same tested document the copy path below assembles, with the skill's \`dataBindings\`.

1. **Discovery call.** Call the report's primary tool once with its default inputs (the report skill says which), and \`list_company_files\` once. Confirm MYOB is connected (a connection error → tell the user to connect MYOB under Settings → Connections and stop). A result of \`{"__error": "…"}\` is a failed call, not data: report the message, and if it says the token is invalid for one tool while others work, say the tool failed — do not tell the user their session expired. Read the company file name from \`list_company_files\` (it can be empty for newer MYOB keys; the report then says so). Never copy a returned figure into the document.
2. **Starting values.** Decide the inputs the report opens on, starting from the report skill's \`dataBindings\` defaults. Change only the \`default\` values of date inputs, as its *Date defaults* line says (\`YYYY-MM-DD\` or \`"today"\`), and the \`display\` JSON string's \`p\` (period preset), \`a\` (as-at preset), \`c\` (compare: \`none\` | \`prev_period\` | \`prev_year\` | \`ytd\`) and \`v\` (report view) to match the request. Leave \`company_file\` empty (the connection's file) unless the user names another file that \`list_company_files\` returned — then use its \`Id\`. **Branding:** leave \`style\` = \`myob\` (MYOB branding, the default). Set \`style\` = \`mysmb\` when the user asks for mySMB branding or the mySMB report template. Set \`b\` to \`#rrggbb\` only when the user asks for their own or their customer's colour. Keep every other key, input name, option, binding id, tool name and param.
3. **Title and description.** \`title\` = the report skill's *Report title* exactly (for example "MYOB Profit and Loss"): the platform, then the report's agreed name in Title Case — no company file and no period, because the reader can switch both in the report. Put them in the one-line \`description\` ("Opens on <Company file> · <period>").
4. **Create the report.**
   - **If \`artifact_from_template\` is in your tools**, call it once: \`plugin\` = \`${SLUG}\`, \`slug\` = the report skill's name, \`inputs\` = only the inputs you changed in step 2 as \`{ "input name": value }\` (\`display\` is the whole JSON string with your changes; dates are \`YYYY-MM-DD\` or \`"today"\`), and \`title\` and \`description\` from step 3. The platform saves an exact copy of the tested template — you write no HTML, and the report opens on your inputs. If the tool says it has no such template (the installed extension is older than this skill), use the copy path instead.
   - **Otherwise (copy path):** (a) copy the report skill's \`dataBindings\` JSON exactly, with the step 2 defaults. (b) Copy the report config JS exactly and change only its \`defaults\` object so it equals the manifest defaults, with \`"today"\` written as today's date. (c) Assemble one HTML document from the skeleton below: replace \`{{TITLE}}\` with the report name, \`{{CSS}}\` with the stylesheet, \`{{KIT}}\` with the report kit and \`{{CFG}}\` with the report config, all verbatim. Never edit, shorten, reformat or "improve" the kit or the stylesheet — they are tested as one unit and the platform validates the document against the bindings. (d) Save with \`artifact_save\`: \`title\` and \`description\` from step 3, \`fileName\` and \`tags\` from the report skill, \`content\` = the document, \`dataBindings\` = the manifest. Do not pass \`connectors\` (a live report derives them). Never paste the HTML into chat.
5. **Completion note** (3–6 lines): the report is live and refreshes on open; the controls the reader can change; the validation checks and whether they passed on the discovery data; any N/A items (the report skill lists them); Download PDF / Download Excel are in the report, and the report window's Download and Share save a frozen snapshot.

The user never has to choose an output format: every report is HTML with Download PDF (print to PDF) and Download Excel (.xlsx). If they ask for Excel or PDF, build the report and point to those buttons.

## Controls contract (kit reports)

- **Client (LIB-002).** The company files this MYOB connection can access (\`list_company_files\`). With one file the box shows its name. With several it is a picker bound to \`company_file\`, which every binding sends as \`myob_company_file_id\` — switching refetches everything for that file only. Never type or guess a client name; when MYOB returns no file list the header says so.
- **Period.** A preset (Today … Last financial year, Custom) next to editable From / To dates, or As at with presets. The **financial year is assumed to start 1 July** (NZ files: 1 April) because the MYOB API does not expose it; the banner says "assumed". **Relative presets roll forward**: a saved "This financial year to date" report is recomputed to today's window each time it opens.
- **Branding** (under Customise; display only — never refetches): **MYOB** (default: purple accents and charts, MYOB badge, "Prepared from MYOB Business") or **mySMB** (the mySMB Reporting template: teal header band with a white title, white-on-teal table headers, light-teal alternating rows, teal / accent / purple / grey charts, mySMB badge, and the footer "Business | Report | Generated"). It is stored in the \`display\` input as \`style\`, so downloads and snapshots keep it.
- Accounting method (Cash | Accrual) where MYOB offers it; Compare to (previous period / previous year / year to date, with $ and % change); Report (the members); View as (persona).
- **Customise** (display only, never refetches): Show cents, Divide by 1000, Except zero amounts (on by default — zero rows and all-zero sections are hidden), negatives (-100 / **(100)** / 100-), Show in red, Header, Footer, Compact | 100%, and Brand colour for a client's own colour ("Use MYOB branding" resets it; not used under mySMB branding).
- **Delivery.** Download PDF (print stylesheet), Download Excel (a real .xlsx: a sheet per table with a header block, number format, bold totals, a Validation sheet and a Parameters sheet). Host Download and Share produce a self-contained snapshot.
- **Personas.** Client and Executive = summary mode (account lines hidden; totals, charts and validation kept). Bookkeeper and Practitioner = detail mode. A failed check is never hidden.
- **Snapshots** freeze the data; the report reads its period and basis from the MYOB report itself and disables the controls that refetch.

## Data and validation rules (kit reports)

- Only \`myob-accounting\` tools. Never invent, estimate or reuse example figures. Anything missing is "N/A — not in source" and listed under Sources & limitations.
- MYOB errors arrive **as data** (\`{"__error": …}\`); the kit turns them into failed sources: the section shows the message, the banner turns red, and no check computed from it passes.
- MYOB report summaries (P&L, Balance Sheet) return one total per account and no section totals. The kit joins each account to its **Classification** from \`list_accounts\` (Asset, Liability, Equity, Income, CostOfSales, Expense, OtherIncome, OtherExpense), falling back to the account number's first digit, and skips header accounts so nothing is counted twice. Values are shown as MYOB returns them (positive in the account's normal balance; a contra account or overdrawn bank is negative) — never silently flipped.
- Every report recomputes its checks on every load and change. Each report includes at least one **independent tie** — a figure matched against a different MYOB report (e.g. P&L Net Profit = Balance Sheet Current Year Earnings) — so a check never just re-adds the report's own numbers. Only real checks count in "x/y passed"; N/A and information lines are counted separately.
- Financial output is decision support, not audit, tax or legal advice.

## Kit reference (for adapting a config after discovery)

\`MK.app(cfg)\` keys: \`title\`, \`primary\` (binding whose dates a snapshot reads), \`files\` (the \`list_company_files\` binding id), \`fyMonth\` (override the assumed financial-year start), \`inputs\` (role → declared input: start, end, asAt, basis, cmpStart, cmpEnd, cmpAsAt, companyFile, persona, display), \`defaults\`, \`uses\` (binding id → the declared inputs it consumes; drives refetching), \`tools\`, \`compare\`, \`enums\`, \`views\`, \`derive(inputs, fyMonth)\` (applied on open and on every change), \`roll\`, \`render(ctx)\` → \`{checks:[{name, pass:true|false|null, info?, detail}], na, notes, title, period}\`, \`excel(ctx)\`.

Helpers: \`MK.errorOf\` / \`items\` / \`isoDate\`; \`accounts(list)\` / \`classOf\` / \`breakdown(reports, accounts, MK.PL_LAYOUT | MK.BS_LAYOUT)\` → \`{lines, totals, calc, rows, unclassified, headersSkipped, byCode}\`; \`currentYearEarnings(lines)\`; \`linesTies\`; \`companyOf\`; \`find\` / \`val\`; \`money\` / \`pct\` / \`periodLine\` / \`asOfLine\` ("As at 28 September 2026") / \`footerStamp\`; \`statement\` / \`grid\` / \`kpis\` / \`bars\` / \`line\` / \`donut\` / \`waterfall\`; \`preset\` / \`asAt\` / \`compare\` / \`fyStartOf\`; \`xlsx\` / \`sheetFromLines\`.

## Skeleton

${fence('html', skeleton)}

## Stylesheet ({{CSS}})

${fence('css', css)}

## Report kit ({{KIT}}) — copy verbatim

${fence('js', kitCompact)}

## Rules for report skills without a kit config

These rules apply to every report skill that is still a written specification (all except ${built}, and the guide and export skills above). When you build one of those, write the report yourself following these rules.

${prose}
`;
w('skills/myob-report-foundation.md', foundation);

FAM.forEach((f) => {
  const manifest = JSON.stringify(JSON.parse(rd('reports/' + f.report + '.manifest.json')), null, 2);
  const cfg = rd('reports/' + f.report + '.cfg.js').trim();
  const tools = [...new Set(JSON.parse(manifest).bindings.map((b) => '`' + b.tool.name + '`'))].join(', ');
  const md = `---
name: ${f.name}
description: MYOB ${f.title} (${f.m}) as a live, validated report in MYOB styling. Use when ${f.trigger}.
---
# ${f.title} (${f.m})

Use when ${f.trigger}. Load \`myob-report-foundation\` first and follow its *Build a kit report* steps. Report title: **MYOB ${f.title}**. Template: \`${SLUG}\` / \`${f.skill}\` (for \`artifact_from_template\`); without that tool, copy the blocks below — do not rewrite them. This skill needs the \`myob-accounting\` connector (${tools}).

MYOB location: ${f.menu}. Library: MYOB Reports Prompt Library v1.2 → Prompts → ${f.m}. Delivery: ${f.wave}.

## Discovery call

${f.discovery}.

## Date defaults

${f.dates}

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation checks (shown in the banner)

${f.checks.map((c) => '- ' + c).join('\n')}

## Save as

\`fileName\`: \`${f.fileName}\` · \`tags\`: ${JSON.stringify(f.tags)}

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: ${f.golden}.
3. Validation banner: every check passes (the independent tie included), or shows N/A with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch View as to Client, then Bookkeeper; toggle Style and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): the saved report and every export carry only this company file's figures and name.

## dataBindings

${fence('json', manifest)}

## Report config ({{CFG}})

${fence('js', cfg)}
`;
  w('skills/' + f.skill + '.md', md);
});
// ---- the guide (M62) and the pages built from the user's MYOB export (M13, M31): skills only, no template
STATIC.filter((f) => f.type === 'guide').forEach((f) => {
  w('skills/' + f.skill + '.md', `---
name: ${f.name}
description: ${f.description}. Use when ${f.trigger}.
---
# ${f.title} (${f.m})

Use when ${f.trigger}. This is a **guide**: it has no page or data of its own and works through the kit reports. Load \`myob-report-foundation\` first.

MYOB location: ${f.menu}. Library: MYOB Reports Prompt Library v1.2 → Prompts → ${f.m}. Delivery: ${f.wave}.

${f.body}

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation

${f.checks.map((c) => '- ' + c).join('\n')}

## QA test script

1. Ask for the request this guide covers (see *Use when*). Confirm the agent saves the right kit report with the settings and says what is N/A.
2. Reopen the saved report: it opens on the saved settings, refetches and validates; its Download Excel file has the Validation and Parameters sheets.
3. ${f.golden}
`);
});
STATIC.filter((f) => f.type === 'export').forEach((f) => {
  const page = rd('reports/' + f.page + '.template.html').replace('{{CSS}}', () => css);
  w('skills/' + f.skill + '.md', `---
name: ${f.name}
description: ${f.description}. Use when ${f.trigger}.
---
# ${f.title} (${f.m})

Use when ${f.trigger}. MYOB's API does **not** expose this report, so it is built from the MYOB export the user attaches and saved as a **static** (frozen) page. Do not call MYOB tools for it.

MYOB location: ${f.menu}. Library: MYOB Reports Prompt Library v1.2 → Prompts → ${f.m}. Delivery: ${f.wave}.

## Build

1. If no export is attached, ask for it: *${f.exportPath}, and attach the file here.*
2. Read the export. Take the business name and dates from its header; if the business is not in the file use \`null\` (the page shows "N/A — not in source"). ${f.rows}. Do not invent, merge or drop rows.
3. Build the JSON: \`${f.dataShape}\`. **Escape every \`<\` as \`\\u003c\`** so text from the export can never close the script tag.
4. Replace \`{{DATA}}\` in the page below with that JSON — nothing else. Save with \`artifact_save\`: \`title\` = "MYOB ${f.title}", \`description\` = "<Business> · <period> · from the MYOB export", \`fileName\` = \`${f.skill}.html\`, \`tags\` = ${JSON.stringify(['myob', f.m, 'export'])}. Do not pass \`dataBindings\` or \`connectors\`.
5. Completion note: the number of rows, the period, that the page is a frozen copy of the export (attach a new export to update it), and the validation result.

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation (shown in the banner)

${f.checks.map((c) => '- ' + c).join('\n')}

## QA test script

1. Attach an export from the golden-set file. Confirm every row appears once and the validation passes. ${f.golden}
2. Use every filter, switch Branding to mySMB and back, and switch the workspace to the dark theme.
3. Include text with \`<\` or \`</script>\` in a row and confirm the page still renders.

## Page

${fence('html', page)}
`);
});
// ---- report templates: reports/<skill>/report.json + report.html. report.json holds only the keys myHubV2 reads (report-templates.ts,
// a strict schema); the description is the reader's, shown in Reports → From your plugins.
FAM.forEach((f) => {
  const live = f.members.filter((m) => !/^(N\/A|Not |Wave \d)/i.test(String(m[1]))).map((m) => m[0]).join(', ');
  const meta = { title: 'MYOB ' + f.title, description: 'Live, validated MYOB ' + f.title + ' (' + f.m + ')' + (live ? ': ' + live : '') + '.', tags: f.tags, fileName: f.fileName, dataBindings: JSON.parse(rd('reports/' + f.report + '.manifest.json')) };
  if (meta.description.length > 2000 || meta.tags.length > 20) throw new Error(f.skill + ' template metadata is over the platform limits');
  w('reports/' + f.skill + '/report.json', JSON.stringify(meta, null, 2) + '\n');
  w('reports/' + f.skill + '/report.html', docOf(f));
});
for (const d of fs.existsSync(path.join(P, 'reports')) ? fs.readdirSync(path.join(P, 'reports')) : []) if (!FAM.some((f) => f.skill === d)) fs.rmSync(path.join(P, 'reports', d), { recursive: true, force: true });
// plugin.json and the catalogue entry declare the templates' folder (Publish copies the entry to the next tier)
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const pjPath = path.join(P, '.claude-plugin', 'plugin.json'), pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
if (pj.reports !== 'reports') fs.writeFileSync(pjPath, JSON.stringify(sortKeys(Object.assign(pj, { reports: 'reports' })), null, 2) + '\n');
const mpPath = path.join(ROOT, '.claude-plugin', 'marketplace.json'), mpRaw = fs.readFileSync(mpPath, 'utf8'), mp = JSON.parse(mpRaw), ent = mp.plugins.find((p) => p.name === SLUG);
if (ent && ent.reports !== 'reports') { ent.reports = 'reports'; fs.writeFileSync(mpPath, JSON.stringify(mp, null, 2) + (mpRaw.endsWith('\n') ? '\n' : '')); }
// the role prompt's build step: a kit report is created from its template; the blueprint's contentHash follows the prompt
const STEP5_OLD = '5. Create one responsive, self-contained HTML document using the shared visual system, then save it with artifact_save to the owner\'s Reports library.';
const STEP5 = '5. For a kit report, follow the foundation\'s "Build a kit report" steps: create it from its template with artifact_from_template when you have that tool, otherwise copy its blocks and save with artifact_save. For any other report skill, create one responsive, self-contained HTML document using the shared visual system, then save it with artifact_save to the owner\'s Reports library.';
const amd = path.join(P, 'agents', 'myob-reporting-specialist.md'), bpDir = path.join(P, 'content', 'agents'), bpFile = path.join(bpDir, fs.readdirSync(bpDir).find((x) => x.endsWith('.json')));
const md0 = fs.readFileSync(amd, 'utf8').replace(/\r\n/g, '\n'), bp = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
// a kit report with a new skill file joins the agent: its blueprint skills (the foundation first, then by name) and the agent file's skills line
const missing = FAM.concat(STATIC).map((f) => SLUG + ':' + f.skill).filter((s, i, a) => a.indexOf(s) === i && !bp.skills.includes(s));
if (missing.length) bp.skills = [bp.skills[0]].concat(bp.skills.slice(1).concat(missing).sort());
let md1 = md0.replace(STEP5_OLD, STEP5).replace(/^skills: .*$/m, 'skills: ' + bp.skills.join(', '));
if (md1 !== md0) fs.writeFileSync(amd, md1);
if (bp.rolePrompt.includes(STEP5_OLD) || missing.length || !bp.contentHash) {
  bp.rolePrompt = bp.rolePrompt.replace(STEP5_OLD, STEP5);
  const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);
  const payload = Object.assign({}, bp); delete payload.contentHash;
  bp.contentHash = crypto.createHash('sha256').update(JSON.stringify(sortDeep(payload))).digest('hex');
  fs.writeFileSync(bpFile, JSON.stringify(sortDeep(bp), null, 2) + '\n');
}
console.log('generated', SLUG, '| foundation', Buffer.byteLength(foundation), 'bytes | kit reports + templates:', FAM.map((f) => f.skill).join(', '), '| guide and export skills:', STATIC.map((f) => f.skill).join(', '));

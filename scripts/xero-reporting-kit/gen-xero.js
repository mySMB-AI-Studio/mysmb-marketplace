// node gen-xero.js [mysmb-marketplace root] (default: this repo)
// Writes the Xero report foundation (build recipe + the rules kept for prose skills) and one skill per kit-built family, under
// the EXISTING xero-* file stems so the agent blueprint's skill ids and contentHash do not change. Each kit skill carries its
// complete report document (build.js: skeleton + stylesheet + the kit cut down to what that config uses + the config).
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || require('path').resolve(__dirname, '..', '..');
const SLUG = 'xero-reporting-studio', P = path.join(ROOT, 'plugins', SLUG), K = __dirname;
const FAM = require('./families.js');
const rd = (f) => fs.readFileSync(path.join(K, f), 'utf8').replace(/\r\n/g, '\n');
const w = (rel, s) => { const f = path.join(P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
const { assemble } = require('./build.js');
// prose = the rules for written-spec skills, kept verbatim from dev (they carry live-QA lessons); noReport = the rule for reports
// this agent has no skill for. Written-spec skills = every skill file on the target that is not a kit family nor the foundation.
const prose = rd('foundation-written-spec.md').trim(), noReport = rd('foundation-noreport.md').trim();
const fence = (lang, s) => '```' + lang + '\n' + s.trim() + '\n```';
const built = FAM.map((f) => '`' + SLUG + ':' + f.skill + '`' + (/^P\d\d$/.test(f.p) ? ' (' + f.p + ')' : '')).join(', ');
const specSkills = fs.readdirSync(path.join(P, 'skills')).map((f) => f.replace(/\.md$/, '')).filter((s) => s !== 'xero-report-foundation' && !FAM.some((f) => f.skill === s)).sort();
const spec = specSkills.map((s) => '`' + SLUG + ':' + s + '`').join(', ');
const LIMIT = 128 * 1024, DESC = 500; // myHubV2 developer skills: markdown ≤ 128 × 1024 characters, description ≤ 500
// What the agent can handle (README "Platform facts"): no line over LINE characters, and a report document of at most DOC
// characters — the agent writes the whole document in one artifact_save call, inside a 10-minute turn.
const LINE = 1500, DOC = 85000;
const guard = (name, md, desc) => {
  if (md.length > LIMIT) throw new Error(name + ' is ' + md.length + ' characters (limit ' + LIMIT + ')');
  if (desc && desc.length > DESC) throw new Error(name + ' description is ' + desc.length + ' characters (limit ' + DESC + ')');
  const lines = md.split('\n'), long = lines.findIndex((l) => l.length > LINE);
  if (long >= 0) throw new Error(name + ' line ' + (long + 1) + ' is ' + lines[long].length + ' characters (limit ' + LINE + ')');
};

const fdesc = 'Shared build recipe, controls contract, validation rules and Xero styling for every Xero kit report (AGT-001), the rules for report skills built from a written specification, and the connector facts. Load it with the report skill.';
const foundation = `---
name: xero-report-foundation
description: ${fdesc}
---
# Xero report foundation

Use when you build any Xero report, dashboard or report pack. Load this skill first, then the report skill. Two kinds of report skill exist:

- **Kit reports** (${FAM.length}) — ${built}. The report skill carries a tested \`dataBindings\` manifest and the complete, tested report document. **You copy them — you do not write report code.** Follow *Build a kit report* below.
- **Built on request** (${specSkills.length}) — ${spec}. Each is a written specification: build the report yourself following *Rules for report skills without a kit config* at the end of this file.

For a report this agent has no skill for, see *When the user asks for something this agent has no report for*.

Spec: Xero Reports Prompt Library v1.2 (P01–P15) with the v1.2 patch (one agent per platform; LIB-002 client selector; cross-client isolation). Connector: \`xero-accounting\` (the mySMB custom MCP on the Xero Accounting API). The library's Read Me names the claude.ai Xero connector's tools (get_financial_position, get_organisation_info and the like) — **those do not exist here**; use only the tools named in these skills.

## Build a kit report

1. **Discovery call.** Call the report's primary tool once with its default inputs (the report skill says which), plus \`get_organisation\` and \`list_connections\` once each — together, in one step. Confirm Xero is connected (a connection error → tell the user to connect Xero under Settings → Connections and stop). A failed call is an error message, not data: report it. Read the organisation's name from \`get_organisation\`. Never copy a returned figure into the document.
2. **dataBindings.** Copy the report skill's \`dataBindings\` JSON exactly. Change only the \`default\` values of date inputs, as its *Date defaults* line says (\`YYYY-MM-DD\` or \`"today"\`), and the \`display\` JSON string's \`p\` (period preset), \`a\` (as-at preset), \`c\` (compare: \`none\` | \`prev_period\` | \`prev_year\` | \`ytd\`) and \`v\` (report view) to match the request; on reports without a \`persona\` input, View as is the display's \`pv\` (\`Client\` | \`Bookkeeper\` | \`Practitioner\` | \`Executive\`). Leave \`org\` empty (the connection's default organisation) unless the user names another organisation that \`list_connections\` returned — then use its \`tenantId\`. For a cash-basis request set the \`basis\` default to \`Cash\`. **Branding:** leave \`style\` = \`xero\` (Xero branding, the default). Set \`style\` = \`mysmb\` when the user asks for mySMB branding or the mySMB report template. Set \`b\` to \`#rrggbb\` only when the user asks for their own or their customer's colour. Keep every other key, input name, option, binding id, tool name and param.
3. **Report document.** Copy the report skill's *Report document* exactly. It is the whole report: the page, the stylesheet, the tested kit (only the parts this report uses) and, in the last \`<script>\`, the report config. Change only the config's \`defaults\` object so it equals the manifest defaults **exactly** (the same dates — the platform opens the report with the manifest defaults), with \`"today"\` written as today's date. Change nothing else: never edit, shorten, reformat or "improve" any other part — it is tested as one unit and the platform validates it against the bindings. (If the dates ever differ, the kit sees it in Xero's report title and refetches at the dates the controls show.)
4. **Save** with \`artifact_save\`: \`title\` = "<Organisation> — <Report name>" (no period — the reader can change it; put the opening period in the one-line \`description\`), \`fileName\` and \`tags\` from the report skill, \`content\` = the document, \`dataBindings\` = the manifest. Do not pass \`connectors\` (a live report derives them). Write the document once, directly in this call — never in chat, in a draft or in a note first.
5. **Completion note** (3–6 lines): the report is live and refreshes on open; the controls the reader can change; the validation checks and whether they passed on the discovery data; any N/A items (the report skill lists them); Download PDF / Download Excel are in the report, and the report window's Download and Share save a frozen snapshot.

The user never has to choose an output format: every report is HTML with Download PDF (print to PDF) and Download Excel (.xlsx). If they ask for Excel or PDF, build the report and point to those buttons.

## Controls contract (kit reports)

- **Organisation (LIB-002).** The organisations this Xero connection can access (\`list_connections\`). With one organisation the box shows its name. With several it is a picker bound to \`org\`, which every binding sends as \`xero_tenant_id\` — switching refetches everything for that organisation only, and its name, base currency and financial year come from \`get_organisation\`. Never type or guess a client name.
- **Period.** A preset (Today … Last financial year, Custom) next to editable From / To dates, or As at with presets. The **financial year comes from the organisation's settings** (\`FinancialYearEndMonth\`); the banner names the source, and says "assumed" only if \`get_organisation\` failed. **Relative presets roll forward**: a saved "This financial year to date" report is recomputed to today's window each time it opens, and again when the reader switches to an organisation with a different year end. The header uses Xero's wording ("For the 3 months ended 30 September 2026", "As at 30 September 2026").
- **Accounting method** (Accrual | Cash): both are loaded (\`paymentsOnly\` false / true), so switching never refetches. Compare to (previous period / previous year / year to date, with $ and % change; on the Profit and Loss also several previous months, quarters or years, each its own Xero P&L); Columns by tracking category (Profit and Loss: Xero's P&L by tracking category); Report (the members); View as (persona).
- **Branding** (under Customise; display only — never refetches): **Xero** (default: white cards, Xero blue #13B5EA accents and charts, navy ink, red negatives, Xero badge, "Prepared from Xero") or **mySMB** (the mySMB Reporting template: teal header band with a white title, white-on-teal table headers, light-teal alternating rows, mySMB badge, and the footer "Business | Report | Generated"). It is stored in the \`display\` input as \`style\`, so downloads and snapshots keep it.
- **Customise** (display only, never refetches): Show cents, Divide by 1000, Except zero amounts (on by default — zero rows are hidden), negatives (-100 / **(100)** / 100-), Show in red (on by default, Xero style), Header, Footer, Compact | 100%, and Brand colour for a client's own colour ("Use Xero branding" resets it; not used under mySMB branding).
- **Delivery.** Download PDF (print stylesheet), Download Excel (a real .xlsx: a sheet per table with a header block, number format, bold totals, a Validation sheet and a Parameters sheet). Host Download and Share produce a self-contained snapshot.
- **Personas.** Client and Executive = summary mode (account lines hidden; totals, charts and validation kept). Bookkeeper and Practitioner = detail mode. A failed check is never hidden.
- **Dashboards are "now".** Business overview, Sales and Purchases overview and the Cash flow manager always open on today (the kit sets it); lists (invoices, bills, credits, payments, bank transactions) are Xero's current balances.
- **Report options** (ageing by / periods, grouping, graph pickers, graph days …) are display-only: they are kept in the \`display\` input's \`o\` string (\`key=value;key=value\`) and never refetch. The report skill lists its keys.
- **Paging.** Xero lists return 100 rows per page: the kit loads every page (one at a time, up to 20 = 2,000 rows) and fails "All … loaded" if a list may be truncated.
- **Monthly figures Xero has no periods option for** (Bank Summary by month; Cash Summary month columns) are loaded month by month after the report opens ("Loading …"). They need the live report — in a snapshot those sections say N/A.
- **Snapshots** freeze the data; the report reads its period from the Xero report's own title and disables the controls that refetch.

## Data and validation rules (kit reports)

- Only \`xero-accounting\` tools. Never invent, estimate or reuse example figures. Anything missing is "N/A — not in source" and listed under Sources & limitations.
- A failed Xero call reaches the report as a binding error: the section shows the message, the banner turns red, and no check computed from it passes. **Xero allows 5 calls in progress per organisation** and the platform opens every binding at once, so the kit re-requests any HTTP 429 one at a time (3 rounds) before showing it as failed.
- Xero report rows are shown in Xero's order and wording ("Less " prefixes on section titles dropped), with Xero's own section totals and computed lines. Every value is Xero's string parsed to a number — never re-signed.
- Every report recomputes its checks on every load and change. Each report includes at least one **independent tie** — a figure matched against a different Xero report (e.g. P&L Net Profit = Balance Sheet Current Year Earnings) — so a check never just re-adds the report's own numbers. Only real checks count in "x/y passed"; N/A and information lines are counted separately.
- Financial output is decision support, not audit, tax or legal advice.

${noReport}

## Rules for report skills without a kit config

These rules apply to every report skill that is a written specification (${spec}). When you build one of those, write the report yourself following these rules.

${prose}
`;
guard('xero-report-foundation', foundation, fdesc);
w('skills/xero-report-foundation.md', foundation);

FAM.forEach((f) => {
  const manifest = JSON.stringify(JSON.parse(rd('reports/' + f.report + '.manifest.json')), null, 2);
  const doc = assemble(f.report).trim();
  if (doc.length > DOC) throw new Error(f.skill + ' report document is ' + doc.length + ' characters (limit ' + DOC + ')');
  if (doc.includes('```')) throw new Error(f.skill + ' report document contains a code fence');
  const byMcp = {};
  JSON.parse(manifest).bindings.forEach((b) => { (byMcp[b.tool.mcp] = byMcp[b.tool.mcp] || new Set()).add('`' + b.tool.name + '`'); });
  const mcps = Object.keys(byMcp).map((m) => '`' + m + '` (' + [...byMcp[m]].join(', ') + ')');
  const tools = mcps.length === 1 ? 'the ' + mcps[0].replace(' (', ' connector (') : 'the connectors ' + mcps.slice(0, -1).join(', ') + ' and ' + mcps[mcps.length - 1];
  const names = JSON.parse(manifest).inputs.map((i) => i.name), cfgSrc = rd('reports/' + f.report + '.cfg.js');
  const step4 = ['Change every control and confirm the report refetches and still validates']
    .concat(names.includes('basis') ? ['switch Accounting method'] : [])
    .concat(names.includes('persona') || /personaDisplay: true/.test(cfgSrc) ? ['switch View as to Client, then Bookkeeper'] : [])
    .concat(/views:\s*\[/.test(cfgSrc) ? ['switch every tab / Report view'] : [])
    .concat(['toggle Branding and the dark theme']).join('; ') + '.';
  const md = `---
name: ${f.skill}
description: ${f.description}
---
# ${f.title} (${f.p})

Use when ${f.trigger}. Load \`xero-report-foundation\` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs ${tools}.

Xero location: ${f.menu}. Library: Xero Reports Prompt Library v1.2 → Prompts → ${f.p}. Delivery: ${f.wave}.

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
${f.chat ? '\n## In the chat reply\n\n' + f.chat.map((c) => '- ' + c).join('\n') + '\n' : ''}
## Save as

\`fileName\`: \`${f.fileName}\` · \`tags\`: ${JSON.stringify(f.tags)}

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: ${f.golden}.
3. Validation banner: every check passes (the independent tie included), or shows N/A / information with a stated reason.
4. ${step4}
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

## dataBindings

${fence('json', manifest)}

## Report document (copy verbatim — change only the config's \`defaults\`)

${fence('html', doc)}
`;
  guard(f.skill, md, f.description);
  w('skills/' + f.skill + '.md', md);
});
console.log('generated', SLUG, '| foundation', foundation.length, 'characters | kit reports:', FAM.map((f) => f.skill).join(', '));

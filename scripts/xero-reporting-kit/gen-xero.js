// node gen-xero.js [mysmb-marketplace root] (default: this repo)
// Writes the Xero report foundation (build recipe + tested kit + the rules kept for prose skills) and one skill per kit-built
// family, under the EXISTING xero-* file stems so the agent blueprint's skill ids and contentHash do not change.
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || require('path').resolve(__dirname, '..', '..');
const SLUG = 'xero-reporting-studio', P = path.join(ROOT, 'plugins', SLUG), K = __dirname;
const FAM = require('./families.js');
const rd = (f) => fs.readFileSync(path.join(K, f), 'utf8').replace(/\r\n/g, '\n');
const w = (rel, s) => { const f = path.join(P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
// The kit goes into the foundation minified for whitespace and comments only (no renaming, no syntax changes) — it keeps the
// foundation well under the 128 × 1024-character skill limit; the round-trip tests run on exactly this text.
const esbuild = require('esbuild');
const kitCompact = esbuild.transformSync(rd('xk-kit.js').replace(/\nif \(typeof module[^\n]*\n?$/, '\n'), { minifyWhitespace: true, legalComments: 'none', target: 'es2017' }).code.trim();
new Function(kitCompact); // parses
// prose = the rules for written-spec skills, kept verbatim from dev (they carry live-QA lessons); noReport = the rule for reports
// this agent has no skill for. Written-spec skills = every skill file on the target that is not a kit family nor the foundation.
const css = rd('xk.css').trim(), skeleton = rd('skeleton.html').trim(), prose = rd('foundation-written-spec.md').trim(), noReport = rd('foundation-noreport.md').trim();
const fence = (lang, s) => '```' + lang + '\n' + s.trim() + '\n```';
const built = FAM.map((f) => '`' + SLUG + ':' + f.skill + '`' + (/^P\d\d$/.test(f.p) ? ' (' + f.p + ')' : '')).join(', ');
const specSkills = fs.readdirSync(path.join(P, 'skills')).map((f) => f.replace(/\.md$/, '')).filter((s) => s !== 'xero-report-foundation' && !FAM.some((f) => f.skill === s)).sort();
const spec = specSkills.map((s) => '`' + SLUG + ':' + s + '`').join(', ');
const LIMIT = 128 * 1024, DESC = 500; // myHubV2 developer skills: markdown ≤ 128 × 1024 characters, description ≤ 500
const guard = (name, md, desc) => { if (md.length > LIMIT) throw new Error(name + ' is ' + md.length + ' characters (limit ' + LIMIT + ')'); if (desc && desc.length > DESC) throw new Error(name + ' description is ' + desc.length + ' characters (limit ' + DESC + ')'); };

const fdesc = 'Shared build recipe, controls contract, validation rules, Xero styling and the tested report kit for every Xero kit report (AGT-001), the rules for report skills built from a written specification, and the connector facts. Load it with the report skill.';
const foundation = `---
name: xero-report-foundation
description: ${fdesc}
---
# Xero report foundation

Use when you build any Xero report, dashboard or report pack. Load this skill first, then the report skill. Two kinds of report skill exist:

- **Kit reports** (${FAM.length}) — ${built}. The report skill carries a tested \`dataBindings\` manifest and a report config; this file carries the tested kit and stylesheet. **You assemble them — you do not write report code.** Follow *Build a kit report* below.
- **Built on request** (${specSkills.length}) — ${spec}. Each is a written specification: build the report yourself following *Rules for report skills without a kit config* at the end of this file.

For a report this agent has no skill for, see *When the user asks for something this agent has no report for*.

Spec: Xero Reports Prompt Library v1.2 (P01–P15) with the v1.2 patch (one agent per platform; LIB-002 client selector; cross-client isolation). Connector: \`xero-accounting\` (the mySMB custom MCP on the Xero Accounting API). The library's Read Me names the claude.ai Xero connector's tools (get_financial_position, get_organisation_info and the like) — **those do not exist here**; use only the tools named in these skills.

## Build a kit report

1. **Discovery call.** Call the report's primary tool once with its default inputs (the report skill says which), plus \`get_organisation\` and \`list_connections\` once each. Confirm Xero is connected (a connection error → tell the user to connect Xero under Settings → Connections and stop). A failed call is an error message, not data: report it. Read the organisation's name from \`get_organisation\`. Never copy a returned figure into the document.
2. **dataBindings.** Copy the report skill's \`dataBindings\` JSON exactly. Change only the \`default\` values of date inputs, as its *Date defaults* line says (\`YYYY-MM-DD\` or \`"today"\`), and the \`display\` JSON string's \`p\` (period preset), \`a\` (as-at preset), \`c\` (compare: \`none\` | \`prev_period\` | \`prev_year\` | \`ytd\`) and \`v\` (report view) to match the request. Leave \`org\` empty (the connection's default organisation) unless the user names another organisation that \`list_connections\` returned — then use its \`tenantId\`. For a cash-basis request set the \`basis\` default to \`Cash\`. **Branding:** leave \`style\` = \`xero\` (Xero branding, the default). Set \`style\` = \`mysmb\` when the user asks for mySMB branding or the mySMB report template. Set \`b\` to \`#rrggbb\` only when the user asks for their own or their customer's colour. Keep every other key, input name, option, binding id, tool name and param.
3. **Report config.** Copy the report config JS exactly. Change only its \`defaults\` object so it equals the manifest defaults **exactly** (the same dates — the platform opens the report with the manifest defaults), with \`"today"\` written as today's date. Change nothing else. (If the two ever differ, the kit sees it in Xero's report title and refetches at the dates the controls show.)
4. **Assemble** one HTML document from the skeleton below: replace \`{{TITLE}}\` with the report title, \`{{CSS}}\` with the stylesheet, \`{{KIT}}\` with the report kit and \`{{CFG}}\` with the report config, all verbatim. Never edit, shorten, reformat or "improve" the kit or the stylesheet — they are tested as one unit and the platform validates the document against the bindings.
5. **Save** with \`artifact_save\`: \`title\` = "<Organisation> — <Report name>" (no period — the reader can change it; put the opening period in the one-line \`description\`), \`fileName\` and \`tags\` from the report skill, \`content\` = the document, \`dataBindings\` = the manifest. Do not pass \`connectors\` (a live report derives them). Never paste the HTML into chat.
6. **Completion note** (3–6 lines): the report is live and refreshes on open; the controls the reader can change; the validation checks and whether they passed on the discovery data; any N/A items (the report skill lists them); Download PDF / Download Excel are in the report, and the report window's Download and Share save a frozen snapshot.

The user never has to choose an output format: every report is HTML with Download PDF (print to PDF) and Download Excel (.xlsx). If they ask for Excel or PDF, build the report and point to those buttons.

## Controls contract (kit reports)

- **Organisation (LIB-002).** The organisations this Xero connection can access (\`list_connections\`). With one organisation the box shows its name. With several it is a picker bound to \`org\`, which every binding sends as \`xero_tenant_id\` — switching refetches everything for that organisation only, and its name, base currency and financial year come from \`get_organisation\`. Never type or guess a client name.
- **Period.** A preset (Today … Last financial year, Custom) next to editable From / To dates, or As at with presets. The **financial year comes from the organisation's settings** (\`FinancialYearEndMonth\`); the banner names the source, and says "assumed" only if \`get_organisation\` failed. **Relative presets roll forward**: a saved "This financial year to date" report is recomputed to today's window each time it opens, and again when the reader switches to an organisation with a different year end. The header uses Xero's wording ("For the 3 months ended 30 September 2026", "As at 30 September 2026").
- **Accounting method** (Accrual | Cash): both are loaded (\`paymentsOnly\` false / true), so switching never refetches. Compare to (previous period / previous year / year to date, with $ and % change); Report (the members); View as (persona).
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

## Kit reference (for adapting a config after discovery)

\`XK.app(cfg)\` keys: \`title\`, \`primary\` (binding whose title a snapshot reads), \`dated\` (bindings whose Xero report title must name the selected dates — checked on open and after each refetch), \`org\` (the \`get_organisation\` binding id), \`conns\` (the \`list_connections\` binding id), \`fyMonth\` (override the organisation's financial-year start), \`retryMs\`, \`inputs\` (role → declared input: start, end, asAt, basis, cmpStart, cmpEnd, cmpAsAt, org, persona, display), \`defaults\`, \`uses\` (binding id → the declared inputs it consumes; drives refetching), \`tools\`, \`compare\`, \`enums\`, \`views\`, \`options\` ([{id, label, options:[[v, l]], def}] → display \`o\`), \`presets\` / \`asats\` (preset lists), \`paged\` ({binding: {input: 'page', key: 'Invoices'}}), \`fan\` ({binding: (inputs, ctx) → [{key, inputs}]} — extra calls after open), \`noBasis\`, \`derive(inputs, fyMonth)\` (applied on open and on every change), \`roll\`, \`render(ctx)\` → \`{checks:[{name, pass:true|false|null, info?, detail}], na, notes, title, period}\`, \`excel(ctx)\`. In \`render\`, \`ctx\` also gives \`rows(id)\` (every page of a list), \`truncated(id)\`, \`fan(id)\`, \`opt(key)\` / \`setOpt(key, value)\`, \`change(inputs, display)\`, \`today\`.

Helpers: \`XK.walk(report)\` → \`{lines:[{kind:'header'|'row'|'total', depth, label, id, group, parent, calc, closes, values}], sections, columns, titles}\`; \`sectionTotal\` / \`sectionBy(walked, /title/)\`; \`linesTies\` (SummaryRow = Σ rows) / \`parentTies\` (Total Assets = Σ sections) / \`runningTies\` (Gross / Net Profit = running Σ); \`currentYearEarnings(lines)\`; \`orgOf\` / \`connections\` / \`companyOf\` / \`fiscalStart\`; \`find\` / \`val\`; \`money\` / \`pct\` / \`periodLine\` / \`rangeLabel\` / \`asOfLine\` / \`footerStamp\`; \`statement\` / \`grid\` / \`kpis\` / \`bars\` / \`line\` / \`donut\` / \`waterfall\`; \`preset\` / \`asAt\` / \`compare\` / \`fyStartOf\`; \`xlsx\` / \`sheetFromLines\`. Lists: \`doc\` / \`openDocs(sets, base, asAt)\` (credits negative) / \`ageingCols(asAt, by, n, len)\` / \`byContact\` / \`pipeline(invoices, asAt)\` (draft, approval, awaiting, overdue). Parts: \`plParts(walked, col)\` (income, expenses, trading, cos, opex, gp, np) / \`bsParts(walked, col)\` (bank, currentAssets, currentLiabilities, ar, ap, gst, totals, cye). Months: \`monthCols(walked)\` / \`monthsEnding(end, n)\` / \`monthKey\` / \`monthLabel\`; \`dateWhere(field, from, to)\` (Xero \`where\` for a date window).

## Skeleton

${fence('html', skeleton)}

## Stylesheet ({{CSS}})

${fence('css', css)}

## Report kit ({{KIT}}) — copy verbatim

${fence('js', kitCompact)}

${noReport}

## Rules for report skills without a kit config

These rules apply to every report skill that is a written specification (${spec}). When you build one of those, write the report yourself following these rules.

${prose}
`;
guard('xero-report-foundation', foundation, fdesc);
w('skills/xero-report-foundation.md', foundation);

FAM.forEach((f) => {
  const manifest = JSON.stringify(JSON.parse(rd('reports/' + f.report + '.manifest.json')), null, 2);
  const cfg = rd('reports/' + f.report + '.cfg.js').trim();
  const tools = [...new Set(JSON.parse(manifest).bindings.map((b) => '`' + b.tool.name + '`'))].join(', ');
  const md = `---
name: ${f.skill}
description: ${f.description}
---
# ${f.title} (${f.p})

Use when ${f.trigger}. Load \`xero-report-foundation\` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the \`xero-accounting\` connector (${tools}).

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

## Save as

\`fileName\`: \`${f.fileName}\` · \`tags\`: ${JSON.stringify(f.tags)}

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: ${f.golden}.
3. Validation banner: every check passes (the independent tie included), or shows N/A / information with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch Accounting method; switch View as to Client, then Bookkeeper; toggle Branding and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

## dataBindings

${fence('json', manifest)}

## Report config ({{CFG}})

${fence('js', cfg)}
`;
  guard(f.skill, md, f.description);
  w('skills/' + f.skill + '.md', md);
});
console.log('generated', SLUG, '| foundation', Buffer.byteLength(foundation), 'bytes | kit reports:', FAM.map((f) => f.skill).join(', '));

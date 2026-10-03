// Generates plugins/quickbooks-reporting-studio from the tested kit + report configs. node gen-ext.js [marketplace-root]
// (default: this repository). reports/<skill>/ carries each kit report as a report template (artifact_from_template,
// "Use this report"): the same document the copy path assembles, and the skill's dataBindings.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..');
const SLUG = 'quickbooks-reporting-studio', P = path.join(ROOT, 'plugins', SLUG), K = __dirname;
const FAM = require('./families.js');
const rd = (f) => fs.readFileSync(path.join(K, f), 'utf8').replace(/\r\n/g, '\n');
const w = (rel, s) => { const f = path.join(P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
const kitCompact = rd('qb-kit.js').replace(/\nif \(typeof module[^\n]*\n?$/, '\n').split('\n').map((l) => l.replace(/^\s+/, '')).filter((l) => l && !/^\/\//.test(l)).join('\n');
new Function(kitCompact); // parses
const css = rd('qb.css').trim(), skeleton = rd('skeleton.html').trim();
const fence = (lang, s) => '```' + lang + '\n' + s.trim() + '\n```';
// The report name: a report template's title, and the saved report's title. Custom report builder has no template, because
// the agent picks its QuickBooks report tool there, and a template copy can only change input defaults.
const NAME = { pnl: 'Profit and Loss', bs: 'Balance Sheet', scf: 'Statement of Cash Flows', ar: 'Aged Receivables', ap: 'Aged Payables', tb: 'Trial Balance',
  gst: 'GST Summary (BAS)', 'gst-overview': 'GST Overview', 'business-snapshot': 'Business Snapshot', homepage: 'Business Overview', 'cash-flow-overview': 'Cash Flow Overview',
  'performance-centre': 'Performance Overview', 'management-reports': 'Report Pack', 'client-overview': 'Client Overview', gl: 'General Ledger', sales: 'Customer Sales',
  expenses: 'Supplier Purchases', 'business-feed': 'Business Feed', budgets: 'Budget vs Actual', 'expenses-overview': 'Purchases Overview', 'sales-overview': 'Sales Overview',
  catalogue: 'Reports Catalogue', 'inventory-overview': 'Inventory Overview', inventory: 'Inventory Valuation', 'customer-hub': 'Customer Hub', 'projects-overview': 'Projects Overview',
  projects: 'Project Profit and Loss', fx: 'Exchange Gains and Losses', custom: 'Custom Report', forecast: 'Forecasts', 'employees-time': 'Employees and Time' };
const templated = (f) => !f.static && !f.custom;
FAM.filter((f) => !f.static).forEach((f) => { if (!NAME[f.id]) throw new Error('no report name for ' + f.id); });
// One report document, exactly as the copy path assembles it (build.js on the code extracted from the skills gives the same bytes).
const docOf = (f) => (skeleton + '\n').replace('{{TITLE}}', NAME[f.id]).replace('{{CSS}}', () => css).replace('{{KIT}}', () => kitCompact.trim()).replace('{{CFG}}', () => rd('reports/' + f.id + '.cfg.js').trim());

// ---------------------------------------------------------------- foundation skill
const foundation = `---
name: quickbooks-report-foundation
description: Shared build recipe, controls contract, validation rules, QuickBooks styling and the tested report kit for every QuickBooks Online report (AGT-003). Load it together with the family skill for any QuickBooks report, dashboard or report pack.
---

# QuickBooks report foundation

Use when you build any QuickBooks Online report, dashboard or report pack. Load this skill first, then the family skill (for example \`quickbooks-profit-and-loss\`). This file carries the tested report kit and stylesheet, and every family skill carries its own tested \`dataBindings\` and report config. You assemble them. You do not write report code from scratch.

Spec: QuickBooks Reports Prompt Library v1.1 (Q00–Q39, Reporting Library Catalogue RPT/LIB rows, Operating Model v0.1). Waves 1–4 are built; the payroll families (Q32–Q34) wait on an Employment Hero payroll connector. Each family skill traces its FULL PROMPT sections to this build.

## Build a report (every family)

Every report skill except *Custom report builder* names its **template**: the extension \`${SLUG}\` and the report skill's own name as the slug (for example \`quickbooks-profit-and-loss\`). The template is the same tested document the copy path below assembles, with the skill's \`dataBindings\`.

1. **Pick the family skill** that matches the request. If the family is not built yet, say so and offer the closest built report or a QuickBooks export (see the agent's routing table). Never approximate a report from adjacent data.
2. **Discovery call.** Call the family's primary tool once, with the family's default inputs, and call \`qbo_query\` with \`SELECT * FROM CompanyInfo\` once. You need three things from these calls:
   - Confirm that QuickBooks is connected. If a call fails with a connection error, tell the user to connect QuickBooks under Settings → Connections, and stop.
   - Check that the response has the shape the family skill describes (QuickBooks report JSON is \`Header\` / \`Columns\` / \`Rows.Row[]\`, with sections carrying \`group\`, \`Header\`, \`Rows\` and \`Summary\`).
   - Read \`CompanyName\` and \`FiscalYearStartMonth\` for the date defaults. Do not copy any returned figure into the document.
3. **Starting values.** Decide the inputs the report opens on, starting from the family's \`dataBindings\` defaults. Change only the \`default\` values of date inputs, as the family skill's *Date defaults* line says (\`YYYY-MM-DD\` or \`"today"\`). The \`display\` default is a JSON string: set \`p\` (period preset), \`a\` (as-of preset), \`c\` (compare mode) and \`v\` (report view or member) to match the request. **Branding:** set \`b\` to a brand colour (\`#rrggbb\`) only when the user asks for their own or their customer's branding in chat ("use our brand colour #1a4d8f", "match Acme's navy"); otherwise leave \`b\` empty and the report uses QuickBooks branding, because the data comes from QuickBooks. Keep every other key, input name, option, binding id, tool name and param.
4. **Title and description.** \`title\` = the family skill's *Report title* exactly (for example "QuickBooks Profit and Loss"): the platform, then the report's agreed name in Title Case — no company and no period, because the reader can switch both in the report and the saved title cannot follow; the report header always shows the current company and period. Put them in the one-line \`description\` instead ("Opens on <Company> · August 2026, accrual basis").
5. **Create the report.**
   - **If \`artifact_from_template\` is in your tools** and the family skill names a template, call it once: \`plugin\` = \`${SLUG}\`, \`slug\` = the family skill's name, \`inputs\` = only the inputs you changed in step 3 as \`{ "input name": value }\` (\`display\` is the whole JSON string with your changes; dates are \`YYYY-MM-DD\` or \`"today"\`), and \`title\` and \`description\` from step 4. The platform saves an exact copy of the tested template — you write no HTML, and the report opens on your inputs. If the tool says it has no such template (the installed extension is older than this skill), or the discovery call showed a label or group the config does not recognise, use the copy path instead.
   - **Otherwise (copy path):** (a) copy the family's \`dataBindings\` JSON exactly, with the step 3 defaults. (b) Copy the family's report config JS exactly and change only its \`defaults\` object so that it equals the manifest defaults, with \`"today"\` written as today's date (\`YYYY-MM-DD\`); if the discovery call showed a label or group the config does not recognise, you may widen the matching regular expression in \`render\`. (c) Assemble one HTML document from the skeleton below: replace \`{{TITLE}}\` with the report name, \`{{CSS}}\` with the stylesheet, \`{{KIT}}\` with the report kit and \`{{CFG}}\` with the report config, all verbatim. Never edit, shorten, reformat or "improve" the kit or the stylesheet: they are tested as one unit, and the platform validates the document against the bindings. (d) Save with \`artifact_save\`: \`title\` and \`description\` from step 4, \`fileName\` and \`tags\` from the family skill, \`content\` = the document and \`dataBindings\` = the manifest. Do not pass \`connectors\`, because a live report derives them. Never paste the HTML into chat.
6. **Completion note.** Keep it to 3–6 lines:
   - that the report is live and refreshes on open;
   - the controls the reader can change;
   - the validation checks and whether they passed on the discovery data;
   - any N/A items (the family skill lists them);
   - that Download PDF / Download Excel are in the report, and that the report window's Download and Share save a frozen snapshot.

The user never has to choose an output format. Every report is HTML with Download PDF (print to PDF) and Download Excel (.xlsx) buttons. If the user asks for Excel or PDF, build the report and point them to those buttons.

## Controls contract (LIB-002, Q38, Q39)

The kit renders the control row from the config, so every report has the same grammar:

- **Client selector (LIB-002).** It lists the companies this QuickBooks connection can access. The \`quickbooks-accounting\` connector is authorised for exactly one company (realm), so it shows that one company, taken from CompanyInfo. The report holds only that company's data. To switch client, connect another QuickBooks company under Settings → Connections. Never type or guess a client name. When CompanyInfo returns no name, the header says "N/A — not in source".
- **Period controls.** A Report period preset (Today … Last financial year, Last 30 days, Since 60/90/365 days ago, Custom) sits next to editable From / To dates. Or As of with presets (Today, End of last month, End of last quarter, End of last financial year, Custom). Presets use the company's financial-year start (CompanyInfo, then Preferences; 1 July only as a flagged fallback). **Relative presets roll forward**: a saved "This financial year to date" report is recomputed to today's window each time it is opened.
- Accounting method (Cash | Accrual) where the report takes it; Display columns by; Compare to (previous period / previous year / year-to-date, with $ and % change); Report (the family members); View as (persona).
- **Customise** (display only, never refetches): Show cents, Divide by 1000, Except zero amounts, negative style (-100 / (100) / 100-), Show in red, Header, Footer, Compact | 100% view, Style (**QuickBooks look** by default, or the **mySMB house style** toggle) and **Brand colour** (re-colours every accent; "Use QuickBooks branding" resets it). With no brand colour the report carries QuickBooks branding — green accents and "Prepared from QuickBooks Online" — because the data comes from the QuickBooks connector. These live in the one \`display\` input so downloads keep them.
- **Delivery (Q39).** Download PDF (print stylesheet, A4), Download Excel (a real .xlsx: one sheet per table with a header block, A$ number format, bold totals, a Validation sheet and a Parameters sheet), Open in QuickBooks (a classic report deep link where the library gives a token). Host Download and Share produce a self-contained snapshot. Email is done from the workspace, not the report.
- **Parameter contract (Q38).** The Parameters sheet and the deep link use QuickBooks' classic \`reportv2\` names: \`token\`, \`date_macro\`, \`low_date\`, \`high_date\`, \`cash_basis\`, \`divideby1000\`, \`hidecents\`, \`exceptzeros\`, \`negativenums\`, \`negativered\`, \`show_header_title\` / \`range\` / \`company\`. The deep link carries only \`token\` + \`date_macro\` (a named preset). The \`low_date\` / \`high_date\` date format is unconfirmed, so verify the round trip on first run.
- **Persona modes.** Client and Executive give summary mode (account lines hidden; headline totals, charts and validation kept). Bookkeeper and Practitioner give detail mode. A failed check is never hidden.
- **Snapshot mode.** Downloads and share links freeze the data. The report reads the period and basis from the QuickBooks report Header (the data itself), disables the controls that refetch, keeps the display controls, and says the figures are frozen.

## Data and validation rules

- Only \`quickbooks-accounting\` tools. Never invent, estimate or reuse example figures. Anything missing is "N/A — not in source" and is listed under Sources & limitations. A tool that returns no rows is *unavailable*, not zero.
- Every family has STEP 4 checks. The kit recomputes them on every load and every control change and shows them in the validation banner: Pass, Fail (red, listed first), N/A (cannot be computed) or information only (\`info: true\`), with the data timestamp, the financial-year source and the mechanism used. Only real checks count in "x/y passed"; N/A and information lines are listed and counted separately, so a report with nothing wrong never reads as a failure.
- Sign and classification: QuickBooks can return credits where you expect debits (for example a negative Cost of Sales). The report shows the figures as QuickBooks returned them and adds a note. It never silently flips a sign.
- Connector limits that the reports state rather than work around: one company per connection; the ageing reports age as of today (\`report_date\`, \`aging_period\`, \`num_periods\`, \`aging_method\` and \`past_due\` are not passed by the connector yet); the Tax Summary returns BAS figures only for a named tax agency (\`agency_id\`; the GST reports list the agencies with \`list_tax_agency\` and use the ATO); PAYG, payroll, leave and ATO reports live in Employment Hero (QuickBooks time activities and the employee contact list are in Q31); the Audit Log is UI-only; a forecast (Q09) is an estimate projected from actuals, never a QuickBooks figure.
- If the user needs data the connector does not expose, ask them for the QuickBooks export (Reports › open the report › set the controls › Export › Excel). Read the company, report name, period and basis from the export header and confirm them. Then save a STATIC report (no \`dataBindings\`) with \`connectors: ["quickbooks-accounting"]\` and say it is frozen.
- Financial output is decision support, not audit, tax or legal advice.

## Spec trace (applies to every family)

| Library v1.1 element | Where it is implemented |
|---|---|
| (a) Purpose & intended users | Persona modes (View as); family skill trigger |
| (b) Data, metrics, filters, calculations | Family \`dataBindings\` (tool mapping) and STEP 4 checks in the config |
| (c) Interactivity & controls | Kit control row (above). Every data control refetches through \`MyHubReport.getData\` with the full declared input set |
| (d) Layout, charts, appearance | Family config \`render\` + stylesheet (QuickBooks look; mySMB house-style toggle; light and dark themes) |
| (e) Source & connection mechanisms | Mechanism 4 only: the mySMB custom MCP on the Accounting API v3 (\`quickbooks-accounting\`). Mechanisms 1–3 (Intuit connector, Intuit open-source MCP, CData) and 5 (Spreadsheet Sync) do not exist inside a workspace; 6 = export fallback (above); 7 = Open in QuickBooks |
| (f) Screenshots | QA compares the report against the Shots tabs (family QA script) |
| (g) Priority / delivery order | Per family skill (Wave 1: Trains 01–02; Wave 2: Trains 03–04; Wave 3: Trains 05–06; Wave 4: Feature F6) |
| STEP 1 Confirm inputs | Declared inputs with defaults. Ask only for what cannot be defaulted, never for the output format |
| STEP 2 Get data | Live bindings, re-run as the viewer on every open |
| STEP 3 Build per layout spec | Family config \`render\` (QuickBooks row order, indented sub-accounts, bold "Total for" rows, header block, footer) |
| STEP 4 Validate | Validation banner (recomputed on every load and change) |
| STEP 5 Output — "self-contained, no runtime calls, embedded data window" | Replaced by the platform contract: a live report hydrates on open, and Download / Share produce a self-contained snapshot. The live report can show any period without a pre-embedded data window |

## Kit reference (for adapting a config after discovery)

\`QB.app(cfg)\` config keys: \`title\`, \`token\` / \`route\` (deep link), \`primary\` (binding whose Header gives the period in snapshots), \`company\` / \`prefs\` (binding ids), \`inputs\` (role → declared input name: start, end, asAt, basis, columnsBy, cmpStart, cmpEnd, cmpAsAt, persona, display), \`defaults\`, \`uses\` (binding id → the declared inputs it consumes; drives which bindings refetch), \`tools\` (shown in Sources), \`columnsBy\`, \`compare\`, \`enums\` (\`[{input, label, options:[[value, label]]}]\` — extra declared inputs as selects), \`presets\` (period preset list override), \`headerEnd\` (false keeps the declared end date in snapshots), \`views\`, \`derive(inputs, fyMonth)\`, \`roll(inputs, fyMonth, display)\`, \`noHead\`, \`render(ctx)\` → \`{checks:[{name, pass:true|false|null, info?, detail}], na:[], notes:[], title, period}\`, \`excel(ctx)\` → sheets.

The \`ctx\` passed to \`render\` has: \`data\`, \`errors\`, \`err(id)\`, \`inputs\`, \`display\`, \`view\`, \`compareMode\`, \`persona\`, \`company\`, \`fy\`, \`currency\`, \`live\`, \`today\`, \`body\`, \`change(patch, displayPatch)\`.

Helpers: \`QB.walk\` / \`find(lines, group, labelRegex, kind)\` / \`val\` / \`cols\` / \`header\` / \`noData\` / \`sectionTies\` / \`mergeCompare\` / \`compareCols\` / \`bas\`; \`cashEnd(lines, monthIdx, closing)\` (month-end cash; worked back from a closing balance when the cash flow has no closing-cash line) / \`bankCash(balanceSheet, accounts)\` (bank-account rows on a balance sheet); \`money\` / \`pct\` / \`periodLine\` / \`asOfLine\` / \`footerStamp\`; \`statement\` / \`grid\` / \`kpis\` / \`bars\` / \`line\` (optional \`band\`) / \`donut\` / \`waterfall\`; \`preset\` / \`asAt\` / \`compare\` / \`fyStartOf\`; \`xlsx\` / \`sheetFromLines\`.

## Skeleton

${fence('html', skeleton)}

## Stylesheet ({{CSS}})

${fence('css', css)}

## Report kit ({{KIT}}) — copy verbatim

${fence('js', kitCompact)}
`;
w('skills/quickbooks-report-foundation.md', foundation);

// ---------------------------------------------------------------- family skills
const buildCatalogue = require('./build-catalogue.js');
FAM.filter((f) => f.static === true).forEach((f) => {
  const page = buildCatalogue();
  w('skills/' + f.skill + '.md', `---
name: ${f.skill}
description: QuickBooks Online ${f.title} (${f.q}) — a searchable index of every QuickBooks report and surface with its family prompt and build status. Use when ${f.trigger}.
---

# ${f.title} (${f.q})

Use when ${f.trigger}. This is a **static** page: it holds no company data and calls no tools, so the foundation's *Build a report* steps do not apply.

QuickBooks location: ${f.menu}. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → ${f.q}. Delivery: ${f.wave}.

## Build

1. Save the page below verbatim with \`artifact_save\`: \`title\` = "QuickBooks reports catalogue", \`fileName\` = \`${f.fileName}\`, \`tags\` = ${JSON.stringify(f.tags)}, \`content\` = the page. Do not pass \`dataBindings\` or \`connectors\`.
2. In the completion note, say the catalogue lists all 40 families (Q00–Q39) with their member reports, and that built families show the wording to ask for them.
3. If the user only wants a quick answer ("can you do an aged payables report?"), answer from the routing list instead of saving the page.

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation (shown in the banner)

${f.checks.map((c) => '- ' + c).join('\n')}

## QA test script

1. Ask the agent for the reports catalogue. Confirm it saved and opens.
2. Search "ageing": the A/R and A/P families appear. Filter Status = Built: ${FAM.length} families (+ the Q38/Q39 contracts). Filter Status = On the roadmap: the rest.
3. Toggle a favourite star, then filter Status = ★ Favourites. Switch Style and the workspace theme.
4. Compare the groups and counts with the library: ${f.golden}

## Page

${fence('html', page)}
`);
});
// ---- Audit Log: static page filled from the user's QuickBooks export
FAM.filter((f) => f.static === 'export').forEach((f) => {
  const tpl = rd('reports/audit-log.template.html').replace('{{CSS}}', () => css);
  w('skills/' + f.skill + '.md', `---
name: ${f.skill}
description: QuickBooks Online ${f.title} (${f.q}) from the QuickBooks Audit Log export the user attaches — events by type and user with filters. Use when ${f.trigger}.
---

# ${f.title} (${f.q})

Use when ${f.trigger}. The Audit Log is **not available through the QuickBooks Accounting API**, so this report is built from an export and saved as a **static** (frozen) page. Do not call QuickBooks tools for it.

QuickBooks location: ${f.menu}. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → ${f.q}. Delivery: ${f.wave}.

## Build

1. If no export is attached, ask for it: *QuickBooks › Reports › Audit Log › set User, Date Changed and Events › export (or print to PDF) and attach the file here.*
2. Read the export. Take the company name and date range from its header; if the company is not in the file use \`null\` (the page shows "N/A — not in source"). For each event row take: \`date\` (Date Changed, as written, ISO \`YYYY-MM-DD HH:MM\` when the date is unambiguous), \`user\`, \`event\` (the full Event / History text), \`name\` and \`amount\` (as text, when present). Do not invent, merge or drop rows.
3. Build the JSON: \`{"company": …, "period": "<d Month yyyy> - <d Month yyyy>", "fileName": "<attached file name>", "rows": [ … ]}\`. **Escape every \`<\` as \`\\u003c\`** so event text can never close the script tag.
4. Replace \`{{DATA}}\` in the page below with that JSON — nothing else. Save with \`artifact_save\`: \`title\` = "<Company> — Audit Log — <period>", \`fileName\` = \`${f.fileName}\`, \`tags\` = ${JSON.stringify(f.tags)}. Do not pass \`dataBindings\` or \`connectors\`.
5. Completion note: number of events, the period, that the page is a frozen copy of the export, and the top event types.

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation (shown in the banner)

${f.checks.map((c) => '- ' + c).join('\n')}

## QA test script

1. Export the Audit Log for a week from the golden-set company and attach it. Confirm every row appears once and the counts by type add up.
2. Filter by user, event type and date; search a document number. Compare with QuickBooks: ${f.golden}
3. Include an event whose text contains \`<\` or \`</script>\` and confirm the page still renders.

## Page

${fence('html', tpl)}
`);
});
// ---- Ask a question: routing guide, no page of its own
FAM.filter((f) => f.static === 'guide').forEach((f) => {
  const routes = FAM.filter((x) => !x.static).map((x) => '| ' + x.q + ' ' + x.title + ' | `' + SLUG + ':' + x.skill + '` |').join('\n');
  w('skills/' + f.skill + '.md', `---
name: ${f.skill}
description: Answer a plain-English question about QuickBooks Online figures with one tool call, the exact period and the source line, and offer the full live report (${f.q}). Use when ${f.trigger}.
---

# ${f.title} (${f.q})

Use when ${f.trigger}. This replaces QuickBooks' "Ask a question (BETA)" and Intuit Intelligence. It answers in chat; it does not build a page unless the user wants the full report.

## Steps

1. **Decide the shape.** One figure or a short list ("net profit last month", "who owes us the most", "bank balance") → answer in chat. A full statement, dashboard or pack → load \`${SLUG}:quickbooks-report-foundation\` and the family skill (table below) and build the report.
2. **Resolve the period** from the question. Read \`FiscalYearStartMonth\` with \`qbo_query\` (\`SELECT * FROM CompanyInfo\`) for "this financial year" or "year to date". Always state the exact dates you used. If the period is genuinely ambiguous, ask one short question.
3. **Call one tool** that holds the answer:

| Question | Tool | Read |
|---|---|---|
| Income, expenses, gross or net profit for a period | \`get_report_profit_and_loss\` (start_date, end_date, accounting_method) | Section groups Income, COGS, GrossProfit, Expenses, NetIncome |
| Spending on an account or category | \`get_report_profit_and_loss\` | The account row (match by label, case-insensitive) |
| Spending with a supplier | \`get_report_vendor_expenses\` | The supplier row |
| Sales to a customer or of a product | \`get_report_customer_sales\` / \`get_report_item_sales\` | The customer / product row |
| Who owes us / what is overdue | \`get_report_aged_receivables\` | Rows and bands; TOTAL |
| Who we owe / bills due | \`get_report_aged_payables\` | Rows and bands; TOTAL |
| Bank or card balances | \`list_account\` (where "AccountType IN ('Bank', 'Credit Card')") | CurrentBalance ("In QuickBooks") |
| Assets, liabilities, equity at a date | \`get_report_balance_sheet\` (end_date) | Groups TotalAssets, Liabilities, Equity |
| GST for a quarter | \`list_tax_agency\`, then \`get_report_tax_summary\` with \`agency_id\` = the Australian Tax Office's Id | BAS labels 1A, 1B, 9 (no rows = no GST transactions for that agency in the period — a nil period, every label A$0 — but only if the agency has GST rows over a longer history; if it never does, or no tax agency is set up, say GST is unavailable, not zero) |
| A specific invoice or bill | \`list_invoice\` / \`list_bill\` (where "DocNumber = '…'") | Balance, DueDate |

4. **Answer** in one to three sentences: the figure (QuickBooks format, e.g. -A$175,286.75), the period, the basis, and the source — "from the QuickBooks Profit and Loss, 1 August 2026 to 31 August 2026, accrual basis, line Net Income". If you added lines together, list them.
5. **Offer the full report** ("Want the live Profit and Loss for August?") and build it with the family skill if the user says yes.

## Guardrails

- Only figures a tool returned. Never estimate, forecast or advise. Missing data is "N/A — not in source".
- If QuickBooks is not connected, say so and point to Settings → Connections.
- Questions the Accounting API cannot answer (audit log, payroll, bank-feed status): say so and offer the QuickBooks export route.

## Validation

${f.checks.map((c) => '- ' + c).join('\n')}

## Routing — full reports

| Family | Skill |
|---|---|
${routes}

## QA test script

1. Ask five questions covering profit, a supplier, who owes the most, the bank balance and GST. Each answer states the figure, the exact period, the basis and the source line, and matches the same QuickBooks report.
2. Example: ${f.golden}
3. Ask an ambiguous question ("how did we do?") — the agent asks one short clarifying question or picks a stated default period.
`);
});
FAM.filter((f) => f.static === 'doc').forEach((f) => {
  w('skills/' + f.skill + '.md', `---
name: ${f.skill}
description: ${f.description}. Use when ${f.trigger}.
---

# ${f.title} (${f.q})

Use when ${f.trigger}. This is a **guide**: it has no page or data of its own and works through the family reports.

QuickBooks location: ${f.menu}. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → ${f.q}. Delivery: ${f.wave}.

${f.body}

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation

${f.checks.map((c) => '- ' + c).join('\n')}

## QA test script

1. Ask for the request this guide covers (see *Use when*). Confirm the agent builds or saves the right family report and says what is N/A.
2. Confirm the saved report validates and its Download Excel file opens with the Validation and Parameters sheets.
3. Compare with QuickBooks: ${f.golden}
`);
});
FAM.filter((f) => !f.static).forEach((f) => {
  const manifest = JSON.stringify(JSON.parse(rd('reports/' + f.id + '.manifest.json')), null, 2), cfg = rd('reports/' + f.id + '.cfg.js');
  const tools = [...new Set(JSON.parse(manifest).bindings.map((b) => b.tool.name))].map((t) => '`' + t + '`').join(', ');
  const md = `---
name: ${f.skill}
description: QuickBooks Online ${f.title} (${f.q}) as a live, validated report in QuickBooks styling. Use when ${f.trigger}.
---

# ${f.title} (${f.q})

Use when ${f.trigger}. Load \`quickbooks-report-foundation\` first and follow its *Build a report* steps. Report title: **QuickBooks ${NAME[f.id]}**. ${templated(f) ? 'Template: \`' + SLUG + '\` / \`' + f.skill + '\` (for \`artifact_from_template\`); without that tool, use the blocks below.' : 'No template: you choose the QuickBooks report tool, so always use the copy path with the blocks below.'} This skill needs the \`quickbooks-accounting\` connector (${tools}).

QuickBooks location: ${f.menu}. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → ${f.q}. ${f.wave ? 'Delivery: ' + f.wave + '.' : 'Delivery: Wave 1.'}
${f.note ? '\n' + f.note + '\n' : ''}
${f.custom ? `## Choosing the report\n\nPick the QuickBooks report tool that matches the request from: \`get_report_account_list\`, \`get_report_aged_payable_detail\`, \`get_report_aged_payables\`, \`get_report_aged_receivable_detail\`, \`get_report_aged_receivables\`, \`get_report_balance_sheet\`, \`get_report_cash_flow\`, \`get_report_class_sales\`, \`get_report_customer_balance\`, \`get_report_customer_balance_detail\`, \`get_report_customer_income\`, \`get_report_customer_sales\`, \`get_report_department_sales\`, \`get_report_general_ledger\`, \`get_report_general_ledger_detail\`, \`get_report_inventory_valuation_summary\`, \`get_report_item_sales\`, \`get_report_journal_report\`, \`get_report_profit_and_loss\`, \`get_report_profit_and_loss_detail\`, \`get_report_sales_by_class_summary\`, \`get_report_sales_by_customer\`, \`get_report_sales_by_department\`, \`get_report_sales_by_product\`, \`get_report_tax_summary\`, \`get_report_transaction_list\`, \`get_report_trial_balance\`, \`get_report_vendor_balance\`, \`get_report_vendor_balance_detail\`, \`get_report_vendor_expenses\`. In the dataBindings change only the \`custom_report\` binding's \`tool.name\`. In the config change only \`title\`, \`tools.custom_report\` (the tool name) and \`defaults\`; keep every other line. If the report takes no period (for example Account List), keep the date inputs — QuickBooks ignores them. Prefer a dedicated family skill when one exists.\n\n` : ''}## Discovery call

${f.discovery}.

## Date defaults

${f.dates}

## Members

| Member / view | How |
|---|---|
${f.members.map((m) => '| ' + m[0] + ' | ' + m[1] + ' |').join('\n')}

## Validation checks (STEP 4 — shown in the banner)

${f.checks.map((c) => '- ' + c).join('\n')}

## Save as

\`fileName\`: \`${f.fileName}\` · \`tags\`: ${JSON.stringify(f.tags)}

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): ${f.golden}
3. Compare the layout with the ${f.q} screenshots (row order, "Total for" rows, header block, footer, number format).
4. Validation banner: every check passes, or shows N/A with a stated reason.
5. Change every control in the control row, and confirm the report refetches and still validates. Switch View as to Client, then Bookkeeper.
6. Toggle Style to the mySMB house style and back, then switch the workspace to the dark theme.
7. Download PDF and Download Excel. Confirm they match the screen (the Excel file has Validation and Parameters sheets).
8. Use Download or Share from the report window, open the snapshot and confirm the period and figures are frozen and the controls that refetch are disabled.
9. Cross-client isolation (LIB-002): confirm that the saved report and every export carry only this company's figures and name.

## dataBindings

${fence('json', manifest)}

## Report config ({{CFG}})

${fence('js', cfg)}
`;
  w('skills/' + f.skill + '.md', md);
});

// ---------------------------------------------------------------- report templates
// reports/<skill>/report.json + report.html. report.json holds only the keys myHubV2 reads (report-templates.ts, a strict
// schema); the description is the reader's, shown in Reports → From your plugins.
const memberList = (f) => { let l = f.members.filter((m) => !/^(N\/A|Not |Wave \d|Use )/i.test(String(m[1]))).map((m) => m[0]).join(', '); if (l.length > 260) l = l.slice(0, l.lastIndexOf(', ', 260)) + ' and more'; return l; };
FAM.filter(templated).forEach((f) => {
  const meta = { title: 'QuickBooks ' + NAME[f.id], description: 'Live, validated QuickBooks Online ' + NAME[f.id] + ' (' + f.q + ')' + (memberList(f) ? ': ' + memberList(f) : '') + '.', tags: f.tags, fileName: f.fileName, dataBindings: JSON.parse(rd('reports/' + f.id + '.manifest.json')) };
  if (meta.description.length > 2000 || meta.tags.length > 20) throw new Error(f.skill + ' template metadata is over the platform limits');
  w('reports/' + f.skill + '/report.json', JSON.stringify(meta, null, 2) + '\n');
  w('reports/' + f.skill + '/report.html', docOf(f));
});
// A template whose report no longer ships as one would linger in the Reports library: remove it.
for (const d of fs.existsSync(path.join(P, 'reports')) ? fs.readdirSync(path.join(P, 'reports')) : []) if (!FAM.some((f) => templated(f) && f.skill === d)) fs.rmSync(path.join(P, 'reports', d), { recursive: true, force: true });

// ---------------------------------------------------------------- agent
const route = FAM.map((f) => `- ${f.q} ${f.title} → ${SLUG}:${f.skill}`).join('\n');
const rolePrompt = `You are the QuickBooks Reporting Specialist (AGT-003). You build accurate, validated, live QuickBooks Online reports, dashboards and report packs in QuickBooks' own styling, from the connected QuickBooks company.

For every report request:
1. Choose the family skill from the routing list below. Load ${SLUG}:quickbooks-report-foundation and that family skill before calling any tool.
2. Follow the foundation's "Build a report" steps exactly. Make one discovery call to the family's primary tool and one qbo_query for CompanyInfo. When you have the artifact_from_template tool and the family skill names a template, create the report with it, passing only the inputs the request changes (the date defaults and the display settings). Otherwise copy the family's dataBindings and report config with those changes, assemble the skeleton with the stylesheet, kit and config verbatim, and save with artifact_save, passing dataBindings.
3. Ask only for what cannot be defaulted, such as a specific period the user named ambiguously. Never ask for an output format: every report is HTML with Download PDF and Download Excel buttons.
4. Reply with a short completion note (3–6 lines) and the report button.

Routing (built):
${route}

Families not built yet: ${JSON.parse(rd('reports/catalogue.data.json')).filter((r) => !r.skill).map((r) => r.family.split(' (')[0] + ' (' + r.q + ', Wave ' + r.wave + ')').join(', ')}. For these, say the report is on the Reporting Library roadmap. Offer the closest built report, or offer to reproduce a QuickBooks export the user attaches. Never improvise one of these from adjacent data.

Rules:
- Use only the quickbooks-accounting connector and only what it returns. Never invent, estimate or reuse example figures. Missing data is "N/A — not in source", and empty data is unavailable, not zero.
- The client is the company this QuickBooks connection is authorised for (one company per connection). To report on another client, the user connects that company under Settings → Connections. Never type or guess a client name, and never mix two companies in one report.
- QuickBooks connection mechanisms named in the prompt library other than this connector (the Intuit connector, Intuit's open-source MCP, CData, Spreadsheet Sync) are not available in the workspace. Do not mention them to the user unless they ask.
- State connector limits plainly when they apply: ageing is as of today; the GST Tax Summary needs the tax agency (the GST reports use the ATO); PAYG and payroll live in Employment Hero.
- A forecast is an estimate projected from QuickBooks actuals. Always call it an estimate, and never present a forecast figure as a QuickBooks figure.
- If QuickBooks is not connected, say so and point to Settings → Connections. Do not build an empty report.
- Branding: reports use QuickBooks branding by default. If the user asks for their own or their customer's branding, set the brand colour as the foundation skill describes (the display input; on the copy path also the config defaults); never guess a colour.
- Financial outputs are decision support, not audit, tax or legal advice. Be concise and factual.`;
if (rolePrompt.length > 20000) throw new Error('role prompt too long');
const skills = ['quickbooks-report-foundation'].concat(FAM.map((f) => f.skill)).map((s) => SLUG + ':' + s);
const agent = { name: 'QuickBooks Reporting Specialist', key: 'quickbooks-reporting-specialist', description: 'Builds live, validated QuickBooks Online reports, dashboards and report packs in QuickBooks styling (Reporting Library AGT-003).', model: 'sonnet' };
w('agents/' + agent.key + '.md', `---\nname: ${agent.name}\ndescription: ${agent.description}\nconnectors: quickbooks-accounting\nskills: ${skills.join(', ')}\nmodel: ${agent.model}\n---\n${rolePrompt}\n`);
const h = crypto.createHash('sha256').update('agent:' + SLUG + ':' + agent.key).digest('hex');
const originKey = h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
const payload = { audienceMode: 'everyone', connectors: ['quickbooks-accounting'], description: agent.description, key: agent.key, kind: 'agent', model: agent.model, name: agent.name, originKey, platform: false, rolePrompt, skills };
const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);
const contentHash = crypto.createHash('sha256').update(JSON.stringify(sortDeep(payload))).digest('hex');
const blueprint = sortDeep(Object.assign({}, payload, { contentHash }));
w('content/agents/' + originKey + '.json', JSON.stringify(blueprint, null, 2) + '\n');

// ---------------------------------------------------------------- bundle files
const description = 'Live, validated QuickBooks Online reports in QuickBooks styling — statements, ageing, GST/BAS, dashboards and management packs — with a specialist reporting agent.';
const pjPath = path.join(P, '.claude-plugin', 'plugin.json'), pjVersion = fs.existsSync(pjPath) ? JSON.parse(fs.readFileSync(pjPath, 'utf8')).version : '0.0.0';
w('.claude-plugin/plugin.json', JSON.stringify({ category: 'Finance', content: { agents: ['content/agents/' + originKey + '.json'], automations: [], formTemplates: [], forms: [], workqTemplates: [] },
  description, icon: 'chart-line', keywords: ['quickbooks', 'qbo', 'reports', 'finance', 'bas', 'gst', 'html'], name: SLUG, reports: 'reports', tags: [], version: pjVersion }, null, 2) + '\n');
w('.mcp.json', JSON.stringify({ mcpServers: { 'quickbooks-accounting': { type: 'http', url: 'https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/quickbooks-accounting/mcp' } } }, null, 2) + '\n');
w('assets/logo.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="QuickBooks Reporting Studio"><rect width="64" height="64" rx="14" fill="#2CA01C"/><rect x="14" y="34" width="8" height="16" rx="2" fill="#fff"/><rect x="28" y="24" width="8" height="26" rx="2" fill="#fff"/><rect x="42" y="14" width="8" height="36" rx="2" fill="#fff"/><path d="M12 22 L26 16 L36 20 L52 8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></svg>\n`);
w('README.md', `# QuickBooks Reporting Studio

${description}

Reporting Library: QuickBooks Reports Prompt Library v1.1 (Q00–Q39). This version delivers **Waves 1–4** (${FAM.length} families). The payroll families (Q32–Q34) wait on an Employment Hero payroll connector.

## What's in the box

- **Agent:** QuickBooks Reporting Specialist (AGT-003), on Sonnet, with the \`quickbooks-accounting\` connector.
- **Skills:** 1 foundation (build recipe, controls contract, validation rules, the tested report kit and stylesheet) + ${FAM.length} family skills:
${FAM.map((f) => '  - ' + f.q + ' ' + f.title + ' — `' + f.skill + '`').join('\n')}
- **Every report:** live data, client selector (one company per connection), period presets that roll forward, Cash/Accrual, Display columns by, Compare to, Customise (cents, divide by 1000, zero rows, negatives, header/footer), persona modes, QuickBooks look with a mySMB house-style toggle, light and dark themes, a validation banner, Download PDF and Download Excel (.xlsx), and Open in QuickBooks where a deep link exists.

- **Report templates:** every family except the custom report builder also ships as a report template (\`reports/<skill>/\`), listed in the workspace under Reports → From your plugins (**Use this report**). The agent creates reports from them with \`artifact_from_template\` when the platform has it, so it never retypes the report.

Connect QuickBooks under Settings → Connections (OAuth) before asking for a report.

## Connector limits (stated in the reports)

- One QuickBooks company per connection.
- Ageing reports age as of today: \`report_date\`, \`aging_period\`, \`num_periods\`, \`aging_method\` and \`past_due\` are not passed by the connector yet.
- \`get_report_tax_summary\` returns BAS figures only when \`agency_id\` names the tax agency (added in myhub-mcp-servers #542). The GST reports list the agencies and use the Australian Tax Office.
- PAYG, payroll, leave and ATO reports live in Employment Hero. QuickBooks time activities and the employee contact list are in Q31.
- \`get_company_info\` looks CompanyInfo up by realm id and returns "not found". The reports read CompanyInfo through \`qbo_query\` instead.

## Maintenance

The skills and report templates are generated from \`scripts/quickbooks-reporting-kit/\` (\`npm run gen\`, then \`npm test\` and \`npm run roundtrip\`): a report kit that is tested as one unit, with each family's \`dataBindings\` and config. Change a report there, in code. **Never Pull this extension into the Developer Instance** and never hand-edit a copy there: publish it from dev.

## Configuration

No configuration variables are required.
`);
// ---------------------------------------------------------------- marketplace entry
const mpPath = path.join(ROOT, '.claude-plugin', 'marketplace.json'), raw = fs.readFileSync(mpPath, 'utf8'), mp = JSON.parse(raw);
const entry = { category: 'Finance', content: { agents: ['content/agents/' + originKey + '.json'], automations: [], formTemplates: [], forms: [], workqTemplates: [] }, description, icon: 'chart-line',
  keywords: ['quickbooks', 'qbo', 'reports', 'finance', 'bas', 'gst', 'html'], name: SLUG, reports: 'reports', version: '0.0.0', displayName: 'QuickBooks Reporting Studio', source: './plugins/' + SLUG,
  branding: { logo: 'assets/logo.svg', color: '#2CA01C', tagline: 'Live QuickBooks reports that look like QuickBooks — and check their own maths.' },
  listing: { longDescription: 'The **QuickBooks Reporting Specialist** builds live QuickBooks Online reports on request: statements (Profit and Loss, Balance Sheet, Statement of Cash Flows, Trial Balance, General Ledger), A/R and A/P ageing, GST Summary (BAS labels) and GST overview, sales and supplier reports, Budget vs Actuals, dashboards (Business at a glance, Business Snapshot, Business feed, Cash flow, Sales and Expenses overviews, Performance centre, Client overview), management report packs and a searchable reports catalogue.\n\nEvery report refreshes on open, keeps QuickBooks\' layout and number formats (with a mySMB house-style toggle), validates its own arithmetic in a banner, and downloads to PDF or Excel.',
    highlights: [FAM.length + ' QuickBooks report families, live on every open', 'QuickBooks styling with a mySMB house-style toggle', 'Built-in validation banner on every report', 'Download PDF and Excel (.xlsx) from the report'], publisher: { name: 'mySMB AI Studio', url: 'https://mysmb.com' } },
  onboarding: { pitch: 'Ask for any core QuickBooks report and get a live, validated version in seconds.', firstStep: 'Ask the QuickBooks Reporting Specialist for last month\'s Profit and Loss.', relevantTo: ['finance', 'accounting', 'bookkeeping'] } };
if (entry.branding.tagline.length > 90) throw new Error('tagline too long ' + entry.branding.tagline.length);
// Once the extension is in AI Studio the Developer Instance owns this entry (it rewrites it on publish; store branding is set in the console). Only add it when missing.
const i = mp.plugins.findIndex((p) => p.name === SLUG); if (i < 0) mp.plugins.push(entry);
// Except the report templates' folder, which Publish copies from this entry to the next tier: declare it on the existing entry.
else if (mp.plugins[i].reports !== 'reports') mp.plugins[i].reports = 'reports';
fs.writeFileSync(mpPath, JSON.stringify(mp, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
console.log('generated', SLUG, '| originKey', originKey, '| contentHash', contentHash.slice(0, 12), '| role prompt', rolePrompt.length, 'chars | foundation', Buffer.byteLength(foundation), 'bytes');

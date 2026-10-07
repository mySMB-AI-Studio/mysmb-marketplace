// node gen-ext.js — writes the extension's skills, agent (markdown + installed blueprint with originKey and contentHash)
// from reports.js, libraries.json and each template's manifest, so every slug and input name in a skill is the real one.
// Run gen.js first (templates), then this. Never Pull this extension into the Developer Instance: it carries reports/.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { REPORTS, ITEMS, PLATFORM, PLUGIN } = require('./reports.js');
const LIB = require('./libraries.json');
const EXT = path.join(__dirname, '..', '..', 'plugins', PLUGIN);
const w = (rel, s) => { const f = path.join(EXT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
const man = (r) => { const f = path.join(__dirname, r.ref + '.manifest.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const S = (key) => PLUGIN + ':' + PLUGIN + '-' + key;
const CLIENT_INPUT = { xero: 'the organisation id (`tenantId` from `list_connections`)', myob: 'the company file id (`Id` from `list_company_files`)', quickbooks: 'none: QuickBooks is the one connected company' };
const DISCOVERY = { xero: '`list_connections` (xero-accounting)', myob: '`list_company_files` (myob-accounting)', quickbooks: '`qbo_query` with `SELECT * FROM CompanyInfo` (quickbooks-accounting)' };

function inputsTable(m) {
  if (!m) return '_Not built yet._\n';
  return '| Input | Label | Type | Default |\n|---|---|---|---|\n' + m.inputs.map((i) => '| `' + i.name + '` | ' + (i.label || '') + ' | ' + i.type + (i.options ? ' (' + i.options.join(' / ') + ')' : '') + ' | `' + (typeof i.default === 'string' && i.default.length > 60 ? i.default.slice(0, 57) + '…' : i.default) + '` |').join('\n') + '\n';
}
const COMMON = `## Rules for every client report

- **Confirm the inputs first (never assume):** the client (from the user's own connections: one client per report), the period or as-at date, cash or accrual where offered, and the persona (Owner, Bookkeeper, Executive or Client). Ask once for anything missing; offer the defaults (last complete quarter for tax reports, this financial year to date for the overview).
- **Find the client's platform and id** with one discovery call: Xero ${DISCOVERY.xero}, MYOB ${DISCOVERY.myob}, QuickBooks ${DISCOVERY.quickbooks}. If the user names a client that none of their connections expose, say so and list the ones they can use. Never put another client's id in a report.
- **Create the report with \`artifact_from_template\`**: \`plugin\` = \`${PLUGIN}\`, \`slug\` from the table below, \`title\` = "<Report name> — <client name> — <period>", and \`inputs\` = only the declared inputs the request changes (exact names from the table; dates as \`YYYY-MM-DD\`). You write no HTML and no figures: the report fetches live data every time it opens and recomputes its checks.
- **If \`artifact_from_template\` is not available or returns template_not_found**, say the Client Report Analytics extension is not installed or not up to date in this workspace; do not hand-write a report instead.
- **Reply** with the report button the tool returns, one line on what it shows, and: "The banner at the top shows the validation checks; a red line means a figure did not tie and should not be relied on." Never quote figures you did not read from a tool result. Unsourced items are "N/A — not in source".
- **Errors:** \`needs_connection\` → "Connect <platform> (Settings → Connections)". A tool error → show it word for word; do not retry more than once.
`;

function reportSkill(id) {
  const it = ITEMS[id], rows = REPORTS.filter((r) => r.item === id);
  const key = id;
  const body = `---
name: ${PLUGIN}-${key}
description: ${it.cra} ${it.name} for one client (Xero, MYOB or QuickBooks) as a live, validated report. Use when the user asks for the ${it.name.toLowerCase()} of a client${id === 'financial-overview' ? ', a client dashboard, revenue / profit / bank / ageing overview' : id === 'tax-by-type' ? ', GST by tax type by month, a BAS preparation review' : ', BAS transaction detail, the transactions behind the GST figures'}.
---

# ${it.cra} ${it.name}

Use when the user asks for the ${it.name} (${it.cra}) of one client: ${it.blurb}

${COMMON}
## Templates

| Platform | Template slug | Client input |
|---|---|---|
${rows.map((r) => '| ' + PLATFORM[r.platform] + ' | `' + r.slug + '` | ' + CLIENT_INPUT[r.platform] + ' |').join('\n')}

${rows.map((r) => '### ' + r.title + ' (`' + r.slug + '`)\n\n' + inputsTable(man(r))).join('\n')}
## Steps

1. Confirm the inputs (rules above). Keep the template defaults for anything the user did not ask to change.
2. Make the discovery call for the client's platform and pick the client's id.
3. Call \`artifact_from_template\` with \`plugin: "${PLUGIN}"\`, the platform's slug, and \`inputs\` holding the client input${id === 'financial-overview' ? ', the period dates and the basis' : ', the period dates and the basis'} the user chose, using the input names in that platform's table.
4. Reply as the rules say. If the user wants a different period or basis later, tell them to change it in the report's controls (it refetches) rather than creating another copy.

## Validation (shown in the report, recomputed on every open)

${id === 'financial-overview' ? '- Revenue, gross profit and net profit equal the platform\'s own Profit and Loss for the same client, period and basis; last year comes from a P&L for exactly the comparison dates.\n- Bank balances total the balance sheet\'s bank accounts at the period end.\n- Receivables and payables ageing totals tie to the balance sheet\'s receivables and payables (accrual).' : id === 'tax-by-type' ? '- Each tax type\'s period total equals the platform\'s GST / tax summary for the same period and basis.\n- The months add up to the period total.\n- Net GST ties to the movement in the GST control account; any difference is shown and explained.' : '- GST per tax type equals the same tax type in the platform\'s GST / tax summary for the period.\n- The grand total GST equals the period\'s net GST; every line\'s net + GST = gross.\n- Every page of transactions is loaded, or the truncation is a failed check (never a silent short total).'}
- Switching client refetches every source for the new client; nothing of the previous client stays on the page or in the Excel download.

## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company, a MYOB sandbox company file and a QuickBooks sandbox company connected: ask for the ${it.name} of each, for the last complete quarter, accrual. Each report opens with a green banner; compare the headline figures with the same platform's library report (${id === 'financial-overview' ? 'Profit and Loss and Balance Sheet' : 'GST Summary (BAS) / GST Reconciliation'}) for the same dates; switch client in the report and check nothing of the first client remains; download Excel and PDF.
`;
  return { key, body };
}

function catalogueSkill() {
  const key = 'catalogue';
  return { key, body: `---
name: ${PLUGIN}-${key}
description: CRA-00 Client catalogue — every client report as a box for the selected client (Financial, Tax & BAS, Sales & purchases, Quality, Activity, Time, Platform reports), with what is live and how to open it. Use when the user asks what client reports exist, for the client catalogue, or "what can you report on for <client>".
---

# CRA-00 Client catalogue

Use when the user asks which reports exist for a client, for the client report catalogue or menu, or is unsure which report they need.

1. If the user named a client, find it with the discovery call for its platform (Xero \`list_connections\`, MYOB \`list_company_files\`, QuickBooks \`qbo_query\` \`SELECT * FROM CompanyInfo\`) and build the client value \`<platform>:<id>\` (\`xero:<tenantId>\`, \`myob:<company file Id>\`, \`quickbooks:<CompanyInfo Id>\`).
2. Call \`artifact_from_template\` with \`plugin: "${PLUGIN}"\`, \`slug: "client-report-catalogue"\`, \`title: "Client Report Catalogue — <client name>"\` and, when you have it, \`inputs: { "client": "<platform>:<id>" }\`. The catalogue lists the user's clients from their own connections; they can switch client in it.
3. Reply with the report button and a short summary: live now are ${ITEMS['financial-overview'].cra} ${ITEMS['financial-overview'].name}, ${ITEMS['tax-by-type'].cra} ${ITEMS['tax-by-type'].name} and ${ITEMS['bas-transactions'].cra} ${ITEMS['bas-transactions'].name} for Xero, MYOB and QuickBooks, plus the platform's own report library (CRA-16). Data Quality, Client Queries, Health Check and GST Check need the checks engine; tracking-category, contact, activity and ledger-activity reports come in Wave 2; time reports need a time source (Xero Practice Manager practices, Wave 3).
4. To open a box, the user presses **Use this report** on that template in Reports → From your plugins, or asks you ("Financial overview for <client>"); then load the matching skill.

The catalogue does not look up the latest saved copy of each report and shows no sparklines yet; Workspace has no "Display in client portal" setting for reports, so the catalogue's portal check is "for information". Say so if asked.
` };
}

function platformSkill() {
  const key = 'platform-reports';
  const lists = Object.entries(LIB).map(([p, l]) => '### ' + PLATFORM[p] + ' — extension `' + l.plugin + '`' + (l.client ? ' (client input `' + l.client + '`)' : ' (no client input: one company per connection)') + '\n\n' + l.reports.map((r) => '- ' + (r.code ? r.code + ' ' : '') + r.title + ': `' + r.slug + '`').join('\n')).join('\n\n');
  return { key, body: `---
name: ${PLUGIN}-${key}
description: CRA-16 Platform-native reports — opens any report of the Xero (P01–P15), MYOB (M00–M63) or QuickBooks (Q00–Q39) report library for the selected client from the reporting-studio extensions. Use when the user asks for a standard platform report for a client (Profit and Loss, Balance Sheet, aged receivables, GST/BAS summary, trial balance, general ledger …) that is not one of the Client Report Analytics reports.
---

# CRA-16 Platform-native reports (pass-through)

Use when the user wants one of the platform's own library reports for a client. These templates belong to the Xero, MYOB and QuickBooks Reporting Studio extensions; this skill only routes to them. Do not rebuild them.

1. Confirm the client and the report. Find the client's platform and id with the discovery call (Xero \`list_connections\`, MYOB \`list_company_files\`, QuickBooks \`qbo_query\` \`SELECT * FROM CompanyInfo\`).
2. Pick the template from that platform's list below (match the title or code; ask if two fit).
3. Call \`artifact_from_template\` with \`plugin\` = that platform's extension, \`slug\` = the template slug, \`title\` = "<Report> — <client name>", and \`inputs\` = only the client input (Xero \`{ "org": "<tenantId>" }\`, MYOB \`{ "company_file": "<Id>" }\`, QuickBooks: none). Leave the period to the template's defaults and tell the user to change the period in the report's controls; if they gave a period and the tool error lists the template's declared inputs, you may retry once with the matching date inputs.
4. If the tool returns template_not_found, the platform's Reporting Studio extension is not installed in this workspace: say "Ask your admin to install <Platform> Reporting Studio" and stop. Never hand-write the report.
5. Reply with the report button. The report validates itself; point the user to its checks banner.

${lists}
` };
}

const skills = [catalogueSkill(), ...Object.keys(ITEMS).map(reportSkill), platformSkill()];
fs.rmSync(path.join(EXT, 'skills'), { recursive: true, force: true });
for (const s of skills) {
  const bytes = Buffer.byteLength(s.body);
  if (bytes > 128 * 1024) throw new Error(s.key + ' skill is over 128 KiB');
  if (s.body.split('\n').some((l) => l.length > 1500)) throw new Error(s.key + ' skill has a line over 1,500 characters');
  w('skills/' + PLUGIN + '-' + s.key + '.md', s.body); console.log('skill', s.key, bytes, 'bytes');
}

// ── the agent ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const AGENT = {
  name: 'Client Report Analytics Agent',
  description: 'Builds live, validated client reports (Financial Overview, tax by type, BAS transactions) and opens the platform report libraries for one client from Xero, MYOB or QuickBooks (Client Report Analytics, Wave 1).',
  connectors: ['xero-accounting', 'myob-accounting', 'quickbooks-accounting'],
  skills: skills.map((s) => S(s.key)),
  model: 'sonnet',
  prompt: `You are the Client Report Analytics Agent in mySMB Workspace › Reporting. You produce reports for ONE client at a time, from the user's own Xero, MYOB and QuickBooks connections; only the data changes between clients.

For every request:
1. Pick the skill: the client catalogue or "what reports are there" → ${S('catalogue')}; Financial Overview (CRA-01) → ${S('financial-overview')}; Summary of Tax Amounts by Type (CRA-05) → ${S('tax-by-type')}; BAS Related Transactions and GST (CRA-07) → ${S('bas-transactions')}; any standard Xero, MYOB or QuickBooks report (Profit and Loss, Balance Sheet, ageing, GST/BAS summary, trial balance …) → ${S('platform-reports')}. Load it with load_skill before calling any tool.
2. Confirm the inputs, never assume: the client (from the user's connections), the period or as-at date, cash or accrual, and who the report is for (Owner, Bookkeeper, Executive or Client). Ask once for anything missing and offer the defaults.
3. Create the report with artifact_from_template from the template the skill names, setting only the inputs the request changes. You never write report HTML and never type figures: the report fetches live data on every open, validates itself and shows a checks banner.

Rules:
- Connections are Xero, MYOB and QuickBooks only. Never use another client's id; one report carries one client. QuickBooks is one company per connection, so another QuickBooks client needs its own connection.
- Never invent or estimate a figure. Anything the source doesn't hold is "N/A — not in source".
- Reports that are not built yet (Data Quality, Client Queries, Health Check and GST Check need the checks engine; tracking-category, contact, activity and ledger-activity reports are Wave 2; time reports need a time source): say so plainly and offer the nearest live report or a platform library report.
- A needs_connection error means "Connect <platform> (Settings → Connections)". Show tool errors word for word.
- Reports use the mySMB.com brand by default; the platform's styling is available under Customise in each report.`
};
const keyOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = keyOf(AGENT.name);
const h = crypto.createHash('sha256').update('agent:' + PLUGIN + ':' + key).digest('hex');
const originKey = h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
if (AGENT.prompt.length > 20000 || AGENT.description.length > 500 || AGENT.skills.length > 50) throw new Error('agent over the builder limits');
w('agents/' + key + '.md', `---\nname: ${AGENT.name}\ndescription: ${AGENT.description}\nconnectors: ${AGENT.connectors.join(', ')}\nskills: ${AGENT.skills.join(', ')}\nmodel: ${AGENT.model}\n---\n${AGENT.prompt}\n`);
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
const payload = { audienceMode: 'everyone', connectors: AGENT.connectors, description: AGENT.description, key, kind: 'agent', model: AGENT.model, name: AGENT.name, originKey, platform: false, rolePrompt: AGENT.prompt, skills: AGENT.skills };
const contentHash = crypto.createHash('sha256').update(JSON.stringify(sortKeys(payload))).digest('hex');
fs.rmSync(path.join(EXT, 'content', 'agents'), { recursive: true, force: true });
w('content/agents/' + originKey + '.json', JSON.stringify(sortKeys({ ...payload, contentHash }), null, 2) + '\n');
console.log('agent', key, originKey, contentHash.slice(0, 12));
const pj = path.join(EXT, '.claude-plugin', 'plugin.json'), pjv = JSON.parse(fs.readFileSync(pj, 'utf8'));
pjv.content.agents = ['content/agents/' + originKey + '.json'];
fs.writeFileSync(pj, JSON.stringify(pjv, null, 2) + '\n');
// the marketplace entry carries the same content block (the installer falls back to it; the store reads it)
const mf = path.join(__dirname, '..', '..', '.claude-plugin', 'marketplace.json'), raw = fs.readFileSync(mf, 'utf8'), mj = JSON.parse(raw);
const entry = mj.plugins.find((p) => p.name === PLUGIN);
if (entry && JSON.stringify(entry.content) !== JSON.stringify(pjv.content)) {
  entry.content = pjv.content; const out = JSON.stringify(mj, null, 2) + '\n';
  fs.writeFileSync(mf, raw.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out); console.log('marketplace entry content updated');
}
module.exports = { originKey };

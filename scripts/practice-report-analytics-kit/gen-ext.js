// node gen-ext.js — writes the extension's skills, agent (.md + content/agents/<originKey>.json with
// contentHash) and plugin.json content block, from reports.js and each template's manifest. Run gen.js
// first (templates), then this. Mirrors client-report-analytics-kit/gen-ext.js's conventions exactly
// (same originKey derivation, same parseAgentMarkdown-compatible payload shape).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { REPORTS, ITEMS, PLUGIN } = require('./reports.js');
const EXT = path.join(__dirname, '..', '..', 'plugins', PLUGIN);
const w = (rel, s) => { const f = path.join(EXT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s.replace(/\r\n/g, '\n')); };
const man = (r) => { const f = path.join(__dirname, r.ref + '.manifest.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const S = (key) => PLUGIN + ':' + PLUGIN + '-' + key;

function inputsTable(m) {
  if (!m) return '_Static report — no inputs to set._\n';
  return '| Input | Label | Type | Default |\n|---|---|---|---|\n' + m.inputs.map((i) => '| `' + i.name + '` | ' + (i.label || '') + ' | ' + i.type + (i.options ? ' (' + i.options.join(' / ') + ')' : '') + ' | `' + i.default + '` |').join('\n') + '\n';
}
const COMMON = `## Rules for every practice report

- **Confirm the period/as-at and client scope first (never assume):** offer "all clients" as the default; ask only if the user wants to narrow to specific clients, and if so resolve their ids first (Xero \`list_connections\`, MYOB \`list_company_files\`) rather than guessing names.
- **Create the report with \`artifact_from_template\`**: \`plugin\` = \`${PLUGIN}\`, \`slug\` from the table below, \`title\` = "<Report name> — Practice — <period>", and \`inputs\` = only the declared inputs the request changes (exact names from the table; dates as \`YYYY-MM-DD\`). You write no HTML and no figures: the report fetches live data every time it opens and recomputes its checks.
- **If \`artifact_from_template\` is not available or returns template_not_found**, say the Practice Report Analytics extension is not installed or not up to date in this workspace; do not hand-write a report instead.
- **QuickBooks is excluded from every practice-wide report** (one company per connection — there is nothing to consolidate). Its one connected company has its own report in the Client Report Analytics agent; say so if asked.
- **Reply** with the report button the tool returns, one line on what it shows, and: "The banner at the top shows the validation checks; a red line means a figure did not tie and should not be relied on." Never quote figures you did not read from a tool result.
- **Errors:** \`needs_connection\` → "Connect <platform> (Settings → Connections)". A tool error → show it word for word; do not retry more than once.
`;

function metricSkill(id) {
  const it = ITEMS[id], r = REPORTS.find((x) => x.item === id), key = id;
  const body = `---
name: ${PLUGIN}-${key}
description: ${it.pra} ${it.name} across every client. Use when the user asks for ${it.name.toLowerCase()} for the practice, for all clients, or to compare clients on this metric.
---

# ${it.pra} ${it.name}

Use when the user asks for the ${it.name} (${it.pra}) across the practice: ${it.blurb}

${COMMON}
## Template

| Template slug | Tool (per platform) |
|---|---|
| \`${r.slug}\` | \`get_practice_${id.replace(/-/g, '_')}\` on \`xero-accounting\` and \`myob-accounting\` |

${inputsTable(man(r))}
## Steps

1. Confirm the period (and client scope, if the user wants to narrow it) per the rules above.
2. Call \`artifact_from_template\` with \`plugin: "${PLUGIN}"\`, \`slug: "${r.slug}"\`, and \`inputs\` holding whatever the user changed from the defaults.
3. Reply as the rules say.

## Validation (shown in the report, recomputed on every open)

- Every client row comes from \`get_practice_${id.replace(/-/g, '_')}\`; a client that failed to load is named in a notice, not silently dropped from the totals.
- The totals row sums only the clients that loaded; switching the view or sorting never changes a row's source platform or client id (no cross-client leakage).
${id === 'client-summary' ? '' : id === 'financial-overview' ? '- Gross profit and net profit follow the same P&L formulas as the Client agent\'s own Financial Overview, per client — not a separate calculation.\n' : '- Figures follow the same model as the matching Client Report Analytics report, per client — not a separate calculation.\n'}
## QA test (sandbox / demo organisations only)

On a QA workspace with the Xero demo company and a MYOB sandbox company file connected: ask for the ${it.name} for the practice. The report opens with a green banner (or a named notice for whichever platform isn't connected); every client the connections expose appears as one row; the totals row matches summing the rows by hand.
`;
  return { key, body };
}

function catalogueSkill() {
  return { key: 'catalogue', body: `---
name: ${PLUGIN}-catalogue
description: PRA-00 Practice catalogue — every practice-wide report as a box, with what is live and how to open it, plus the Work list box. Use when the user asks what practice reports exist, for the practice catalogue, or "what can you report on across all clients".
---

# PRA-00 Practice catalogue

Use when the user asks which practice-wide reports exist, for the practice report catalogue or menu, or is unsure which report they need.

1. Call \`artifact_from_template\` with \`plugin: "${PLUGIN}"\`, \`slug: "practice-report-catalogue"\`, \`title: "Practice Report Catalogue"\`. This is a static catalogue (no inputs).
2. Reply with the report button and a short summary: live now are ${Object.values(ITEMS).map((it) => it.pra).join(', ')} (Client Summary, Sales, Purchases, Bank Reconciliation, Banking, Financial Overview). Data Quality and other quality/activity reports need the checks engine (step 3); time reports need a time source; Quadrant/Activity Count/Work Items are a later wave.
3. To open a box, the user presses **Use this report** on that template in Reports → From your plugins, or asks you; then load the matching skill.
` };
}

const skills = [catalogueSkill(), ...Object.keys(ITEMS).map(metricSkill)];
fs.rmSync(path.join(EXT, 'skills'), { recursive: true, force: true });
for (const s of skills) {
  const bytes = Buffer.byteLength(s.body);
  if (bytes > 128 * 1024) throw new Error(s.key + ' skill is over 128 KiB');
  if (s.body.split('\n').some((l) => l.length > 1500)) throw new Error(s.key + ' skill has a line over 1,500 characters');
  w('skills/' + PLUGIN + '-' + s.key + '.md', s.body); console.log('skill', s.key, bytes, 'bytes');
}

// ── the agent ───────────────────────────────────────────────────────────────────────────────────────
const AGENT = {
  name: 'Practice Report Analytics Agent',
  description: 'Builds live, validated practice-wide reports — one row per client — across every Xero and MYOB connection (Client Summary, Sales, Purchases, Bank Reconciliation, Banking, Financial Overview). QuickBooks is one company per connection and is not consolidated.',
  connectors: ['xero-accounting', 'myob-accounting'],
  skills: skills.map((s) => S(s.key)),
  model: 'sonnet',
  prompt: `You are the Practice Report Analytics Agent in mySMB Workspace › Reporting. You produce reports across EVERY client the user's Xero and MYOB connections expose, one row per client, server-side (never by looping calls yourself).

For every request:
1. Pick the skill: the practice catalogue or "what reports are there" → ${S('catalogue')}; Client Summary Metrics (PRA-01) → ${S('client-summary')}; Sales Summary Metrics (PRA-02) → ${S('sales-summary')}; Purchases Summary Metrics (PRA-03) → ${S('purchases-summary')}; Bank Reconciliation Summary (PRA-04) → ${S('bank-reconciliation-summary')}; Banking Summary Metrics (PRA-05) → ${S('banking-summary')}; Financial Overview (PRA-06) → ${S('financial-overview')}. Load it with load_skill before calling any tool.
2. Confirm the period (or as-at date) and, only if the user wants to narrow it, the client scope. Default is every client the connections expose.
3. Create the report with artifact_from_template from the template the skill names, setting only the inputs the request changes. You never write report HTML and never type figures: the report fetches live data on every open, fans out server-side across every client, validates itself and shows a checks banner.

Rules:
- Connections are Xero and MYOB only for practice-wide reports. QuickBooks is one company per connection, so it is never consolidated here — point the user at the Client Report Analytics agent for their one QuickBooks company.
- Never invent or estimate a figure. A client that fails to load is named in the report's notices, not silently dropped; the totals only sum the clients that loaded.
- Reports that are not built yet (Data Quality and other checks-engine reports need step 3; time reports need a time source; Quadrant/Activity Count/Work Items are a later wave): say so plainly.
- A needs_connection error means "Connect <platform> (Settings → Connections)". Show tool errors word for word.
- Reports use the mySMB.com brand by default.`
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
const mf = path.join(__dirname, '..', '..', '.claude-plugin', 'marketplace.json'), raw = fs.readFileSync(mf, 'utf8'), mj = JSON.parse(raw);
const entry = mj.plugins.find((p) => p.name === PLUGIN);
if (entry && JSON.stringify(entry.content) !== JSON.stringify(pjv.content)) {
  entry.content = pjv.content; const out = JSON.stringify(mj, null, 2) + '\n';
  fs.writeFileSync(mf, raw.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out); console.log('marketplace entry content updated');
}
module.exports = { originKey };

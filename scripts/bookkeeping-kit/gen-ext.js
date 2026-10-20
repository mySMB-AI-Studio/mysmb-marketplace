#!/usr/bin/env node
// Generate plugins/bookkeeping-<ledger>/ in a mysmb-marketplace checkout from the kit source.
// Usage: node gen-ext.js <path-to-mysmb-marketplace> [ledger=xero|myob|quickbooks] [--without-payroll]
//   xero builds Bookkeeping for Xero; myob and quickbooks build the checks-only packs (Bookkeeping checks for MYOB /
//   QuickBooks: the ledger checks with their own light setup, decision D18).
//   --without-payroll builds the same extension without its payroll automations, forms and texts, for a tier that
//   mustn't have payroll yet (e.g. UAT/production before payroll's privacy sign-off). Payroll stays in the default build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FORMS as XERO_FORMS, PAYROLL_FORMS, WITHOUT_PAYROLL_TEXT, AUTOMATIONS as XERO_AUTOMATIONS, LEDGERS, CHECKS_FORMS, checksAutomations } from './src/flows.js';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(KIT, 'src');
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const WITH_PAYROLL = !process.argv.includes('--without-payroll');
const ROOT = ARGS[0];
const LEDGER = ARGS[1] || 'xero';
if (!ROOT || !fs.existsSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'))) {
  console.error('usage: node gen-ext.js <mysmb-marketplace checkout> [ledger]');
  process.exit(1);
}
if (LEDGER !== 'xero' && !LEDGERS[LEDGER]) throw new Error(`no ${LEDGER} pack: xero, ${Object.keys(LEDGERS).join(', ')}`);
const XERO = LEDGER === 'xero';
const FORMS = XERO ? XERO_FORMS : CHECKS_FORMS;
const ALL_AUTOMATIONS = XERO ? XERO_AUTOMATIONS : checksAutomations(LEDGER);
const SLUG = `bookkeeping-${LEDGER}`;
const PLUGIN = path.join(ROOT, 'plugins', SLUG);
const MCP_HOST = 'https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io';

// ── identity ────────────────────────────────────────────────────────────────
// Deterministic v4-shaped UUIDs (same formula as the agent-component skill), so a component
// keeps its originKey forever and neutral components share it across ledger packs.
export function uuidFor(text) {
  const h = crypto.createHash('sha256').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.keys(v).sort().reduce((o, k) => (v[k] !== undefined && (o[k] = canon(v[k])), o), {}) : v);
export function withHash(payload) {
  const { contentHash, ...rest } = payload;
  const hash = crypto.createHash('sha256').update(JSON.stringify(canon(rest))).digest('hex');
  return canon({ ...rest, contentHash: hash });
}
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

// ── payroll variant ─────────────────────────────────────────────────────────
// `payrollOnly` marks (flows.js) and `# >>> payroll` / `<!-- >>> payroll -->` blocks (code, README, skill) are dropped
// in the build without payroll; `no-payroll` blocks only in the default one. Marker lines and marks never reach the
// output, so the default build is byte-identical to one made before the marks existed.
const MARKER = /^\s*(?:#|<!--)\s*(>>>|<<<)\s*(no-payroll|payroll)\s*(?:-->)?\s*$/;
function variant(text) {
  const out = [];
  let skip = false;
  for (const line of text.split('\n')) {
    const m = MARKER.exec(line);
    if (m) {
      skip = m[1] === '>>>' && (m[2] === 'payroll' ? !WITH_PAYROLL : WITH_PAYROLL);
      continue;
    }
    if (!skip) out.push(line);
  }
  return out.join('\n');
}
function unmark(value) {
  if (Array.isArray(value)) return value.filter((v) => WITH_PAYROLL || !(v && v.payrollOnly)).map(unmark);
  if (value && typeof value === 'object') {
    const { payrollOnly, ...rest } = value;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, unmark(v)]));
  }
  if (typeof value === 'string' && !WITH_PAYROLL) return WITHOUT_PAYROLL_TEXT.reduce((s, [a, b]) => s.split(a).join(b), value);
  return value;
}
const FORMS_BUILT = FORMS.filter((key) => WITH_PAYROLL || !PAYROLL_FORMS.includes(key));
const AUTOMATIONS = ALL_AUTOMATIONS.filter((a) => WITH_PAYROLL || !a.payrollOnly).map((a) => {
  const def = unmark(a);
  if (WITH_PAYROLL) return def;
  return {
    ...def,
    forms: def.forms.filter((f) => !PAYROLL_FORMS.includes(f)),
    nodes: def.nodes.map((n) => (n.libs ? { ...n, libs: n.libs.filter((l) => l !== 'payroll') } : n)),
  };
});

// The checks packs' components have their own originKeys: two extensions shipping one originKey share a single copy
// in the workspace, which each one's install would then overwrite (and uninstalling the first would pause).
const NS = XERO ? 'bookkeeping' : `bookkeeping:${LEDGER}`;
const formIds = Object.fromEntries(FORMS.map((key) => [key, {
  originKey: uuidFor(`${NS}:form:${key}`),
  sourceId: uuidFor(`${NS}:source:form:${key}`),
}]));

// ── clean output (only the files this generator owns) ───────────────────────
fs.rmSync(path.join(PLUGIN, 'content'), { recursive: true, force: true });
fs.rmSync(path.join(PLUGIN, 'agents'), { recursive: true, force: true });
fs.rmSync(path.join(PLUGIN, 'skills'), { recursive: true, force: true });

// ── forms ───────────────────────────────────────────────────────────────────
const formFiles = FORMS_BUILT.map((key) => {
  const own = path.join(SRC, 'forms', `${key}.${LEDGER}.json`); // a pack's own wording of a form, when it has one
  const src = JSON.parse(fs.readFileSync(fs.existsSync(own) ? own : path.join(SRC, 'forms', `${key}.json`), 'utf8'));
  const payload = withHash({ kind: 'form', originKey: formIds[key].originKey, title: src.title, schema: src.schema });
  const rel = `content/forms/${payload.originKey}.json`;
  writeJson(path.join(PLUGIN, rel), payload);
  return rel;
});

// ── automations ─────────────────────────────────────────────────────────────
// Split a helper library into its always-included header (imports, constants) and its top-level functions.
function parseLib(name) {
  const lines = fs.readFileSync(path.join(SRC, 'lib', `${name}.py`), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const header = [];
  const defs = new Map();
  let current = null;
  for (const line of lines) {
    const m = /^def ([a-zA-Z_][a-zA-Z0-9_]*)\(/.exec(line);
    if (m) { current = { name: m[1], lines: [line] }; defs.set(m[1], current); continue; }
    if (current && (line === '' || /^\s/.test(line))) { current.lines.push(line); continue; }
    current = null;
    header.push(line);
  }
  return { name, header: header.join('\n').trim(), defs };
}
const LIBS = Object.fromEntries(['util', 'xero', 'myob', 'qbo', 'mail', 'payroll', 'checks', 'abr', 'route'].map((n) => [n, parseLib(n)]));
// Only the helpers the node (transitively) calls, so each automation carries — and is scope-checked on — what it uses.
function prelude(libNames, body) {
  const available = new Map();
  for (const n of libNames) for (const [k, v] of LIBS[n].defs) available.set(k, v);
  const used = new Set();
  const visit = (text) => {
    for (const [k, v] of available) {
      if (!used.has(k) && new RegExp(`\\b${k}\\(`).test(text)) { used.add(k); visit(v.lines.join('\n')); }
    }
  };
  visit(body);
  return libNames.map((n) => [LIBS[n].header, ...[...LIBS[n].defs.values()].filter((d) => used.has(d.name)).map((d) => d.lines.join('\n').trimEnd())]
    .filter(Boolean).join('\n\n\n'));
}
const substituteForms = (json) => json.replace(/@form:([a-z-]+)/g, (_, key) => {
  if (!formIds[key]) throw new Error(`unknown form ${key}`);
  return formIds[key].sourceId;
});
const automationFiles = AUTOMATIONS.map((a) => {
  const nodes = a.nodes.map((n) => {
    if (n.kind !== 'python') return n;
    const body = variant(fs.readFileSync(path.join(SRC, 'automations', a.codeKey || a.key, `${n.id}.py`), 'utf8').replace(/\r\n/g, '\n')).trim();
    const code = [...prelude(n.libs, body), '# ── ' + n.title + ' ──', body].join('\n\n\n') + '\n';
    const { libs, ...rest } = n;
    return { ...rest, code };
  });
  const flowIr = JSON.parse(substituteForms(JSON.stringify({
    irVersion: 1, name: a.name, description: a.description, params: a.params, triggers: a.triggers, nodes, rootOrder: a.rootOrder,
  })));
  const originKey = uuidFor(a.neutral && XERO ? `bookkeeping:automation:${a.key}` : `bookkeeping:${LEDGER}:automation:${a.key}`);
  const payload = withHash({
    kind: 'automation', originKey, name: a.name, description: a.description, level: 'org', flowIr,
    declaredScopes: [...a.scopes].sort(), tags: ['bookkeeping'],
    dependencies: a.forms.map((key) => ({ entityKind: 'form', originKey: formIds[key].originKey, sourceId: formIds[key].sourceId })),
    attachments: [], knowledgeFiles: [],
  });
  const rel = `content/automations/${originKey}.json`;
  writeJson(path.join(PLUGIN, rel), payload);
  return rel;
});

// ── agent (Bookkeeping for Xero only: the checks packs have none) ────────────
let agentRel = null, agentKey = '';
if (XERO) {
  const agentMd = fs.readFileSync(path.join(SRC, 'agents', `bookkeeping-coordinator-${LEDGER}.md`), 'utf8').replace(/\r\n/g, '\n');
  const fm = Object.fromEntries(agentMd.split('---')[1].trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  agentKey = fm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const agentOrigin = uuidFor(`agent:${SLUG}:${agentKey}`);
  const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const agent = withHash({
    kind: 'agent', originKey: agentOrigin, key: agentKey, name: fm.name, description: fm.description,
    rolePrompt: agentMd.split('---').slice(2).join('---').trim(), connectors: list(fm.connectors), skills: list(fm.skills),
    model: fm.model || 'haiku', platform: false, audienceMode: 'everyone',
  });
  fs.mkdirSync(path.join(PLUGIN, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(PLUGIN, 'agents', `${agentKey}.md`), agentMd);
  agentRel = `content/agents/${agentOrigin}.json`;
  writeJson(path.join(PLUGIN, agentRel), agent);
}

// ── skills, README, connector, manifest ─────────────────────────────────────
if (XERO) {
  fs.mkdirSync(path.join(PLUGIN, 'skills'), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, 'skills'))) fs.writeFileSync(path.join(PLUGIN, 'skills', f), variant(fs.readFileSync(path.join(SRC, 'skills', f), 'utf8')));
}
fs.writeFileSync(path.join(PLUGIN, 'README.md'), variant(fs.readFileSync(path.join(SRC, XERO ? 'README.md' : `README.${LEDGER}.md`), 'utf8')));
fs.mkdirSync(path.join(PLUGIN, 'assets'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'assets', XERO ? 'logo.svg' : `logo-${LEDGER}.svg`), path.join(PLUGIN, 'assets', 'logo.svg'));
// m365-mail-shared (a shared Outlook mailbox, for Email intake (Outlook shared mailbox)) isn't in the Microsoft 365
// extension, so this extension brings it.
writeJson(path.join(PLUGIN, '.mcp.json'), { mcpServers: XERO ? {
  'xero-accounting': { type: 'http', url: `${MCP_HOST}/xero-accounting/mcp` },
  'm365-mail-shared': { type: 'http', url: `${MCP_HOST}/m365-mail-shared/mcp` },
} : { [LEDGERS[LEDGER].server]: { type: 'http', url: `${MCP_HOST}/${LEDGERS[LEDGER].server}/mcp` } } });

const STORE = {
  xero: {
    displayName: 'Bookkeeping for Xero', color: '#13B5EA',
    description: 'Supplier bills from PDF to approved in each client’s own Xero organisation: read, checked and coded by AI, reviewed in WorkQ, with a weekly AP digest. Built for bookkeeping practices.',
    keywords: ['bookkeeping', 'xero', 'bills', 'accounts payable', 'ap', 'automation', 'practice'],
    tagline: 'Supplier bills from PDF to approved in each client’s own Xero.',
    longDescription:
      'Drop a supplier bill PDF into a client’s inbox folder. **Bookkeeping for Xero** reads it, checks the totals, GST, ABN and duplicates, and codes each line from a saved rule, the supplier’s history or an AI suggestion. It then creates a draft bill with the PDF attached in **that client’s own Xero organisation** and sends it to the reviewer in WorkQ.\n\n'
      + 'The reviewer approves, changes, rejects or asks the client, in one short form. Decisions are applied in Xero, and coding corrections are remembered for next time. Bills over the client’s approval limit get a follow-up item with a draft email. A weekly digest shows what’s waiting and overdue for every client.',
    highlights: ['Draft bills in each client’s own Xero, with the PDF attached', 'Coding from saved rules, supplier history or AI, with reasons', 'Review, approve or ask the client in one WorkQ form', 'Weekly accounts payable digest across all clients'],
    pitch: 'Turn supplier bill PDFs into reviewed, coded bills in each client’s Xero.',
    firstStep: 'Run the Bookkeeping: Start setup automation.',
  },
  myob: {
    displayName: 'Bookkeeping checks for MYOB', color: '#6100A5',
    description: 'Overnight ledger checks on each client’s MYOB company file against the mySMB checks catalogue: duplicates, supplier risk, GST, reconciliation and housekeeping, followed up in one WorkQ item per client, with a weekly data quality report. Reads only. Built for bookkeeping practices.',
    keywords: ['bookkeeping', 'myob', 'ledger checks', 'data quality', 'gst', 'automation', 'practice'],
    tagline: 'Overnight ledger checks on each client’s MYOB file, followed up in WorkQ.',
    longDescription:
      'Every night, **Bookkeeping checks for MYOB** reads each client’s **own MYOB company file** and runs the mySMB checks catalogue on it, wherever the entries came from: duplicate bills and invoices, spend money that matches a bill and new suppliers paid fast (daily), and GST, unreconciled and unsent items, suspense balances, month-end journals and GST registration (weekly). With the ABR Lookup extension it also checks suppliers and customers against the Australian Business Register.\n\n'
      + 'Each client has one Checks item in WorkQ, rewritten each run with what’s open: tick a line to dismiss it, or snooze findings with the Check findings form. A weekly data quality report covers every client. Checks MYOB’s API can’t answer (attachments, supplier bank details, the lock period) are listed as not checked, never shown as clear. It only reads: nothing is changed in MYOB.',
    highlights: ['Overnight checks on each client’s own MYOB company file', 'Duplicates, supplier risk, GST and housekeeping from the mySMB checks catalogue', 'One Checks item per client in WorkQ, with dismiss and snooze', 'Weekly data quality report across all clients'],
    pitch: 'Catch duplicates, GST problems and supplier risk in every client’s MYOB file overnight.',
    firstStep: 'Run the Bookkeeping: Start checks setup (MYOB) automation.',
  },
  quickbooks: {
    displayName: 'Bookkeeping checks for QuickBooks', color: '#2CA01C',
    description: 'Overnight ledger checks on the connected QuickBooks Online company against the mySMB checks catalogue: duplicates, supplier risk, GST, attachments and housekeeping, followed up in a WorkQ item, with a weekly data quality report. Reads only. Built for bookkeeping practices.',
    keywords: ['bookkeeping', 'quickbooks', 'qbo', 'ledger checks', 'data quality', 'gst', 'automation', 'practice'],
    tagline: 'Overnight ledger checks on a client’s QuickBooks company, followed up in WorkQ.',
    longDescription:
      'Every night, **Bookkeeping checks for QuickBooks** reads the client’s **QuickBooks Online company** and runs the mySMB checks catalogue on it, wherever the entries came from: duplicate bills and invoices, expenses that match a bill and new suppliers paid fast (daily), and GST, attachments over $82.50, unsent invoices, suspense balances, the closing date, month-end journals and GST registration (weekly).\n\n'
      + 'The client has a Checks item in WorkQ, rewritten each run with what’s open: tick a line to dismiss it, or snooze findings with the Check findings form. A weekly data quality report sums it up. A QuickBooks connection reaches one company, so the checks run on the company QuickBooks is connected to. Checks QuickBooks’ API can’t answer (ABNs, supplier bank details, reconciliation) are listed as not checked, never shown as clear. It only reads: nothing is changed in QuickBooks.',
    highlights: ['Overnight checks on the connected QuickBooks Online company', 'Duplicates, supplier risk, GST, attachments and housekeeping from the mySMB checks catalogue', 'A Checks item in WorkQ, with dismiss and snooze', 'Weekly data quality report'],
    pitch: 'Catch duplicates, GST problems and supplier risk in a client’s QuickBooks overnight.',
    firstStep: 'Run the Bookkeeping: Start checks setup (QuickBooks) automation.',
  },
}[LEDGER];
const description = STORE.description;
const content = { agents: agentRel ? [agentRel] : [], automations: automationFiles, formTemplates: [], forms: formFiles, workqTemplates: [] };
const keywords = STORE.keywords;
writeJson(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), {
  category: 'Finance', content, description, icon: 'receipt', keywords, name: SLUG, version: '0.0.0',
});

const mpPath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const raw = fs.readFileSync(mpPath, 'utf8');
const mp = JSON.parse(raw);
const entry = {
  category: 'Finance', content, description, icon: 'receipt', keywords, name: SLUG, tags: [], version: '0.0.0',
  displayName: STORE.displayName, source: `./plugins/${SLUG}`,
  branding: { logo: 'assets/logo.svg', color: STORE.color, tagline: STORE.tagline },
  listing: {
    longDescription: STORE.longDescription,
    highlights: STORE.highlights,
    publisher: { name: 'mySMB AI Studio', url: 'https://mysmb.com' },
  },
  onboarding: {
    pitch: STORE.pitch,
    firstStep: STORE.firstStep,
    relevantTo: ['bookkeeping', 'accounting', 'finance'],
  },
};
if (entry.branding.tagline.length > 90) throw new Error(`tagline too long (${entry.branding.tagline.length})`);
// Once the extension is in AI Studio the Developer Instance owns this entry (it rewrites it on publish),
// so only add it when missing.
if (!mp.plugins.some((p) => p.name === SLUG)) {
  // Inserted as text at the end of "plugins" (the file's last key), so the other entries' formatting is left as it is.
  const end = raw.lastIndexOf(']');
  const text = JSON.stringify(entry, null, 2).split('\n').map((l) => '    ' + l).join('\n');
  const next = raw.slice(0, end).trimEnd() + (mp.plugins.length ? ',' : '') + '\n' + text + '\n  ' + raw.slice(end);
  if (JSON.stringify(JSON.parse(next)) !== JSON.stringify({ ...mp, plugins: [...mp.plugins, entry] })) throw new Error('marketplace.json: "plugins" is not its last key');
  fs.writeFileSync(mpPath, next);
}

if (!WITH_PAYROLL) {
  // Nothing payroll may survive: no payroll form, scope or connector, helper or pay run wording in what was written.
  const skillsDir = path.join(PLUGIN, 'skills');
  const written = [...automationFiles, ...formFiles].map((rel) => fs.readFileSync(path.join(PLUGIN, rel), 'utf8')).join('\n')
    + fs.readFileSync(path.join(PLUGIN, 'README.md'), 'utf8')
    + (fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).map((f) => fs.readFileSync(path.join(skillsDir, f), 'utf8')).join('\n') : '');
  const leaks = ['xero-payroll-au', 'connectors:deputy', 'pay_guide_template', 'BK_PAYROLL', 'payroll_form', 'payroll_names', 'Pay run', 'Bookkeeping/Payroll', 'Bookkeeping Payroll',
    ...PAYROLL_FORMS.filter((k) => formIds[k]).map((k) => formIds[k].originKey), ...PAYROLL_FORMS.filter((k) => formIds[k]).map((k) => formIds[k].sourceId)].filter((t) => written.includes(t));
  if (leaks.length) throw new Error(`the build without payroll still mentions: ${leaks.join(', ')}`);
}
console.log(`generated ${SLUG}${WITH_PAYROLL ? '' : ' (without payroll)'}: ${formFiles.length} forms, ${automationFiles.length} automations, `
  + (agentKey ? `1 agent (${agentKey}), skills` : 'no agent'));
for (const a of AUTOMATIONS) console.log(`  ${a.name}`);

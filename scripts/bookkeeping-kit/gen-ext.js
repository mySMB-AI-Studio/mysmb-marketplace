#!/usr/bin/env node
// Generate plugins/bookkeeping-<ledger>/ in a mysmb-marketplace checkout from the kit source.
// Usage: node gen-ext.js <path-to-mysmb-marketplace> [ledger=xero]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FORMS, AUTOMATIONS } from './src/flows.js';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(KIT, 'src');
const ROOT = process.argv[2];
const LEDGER = process.argv[3] || 'xero';
if (!ROOT || !fs.existsSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'))) {
  console.error('usage: node gen-ext.js <mysmb-marketplace checkout> [ledger]');
  process.exit(1);
}
if (LEDGER !== 'xero') throw new Error('only the xero pack exists so far');
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

const formIds = Object.fromEntries(FORMS.map((key) => [key, {
  originKey: uuidFor(`bookkeeping:form:${key}`),
  sourceId: uuidFor(`bookkeeping:source:form:${key}`),
}]));

// ── clean output (only the files this generator owns) ───────────────────────
fs.rmSync(path.join(PLUGIN, 'content'), { recursive: true, force: true });
fs.rmSync(path.join(PLUGIN, 'agents'), { recursive: true, force: true });
fs.rmSync(path.join(PLUGIN, 'skills'), { recursive: true, force: true });

// ── forms ───────────────────────────────────────────────────────────────────
const formFiles = FORMS.map((key) => {
  const src = JSON.parse(fs.readFileSync(path.join(SRC, 'forms', `${key}.json`), 'utf8'));
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
const LIBS = Object.fromEntries(['util', 'xero', 'mail', 'payroll', 'checks', 'abr'].map((n) => [n, parseLib(n)]));
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
    const body = fs.readFileSync(path.join(SRC, 'automations', a.codeKey || a.key, `${n.id}.py`), 'utf8').replace(/\r\n/g, '\n').trim();
    const code = [...prelude(n.libs, body), '# ── ' + n.title + ' ──', body].join('\n\n\n') + '\n';
    const { libs, ...rest } = n;
    return { ...rest, code };
  });
  const flowIr = JSON.parse(substituteForms(JSON.stringify({
    irVersion: 1, name: a.name, description: a.description, params: a.params, triggers: a.triggers, nodes, rootOrder: a.rootOrder,
  })));
  const originKey = uuidFor(a.neutral ? `bookkeeping:automation:${a.key}` : `bookkeeping:${LEDGER}:automation:${a.key}`);
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

// ── agent ───────────────────────────────────────────────────────────────────
const agentMd = fs.readFileSync(path.join(SRC, 'agents', `bookkeeping-coordinator-${LEDGER}.md`), 'utf8').replace(/\r\n/g, '\n');
const fm = Object.fromEntries(agentMd.split('---')[1].trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
const agentKey = fm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const agentOrigin = uuidFor(`agent:${SLUG}:${agentKey}`);
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const agent = withHash({
  kind: 'agent', originKey: agentOrigin, key: agentKey, name: fm.name, description: fm.description,
  rolePrompt: agentMd.split('---').slice(2).join('---').trim(), connectors: list(fm.connectors), skills: list(fm.skills),
  model: fm.model || 'haiku', platform: false, audienceMode: 'everyone',
});
fs.mkdirSync(path.join(PLUGIN, 'agents'), { recursive: true });
fs.writeFileSync(path.join(PLUGIN, 'agents', `${agentKey}.md`), agentMd);
const agentRel = `content/agents/${agentOrigin}.json`;
writeJson(path.join(PLUGIN, agentRel), agent);

// ── skills, README, connector, manifest ─────────────────────────────────────
fs.mkdirSync(path.join(PLUGIN, 'skills'), { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, 'skills'))) fs.copyFileSync(path.join(SRC, 'skills', f), path.join(PLUGIN, 'skills', f));
fs.copyFileSync(path.join(SRC, 'README.md'), path.join(PLUGIN, 'README.md'));
fs.mkdirSync(path.join(PLUGIN, 'assets'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'assets', 'logo.svg'), path.join(PLUGIN, 'assets', 'logo.svg'));
writeJson(path.join(PLUGIN, '.mcp.json'), { mcpServers: { 'xero-accounting': { type: 'http', url: `${MCP_HOST}/xero-accounting/mcp` } } });

const description = 'Supplier bills from PDF to approved in each client’s own Xero organisation: read, checked and coded by AI, reviewed in WorkQ, with a weekly AP digest. Built for bookkeeping practices.';
const content = { agents: [agentRel], automations: automationFiles, formTemplates: [], forms: formFiles, workqTemplates: [] };
const keywords = ['bookkeeping', 'xero', 'bills', 'accounts payable', 'ap', 'automation', 'practice'];
writeJson(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), {
  category: 'Finance', content, description, icon: 'receipt', keywords, name: SLUG, version: '0.0.0',
});

const mpPath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const raw = fs.readFileSync(mpPath, 'utf8');
const mp = JSON.parse(raw);
const entry = {
  category: 'Finance', content, description, icon: 'receipt', keywords, name: SLUG, tags: [], version: '0.0.0',
  displayName: 'Bookkeeping for Xero', source: `./plugins/${SLUG}`,
  branding: { logo: 'assets/logo.svg', color: '#13B5EA', tagline: 'Supplier bills from PDF to approved in each client’s own Xero.' },
  listing: {
    longDescription:
      'Drop a supplier bill PDF into a client’s inbox folder. **Bookkeeping for Xero** reads it, checks the totals, GST, ABN and duplicates, and codes each line from a saved rule, the supplier’s history or an AI suggestion. It then creates a draft bill with the PDF attached in **that client’s own Xero organisation** and sends it to the reviewer in WorkQ.\n\n'
      + 'The reviewer approves, changes, rejects or asks the client, in one short form. Decisions are applied in Xero, and coding corrections are remembered for next time. Bills over the client’s approval limit get a follow-up item with a draft email. A weekly digest shows what’s waiting and overdue for every client.',
    highlights: ['Draft bills in each client’s own Xero, with the PDF attached', 'Coding from saved rules, supplier history or AI, with reasons', 'Review, approve or ask the client in one WorkQ form', 'Weekly accounts payable digest across all clients'],
    publisher: { name: 'mySMB AI Studio', url: 'https://mysmb.com' },
  },
  onboarding: {
    pitch: 'Turn supplier bill PDFs into reviewed, coded bills in each client’s Xero.',
    firstStep: 'Run the Bookkeeping: Start setup automation.',
    relevantTo: ['bookkeeping', 'accounting', 'finance'],
  },
};
if (entry.branding.tagline.length > 90) throw new Error(`tagline too long (${entry.branding.tagline.length})`);
// Once the extension is in AI Studio the Developer Instance owns this entry (it rewrites it on publish),
// so only add it when missing.
if (!mp.plugins.some((p) => p.name === SLUG)) {
  mp.plugins.push(entry);
  fs.writeFileSync(mpPath, JSON.stringify(mp, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
}

console.log(`generated ${SLUG}: ${formFiles.length} forms, ${automationFiles.length} automations, 1 agent (${agentKey}), skills`);
for (const a of AUTOMATIONS) console.log(`  ${a.name}`);

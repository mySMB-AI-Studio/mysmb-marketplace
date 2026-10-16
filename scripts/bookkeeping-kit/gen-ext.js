#!/usr/bin/env node
// Generate plugins/bookkeeping-<ledger>/ (accounts payable) and plugins/bookkeeping-<ledger>-payroll/ in a mysmb-marketplace
// checkout from the kit source.
// Usage: node gen-ext.js <path-to-mysmb-marketplace> [ledger=xero]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FORMS, PAYROLL_FORMS, AUTOMATIONS } from './src/flows.js';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(KIT, 'src');
const ROOT = process.argv[2];
const LEDGER = process.argv[3] || 'xero';
if (!ROOT || !fs.existsSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'))) {
  console.error('usage: node gen-ext.js <mysmb-marketplace checkout> [ledger]');
  process.exit(1);
}
if (LEDGER !== 'xero') throw new Error('only the xero pack exists so far');
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
const packOfForm = (key) => (PAYROLL_FORMS.includes(key) ? 'payroll' : 'ap');

// ── the extensions this kit generates ───────────────────────────────────────
// Accounts payable and payroll are separate extensions, so each goes up the tiers (and to production) on its own.
// A component's originKey doesn't depend on its extension, so moving one between them keeps it in place in a workspace.
const PACKS = [
  {
    pack: 'ap',
    slug: `bookkeeping-${LEDGER}`,
    agent: `bookkeeping-coordinator-${LEDGER}.md`,
    skills: ['bookkeeping-xero-foundation.md'],
    readme: 'README.md',
    icon: 'receipt',
    // m365-mail-shared (a shared Outlook mailbox, for Email intake (Outlook shared mailbox)) isn't in the Microsoft 365
    // extension, so this extension brings it.
    mcp: {
      'xero-accounting': { type: 'http', url: `${MCP_HOST}/xero-accounting/mcp` },
      'm365-mail-shared': { type: 'http', url: `${MCP_HOST}/m365-mail-shared/mcp` },
    },
    category: 'Finance',
    description: 'Supplier bills from PDF to approved in each client’s own Xero organisation: read, checked and coded by AI, reviewed in WorkQ, with a weekly AP digest. Built for bookkeeping practices.',
    keywords: ['bookkeeping', 'xero', 'bills', 'accounts payable', 'ap', 'automation', 'practice'],
    entry: {
      displayName: 'Bookkeeping for Xero',
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
    },
  },
  {
    pack: 'payroll',
    slug: `bookkeeping-${LEDGER}-payroll`,
    agent: null,
    skills: ['bookkeeping-xero-payroll.md'],
    readme: 'README-payroll.md',
    icon: 'wallet',
    mcp: { 'xero-payroll-au': { type: 'http', url: `${MCP_HOST}/xero-payroll-au/mcp` } },
    category: 'payroll',
    description: 'Pay runs for bookkeeping practices on Xero Payroll AU: opened on each client’s preparation day, checked against Deputy or Xero timesheets and the client’s own pay guide, then an internal review pack and a drafted client approval. Reads only. Needs Bookkeeping for Xero.',
    keywords: ['bookkeeping', 'xero', 'payroll', 'pay run', 'deputy', 'award', 'practice'],
    entry: {
      displayName: 'Bookkeeping Payroll for Xero',
      branding: { logo: 'assets/logo.svg', color: '#13B5EA', tagline: 'Pay runs checked against timesheets and each client’s own pay guide.' },
      listing: {
        longDescription:
          'For practices that run payroll for their clients in **Xero Payroll AU**. On each client’s preparation day, **Bookkeeping Payroll for Xero** opens the pay run item, says when the timesheets are in, and drafts a chase when Deputy timesheets are late.\n\n'
          + 'When the payroll officer asks, it checks the pay run: Deputy (or Xero) hours per employee per day, missing starters, salaried staff with timesheets, penalty bands and rates against the client’s pay guide, this period’s changes and reimbursements. Then it builds the internal review pack and drafts the client approval email. It reads only: the officer makes every change in Xero Payroll. Needs **Bookkeeping for Xero** for the client settings.',
        highlights: ['Pay run item opened on each client’s preparation day', 'Hours and rates checked against Deputy and the client’s pay guide', 'Internal review pack and drafted client approval', 'Reads only: nothing is changed in Xero Payroll'],
        publisher: { name: 'mySMB AI Studio', url: 'https://mysmb.com' },
      },
      onboarding: {
        pitch: 'Check every pay run against timesheets and the client’s pay guide before it goes out.',
        firstStep: 'Run the Bookkeeping: Start payroll setup automation.',
        relevantTo: ['bookkeeping', 'payroll'],
      },
    },
  },
];

// ── automations: helper libraries ───────────────────────────────────────────
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
const LIBS = Object.fromEntries(['util', 'xero', 'mail', 'payroll', 'checks', 'abr', 'route'].map((n) => [n, parseLib(n)]));
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

const mpPath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

for (const P of PACKS) {
  const PLUGIN = path.join(ROOT, 'plugins', P.slug);
  const automations = AUTOMATIONS.filter((a) => (a.pack || 'ap') === P.pack);
  for (const a of automations) {
    for (const f of a.forms) if (packOfForm(f) !== P.pack) throw new Error(`${a.key} (${P.pack}) uses form ${f} from another extension`);
  }

  // ── clean output (only the files this generator owns) ─────────────────────
  fs.rmSync(path.join(PLUGIN, 'content'), { recursive: true, force: true });
  fs.rmSync(path.join(PLUGIN, 'agents'), { recursive: true, force: true });
  fs.rmSync(path.join(PLUGIN, 'skills'), { recursive: true, force: true });

  // ── forms ─────────────────────────────────────────────────────────────────
  const formFiles = FORMS.filter((key) => packOfForm(key) === P.pack).map((key) => {
    const src = JSON.parse(fs.readFileSync(path.join(SRC, 'forms', `${key}.json`), 'utf8'));
    const payload = withHash({ kind: 'form', originKey: formIds[key].originKey, title: src.title, schema: src.schema });
    const rel = `content/forms/${payload.originKey}.json`;
    writeJson(path.join(PLUGIN, rel), payload);
    return rel;
  });

  // ── automations ───────────────────────────────────────────────────────────
  const automationFiles = automations.map((a) => {
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

  // ── agent ─────────────────────────────────────────────────────────────────
  const agents = [];
  let agentKey = '';
  if (P.agent) {
    const agentMd = fs.readFileSync(path.join(SRC, 'agents', P.agent), 'utf8').replace(/\r\n/g, '\n');
    const fm = Object.fromEntries(agentMd.split('---')[1].trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
    agentKey = fm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const agentOrigin = uuidFor(`agent:${P.slug}:${agentKey}`);
    const agent = withHash({
      kind: 'agent', originKey: agentOrigin, key: agentKey, name: fm.name, description: fm.description,
      rolePrompt: agentMd.split('---').slice(2).join('---').trim(), connectors: list(fm.connectors), skills: list(fm.skills),
      model: fm.model || 'haiku', platform: false, audienceMode: 'everyone',
    });
    fs.mkdirSync(path.join(PLUGIN, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(PLUGIN, 'agents', `${agentKey}.md`), agentMd);
    const agentRel = `content/agents/${agentOrigin}.json`;
    writeJson(path.join(PLUGIN, agentRel), agent);
    agents.push(agentRel);
  }

  // ── skills, README, connector, manifest ───────────────────────────────────
  fs.mkdirSync(path.join(PLUGIN, 'skills'), { recursive: true });
  for (const f of P.skills) fs.copyFileSync(path.join(SRC, 'skills', f), path.join(PLUGIN, 'skills', f));
  fs.copyFileSync(path.join(SRC, P.readme), path.join(PLUGIN, 'README.md'));
  fs.mkdirSync(path.join(PLUGIN, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(SRC, 'assets', 'logo.svg'), path.join(PLUGIN, 'assets', 'logo.svg'));
  writeJson(path.join(PLUGIN, '.mcp.json'), { mcpServers: P.mcp });

  const content = { agents, automations: automationFiles, formTemplates: [], forms: formFiles, workqTemplates: [] };
  writeJson(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), {
    category: P.category, content, description: P.description, icon: P.icon, keywords: P.keywords, name: P.slug, version: '0.0.0',
  });

  const raw = fs.readFileSync(mpPath, 'utf8');
  const mp = JSON.parse(raw);
  const entry = {
    category: P.category, content, description: P.description, icon: P.icon, keywords: P.keywords, name: P.slug, tags: [], version: '0.0.0',
    source: `./plugins/${P.slug}`, ...P.entry,
  };
  if (entry.branding.tagline.length > 90) throw new Error(`tagline too long (${entry.branding.tagline.length})`);
  // Once the extension is in AI Studio the Developer Instance owns this entry (it rewrites it on publish),
  // so only add it when missing.
  if (!mp.plugins.some((p) => p.name === P.slug)) {
    mp.plugins.push(entry);
    fs.writeFileSync(mpPath, JSON.stringify(mp, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  }

  console.log(`generated ${P.slug}: ${formFiles.length} forms, ${automationFiles.length} automations, ${agents.length} agent(s)${agentKey ? ' (' + agentKey + ')' : ''}, skills`);
  for (const a of automations) console.log(`  ${a.name}`);
}

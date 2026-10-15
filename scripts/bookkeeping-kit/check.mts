// Validate a generated bookkeeping extension with myHubV2's own schemas (copied into .myhub/ from origin/dev):
// Flow IR shape + semantics, form schema, content payload envelopes, contentHash, and the marketplace entry.
// The marketplace repo's validate.ts checks none of these. Usage: npx tsx check.mts <mysmb-marketplace> [slug]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { flowIrSchema } from './.myhub/packages/shared/src/automations/ir-schema.ts';
import { validateFlowSemantics } from './.myhub/packages/shared/src/automations/ir-semantics.ts';
import { formSchemaSchema } from './.myhub/packages/shared/src/forms/form-schema.ts';
import { marketplaceManifestSchema, marketplacePluginSchema } from './.myhub/packages/shared/src/plugins/marketplace-manifest.ts';

const ROOT = process.argv[2];
const SLUG = process.argv[3] ?? 'bookkeeping-xero';
const PLUGIN = path.join(ROOT, 'plugins', SLUG);
const problems: string[] = [];
const fail = (where: string, msg: string) => problems.push(`${where}: ${msg}`);

// Envelope arms, mirrored from packages/shared/src/plugins/authoring/install-content.ts (not importable: it pulls in the DB).
const dep = z.object({ entityKind: z.string().min(1), originKey: z.string().uuid(), sourceId: z.string().uuid() });
const base = { originKey: z.string().uuid(), contentHash: z.string().min(1) };
const arms = {
  automation: z.object({ kind: z.literal('automation'), ...base, name: z.string().min(1), description: z.string().nullable().default(null),
    level: z.string().default('org'), flowIr: z.unknown(), declaredScopes: z.array(z.string()).default([]), tags: z.array(z.string()).default([]),
    dependencies: z.array(dep).default([]), attachments: z.array(z.unknown()).default([]), knowledgeFiles: z.array(z.unknown()).default([]) }).strict(),
  form: z.object({ kind: z.literal('form'), ...base, title: z.string().min(1), schema: z.unknown() }).strict(),
  agent: z.object({ kind: z.literal('agent'), ...base, key: z.string().min(1), name: z.string().min(1).max(120), description: z.string().max(500).default(''),
    rolePrompt: z.string().min(1).max(20000), connectors: z.array(z.string()).max(50).default([]), skills: z.array(z.string()).max(50).default([]),
    model: z.enum(['haiku', 'sonnet', 'opus']).default('haiku'), platform: z.boolean().default(false),
    audienceMode: z.enum(['everyone', 'groups', 'users', 'admins']).default('everyone') }).strict(),
};

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.keys(v as object).sort().reduce((o: Record<string, unknown>, k) => ((v as Record<string, unknown>)[k] !== undefined && (o[k] = canon((v as Record<string, unknown>)[k])), o), {}) : v);
const hashOf = (p: Record<string, unknown>) => { const { contentHash, ...rest } = p; return crypto.createHash('sha256').update(JSON.stringify(canon(rest))).digest('hex'); };

const pluginJson = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
const seenKeys = new Set<string>();
const byOrigin = new Map<string, string>();
let counts = { automation: 0, form: 0, agent: 0 };

for (const [section, kind] of [['automations', 'automation'], ['forms', 'form'], ['agents', 'agent']] as const) {
  for (const rel of pluginJson.content[section] as string[]) {
    const file = path.join(PLUGIN, rel);
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const parsed = arms[kind].safeParse(payload);
    if (!parsed.success) { fail(rel, `envelope: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`); continue; }
    if (path.basename(rel, '.json') !== payload.originKey) fail(rel, 'filename is not the originKey');
    if (seenKeys.has(payload.originKey)) fail(rel, 'duplicate originKey');
    seenKeys.add(payload.originKey);
    byOrigin.set(payload.originKey, kind);
    if (hashOf(payload) !== payload.contentHash) fail(rel, 'stale contentHash');
    counts[kind]++;

    if (kind === 'form') {
      const s = formSchemaSchema.safeParse(payload.schema);
      if (!s.success) fail(rel, `form schema: ${s.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    }
    if (kind === 'automation') {
      const ir = flowIrSchema.safeParse(payload.flowIr);
      if (!ir.success) { fail(rel, `flowIr: ${ir.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`); continue; }
      for (const issue of validateFlowSemantics(ir.data, { declaredScopes: payload.declaredScopes })) fail(rel, `semantics ${issue.code}: ${issue.message}`);
      const irText = JSON.stringify(payload.flowIr);
      if (irText.includes('@form:')) fail(rel, 'unsubstituted @form: placeholder');
      for (const d of payload.dependencies) {
        if (!irText.includes(d.sourceId)) fail(rel, `dependency ${d.originKey} sourceId is never used in the IR`);
        if (!pluginJson.content.forms.some((f: string) => f.includes(d.originKey))) fail(rel, `dependency ${d.originKey} is not bundled`);
      }
      // Every api.<ns>.<m>( needs its scope; every connector server needs connectors:<server>.
      const need: Record<string, string> = { 'workq.list': 'workq:read', 'workq.get': 'workq:read', 'files.read': 'files:read', 'files.get': 'files:read', 'files.list': 'files:read',
        'files.put': 'files:write', 'files.delete': 'files:write', 'ai.extract': 'ai:generate', 'ai.generate': 'ai:generate', 'artifacts.put': 'artifacts:write', 'notify.send': 'notify:send' };
      for (const n of ir.data.nodes) {
        if (n.kind !== 'python') continue;
        for (const m of n.code.matchAll(/api\.([a-z_]+)\.([a-z_]+)\(/g)) {
          const key = `${m[1]}.${m[2]}`;
          const scope = need[key] ?? (m[1] === 'workq' ? 'workq:write' : undefined);
          if (scope && !payload.declaredScopes.includes(scope)) fail(`${rel} ${n.id}`, `calls api.${key} without scope ${scope}`);
        }
        // Connector servers: the Xero adapter talks to xero-accounting; the mail adapter to the node's provider.
        if (/api\.connectors\.invoke\(/.test(n.code)) {
          const servers: string[] = [];
          if (n.code.includes('XERO = "xero-accounting"')) servers.push('xero-accounting');
          if (n.code.includes('def pay_call(')) servers.push('xero-payroll-au');
          if (n.code.includes('ABR_SERVER = "abr"')) servers.push('abr');
          // The Xero-only check carries the Deputy helper but its provider param means it never calls it.
          if (n.code.includes('def deputy_rows(') && (n.params.find((p: { name: string }) => p.name === 'provider') as { value?: string } | undefined)?.value !== 'xero') servers.push('deputy');
          const provider = n.params.find((p: { name: string }) => p.name === 'provider') as { value?: string } | undefined;
          if (n.code.includes('MAIL_SERVER = ')) {
            const server = ({ outlook: 'm365-mail-read', gmail: 'google-workspace-gmail' } as Record<string, string>)[provider?.value ?? ''];
            if (!server) fail(`${rel} ${n.id}`, 'mail node without a known provider param');
            else servers.push(server);
          }
          if (servers.length === 0) fail(`${rel} ${n.id}`, 'calls api.connectors.invoke without a known connector adapter');
          for (const server of servers) {
            if (!payload.declaredScopes.includes(`connectors:${server}`)) fail(`${rel} ${n.id}`, `calls ${server} without scope connectors:${server}`);
          }
        }
        if (/\beval\(|\bexec\(|\bcompile\(/.test(n.code)) fail(`${rel} ${n.id}`, 'uses eval/exec/compile');
      }
    }
  }
}

// marketplace entry + manifest
const mp = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
const entry = mp.plugins.find((p: { name: string }) => p.name === SLUG);
if (!entry) fail('marketplace.json', `no entry for ${SLUG}`);
else {
  const e = marketplacePluginSchema.safeParse(entry);
  if (!e.success) fail('marketplace.json entry', e.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; '));
  if (entry.branding?.logo) {
    const logo = path.join(PLUGIN, entry.branding.logo);
    if (!fs.existsSync(logo)) fail('branding', 'logo missing');
    else if (fs.statSync(logo).size > 96 * 1024) fail('branding', 'logo over 96 KB');
  }
}
const whole = marketplaceManifestSchema.safeParse(mp);
if (!whole.success) fail('marketplace.json', whole.error.issues.slice(0, 5).map((i) => i.path.join('.') + ' ' + i.message).join('; '));

const agentFile = pluginJson.content.agents[0];
const agentPayload = JSON.parse(fs.readFileSync(path.join(PLUGIN, agentFile), 'utf8'));
// `<plugin>:<skill>` names another extension's skill; it resolves only when that extension is installed too.
for (const s of agentPayload.skills) if (!s.includes(':') && !fs.existsSync(path.join(PLUGIN, 'skills', `${s}.md`))) fail('agent', `skill ${s} not bundled`);
const mcp = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.mcp.json'), 'utf8'));
for (const c of agentPayload.connectors) if (!mcp.mcpServers[c]) fail('agent', `connector ${c} not in .mcp.json`);

const rev = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.myhub', 'REV'), 'utf8').trim();
if (problems.length) {
  console.error(`check: ${problems.length} problem(s) (myHubV2 schemas @ ${rev})\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check: OK — ${counts.automation} automations, ${counts.form} forms, ${counts.agent} agent (myHubV2 schemas @ ${rev})`);

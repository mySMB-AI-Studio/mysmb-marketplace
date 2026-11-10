// Validate Cliniko Automations and Healthcare Practice Management with myHubV2's own schemas (the copies the
// bookkeeping kit keeps in ../bookkeeping-kit/.myhub): Flow IR shape + semantics, form schema and contentHash.
// The repo's validate.ts checks none of these. Usage (needs the bookkeeping kit's `npm ci`):
//   ../bookkeeping-kit/node_modules/.bin/tsx check.mts
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { flowIrSchema } from '../bookkeeping-kit/.myhub/packages/shared/src/automations/ir-schema.ts';
import { validateFlowSemantics } from '../bookkeeping-kit/.myhub/packages/shared/src/automations/ir-semantics.ts';
import { formSchemaSchema } from '../bookkeeping-kit/.myhub/packages/shared/src/forms/form-schema.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.keys(v as object).sort().reduce((o: Record<string, unknown>, k) => ((v as Record<string, unknown>)[k] !== undefined && (o[k] = canon((v as Record<string, unknown>)[k])), o), {}) : v);
const hashOf = (p: Record<string, unknown>) => { const { contentHash: _h, ...rest } = p; return crypto.createHash('sha256').update(JSON.stringify(canon(rest))).digest('hex'); };

const problems: string[] = [];
for (const slug of ['cliniko-automations', 'healthcare-practice-management']) {
  const plugin = path.join(ROOT, 'plugins', slug);
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), 'utf8'));
  let count = 0;
  for (const section of ['automations', 'forms'] as const) {
    for (const rel of (manifest.content?.[section] ?? []) as string[]) {
      const where = `${slug}/${rel}`;
      const payload = JSON.parse(fs.readFileSync(path.join(plugin, rel), 'utf8'));
      count++;
      if (hashOf(payload) !== payload.contentHash) problems.push(`${where}: stale contentHash`);
      if (section === 'forms') {
        const s = formSchemaSchema.safeParse(payload.schema);
        if (!s.success) problems.push(`${where}: form schema: ${s.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
        continue;
      }
      const ir = flowIrSchema.safeParse(payload.flowIr);
      if (!ir.success) { problems.push(`${where}: flowIr: ${ir.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`); continue; }
      for (const issue of validateFlowSemantics(ir.data, { declaredScopes: payload.declaredScopes })) problems.push(`${where}: semantics ${issue.code}: ${issue.message}`);
    }
  }
  console.log(`${slug}: ${count} components checked`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('check: OK');

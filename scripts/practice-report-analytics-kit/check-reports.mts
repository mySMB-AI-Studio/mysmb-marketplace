// npx tsx check-reports.mts — myHubV2's own validators, same pattern as client-report-analytics-kit.
// Uses the Xero kit's verbatim copy of myHubV2 packages/shared/src/artifacts/report-bindings.ts.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as RB from '../xero-reporting-kit/platform/report-bindings.ts';
import { z } from 'zod';
const here = dirname(fileURLToPath(import.meta.url));
const { REPORTS, PLUGIN } = createRequire(import.meta.url)('./reports.js');
let bad = 0, n = 0;
for (const r of REPORTS) {
  const mf = join(here, r.ref + '.manifest.json');
  const html = join(here, 'out', r.ref.replace('/', '-') + '.html');
  if (!existsSync(html)) { console.log('NOT BUILT (run node build.js ' + r.ref + ')', r.ref); bad++; continue; }
  if (!existsSync(mf)) { console.log('OK static', r.ref); continue; } // no dataBindings to validate (e.g. PRA-00)
  n++;
  const parsed = (RB as any).reportDataBindingsSchema.safeParse(JSON.parse(readFileSync(mf, 'utf8')));
  if (!parsed.success) { bad++; console.log('SCHEMA FAIL', r.ref, JSON.stringify(parsed.error.issues).slice(0, 400)); continue; }
  try { (RB as any).resolveHydrateInputs(parsed.data, {}, new Date()); } catch (e) { bad++; console.log('RESOLVE FAIL', r.ref, (e as Error).message); }
  const issues: string[] = RB.validateReportDocument(readFileSync(html, 'utf8'), parsed.data);
  if (issues.length) { bad++; console.log('DOC FAIL', r.ref, issues); } else console.log('OK', r.ref.padEnd(32), 'inputs', parsed.data.inputs.length, 'bindings', parsed.data.bindings.length);
}
const TPL = join(here, '..', '..', 'plugins', PLUGIN, 'reports');
const metaSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  dataBindings: (RB as any).reportDataBindingsSchema.optional(),
}).strict();
let t = 0;
for (const slug of existsSync(TPL) ? readdirSync(TPL) : []) {
  t++;
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(slug)) { bad++; console.log('TEMPLATE SLUG', slug); continue; }
  const meta = metaSchema.safeParse(JSON.parse(readFileSync(join(TPL, slug, 'report.json'), 'utf8')));
  if (!meta.success) { bad++; console.log('TEMPLATE META FAIL', slug, JSON.stringify(meta.error.issues).slice(0, 400)); continue; }
  const doc = readFileSync(join(TPL, slug, 'report.html'), 'utf8');
  const issues: string[] = meta.data.dataBindings ? RB.validateReportDocument(doc, meta.data.dataBindings) : [];
  if (issues.length) { bad++; console.log('TEMPLATE DOC FAIL', slug, issues); } else console.log('OK template', slug);
}
console.log(bad ? `${bad} FAILED` : `ALL ${n} MANIFESTS AND DOCUMENTS VALID; ${t} TEMPLATES VALID`);
process.exit(bad ? 1 : 0);

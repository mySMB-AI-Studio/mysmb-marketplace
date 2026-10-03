// npx tsx check-reports.mts [dir] — validates every report manifest in <dir>/reports with the platform's own
// reportDataBindingsSchema + resolveHydrateInputs, and every built document in <dir>/out with validateReportDocument:
// the same code artifact_save and "Use this report" run. platform/report-bindings.ts is a verbatim copy of
// myHubV2 packages/shared/src/artifacts/report-bindings.ts (refresh it when that file changes).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as RB from './platform/report-bindings.ts';
import { z } from 'zod';

const base = process.argv[2] || dirname(fileURLToPath(import.meta.url));
const dir = join(base, 'reports'), out = join(base, 'out');
let bad = 0, n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.manifest.json'))) {
  const name = f.replace('.manifest.json', ''); n++;
  const parsed = (RB as any).reportDataBindingsSchema.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  if (!parsed.success) { bad++; console.log('SCHEMA FAIL', name, JSON.stringify(parsed.error.issues).slice(0, 400)); continue; }
  try { (RB as any).resolveHydrateInputs(parsed.data, {}, new Date()); } catch (e) { bad++; console.log('RESOLVE FAIL', name, (e as Error).message); }
  const html = join(out, name + '.html');
  if (!existsSync(html)) { bad++; console.log('NOT BUILT', name, '(run node build.js ' + name + ')'); continue; }
  const issues: string[] = RB.validateReportDocument(readFileSync(html, 'utf8'), parsed.data);
  if (issues.length) { bad++; console.log('DOC FAIL', name, issues); } else console.log('OK', name.padEnd(20), 'inputs', parsed.data.inputs.length, 'bindings', parsed.data.bindings.length);
}
// The plugin's report templates (plugins/quickbooks-reporting-studio/reports/<slug>/), read the way myHubV2 report-templates.ts reads
// them: report.json against its strict metadata schema (a template that fails it is silently skipped there), report.html
// against the same document check.
const TPL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'quickbooks-reporting-studio', 'reports');
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
  const issues: string[] = RB.validateReportDocument(readFileSync(join(TPL, slug, 'report.html'), 'utf8'), meta.data.dataBindings);
  if (issues.length) { bad++; console.log('TEMPLATE DOC FAIL', slug, issues); } else console.log('OK template', slug);
}
console.log(bad ? `${bad} FAILED` : `ALL ${n} MANIFESTS AND DOCUMENTS VALID; ${t} TEMPLATES VALID`);
process.exit(bad ? 1 : 0);

// npx tsx check-reports.mts [dir] — validates every report manifest in <dir>/reports with the platform's own
// reportDataBindingsSchema + resolveHydrateInputs, and every built document in <dir>/out with validateReportDocument:
// the same code artifact_save and "Use this report" run. platform/report-bindings.ts is a verbatim copy of
// myHubV2 packages/shared/src/artifacts/report-bindings.ts (refresh it when that file changes).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as RB from './platform/report-bindings.ts';

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
  if (issues.length) { bad++; console.log('DOC FAIL', name, issues); } else console.log('OK', name.padEnd(6), 'inputs', parsed.data.inputs.length, 'bindings', parsed.data.bindings.length);
}
console.log(bad ? `${bad} FAILED` : `ALL ${n} MANIFESTS AND DOCUMENTS VALID`);
process.exit(bad ? 1 : 0);

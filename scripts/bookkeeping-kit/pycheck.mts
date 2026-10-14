// Stage 3 of the platform's automation validation, run locally: pyright (basic, py3.12) over every node
// against the generated api/trigger/param stubs — the same files the Developer Instance writes.
// Usage: npx tsx pycheck.mts <mysmb-marketplace> [slug]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { flowIrSchema } from './.myhub/packages/shared/src/automations/ir-schema.ts';
import { buildEnvStub, buildNodeFile, buildCondFile } from './.myhub/apps/web/src/lib/automations/validation/stubs.ts';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2];
const SLUG = process.argv[3] ?? 'bookkeeping-xero';
const PLUGIN = path.join(ROOT, 'plugins', SLUG);
const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
let errors = 0;

for (const rel of manifest.content.automations as string[]) {
  const payload = JSON.parse(fs.readFileSync(path.join(PLUGIN, rel), 'utf8'));
  const ir = flowIrSchema.parse(payload.flowIr);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-pyright-'));
  fs.writeFileSync(path.join(dir, '_automation_env.pyi'), buildEnvStub(ir));
  fs.writeFileSync(path.join(dir, 'pyrightconfig.json'), JSON.stringify({
    typeCheckingMode: 'basic', pythonVersion: '3.12', reportMissingImports: false, reportMissingModuleSource: false, reportUnusedExpression: false,
  }));
  for (const n of ir.nodes) {
    if (n.kind === 'python') fs.writeFileSync(path.join(dir, `node_${n.id}.py`), buildNodeFile(n, ir));
    if (n.kind === 'if') fs.writeFileSync(path.join(dir, `node_${n.id}.py`), buildCondFile(n));
  }
  let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(KIT, 'node_modules', 'pyright', 'index.js'), '--outputjson', '-p', dir], { encoding: 'utf8' });
  } catch (e: any) {
    out = e.stdout; // exit 1 = diagnostics found
  }
  const report = JSON.parse(out);
  const diags = (report.generalDiagnostics ?? []).filter((d: any) => d.severity === 'error');
  errors += diags.length;
  console.log(`${diags.length ? 'FAIL' : 'ok  '} ${payload.name} (${report.summary.filesAnalyzed} files)`);
  for (const d of diags) {
    const file = path.basename(d.file);
    const lines = fs.readFileSync(d.file, 'utf8').split('\n');
    console.log(`     ${file}:${d.range.start.line + 1} ${d.message.split('\n')[0]}\n       > ${lines[d.range.start.line]?.trim()}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
if (errors) { console.error(`pycheck: ${errors} type error(s)`); process.exit(1); }
console.log('pycheck: OK');

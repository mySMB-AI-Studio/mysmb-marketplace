// node roundtrip.js — the check to run before opening a PR. Extracts every report document and manifest back out of the
// GENERATED skill files (what the agent actually copies), then on that copy: runs every test, builds every report, runs the
// platform validators, and checks each skill against the platform's size limits and the agent's line and document limits.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const K = __dirname, SKILLS = path.resolve(K, '..', '..', 'plugins', 'xero-reporting-studio', 'skills');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'xero-rt-')), FAM = require('./families.js');
const run = (cmd, args, env) => execFileSync(cmd, args, { cwd: K, stdio: 'inherit', env: Object.assign({}, process.env, env || {}), shell: process.platform === 'win32' });
console.log('1. extract from', SKILLS); run('node', ['extract-skills.js', SKILLS, OUT]);
console.log('2. tests on the extracted copy'); for (const t of ['test-ledger.js', 'test-xero.js', 'test-dash.js', 'test-conformance.js']) run('node', [t], { KIT_DIR: OUT });
console.log('3. build every report'); for (const f of FAM) run('node', ['build.js', f.report], { KIT_DIR: OUT });
console.log('4. platform validators'); run('npx', ['tsx', 'check-reports.mts', OUT]);
console.log('5. limits: markdown ≤ 128 × 1024 characters, description ≤ 500, no line over 1,500 characters, report document + dataBindings ≤ 35,000 tokens');
const { countTokens } = require('@anthropic-ai/tokenizer'), tok = (f) => countTokens(fs.readFileSync(path.join(OUT, 'reports', f.report + '.doc.html'), 'utf8')) + countTokens(JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT, 'reports', f.report + '.manifest.json'), 'utf8'))));
let bad = 0;
for (const f of fs.readdirSync(SKILLS)) {
  const s = fs.readFileSync(path.join(SKILLS, f), 'utf8'), m = /^---\n[\s\S]*?\ndescription: (.*)\n/.exec(s.replace(/\r\n/g, '\n'));
  if (s.length > 128 * 1024 || !m || m[1].length > 500) { bad++; console.log('  TOO BIG', f, s.length, 'chars, description', m ? m[1].length : 'missing'); }
  const long = Math.max(...s.split('\n').map((l) => l.length));
  if (long > 1500) { bad++; console.log('  LINE TOO LONG', f, long, 'characters'); }
}
for (const f of FAM) {
  const d = tok(f);
  if (d > 35000) { bad++; console.log('  DOCUMENT TOO BIG', f.skill, d, 'tokens'); }
}
console.log('  report documents + dataBindings (tokens):', FAM.map((f) => f.report + ' ' + tok(f)).join(', '));
if (bad) process.exit(1);
console.log('\nROUND TRIP OK —', FAM.length, 'kit reports; extracted copy in', OUT);

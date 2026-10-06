// node roundtrip.js — the check to run before opening a PR. Extracts the kit, every report config and manifest back out of
// the GENERATED skill files (what the agent copies on the copy path), then on that copy: runs the tests, builds every report,
// runs the platform validators, checks every report template against the skills, and checks the skills' size limits.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const K = __dirname, PLUGIN = path.resolve(K, '..', '..', 'plugins', 'myob-reporting-studio'), SKILLS = path.join(PLUGIN, 'skills');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'myob-rt-')), FAM = require('./families.js'), KIT = FAM;
const run = (cmd, args, env) => execFileSync(cmd, args, { cwd: K, stdio: 'inherit', env: Object.assign({}, process.env, env || {}), shell: process.platform === 'win32' });
const rdx = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
console.log('1. extract from', SKILLS); run('node', ['extract-skills.js', SKILLS, OUT]);
console.log('2. tests on the extracted copy'); for (const t of ['test-myob.js', 'test-wave1.js', 'test-wave1b.js', 'test-wave2.js', 'test-wave3.js', 'test-wave4.js', 'test-wave5.js', 'test-wave6.js', 'test-wave7.js', 'test-wave8.js', 'test-wave9.js', 'test-wave10.js', 'test-wave11.js', 'test-conformance.js']) run('node', [t], { KIT_DIR: OUT });
console.log('3. build every kit report'); for (const f of KIT) run('node', ['build.js', f.report], { KIT_DIR: OUT });
console.log('4. platform validators'); run('npx', ['tsx', 'check-reports.mts', OUT]);
console.log('5. templates = the skills: reports/<skill>/report.html is the document the copy path assembles, report.json the skill\'s dataBindings');
process.env.KIT_DIR = OUT; const build = require('./build.js'); // a template's page title is the report name; its library title adds the platform
const tpl = KIT;
for (const f of tpl) {
  const T = path.join(PLUGIN, 'reports', f.skill), meta = fs.existsSync(T) ? JSON.parse(rdx(path.join(T, 'report.json'))) : null;
  const same = meta && rdx(path.join(T, 'report.html')) === build(f.report, meta.title.replace(/^MYOB /, '')) &&
    JSON.stringify(meta.dataBindings) === JSON.stringify(JSON.parse(rdx(path.join(OUT, 'reports', f.report + '.manifest.json'))));
  if (!same) { console.log('  TEMPLATE DIFFERS FROM SKILL', f.skill, '(run npm run gen)'); process.exit(1); }
}
const extra = fs.readdirSync(path.join(PLUGIN, 'reports')).filter((d) => !tpl.some((f) => f.skill === d));
if (extra.length) { console.log('  TEMPLATES WITHOUT A KIT REPORT', extra.join(', ')); process.exit(1); }
console.log('  all', tpl.length, 'templates match their skills');
console.log('6. limits: markdown ≤ 128 × 1024 characters, description ≤ 500, no line over 1,500 characters, report document + dataBindings ≤ 35,000 tokens');
let bad = 0;
// On the copy path the agent writes the document and its dataBindings in one artifact_save call, inside a 10-minute turn; the largest
// document proven in QA (QuickBooks Forecasts) counts about 35,300 tokens. Counted with @anthropic-ai/tokenizer, as the Xero kit does.
const { countTokens } = require('@anthropic-ai/tokenizer'), docTokens = tpl.map((f) => { const T = path.join(PLUGIN, 'reports', f.skill); return [f.skill, countTokens(rdx(path.join(T, 'report.html'))) + countTokens(JSON.stringify(JSON.parse(rdx(path.join(T, 'report.json'))).dataBindings))]; });
docTokens.forEach(([s, n]) => { if (n > 35000) { bad++; console.log('  DOCUMENT TOO BIG', s, n, 'tokens'); } });
console.log('  report documents + dataBindings (tokens):', docTokens.map(([s, n]) => s + ' ' + n).join(', '));
for (const f of fs.readdirSync(SKILLS)) {
  const s = rdx(path.join(SKILLS, f)), m = /^---\n[\s\S]*?\ndescription: (.*)\n/.exec(s);
  if (s.length > 128 * 1024 || !m || m[1].length > 500) { bad++; console.log('  TOO BIG', f, s.length, 'chars, description', m ? m[1].length : 'missing'); }
  const long = Math.max(...s.split('\n').map((l) => l.length)), fam = FAM.find((x) => x.skill + '.md' === f);
  // A long line only matters on the copy path; a report with a template is created without the agent reading its blocks.
  if (long > 1500) { if (fam && tpl.includes(fam)) console.log('  note:', f, 'has a', long, 'character line (copy path only — the template path never reads it)'); else { bad++; console.log('  LINE TOO LONG', f, long, 'characters'); } }
}
if (bad) process.exit(1);
console.log('\nROUND TRIP OK —', KIT.length, 'kit reports,', tpl.length, 'templates; extracted copy in', OUT);

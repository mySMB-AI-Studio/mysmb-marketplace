// node gen.js [--only <slug>] — writes every report template to plugins/practice-report-analytics/reports/<slug>/.
const fs = require('fs'), path = require('path');
const build = require('./build.js');
const { REPORTS, PLUGIN } = require('./reports.js');
const TPL = path.join(__dirname, '..', '..', 'plugins', PLUGIN, 'reports');
const only = process.argv[2] === '--only' ? process.argv[3] : null;
let n = 0;
for (const r of REPORTS) {
  if (only && r.slug !== only) continue;
  const src = path.join(__dirname, r.ref);
  if (!fs.existsSync(src + '.js')) { console.log('skip (not written yet)', r.slug); continue; }
  const html = build(r.ref);
  const meta = { title: r.title, description: r.description, tags: r.tags, fileName: r.fileName };
  if (fs.existsSync(src + '.manifest.json')) meta.dataBindings = JSON.parse(fs.readFileSync(src + '.manifest.json', 'utf8'));
  if (meta.description.length > 2000 || meta.tags.length > 20 || meta.title.length > 300) throw new Error(r.slug + ': template metadata over the platform limits');
  const dir = path.join(TPL, r.slug); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'report.html'), html);
  n++; console.log('wrote', r.slug, html.length, 'bytes');
}
console.log(n, 'templates written');

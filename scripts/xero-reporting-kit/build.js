// node build.js <report>  -> out/<report>.html
// A report document = skeleton + xk.css + the kit cut down to what reports/<report>.cfg.js uses (kit-prune.js) + the config.
// gen-xero.js puts exactly this document in the report skill. With KIT_DIR set to an extracted copy (roundtrip.js), the
// document is the one extracted from the skill (reports/<report>.doc.html), so the tests run on what the agent copies.
const fs = require('fs'), path = require('path');
const dir = process.env.KIT_DIR || __dirname;
const rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
function assemble(name, title) {
  const { reportKit } = require('./kit-prune.js');
  const cfg = rd(path.join('reports', name + '.cfg.js')).trim();
  const t = title || (cfg.match(/title:\s*'([^']+)'/) || [])[1] || name;
  const kit = reportKit(cfg), r = cfg.indexOf('render: function'), x = (kit + (r >= 0 ? cfg.slice(r) : cfg)).replace(/\s+/g, '');
  let h = 2166136261; for (let j = 0; j < x.length; j++) { h ^= x.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
  return rd('skeleton.html').trim().replace('{{TITLE}}', t).replace('{{CSS}}', () => rd('xk.css').trim()).replace('{{KIT}}', () => kit).replace('{{CFG}}', () => cfg).replace('{{SUM}}', h.toString(16)) + '\n';
}
function build(name, title) {
  const doc = path.join(dir, 'reports', name + '.doc.html');
  const html = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8').replace(/\r\n/g, '\n') : assemble(name, title);
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out', name + '.html'), html);
  return html;
}
if (require.main === module) { const h = build(process.argv[2]); console.log('built', process.argv[2], h.length, 'bytes'); }
module.exports = build;
module.exports.assemble = assemble;

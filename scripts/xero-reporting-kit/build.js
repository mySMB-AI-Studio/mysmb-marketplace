// node build.js <report>  -> out/<report>.html  (skeleton + xk.css + xk-kit.js + reports/<report>.cfg.js)
const fs = require('fs'), path = require('path');
const dir = process.env.KIT_DIR || __dirname;
function build(name, title) {
  const sk = fs.readFileSync(path.join(dir, 'skeleton.html'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'xk.css'), 'utf8').trim();
  const kit = fs.readFileSync(path.join(dir, 'xk-kit.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n').trim();
  const cfg = fs.readFileSync(path.join(dir, 'reports', name + '.cfg.js'), 'utf8').trim();
  const t = title || (cfg.match(/title:\s*'([^']+)'/) || [])[1] || name;
  const html = sk.replace('{{TITLE}}', t).replace('{{CSS}}', () => css).replace('{{KIT}}', () => kit).replace('{{CFG}}', () => cfg);
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out', name + '.html'), html);
  return html;
}
if (require.main === module) { const h = build(process.argv[2]); console.log('built', process.argv[2], h.length, 'bytes'); }
module.exports = build;

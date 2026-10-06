// node build.js <platform>/<id>  -> out/<platform>-<id>.html
// A report = <platform>/<id>.cfg.js + <platform>/<id>.manifest.json, assembled with that platform's kit (engines.js).
// The catalogue (catalogue/<id>.html) is a plain document with its own small script, not a kit report.
const fs = require('fs'), path = require('path');
const { ENGINES, rd } = require('./engines.js');
const OUT = path.join(__dirname, 'out');
function build(ref, title) {
  const [platform, id] = ref.split('/');
  let html;
  if (platform === 'catalogue') html = rd(path.join(__dirname, 'catalogue', id + '.html'));
  else {
    const eng = ENGINES[platform]; if (!eng) throw new Error('unknown platform ' + platform);
    const cfg = rd(path.join(__dirname, platform, id + '.cfg.js')).trim();
    html = eng.assemble(cfg, title || (cfg.match(/title:\s*'([^']+)'/) || [])[1] || id);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, platform + '-' + id + '.html'), html);
  return html;
}
const manifest = (ref) => JSON.parse(fs.readFileSync(path.join(__dirname, ref + '.manifest.json'), 'utf8'));
if (require.main === module) { const h = build(process.argv[2]); console.log('built', process.argv[2], h.length, 'bytes'); }
module.exports = build; module.exports.manifest = manifest;

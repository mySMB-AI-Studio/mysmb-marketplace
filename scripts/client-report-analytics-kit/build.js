// node build.js <platform>/<id>  -> out/<platform>-<id>.html
// A report = <platform>/<id>.cfg.js + <platform>/<id>.manifest.json, assembled with that platform's kit (engines.js).
// The catalogue is a plain document with its own small script, not a kit report: catalogue/<id>.js exports () => html.
const fs = require('fs'), path = require('path');
const { ENGINES, rd } = require('./engines.js');
const OUT = path.join(__dirname, 'out');
// A line "/* @include <path from this folder> */" in a config is replaced by that file: the live-checks reports share their
// rules (shared/live-checks.js), views (shared/live-views.js, shared/views/) and each platform's ledger mapping this way.
// Included files are compacted (esbuild, already a dependency of the Xero kit's kit-prune.js; lines kept under 400 characters)
// so each document stays inside the 35,000-token limit; the readable source is here. Top-level names (LC, LV, LV_VIEW) and
// every property (XK.*, MK.*, QB.*) keep their names.
const esbuild = require(path.join(__dirname, '..', 'xero-reporting-kit', 'node_modules', 'esbuild'));
const compact = (s) => esbuild.transformSync(s, { minify: true, lineLimit: 400, charset: 'utf8', target: 'es2017' }).code.trim();
const include = (src, depth) => (depth > 3 ? src : src.replace(/^\/\* @include ([\w/.-]+) \*\/$/gm, (m, f) => {
  const body = include(rd(path.join(__dirname, f)).trim(), (depth || 0) + 1);
  return depth ? body : compact(body);
}));
function build(ref, title) {
  const [platform, id] = ref.split('/');
  let html;
  if (platform === 'catalogue') { const p = path.join(__dirname, 'catalogue', id + '.js'); delete require.cache[require.resolve(p)]; html = require(p)(); }
  else {
    const eng = ENGINES[platform]; if (!eng) throw new Error('unknown platform ' + platform);
    const cfg = include(rd(path.join(__dirname, platform, id + '.cfg.js')).trim());
    html = eng.assemble(cfg, title || (cfg.match(/title:\s*'([^']+)'/) || [])[1] || id);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, platform + '-' + id + '.html'), html);
  return html;
}
const manifest = (ref) => JSON.parse(fs.readFileSync(path.join(__dirname, ref + '.manifest.json'), 'utf8'));
if (require.main === module) { const h = build(process.argv[2]); console.log('built', process.argv[2], h.length, 'bytes'); }
module.exports = build; module.exports.manifest = manifest;

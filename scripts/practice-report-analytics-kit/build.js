// node build.js <ref>  -> out/<ref-with-dashes>.html
// Every report here is a plain standalone document (catalogue/<id>.js or reports/<id>.js), each exporting
// a () => html function, not built on any one platform's report kit — these are inherently cross-platform
// (one table mixes Xero, MYOB and QuickBooks clients), so there is no single platform chrome to reuse.
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'out');
function build(ref) {
  const p = path.join(__dirname, ref + '.js');
  delete require.cache[require.resolve(p)];
  const html = require(p)();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, ref.replace('/', '-') + '.html'), html);
  return html;
}
const manifest = (ref) => JSON.parse(fs.readFileSync(path.join(__dirname, ref + '.manifest.json'), 'utf8'));
if (require.main === module) { const h = build(process.argv[2]); console.log('built', process.argv[2], h.length, 'bytes'); }
module.exports = build; module.exports.manifest = manifest;

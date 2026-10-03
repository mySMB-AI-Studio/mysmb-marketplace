// out/catalogue.html = catalogue.template.html + qb.css + catalogue.data.json
const fs = require('fs'), path = require('path'), D = process.env.KIT_DIR || __dirname;
function buildCatalogue() {
  const tpl = fs.readFileSync(path.join(D, 'reports', 'catalogue.template.html'), 'utf8'), css = fs.readFileSync(path.join(D, 'qb.css'), 'utf8').trim();
  const data = fs.readFileSync(path.join(D, 'reports', 'catalogue.data.json'), 'utf8').trim().replace(/</g, '\\u003c');
  return tpl.replace('{{CSS}}', () => css).replace('{{DATA}}', () => data);
}
if (require.main === module) { fs.mkdirSync(path.join(D, 'out'), { recursive: true }); const h = buildCatalogue(); fs.writeFileSync(path.join(D, 'out', 'catalogue.html'), h); console.log('catalogue', h.length); }
module.exports = buildCatalogue;

// Rebuild kit/css/skeleton/manifests/configs FROM the generated skill markdown, into $OUT — the agent's view of the world.
const fs = require('fs'), path = require('path');
const [skillsDir, OUT] = process.argv.slice(2), FAM = require('./families.js');
const blocks = (md) => { const out = []; md.replace(/\r\n/g, '\n').replace(/```(\w+)\n([\s\S]*?)\n```/g, (_, lang, body) => out.push({ lang, body })); return out; };
fs.mkdirSync(path.join(OUT, 'reports'), { recursive: true });
const fnd = blocks(fs.readFileSync(path.join(skillsDir, 'quickbooks-report-foundation.md'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'skeleton.html'), fnd.find((b) => b.lang === 'html').body + '\n');
fs.writeFileSync(path.join(OUT, 'qb.css'), fnd.find((b) => b.lang === 'css').body + '\n');
fs.writeFileSync(path.join(OUT, 'qb-kit.js'), fnd.filter((b) => b.lang === 'js').pop().body + '\n');
FAM.filter((f) => f.static && f.static !== 'guide' && f.static !== 'doc').forEach((f) => { const b = blocks(fs.readFileSync(path.join(skillsDir, f.skill + '.md'), 'utf8')); fs.mkdirSync(path.join(OUT, 'out'), { recursive: true }); fs.writeFileSync(path.join(OUT, 'out', f.id + (f.static === 'export' ? '.template.html' : '.html')), b.find((x) => x.lang === 'html').body + '\n'); });
FAM.filter((f) => !f.static).forEach((f) => { const b = blocks(fs.readFileSync(path.join(skillsDir, f.skill + '.md'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'reports', f.id + '.manifest.json'), b.find((x) => x.lang === 'json').body + '\n');
  fs.writeFileSync(path.join(OUT, 'reports', f.id + '.cfg.js'), b.filter((x) => x.lang === 'js').pop().body + '\n'); });
console.log('extracted', FAM.length, 'families to', OUT);

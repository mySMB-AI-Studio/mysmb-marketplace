// node extract-skills.js <skills dir> <out dir> — rebuild kit / css / skeleton / manifests / configs FROM the generated skill
// markdown (the agent's view), so the tests can run against exactly what the agent will copy.
const fs = require('fs'), path = require('path');
const [skillsDir, OUT] = process.argv.slice(2), FAM = require('./families.js');
const blocks = (md) => { const out = []; md.replace(/\r\n/g, '\n').replace(/```(\w+)\n([\s\S]*?)\n```/g, (_, lang, body) => out.push({ lang, body })); return out; };
fs.mkdirSync(path.join(OUT, 'reports'), { recursive: true });
const fnd = blocks(fs.readFileSync(path.join(skillsDir, 'myob-report-foundation.md'), 'utf8'));
const pick = (lang) => { const b = fnd.find((x) => x.lang === lang); if (!b) throw new Error('foundation has no ' + lang + ' block'); return b.body; };
fs.writeFileSync(path.join(OUT, 'skeleton.html'), pick('html') + '\n');
fs.writeFileSync(path.join(OUT, 'mk.css'), pick('css') + '\n');
fs.writeFileSync(path.join(OUT, 'mk-kit.js'), pick('js') + '\nif (typeof module !== \'undefined\') module.exports = MK;\n');
FAM.forEach((f) => {
  const b = blocks(fs.readFileSync(path.join(skillsDir, f.skill + '.md'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'reports', f.report + '.manifest.json'), b.find((x) => x.lang === 'json').body + '\n');
  fs.writeFileSync(path.join(OUT, 'reports', f.report + '.cfg.js'), b.find((x) => x.lang === 'js').body + '\n');
});
console.log('extracted', FAM.length, 'kit reports to', OUT);

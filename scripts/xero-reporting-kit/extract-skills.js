// node extract-skills.js <skills dir> <out dir> — rebuild every report's document, manifest and config FROM the generated
// skill markdown (the agent's view), so the tests can run against exactly what the agent will copy.
const fs = require('fs'), path = require('path');
const [skillsDir, OUT] = process.argv.slice(2), FAM = require('./families.js');
const blocks = (md) => { const out = []; md.replace(/\r\n/g, '\n').replace(/```(\w+)\n([\s\S]*?)\n```/g, (_, lang, body) => out.push({ lang, body })); return out; };
fs.mkdirSync(path.join(OUT, 'reports'), { recursive: true });
FAM.forEach((f) => {
  const b = blocks(fs.readFileSync(path.join(skillsDir, f.skill + '.md'), 'utf8'));
  const one = (lang) => { const x = b.filter((y) => y.lang === lang); if (x.length !== 1) throw new Error(f.skill + ' has ' + x.length + ' ' + lang + ' blocks (expected 1)'); return x[0].body; };
  const doc = one('html'), scripts = [...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  fs.writeFileSync(path.join(OUT, 'reports', f.report + '.manifest.json'), one('json') + '\n');
  fs.writeFileSync(path.join(OUT, 'reports', f.report + '.doc.html'), doc + '\n');
  fs.writeFileSync(path.join(OUT, 'reports', f.report + '.cfg.js'), scripts[scripts.length - 1] + '\n'); // the config is the last script
});
console.log('extracted', FAM.length, 'kit reports to', OUT);

// The three platform report kits this kit builds on. Each CRA report is a document of ONE platform's kit (the engines,
// stylesheets and skeletons stay in their own folders and are read here, never copied), so a Client Report Analytics
// report behaves exactly like that platform's library reports: same controls, client picker (LIB-002), checks banner,
// Excel/PDF, snapshot mode, branding. The house style defaults to mySMB (Branding tab of the Prompt Library v1.1).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const stripModule = (s) => s.replace(/\nif \(typeof module[^\n]*\n?$/, '\n').trim();

// FNV-1a over the kit + the config from `render: function` on, whitespace removed: the same sum the Xero skeleton checks.
function fnv(x) { let h = 2166136261; for (let j = 0; j < x.length; j++) { h ^= x.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }

const ENGINES = {
  xero: {
    dir: path.join(ROOT, 'xero-reporting-kit'), prefix: 'xk', today: '2026-09-25', clock: [2026, 8, 25, 10, 52],
    assemble(cfg, title) {
      const { reportKit } = require(path.join(this.dir, 'kit-prune.js'));
      const kit = reportKit(cfg), r = cfg.indexOf('render: function');
      const sum = fnv((kit + (r >= 0 ? cfg.slice(r) : cfg)).replace(/\s+/g, ''));
      return rd(path.join(this.dir, 'skeleton.html')).trim().replace('{{TITLE}}', title).replace('{{CSS}}', () => rd(path.join(this.dir, 'xk.css')).trim())
        .replace('{{KIT}}', () => kit).replace('{{CFG}}', () => cfg).replace('{{SUM}}', sum) + '\n';
    }
  },
  myob: {
    dir: path.join(ROOT, 'myob-reporting-kit'), prefix: 'mk', today: '2026-09-28', clock: [2026, 8, 28, 10, 52],
    assemble(cfg, title) {
      return rd(path.join(this.dir, 'skeleton.html')).replace('{{TITLE}}', title).replace('{{CSS}}', () => rd(path.join(this.dir, 'mk.css')).trim())
        .replace('{{KIT}}', () => stripModule(rd(path.join(this.dir, 'mk-kit.js')))).replace('{{CFG}}', () => cfg);
    }
  },
  quickbooks: {
    dir: path.join(ROOT, 'quickbooks-reporting-kit'), prefix: 'qb', today: '2026-09-25', clock: [2026, 8, 25, 10, 52],
    assemble(cfg, title) {
      return rd(path.join(this.dir, 'skeleton.html')).replace('{{TITLE}}', title).replace('{{CSS}}', () => rd(path.join(this.dir, 'qb.css')).trim())
        .replace('{{KIT}}', () => stripModule(rd(path.join(this.dir, 'qb-kit.js')))).replace('{{CFG}}', () => cfg);
    }
  }
};
module.exports = { ENGINES, rd, fnv };

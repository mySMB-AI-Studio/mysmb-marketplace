// Overview skills share the family config; only the opening view (display.v) and title differ.
const fs = require('fs'), p = __dirname + '/reports/';
[['inventory', 'inventory-overview', 'valuation', 'overview', 'Inventory Valuation Summary', 'Inventory overview'], ['projects', 'projects-overview', 'profitability', 'overview', 'Project Profitability Summary', 'Projects overview']].forEach(([src, dst, v0, v1, t0, t1]) => {
  let s = fs.readFileSync(p + src + '.cfg.js', 'utf8'); const n = s.split('"v":"' + v0 + '"').length - 1; if (n !== 1) throw new Error(src + ' view marker count ' + n);
  s = s.replace('"v":"' + v0 + '"', '"v":"' + v1 + '"').replace("title: '" + t0 + "'", "title: '" + t1 + "'"); fs.writeFileSync(p + dst + '.cfg.js', s); console.log('variant', dst);
});

// Builds the live reports catalogue (Q02): reports/catalogue.data.json, reports/catalogue.manifest.json and reports/catalogue.cfg.js.
// Status comes from families.js (built skills), wave and Q-ID from the library Index tab, category + description from catalogue-cards.js.
const fs = require('fs'), path = require('path');
const idx = fs.readFileSync(process.argv[2] || 'C:/tmp/rl/QB_v1.1/Index.txt', 'utf8').split(/\r?\n/).filter((l) => /^\[\d+\] \d+ \|/.test(l));
const FAM = require('./families.js'), CARDS = require('./catalogue-cards.js'), built = { Q38: 'quickbooks-report-foundation', Q39: 'quickbooks-report-foundation' };
FAM.forEach((f) => { built[f.q] = f.skill; });
const rows = idx.map((l) => {
  const c = l.replace(/^\[\d+\] /, '').split(' | '), qi = c.findIndex((x) => /^Q\d\d$/.test(x)), after = c.slice(qi);
  return { q: after[0], family: c[2], type: after[1], users: after[2], priority: after[3], wave: +after[4], skill: built[after[0]] || null };
});
fs.writeFileSync(path.join(__dirname, 'reports', 'catalogue.data.json'), JSON.stringify(rows));
const missing = rows.filter((r) => !CARDS.cards[r.q]).map((r) => r.q);
if (missing.length) throw new Error('catalogue-cards.js has no card for: ' + missing.join(', '));
const order = (q) => CARDS.categories.indexOf(CARDS.cards[q][0]) * 100 + Object.keys(CARDS.cards).indexOf(q);
const cards = rows.slice().sort((a, b) => order(a.q) - order(b.q)).map((r) => ({ q: r.q, cat: CARDS.cards[r.q][0], name: CARDS.cards[r.q][1], desc: CARDS.cards[r.q][2], live: !!r.skill, wave: r.wave }));
const data = { categories: CARDS.categories, total: rows.length, cards };
const tpl = fs.readFileSync(path.join(__dirname, 'reports', 'catalogue.cfg.template.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'reports', 'catalogue.cfg.js'), tpl.replace('/*CATALOGUE*/null', () => JSON.stringify(data).replace(/</g, '\\u003c')));
fs.writeFileSync(path.join(__dirname, 'reports', 'catalogue.manifest.json'), JSON.stringify({
  inputs: [
    { name: 'persona', label: 'View as', type: 'enum', options: ['Client', 'Bookkeeper', 'Practitioner', 'Executive'], default: 'Client' },
    { name: 'display', label: 'Display settings', type: 'string', maxLength: 300, default: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":0,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' }],
  bindings: [
    { id: 'company_info', tool: { mcp: 'quickbooks-accounting', name: 'qbo_query' }, params: { query: { kind: 'static', value: 'SELECT * FROM CompanyInfo' } } },
    { id: 'prefs', tool: { mcp: 'quickbooks-accounting', name: 'get_preferences' }, params: {} }]
}, null, 2) + '\n');
console.log(rows.length, 'families,', cards.filter((x) => x.live).length, 'live; categories:', [...new Set(cards.map((x) => x.cat))].length);

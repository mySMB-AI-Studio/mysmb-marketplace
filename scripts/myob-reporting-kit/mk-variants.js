// node mk-variants.js — report skills that are another kit report opening differently: the same config and bindings, with their own
// title and opening defaults. Writes reports/<variant>.cfg.js + .manifest.json from the base report; run before gen-myob.js.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'reports');
const VARIANTS = [
  // Aged receivables (no library prompt; the connector's own ageing) = Unpaid invoices aged by due date
  { id: 'ag', base: 'ar', title: ['Unpaid Invoices', 'Aged Receivables'], inputs: { method: 'Due date' } },
  // Customer sales (M35) = the Sales register's customer view
  { id: 'cs', base: 'sr', title: ['Sales Register', 'Customer Sales'], display: { v: 'customers' } },
];
for (const v of VARIANTS) {
  let cfg = fs.readFileSync(path.join(R, v.base + '.cfg.js'), 'utf8').replace(/\r\n/g, '\n');
  const t = "title: '" + v.title[0] + "'"; if (cfg.split(t).length !== 2) throw new Error(v.base + ': title marker not found'); cfg = cfg.replace(t, "title: '" + v.title[1] + "'");
  const m = JSON.parse(fs.readFileSync(path.join(R, v.base + '.manifest.json'), 'utf8'));
  Object.keys(v.inputs || {}).forEach((k) => { const re = new RegExp("(defaults: \\{[^}]*\\b" + k + ": )'[^']*'"); if (!re.test(cfg)) throw new Error(v.base + ': default ' + k + ' not found'); cfg = cfg.replace(re, "$1'" + v.inputs[k] + "'"); m.inputs.find((i) => i.name === k).default = v.inputs[k]; });
  if (v.display) { const di = m.inputs.find((i) => i.name === 'display'), d = JSON.parse(di.default); Object.assign(d, v.display); const nd = JSON.stringify(d), old = "display: '" + di.default + "'"; if (cfg.split(old).length !== 2) throw new Error(v.base + ': display default not found'); cfg = cfg.replace(old, "display: '" + nd + "'"); di.default = nd; }
  fs.writeFileSync(path.join(R, v.id + '.cfg.js'), cfg);
  fs.writeFileSync(path.join(R, v.id + '.manifest.json'), JSON.stringify(m, null, 2) + '\n');
  console.log('variant', v.id, 'from', v.base);
}

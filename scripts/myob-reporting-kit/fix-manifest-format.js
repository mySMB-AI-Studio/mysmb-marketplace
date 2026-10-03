// Re-format manifests in the house style without touching string values; restore the compact display default.
const fs = require('fs'), path = require('path');
const fmt = (v) => Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : v && typeof v === 'object' ? '{ ' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + fmt(v[k])).join(', ') + ' }' : JSON.stringify(v);
for (const r of process.argv.slice(2)) {
  const f = path.join(__dirname, 'reports', r + '.manifest.json'), m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.inputs.forEach((i) => { if (i.name === 'display') i.default = JSON.stringify(JSON.parse(i.default)); });
  const out = '{\n  "inputs": [\n' + m.inputs.map((i) => '    ' + fmt(i)).join(',\n') + '\n  ],\n  "bindings": [\n' + m.bindings.map((b) => '    ' + fmt(b)).join(',\n') + '\n  ]\n}\n';
  JSON.parse(out); fs.writeFileSync(f, out);
}
console.log('formatted');

// node demo.js <report> [light|dark] -> out/<report>.<theme>.demo.html : report + inline mock MyHubReport backed by fixtures.js
const fs = require('fs'), path = require('path');
const build = require('./build.js');
const name = process.argv[2], theme = process.argv[3] || 'light', brand = process.argv[4] || 'myob';
const FX = { pnl: '{ pnl: F.pnl, pnl_compare: F.pnl, bs_end: F.bs, accounts: F.accounts, company_files: F.companyFiles }',
  bs: '{ bs: F.bs, bs_compare: F.bs, pnl_ytd: F.pnl, pnl_since_prev: F.pnl, accounts: F.accounts, company_files: F.companyFiles }' };
const manifest = fs.readFileSync(path.join(__dirname, 'reports', name + '.manifest.json'), 'utf8');
const fxSrc = fs.readFileSync(path.join(__dirname, 'fixtures.js'), 'utf8');
const mock = `<script>
var module = { exports: {} };
${fxSrc}
var F = module.exports, FX = ${FX[name]};
(function(){
  var M = ${manifest}, TODAY = '2026-09-28';
  function resolve(s){ var o = {}; M.inputs.forEach(function(i){ var v = s && s[i.name] !== undefined ? s[i.name] : i.default; if (i.type==='date' && v==='today') v = TODAY; o[i.name] = v; }); return o; }
  function params(b, inp){ var p = {}; Object.keys(b.params||{}).forEach(function(k){ var v = b.params[k]; p[k] = v.kind==='static' ? v.value : v.kind==='input' ? inp[v.input] : TODAY; }); return p; }
  function one(b, inp){ return FX[b.id](params(b, inp)); }
  window.MyHubReport = { mode:'live', theme:'${theme}', onData:function(f){ var inp = resolve({}), data = {}; M.bindings.forEach(function(b){ data[b.id] = one(b, inp); }); setTimeout(function(){ f({ data: data, errors: {}, fetchedAt: new Date().toISOString() }); }, 20); },
    onRefresh:function(){}, onThemeChange:function(){}, setInputs:function(){},
    getData:function(id, s){ var b = M.bindings.filter(function(x){ return x.id===id; })[0]; return new Promise(function(r){ setTimeout(function(){ r(one(b, resolve(s))); }, 40); }); } };
})();
</script>`;
let html = build(name).replace('<html lang="en-AU">', `<html lang="en-AU" data-myhub-theme="${theme}">`).replace('</head>', mock + '\n</head>');
if (brand !== 'myob') html = html.split('\\"style\\":\\"myob\\"').join('\\"style\\":\\"' + brand + '\\"').split('"style":"myob"').join('"style":"' + brand + '"');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', name + '.' + theme + (brand !== 'myob' ? '.' + brand : '') + '.demo.html'), html);
console.log('demo', name, theme);

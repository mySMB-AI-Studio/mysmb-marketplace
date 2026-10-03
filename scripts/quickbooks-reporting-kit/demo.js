// node demo.js <report> -> out/<report>.demo.html : report + inline mock MyHubReport (live) backed by fixtures.js
const fs = require('fs'), path = require('path');
const build = require('./build.js');
const name = process.argv[2], theme = process.argv[3] || 'light';
const manifest = fs.readFileSync(path.join(__dirname, 'reports', (require('./specs.js')[name].report || name) + '.manifest.json'), 'utf8');
const fxSrc = fs.readFileSync(path.join(__dirname, 'fixtures.js'), 'utf8');
const spec = require('./specs.js')[name];
const map = `var CI = function (F) { return function () { return F.companyInfo; }; }, PR = function (F) { return function () { return F.prefs; }; };
var FX = (${spec.fx.toString()})(F);`;
const mock = `<script>
var module = { exports: {} };
${fxSrc}
var F = module.exports;
${map}
(function(){
  var M = ${manifest}, cbs = [];
  function resolve(s){ var o = {}; M.inputs.forEach(function(i){ var v = s && s[i.name] !== undefined ? s[i.name] : i.default; if (i.type==='date' && v==='today') v = new Date().toISOString().slice(0,10); o[i.name] = v; }); return o; }
  function params(b, inp){ var p = {}; Object.keys(b.params||{}).forEach(function(k){ var v = b.params[k]; p[k] = v.kind==='static' ? v.value : v.kind==='input' ? inp[v.input] : new Date().toISOString().slice(0,10); }); return p; }
  function one(b, inp){ return FX[b.id](params(b, inp)); }
  window.MyHubReport = { mode:'live', theme:'${theme}', onData:function(f){ cbs.push(f); var inp = resolve({}), data = {}; M.bindings.forEach(function(b){ data[b.id] = one(b, inp); }); setTimeout(function(){ f({ data:data, errors:{}, fetchedAt:new Date().toISOString() }); }, 50); },
    onRefresh:function(){}, onThemeChange:function(){}, setInputs:function(){},
    getData:function(id, s){ var b = M.bindings.filter(function(x){ return x.id===id; })[0]; return new Promise(function(r){ setTimeout(function(){ r(one(b, resolve(s))); }, 80); }); } };
})();
</script>`;
const html = build(require('./specs.js')[name].report || name).replace('<html lang="en-AU">', `<html lang="en-AU" data-myhub-theme="${theme}">`).replace('</head>', mock + '\n</head>');
fs.writeFileSync(path.join(__dirname, 'out', name + '.' + theme + '.demo.html'), html);
console.log('demo', name, theme);

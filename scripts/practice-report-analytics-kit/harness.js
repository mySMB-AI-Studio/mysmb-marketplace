// Runs a built report in jsdom against a mock MyHubReport SDK — same contract as the client-report-
// analytics-kit harness (manifest-resolved params, defaults filled, unknown inputs rejected, getData,
// snapshot mode, a pinned clock). `fx` maps binding id -> (params) => tool result (throw for tool_error).
const { JSDOM } = require('jsdom');
const build = require('./build.js');
const TODAY = '2026-10-08';

function resolve(manifest, supplied) {
  const declared = new Map(manifest.inputs.map((i) => [i.name, i]));
  for (const k of Object.keys(supplied || {})) if (!declared.has(k)) throw Object.assign(new Error('unknown input: ' + k), { code: 'invalid_inputs' });
  const out = {};
  for (const i of manifest.inputs) {
    let v = supplied && supplied[i.name] !== undefined ? supplied[i.name] : i.default;
    if (i.type === 'date' && v === 'today') v = TODAY;
    if (i.type === 'enum' && !i.options.includes(v)) throw Object.assign(new Error(`input "${i.name}" must be one of: ${i.options}`), { code: 'invalid_inputs' });
    if (i.type === 'string' && String(v).length > (i.maxLength || 200)) throw Object.assign(new Error(`input "${i.name}" too long`), { code: 'invalid_inputs' });
    out[i.name] = v;
  }
  return out;
}
function params(binding, inputs) {
  const p = {};
  for (const [k, v] of Object.entries(binding.params || {})) p[k] = v.kind === 'static' ? v.value : v.kind === 'input' ? inputs[v.input] : v.source === 'now.date' ? TODAY : null;
  return p;
}
function hydrate(manifest, fx, supplied, calls, fail) {
  const inputs = resolve(manifest, supplied), data = {}, errors = {};
  for (const b of manifest.bindings) {
    const p = params(b, inputs); calls && calls.push({ id: b.id, tool: b.tool.name, params: p });
    if (fail && fail[b.id]) { errors[b.id] = fail[b.id]; continue; }
    try { data[b.id] = fx[b.id](p); } catch (e) { errors[b.id] = { code: 'tool_error', message: e.message }; }
  }
  return { data, errors, fetchedAt: TODAY + 'T02:52:00.000Z' };
}
async function run(ref, manifest, fx, opts) {
  opts = opts || {};
  let html = build(ref).replace('<html lang="en-AU">', '<html lang="en-AU" data-myhub-theme="' + (opts.theme || 'light') + '">');
  if (opts.htmlPatch) html = opts.htmlPatch(html);
  const calls = [], setInputsLog = [], downloads = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.TextEncoder = require('util').TextEncoder; w.Blob = require('buffer').Blob;
      const RD = w.Date, NOW = new RD(2026, 9, 8, 10, 52).getTime();
      w.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
      let cb = null;
      w.MyHubReport = {
        mode: opts.mode || 'live', theme: opts.theme || 'light',
        onData: (f) => { cb = f; }, onRefresh() {}, onThemeChange() {},
        setInputs: (o) => setInputsLog.push(JSON.parse(JSON.stringify(o))),
        getData: (id, supplied) => new Promise((res, rej) => {
          try {
            const b = manifest.bindings.find((x) => x.id === id); if (!b) throw Object.assign(new Error('unknown binding ' + id), { code: 'unknown_binding' });
            const inputs = resolve(manifest, supplied), p = params(b, inputs); calls.push({ id, tool: b.tool.name, params: p, requery: true });
            if (opts.fail && opts.fail[id]) return rej(Object.assign(new Error(opts.fail[id].message), { code: opts.fail[id].code }));
            res(fx[id](p));
          } catch (e) { calls.push({ id, error: e.message }); rej(e); }
        }),
        _deliver: (bundle) => cb && cb(bundle)
      };
      w.print = () => downloads.push({ print: true });
      w.URL.createObjectURL = (blob) => { downloads.push({ blob }); return 'blob:x'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download }); };
    }
  });
  const w = dom.window;
  const errs = []; w.addEventListener('error', (e) => errs.push(e.message));
  const bundle = opts.bundle || hydrate(manifest, fx, opts.snapshotInputs || {}, calls, opts.fail);
  if (opts.bundleInputs) bundle.inputs = resolve(manifest, opts.snapshotInputs || {});
  w.MyHubReport._deliver(bundle);
  await new Promise((r) => setTimeout(r, 30));
  return { w, doc: w.document, calls, setInputsLog, downloads, errs, settle: (ms) => new Promise((r) => setTimeout(r, ms || 30)) };
}
function suite(name) {
  let total = 0, fails = 0;
  const ok = (label, cond, info) => { total++; if (cond) console.log('  ✓ ' + label); else { fails++; console.log('  FAIL ' + label + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
  const done = () => { console.log((fails ? fails + ' FAILED of ' : 'ALL ') + total + ' checks ' + (fails ? '' : 'passed') + ' (' + name + ')'); if (fails) process.exitCode = 1; };
  return { ok, done };
}
module.exports = { run, hydrate, resolve, suite, TODAY };

// Runs a built report in jsdom against a mock MyHubReport SDK that behaves like the host (the same contract as the
// platform kits' harness.js): params resolve from the manifest (static / context / input, defaults filled, unknown
// inputs rejected), the whole bundle hydrates on open, getData re-runs one binding, snapshot mode, a pinned clock.
// `fx` maps binding id → (params) => tool result; throw to make a binding fail with tool_error, or pass opts.fail.
const { JSDOM } = require('jsdom');
const build = require('./build.js');
const { ENGINES } = require('./engines.js');
function engineOf(ref) { return ENGINES[ref.split('/')[0]] || ENGINES.xero; }
function resolve(manifest, supplied, today) {
  const declared = new Map(manifest.inputs.map((i) => [i.name, i]));
  for (const k of Object.keys(supplied || {})) if (!declared.has(k)) throw Object.assign(new Error('unknown input: ' + k), { code: 'invalid_inputs' });
  const out = {};
  for (const i of manifest.inputs) {
    let v = supplied && supplied[i.name] !== undefined ? supplied[i.name] : i.default;
    if (i.type === 'date' && v === 'today') v = today;
    if (i.type === 'enum' && !i.options.includes(v)) throw Object.assign(new Error(`input "${i.name}" must be one of: ${i.options}`), { code: 'invalid_inputs' });
    if (i.type === 'string' && String(v).length > (i.maxLength || 200)) throw Object.assign(new Error(`input "${i.name}" too long`), { code: 'invalid_inputs' });
    if (i.type === 'number' && ((i.min !== undefined && v < i.min) || (i.max !== undefined && v > i.max))) throw Object.assign(new Error(`input "${i.name}" out of range`), { code: 'invalid_inputs' });
    out[i.name] = v;
  }
  return out;
}
function params(binding, inputs, today) {
  const p = {};
  for (const [k, v] of Object.entries(binding.params || {})) p[k] = v.kind === 'static' ? v.value : v.kind === 'input' ? inputs[v.input] : v.source === 'now.date' ? today : null;
  return p;
}
function hydrate(manifest, fx, supplied, calls, fail, today) {
  const inputs = resolve(manifest, supplied, today), data = {}, errors = {};
  for (const b of manifest.bindings) {
    const p = params(b, inputs, today); calls && calls.push({ id: b.id, tool: b.tool.name, params: p });
    if (fail && fail[b.id]) { errors[b.id] = fail[b.id]; continue; }
    try { data[b.id] = fx[b.id](p); } catch (e) { errors[b.id] = { code: 'tool_error', message: e.message }; }
  }
  return { data, errors, fetchedAt: today + 'T02:52:00.000Z' };
}
async function run(ref, manifest, fx, opts) {
  opts = opts || {};
  const eng = engineOf(ref), today = eng.today;
  let html = build(ref).replace('<html lang="en-AU">', '<html lang="en-AU" data-myhub-theme="' + (opts.theme || 'light') + '">');
  if (opts.htmlPatch) html = opts.htmlPatch(html);
  const calls = [], setInputsLog = [], downloads = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.TextEncoder = require('util').TextEncoder; w.Blob = require('buffer').Blob;
      const RD = w.Date, NOW = new RD(...eng.clock).getTime();
      w.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
      let cb = null;
      w.MyHubReport = {
        mode: opts.mode || 'live', theme: opts.theme || 'light',
        onData: (f) => { cb = f; }, onRefresh() {}, onThemeChange() {},
        setInputs: (o) => setInputsLog.push(JSON.parse(JSON.stringify(o))),
        getData: (id, supplied) => new Promise((res, rej) => {
          try {
            const b = manifest.bindings.find((x) => x.id === id); if (!b) throw Object.assign(new Error('unknown binding ' + id), { code: 'unknown_binding' });
            const inputs = resolve(manifest, supplied, today), p = params(b, inputs, today); calls.push({ id, tool: b.tool.name, params: p, requery: true });
            if (opts.fail && opts.fail[id]) return rej(Object.assign(new Error(opts.fail[id].message), { code: opts.fail[id].code }));
            res(fx[id](p));
          } catch (e) { calls.push({ id, error: e.message }); rej(e); }
        }),
        _deliver: (bundle) => cb && cb(bundle)
      };
      w.print = () => downloads.push({ print: true });
      w.open = (url) => { downloads.push({ open: url }); return null; };
      w.URL.createObjectURL = (blob) => { downloads.push({ blob }); return 'blob:x'; };
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, href: this.href }); };
    }
  });
  const w = dom.window;
  const errs = []; w.addEventListener('error', (e) => errs.push(e.message));
  const bundle = opts.bundle || hydrate(manifest, fx, opts.snapshotInputs || {}, calls, opts.fail, today);
  if (opts.bundleInputs) bundle.inputs = resolve(manifest, opts.snapshotInputs || {}, today);
  w.MyHubReport._deliver(bundle);
  await new Promise((r) => setTimeout(r, 30));
  return { w, doc: w.document, calls, setInputsLog, downloads, errs, settle: (ms) => new Promise((r) => setTimeout(r, ms || 30)) };
}
// A tiny assertion helper every test file shares.
function suite(name) {
  let total = 0, fails = 0;
  const ok = (label, cond, info) => { total++; if (cond) console.log('  ✓ ' + label); else { fails++; console.log('  FAIL ' + label + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
  const done = () => { console.log((fails ? fails + ' FAILED of ' : 'ALL ') + total + ' checks ' + (fails ? '' : 'passed') + ' (' + name + ')'); if (fails) process.exitCode = 1; };
  return { ok, done };
}
module.exports = { run, hydrate, resolve, suite };

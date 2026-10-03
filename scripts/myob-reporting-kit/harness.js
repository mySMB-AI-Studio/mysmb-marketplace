// Runs a built report in jsdom against a mock MyHubReport SDK that behaves like the host:
// resolves binding params from the manifest (static / context / input, defaults filled, unknown inputs rejected).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const build = require('./build.js');
function resolve(manifest, supplied) {
  const declared = new Map(manifest.inputs.map((i) => [i.name, i]));
  for (const k of Object.keys(supplied || {})) if (!declared.has(k)) throw Object.assign(new Error('unknown input: ' + k), { code: 'invalid_inputs' });
  const out = {};
  for (const i of manifest.inputs) {
    let v = supplied && supplied[i.name] !== undefined ? supplied[i.name] : i.default;
    if (i.type === 'date' && v === 'today') v = '2026-09-28';
    if (i.type === 'enum' && !i.options.includes(v)) throw Object.assign(new Error(`input "${i.name}" must be one of: ${i.options}`), { code: 'invalid_inputs' });
    if (i.type === 'string' && String(v).length > (i.maxLength || 200)) throw Object.assign(new Error(`input "${i.name}" too long`), { code: 'invalid_inputs' });
    out[i.name] = v;
  }
  return out;
}
function params(binding, inputs) {
  const p = {};
  for (const [k, v] of Object.entries(binding.params || {})) p[k] = v.kind === 'static' ? v.value : v.kind === 'input' ? inputs[v.input] : v.source === 'now.date' ? '2026-09-28' : null;
  return p;
}
function hydrate(manifest, fx, supplied, calls, fail) {
  const inputs = resolve(manifest, supplied), data = {}, errors = {};
  for (const b of manifest.bindings) {
    const p = params(b, inputs); calls && calls.push({ id: b.id, tool: b.tool.name, params: p });
    if (fail && fail[b.id]) { errors[b.id] = fail[b.id]; continue; }
    try { data[b.id] = fx[b.id](p); } catch (e) { errors[b.id] = { code: 'tool_error', message: e.message }; }
  }
  return { data, errors, fetchedAt: '2026-09-25T02:52:00.000Z' };
}
async function run(name, manifest, fx, opts) {
  opts = opts || {};
  let html = build(name).replace('<html lang="en-AU">', '<html lang="en-AU" data-myhub-theme="' + (opts.theme || 'light') + '">');
  if (opts.htmlPatch) html = opts.htmlPatch(html);
  const calls = [], setInputsLog = [], downloads = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.TextEncoder = require('util').TextEncoder; w.Blob = require('buffer').Blob;
      // The fixtures are dated around 28 Sep 2026: pin the report's clock there, so rolling presets give the same dates on any day.
      const RD = w.Date, NOW = new RD(2026, 8, 28, 10, 52).getTime();
      w.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
      let cb = null;
      w.MyHubReport = {
        mode: opts.mode || 'live', theme: 'light',
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
  // myHubV2 says which input values a whole bundle ran at (bundle.inputs): a template copy's manifest defaults, a snapshot's inputs.
  if (opts.bundleInputs) bundle.inputs = resolve(manifest, opts.snapshotInputs || {});
  w.MyHubReport._deliver(bundle);
  await new Promise((r) => setTimeout(r, 30));
  return { w, doc: w.document, calls, setInputsLog, downloads, errs, settle: () => new Promise((r) => setTimeout(r, 30)) };
}
module.exports = { run, hydrate, resolve };

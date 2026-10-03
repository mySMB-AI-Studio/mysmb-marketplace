// Generic end-to-end runner for every report config. node test-all.js [name...]
const { run, hydrate } = require('./harness.js');
const F = require('./fixtures.js');
const fs = require('fs'), path = require('path');
const SPECS = require('./specs.js');
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SPECS);
let total = 0, fails = 0;
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
function ok(r, n, c, info) { total++; if (!c) { fails++; console.log('  FAIL', r, '—', n, info === undefined ? '' : String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 500)); } }
(async () => {
  for (const name of names) {
    const spec = SPECS[name], report = spec.report || name, manifest = JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', report + '.manifest.json'), 'utf8'));
    const fx = spec.fx(F), before = fails;
    // manifest sanity: ≤8 inputs, ≤12 bindings, every input param references a declared input
    ok(name, 'manifest limits', manifest.inputs.length <= 8 && manifest.bindings.length <= 12, [manifest.inputs.length, manifest.bindings.length]);
    const declared = new Set(manifest.inputs.map((i) => i.name));
    manifest.bindings.forEach((b) => Object.values(b.params).forEach((p) => { if (p.kind === 'input') ok(name, 'param references declared input ' + p.input, declared.has(p.input)); }));
    manifest.bindings.forEach((b) => ok(name, 'fixture for binding ' + b.id, typeof fx[b.id] === 'function'));
    // 1. live render
    const t = await run(report, manifest, fx);
    ok(name, 'no script errors on load', t.errs.length === 0, t.errs);
    ok(name, 'company in header', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd', text(t.doc, '#qb-head'));
    ok(name, 'banner passes', t.doc.querySelector('#qb-banner').className.includes(spec.bannerNA ? 'na' : 'pass'), text(t.doc, '#qb-banner'));
    ok(name, 'status cleared', text(t.doc, '#qb-status') === '', text(t.doc, '#qb-status'));
    (spec.contains || []).forEach((s) => ok(name, 'body contains ' + s, text(t.doc, 'main').includes(s), text(t.doc, 'main').slice(0, 300)));
    (spec.checks || []).forEach((s) => ok(name, 'validation lists ' + s, text(t.doc, '#qb-banner').includes(s), text(t.doc, '#qb-banner')));
    // 2. exercise every control
    const ids = [...t.doc.querySelectorAll('#qb-controls select:not([disabled]), #qb-controls input[type=date]:not([disabled])')].map((e) => e.id).filter((id) => id && id !== 'qb-client');
    for (const id of ids) {
      const el = t.doc.getElementById(id); if (!el) continue;
      if (el.tagName === 'SELECT') { const opts = [...el.options].map((o) => o.value).filter((v) => v !== el.value); if (!opts.length) continue; el.value = opts[opts.length > 1 ? 1 : 0]; }
      else el.value = '2026-06-30';
      el.dispatchEvent(new t.w.Event('change')); await t.settle();
      ok(name, 'control ' + id + ' no errors', t.errs.length === 0, t.errs);
      ok(name, 'control ' + id + ' still renders', text(t.doc, '#qb-body').length > 20);
    }
    for (const bc of spec.bodyControls || []) {
      const id = bc.id || bc, needRq = bc.requery !== false, el = t.doc.getElementById(id); ok(name, 'body control ' + id + ' present', !!el); if (!el) continue;
      const n0 = t.calls.length, opts = [...el.options].map((o) => o.value).filter((v) => v !== el.value); el.value = opts[0]; el.dispatchEvent(new t.w.Event('change')); await t.settle();
      if (needRq) ok(name, 'body control ' + id + ' requeries', t.calls.slice(n0).some((c) => c.requery), t.calls.slice(n0)); ok(name, 'body control ' + id + ' no errors', t.errs.length === 0, t.errs);
      ok(name, 'body control ' + id + ' keeps selection', (t.doc.getElementById(id) || {}).value === opts[0]);
    }
    const vsel = t.doc.getElementById('qb-view');
    if (vsel) for (const val of [...vsel.options].map((o) => o.value)) {
      const el = t.doc.getElementById('qb-view'); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle();
      ok(name, 'view ' + val + ' no errors', t.errs.length === 0, t.errs);
      ok(name, 'view ' + val + ' renders', text(t.doc, '#qb-body').length > 20 && !text(t.doc, '#qb-body').includes('could not render'), text(t.doc, '#qb-body').slice(0, 200));
      ok(name, 'view ' + val + ' banner not failing', !t.doc.querySelector('#qb-banner').className.includes('fail'), text(t.doc, '#qb-banner').slice(0, 300));
    }
    const radios = [...t.doc.querySelectorAll('input[name="qb-basis"]')];
    if (radios.length) { const r = radios.find((x) => !x.checked); r.checked = true; r.dispatchEvent(new t.w.Event('change')); await t.settle(); ok(name, 'basis toggle no errors', t.errs.length === 0, t.errs); }
    (spec.after || []).forEach((s) => ok(name, 'after interaction contains ' + s, text(t.doc, 'main').includes(s)));
    const bad = t.calls.filter((c) => c.error); ok(name, 'no invalid getData calls', bad.length === 0, bad);
    // 3. downloads
    t.doc.getElementById('qb-xlsx').click(); await t.settle();
    const blob = t.downloads.find((d) => d.blob);
    ok(name, 'excel exported', !!blob, t.errs);
    if (blob) fs.writeFileSync(path.join(__dirname, 'out', name + '.xlsx'), Buffer.from(await blob.blob.arrayBuffer()));
    ok(name, 'no errors after export', t.errs.length === 0, t.errs);
    // 4. snapshot at non-default inputs
    const snap = await run(report, manifest, fx, { mode: 'snapshot', bundle: hydrate(manifest, fx, spec.snapshotInputs || {}) });
    ok(name, 'snapshot no errors', snap.errs.length === 0, snap.errs);
    ok(name, 'snapshot no requery', snap.calls.filter((c) => c.requery).length === 0);
    if (spec.snapshotPeriod) ok(name, 'snapshot period from data', text(snap.doc, '#qb-head .pe') === spec.snapshotPeriod, text(snap.doc, '#qb-head .pe'));
    ok(name, 'snapshot says frozen', text(snap.doc, '#qb-banner').includes('Snapshot'));
    // 5. needs_connection on the primary binding
    const e = await run(report, manifest, fx, { fail: { [spec.primary]: { code: 'needs_connection', message: 'not connected' } } });
    ok(name, 'needs_connection message', text(e.doc, 'main').includes('Connect QuickBooks'), text(e.doc, 'main').slice(0, 300));
    ok(name, 'needs_connection no script errors', e.errs.length === 0, e.errs);
    // 6. every data binding failure must be visible (red banner or an error in the page) — never a silent zero
    for (const bd of manifest.bindings) {
      if (bd.id === 'company_info' || bd.id === 'prefs') continue;
      const r = await run(report, manifest, fx, { fail: { [bd.id]: { code: 'tool_error', message: 'boom-' + bd.id } } });
      const visible = r.doc.querySelector('#qb-banner').className.includes('fail') || text(r.doc, 'main').includes('boom-' + bd.id) || text(r.doc, 'main').includes('QuickBooks returned an error');
      ok(name, 'failure of ' + bd.id + ' is visible', visible, text(r.doc, '#qb-banner').slice(0, 160));
      ok(name, 'failure of ' + bd.id + ' no script errors', r.errs.length === 0, r.errs);
    }
    console.log((fails === before ? 'PASS ' : 'FAIL ') + name + ' — ' + ids.length + ' controls exercised');
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

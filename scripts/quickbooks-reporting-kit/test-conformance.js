// Report template conformance. node test-conformance.js [name...]
// A template copy (artifact_from_template, or "Use this report" after the reader changes a control) keeps the template's
// document, so its config `defaults` are the template's own, while the MANIFEST defaults carry the copy's inputs — and the host
// hydrates with those. myHubV2 sends the inputs each bundle ran at (bundle.inputs); the kit must take them, or the controls,
// header and every later request would follow the template's defaults instead of the figures on the page.
const { run } = require('./harness.js');
const F = require('./fixtures.js');
const fs = require('fs'), path = require('path');
const SPECS = require('./specs.js');
const FAM = require('./families.js');
const kit = new Set(FAM.filter((f) => !f.static && !f.custom).map((f) => f.id));
const all = Object.keys(SPECS).filter((n) => kit.has(SPECS[n].report || n) && !SPECS[n].report); // one run per report
const names = process.argv.slice(2).length ? process.argv.slice(2) : all;
let total = 0, fails = 0;
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
function ok(r, n, c, info) { total++; if (!c) { fails++; console.log('  FAIL', r, '—', n, info === undefined ? '' : String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)); } }
(async () => {
  for (const name of names) {
    const spec = SPECS[name], report = spec.report || name, before = fails;
    const manifest = JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', report + '.manifest.json'), 'utf8'));
    const persona = manifest.inputs.find((i) => i.name === 'persona'), display = manifest.inputs.find((i) => i.name === 'display');
    const d = JSON.parse(display.default); if (d.p) d.p = 'custom'; if (d.a) d.a = 'custom'; d.cents = d.cents ? 0 : 1;
    const changed = Object.assign({}, spec.snapshotInputs || {}, { persona: persona.options.find((o) => o !== persona.default), display: JSON.stringify(d) });
    const copy = JSON.parse(JSON.stringify(manifest)); copy.inputs.forEach((i) => { if (i.name in changed) i.default = changed[i.name]; });
    const t = await run(report, copy, spec.fx(F), { bundleInputs: true });
    ok(name, 'no script errors', t.errs.length === 0, t.errs);
    ok(name, 'View as shows the copy\'s value', (t.doc.getElementById('qb-persona') || {}).value === changed.persona, (t.doc.getElementById('qb-persona') || {}).value);
    const said = t.setInputsLog[0] || {};
    Object.keys(spec.snapshotInputs || {}).forEach((k) => ok(name, 'announces the copy\'s ' + k, said[k] === changed[k], [said[k], changed[k]]));
    const sd = JSON.parse(said.display || '{}');
    ok(name, 'announces the copy\'s display settings', sd.cents === d.cents && (!d.p || sd.p === 'custom'), said.display);
    if (spec.snapshotPeriod) ok(name, 'header shows the copy\'s period', text(t.doc, '#qb-head .pe') === spec.snapshotPeriod, text(t.doc, '#qb-head .pe'));
    const dated = manifest.inputs.filter((i) => i.type === 'date').map((i) => i.name);
    const stray = t.calls.filter((c) => c.requery && Object.keys(spec.snapshotInputs || {}).some((k) => dated.includes(k) && manifest.bindings.find((b) => b.id === c.id) && Object.values(manifest.bindings.find((b) => b.id === c.id).params).some((p) => p.kind === 'input' && p.input === k) && Object.values(c.params).includes(manifest.inputs.find((i) => i.name === k).default)));
    ok(name, 'no request at the template\'s own dates', stray.length === 0, stray);
    ok(name, 'banner not failing', !t.doc.querySelector('#qb-banner').className.includes('fail'), text(t.doc, '#qb-banner').slice(0, 300));
    console.log((fails === before ? 'PASS ' : 'FAIL ') + name);
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

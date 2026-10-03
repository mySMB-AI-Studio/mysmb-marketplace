// Report template conformance, on every kit report. node test-conformance.js [report]
// A template copy (artifact_from_template, or "Use this report") keeps the template's document, so its config `defaults` are the
// template's own, while the MANIFEST defaults carry the copy's inputs — and the host hydrates with those. myHubV2 sends the inputs
// each bundle ran at (bundle.inputs); the kit must take them, or the controls, header and every later request would follow the
// template's defaults instead of the figures on the page.
const { run } = require('./harness.js'); const F = require('./fixtures.js'); const fs = require('fs'), path = require('path');
const FAM = require('./families.js');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } };
// every tool a kit report binds → the fixture's answer for it
const TOOL = { get_profit_and_loss_3m: F.pnl, get_balance_sheet: F.bs, list_accounts: F.accounts, list_company_files: F.companyFiles };
const fixtures = (m) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no fixture for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return f; };
// a copy's inputs that differ from the template's: other dates, and display settings that do not roll the dates back
const COPY = { pnl: { from_date: '2026-08-01', to_date: '2026-08-31', head: /August 2026/ }, bs: { as_at: '2026-08-31', head: /31 August 2026/ } };
(async () => {
  for (const f of FAM) {
    if (only && only !== f.report) continue;
    const m = man(f.report), want = COPY[f.report]; if (!want) { ok(f.report + ': has a template-copy case in this test', false); continue; }
    const disp = m.inputs.find((i) => i.name === 'display'), d = JSON.parse(disp.default); if (d.p) d.p = 'custom'; if (d.a) d.a = 'custom'; d.cents = d.cents ? 0 : 1;
    const changed = Object.assign({}, want, { display: JSON.stringify(d) }); delete changed.head;
    const copy = JSON.parse(JSON.stringify(m)); copy.inputs.forEach((i) => { if (i.name in changed) i.default = changed[i.name]; });
    const t = await run(f.report, copy, fixtures(copy), { bundleInputs: true }); await new Promise((r) => setTimeout(r, 60));
    const said = t.setInputsLog[0] || {}, sd = JSON.parse(said.display || '{}');
    ok(f.report + ': no script errors', t.errs.length === 0, t.errs);
    Object.keys(want).filter((k) => k !== 'head').forEach((k) => ok(f.report + ': announces the copy\'s ' + k, said[k] === want[k], [said[k], want[k]]));
    ok(f.report + ': announces the copy\'s display settings', sd.cents === d.cents, said.display);
    ok(f.report + ': the header shows the copy\'s period', want.head.test(text(t.doc, 'header')), text(t.doc, 'header').slice(0, 200));
    const dated = m.inputs.filter((i) => i.type === 'date' && i.name in want), stray = t.calls.filter((c) => c.requery && dated.some((i) => Object.values(c.params).includes(m.inputs.find((x) => x.name === i.name).default === 'today' ? '2026-09-28' : m.inputs.find((x) => x.name === i.name).default)));
    ok(f.report + ': no request at the template\'s own dates', stray.length === 0, stray);
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

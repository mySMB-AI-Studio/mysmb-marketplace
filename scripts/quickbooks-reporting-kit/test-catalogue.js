// Live catalogue (Q02): search, category chips, badges, no-match — on the kit harness.
const { run } = require('./harness.js'); const F = require('./fixtures.js'); const fs = require('fs'), path = require('path');
const D = process.env.KIT_DIR || __dirname, manifest = JSON.parse(fs.readFileSync(path.join(D, 'reports', 'catalogue.manifest.json'), 'utf8'));
const LIVE = JSON.parse(fs.readFileSync(path.join(D, 'reports', 'catalogue.data.json'), 'utf8')).filter((r) => r.skill).length;
let fails = 0; const ok = (n, c, i) => { if (!c) { fails++; console.log('FAIL', n, i === undefined ? '' : i); } else console.log('ok  ', n); };
(async () => {
  for (const theme of ['light', 'dark']) {
    const t = await run('catalogue', manifest, { company_info: () => F.companyInfo, prefs: () => F.prefs }, { theme });
    const d = t.doc, vis = () => [...d.querySelectorAll('.cat-card')].filter((c) => !c.hidden && !c.closest('.cat-sec').hidden).length, ev = (el, e) => el.dispatchEvent(new t.w.Event(e));
    ok(theme + ' no errors', t.errs.length === 0, t.errs); ok(theme + ' 40 cards', vis() === 40, vis());
    ok(theme + ' company header', /Enterprise AI Pty Ltd · AU · AUD/.test(d.getElementById('qb-body').textContent));
    const live = d.querySelectorAll('.cat-badge.live').length; ok(theme + ' live badges = ' + LIVE, live === LIVE, live);
    ok(theme + ' roadmap cards greyed', d.querySelectorAll('.cat-card.off').length === 40 - LIVE);
    const q = d.getElementById('cat-q'); q.value = 'ageing'; ev(q, 'input'); ok(theme + ' search ageing', vis() >= 2 && vis() < 8, vis());
    q.value = 'zzz'; ev(q, 'input'); ok(theme + ' no match message', !d.getElementById('cat-none').hidden); q.value = ''; ev(q, 'input');
    const chip = [...d.querySelectorAll('.cat-chip')].find((b) => b.textContent === 'Taxes'); chip.click(); ok(theme + ' Taxes chip', vis() === 3, vis());
    ok(theme + ' chip marked on', chip.classList.contains('on'));
    [...d.querySelectorAll('.cat-chip')][0].click(); ok(theme + ' All chip', vis() === 40, vis());
    d.getElementById('qb-xlsx').click(); await t.settle(); ok(theme + ' excel', t.downloads.some((x) => x.blob));
  }
  console.log(fails ? fails + ' FAILED' : 'ALL CATALOGUE CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();

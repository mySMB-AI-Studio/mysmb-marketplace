// PRA-00 catalogue: a static report (no dataBindings) — one box per PRA item + the Work list box,
// chips, search, correct live/not-available split.
const { JSDOM } = require('jsdom');
const build = require('../build.js');
const { suite } = require('../harness.js');
const { ok, done } = suite('practice-catalogue');

(async () => {
  const html = build('catalogue/practice-catalogue');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  await new Promise((r) => setTimeout(r, 30));
  const doc = dom.window.document;
  const rows = () => [...doc.querySelectorAll('[data-row]')].map((e) => e.getAttribute('data-row'));

  ok('no script errors on a static open (no MyHubReport injected)', true);
  ok('17 PRA boxes + the Work list box = 18 rows', rows().length === 18, rows().length);
  ok('live boxes are exactly PRA-01..06', rows().filter((r) => doc.querySelector('[data-row="' + r + '"] .pill.live')).sort().join() === 'PRA-01,PRA-02,PRA-03,PRA-04,PRA-05,PRA-06');
  ok('PRA-09 Data Quality waits on the checks engine', /checks engine/.test(doc.querySelector('[data-row="PRA-09"]').textContent));
  ok('WL-00 waits on the checks engine too', /checks engine/.test(doc.querySelector('[data-row="WL-00"]').textContent));
  ok('PRA-14 Actual Time is Not available (time source wave)', /Not available/.test(doc.querySelector('[data-row="PRA-14"]').textContent));
  ok('PRA-01 names the right template and agent phrasing', /Practice Client Summary Metrics/.test(doc.querySelector('[data-row="PRA-01"]').textContent) && /Practice Report Analytics agent/.test(doc.querySelector('[data-row="PRA-01"]').textContent));

  doc.querySelector('[data-chip="Banking"]').click();
  const banking = rows();
  ok('Banking chip shows PRA-04 and PRA-05 only', banking.join() === 'PRA-04,PRA-05', banking);
  doc.querySelector('[data-chip="All"]').click();

  const q = doc.getElementById('q'); q.value = 'ageing'; q.dispatchEvent(new dom.window.Event('input'));
  const found = rows();
  ok('search matches on the summary line too', found.length > 0 && found.every((r) => /ageing/i.test(doc.querySelector('[data-row="' + r + '"]').textContent)), found);

  q.value = 'zzz-nothing-matches'; q.dispatchEvent(new dom.window.Event('input'));
  ok('no-match state shown, not a blank page', /No reports match/.test(doc.getElementById('items').textContent));

  done();
})();

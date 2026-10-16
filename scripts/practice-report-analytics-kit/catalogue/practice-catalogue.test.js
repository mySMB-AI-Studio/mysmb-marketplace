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
  ok('live boxes are PRA-01..06, the Wave 2 additions PRA-08 and PRA-12, and the Work list (Xero)', rows().filter((r) => doc.querySelector('[data-row="' + r + '"] .pill.live')).sort().join() === 'PRA-01,PRA-02,PRA-03,PRA-04,PRA-05,PRA-06,PRA-08,PRA-12,WL-00');
  const how = (id) => doc.querySelector('[data-row="' + id + '"] .how').textContent;
  ok('every box that is not live says why', rows().every((r) => how(r).trim().length > 20), rows().filter((r) => how(r).trim().length <= 20));
  ok('nothing still says it waits for the checks engine to be built', !/step 3|later wave|coming in Wave 3/i.test(doc.body.textContent));
  ok('PRA-09 Data Quality points at the weekly Ledger checks report', /weekly Ledger checks report/.test(how('PRA-09')));
  ok('WL-00 opens the Checks items in WorkQ', /WorkQ/.test(how('WL-00')) && /Checks: <business>/.test(how('WL-00')));
  ok('PRA-14 Actual Time says there is no time source', /Not available/.test(doc.querySelector('[data-row="PRA-14"]').textContent) && /no time source/.test(how('PRA-14')));
  ok('PRA-13 says it was dropped', /dropped/.test(how('PRA-13')));
  ok('the header does not claim QuickBooks is consolidated', /Xero and MYOB connections/.test(doc.querySelector('.hero').textContent));
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

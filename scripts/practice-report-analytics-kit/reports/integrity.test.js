// The two integrity checks every practice table carries (practice-table-kit.js), on the Client Summary report:
// "Practice total = Σ clients" compares the footer with the connectors' own totals (not the rows the page summed), and
// "No cross-client data leakage" fails on a duplicate row, a row with no platform or id, or a row outside the client
// selection the bundle ran at (bundle.inputs.clients, which the platform sends with every bundle).
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('integrity');
const REF = 'reports/client-summary', man = manifest(REF);

const row = (id, name, contacts) => ({ id, name, contactsCount: contacts, accountsCount: 10, invoicesCount: 5, billsCount: 3, employeesCount: 1, bankAccountsCount: 1, connectionStatus: 'connected' });
const env = (clients, totals) => () => ({ asOf: '2026-10-08T02:00:00.000Z', clients, errors: [], totals, truncated: false });
const sumOf = (rs) => ({ contactsCount: rs.reduce((s, r) => s + r.contactsCount, 0), accountsCount: rs.length * 10, invoicesCount: rs.length * 5, billsCount: rs.length * 3, employeesCount: rs.length, bankAccountsCount: rs.length });
const X = [row('xt-1', 'Northside Plumbing', 42), row('xt-2', 'Southgate Services', 11)], M = [row('cf-1', 'Harbour Cafe', 20)];
const text = (t, sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
const line = (t, name) => { const li = [...t.doc.querySelectorAll('#banner li')].find((e) => e.textContent.indexOf(name) >= 0); return li ? li.textContent : ''; };

(async () => {
  // 1. totals agree with the connectors' own totals
  let t = await run(REF, man, { xero: env(X, sumOf(X)), myob: env(M, sumOf(M)) });
  ok('no script errors', !t.errs.length, t.errs);
  ok('Σ check passes against the connectors\' totals', /^✓ Practice total = Σ clients/.test(line(t, 'Practice total')) && /6 column total\(s\) match/.test(line(t, 'Practice total')), line(t, 'Practice total'));
  ok('leakage check passes with no selection', /^✓ No cross-client data leakage/.test(line(t, 'leakage')) && /distinct client/.test(line(t, 'leakage')), line(t, 'leakage'));

  // 2. a connector total that disagrees with the rows fails the check, naming the column
  t = await run(REF, man, { xero: env(X, Object.assign(sumOf(X), { contactsCount: 99 })), myob: env(M, sumOf(M)) });
  ok('Σ check fails when the rows don\'t add up to the connector\'s total', /^✗ Practice total/.test(line(t, 'Practice total')) && /Contacts: 73 shown, 119 from the connectors/.test(line(t, 'Practice total')), line(t, 'Practice total'));
  ok('banner shows the failure', /1 check failed/.test(text(t, '#banner')));

  // 3. a filtered view is information only
  t = await run(REF, man, { xero: env(X, sumOf(X)), myob: env(M, sumOf(M)) });
  const q = t.doc.getElementById('q'); q.value = 'Southgate'; q.dispatchEvent(new t.w.Event('input'));
  ok('Σ check is information only on a filtered view', /^ℹ Practice total/.test(line(t, 'Practice total')) && /Filtered view/.test(line(t, 'Practice total')), line(t, 'Practice total'));

  // 4. no connector totals (older tool) = information, never a pass
  t = await run(REF, man, { xero: env(X, {}), myob: env(M, {}) });
  ok('no connector totals = information only', /^ℹ Practice total/.test(line(t, 'Practice total')) && /no totals/.test(line(t, 'Practice total')), line(t, 'Practice total'));

  // 5. a client returned twice fails the leakage check
  t = await run(REF, man, { xero: env([X[0], X[0], X[1]], sumOf([X[0], X[0], X[1]])), myob: env(M, sumOf(M)) });
  ok('a duplicate client row fails the leakage check', /^✗ No cross-client data leakage/.test(line(t, 'leakage')) && /listed twice: Northside Plumbing/.test(line(t, 'leakage')), line(t, 'leakage'));

  // 6. a row outside the selection the bundle ran at fails; the selected clients pass
  t = await run(REF, man, { xero: env(X, sumOf(X)), myob: env(M, sumOf(M)) }, { snapshotInputs: { clients: 'xt-1, cf-1' }, bundleInputs: true });
  ok('a row outside the selected clients fails the leakage check', /^✗ No cross-client data leakage/.test(line(t, 'leakage')) && /not in the selected clients: Southgate Services/.test(line(t, 'leakage')), line(t, 'leakage'));
  t = await run(REF, man, { xero: env([X[0]], sumOf([X[0]])), myob: env(M, sumOf(M)) }, { snapshotInputs: { clients: 'xt-1,cf-1' }, bundleInputs: true });
  ok('only the selected clients = leakage check passes, naming the selection', /^✓ No cross-client data leakage/.test(line(t, 'leakage')) && /one of the 2 selected client/.test(line(t, 'leakage')), line(t, 'leakage'));

  // 7. a row with no client id fails
  t = await run(REF, man, { xero: env([row('', 'Nameless', 1)], sumOf([row('', 'Nameless', 1)])), myob: env(M, sumOf(M)) });
  ok('a row with no client id fails the leakage check', /^✗ No cross-client data leakage/.test(line(t, 'leakage')) && /no platform or client id: Nameless/.test(line(t, 'leakage')), line(t, 'leakage'));

  // 8. what the bundle ran at: footer and banner name the period, the currency rule and the sources
  t = await run(REF, man, { xero: env(X, sumOf(X)), myob: env(M, sumOf(M)) }, { bundleInputs: true });
  ok('footer names the period and the sources', /As at 8 Oct 2026/.test(text(t, '#foot')) && /Sources: Xero get_practice_client_summary, MYOB get_practice_client_summary/.test(text(t, '#foot')), text(t, '#foot'));
  ok('banner states period and currency as information', /^ℹ Period, basis and currency/.test(line(t, 'Period, basis')) && /each client's own currency/.test(line(t, 'Period, basis')), line(t, 'Period, basis'));
  const FO = 'reports/financial-overview', fo = manifest(FO);
  const foRow = (id, name) => ({ id, name, income: 100, expenses: 40, netProfit: 60, bankBalance: 10 });
  t = await run(FO, fo, { xero: env([foRow('xt-1', 'Northside Plumbing')], {}), myob: env([foRow('cf-1', 'Harbour Cafe')], {}) }, { snapshotInputs: { from_date: '2026-07-01', to_date: '2026-09-30', basis: 'Cash' }, bundleInputs: true });
  ok('a dated report names its range and basis, and says the dates are not each client\'s financial year', /1 Jul 2026 – 30 Sep 2026, Cash basis/.test(line(t, 'Period, basis')) && /not each client's financial year/.test(line(t, 'Period, basis')), line(t, 'Period, basis'));

  // 9. Download Excel is a real .xlsx: numbers as numbers, plus Validation and Parameters sheets
  t = await run(REF, man, { xero: env(X, sumOf(X)), myob: env(M, sumOf(M)) }, { snapshotInputs: { clients: 'xt-1,xt-2,cf-1' }, bundleInputs: true });
  t.doc.getElementById('xls').click(); await t.settle();
  const blob = t.downloads.find((d) => d.blob), name = (t.downloads.find((d) => d.name) || {}).name;
  const buf = blob ? Buffer.from(await blob.blob.arrayBuffer()) : Buffer.alloc(0), x = buf.toString('utf8');
  ok('the download is an .xlsx file (a zip)', name === 'practice-client-summary.xlsx' && buf[0] === 0x50 && buf[1] === 0x4b, name);
  ok('three sheets: Practice, Validation, Parameters', /<sheet name="Practice"/.test(x) && /<sheet name="Validation"/.test(x) && /<sheet name="Parameters"/.test(x));
  ok('client figures are stored as numbers, not text', /<c r="C5" s="0"><v>42<\/v><\/c>/.test(x), (x.match(/<c r="C5"[^/]*\/c>/) || [''])[0]);
  ok('the totals row is in the sheet (contacts 73)', /<v>73<\/v>/.test(x));
  ok('Validation sheet lists every check with its result', /No cross-client data leakage/.test(x) && />Pass</.test(x) && /Practice total = Σ clients/.test(x));
  ok('Parameters sheet records the as-at date, the client selection and the sources', /As at<\/t>/.test(x) && /2026-10-08/.test(x) && /3 selected: xt-1, xt-2, cf-1/.test(x) && /get_practice_client_summary/.test(x));
  done();
})();

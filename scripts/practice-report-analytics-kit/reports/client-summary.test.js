// PRA-01 Client Summary Metrics, tested against the aggregate-tool CONTRACT (see
// ../../../practice-agg-brief.md): {asOf, clients:[{id,name,...}], errors:[], totals:{}, truncated}.
// The real tools are built by sibling agents against this same contract; these fixtures stand in for
// them until that lands, and double as the acceptance test for the contract shape itself.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('client-summary');
const REF = 'reports/client-summary', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', contacts: 42, accounts: 68, invoices: 120, bills: 54, employees: 6, bank_accounts: 2 },
    { id: 'xt-2', name: 'Southgate Services Ltd', contacts: 11, accounts: 55, invoices: 30, bills: 18, employees: 2, bank_accounts: 1 }
  ],
  errors: [], totals: {}, truncated: false
});
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [{ id: 'cf-mysmb', name: 'mySMB.com', contacts: 20, accounts: 40, invoices: 15, bills: 9, employees: 4, bank_accounts: 1 }],
  errors: [], totals: {}, truncated: false
});

(async () => {
  // 1. both platforms connected and healthy
  let t = await run(REF, man, { xero: xeroOk, myob: myobOk });
  ok('no script errors', !t.errs.length, t.errs);
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('3 client rows (2 Xero + 1 MYOB)', t.doc.querySelectorAll('tbody tr').length === 3);
  ok('platform badges shown (X and M)', /X/.test(text('tbody')) && /M/.test(text('tbody')));
  ok('totals row sums both platforms (contacts 42+11+20=73)', /73/.test(text('tfoot')));
  ok('QuickBooks note shown, not a missing-data error', /one company per connection/.test(text('#notices')));
  ok('checks banner passes (both platforms loaded, no leakage check present)', /Checks passed/.test(text('#banner')) && /Xero clients loaded/.test(text('#banner')) && /MYOB clients loaded/.test(text('#banner')));

  // 2. sort by a column
  t.doc.querySelector('th[data-k="contacts"]').click();
  let rows = [...t.doc.querySelectorAll('tbody tr td:nth-child(2)')].map((e) => e.textContent);
  ok('ascending sort by contacts (Southgate 11 first)', rows[0] === 'Southgate Services Ltd', rows);
  t.doc.querySelector('th[data-k="contacts"]').click();
  rows = [...t.doc.querySelectorAll('tbody tr td:nth-child(2)')].map((e) => e.textContent);
  ok('descending sort by contacts (Irvine Jackson 42 first)', rows[0] === 'Irvine Jackson Pty Ltd', rows);

  // 3. search
  const q = t.doc.getElementById('q'); q.value = 'Southgate'; q.dispatchEvent(new t.w.Event('input'));
  ok('search narrows to one client', t.doc.querySelectorAll('tbody tr').length === 1);
  ok('totals row recomputes for the filtered set (contacts 11, not 73)', /11/.test(text('tfoot')) && !/73/.test(text('tfoot')));
  q.value = ''; q.dispatchEvent(new t.w.Event('input'));

  // 4. one platform down: the other's clients still render, failure named, no blank page
  t = await run(REF, man, { xero: xeroOk, myob: myobOk }, { fail: { myob: { code: 'needs_connection', message: 'needs' } } });
  ok('Xero rows still show when MYOB is down', t.doc.querySelectorAll('tbody tr').length === 2);
  ok('MYOB connect notice shown', /connect myob/i.test(text('#notices')));
  ok('checks banner: MYOB failed, Xero passed', /1 check failed/.test(text('#banner')) && /MYOB clients loaded/.test(text('#banner')));

  // 5. a client-level error inside the Xero payload doesn't blank the report
  const xeroPartial = () => ({ ...xeroOk(), clients: [xeroOk().clients[0]], errors: [{ id: 'xt-2', name: 'Southgate Services Ltd', message: 'Xero returned 500' }] });
  t = await run(REF, man, { xero: xeroPartial, myob: myobOk });
  ok('the failing client is named in a notice, the healthy one still renders', /Southgate Services Ltd: Xero returned 500/.test(text('#notices')) && t.doc.querySelectorAll('tbody tr').length === 2);

  // 6. truncation is surfaced, not silent
  const xeroTruncated = () => ({ ...xeroOk(), truncated: true, message: 'narrow the client selection' });
  t = await run(REF, man, { xero: xeroTruncated, myob: myobOk });
  ok('truncation notice shown', /first 60 clients/.test(text('#notices')) && /narrow the client selection/.test(text('#notices')));

  // 7. nothing connected
  t = await run(REF, man, {}, { fail: { xero: { code: 'needs_connection', message: 'needs' }, myob: { code: 'needs_connection', message: 'needs' } } });
  ok('nothing connected: no rows, both notices shown, not a crash', t.doc.querySelectorAll('tbody tr').length === 1 && /No clients matched/.test(text('tbody')) && /connect xero/i.test(text('#notices')) && /connect myob/i.test(text('#notices')));

  // 8. downloads + dark theme
  t = await run(REF, man, { xero: xeroOk, myob: myobOk });
  t.doc.getElementById('xls').click(); await t.settle();
  const blob = t.downloads.find((d) => d.blob);
  const x = blob ? Buffer.from(await blob.blob.arrayBuffer()).toString('utf8') : '';
  ok('Excel download contains every client row', x.includes('Irvine Jackson') && x.includes('Southgate') && x.includes('mySMB.com'));
  t.doc.getElementById('pdf').click();
  ok('Download PDF prints', t.downloads.some((d) => d.print));
  t = await run(REF, man, { xero: xeroOk, myob: myobOk }, { theme: 'dark' });
  ok('dark theme stamp honoured, no prefers-color-scheme', t.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && !/prefers-color-scheme/.test(t.doc.documentElement.outerHTML));

  done();
})();

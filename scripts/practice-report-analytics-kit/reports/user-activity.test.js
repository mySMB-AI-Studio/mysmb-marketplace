// PRA-12 User Activity, tested against the EXISTING get_practice_client_summary CONTRACT (no new
// server-side tool — see reports/user-activity.js for why): {asOf, clients:[{id,name,lastSync|lastSync_na,...}], errors:[], totals:{}, truncated}.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('user-activity');
const REF = 'reports/user-activity', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', contactsCount: 42, lastSync: '2026-10-07T09:12:00.000Z', connectionStatus: 'connected' },
    { id: 'xt-2', name: 'Southgate Services Ltd', contactsCount: 11, lastSync_na: "Xero's /connections endpoint did not return an updatedDateUtc for this tenant.", connectionStatus: 'connected' }
  ],
  errors: [], totals: {}, truncated: false
});
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  // MYOB's get_practice_client_summary always sets lastSync_na (no last-sync field in its API).
  clients: [{ id: 'cf-mysmb', name: 'mySMB.com', contactsCount: 20, lastSync_na: "MYOB's company-file discovery (list_company_files) carries no last-sync/last-modified timestamp for a company file.", connectionStatus: 'connected' }],
  errors: [], totals: {}, truncated: false
});

(async () => {
  let t = await run(REF, man, { xero: xeroOk, myob: myobOk });
  ok('no script errors', !t.errs.length, t.errs);
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('3 client rows (2 Xero + 1 MYOB)', t.doc.querySelectorAll('tbody tr').length === 3);
  ok('no Rank column (this report has no rankKey)', !/Rank/.test(text('thead')));
  ok('no heat-strip cells (this report has no heat columns)', ![...t.doc.querySelectorAll('td')].some((td) => /\bheat-[0-4]\b/.test(td.className)));

  const rows = [...t.doc.querySelectorAll('tbody tr')];
  const irvine = rows.find((tr) => tr.textContent.indexOf('Irvine Jackson') >= 0);
  ok('a client with a real lastSync shows the timestamp, not N/A', irvine.textContent.indexOf('2026-10-07') >= 0 && !/N\/A/.test(irvine.querySelector('td:nth-child(3)').textContent));

  const southgate = rows.find((tr) => tr.textContent.indexOf('Southgate') >= 0);
  ok('a Xero client with no updatedDateUtc shows N/A with Xero’s own reason, not a fabricated date', (() => {
    const cell = southgate.querySelector('td:nth-child(3)');
    return /N\/A/.test(cell.textContent) && /did not return an updatedDateUtc/.test(cell.getAttribute('title'));
  })());

  const mysmb = rows.find((tr) => tr.textContent.indexOf('mySMB.com') >= 0);
  ok('MYOB client shows N/A for last-sync with MYOB’s own reason (no such field in its API)', (() => {
    const cell = mysmb.querySelector('td:nth-child(3)');
    return /N\/A/.test(cell.textContent) && /no last-sync/.test(cell.getAttribute('title'));
  })());

  ok('every row shows N/A for "Events by user" and "Edits / deletes" with the staticNA reason, regardless of platform', rows.every((tr) => {
    const cells = tr.querySelectorAll('td');
    const events = cells[3], editsDeletes = cells[4];
    return /N\/A/.test(events.textContent) && /bulk audit-log/.test(events.getAttribute('title')) &&
      /N\/A/.test(editsDeletes.textContent) && /edit\/delete audit trail/.test(editsDeletes.getAttribute('title'));
  }));

  ok('the platform-gap notice is shown once, naming Xero, MYOB and the QuickBooks exclusion', (() => {
    const n = text('#notices');
    return /History & Notes/.test(n) && /AccountRight API has no general audit-log/.test(n) && /PRA-01/.test(n);
  })());
  ok('QuickBooks note shown too, not a missing-data error', /one company per connection/.test(text('#notices')));

  ok('checks banner: no summed column, shown as informational not a failure', /0 check failed|Checks passed/.test(text('#banner')) && /This report has no summed column|for information/.test(text('#banner')));

  // one platform down still renders the other
  t = await run(REF, man, { xero: xeroOk, myob: myobOk }, { fail: { myob: { code: 'needs_connection', message: 'needs' } } });
  ok('Xero rows still show when MYOB is down', t.doc.querySelectorAll('tbody tr').length === 2);
  ok('MYOB connect notice shown', /connect myob/i.test(text('#notices')));

  done();
})();

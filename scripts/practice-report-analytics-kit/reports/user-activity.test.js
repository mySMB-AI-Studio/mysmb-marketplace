// PRA-12 User Activity, tested against the EXISTING get_practice_client_summary CONTRACT (no new
// server-side tool — see reports/user-activity.js for why): {asOf, clients:[{id,name,lastSync|lastSync_na,...}], errors:[], totals:{}, truncated}.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('user-activity');
const REF = 'reports/user-activity', man = manifest(REF);

// Xero side: the organisation list alone (xero-api list_connections). Last synced = each connection's updatedDateUtc;
// no per-organisation calls at all.
const { orgs } = require('../xero-raw.js');
const xeroOk = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', updatedDateUtc: '2026-10-07T09:12:46.7748050', fx: {} },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {} }
]);
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  // MYOB's get_practice_client_summary always sets lastSync_na (no last-sync field in its API).
  clients: [{ id: 'cf-mysmb', name: 'mySMB.com', contactsCount: 20, lastSync_na: "MYOB's company-file discovery (list_company_files) carries no last-sync/last-modified timestamp for a company file.", connectionStatus: 'connected' }],
  errors: [], totals: {}, truncated: false
});

(async () => {
  let t = await run(REF, man, Object.assign(xeroOk(), { myob: myobOk }));
  ok('no script errors', !t.errs.length, t.errs);
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('3 client rows (2 Xero + 1 MYOB)', t.doc.querySelectorAll('tbody tr').length === 3);
  ok('no Rank column (this report has no rankKey)', !/Rank/.test(text('thead')));
  ok('no heat-strip cells (this report has no heat columns)', ![...t.doc.querySelectorAll('td')].some((td) => /\bheat-[0-4]\b/.test(td.className)));

  const rows = [...t.doc.querySelectorAll('tbody tr')];
  const irvine = rows.find((tr) => tr.textContent.indexOf('Irvine Jackson') >= 0);
  ok('a client with a real lastSync shows it as a readable date and time, not raw ISO and not N/A', (() => {
    const text = irvine.querySelector('td:nth-child(3)').textContent;
    return /Oct 2026/.test(text) && !/T09:12|2026-10-07/.test(text) && !/N\/A/.test(text);
  })());

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
  t = await run(REF, man, Object.assign(xeroOk(), { myob: myobOk }), { fail: { myob: { code: 'needs_connection', message: 'needs' } } });
  ok('Xero rows still show when MYOB is down', t.doc.querySelectorAll('tbody tr').length === 2);
  ok('MYOB connect notice shown', /connect myob/i.test(text('#notices')));

  t = await run(REF, man, Object.assign(xeroOk(), { myob: myobOk }));
  ok('no per-organisation Xero calls (the organisation list is enough)', !t.calls.some((c) => c.requery), t.calls.filter((c) => c.requery).map((c) => c.id));

  done();
})();

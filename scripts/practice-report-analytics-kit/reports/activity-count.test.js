// PRA-08 Activity Count, tested against the get_practice_activity_count CONTRACT:
// {asOf, clients:[{id,name,salesCount,purchasesCount,bankingCount,journalsCount,payrollCount|payrollCount_na,totalCount}], errors:[], totals:{}, truncated}.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('activity-count');
const REF = 'reports/activity-count', man = manifest(REF);

// Xero never sources payroll (separate xero-payroll-au connector) — payrollCount_na is always set.
const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', salesCount: 40, purchasesCount: 20, bankingCount: 65, journalsCount: 3, payrollCount_na: 'Payroll transaction counts require the Xero Payroll AU connector, which this agent does not connect.', totalCount: 128 },
    { id: 'xt-2', name: 'Southgate Services Ltd', salesCount: 5, purchasesCount: 2, bankingCount: 8, journalsCount: 0, payrollCount_na: 'Payroll transaction counts require the Xero Payroll AU connector, which this agent does not connect.', totalCount: 15 }
  ],
  errors: [], totals: {}, truncated: false
});
// MYOB sources payroll (listPayrollAdvices lives in the same connector).
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [{ id: 'cf-mysmb', name: 'mySMB.com', salesCount: 12, purchasesCount: 9, bankingCount: 18, journalsCount: 2, payrollCount: 4, totalCount: 45 }],
  errors: [], totals: {}, truncated: false
});

(async () => {
  let t = await run(REF, man, { xero: xeroOk, myob: myobOk });
  ok('no script errors', !t.errs.length, t.errs);
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('3 client rows (2 Xero + 1 MYOB)', t.doc.querySelectorAll('tbody tr').length === 3);
  ok('Rank column header present', /Rank/.test(text('thead')));
  ok('ranked by total activity: Irvine Jackson (128) ranked 1 ahead of mySMB.com (45) ahead of Southgate (15)', (() => {
    const rows = [...t.doc.querySelectorAll('tbody tr')];
    const rankOf = (name) => { const r = rows.find((tr) => tr.textContent.indexOf(name) >= 0); return r ? r.cells[2].textContent.trim() : null; };
    return rankOf('Irvine Jackson Pty Ltd') === '1' && rankOf('mySMB.com') === '2' && rankOf('Southgate Services Ltd') === '3';
  })());
  ok('Xero payroll cells show N/A with the connector-gap reason, not blank or a fabricated count', (() => {
    const rows = [...t.doc.querySelectorAll('tbody tr')];
    const irvine = rows.find((tr) => tr.textContent.indexOf('Irvine Jackson') >= 0);
    const payrollCell = irvine.querySelector('td.muted[title]');
    return !!payrollCell && /N\/A/.test(payrollCell.textContent) && /Xero Payroll AU connector/.test(payrollCell.getAttribute('title'));
  })());
  ok('MYOB payroll cell shows a real sourced count (4), not N/A', (() => {
    const rows = [...t.doc.querySelectorAll('tbody tr')];
    const mysmb = rows.find((tr) => tr.textContent.indexOf('mySMB.com') >= 0);
    const payrollCell = mysmb.cells[7]; // platform, name, rank, sales, purchases, banking, journals, payroll
    return payrollCell.textContent.trim() === '4' && !payrollCell.className.includes('muted');
  })());
  ok('heat-strip classes applied to the count columns (at least one heat-N cell rendered)', [...t.doc.querySelectorAll('td')].some((td) => /\bheat-[0-4]\b/.test(td.className)));
  ok('totals row sums both platforms (sales 40+5+12=57, total 128+15+45=188)', /57/.test(text('tfoot')) && /188/.test(text('tfoot')));
  ok('QuickBooks note shown, not a missing-data error', /one company per connection/.test(text('#notices')));
  ok('no chips (practice table + heat strip has no view filters)', t.doc.getElementById('chips').children.length === 1); // just "All"

  // sort by total still works (generic column sort, independent of rank)
  t.doc.querySelector('th[data-k="total"]').click();
  let rows = [...t.doc.querySelectorAll('tbody tr td:nth-child(2)')].map((e) => e.textContent);
  ok('ascending sort by total (Southgate 15 first)', rows[0] === 'Southgate Services Ltd', rows);

  // one platform down
  t = await run(REF, man, { xero: xeroOk, myob: myobOk }, { fail: { myob: { code: 'needs_connection', message: 'needs' } } });
  ok('Xero rows still show when MYOB is down', t.doc.querySelectorAll('tbody tr').length === 2);
  ok('MYOB connect notice shown', /connect myob/i.test(text('#notices')));

  done();
})();

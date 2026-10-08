// PRA-03 Purchases Summary Metrics: report-specific correctness on top of the kit behaviour already
// proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('purchases-summary');
const REF = 'reports/purchases-summary', man = manifest(REF);

// Real field names (confirmed against both agents' source 2026-10-08): identical on both platforms.
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'cf-1', name: 'mySMB.com', outstandingAmount: 6000, outstandingCount: 5, overdueAmount: 1200, overdueCount: 1, dpo: 35, bankPayments: 18000, supplierCount: 9 },
    { id: 'cf-2', name: 'Demo Pty Ltd', outstandingAmount: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0, dpo: 20, bankPayments: 4000, supplierCount: 3 }
  ],
  errors: [], totals: {}, truncated: false
});
const xeroEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, { xero: xeroEmpty, myob: myobOk });
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both MYOB clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  const tfoot = text('tfoot');
  ok('totals row: outstanding $6,000, count 5, overdue $1,200, count 1, payments $22,000', tfoot === 'Total (2 clients)$6,000.005$1,200.001$22,000.00', tfoot);

  t.doc.querySelector('[data-chip="Overdue only"]').click();
  ok('Overdue only keeps just mySMB.com', t.doc.querySelectorAll('tbody tr').length === 1 && /mySMB\.com/.test(text('tbody')));

  done();
})();

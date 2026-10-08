// PRA-02 Sales Summary Metrics: report-specific correctness (columns, totals, the Overdue-only chip)
// on top of the kit behaviour already proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('sales-summary');
const REF = 'reports/sales-summary', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', outstanding: 12000, outstanding_count: 8, overdue: 4500, overdue_count: 3, overdue_rag: 'red', dso: 42, receipts: 30000, avg_invoice: 850 },
    { id: 'xt-2', name: 'Southgate Services Ltd', outstanding: 2000, outstanding_count: 2, overdue: 0, overdue_count: 0, overdue_rag: 'green', dso: 18, receipts: 9000, avg_invoice: 400 }
  ],
  errors: [], totals: {}, truncated: false
});
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, { xero: xeroOk, myob: myobEmpty });
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  const tfoot = text('tfoot');
  ok('totals row: outstanding $14,000, count 10, overdue $4,500, count 3, receipts $39,000', tfoot === 'Total (2 clients)$14,000.0010$4,500.003$39,000.00', tfoot);

  t.doc.querySelector('[data-chip="Overdue only"]').click();
  ok('Overdue only chip keeps just Irvine Jackson (overdue_count 3)', t.doc.querySelectorAll('tbody tr').length === 1 && /Irvine Jackson/.test(text('tbody')));
  t.doc.querySelector('[data-chip="All"]').click();
  ok('All chip restores both rows', t.doc.querySelectorAll('tbody tr').length === 2);

  done();
})();

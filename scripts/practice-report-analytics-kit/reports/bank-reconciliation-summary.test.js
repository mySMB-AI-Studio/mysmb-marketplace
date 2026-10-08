// PRA-04 Bank Reconciliation Summary: report-specific correctness, the Needs attention (RAG) chip, and
// that an unavailable statement balance shows N/A rather than a fabricated figure.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('bank-reconciliation-summary');
const REF = 'reports/bank-reconciliation-summary', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', statement_balance_na: 'Xero Accounting API has no bank-feed statement balance', ledger_balance: 2265.02, unreconciled_count: 0, unreconciled_value: 0, last_reconciled_na: 'not available from Xero' },
    { id: 'xt-2', name: 'Southgate Services Ltd', statement_balance: 500, ledger_balance: 300, difference: 200, difference_rag: 'red', unreconciled_count: 4, unreconciled_value: 200, last_reconciled: '2026-08-01' }
  ],
  errors: [], totals: {}, truncated: false
});
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, { xero: xeroOk, myob: myobEmpty });
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('N/A shown for the unavailable statement balance, not a fabricated figure', /N\/A/.test(t.doc.querySelector('tbody tr:nth-child(1)').textContent));
  ok('N/A cell carries the reason as a tooltip', t.doc.querySelector('tbody tr:nth-child(1) td[title]').getAttribute('title') === 'Xero Accounting API has no bank-feed statement balance');

  t.doc.querySelector('[data-chip="Needs attention"]').click();
  const rows = t.doc.querySelectorAll('tbody tr');
  ok('Needs attention keeps only the red-flagged client (Southgate)', rows.length === 1 && /Southgate/.test(rows[0].textContent));
  t.doc.querySelector('[data-chip="All"]').click();
  ok('All restores both rows', t.doc.querySelectorAll('tbody tr').length === 2);

  done();
})();

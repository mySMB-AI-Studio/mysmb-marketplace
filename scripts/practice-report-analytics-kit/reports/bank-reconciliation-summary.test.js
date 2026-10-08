// PRA-04 Bank Reconciliation Summary, revised to match the real tools (neither exposes a client-level
// statement/ledger balance — see the report's own comment). Real field names (confirmed against both
// agents' source 2026-10-08): Xero `totalUnreconciledCount`/`totalUnreconciledAmount`, MYOB
// `unreconciledCount`/`unreconciledAmount` — genuinely different names, exercising fieldAliases.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('bank-reconciliation-summary');
const REF = 'reports/bank-reconciliation-summary', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', totalUnreconciledCount: 0, totalUnreconciledAmount: 0 },
    { id: 'xt-2', name: 'Southgate Services Ltd', totalUnreconciledCount: 4, totalUnreconciledAmount: 200 }
  ],
  errors: [], totals: {}, truncated: false
});
const myobOk = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [{ id: 'cf-1', name: 'mySMB.com', unreconciledCount: 6, unreconciledAmount: 450 }], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, { xero: xeroOk, myob: myobOk });
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('all 3 clients shown (2 Xero + 1 MYOB), despite the two platforms naming the field differently', t.doc.querySelectorAll('tbody tr').length === 3);
  const tfoot = text('tfoot');
  ok('totals row: 10 unreconciled lines, $650 (4+6, $200+$450)', tfoot === 'Total (3 clients)10$650.00', tfoot);

  t.doc.querySelector('[data-chip="Needs attention"]').click();
  const rows = [...t.doc.querySelectorAll('tbody tr')].map((r) => r.textContent);
  ok('Needs attention (computed, rag:high on unreconciled_count) excludes the zero-count client only', rows.length === 2 && !rows.some((r) => /Irvine Jackson/.test(r)), rows);

  done();
})();

// PRA-05 Banking Summary Metrics: report-specific correctness on top of the kit behaviour already
// proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('banking-summary');
const REF = 'reports/banking-summary', man = manifest(REF);

// Real field names (confirmed against both agents' source 2026-10-08): identical on both platforms,
// including `net` (not aliased — passes through as-is). RAG is computed client-side (rag:'low').
const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', cashIn: 7470, cashOut: 13708.32, net: -6238.32, unreconciledCount: 0, unreconciledAmount: 0 },
    { id: 'xt-2', name: 'Southgate Services Ltd', cashIn: 1000, cashOut: 400, net: 600, unreconciledCount: 2, unreconciledAmount: 150 }
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
  ok('net total is negative and bracketed: ($5,638.32)', tfoot.includes('($5,638.32)'), tfoot);
  ok('unreconciled totals: 2 count, $150', tfoot.includes('2') && tfoot.includes('$150.00'));

  done();
})();

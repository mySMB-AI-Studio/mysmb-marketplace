// PRA-05 Banking Summary Metrics: report-specific correctness on top of the kit behaviour already
// proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('banking-summary');
const REF = 'reports/banking-summary', man = manifest(REF);

const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', cash_in: 7470, cash_out: 13708.32, net: -6238.32, net_rag: 'amber', unreconciled_count: 0, unreconciled_value: 0 },
    { id: 'xt-2', name: 'Southgate Services Ltd', cash_in: 1000, cash_out: 400, net: 600, net_rag: 'green', unreconciled_count: 2, unreconciled_value: 150 }
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

// PRA-06 Financial Overview: report-specific correctness — GP/NP tie (NP = GP − expenses, shown
// via margins), totals, and the Needs attention chip for clients with a negative net profit.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('financial-overview');
const REF = 'reports/financial-overview', man = manifest(REF);

// Real field names (confirmed against both agents' source 2026-10-08): revenue/grossProfit/netProfit/
// bankBalance agree; arAgeingTotal/apAgeingTotal and grossMargin/netMargin are Xero's own names (MYOB
// uses arOutstanding/apOutstanding and grossProfitMargin/netProfitMargin — see the report's
// fieldAliases). RAG is computed client-side from netProfit (rag:'low'), no upstream _rag field.
const xeroOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'xt-1', name: 'Irvine Jackson Pty Ltd', revenue: 7470, grossProfit: -6238.32, grossMargin: -0.835, netProfit: -14311.07, netMargin: -1.916, bankBalance: 2265.02, arAgeingTotal: 4680.50, apAgeingTotal: 22121.25 },
    { id: 'xt-2', name: 'Southgate Services Ltd', revenue: 20000, grossProfit: 8000, grossMargin: 0.4, netProfit: 3000, netMargin: 0.15, bankBalance: 5000, arAgeingTotal: 1200, apAgeingTotal: 800 }
  ],
  errors: [], totals: {}, truncated: false
});
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, { xero: xeroOk, myob: myobEmpty });
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  ok('percentages rendered for GP/NP margins', /-83\.5%/.test(text('tbody')) && /40\.0%/.test(text('tbody')));
  const tfoot = text('tfoot');
  ok('revenue total = $27,470.00', tfoot.includes('$27,470.00'), tfoot);
  ok('net profit total is negative and bracketed: ($11,311.07)', tfoot.includes('($11,311.07)'), tfoot);

  t.doc.querySelector('[data-chip="Needs attention"]').click();
  const rows = t.doc.querySelectorAll('tbody tr');
  ok('Needs attention keeps only the red (negative NP) client', rows.length === 1 && /Irvine Jackson/.test(rows[0].textContent));

  done();
})();

// PRA-05 Banking Summary Metrics: report-specific correctness on top of the kit behaviour already
// proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('banking-summary');
const REF = 'reports/banking-summary', man = manifest(REF);

// Real field names (confirmed against both agents' source 2026-10-08): identical on both platforms,
// including `net` (not aliased — passes through as-is). RAG is computed client-side (rag:'low').
// Xero side: raw Xero responses per organisation (xero-raw.js) for the report's own fan-out (xero-fan.js).
const { bankSummary, bankTx, orgs } = require('../xero-raw.js');
const xeroOrgs = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', fx: {
    x_bank: () => bankSummary([{ name: 'Business Account', in: 7000, out: 13000, close: 9000 }, { name: 'Card', in: 470, out: 708.32, close: -238.32 }]),
    x_unrec: () => bankTx([]) } },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {
    x_bank: () => bankSummary([{ name: 'Cheque', in: 1000, out: 400, close: 3000 }]),
    x_unrec: () => bankTx([100, 50]) } }
]);
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, Object.assign(xeroOrgs(), { myob: myobEmpty }));
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  const tfoot = text('tfoot');
  ok('net total is negative and bracketed: ($5,638.32)', tfoot.includes('($5,638.32)'), tfoot);
  ok('unreconciled totals: 2 count, $150', tfoot.includes('2') && tfoot.includes('$150.00'));

  ok('cash in/out come from the Bank Summary total row (Irvine: $7,470 in, $13,708.32 out, net ($6,238.32))', /Irvine Jackson[^]*\$7,470\.00\$13,708\.32\(\$6,238\.32\)/.test(text('tbody')), text('tbody'));
  ok('unreconciled up to the To date', t.calls.filter((c) => c.id === 'x_unrec' && c.requery).every((c) => /Date<=DateTime\(2026,10,8\)$/.test(c.params.where)), t.calls.filter((c) => c.id === 'x_unrec').map((c) => c.params.where));

  done();
})();

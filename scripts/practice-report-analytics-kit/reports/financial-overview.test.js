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
// Xero side: raw Xero responses per organisation (xero-raw.js) for the report's own fan-out (xero-fan.js).
const { inv, invoices, bankSummary, pl, orgs } = require('../xero-raw.js');
const plCalls = [];
const xeroOrgs = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', fx: {
    x_pl: (p) => { plCalls.push('accrual'); return pl({ income: 7470, cos: 13708.32, gp: -6238.32, np: -14311.07 }); },
    x_pl_cash: (p) => { plCalls.push('cash'); return pl({ income: 7000, cos: 13000, gp: -6000, np: -14000 }); },
    x_bank: () => bankSummary([{ name: 'Business Account', in: 0, out: 0, close: 2265.02 }]),
    x_ar: () => invoices([inv(4000, '2026-09-01', 'a'), inv(680.5, '2026-11-01', 'b')]),
    x_ap: () => invoices([inv(22121.25, '2026-09-01', 's')]) } },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {
    x_pl: () => pl({ income: 20000, cos: 12000, gp: 8000, np: 3000 }),
    x_pl_cash: () => pl({ income: 18000, cos: 11000, gp: 7000, np: 2500 }),
    x_bank: () => bankSummary([{ name: 'Cheque', in: 0, out: 0, close: 5000 }]),
    x_ar: () => invoices([inv(1200, '2026-11-01', 'c')]),
    x_ap: () => invoices([inv(800, '2026-11-01', 'd')]) } }
]);
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, Object.assign(xeroOrgs(), { myob: myobEmpty }));
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

  const perOrgPl = t.calls.filter((c) => c.requery && /^x_pl/.test(c.id)).map((c) => c.id);
  ok('accrual basis by default: per-client reads use the accrual P&L, not the cash one', perOrgPl.length === 2 && perOrgPl.every((id) => id === 'x_pl'), perOrgPl);
  const c = await run(REF, man, Object.assign(xeroOrgs(), { myob: myobEmpty }), { snapshotInputs: { basis: 'Cash' } });
  const ct = (c.doc.querySelector('tfoot') || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('Cash basis reads the payments-only P&L (revenue $25,000)', ct.includes('$25,000.00'), ct);
  t.doc.querySelector('[data-chip="All"]').click();
  ok('AR / AP totals from open invoices and bills ($5,880.50 / $22,921.25)', /\$5,880\.50/.test(text('tfoot')) && /\$22,921\.25/.test(text('tfoot')), text('tfoot'));

  done();
})();

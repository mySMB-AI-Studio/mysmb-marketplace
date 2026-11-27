// PRA-04 Bank Reconciliation Summary, revised to match the real tools (neither exposes a client-level
// statement/ledger balance — see the report's own comment). Real field names (confirmed against both
// agents' source 2026-10-08): Xero `totalUnreconciledCount`/`totalUnreconciledAmount`, MYOB
// `unreconciledCount`/`unreconciledAmount` — genuinely different names, exercising fieldAliases.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('bank-reconciliation-summary');
const REF = 'reports/bank-reconciliation-summary', man = manifest(REF);

// Xero side: raw Xero responses per organisation (xero-raw.js) for the report's own fan-out (xero-fan.js).
const { bankSummary, bankTx, orgs } = require('../xero-raw.js');
const pages = [];
const xeroOrgs = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', fx: {
    x_bank: () => bankSummary([{ name: 'Business Account', in: 0, out: 0, close: 25000 }]),
    x_unrec: () => bankTx([]) } },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {
    x_bank: () => bankSummary([{ name: 'Cheque', in: 0, out: 0, close: 8000 }, { name: 'Savings', in: 0, out: 0, close: 2000 }]),
    x_unrec: (p) => { pages.push(p); return bankTx([50, 50, 50, 50]); } } }
]);
const myobOk = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [{ id: 'cf-1', name: 'mySMB.com', unreconciledCount: 6, unreconciledAmount: 450 }], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, Object.assign(xeroOrgs(), { myob: myobOk }));
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('all 3 clients shown (2 Xero + 1 MYOB), despite the two platforms naming the field differently', t.doc.querySelectorAll('tbody tr').length === 3);
  const tfoot = text('tfoot');
  ok('totals row: 10 unreconciled lines, $650 (4+6, $200+$450)', tfoot === 'Total (3 clients)10$650.00', tfoot);

  t.doc.querySelector('[data-chip="Needs attention"]').click();
  const rows = [...t.doc.querySelectorAll('tbody tr')].map((r) => r.textContent);
  ok('Needs attention (computed, rag:high on unreconciled_count) excludes the zero-count client only', rows.length === 2 && !rows.some((r) => /Irvine Jackson/.test(r)), rows);

  ok('unreconciled filter is up to the as-at date, excluding deleted, page 1', pages.length === 1 && pages[0].where === 'IsReconciled==false&&Status!="DELETED"&&Date<=DateTime(2026,10,8)' && pages[0].page === 1, pages);

  // Paging: 150 unreconciled lines over two pages are all counted and summed (the server's fix of 16 Nov 2026).
  const big = orgs([{ tenantId: 'xt-9', tenantName: 'Big Ledger Pty Ltd', fx: {
    x_bank: () => bankSummary([{ name: 'Main', in: 0, out: 0, close: 1 }]),
    x_unrec: (p) => bankTx(p.page === 1 ? Array(100).fill(10) : p.page === 2 ? Array(50).fill(10) : []) } }]);
  const g = await run(REF, man, Object.assign(big, { myob: () => ({ clients: [], errors: [], totals: {}, truncated: false }) }));
  const gt = (g.doc.querySelector('tfoot') || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('two pages of unreconciled lines: 150 lines, $1,500', gt === 'Total (1 client)150$1,500.00', gt);
  ok('page 2 was requested, page 3 was not', g.calls.filter((c) => c.id === 'x_unrec' && c.requery).map((c) => c.params.page).join(',') === '1,2', g.calls.filter((c) => c.id === 'x_unrec').map((c) => c.params.page));

  done();
})();

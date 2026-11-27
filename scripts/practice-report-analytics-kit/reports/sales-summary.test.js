// PRA-02 Sales Summary Metrics: report-specific correctness (columns, totals, the Overdue-only chip)
// on top of the kit behaviour already proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('sales-summary');
const REF = 'reports/sales-summary', man = manifest(REF);

// Xero side: raw Xero responses per organisation (xero-raw.js), read by the report's own fan-out (xero-fan.js) the way
// the retired get_practice_sales_summary did server-side. Irvine Jackson: 8 open invoices, $12,000, 3 overdue ($4,500);
// Southgate: 2 open, $2,000, none overdue. As at 8 Oct 2026 (the harness clock).
const { inv, invoices, bankSummary, pl, orgs } = require('../xero-raw.js');
const five = (n, amt, due) => Array.from({ length: n }, (_, i) => inv(amt, due, 'cust-' + i));
const xero = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', fx: {
    x_open: () => invoices([].concat(five(3, 1500, '2026-09-01'), five(5, 1500, '2026-11-30'), [inv(0, '2026-09-01', 'paid'), inv(900, '2026-09-01', 'draft', 'DRAFT')])),
    x_bank: () => bankSummary([{ name: 'Business Account', in: 30000, out: 5000, close: 25000 }]),
    x_pl: () => pl({ income: 50000, gp: 30000, np: 10000 }) } },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {
    x_open: () => invoices(five(2, 1000, '2026-12-01')),
    x_bank: () => bankSummary([{ name: 'Cheque', in: 9000, out: 1000, close: 8000 }]),
    x_pl: () => pl({ income: 20000, gp: 12000, np: 4000 }) } }
]);
const myobEmpty = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });

(async () => {
  const t = await run(REF, man, Object.assign(xero(), { myob: myobEmpty }));
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  const tfoot = text('tfoot');
  ok('totals row: outstanding $14,000, count 10, overdue $4,500, count 3, receipts $39,000', tfoot === 'Total (2 clients)$14,000.0010$4,500.003$39,000.00', tfoot);

  const tbody = text('tbody');
  // DSO = outstanding / period revenue x days (1 Jul to 8 Oct 2026 = 100 days): 12000/50000*100 = 24; 2000/20000*100 = 10.
  ok('DSO from the P&L revenue and the period (24 and 10 days)', /Irvine Jackson[^]*\$12,000\.008\$4,500\.00324\$30,000\.00\$1,500\.00/.test(tbody) && /Southgate[^]*\$2,000\.002\$0\.00010\$9,000\.00\$1,000\.00/.test(tbody), tbody);
  ok('drafts and fully paid invoices are not counted', !/\$12,900/.test(tbody));
  ok('no Xero progress note left once loaded', !(t.doc.getElementById('fanprog') || { textContent: '' }).textContent);
  ok('one list_connections, then 3 calls per client (6)', t.calls.filter((c) => c.requery).length === 6, t.calls.filter((c) => c.requery).map((c) => c.id + ':' + c.params.xero_tenant_id));
  t.doc.querySelector('[data-chip="Overdue only"]').click();
  ok('Overdue only chip keeps just Irvine Jackson (overdue_count 3)', t.doc.querySelectorAll('tbody tr').length === 1 && /Irvine Jackson/.test(text('tbody')));
  t.doc.querySelector('[data-chip="All"]').click();
  ok('All chip restores both rows', t.doc.querySelectorAll('tbody tr').length === 2);

  done();
})();

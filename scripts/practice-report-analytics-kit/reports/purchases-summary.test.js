// PRA-03 Purchases Summary Metrics: report-specific correctness on top of the kit behaviour already
// proven by client-summary.test.js.
const { manifest } = require('../build.js');
const { run, suite } = require('../harness.js');
const { ok, done } = suite('purchases-summary');
const REF = 'reports/purchases-summary', man = manifest(REF);

// Real field names (confirmed against both agents' source 2026-10-08): identical on both platforms.
const myobOk = () => ({
  asOf: '2026-10-08T02:00:00.000Z',
  clients: [
    { id: 'cf-1', name: 'mySMB.com', outstandingAmount: 6000, outstandingCount: 5, overdueAmount: 1200, overdueCount: 1, dpo: 35, bankPayments: 18000, supplierCount: 9 },
    { id: 'cf-2', name: 'Demo Pty Ltd', outstandingAmount: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0, dpo: 20, bankPayments: 4000, supplierCount: 3 }
  ],
  errors: [], totals: {}, truncated: false
});
// Xero side: raw Xero responses per organisation (xero-raw.js) for the report's own fan-out (xero-fan.js).
const { inv, invoices, bankSummary, pl, orgs } = require('../xero-raw.js');
const xeroEmpty = () => orgs([]); // connected, no organisations
const xeroOrgs = () => orgs([
  { tenantId: 'xt-1', tenantName: 'Irvine Jackson Pty Ltd', fx: {
    // 4 open bills from 3 suppliers, $8,000; 1 overdue ($2,000). Cost of sales $40,000 over 100 days -> DPO 20.
    x_open: () => invoices([inv(2000, '2026-09-15', 'sup-a'), inv(3000, '2026-11-01', 'sup-a'), inv(1000, '2026-11-01', 'sup-b'), inv(2000, '2026-12-01', 'sup-c'), inv(500, '2026-09-01', 'sup-d', 'DRAFT')]),
    x_bank: () => bankSummary([{ name: 'Business Account', in: 12000, out: 15000, close: 4000 }]),
    x_pl: () => pl({ income: 90000, cos: 40000, gp: 50000, np: 20000 }) } },
  { tenantId: 'xt-2', tenantName: 'Southgate Services Ltd', fx: {
    // No cost of sales in the P&L -> DPO is N/A with the server's reason.
    x_open: () => invoices([inv(700, '2026-12-01', 'sup-x')]),
    x_bank: () => bankSummary([{ name: 'Cheque', in: 1000, out: 2500, close: 900 }]),
    x_pl: () => pl({ income: 10000, gp: 10000, np: 3000 }) } }
]);

(async () => {
  const t = await run(REF, man, Object.assign(xeroEmpty(), { myob: myobOk }));
  const text = (sel) => (t.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('no script errors', !t.errs.length, t.errs);
  ok('both MYOB clients shown', t.doc.querySelectorAll('tbody tr').length === 2);
  const tfoot = text('tfoot');
  ok('totals row: outstanding $6,000, count 5, overdue $1,200, count 1, payments $22,000', tfoot === 'Total (2 clients)$6,000.005$1,200.001$22,000.00', tfoot);

  t.doc.querySelector('[data-chip="Overdue only"]').click();
  ok('Overdue only keeps just mySMB.com', t.doc.querySelectorAll('tbody tr').length === 1 && /mySMB\.com/.test(text('tbody')));

  // Xero, read per organisation through xero-api.
  const myobNone = () => ({ asOf: '2026-10-08T02:00:00.000Z', clients: [], errors: [], totals: {}, truncated: false });
  const x = await run(REF, man, Object.assign(xeroOrgs(), { myob: myobNone }));
  const xt = (sel) => (x.doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
  ok('Xero: no script errors', !x.errs.length, x.errs);
  ok('Xero: both organisations shown', x.doc.querySelectorAll('tbody tr').length === 2, xt('tbody'));
  ok('Xero: Irvine Jackson = $8,000 / 4 open, $2,000 / 1 overdue, DPO 20, payments $15,000, 3 suppliers (draft ignored)',
    /Irvine Jackson[^]*\$8,000\.004\$2,000\.00120\$15,000\.003/.test(xt('tbody')), xt('tbody'));
  const sg = [...x.doc.querySelectorAll('tbody tr')].find((r) => /Southgate/.test(r.textContent));
  ok('Xero: no cost of sales -> DPO N/A with the reason', sg && /N\/A/.test(sg.textContent) && /cost of sales/.test(sg.innerHTML), sg && sg.innerHTML.slice(0, 600));
  ok('Xero: totals = $8,700 outstanding, 5 open, payments $17,500', /Total \(2 clients\)\$8,700\.005\$2,000\.001\$17,500\.00/.test(xt('tfoot')), xt('tfoot'));
  ok('Xero: checks banner passes (Σ clients = connector totals)', !/check failed/.test(xt('#banner')), xt('#banner'));

  done();
})();

// CRA-11 Activity Count (QuickBooks): transaction counts by month across Invoice/Bill/Purchase/Payment/BillPayment.
const U = require('./qb-test-util.js');
const { run, suite, F, text, banner, red } = U;
const manifest = require('../build.js').manifest('quickbooks/activity-count');
const REF = 'quickbooks/activity-count';
const fx = { invoices: F.invoices, bills: F.bills, purchases: F.purchasesMany, payments: F.payments, bill_payments: F.billPayments, company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/activity-count');
(async () => {
  const t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with a transaction-count table', text(t.doc, 'body').length > 0, text(t.doc, 'body').slice(0, 200));
  ok('every check passes, green', !red(t), banner(t).slice(0, 600));
  ok('months add up to each category total (checked)', banner(t).includes("✓ Months add up to each category's total for the period"), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', banner(t).includes('✓ Categories add up to the grand total'), banner(t).slice(0, 600));
  ok('journals and payroll read N/A, never a fabricated zero', text(t.doc, 'body').includes('N/A — not in source') && text(t.doc, '#qb-body').includes('N/A'), text(t.doc, 'body').slice(0, 400));
  const f = await run(REF, manifest, fx, { fail: { invoices: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed activity source is never silent', text(f.doc, '#qb-body').includes('QuickBooks API error'), text(f.doc, '#qb-body').slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

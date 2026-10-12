// CRA-11 Activity Count (Xero): transaction counts by month across sales, purchases, banking, journals and payroll, against the
// Xero kit's ledger. T1 (Northwind, AU) has Payroll AU pay runs; T2 (Southgate, NZ) does not, so payroll must show N/A, not 0.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, text, wait, banner, body, green } = X;
const ID = 'activity-count', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  ok('opens green with a transaction-count table', green(t) && t.errs.length === 0, banner(t).slice(0, 600));
  ok('payroll is counted for this AU organisation (Xero Payroll AU pay runs)', /Payroll/.test(body(t)) && !/N\/A — this organisation does not use Xero Payroll AU/.test(body(t)), body(t).slice(0, 300));
  ok('months add up to each category total (checked)', /✓ Months add up to each category's total for the period/.test(banner(t)), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', /✓ Categories add up to the grand total/.test(banner(t)), banner(t).slice(0, 600));
  // a non-AU organisation (T2, Southgate Services, NZ) has no Xero Payroll AU: N/A, never a fabricated 0
  const onlyT2 = {}; Object.keys(X.fixtures(m)).forEach((k) => { onlyT2[k] = (p) => X.fixtures(m)[k](Object.assign({}, p, { xero_tenant_id: L.T2 })); });
  const m2 = JSON.parse(JSON.stringify(m)); m2.inputs.forEach((i) => { if (i.name === 'org') i.default = L.T2; });
  const t2 = await run(REF, m2, onlyT2, { bundleInputs: true }); await wait(250);
  ok('non-AU organisation: payroll shown as N/A, not a fabricated zero, and the report still opens', /N\/A/.test(body(t2)) && /does not use Xero Payroll AU|403/.test(body(t2)) && t2.errs.length === 0, body(t2).slice(0, 400));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

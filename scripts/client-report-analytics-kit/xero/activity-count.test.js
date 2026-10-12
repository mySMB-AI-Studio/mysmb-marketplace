// CRA-11 Activity Count (Xero): transaction counts by month across sales, purchases, banking and journals, against the Xero
// kit's ledger. Payroll lives in the separate Xero Payroll AU connector, which this extension's .mcp.json does not declare
// (xero-accounting, myob-accounting, quickbooks-accounting only) — so payroll must always read N/A here, never a tool call
// and never a fabricated count, for AU and non-AU organisations alike. (Corrected 2026-10-12: a prior version called
// "list_pay_runs" against xero-accounting, which only exists on the separate xero-payroll-au server — that call always
// failed live in QA with "Tool list_pay_runs not found", and the fallback text wrongly implied a fact about the client's
// data instead of naming the real cause.)
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, text, wait, banner, body, green } = X;
const ID = 'activity-count', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  ok('opens green with a transaction-count table', green(t) && t.errs.length === 0, banner(t).slice(0, 600));
  ok('payroll never attempts a tool call — always N/A, naming the real reason, never a fabricated count', !/payroll"/i.test(JSON.stringify(t.calls)) && /Payroll activity: N\/A — Payroll transaction counts require the Xero Payroll AU connector, which this agent does not connect\./.test(body(t)), body(t).slice(0, 400));
  ok('months add up to each category total (checked)', /✓ Months add up to each category's total for the period/.test(banner(t)), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', /✓ Categories add up to the grand total/.test(banner(t)), banner(t).slice(0, 600));
  // AU organisation (T1, Northwind) must show the same honest N/A as a non-AU one (T2, Southgate) — payroll is never
  // fetched for either, since the connector it lives on isn't part of this extension at all.
  const onlyT2 = {}; Object.keys(X.fixtures(m)).forEach((k) => { onlyT2[k] = (p) => X.fixtures(m)[k](Object.assign({}, p, { xero_tenant_id: L.T2 })); });
  const m2 = JSON.parse(JSON.stringify(m)); m2.inputs.forEach((i) => { if (i.name === 'org') i.default = L.T2; });
  const t2 = await run(REF, m2, onlyT2, { bundleInputs: true }); await wait(250);
  ok('non-AU organisation: same honest payroll N/A, and the report still opens', /Payroll transaction counts require the Xero Payroll AU connector, which this agent does not connect\./.test(body(t2)) && t2.errs.length === 0, body(t2).slice(0, 400));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

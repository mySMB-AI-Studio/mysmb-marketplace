// CRA-11 Activity Count (MYOB): transaction counts by month across sales, purchases, banking, journals and payroll.
const { suite } = require('../harness.js');
const { go, text, wait, banner, body, green, common } = require('./lib.js');
const ID = 'activity-count';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(200);
  ok('opens green with a transaction-count table', green(t) && t.errs.length === 0, banner(t).slice(0, 600));
  ok('payroll is counted for this company file (pay advices exist)', /Payroll/.test(body(t)) && !/N\/A — no pay runs/.test(body(t)), body(t).slice(0, 300));
  ok('months add up to each category total (checked)', /✓ Months add up to each category's total for the period/.test(banner(t)), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', /✓ Categories add up to the grand total/.test(banner(t)), banner(t).slice(0, 600));
  const f = await go(ID, null, { fail: { invoices: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('a failed activity source is never silent', /MYOB 500/.test(body(f)), body(f).slice(0, 200));
  await common(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

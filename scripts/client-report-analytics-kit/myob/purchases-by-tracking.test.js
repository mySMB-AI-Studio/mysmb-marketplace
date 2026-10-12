// CRA-04 Purchases by Tracking Category (MYOB): Cost of Sales / Expense journal lines on company file 1, grouped by job.
const { suite } = require('../harness.js');
const { go, text, wait, banner, body, green, common, conformance } = require('./lib.js');
const ID = 'purchases-by-tracking';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(150);
  ok('opens green with jobs in the purchases-by-job table', green(t) && t.errs.length === 0, banner(t).slice(0, 500));
  ok('a "No job" row is shown for unassigned purchases', /No job/.test(text(t.doc, '#pj-grid')), text(t.doc, '#pj-grid').slice(0, 400));
  ok('jobs + no job tie to the total (checked)', /✓ Jobs \+ No job add up to total purchases/.test(banner(t)), banner(t).slice(0, 500));
  ok('total purchases ties to MYOB\'s own Cost of Sales + Expenses (checked)', /✓ Total purchases = Cost of Sales \+ Expenses on MYOB's own Profit and Loss/.test(banner(t)), banner(t).slice(0, 500));
  const f = await go(ID, null, { fail: { journals: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('a failed journals load is never silent', /MYOB 500/.test(body(f)), body(f).slice(0, 200));
  await common(ID, ok);
  await conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

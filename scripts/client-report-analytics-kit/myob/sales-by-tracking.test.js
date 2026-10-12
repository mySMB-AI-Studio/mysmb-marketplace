// CRA-03 Sales by Tracking Category (MYOB): Income journal lines on company file 1, grouped by MYOB job, against the kit's
// ledger (3 named jobs on some sales invoices; others have none). Ties to the Income total of MYOB's own Profit and Loss.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green, common, conformance } = require('./lib.js');
const ID = 'sales-by-tracking';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(150);
  ok('opens green with jobs in the sales-by-job table', green(t) && t.errs.length === 0 && /Bluegum fit-out|Harbour Cafe refit|Coastal Freight depot/.test(text(t.doc, '#sj-grid')), { banner: banner(t).slice(0, 500), grid: text(t.doc, '#sj-grid').slice(0, 300) });
  ok('a "No job" row is shown for unassigned income', /No job/.test(text(t.doc, '#sj-grid')), text(t.doc, '#sj-grid').slice(0, 400));
  ok('jobs + no job tie to the total (checked)', /✓ Jobs \+ No job add up to total sales/.test(banner(t)), banner(t).slice(0, 500));
  ok('total sales ties to MYOB\'s own Profit and Loss Income (checked)', /✓ Total sales = Income on MYOB's own Profit and Loss/.test(banner(t)), banner(t).slice(0, 500));
  const f = await go(ID, null, { fail: { journals: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('a failed journals load is never silent', /MYOB 500/.test(body(f)), body(f).slice(0, 200));
  await common(ID, ok);
  await conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

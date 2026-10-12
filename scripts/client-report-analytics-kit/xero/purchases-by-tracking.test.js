// CRA-04 Purchases by Tracking Category (Xero): the same Region tracking category, on the Cost of Sales + Expenses sections.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, text, wait, banner, body, green, red, fmt } = X;
const ID = 'purchases-by-tracking', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const FROM = '2026-07-01', TO = '2026-09-25', pl = L.expect.plByAccount(FROM, TO, false);
  const spend = L.r2(pl['310'] + pl['320'] + pl['400'] + pl['404'] + pl['429'] + pl['469'] + pl['477'] + pl['485']);
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  ok('opens on Region with a tracking-category picker', /Region/.test(body(t)) && t.doc.getElementById('tc-cat') != null, body(t).slice(0, 300));
  ok('every check passes, green', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('Total purchases = Cost of Sales + Expenses of the untracked Profit and Loss for the same period', new RegExp(fmt(spend)).test(text(t.doc, '#pt-grid')) || new RegExp(fmt(spend)).test(body(t)), { spend, grid: text(t.doc, '#pt-grid') });
  ok('options add up to the total (checked)', /✓ Options \(incl\. Unassigned\) add up to the Total column/.test(banner(t)), banner(t).slice(0, 500));
  const f1 = await run(REF, m, X.fixtures(m), { fail: { cats: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('tracking categories failed to load → red, the error shown, no figures invented', red(f1) && /Xero API 500/.test(body(f1)), body(f1).slice(0, 200));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

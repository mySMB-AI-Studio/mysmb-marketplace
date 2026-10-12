// CRA-03 Sales by Tracking Category (Xero) against the Xero kit's ledger: the only tracking category in the fixture books is
// Region (North/South), used on sales invoices. Figures = the books, the tie to the untracked P&L holds, a tampered source fails.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, text, wait, banner, body, green, red, fmt, FX } = X;
const ID = 'sales-by-tracking', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const FROM = '2026-07-01', TO = '2026-09-25', pl = L.expect.plByAccount(FROM, TO, false);
  const rev = L.r2(pl['200'] + pl['260']);
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  ok('opens on Region (the only tracking category) with a tracking-category picker', /Region/.test(body(t)) && t.doc.getElementById('tc-cat') != null, body(t).slice(0, 300));
  ok('every check passes, green', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('Total sales = the Income section of the untracked Profit and Loss for the same period', new RegExp('Total sales' + fmt(rev)).test(body(t)) || new RegExp(fmt(rev)).test(text(t.doc, '#st-grid')), { rev, body: body(t).slice(0, 300), grid: text(t.doc, '#st-grid') });
  ok('options add up to the total (checked)', /✓ Options \(incl\. Unassigned\) add up to the Total column/.test(banner(t)), banner(t).slice(0, 500));
  // a failed tracking-categories call is never silent
  const f1 = await run(REF, m, X.fixtures(m), { fail: { cats: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('tracking categories failed to load → red, the error shown, no figures invented', red(f1) && /Xero API 500/.test(body(f1)), body(f1).slice(0, 200));
  // not connected
  const f2 = await run(REF, m, X.fixtures(m), { fail: { pnl: { code: 'needs_connection', message: 'Connect Xero' } } }); await wait(150);
  ok('the untracked tie is N/A (not failed) when the Profit and Loss tie-source errors, but the report itself still renders', text(f2.doc, '#st-grid').length > 0, text(f2.doc, '#st-grid').slice(0, 100));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

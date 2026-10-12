// CRA-04 Purchases by Tracking Category (QuickBooks): Cost of Sales + Expenses sections split North/South/Unclassified
// (this CRA kit's own class fixture; the Total column always ties to the real F.pnl() fixture).
const U = require('./qb-test-util.js');
const { run, suite, F, xlsxText, text, banner, red, conformance } = U;
const Q = require('./qb-class-fixtures.js');
const manifest = require('../build.js').manifest('quickbooks/purchases-by-tracking');
const REF = 'quickbooks/purchases-by-tracking';
const fx = { by_class: Q.pnlByClassSpend, pnl: (p) => F.pnl(Object.assign({}, p, { summarize_column_by: 'Total' })), company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/purchases-by-tracking');
(async () => {
  let t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with class columns (North, South, Unclassified)', ['North', 'South', 'Unclassified'].every((s) => text(t.doc, '#pt-grid').includes(s)), text(t.doc, '#pt-grid').slice(0, 400));
  ok('every check passes, green', !red(t), banner(t).slice(0, 600));
  ok('checked: classes add up to the total', banner(t).includes('✓ Classes (incl. Unclassified) add up to the total'), banner(t).slice(0, 600));
  ok('checked: total purchases ties to Cost of Sales + Expenses of the plain Profit and Loss', banner(t).includes('✓ Total purchases = Cost of Sales + Expenses on the Profit and Loss without a class split'), banner(t).slice(0, 600));
  const tamper = { by_class: (p) => { const r = JSON.parse(JSON.stringify(Q.pnlByClassSpend(p))); const sec = r.Rows.Row.find((x) => x.group === 'COGS'); sec.Rows.Row[0].ColData[1].value = '999999.00'; return r; } };
  t = await run(REF, manifest, Object.assign({}, fx, tamper));
  ok('a tampered class figure fails the class-adds-up check', red(t) && banner(t).includes('✗ Classes (incl. Unclassified) add up to the total'), banner(t).slice(0, 600));
  t = await run(REF, manifest, fx, { fail: { pnl: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed tie-source is shown, not invented as a pass', banner(t).includes('QuickBooks API error'), banner(t).slice(0, 600));
  t = await run(REF, manifest, fx, { fail: { by_class: { code: 'needs_connection', message: 'Connect QuickBooks' } } });
  ok('needs_connection says Connect QuickBooks', text(t.doc, '#qb-body').includes('Connect QuickBooks'), text(t.doc, '#qb-body').slice(0, 200));
  t = await run(REF, manifest, fx, { mode: 'snapshot' });
  ok('snapshot renders without error', t.errs.length === 0);
  t = await run(REF, manifest, fx, { theme: 'dark' });
  ok('dark theme renders', t.errs.length === 0 && t.doc.documentElement.getAttribute('data-myhub-theme') === 'dark');
  t = await run(REF, manifest, fx);
  const x = await xlsxText(t);
  ok('Excel: Purchases by class sheet with figures', x.includes('Purchases by class') && x.includes('North'));
  await conformance(ok, REF, manifest, fx, { start_date: '2026-04-01', end_date: '2026-06-30' }, 'April - June, 2026');
  done(); process.exit(process.exitCode || 0);
})();

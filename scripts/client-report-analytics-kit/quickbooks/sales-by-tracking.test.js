// CRA-03 Sales by Tracking Category (QuickBooks): Income section split North/South/Unclassified (this CRA kit's own class
// fixture — see qb-class-fixtures.js — the Total column is always built from the real F.pnl() fixture, so the tie to the
// plain Profit and Loss holds by construction and a tamper to either source must fail it).
const U = require('./qb-test-util.js');
const { run, suite, F, xlsxText, text, banner, red, conformance } = U;
const Q = require('./qb-class-fixtures.js');
const manifest = require('../build.js').manifest('quickbooks/sales-by-tracking');
const REF = 'quickbooks/sales-by-tracking';
const fx = { by_class: Q.pnlByClassIncome, pnl: (p) => F.pnl(Object.assign({}, p, { summarize_column_by: 'Total' })), company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/sales-by-tracking');
(async () => {
  let t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with class columns (North, South, Unclassified)', ['North', 'South', 'Unclassified'].every((s) => text(t.doc, '#st-grid').includes(s)), text(t.doc, '#st-grid').slice(0, 400));
  ok('every check passes, green', !red(t), banner(t).slice(0, 600));
  ok('checked: classes add up to the total', banner(t).includes('✓ Classes (incl. Unclassified) add up to the total'), banner(t).slice(0, 600));
  ok('checked: total sales ties to the Income total of the plain Profit and Loss', banner(t).includes('✓ Total sales = Income on the Profit and Loss without a class split'), banner(t).slice(0, 600));
  // tamper: the class fixture's Income figures no longer add up to the real pnl() total
  const tamper = { by_class: (p) => { const r = JSON.parse(JSON.stringify(Q.pnlByClassIncome(p))); const sec = r.Rows.Row.find((x) => x.group === 'Income'); sec.Rows.Row[0].ColData[1].value = '999999.00'; return r; } };
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
  ok('Excel: Sales by class sheet with figures', x.includes('Sales by class') && x.includes('North'));
  await conformance(ok, REF, manifest, fx, { start_date: '2026-04-01', end_date: '2026-06-30' }, 'April - June, 2026');
  done(); process.exit(process.exitCode || 0);
})();

// CRA-01 Financial Overview (QuickBooks): live open, controls, refetch-only-affected, checks + tamper, snapshot, dark, Excel,
// needs_connection, LIB-002 (only the connected company; a reconnect to another company leaves nothing of the first), template copy.
const U = require('./qb-test-util.js');
const { run, suite, F, co2fx, CO2, xlsxText, text, banner, red, set, radio, conformance } = U;
const manifest = require('../build.js').manifest('quickbooks/financial-overview');
const REF = 'quickbooks/financial-overview';
const bankAccts = () => ({ QueryResponse: { Account: [{ Id: '35', Name: 'Wise-AUD', AccountType: 'Bank' }, { Id: '36', Name: 'ANZ', AccountType: 'Bank' }, { Id: '37', Name: 'PHP Bank', AccountType: 'Bank' }] } });
const fx = { pnl: F.pnl, pnl_prev_year: F.pnl, pnl_trend: F.pnl, bs_end: F.bs, bs_today: F.bs, bank_accounts: bankAccts, aged_receivables: F.ar, aged_payables: F.ap, company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/financial-overview');
(async () => {
  let t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('mySMB house style by default', t.doc.documentElement.classList.contains('style-mysmb'));
  ok('header: client, report, platform, period + basis', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd' && text(t.doc, '#qb-head .ti').includes('QuickBooks') && text(t.doc, '#qb-head .pe') === 'August 2026 · Accrual basis · AUD' && text(t.doc, '#qb-head').includes('Prepared from QuickBooks Online'), text(t.doc, '#qb-head'));
  ok('client selector = the connected company (one per connection)', (t.doc.getElementById('qb-client') || {}).textContent === 'Enterprise AI Pty Ltd' && /connect another company/i.test(t.doc.getElementById('qb-client').title));
  ok('banner passes, every check named', !red(t) && banner(t).includes('✓ Gross profit = Revenue − Cost of sales') && banner(t).includes('✓ Bank total = the balance sheet') && banner(t).includes('✓ Payables ageing total = balance sheet payables control') && banner(t).includes('✓ Trend months in the period sum'), banner(t).slice(0, 1500));
  const body = text(t.doc, '#qb-body');
  ok('KPI row: revenue, GP, GP %, NP, NP % with last year', ['Revenue', 'Gross profit', 'GP %', 'Net profit', 'NP %', 'Last year'].every((s) => body.includes(s)), body.slice(0, 400));
  ok('trend chart: 12 months for a one-month period', t.doc.querySelectorAll('#cra-trend circle').length === 24, t.doc.querySelectorAll('#cra-trend circle').length);
  ok('bank table: each bank + total', ['Wise-AUD', 'ANZ', 'PHP Bank', 'Total bank'].every((s) => text(t.doc, '#cra-bank').includes(s)), text(t.doc, '#cra-bank'));
  ok('ageing buckets + top contacts', text(t.doc, '#cra-ap').includes('91 and over') && text(t.doc, '#cra-ap5').includes('Other suppliers'), text(t.doc, '#cra-ap'));
  const trendCall = t.calls.find((c) => c.id === 'pnl_trend');
  ok('trend binding: Month columns, latest 12 months', trendCall.params.summarize_column_by === 'Month' && trendCall.params.start_date === '2025-09-01' && trendCall.params.end_date === '2026-08-31', trendCall.params);
  ok('sources: one company per connection said plainly', /another client needs its own QuickBooks connection/.test(text(t.doc, '#qb-sources')), text(t.doc, '#qb-sources').slice(0, 600));

  // controls: preset → only period bindings refetch; trend follows the period; last year = same dates −1y
  t.calls.length = 0;
  await set(t, 'qb-preset', 'this_fy_td');
  const ids = [...new Set(t.calls.filter((c) => c.requery).map((c) => c.id))].sort();
  ok('preset change refetches only the period bindings', JSON.stringify(ids) === JSON.stringify(['bs_end', 'pnl', 'pnl_prev_year', 'pnl_trend']), ids);
  const ly = t.calls.find((c) => c.id === 'pnl_prev_year').params, tr = t.calls.find((c) => c.id === 'pnl_trend').params;
  ok('last year = same dates one year earlier', ly.start_date === '2025-07-01' && ly.end_date === '2025-09-25', ly);
  ok('multi-month period: the trend covers the period months', tr.start_date === '2026-07-01', tr);
  ok('still passing after the change', !red(t) && t.errs.length === 0, banner(t).slice(0, 600));
  await set(t, 'qb-to', '2026-08-31'); await set(t, 'qb-from', '2026-07-01');
  ok('editable dates', text(t.doc, '#qb-head .pe').startsWith('July - August, 2026') && banner(t).includes('✓ Trend months in the period sum'), text(t.doc, '#qb-head .pe'));
  t.calls.length = 0;
  await radio(t, 'qb-basis', 'Cash');
  ok('basis Cash refetches with accounting_method Cash', t.calls.filter((c) => c.requery && c.params.accounting_method === 'Cash').length === 4 && text(t.doc, '#qb-head .pe').includes('Cash basis'), t.calls.map((c) => c.id + ':' + c.params.accounting_method));
  ok('ageing control stays accrual on a cash report', !t.calls.some((c) => c.id === 'bs_today'));

  // tampered sources fail named checks
  const tamper = (id, f) => Object.assign({}, fx, { [id]: (p) => f(fx[id](p)) });
  t = await run(REF, manifest, tamper('pnl', (r) => { r.Rows.Row[0].Rows.Row[0].ColData[1].value = '9999.00'; return r; }));
  ok('tampered P&L account → section check fails', red(t) && banner(t).includes('✗ Every P&L section total = Σ its accounts'), banner(t).slice(0, 600));
  t = await run(REF, manifest, tamper('pnl', (r) => { r.Rows.Row.find((x) => x.group === 'NetIncome').Summary.ColData[1].value = '1.00'; return r; }));
  ok('tampered net profit → NP check and trend tie fail', banner(t).includes('✗ Net profit = Gross profit') && banner(t).includes('✗ Trend months'), banner(t).slice(0, 800));
  t = await run(REF, manifest, tamper('bs_end', (r) => { r.Rows.Row[0].Rows.Row[0].Rows.Row[0].Rows.Row[1].ColData[1].value = '500.00'; return r; }));
  ok('tampered bank balance → bank check fails', banner(t).includes('✗ Bank total = the balance sheet'), banner(t).slice(0, 800));
  t = await run(REF, manifest, tamper('aged_payables', (r) => { const g = r.Rows.Row[r.Rows.Row.length - 1].Summary.ColData; g[g.length - 1].value = '1.00'; return r; }));
  ok('ageing ≠ balance sheet payables → fails with both figures', banner(t).includes('✗ Payables ageing total = balance sheet payables control') && banner(t).includes('A$1 vs A$265,180'), banner(t).slice(0, 900));
  t = await run(REF, manifest, fx, { fail: { aged_receivables: { code: 'tool_error', message: 'boom' } } });
  ok('a failed binding is never silent', red(t) && banner(t).includes('boom') && text(t.doc, '#cra-ar').includes('boom'), banner(t).slice(0, 500));
  t = await run(REF, manifest, fx, { fail: Object.fromEntries(manifest.bindings.map((b) => [b.id, { code: 'needs_connection', message: 'Connect' }])) });
  ok('needs_connection says Connect QuickBooks', text(t.doc, '#qb-body').includes('Connect QuickBooks') && t.errs.length === 0, text(t.doc, '#qb-body').slice(0, 200));

  // snapshot + dark
  t = await run(REF, manifest, fx, { mode: 'snapshot' });
  ok('snapshot: period controls disabled, figures shown', t.doc.getElementById('qb-preset').disabled && t.doc.getElementById('qb-from').disabled && text(t.doc, '#qb-body').includes('Revenue') && banner(t).includes('Snapshot'));
  t = await run(REF, manifest, fx, { theme: 'dark' });
  ok('dark theme renders', t.errs.length === 0 && t.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && !red(t));

  // Excel: one sheet per table, header block, figures
  t = await run(REF, manifest, fx);
  let x = await xlsxText(t);
  ok('Excel: sheets KPIs, Trend, Bank balances, ageing, Validation', ['KPIs', 'Trend', 'Bank balances', 'Receivables ageing', 'Payables ageing', 'Validation', 'Accrual basis · AUD', 'Enterprise AI Pty Ltd'].every((s) => x.includes(s)), x.length);

  // LIB-002: only the connected company; a reconnect to another company leaves nothing of the first (page or Excel)
  const C1 = ['Enterprise AI', 'Civica', 'Adaptovate', 'Wise-AUD', 'Other suppliers', '57,833'];
  ok('company 1 page carries only company 1', !text(t.doc, 'body').includes(CO2));
  const fx2 = co2fx(fx); Object.keys(fx2).forEach((k) => { fx[k] = fx2[k]; });
  const H = require('../harness.js');
  t.w.MyHubReport._deliver(H.hydrate(manifest, fx, {}, [], null, '2026-09-25')); await t.settle();
  const all = text(t.doc, 'body');
  ok('reconnected company 2: header names it', text(t.doc, '#qb-head .co') === CO2, text(t.doc, '#qb-head .co'));
  ok('nothing of company 1 left on the page', C1.every((s) => !all.includes(s)), C1.filter((s) => all.includes(s)));
  ok('company 2 checks still pass', !red(t), banner(t).slice(0, 600));
  x = await xlsxText(t);
  ok('nothing of company 1 in the Excel', C1.every((s) => !x.includes(s)) && x.includes(CO2), C1.filter((s) => x.includes(s)));
  await set(t, 'qb-preset', 'last_quarter');
  ok('company 2 refetch after a control change stays company 2', C1.every((s) => !text(t.doc, 'body').includes(s)) && !red(t));

  // template copy opened on another period (and on company 2: shows company 2 only)
  t = await conformance(ok, REF, manifest, fx, { start_date: '2026-04-01', end_date: '2026-06-30', compare_start: '2025-04-01', compare_end: '2025-06-30', trend_start: '2026-04-01' }, 'April - June, 2026');
  ok('copy on company 2 shows company 2 only', C1.every((s) => !text(t.doc, 'body').includes(s)) && text(t.doc, '#qb-head .co') === CO2);
  done();
})();

// CRA-05 Summary of Tax Amounts by Type (QuickBooks): live open (agency found, refetch), grid by tax type × month, checks tie to the
// Tax Summary and the GST account, tamper / truncation / no-agency-rows fail, nil period, controls, snapshot, dark, Excel, LIB-002, copy.
const { run, suite, co2fx, CO2, xlsxText, text, banner, red, set, radio, conformance } = require('./qb-test-util.js');
const H = require('../harness.js');
const L = require('./qb-tax-ledger.js');
const REF = 'quickbooks/tax-by-type', manifest = require('../build.js').manifest(REF);
const { ok, done } = suite(REF);
const li = (t) => [...t.doc.querySelectorAll('#qb-banner li')].map((l) => l.textContent);
const has = (t, s) => li(t).some((l) => l.startsWith(s));
(async () => {
  let fx = L.fx(), t = await run(REF, manifest, fx); await t.settle(40);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('tax agency found and the Tax Summary refetched for it', t.calls.some((c) => c.requery && c.id === 'gst_period' && c.params.agency_id === '1'), t.calls.filter((c) => c.requery).map((c) => c.id));
  ok('header: client, platform, BAS quarter, basis', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd' && text(t.doc, '#qb-head .ti').includes('QuickBooks') && text(t.doc, '#qb-head .pe') === 'April - June, 2026 · Accrual basis · AUD', text(t.doc, '#qb-head'));
  ok('mySMB house style by default', t.doc.documentElement.classList.contains('style-mysmb'));
  ok('banner passes', !red(t) && has(t, '✓ Σ GST collected (sales tax types) = Tax Summary 1A — A$3,100.00 vs A$3,100.00') && has(t, '✓ Σ GST paid (purchase tax types) = Tax Summary 1B') && has(t, '✓ Net GST = Tax Summary label 9') && has(t, '✓ Σ months = period total'), li(t));
  ok('GST account movement differs by the ATO payment → explained, information (not red)', has(t, 'ℹ Net GST vs GST account movement (accrual, information) — Difference A$1,705.00') && li(t).find((l) => l.includes('Difference')).includes('payments to / refunds from the ATO'), li(t));
  const g = text(t.doc, '#cra-grid');
  ok('grid: tax types with codes and rates, a column per month + Total', ['GST (sales)', 'GST free (sales)', 'GST (purchases)', 'GST on capital', 'CAP', '10%', 'Apr 2026', 'May 2026', 'Jun 2026', 'Total', 'Net GST (collected − paid)'].every((s) => g.includes(s)), g.slice(0, 400));
  const capRow = [...t.doc.querySelectorAll('#cra-grid tr')].find((r) => r.cells[0] && r.cells[0].textContent === 'GST on capital');
  ok('cells = GST per month (capital purchase in May only)', capRow && [...capRow.cells].slice(3).map((c) => c.textContent).join('|') === 'A$0.00|A$400.00|A$0.00|A$400.00', capRow && capRow.textContent);
  ok('bars: collected vs paid for each month', t.doc.querySelectorAll('#cra-bars rect').length === 6);
  ok('sources: one company per connection; refund receipts / deposits disclosed', /another client needs its own QuickBooks connection/.test(text(t.doc, '#qb-sources')) && /Refund receipts and deposits are not read/.test(text(t.doc, '#qb-sources')));

  // client-side views: net view and tax-type filter make no request
  t.calls.length = 0;
  await set(t, 'qb-view', 'net');
  ok('net view shows net amounts (GST-free sales A$6,000.00)', text(t.doc, '#cra-grid').includes('A$6,000.00') && t.calls.filter((c) => c.requery).length === 0);
  await set(t, 'qb-view', 'gst');
  await set(t, 'cra-type', [...t.doc.querySelectorAll('#cra-type option')].find((o) => o.textContent.startsWith('GST on capital')).value);
  ok('tax-type filter is client-side and narrows the grid', !text(t.doc, '#cra-grid').includes('GST (sales)') && text(t.doc, '#cra-grid').includes('(filtered)') && t.calls.filter((c) => c.requery).length === 0, text(t.doc, '#cra-grid').slice(0, 200));
  await set(t, 'cra-type', 'all');

  // controls: a month preset refetches the period bindings (not codes / agencies / company); the GST account ties for May
  t.calls.length = 0;
  await set(t, 'qb-to', '2026-05-31'); await set(t, 'qb-from', '2026-05-01');
  const ids = [...new Set(t.calls.filter((c) => c.requery).map((c) => c.id))].sort();
  ok('date change refetches Tax Summary, GST account and the transaction lists only', JSON.stringify(ids) === JSON.stringify(['bills', 'bs_months', 'credit_memos', 'gst_period', 'invoices', 'journal_entries', 'purchases', 'sales_receipts', 'vendor_credits']), ids);
  ok('transaction filter follows the dates', t.calls.find((c) => c.id === 'invoices' && c.params.where === "TxnDate >= '2026-05-01' AND TxnDate <= '2026-05-31'"), t.calls.filter((c) => c.id === 'invoices').map((c) => c.params.where));
  ok('a month with no ATO payment: net GST = GST account movement passes', has(t, '✓ Net GST = GST account movement (accrual)') && !red(t), li(t));
  t.calls.length = 0;
  await radio(t, 'qb-basis', 'Cash');
  ok('Cash: Tax Summary + GST account refetch with Cash; lists not refetched', t.calls.filter((c) => c.requery).every((c) => ['gst_period', 'bs_months'].includes(c.id)) && t.calls.some((c) => c.id === 'gst_period' && c.params.accounting_method === 'Cash'));
  ok('Cash: ties are information (document dates), account check N/A, not red', !red(t) && li(t).some((l) => l.startsWith('ℹ Σ GST collected')) && has(t, '– Net GST = GST account movement — N/A on Cash basis'), li(t));
  await set(t, 'qb-preset', 'this_fy');
  ok('preset This financial year → Jul 2026 – Jun 2027, 12 month columns', text(t.doc, '#qb-head .pe').startsWith('July 2026 - June 2027') && t.doc.querySelectorAll('#cra-grid thead th').length === 3 + 12 + 1, text(t.doc, '#qb-head .pe'));

  // tampered / truncated / missing sources fail named checks
  const tamper = (id, f) => Object.assign(L.fx(), { [id]: (p) => f(L.fx()[id](p)) });
  t = await run(REF, manifest, tamper('invoices', (r) => { r.QueryResponse.Invoice[0].TxnTaxDetail.TaxLine[0].Amount += 50; return r; })); await t.settle(40);
  ok('tampered tax line → document check and 1A tie fail', red(t) && has(t, '✗ Every document: Σ tax lines = its total tax — Mismatch: Invoice INV-4') && has(t, '✗ Σ GST collected'), li(t));
  t = await run(REF, manifest, tamper('bills', (r) => { const b = r.QueryResponse.Bill[0]; r.QueryResponse.Bill = Array.from({ length: 1000 }, (_, i) => Object.assign({}, b, { Id: 'X' + i, DocNumber: 'X' + i, TxnTaxDetail: { TotalTax: 0, TaxLine: [] }, Line: [], TotalAmt: 0 })); return r; })); await t.settle(40);
  ok('a list at the 1000-row page cap is a failed check, not a silent short total', red(t) && has(t, '✗ Every transaction loaded (no list at the 1000-row page cap) — Possibly truncated at 1000 rows: Bill'), li(t));
  t = await run(REF, manifest, Object.assign(L.fx(), { gst_period: (p) => L.taxSummary(Object.assign({}, p, { agency_id: 'none' })) })); await t.settle(40);
  ok('Tax Summary with no rows while GST transactions exist → fails (agency_id not passed?)', red(t) && has(t, '✗ QuickBooks Tax Summary returned GST for the period'), li(t));
  t = await run(REF, manifest, L.fx(), { fail: { purchases: { code: 'tool_error', message: 'QBO 500' } } }); await t.settle(40);
  ok('a failed list is never silent', red(t) && banner(t).includes('QBO 500'));
  t = await run(REF, manifest, L.fx(), { snapshotInputs: { start_date: '2025-01-01', end_date: '2025-03-31', txn_where: "TxnDate >= '2025-01-01' AND TxnDate <= '2025-03-31'", bs_from: '2024-12-01', agency_id: '1', display: manifest.inputs.find((i) => i.name === 'display').default.replace('last_quarter', 'custom') }, bundleInputs: true }); await t.settle(40);
  ok('nil period (agency known, no GST): information, not red, nothing invented', !red(t) && has(t, 'ℹ GST activity in the period (information) — None') && text(t.doc, '#cra-grid').includes('No GST-coded transactions'), li(t));
  t = await run(REF, manifest, Object.assign(L.fx(), { tax_agencies: () => L.Q('TaxAgency', []) })); await t.settle(40);
  ok('no tax agency: unavailable, not zero', text(t.doc, '#qb-body').includes('No tax agency is set up') && !red(t));

  // snapshot + dark + Excel
  t = await run(REF, manifest, L.fx(), { mode: 'snapshot', snapshotInputs: { agency_id: '1' } });
  ok('snapshot: controls disabled, figures frozen', t.doc.getElementById('qb-preset').disabled && banner(t).includes('Snapshot') && text(t.doc, '#cra-grid').includes('A$3,100.00') && t.calls.every((c) => !c.requery));
  t = await run(REF, manifest, L.fx(), { theme: 'dark' }); await t.settle(40);
  ok('dark theme renders', t.errs.length === 0 && !red(t));
  let x = await xlsxText(t);
  ok('Excel: GST by tax type, Net by tax type, Collected vs paid, Reconciliation + header block', ['GST by tax type', 'Net by tax type', 'Collected vs paid', 'Reconciliation', 'Validation', 'April - June, 2026 · Accrual basis · AUD', 'Enterprise AI Pty Ltd', 'GST on capital'].every((s) => x.includes(s)));

  // LIB-002: reconnect to another company → nothing of the first on the page or in the Excel
  const C1 = ['Enterprise AI', 'Civica', 'Office Supplies', 'A$3,100.00'];
  const fx2 = co2fx(L.fx()); Object.keys(fx2).forEach((k) => { fx[k] = fx2[k]; });
  t = await run(REF, manifest, fx); await t.settle(40);
  ok('company 2 opens on its own data', text(t.doc, '#qb-head .co') === CO2 && C1.every((s) => !text(t.doc, 'body').includes(s)) && has(t, '✓ Σ GST collected (sales tax types) = Tax Summary 1A — A$6,200.00'), li(t));
  fx = L.fx(); t = await run(REF, manifest, fx); await t.settle(40);
  Object.keys(fx2).forEach((k) => { fx[k] = fx2[k]; });
  const b2 = H.hydrate(manifest, fx, {}, [], null, '2026-09-25'); b2.inputs = H.resolve(manifest, {}, '2026-09-25');
  t.w.MyHubReport._deliver(b2); await t.settle(60);
  ok('reconnect on the same page: header and checks are company 2', text(t.doc, '#qb-head .co') === CO2 && !red(t), banner(t).slice(0, 300));
  ok('nothing of company 1 left on the page', C1.every((s) => !text(t.doc, 'body').includes(s)), C1.filter((s) => text(t.doc, 'body').includes(s)));
  x = await xlsxText(t);
  ok('nothing of company 1 in the Excel', C1.every((s) => !x.includes(s)) && x.includes(CO2), C1.filter((s) => x.includes(s)));

  // template copy saved at Jan–Mar 2026 (fixtures: company 2 now)
  t = await conformance(ok, REF, manifest, fx, { start_date: '2026-01-01', end_date: '2026-03-31', bs_from: '2025-12-01', txn_where: "TxnDate >= '2026-01-01' AND TxnDate <= '2026-03-31'" }, 'January - March, 2026');
  await t.settle(40);
  ok('copy shows company 2 only, Jan–Mar figures', text(t.doc, '#qb-head .co') === CO2 && text(t.doc, '#cra-grid').includes('Jan 2026') && !text(t.doc, '#cra-grid').includes('Apr 2026'));
  done();
})();

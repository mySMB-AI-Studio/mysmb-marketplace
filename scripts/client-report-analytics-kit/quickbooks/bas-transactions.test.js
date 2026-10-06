// CRA-07 BAS Related Transactions and GST (QuickBooks): live open, grouped table (tax type / contact / account), client-side filters,
// ties to the Tax Summary, tamper / truncation fail, controls, snapshot, dark, Excel, LIB-002, template copy; plus the shared TX block
// is identical in both tax reports.
const fs = require('fs'), path = require('path');
const { run, suite, co2fx, CO2, xlsxText, text, banner, red, set, radio, conformance } = require('./qb-test-util.js');
const H = require('../harness.js');
const L = require('./qb-tax-ledger.js');
const REF = 'quickbooks/bas-transactions', manifest = require('../build.js').manifest(REF);
const { ok, done } = suite(REF);
const li = (t) => [...t.doc.querySelectorAll('#qb-banner li')].map((l) => l.textContent);
const has = (t, s) => li(t).some((l) => l.startsWith(s));
const block = (f) => { const s = fs.readFileSync(path.join(__dirname, f), 'utf8'); return s.slice(s.indexOf('// >>> TX'), s.indexOf('// <<< TX')); };
const row = (t, ref) => [...t.doc.querySelectorAll('#cra-tx tbody tr')].filter((r) => r.cells[2] && r.cells[2].textContent === ref).map((r) => [...r.cells].map((c) => c.textContent));
(async () => {
  ok('the TX block is identical in tax-by-type and bas-transactions', block('tax-by-type.cfg.js') === block('bas-transactions.cfg.js') && block('tax-by-type.cfg.js').length > 1000);
  let fx = L.fx(), t = await run(REF, manifest, fx); await t.settle(40);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('header: client, platform, BAS quarter, basis', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd' && text(t.doc, '#qb-head .ti').includes('QuickBooks') && text(t.doc, '#qb-head .pe') === 'April - June, 2026 · Accrual basis · AUD');
  ok('banner passes, ties named', !red(t) && has(t, '✓ Σ GST of the sales tax types = Tax Summary 1A — A$3,100.00') && has(t, '✓ Σ GST of the purchase tax types = Tax Summary 1B — A$1,890.00') && has(t, '✓ Grand total GST (collected − paid) = net GST of the period (Tax Summary 9) — A$1,210.00') && has(t, '✓ Every document: QuickBooks TotalAmt'), li(t));
  const tx = text(t.doc, '#cra-tx');
  ok('columns Date, Source, Reference, Contact, Account, Net, GST, Gross', ['Date', 'Source', 'Reference', 'Contact', 'Account', 'Net', 'GST', 'Gross'].every((s) => tx.includes(s)));
  ok('grouped by tax type with subtotals and grand total', tx.includes('GST (sales) 10% · GST — GST on sales (5)') && tx.includes('Total GST on capital 10% · CAP — GST on purchases') && tx.includes('Grand total: net GST (collected − paid)A$1,210.00'), tx.slice(0, 300));
  ok('every source type: invoice, sales receipt, credit note, bill, spend money, supplier credit, journal', ['Invoice', 'Sales receipt', 'Credit note', 'Bill', 'Spend money', 'Supplier credit', 'Journal'].every((s) => tx.includes(s)));
  ok('invoice line: item income account, net + GST = gross', JSON.stringify(row(t, 'INV-4')[0]) === JSON.stringify(['2026-04-05', 'Invoice', 'INV-4', 'Civica Pty Ltd', 'Consulting income', 'A$10,400.00', 'A$1,040.00', 'A$11,440.00']), row(t, 'INV-4'));
  ok('bill: account line and item line (item → its expense account) under one GST rate', row(t, 'BILL-4')[0][4] === 'Office expenses', row(t, 'BILL-4'));
  ok('credit note negative', row(t, 'CN-5')[0][7] === '(A$1,100.00)', row(t, 'CN-5'));
  ok('journal line: own account, rate taken from the same rate', row(t, 'JE-4')[0][4] === 'Office expenses' && tx.includes('GST (purchases) 10% · GST — GST on purchases'), row(t, 'JE-4'));
  ok('account codes disclosed as N/A', /Account codes \(transactions carry the account name/.test(text(t.doc, '#qb-sources')));

  // views + filters are client-side
  t.calls.length = 0;
  await set(t, 'qb-view', 'contact');
  ok('regroup by contact (tax type becomes a column)', text(t.doc, '#cra-tx').includes('Total Civica Pty Ltd') && text(t.doc, '#cra-tx').includes('Tax type') && has(t, '✓ Σ group subtotals = grand total'), li(t));
  await set(t, 'qb-view', 'account');
  ok('regroup by account', text(t.doc, '#cra-tx').includes('Total Hosting') && text(t.doc, '#cra-tx').includes('Total Consulting income'));
  await set(t, 'cra-f-contact', 'AWS');
  ok('contact filter narrows the table', !text(t.doc, '#cra-tx').includes('Civica') && text(t.doc, '#cra-tx').includes('(filtered)'));
  await set(t, 'cra-f-contact', ''); await set(t, 'cra-f-type', 'GST on capital 10% · CAP');
  ok('tax-type filter narrows the table', text(t.doc, '#cra-tx').includes('Computer equipment') && !text(t.doc, '#cra-tx').includes('Hosting'));
  await set(t, 'cra-f-type', ''); await set(t, 'cra-f-account', 'Training income');
  ok('account filter narrows the table', text(t.doc, '#cra-tx').includes('Training income') && !text(t.doc, '#cra-tx').includes('Hosting'));
  ok('views and filters make no request', t.calls.filter((c) => c.requery).length === 0);
  await set(t, 'cra-f-account', ''); await set(t, 'qb-view', 'type');

  // controls
  t.calls.length = 0;
  await set(t, 'qb-preset', 'last_month');
  const ids = [...new Set(t.calls.filter((c) => c.requery).map((c) => c.id))].sort();
  ok('preset refetches the Tax Summary and the transaction lists only', JSON.stringify(ids) === JSON.stringify(['bills', 'credit_memos', 'gst_period', 'invoices', 'journal_entries', 'purchases', 'sales_receipts', 'vendor_credits']), ids);
  ok('last month = August 2026, ties pass', text(t.doc, '#qb-head .pe').startsWith('August 2026') && !red(t) && row(t, 'INV-8').length === 2, li(t));
  await radio(t, 'qb-basis', 'Cash');
  ok('Cash: ties for information, not red', !red(t) && li(t).some((l) => l.startsWith('ℹ Σ GST of the sales tax types')), li(t));

  // tamper / truncation
  const tamper = (id, f) => Object.assign(L.fx(), { [id]: (p) => f(L.fx()[id](p)) });
  t = await run(REF, manifest, tamper('purchases', (r) => { r.QueryResponse.Purchase[0].TotalAmt += 10; return r; })); await t.settle(40);
  ok('tampered document gross → Net + GST = Gross document check fails, names it', red(t) && has(t, '✗ Every document: QuickBooks TotalAmt = Σ line amounts + total tax (Net + GST = Gross) — Mismatch: Spend money EXP-4'), li(t));
  t = await run(REF, manifest, tamper('gst_period', (r) => { r.Rows.Row[5].ColData[1].value = '1.00'; return r; })); await t.settle(40);
  ok('Tax Summary 1B differs → 1B tie fails', red(t) && has(t, '✗ Σ GST of the purchase tax types = Tax Summary 1B'), li(t));
  t = await run(REF, manifest, tamper('invoices', (r) => { const b = r.QueryResponse.Invoice[0]; r.QueryResponse.Invoice = Array.from({ length: 1000 }, () => b); return r; })); await t.settle(40);
  ok('a list at the page cap is a failed check', red(t) && has(t, '✗ Every transaction loaded'), li(t));

  // snapshot + dark + Excel
  t = await run(REF, manifest, L.fx(), { mode: 'snapshot', snapshotInputs: { agency_id: '1' } });
  ok('snapshot: controls disabled, lines frozen', t.doc.getElementById('qb-preset').disabled && text(t.doc, '#cra-tx').includes('INV-4') && t.calls.every((c) => !c.requery));
  t = await run(REF, manifest, L.fx(), { theme: 'dark' }); await t.settle(40);
  ok('dark theme renders', t.errs.length === 0 && !red(t));
  let x = await xlsxText(t);
  ok('Excel: BAS transactions sheet with header block, groups, totals', ['BAS transactions', 'April - June, 2026 · Accrual basis · AUD', 'Enterprise AI Pty Ltd', 'INV-4', 'Net GST (collected − paid)', 'Validation'].every((s) => x.includes(s)));

  // LIB-002
  const C1 = ['Enterprise AI', 'Civica', 'Office Supplies', 'Consulting income', 'A$3,100.00'];
  fx = L.fx(); t = await run(REF, manifest, fx); await t.settle(40);
  const fx2 = co2fx(L.fx()); Object.keys(fx2).forEach((k) => { fx[k] = fx2[k]; });
  const b2 = H.hydrate(manifest, fx, {}, [], null, '2026-09-25'); b2.inputs = H.resolve(manifest, {}, '2026-09-25');
  t.w.MyHubReport._deliver(b2); await t.settle(60);
  ok('reconnect: company 2 only, checks pass', text(t.doc, '#qb-head .co') === CO2 && !red(t) && has(t, '✓ Σ GST of the sales tax types = Tax Summary 1A — A$6,200.00'), li(t));
  ok('nothing of company 1 left on the page', C1.every((s) => !text(t.doc, 'body').includes(s)), C1.filter((s) => text(t.doc, 'body').includes(s)));
  x = await xlsxText(t);
  ok('nothing of company 1 in the Excel', C1.every((s) => !x.includes(s)) && x.includes(CO2), C1.filter((s) => x.includes(s)));
  t = await conformance(ok, REF, manifest, fx, { start_date: '2026-01-01', end_date: '2026-03-31', txn_where: "TxnDate >= '2026-01-01' AND TxnDate <= '2026-03-31'" }, 'January - March, 2026');
  await t.settle(40);
  ok('copy shows company 2 only, Jan–Mar lines', text(t.doc, '#qb-head .co') === CO2 && text(t.doc, '#cra-tx').includes('HB-INV-1') && !text(t.doc, '#cra-tx').includes('HB-INV-4'));
  done();
})();

// CRA-05 Summary of Tax Amounts by Type (Xero) against the Xero kit's ledger: GST by tax type × month rebuilt from the
// documents ties to the books and to the GST account movement (bs_end − bs_start); tampering, failures, paging, cash basis,
// views / filter, snapshot, branding, dark, Excel and LIB-002.
const { suite, hydrate } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, E, run, text, wait, banner, body, green, red, fmt, set, tamper, cellOf } = X;
const ID = 'tax-by-type', REF = 'xero/' + ID, m = X.man(ID), FX = (o) => X.fixtures(m, o);
const { ok, done } = suite('xero/' + ID);
const grid = (t) => [...t.doc.querySelectorAll('#tt-grid tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
const foot = (t) => [...t.doc.querySelectorAll('#tt-grid tfoot tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
(async () => {
  // the books: GST by tax type for Apr–Jun 2026 straight from the ledger documents
  const B = E.books(), q = ['2026-04-01', '2026-06-30'], inQ = (d) => d.date >= q[0] && d.date <= q[1], ok2 = (d) => d.status === 'AUTHORISED' || d.status === 'PAID';
  const out = L.r2(B.docs.filter((d) => d.Type === 'ACCREC' && ok2(d) && inQ(d)).reduce((a, d) => a + d.TotalTax, 0) - B.credits.filter((c) => c.Type === 'ACCRECCREDIT' && inQ(c)).reduce((a, c) => a + c.TotalTax, 0) + B.bank.filter((x) => x.Type === 'RECEIVE' && inQ(x)).reduce((a, x) => a + x.TotalTax, 0));
  const net = E.gst(q[0], q[1]), aprOut = L.r2(B.docs.filter((d) => d.Type === 'ACCREC' && ok2(d) && d.date.startsWith('2026-04')).reduce((a, d) => a + d.TotalTax, 0));
  const t = await run(REF, m, FX()); await wait(200);
  ok('opens on the last complete quarter (Apr–Jun 2026), accrual (the organisation\'s GST basis), mySMB, Xero named', /Xero · Summary of Tax Amounts by Type/.test(text(t.doc, '#xk-head')) && /For the 3 months ended 30 June 2026 · Accrual GST basis/.test(text(t.doc, '#xk-head')) && t.doc.documentElement.classList.contains('style-mysmb'), text(t.doc, '#xk-head'));
  ok('GST collected and net GST = the books', new RegExp('GST collected' + fmt(out)).test(body(t)) && new RegExp('Net GST payable' + fmt(net)).test(body(t)), [out, net, body(t).slice(0, 300)]);
  const g = grid(t), hd = [...t.doc.querySelectorAll('#tt-grid thead th')].map((x) => x.textContent.replace(/[▲▼]/g, '').trim());
  ok('grid: rows = tax types with name, code and rate; columns = Apr, May, Jun 2026 + Total', hd.join('|') === '|Tax type|Code|Rate|Apr 2026|May 2026|Jun 2026|Total' && g.some((r) => r[1] === 'GST on Income' && r[2] === 'OUTPUT' && r[3] === '10%' && r[4] === '$' + aprOut.toLocaleString('en-AU', { minimumFractionDigits: 2 })), [hd, g[0]]);
  ok('footer: total collected, total paid, net GST (= the books)', foot(t).length === 3 && new RegExp(fmt(net) + '$').test(foot(t)[2].join('')), foot(t));
  ok('every check passes incl. the GST account movement (two Balance Sheets), green 6/6', green(t) && /6\/6 checks passed/.test(banner(t)) && /✓ Net GST = the GST account movement on the Balance Sheet/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 700));
  ok('bars: GST collected vs paid for each month', t.doc.querySelectorAll('#tt-bars rect').length === 6);
  ok('documents filtered to the period in Xero (where from the dates)', t.calls.some((c) => c.id === 'invoices' && c.params.where === 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)'));
  // views and filter: client side, no refetch
  const n0 = t.calls.length;
  await set(t, 'tt-filter', 'OUTPUT');
  ok('tax-type filter shows only that tax type, no refetch', grid(t).length === 1 && grid(t)[0][2] === 'OUTPUT' && t.calls.length === n0, grid(t));
  await set(t, 'tt-filter', ''); await set(t, 'xk-view', 'net');
  ok('Net amounts view, no refetch', /Net amounts by tax type/.test(body(t)) && t.calls.length === n0);
  // tampering
  const t1 = await run(REF, m, FX({ bs_end: tamper(L.bs, (rows) => { cellOf(rows, 'GST')[1].Value = '1.00'; }) })); await wait(200);
  ok('GST account on the Balance Sheet disagrees → the movement check fails, difference shown with reasons', /✗ Net GST = the GST account movement/.test(banner(t1)) && /Why it can differ/.test(body(t1)) && red(t1), banner(t1).slice(0, 400));
  const t2 = await run(REF, m, FX({ invoices: (p) => { const r = L.listInvoices(p); r.Invoices[0].TotalTax = r.Invoices[0].TotalTax + 1; return r; } })); await wait(200);
  ok('a document whose lines do not add up to its TotalTax → fails', /✗ Each document's lines add up/.test(banner(t2)), banner(t2).slice(0, 400));
  const t3 = await run(REF, m, FX({ invoices: (p) => { const r = L.listInvoices(p); r.Invoices[0].LineItems = r.Invoices[0].LineItems.map((l) => Object.assign({}, l, { TaxType: 'TAX002' })); return r; } })); await wait(200);
  ok('a tax type missing from the organisation\'s tax rates → fails and names it', /✗ Every tax type used is one of the organisation's tax rates — Unknown: TAX002/.test(banner(t3)), banner(t3).slice(0, 400));
  // failures, 429, paging
  const f1 = await run(REF, m, FX(), { fail: { invoices: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('invoices failed → red, the error shown, no figures', red(f1) && /Xero returned an error/.test(body(f1)) && !/\$/.test(body(f1)));
  const f2 = await run(REF, m, FX({ bs_start: X.busy(L.bs, 1), tax_rates: X.busy(L.listTaxRates, 1) }), { htmlPatch: X.retryFast }); await wait(300);
  ok('HTTP 429 on open → retried, ends green', green(f2) && f2.calls.some((c) => c.requery && c.id === 'tax_rates'), banner(f2).slice(0, 300));
  const f3 = await run(REF, m, FX({ bank_tx: X.endless(L.listBankTransactions, 'BankTransactions') })); await wait(400);
  ok('a list that never ends → stops at 20 pages and fails "All documents in the period loaded"', f3.calls.filter((c) => c.id === 'bank_tx').length === 20 && /✗ All documents in the period loaded — May be truncated/.test(banner(f3)), banner(f3).slice(-300));
  // cash basis (Customise option, and an organisation set to payments)
  const tc = await run(REF, m, FX()); await wait(150); await set(tc, 'xk-opt-b', 'cash'); await wait(300);
  ok('cash basis → the period\'s payments\' invoices are loaded by id, basis said, GST account tie becomes information', tc.calls.some((c) => c.id === 'paid_inv' && c.params.ids) && /Cash GST basis/.test(text(tc.doc, '#xk-head')) && /✓ Cash basis: every payment's invoice loaded/.test(banner(tc)) && /ℹ GST account movement vs net GST/.test(banner(tc)) && green(tc), banner(tc).slice(0, 600));
  // controls, snapshot, branding, dark, Excel
  await set(t, 'xk-preset', 'this_month'); await wait(200);
  ok('This month → refetches the documents and both Balance Sheets for September 2026', t.calls.some((c) => c.id === 'invoices' && c.params.where === 'Date>=DateTime(2026,09,01) AND Date<=DateTime(2026,09,30)') && t.calls.some((c) => c.id === 'bs_start' && c.params.date === '2026-08-31') && /month ended 30 September 2026/.test(text(t.doc, '#xk-head')));
  await set(t, 'xk-branding', 'xero'); ok('Customise → Xero branding', !t.doc.documentElement.classList.contains('style-mysmb'));
  const xs = await X.xlsxOf(t);
  ok('Excel: GST by tax type, net by tax type, reconciliation + validation + parameters', ['GST by tax type', 'Net by tax type', 'GST reconciliation', 'Validation', 'Parameters'].every((s) => xs.includes('name="' + s + '"')));
  const s = await run(REF, m, FX(), { mode: 'snapshot', bundle: hydrate(m, FX(), {}, [], null, '2026-09-25') }); await wait(100);
  ok('snapshot: controls disabled, figures kept', s.doc.getElementById('xk-preset').disabled && new RegExp('Net GST payable' + fmt(net)).test(body(s)) && s.errs.length === 0, body(s).slice(0, 200));
  const d = await run(REF, m, FX(), { theme: 'dark' }); await wait(200);
  ok('dark theme renders, green, no errors', green(d) && d.errs.length === 0);
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

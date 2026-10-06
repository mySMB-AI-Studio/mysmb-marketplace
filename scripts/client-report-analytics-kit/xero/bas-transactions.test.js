// CRA-07 BAS Related Transactions and GST (Xero) against the Xero kit's ledger: every BAS line grouped by tax type with
// subtotals, regrouped by contact / account, filters, ties to the GST summary and the GST account, tampering, paging, cash
// basis, snapshot, dark, Excel and LIB-002.
const { suite, hydrate } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, E, run, text, wait, banner, body, green, red, fmt, set, tamper, cellOf } = X;
const ID = 'bas-transactions', REF = 'xero/' + ID, m = X.man(ID), FX = (o) => X.fixtures(m, o);
const { ok, done } = suite('xero/' + ID);
const lines = (t) => t.doc.querySelectorAll('#bt-table tr.bt-line').length;
(async () => {
  const B = E.books(), q = ['2026-04-01', '2026-06-30'], inQ = (d) => d.date >= q[0] && d.date <= q[1], ap = (d) => d.status === 'AUTHORISED' || d.status === 'PAID';
  const nLines = B.docs.filter((d) => ap(d) && inQ(d)).reduce((a, d) => a + d.LineItems.length, 0) + B.credits.filter(inQ).reduce((a, c) => a + c.LineItems.length, 0) + B.bank.filter((x) => inQ(x) && (x.Type === 'RECEIVE' || x.Type === 'SPEND') && !x.LineItems.some((l) => l.AccountCode === '820')).reduce((a, x) => a + x.LineItems.length, 0);
  const net = E.gst(q[0], q[1]);
  const t = await run(REF, m, FX()); await wait(200);
  ok('opens on last quarter, accrual, mySMB, Xero named in the header', /Xero · BAS Related Transactions and GST/.test(text(t.doc, '#xk-head')) && /For the 3 months ended 30 June 2026 · Accrual GST basis/.test(text(t.doc, '#xk-head')) && t.doc.documentElement.classList.contains('style-mysmb'));
  ok('every BAS line of the period is listed (invoices, bills, credit notes, spend / receive money; ATO payments excluded)', lines(t) === nLines, [lines(t), nLines]);
  const hd = [...t.doc.querySelectorAll('#bt-table thead th')].map((x) => x.textContent);
  ok('columns Date, Source, Reference, Contact, Account (code + name), Tax type, Net, GST, Gross', hd.join('|') === 'Date|Source|Reference|Contact|Account|Tax type|Net|GST|Gross' && /200 · Sales/.test(text(t.doc, '#bt-table')) && /Spend money/.test(text(t.doc, '#bt-table')) && /Bill/.test(text(t.doc, '#bt-table')));
  ok('grouped by tax type: a header and a subtotal row per group; grand total GST = net GST in the books', t.doc.querySelectorAll('#bt-table tr.bt-group').length === t.doc.querySelectorAll('#bt-table tr.bt-sub').length && t.doc.querySelectorAll('#bt-table tr.bt-group').length >= 4 && new RegExp('Grand total.*' + fmt(net) + '\\s*\\S+$').test(text(t.doc, '#bt-table tfoot')), text(t.doc, '#bt-table tfoot'));
  ok('every check passes, green 6/6', green(t) && /6\/6 checks passed/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 700));
  const n0 = t.calls.length;
  await set(t, 'xk-view', 'contact');
  ok('regroup by contact, no refetch, grand total unchanged', /grouped by contact/.test(body(t)) && t.doc.querySelector('#bt-table tr.bt-group').textContent.includes('ATO / Payroll') && new RegExp('Grand total.*' + fmt(net)).test(text(t.doc, '#bt-table tfoot')) && t.calls.length === n0);
  await set(t, 'xk-view', 'account'); ok('regroup by account', /grouped by account/.test(body(t)) && /200 · Sales/.test(text(t.doc, '#bt-table tr.bt-group')));
  await set(t, 'bt-ftt', 'OUTPUT');
  ok('tax-type filter: only GST on Income lines, filtered grand total, no refetch', [...t.doc.querySelectorAll('#bt-table tr.bt-line')].every((tr) => tr.children[5].textContent === 'GST on Income') && /filtered/.test(text(t.doc, '#bt-table tfoot')) && t.calls.length === n0);
  await set(t, 'bt-ftt', ''); await set(t, 'bt-fct', 'Metro Wholesale');
  ok('contact filter', [...t.doc.querySelectorAll('#bt-table tr.bt-line')].every((tr) => tr.children[3].textContent === 'Metro Wholesale') && lines(t) > 0);
  await set(t, 'bt-fct', ''); await set(t, 'xk-view', 'tax');
  // tampering
  const t1 = await run(REF, m, FX({ invoices: (p) => { const r = L.listInvoices(p); r.Invoices[0].Total = r.Invoices[0].Total + 5; return r; } })); await wait(200);
  ok('a document total that its lines do not add up to → the Net + GST = Gross / document check fails', /✗ Every line: Net \+ GST = Gross/.test(banner(t1)) && red(t1), banner(t1).slice(0, 400));
  const t2 = await run(REF, m, FX({ bs_end: tamper(L.bs, (rows) => { cellOf(rows, 'GST')[1].Value = '1.00'; }) })); await wait(200);
  ok('GST account on the Balance Sheet disagrees → fails', /✗ Net GST = the GST account movement/.test(banner(t2)), banner(t2).slice(0, 400));
  const t3 = await run(REF, m, FX({ credit_notes: X.endless(L.listCreditNotes, 'CreditNotes') })); await wait(400);
  ok('lines over the page size: an endless list stops at 20 pages and the truncation is a failed check (never a silent short total)', t3.calls.filter((c) => c.id === 'credit_notes').length === 20 && /✗ All lines in the period loaded/.test(banner(t3)) && red(t3), banner(t3).slice(-300));
  const many = (p) => { const r = L.listInvoices(Object.assign({}, p, { page: 1 })), base = r.Invoices[0], all = []; for (let i = 0; i < 150; i++) all.push(Object.assign({}, base, { InvoiceID: 'm-' + i, InvoiceNumber: 'M-' + i })); r.Invoices = all.slice(((p.page || 1) - 1) * 100, (p.page || 1) * 100); return r; };
  const t4 = await run(REF, m, FX({ invoices: many })); await wait(300);
  ok('150 invoices → page 2 loaded and every line listed', t4.calls.some((c) => c.id === 'invoices' && c.params.page === 2) && /✓ All lines in the period loaded/.test(banner(t4)) && lines(t4) >= 150, [lines(t4), banner(t4).slice(-200)]);
  const f1 = await run(REF, m, FX(), { fail: { credit_notes: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('a failed list → red, no lines', red(f1) && f1.doc.querySelector('#bt-table') == null);
  // cash basis
  const tc = await run(REF, m, FX()); await wait(150); await set(tc, 'xk-opt-b', 'cash'); await wait(300);
  ok('cash basis → lines are invoice / bill payments by payment date, checks still pass', /Invoice payment/.test(text(tc.doc, '#bt-table')) && /Cash GST basis/.test(text(tc.doc, '#xk-head')) && green(tc), banner(tc).slice(0, 500));
  const xs = await X.xlsxOf(t);
  ok('Excel: BAS transactions (grouped, subtotals, grand total) + GST by tax type + validation + parameters', ['BAS transactions', 'GST by tax type', 'Validation', 'Parameters'].every((s) => xs.includes('name="' + s + '"')) && xs.includes('Grand total'));
  const s = await run(REF, m, FX(), { mode: 'snapshot', bundle: hydrate(m, FX(), {}, [], null, '2026-09-25') }); await wait(100);
  ok('snapshot: controls disabled, lines kept', s.doc.getElementById('xk-preset').disabled && lines(s) === nLines && s.errs.length === 0);
  const d = await run(REF, m, FX(), { theme: 'dark' }); await wait(200);
  ok('dark theme renders, green, no errors', green(d) && d.errs.length === 0);
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

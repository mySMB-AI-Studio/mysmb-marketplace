// CRA-07 BAS Related Transactions and GST (MYOB) on the MYOB kit's ledger: every invoice, bill and spend money line of the period,
// grouped by tax type, tying to MYOB's tax code summary; truncation, missing lines, tampered documents and unlisted (receive money) tax
// fail a check; regrouping and filters are client-side; LIB-002 isolation holds.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green, red, fmt, xlsxText, conformance, common } = require('./lib.js');
const { ok, done } = suite('myob/bas-transactions');
const ID = 'bas-transactions', CF = L.CF1, r2 = L.r2;
const Q = { myob_company_file_id: CF, from_date: '2026-04-01', to_date: '2026-06-30' };
const code = (rows, c) => rows.find((r) => r.TaxCode.Code === c) || { TaxCollected: 0, TaxPaid: 0 };
const txRows = (t) => [...t.doc.querySelectorAll('#cra-tx tbody tr.detail-block')].map((r) => [...r.children].map((td) => td.textContent));
(async () => {
  const t = await go(ID), S = L.taxCodeSummary(Object.assign({ reporting_basis: 'Accrual' }, Q)).TaxCodeBreakdown;
  const inv = L.listInvoices(Object.assign({ status: 'All' }, Q)).Items, bills = L.listBills(Object.assign({ status: 'All' }, Q)).Items, il = L.listInvoiceLines(Q).Items, bl = L.listBillLines(Q).Items, sp = L.listSpendMoney(Q).Items;
  const nLines = il.length + bl.length + sp.reduce((a, x) => a + x.Lines.length, 0);
  ok('opens on the last BAS quarter and is green: periods, completeness, document ties, rates, GST per tax type, net GST', green(t) && /✓ Validation: 7\/7 checks passed/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 900));
  ok('every invoice, bill and spend money line is listed once', txRows(t).length === nLines && new RegExp('Lines' + nLines).test(body(t)), { shown: txRows(t).length, nLines });
  ok('GST collected and paid = the tax code summary', new RegExp('GST collected \\(listed\\)' + fmt(code(S, 'GST').TaxCollected) + 'GST paid \\(listed\\)' + fmt(code(S, 'GST').TaxPaid)).test(body(t)), body(t).slice(0, 200));
  const rows = txRows(t), num = (s) => +s.replace(/[^\d.-]/g, '') * (/\(/.test(s) ? -1 : 1);
  ok('every row: Net + GST = Gross; columns Date, Source, Reference, Contact, Account', rows.every((r) => Math.abs(num(r[5]) + num(r[6]) - num(r[7])) < 0.005) && rows[0].length === 8);
  const doc = inv.find((i) => i.TotalTax > 0 && il.filter((l) => l.DocumentUID === i.UID).length === 2), dr = rows.filter((r) => r[2] === doc.Number);
  ok('an item invoice with two lines: the lines\' GST adds up to the invoice\'s GST and its gross to the invoice total', dr.length === 2 && Math.abs(dr.reduce((a, r) => a + num(r[6]), 0) - doc.TotalTax) < 0.005 && Math.abs(dr.reduce((a, r) => a + num(r[7]), 0) - doc.TotalAmount) < 0.005, { dr, tax: doc.TotalTax });
  ok('sources: invoices, bills and spend money (with contact and GL account code + name)', ['Invoice', 'Bill', 'Spend money'].every((s) => rows.some((r) => r[1] === s)) && rows.some((r) => r[1] === 'Spend money' && r[3] === 'Office Hub Supplies' && /^6-3020 Office Supplies$/.test(r[4]) && num(r[6]) > 0));
  ok('grouped by tax type with a header and sales / purchases subtotals per group', /GST — Goods & Services Tax \(10%\) · \d+ lines/.test(text(t.doc, '#cra-tx')) && /GST — sales \(GST collected\)/.test(text(t.doc, '#cra-tx')) && /GST — purchases \(GST paid\)/.test(text(t.doc, '#cra-tx')) && /Grand total — sales/.test(text(t.doc, '#cra-tx tfoot')));
  // client-side views and filters: no refetch
  const n0 = t.calls.length, v = t.doc.getElementById('mk-view'); v.value = 'contact'; v.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('regroup by contact: one group per contact, no refetch', /Harbour Cafe Group · \d+ line/.test(text(t.doc, '#cra-tx')) && t.calls.length === n0);
  v.value = 'account'; v.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('regroup by account', /6-4100 Rent · \d+ line/.test(text(t.doc, '#cra-tx')) && t.calls.length === n0);
  const ft = t.doc.getElementById('cra-f-tax'); ft.value = 'ITS'; ft.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('tax-type filter: only ITS lines, said plainly; checks unchanged; no refetch', txRows(t).length > 0 && txRows(t).length < nLines && /Filtered: \d+ of \d+ lines/.test(body(t)) && green(t) && t.calls.length === n0);
  t.doc.getElementById('cra-f-tax').value = ''; t.doc.getElementById('cra-f-tax').dispatchEvent(new t.w.Event('change')); await wait(20);
  const fc = t.doc.getElementById('cra-f-contact'); fc.value = 'City Property Group'; fc.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('contact filter', txRows(t).length === 3 && txRows(t).every((r) => r[3] === 'City Property Group'), txRows(t).length);
  // a quarter with GST-free sales
  const q1 = await go(ID, null, null, { from_date: '2025-07-01', to_date: '2025-09-30', display: '{"style":"mysmb","p":"custom","v":"tax"}' });
  ok('Jul–Sep 2025: the GST-free (FRE) group appears and still ties', /FRE — GST Free \(0%\)/.test(text(q1.doc, '#cra-tx')) && green(q1), banner(q1).slice(0, 300));
  // failures that must show
  const tr = await go(ID, { inv_lines: (p) => { const r = L.listInvoiceLines(p); r.Items = r.Items.slice(0, 5); r.Truncated = true; r.Count = 5; return r; } });
  ok('invoice lines truncated by the connector → a failed check, never a short total', /✗ Every invoice in the period has its lines.*Truncated at 5,000 lines/.test(banner(tr)) && red(tr), banner(tr).slice(0, 400));
  const tm = await go(ID, { bill_lines: (p) => { const r = L.listBillLines(p); const u = r.Items[0].DocumentUID; r.Items = r.Items.filter((l) => l.DocumentUID !== u); r.Errors = { Professional: 'not enabled' }; return r; } });
  ok('a bill without lines → completeness fails (and names the layout error)', /✗ Every bill in the period has its lines.*1 without lines \(Professional: not enabled\)/.test(banner(tm)) && /✗ GST per tax type/.test(banner(tm)) && red(tm), banner(tm).slice(0, 500));
  const td = await go(ID, { invoices: (p) => { const r = L.listInvoices(p); r.Items[0].TotalAmount = r2(r.Items[0].TotalAmount + 1); return r; } });
  ok('an invoice whose lines do not add up to its total → the document check fails', /✗ Every document’s lines.*lines .* vs document/.test(banner(td)) && red(td), banner(td).slice(0, 400));
  const rm = await go(ID, { gst: (p) => { const r = L.taxCodeSummary(p); code(r.TaxCodeBreakdown, 'GST').TaxCollected = r2(code(r.TaxCodeBreakdown, 'GST').TaxCollected + 15); return r; } });
  ok('GST on receive money (in the summary, not listable) → shown as Not listed and the tie fails, naming receive money', /✗ GST per tax type.*GST collected \$15\.00 — receive money \(no list tool/.test(banner(rm)) && /\$15\.00/.test(text(rm.doc, '#cra-rec')) && /✗ Grand total net GST/.test(banner(rm)) && red(rm), banner(rm).slice(0, 600));
  const cn = await go(ID, { invoices: (p) => { const r = L.listInvoices(p); r.Items.push({ UID: 'cn-1', Number: 'CN0001', Date: '2026-05-10T00:00:00', Customer: { UID: 'c', Name: 'Redwood Dental' }, Status: 'Closed', Subtotal: -100, TotalTax: -10, TotalAmount: -110, BalanceDueAmount: 0, IsTaxInclusive: false }); return r; },
    inv_lines: (p) => { const r = L.listInvoiceLines(p); r.Items.push({ DocumentUID: 'cn-1', Number: 'CN0001', Date: '2026-05-10T00:00:00', Layout: 'Service', Status: 'Closed', IsTaxInclusive: false, Customer: { UID: 'c', Name: 'Redwood Dental' }, RowID: 1, Type: 'Transaction', Description: 'Refund', Total: -100, TaxCode: { UID: 'x', Code: 'GST' }, Account: { UID: 'a', DisplayID: '4-1300', Name: 'Professional Fees' } }); return r; },
    gst: (p) => { const r = L.taxCodeSummary(p); const g = code(r.TaxCodeBreakdown, 'GST'); g.TaxCollected = r2(g.TaxCollected - 10); g.SalesTotal = r2(g.SalesTotal - 110); return r; } });
  ok('a credit note (negative invoice) is listed as a credit note with negative GST and still ties', txRows(cn).some((r) => r[1] === 'Credit note' && r[2] === 'CN0001' && num(r[6]) === -10) && green(cn), banner(cn).slice(0, 300));
  const te = await go(ID, null, { fail: { spend: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('spend money unavailable → failed, never silent', /✗ Data loaded: list_spend_money|✗ Spend money loaded/.test(banner(te)) && red(te), banner(te).slice(0, 300));
  t.doc.getElementById('mk-xlsx').click(); await wait(40); const xs = await xlsxText(t);
  ok('Excel: Transactions grouped by tax type with subtotals, and the tie to the summary', xs.includes('Transactions') && xs.includes('Tie to summary') && xs.includes('Subtotal GST sales') && xs.includes('Basis: Accrual'));
  await common(ID, ok);
  await conformance(ID, ok);
  done();
})();

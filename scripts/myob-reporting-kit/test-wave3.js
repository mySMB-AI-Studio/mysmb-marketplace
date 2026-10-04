// Wave 3 MYOB kit reports — GST Summary (BAS): M06 GST report by tax code, M07 GST return, M61 BAS — against the ledger (ledger.js).
// The tax code summary and payroll summary come from the same books as the journals, so the ties must hold and a tampered source must fail.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), body = (t) => text(t.doc, '#mk-body');
const green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const TOOL = { list_payroll_advices: L.listPayrollAdvices, list_items: L.listItems, list_invoice_lines: L.listInvoiceLines, list_bill_lines: L.listBillLines, list_invoices: L.listInvoices, list_bills: L.listBills, get_balance_sheet: L.balanceSheet, get_gst_summary: L.taxCodeSummary, get_payroll_category_summary: L.payrollCategorySummary, list_tax_codes: L.listTaxCodes, list_journal_transactions: L.listJournalTransactions, list_accounts: L.listAccounts, list_company_files: L.companyFiles };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, opts, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const r2 = (n) => Math.round(n * 100) / 100;
// tampering MYOB's tax code summary
const gstWith = (fn) => (p) => { const r = L.taxCodeSummary(p); fn(r.TaxCodeBreakdown, r); return r; };

(async () => {
  // The quarter the report opens on: preset Last quarter on the harness clock (28 Sep 2026) = Apr–Jun 2026
  const Q = { from_date: '2026-04-01', to_date: '2026-06-30', myob_company_file_id: L.CF1, reporting_basis: 'Accrual' };
  const S = L.taxCodeSummary(Q).TaxCodeBreakdown, row = (c) => S.find((r) => r.TaxCode.Code === c) || { SalesTotal: 0, PurchasesTotal: 0, TaxCollected: 0, TaxPaid: 0 };
  const B = L.expect.books(L.CF1), inQ = (d) => d >= Q.from_date && d <= Q.to_date;
  // independent of the summary: the documents and journals in the books
  const sales = r2(B.invoices.filter((i) => inQ(i.date)).reduce((s, i) => s + i.TotalAmount, 0)), fre = r2(B.invoices.filter((i) => inQ(i.date) && i.TaxCode === 'FRE').reduce((s, i) => s + i.TotalAmount, 0));
  const A1 = r2(B.invoices.filter((i) => inQ(i.date)).reduce((s, i) => s + i.TotalTax, 0));
  const G1 = r2(sales + row('ITS').SalesTotal), G11 = r2(row('GST').PurchasesTotal + row('ITS').PurchasesTotal), B1 = row('GST').TaxPaid + row('CAP').TaxPaid;
  const P = L.payrollCategorySummary(Q).PayrollCategoryBreakdown, W1 = P.find((x) => x.PayrollCategory.Type === 'Wage').Amount, W2 = P.find((x) => x.PayrollCategory.Type === 'Tax').Amount;

  if (!only || only === 'gst') {
    const t = await go('gst');
    const bb = body(t), bn = banner(t);
    ok('gst: opens on the BAS for last quarter, green', green(t) && /BAS \(activity statement\)/.test(text(t.doc, 'header')) && /April - June, 2026/.test(bb), bn.slice(0, 400));
    ok('gst: says Draft — check before lodging, with the mapping', /Draft — check before lodging/.test(bb) && /G2 EXP · G3 FRE · G4 ITS · G10 CAP · left out N-T/.test(bb));
    ok('gst: G1 = every reportable sale incl. GST (invoices + input-taxed interest)', new RegExp('G1Total sales \\(including any GST\\)' + fmt(G1)).test(bb), [G1, bb.slice(0, 900)]);
    ok('gst: G3 = GST-free sales (FRE invoices)', new RegExp('G3Other GST-free sales' + fmt(fre)).test(bb), fre);
    ok('gst: G11 = reportable non-capital purchases (N-T wages left out)', new RegExp('G11Non-capital purchases \\(including any GST\\)' + fmt(G11)).test(bb), G11);
    ok('gst: 1A = GST on the invoices; 1B = GST on bills and spend money', new RegExp('1AGST on sales' + fmt(A1)).test(bb) && new RegExp('1BGST on purchases' + fmt(r2(B1))).test(bb), [A1, B1]);
    ok('gst: W1 / W2 from MYOB payroll categories (the pay runs)', new RegExp('W1Total salary, wages and other payments' + fmt(W1)).test(bb) && new RegExp('W2Amounts withheld from payments shown at W1' + fmt(W2)).test(bb), [W1, W2]);
    const nine = r2(A1 + W2 - B1);
    ok('gst: 8A = 1A + W2, 8B = 1B, 9 = 8A − 8B', new RegExp('8AAmounts you owe the ATO \\(1A \\+ W2\\)' + fmt(r2(A1 + W2))).test(bb) && new RegExp((nine >= 0 ? 'Your payment amount' : 'Your refund amount') + fmt(Math.abs(nine))).test(bb), nine);
    ok('gst: checks — period echoed, each code\'s GST matches its rate, G6 not negative', /✓ MYOB returned the requested period/.test(bn) && /✓ Each tax code’s GST = its rate/.test(bn) && /✓ G1 covers G2 \+ G3 \+ G4/.test(bn), bn.slice(0, 700));
    ok('gst: independent — 1A − 1B = the GST accounts\' movement in the journals, the quarter\'s BAS payment left out', /1A − 1B vs the GST accounts’ movement in the period’s journals.*— the same; 1 BAS payment\(s\) left out/.test(bn), bn.slice(0, 900));
    ok('gst: N-T listed as left out of the BAS', /Codes left out of the BAS \(information\) — N-T \(sales \$0\.00, purchases \$[\d,.]+\)/.test(bn), bn.slice(-500));

    await view(t, 'return');
    const rb = body(t);
    ok('gst return view: G1–G12 worksheet, G6 = G1 − G5', new RegExp('G6Total sales subject to GST \\(G1 − G5\\)' + fmt(r2(G1 - fre - row('ITS').SalesTotal))).test(rb), rb.slice(0, 600));
    const calls = t.calls.length;
    t.doc.getElementById('gst-map-G3').value = ''; t.doc.getElementById('gst-map-G4').value = 'ITS, FRE'; t.doc.getElementById('gst-map-apply').click(); await t.settle(); await wait(30);
    const rb2 = body(t), last = t.setInputsLog[t.setInputsLog.length - 1] || {};
    ok('gst mapping: editing a label redraws without refetching and saves the mapping', t.calls.length === calls && last.bas_map === 'G2=EXP;G3=;G4=ITS,FRE;G10=CAP;X=N-T' && new RegExp('G3Other GST-free sales none' + fmt(0)).test(rb2) && new RegExp('G4Input taxed sales ITS, FRE' + fmt(r2(fre + row('ITS').SalesTotal))).test(rb2), [last.bas_map, rb2.slice(0, 500)]);
    t.doc.getElementById('gst-map-reset').click(); await t.settle(); await wait(30);
    ok('gst mapping: Reset restores the default', (t.setInputsLog[t.setInputsLog.length - 1] || {}).bas_map === 'G2=EXP;G3=FRE;G4=ITS;G10=CAP;X=N-T');

    await view(t, 'codes');
    ok('gst by tax code view: one row per code, N-T marked left out', t.doc.querySelectorAll('#gst-codes tbody tr').length === S.length && /N-T \(left out\)/.test(body(t)), body(t).slice(0, 400));

    // Jul–Sep 2026 (custom period): a quarter with GST-free sales, so G3 and G1 carry FRE
    { const disp = man('gst').inputs.find((i) => i.name === 'display').default.replace('"p":"last_quarter"', '"p":"custom"');
      const q3 = await go('gst', null, null, { from_date: '2026-07-01', to_date: '2026-09-30', display: disp }), b3 = body(q3);
      const Q3 = Object.assign({}, Q, { from_date: '2026-07-01', to_date: '2026-09-30' }), S3 = L.taxCodeSummary(Q3).TaxCodeBreakdown, fre3 = S3.find((r) => r.TaxCode.Code === 'FRE').SalesTotal;
      const g1q3 = r2(S3.filter((r) => r.TaxCode.Code !== 'N-T').reduce((s, r) => s + r.SalesTotal, 0));
      ok('gst Jul–Sep: G3 = the FRE sales and G1 includes them (GST-free counts in total sales)', fre3 > 0 && new RegExp('G3Other GST-free sales' + fmt(fre3)).test(b3) && new RegExp('G1Total sales \\(including any GST\\)' + fmt(g1q3)).test(b3) && green(q3), [fre3, g1q3, b3.slice(0, 700)]); }

    // a code whose GST is not its rate → named failure
    const bad = await go('gst', { gst: gstWith((rows) => { rows.find((r) => r.TaxCode.Code === 'GST').TaxCollected += 50; }) });
    ok('gst: a code whose GST ≠ its rate fails and is named', red(bad) && /✗ Each tax code’s GST = its rate.*Differs: GST \(collected/.test(banner(bad)), banner(bad).slice(0, 500));
    // a file whose totals exclude GST → grossed up, same labels
    const ex = await go('gst', { gst: gstWith((rows) => { rows.forEach((r) => { r.SalesTotal = r2(r.SalesTotal - r.TaxCollected); r.PurchasesTotal = r2(r.PurchasesTotal - r.TaxPaid); }); }) });
    ok('gst: totals that exclude GST are grossed up — G1 unchanged, said in the check', green(ex) && new RegExp('G1Total sales \\(including any GST\\)' + fmt(G1)).test(body(ex)) && /totals exclude GST; GST was added/.test(banner(ex)), banner(ex).slice(0, 500));
    // payroll summary unavailable → W1 / W2 N/A, not a failure
    const np = await go('gst', { payroll: () => ({ __error: 'tool_not_found: get_payroll_category_summary' }) });
    ok('gst: no payroll summary → W1 / W2 N/A with the reason, banner still green', green(np) && /W1Total salary, wages and other payments payroll summary unavailable.*N\/A/.test(body(np)), body(np).slice(0, 900));
    // cash basis → the journals tie is N/A
    const cash = await go('gst', null, null, { basis: 'Cash' });
    ok('gst: cash basis — journals tie N/A, report still green', green(cash) && /N\/A on the cash basis/.test(banner(cash)), banner(cash).slice(0, 600));
    // MYOB answered another period → fails
    const per = await go('gst', { gst: gstWith((rows, r) => { r.StartDate = '2026-01-01T00:00:00'; }) });
    ok('gst: MYOB returning another period fails the period check', red(per) && /✗ MYOB returned the requested period/.test(banner(per)), banner(per).slice(0, 300));
  }
  if (!only || only === 'br') {
    // Bank Reconciliation Status (M17). The books reconcile 1-1110 to 31 Aug 2026 (July's bank fees left uncleared), 1-1120 to
    // 30 Jun 2026, and never the credit card; the harness clock is 28 Sep 2026.
    const T = L.TODAY, from = '2025-07-01', J = L.listJournalTransactions({ myob_company_file_id: L.CF1, from_date: from, to_date: T }).Items;
    const un = (id) => { const ls = []; J.forEach((j) => j.Lines.forEach((l) => { if (l.Account.DisplayID === id && (!l.ReconciledDate || l.ReconciledDate.slice(0, 10) > T)) ls.push(l); })); return ls; };
    const bal = L.expect.balances(T, L.CF1), u1 = un('1-1110'), dep1 = r2(u1.filter((l) => !l.IsCredit).reduce((s, l) => s + l.Amount, 0)), wd1 = r2(u1.filter((l) => l.IsCredit).reduce((s, l) => s + l.Amount, 0));
    const t = await go('br'), bb = body(t), bn = banner(t);
    ok('br: opens as at today, green — balances tie to the journals (two Balance Sheets)', green(t) && /✓ Each account: balance at the date = balance the day before the look-back \+ its journal movement.*3 account\(s\)/.test(bn), bn.slice(0, 500));
    const rowOf = (code) => { const tr = [...t.doc.querySelectorAll('#br-grid tbody tr')].find((r) => (r.cells[0] || {}).textContent.startsWith(code)); return tr ? [...tr.cells].map((x) => x.textContent.trim()) : null; };
    const r1 = rowOf('1-1110'), r2_ = rowOf('1-1120'), rc = rowOf('2-1110');
    ok('br: cheque account — last reconciled 31 Aug, 28 days, up to date, unreconciled deposits / withdrawals from the journals', !!r1 && r1[1] === '2026-08-31' && r1[2] === '28' && r1[3] === 'Up to date' && r1[5] === fmt(dep1).replace(/\\/g, '') && r1[6] === fmt(wd1).replace(/\\/g, ''), [r1, dep1, wd1]);
    ok('br: reconciled balance = balance in MYOB − unreconciled (deposits − withdrawals)', !!r1 && r1[7] === fmt(r2(bal['1-1110'] - dep1 + wd1)).replace(/\\/g, ''), [r1, bal['1-1110']]);
    ok('br: savings overdue (last 30 Jun), credit card never reconciled', !!r2_ && r2_[3] === 'Overdue' && !!rc && rc[1] === 'Never' && rc[3] === 'Never reconciled', [r2_, rc]);
    ok('br: information — accounts not reconciled in 31 days named; July\'s uncleared bank fees are older than 60 days', /Accounts not reconciled in the last 31 days \(information\) — Business Savings Account — last 2026-06-30, 90 days; Business Credit Card — never reconciled/.test(bn) && /Unreconciled transactions older than 60 days \(information\) — \d+ item\(s\)/.test(bn), bn.slice(-600));
    await view(t, 'items');
    ok('br: Unreconciled transactions view lists every unreconciled line', t.doc.querySelectorAll('#br-grid tbody tr').length === un('1-1110').length + un('1-1120').length + un('2-1110').length, t.doc.querySelectorAll('#br-grid tbody tr').length);
    // a journal line missing from the list → the balance tie fails and names the account
    const drop = (p) => { const r = L.listJournalTransactions(p); const j = r.Items.find((x) => x.Description === 'Bank fees' && x.DateOccurred.slice(0, 7) === '2026-09'); if (j) r.Items.splice(r.Items.indexOf(j), 1); return r; };
    const bad = await go('br', { journals: drop });
    ok('br: a journal the list did not return → the balance tie fails, naming the account', red(bad) && /✗ Each account: balance at the date.*Differs: Business Bank Account #1/.test(banner(bad)), banner(bad).slice(0, 400));
  }
  if (!only || only === 'lines') {
    // Invoice / bill lines (list_invoice_lines / list_bill_lines, mcp-servers #636): Item Sales (M39), Item Sales Analysis (M49), Customer
    // Sales (Detail) (M36), Supplier Purchases (Detail) (M44). Period: this financial year to date on the harness clock (28 Sep 2026).
    const P3 = { myob_company_file_id: L.CF1, from_date: '2026-07-01', to_date: L.TODAY, status: 'All' };
    const IL = L.listInvoiceLines(P3).Items, INV = L.listInvoices(P3).Items, sub = r2(INV.reduce((s, i) => s + i.Subtotal, 0));
    const itemTot = (num) => r2(IL.filter((l) => l.Item && l.Item.Number === num).reduce((s, l) => s + l.Total, 0));
    const t = await go('il'), bn = banner(t), bb = body(t);
    ok('il: Item Sales opens green — every invoice\'s lines = its amount on the invoice list', green(t) && new RegExp('✓ Each invoice’s lines add up to its amount on MYOB’s invoice list.*' + INV.length + ' invoice\\(s\\)').test(bn), bn.slice(0, 500));
    ok('il: sales (ex tax) = Σ the invoices\' subtotals; items WID-100 / WID-200 = their lines', new RegExp('Sales \\(ex tax\\)' + fmt(sub)).test(bb) && new RegExp('WID-100 Widget standard[\\d.]+' + fmt(itemTot('WID-100'))).test(bb) && new RegExp('WID-200 Widget deluxe[\\d.]+' + fmt(itemTot('WID-200'))).test(bb), [sub, itemTot('WID-100'), bb.slice(0, 600)]);
    ok('il: lines with no item are grouped by account', /\(no item\) 4-1300/.test(bb), bb.slice(0, 600));
    const a = await go('ia'), ab = body(a), jul = r2(IL.filter((l) => l.Item && l.Item.Number === 'WID-100' && l.Date.slice(0, 7) === '2026-07').reduce((s, l) => s + l.Total, 0));
    ok('ia: Item Sales Analysis — a column per month, WID-100\'s July = its July lines', /Item Sales Analysis/.test(text(a.doc, 'header')) && /Jul 26Aug 26Sep 26/.test(ab) && new RegExp('WID-100 Widget standard' + fmt(jul)).test(ab) && green(a), [jul, ab.slice(0, 500)]);
    { const q = IL.filter((l) => l.Item && l.Item.Number === 'WID-200').reduce((s, l) => s + l.Quantity, 0), cost = r2(q * r2(95 * 0.55)), gm = r2(itemTot('WID-200') - cost);
      ok('ia: estimated cost = units × MYOB average cost; gross margin = sales − cost', new RegExp('WID-200 Widget deluxe.*' + fmt(itemTot('WID-200')) + fmt(cost) + fmt(gm)).test(ab), [cost, gm, ab.slice(0, 700)]); }
    const d = await go('cd'), rows = d.doc.querySelectorAll('#il-grid tbody tr').length;
    ok('cd: Customer Sales (Detail) — one row per invoice line, by customer', /Customer Sales \(Detail\)/.test(text(d.doc, 'header')) && rows === IL.length && green(d), [rows, IL.length]);
    // a line $10 off its invoice → the tie fails and names the invoice
    const off = await go('il', { lines: (p) => { const r = L.listInvoiceLines(p); r.Items[0].Total = r2(r.Items[0].Total + 10); return r; } });
    ok('il: a line that does not add up to its invoice fails, naming the invoice', red(off) && new RegExp('✗ Each invoice’s lines add up.*Differs: ' + IL[0].Number).test(banner(off)), banner(off).slice(0, 400));
    // an invoice whose lines did not come back → its own failure
    const miss = await go('il', { lines: (p) => { const r = L.listInvoiceLines(p); const u = r.Items[0].DocumentUID; r.Items = r.Items.filter((l) => l.DocumentUID !== u); return r; } });
    ok('il: an invoice without lines fails "every invoice has its lines"', red(miss) && /✗ Every invoice in the period has its lines — 1 without lines/.test(banner(miss)), banner(miss).slice(0, 500));
    // more lines than the cap → says choose a shorter period
    const tr = await go('il', { lines: (p) => Object.assign(L.listInvoiceLines(p), { Truncated: true }) });
    ok('il: truncated lines fail and say to choose a shorter period', red(tr) && /✗ All the period’s lines were returned — More than \d+ lines — choose a shorter period/.test(banner(tr)), banner(tr).slice(0, 500));
    // tax-inclusive documents: line totals include GST, the report takes it out (sales ex tax unchanged), the tie uses TotalAmount
    const incl = await go('il', { lines: (p) => { const r = L.listInvoiceLines(p); r.Items.forEach((l) => { l.IsTaxInclusive = true; if (l.TaxCode.Code === 'GST') l.Total = r2(l.Total * 1.1); }); return r; },
      inv: (p) => { const r = L.listInvoices(p); r.Items.forEach((i) => { i.IsTaxInclusive = true; }); return r; } });
    const inclEx = r2(L.listInvoiceLines(P3).Items.reduce((s, l) => s + (l.TaxCode.Code === 'GST' ? r2(r2(l.Total * 1.1) * 100 / 110) : l.Total), 0));
    ok('il: tax-inclusive lines have GST taken out; the tie uses the total', new RegExp('Sales \\(ex tax\\)' + fmt(inclEx)).test(body(incl)) && /✓ Each invoice’s lines add up/.test(banner(incl)), [inclEx, banner(incl).slice(0, 300)]);
    // bills
    const BL = L.listBillLines(P3).Items, BILLS = L.listBills(P3).Items, bsub = r2(BILLS.reduce((s, b) => s + b.Subtotal, 0));
    const b = await go('bd'), bb2 = body(b);
    ok('bd: Supplier Purchases (Detail) green — every bill\'s lines = its amount; purchases = Σ bill subtotals', green(b) && /✓ Each bill’s lines add up to its amount on MYOB’s bill list/.test(banner(b)) && new RegExp('Purchases \\(ex tax\\)' + fmt(bsub)).test(bb2) && b.doc.querySelectorAll('#bd-grid tbody tr').length === BL.length, [bsub, banner(b).slice(0, 300)]);
    await view(b, 'item');
    ok('bd: Purchases by item / account groups the lines by account', b.doc.querySelectorAll('#bd-grid tbody tr').length === new Set(BL.map((l) => l.Account.DisplayID)).size, b.doc.querySelectorAll('#bd-grid tbody tr').length);
    const boff = await go('bd', { lines: (p) => { const r = L.listBillLines(p); r.Items[0].Total = r2(r.Items[0].Total - 5); return r; } });
    ok('bd: a bill line $5 off fails, naming the bill', red(boff) && new RegExp('Differs: ' + BL[0].Number).test(banner(boff)), banner(boff).slice(0, 300));
  }
  if (!only || only === 'payroll') {
    // Payroll (list_payroll_advices, mcp-servers #636): each monthly pay run split into two employees' paycheques. Period: this
    // financial year to date on the harness clock — Jul, Aug, Sep 2026 pay runs.
    const PP = { myob_company_file_id: L.CF1, from_date: '2026-07-01', to_date: L.TODAY }, A = L.listPayrollAdvices({ myob_company_file_id: L.CF1, from_date: '2026-05-01', to_date: '2026-12-31' }).Items.filter((x) => x.PaymentDate.slice(0, 10) >= PP.from_date && x.PaymentDate.slice(0, 10) <= PP.to_date); // by payment date
    const G = r2(A.reduce((s, a) => s + a.GrossPay, 0)), TX = r2(A.reduce((s, a) => s + a.Lines[1].Amount, 0)), SU = r2(A.reduce((s, a) => s + a.Lines[2].Amount, 0));
    const t = await go('py'), bn = banner(t), bb = body(t);
    ok('py: Pay Run History green — wages and PAYG = MYOB\'s payroll category summary', green(t) && new RegExp('✓ Wages and PAYG on the paycheques = MYOB’s payroll category summary.*Wages ' + fmt(G) + ' vs ' + fmt(G) + ' · PAYG ' + fmt(TX) + ' vs ' + fmt(TX)).test(bn), bn.slice(0, 500));
    ok('py: one row per pay run (3) with 2 employees each; totals = the paycheques', t.doc.querySelectorAll('#py-grid tbody tr').length === 3 && new RegExp('Gross pay' + fmt(G)).test(bb) && new RegExp('Superannuation' + fmt(SU)).test(bb), bb.slice(0, 500));
    const r = await go('pyr');
    ok('pyr: Payroll Register — one row per paycheque (6)', /Payroll Register/.test(text(r.doc, 'header')) && r.doc.querySelectorAll('#py-grid tbody tr').length === A.length && green(r), r.doc.querySelectorAll('#py-grid tbody tr').length);
    const s = await go('pys'), sb = body(s);
    ok('pys: Payroll Summary — by payroll category (wages, tax, super)', /Payroll Summary/.test(text(s.doc, 'header')) && new RegExp('WageBase Salary' + fmt(G)).test(sb) && new RegExp('TaxPAYG Withholding' + fmt(TX)).test(sb), sb.slice(0, 600));
    const f = await go('pyf'), fb = body(f), aus = r2(A.filter((a) => a.SuperannuationFund.Name === 'AustralianSuper').reduce((x, a) => x + a.Lines[2].Amount, 0));
    ok('pyf: Accrual by Fund — super accrued per fund, by employee', /Accrual by Fund/.test(text(f.doc, 'header')) && new RegExp('AustralianSuper' + fmt(aus)).test(fb) && f.doc.querySelectorAll('#py-grid2 tbody tr').length === 2, [aus, fb.slice(0, 500)]);
    const p = await go('pyp'), pb = body(p), J = L.listJournalTransactions(PP).Items, paid = r2(J.filter((j) => /^Cash/.test(j.JournalType)).reduce((x, j) => x + j.Lines.filter((l) => l.Account.DisplayID === '2-1420' && !l.IsCredit).reduce((y, l) => y + l.Amount, 0), 0));
    ok('pyp: Superannuation Payments — the cash payments from Superannuation Payable; accrued vs paid for information', /Superannuation Payments/.test(text(p.doc, 'header')) && new RegExp('Super paid' + fmt(paid)).test(pb) && paid > 0 && /Super accrued \(paycheques\) vs paid/.test(banner(p)), [paid, pb.slice(0, 400)]);
    // the category summary disagrees → the tie fails with both figures
    const bad = await go('py', { cats: (q) => { const x = L.payrollCategorySummary(q); x.PayrollCategoryBreakdown[0].Amount = r2(x.PayrollCategoryBreakdown[0].Amount + 100); return x; } });
    ok('py: wages that differ from the category summary fail, with both figures', red(bad) && /✗ Wages and PAYG on the paycheques/.test(banner(bad)), banner(bad).slice(0, 400));
    // no payroll in the period → says so, nothing red
    const none = await go('py', { adv: () => ({ Count: 0, PayRuns: [], Items: [] }), cats: () => ({ PayrollCategoryBreakdown: [] }) });
    ok('py: a period with no pay runs says so', /No pay runs in MYOB for this period/.test(body(none)) && !red(none), banner(none).slice(0, 300));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

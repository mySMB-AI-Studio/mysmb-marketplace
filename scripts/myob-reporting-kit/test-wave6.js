// Transactions and banking reports that were written specifications: Customer Transactions (M37), Supplier Transactions (M45, derived),
// Bank Activity (M15), Bank Transactions (M16) and Coding (M18) — against the ledger, with tampered sources that must fail.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_journal_transactions: L.listJournalTransactions, list_accounts: L.listAccounts, get_balance_sheet: L.balanceSheet, list_company_files: L.companyFiles, list_invoices: L.listInvoices, list_bills: L.listBills, list_payments: L.listPayments, list_supplier_payments: L.listSupplierPayments, list_bank_statement_lines: L.listBankStatementLines };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const pick = async (t, id, v) => { const el = t.doc.getElementById(id); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(20); };
const said = (t) => t.setInputsLog[t.setInputsLog.length - 1] || {};
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
const $ = (v) => '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const drop = (fn, test) => (p) => { const r = fn(p); r.Items = r.Items.filter((x, i) => !test(x, i)); r.Count = r.Items.length; return r; };
(async () => {
  // ---------------- Customer Transactions (M37)
  let t = await go('tr');
  const P = { from_date: said(t).from_date, to_date: said(t).to_date, myob_company_file_id: L.CF1 };
  const inv = L.listInvoices(Object.assign({ status: 'All' }, P)).Items, pay = L.listPayments(Object.assign({ page_size: 1000 }, P)).Items, sum = (a, k) => Math.round(a.reduce((s, x) => s + x[k], 0) * 100) / 100;
  ok('customer transactions: 3/3 checks — invoices − payments = the Accounts Receivable movement', t.errs.length === 0 && green(t) && /3\/3 checks passed/.test(banner(t)) && /✓ Invoices − payments = the movement of Accounts Receivable/.test(banner(t)), [t.errs, banner(t).slice(0, 400)]);
  ok('customer transactions: KPIs invoices ' + $(sum(inv, 'TotalAmount')) + ', payments ' + $(sum(pay, 'AmountReceived')), kpi(t, 'Invoices') === $(sum(inv, 'TotalAmount')) && kpi(t, 'Payments') === $(sum(pay, 'AmountReceived')), [kpi(t, 'Invoices'), kpi(t, 'Payments')]);
  const cust = inv[0].Customer;
  ok('customer transactions: a block per customer with a total', /Total for /.test(text(t.doc, '#mk-body')) && text(t.doc, '#mk-body').includes(cust.Name));
  let n0 = t.calls.length; await pick(t, 'tr-who', cust.UID);
  ok('customer transactions: picking a customer shows only them, no refetch', t.calls.length === n0 && text(t.doc, 'header .ti') === 'Customer Transactions — ' + cust.Name && JSON.parse(said(t).display).x === cust.UID && [...t.doc.querySelectorAll('#mk-body tr.k-header')].length === 1);
  await pick(t, 'tr-who', ''); await view(t, 'list');
  ok('customer transactions: all transactions in date order with a running net', t.doc.querySelectorAll('#mk-body tbody tr.k-row').length === inv.length + pay.length && green(t));
  t = await go('tr', { invoices: drop(L.listInvoices, (x, i) => i === 0) });
  ok('customer transactions: an invoice missing from the list fails the tie', red(t) && /✗ Invoices − payments = the movement of Accounts Receivable/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('tr', { invoices: (p) => { const r = L.listInvoices(p); r.Items = r.Items.concat([Object.assign({}, r.Items[0], { UID: 'cn1', Number: 'CN0001', TotalAmount: -110, Status: 'Credit' })]); return r; } });
  ok('customer transactions: a credit note shows as a credit', /Credit note/.test(text(t.doc, '#mk-body')) && kpi(t, 'Credit notes') === '$110.00', kpi(t, 'Credit notes'));
  t = await go('tr', { payments: () => ({ Items: Array.from({ length: 1000 }, (_, i) => ({ UID: 'p' + i, Date: '2026-09-10T00:00:00', Customer: { UID: 'c', Name: 'Bulk' }, AmountReceived: 1 })) }) });
  ok('customer transactions: 1,000 payments → a warning, the tie and the load check N/A', /some may be missing/.test(text(t.doc, '#mk-body')) && /– Invoices − payments .*N\/A — payments may be cut off/.test(banner(t)) && /– All payments in the period were loaded/.test(banner(t)), banner(t).slice(0, 400));

  // ---------------- Supplier Transactions (M45, derived)
  t = await go('ts');
  const bills = L.listBills(Object.assign({ status: 'All' }, P)).Items, sp = L.listSupplierPayments(Object.assign({ page_size: 1000 }, P)).Items;
  ok('supplier transactions: 3/3 checks — bills − payments = the Accounts Payable movement', t.errs.length === 0 && green(t) && /✓ Bills − payments = the movement of Accounts Payable/.test(banner(t)) && text(t.doc, 'header .ti') === 'Supplier Transactions', banner(t).slice(0, 400));
  ok('supplier transactions: KPIs bills ' + $(sum(bills, 'TotalAmount')) + ', payments ' + $(sum(sp, 'AmountPaid')), kpi(t, 'Bills') === $(sum(bills, 'TotalAmount')) && kpi(t, 'Payments') === $(sum(sp, 'AmountPaid')) && /All suppliers/.test(text(t.doc, '#mk-body')), [kpi(t, 'Bills'), kpi(t, 'Payments')]);
  t = await go('ts', { payments: drop(L.listSupplierPayments, (x, i) => i === 0) });
  ok('supplier transactions: a payment missing from the list fails the tie', red(t) && /✗ Bills − payments/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Bank Activity (M15)
  t = await go('ba');
  ok('bank activity: 2/2 checks — every bank and card account ties to the Balance Sheet', t.errs.length === 0 && green(t) && /2\/2 checks passed/.test(banner(t)) && /3 accounts/.test(banner(t)), banner(t).slice(0, 400));
  ok('bank activity: a block per bank and card account, the card shown as owed', ['1-1110', '1-1120', '2-1110'].every((c) => text(t.doc, '#mk-body').includes(c)) && /credit card — balance owed/.test(text(t.doc, '#mk-body')));
  ok('bank activity: transaction types from the journal source', /Spend money/.test(text(t.doc, '#mk-body')) && /Customer payment/.test(text(t.doc, '#mk-body')));
  const accs = L.listAccounts({ myob_company_file_id: L.CF1 }).Items, bank = accs.find((a) => a.DisplayID === '1-1110');
  const close = L.expect.balances(P.to_date, L.CF1)['1-1110'], open = L.expect.balances(L.addDays(P.from_date, -1), L.CF1)['1-1110'];
  n0 = t.calls.length; await pick(t, 'ba-acc', bank.UID);
  ok('bank activity: one account — opening ' + $(open) + ' and closing ' + $(close) + ' from the Balance Sheet, no refetch', t.calls.length === n0 && kpi(t, 'Opening balance') === $(open) && kpi(t, 'Closing balance') === $(close) && t.doc.querySelectorAll('#mk-body tbody').length === 1, [kpi(t, 'Opening balance'), kpi(t, 'Closing balance')]);
  await view(t, 'summary');
  ok('bank activity: summary by account', /Business Bank Account #1/.test(text(t.doc, '#mk-body')) && green(t));
  t = await go('ba', { journals: (p) => { const r = L.listJournalTransactions(p); r.Items = r.Items.filter((x) => !(x.Lines.some((l) => l.Account.DisplayID === '1-1110') && x.JournalType === 'CashPayment')).concat(r.Items.filter((x) => x.Lines.some((l) => l.Account.DisplayID === '1-1110') && x.JournalType === 'CashPayment').slice(1)); return r; } });
  ok('bank activity: a missing bank journal fails the Balance Sheet tie', red(t) && /✗ Every bank and credit-card account/.test(banner(t)) && /1-1110/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Bank Transactions (M16) and Coding (M18)
  t = await go('bt');
  const SL = L.listBankStatementLines(Object.assign({ status: 'All' }, P)).Items, cnt = (s) => SL.filter((x) => x.Status === s).length;
  ok('bank transactions: 2/2 checks, and coded lines match the ledger (information)', t.errs.length === 0 && green(t) && /2\/2 checks passed/.test(banner(t)) && /coded .* vs ledger .*✓/.test(banner(t)), banner(t).slice(0, 500));
  ok('bank transactions: ' + SL.length + ' lines, Uncoded (' + cnt('Uncoded') + ') flagged', kpi(t, 'Lines') === String(SL.length) && kpi(t, 'Uncoded (' + cnt('Uncoded') + ')') != null && /uncoded lines? to code in MYOB/.test(text(t.doc, '#mk-body')), [kpi(t, 'Lines'), cnt('Uncoded')]);
  ok('bank transactions: per account with a running total and the reference', /Running total/.test(text(t.doc, '#mk-body thead')) && /Business Credit Card/.test(text(t.doc, '#mk-body')) && SL.some((x) => x.Reference && text(t.doc, '#mk-body').includes(x.Reference)));
  n0 = t.calls.length; await pick(t, 'bt-acc', bank.UID);
  ok('bank transactions: account picker, no refetch', t.calls.length === n0 && t.doc.querySelectorAll('#mk-body tbody').length === 1 && /Business Bank Account #1/.test(text(t.doc, 'header .ti')));
  t = await go('bc');
  const h3 = [...t.doc.querySelectorAll('#mk-body h3')].map((x) => x.textContent);
  ok('coding: opens on the coding view, uncoded first', text(t.doc, 'header .ti') === 'Coding' && /^Uncoded \(/.test(h3[0] || '') && h3.some((x) => /^Coded \(/.test(x)) && h3.some((x) => /^Hidden \(/.test(x)) && green(t), h3);
  await view(t, 'transactions');
  ok('coding: the bank transactions view is there (title follows the view)', text(t.doc, 'header .ti') === 'Bank Transactions');
  t = await go('bt', { lines: () => ({ Items: [] }) });
  ok('bank transactions: no feed lines → says bank feeds may not be set up, not red', /bank feeds may not be set up/.test(text(t.doc, '#mk-body')) && !red(t) && t.errs.length === 0, banner(t).slice(0, 200));
  t = await go('bt', { lines: (p) => { const r = L.listBankStatementLines(p); r.Items = r.Items.map((x, i) => (i ? x : Object.assign({}, x, { Status: '' }))); return r; } });
  ok('bank transactions: a line without a status fails', red(t) && /✗ Every line has a coding status/.test(banner(t)), banner(t).slice(0, 300));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

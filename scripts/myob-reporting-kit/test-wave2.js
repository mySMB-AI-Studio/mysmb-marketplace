// Wave 2 MYOB kit reports — payables (Unpaid bills M40, Aged payables, Payables reconciliation M41/M42, Purchase register M46,
// Supplier purchases M43) — against the ledger (ledger.js): ties pass on one set of books, a tampered source fails. node test-wave2.js [report]
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), body = (t) => text(t.doc, '#mk-body');
const green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, opts, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const tamperBs = (id, delta) => (p) => { const r = L.balanceSheet(p); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === id) x.AccountTotal = Math.round((x.AccountTotal + delta) * 100) / 100; }); return r; };
const E = L.expect, T = L.TODAY, FY = '2026-07-01';

(async () => {
  const ap = E.balances(T, L.CF1)['2-1200'];
  if (!only || only === 'ub') {
    const t = await go('ub');
    ok('ub: total due = the payables account (2-1200), green', green(t) && new RegExp('Total due = the payables account on the Balance Sheet \\(2-1200\\) — ' + fmt(ap) + ' vs ' + fmt(ap)).test(banner(t)), banner(t).slice(0, 500));
    ok('ub: MYOB\'s columns, ageing by bill date by default', /Supplier nameSupplier number0 - 3031 - 6061 - 9090\+Total due \(\$\)/.test(body(t)), body(t).slice(0, 300));
    await view(t, 'bills');
    ok('ub: Bills view lists each open bill', t.doc.querySelectorAll('#ar-grid tbody tr').length === L.listBills({ myob_company_file_id: L.CF1, status: 'Open' }).Items.length);
    const tt = await go('ub', { bs: tamperBs('2-1200', 50) });
    ok('ub: payables account $50 off → the tie fails with the out-of-balance amount', /✗ Total due = the payables account/.test(banner(tt)) && /out of balance \(\$50\.00\)/.test(banner(tt)) && red(tt), banner(tt).slice(0, 400));
    const a = await go('ap');
    ok('ap (Aged payables): opens aged by due date (Not due column), same total, green', /Aged Payables/.test(text(a.doc, 'header')) && /Not due1 - 30/.test(body(a)) && new RegExp('Total due' + fmt(ap)).test(body(a)) && green(a), text(a.doc, 'header'));
  }
  if (!only || only === 'pr') {
    const t = await go('pr');
    ok('pr: out of balance 0.00, in balance, green', green(t) && /Out of balance\$0\.00/.test(body(t)) && /In balance/.test(body(t)), banner(t).slice(0, 400));
    await view(t, 'exceptions');
    ok('pr: Exceptions view (M42) — the tie-out only, "No exceptions"', /No exceptions/.test(body(t)) && /Payables reconciliation exceptions/.test(body(t)));
    const tr = await go('pr', { bs: tamperBs('2-1200', -75) });
    ok('pr: payables account $75 short → out of balance $75.00, red, possible causes listed', /Out of balance amount\$75\.00/.test(body(tr)) && red(tr), body(tr).slice(0, 300));
    await view(tr, 'exceptions');
    ok('pr: exceptions view names the possible causes', /supplier payment or debit not applied to a bill/.test(body(tr)), body(tr).slice(0, 500));
    // live QA, 4 Oct 2026: tax-inclusive bills (MYOB's Subtotal already includes the tax) failed "subtotal + tax = total" — 9 of 10
    const incl = (p) => { const r = L.listBills(p); r.Items.forEach((b) => { b.IsTaxInclusive = true; b.Subtotal = b.TotalAmount; }); return r; };
    const ti = await go('pr', { bills: incl });
    ok('pr: tax-inclusive bills (subtotal includes the tax) pass the per-bill check, green', green(ti) && /✓ Each bill: subtotal \+ freight \+ tax = total/.test(banner(ti)), banner(ti).slice(0, 500));
    const freight = (p) => { const r = L.listBills(p); r.Items.forEach((b, i) => { if (i === 0) { b.Freight = 50; b.TotalAmount = Math.round((b.TotalAmount + 50) * 100) / 100; } }); return r; };
    const tf = await go('pr', { bills: freight });
    ok('pr: freight counts towards the total', /✓ Each bill: subtotal \+ freight \+ tax = total/.test(banner(tf)), banner(tf).slice(0, 500));
    const off = (p) => { const r = L.listBills(p); const b = r.Items.find((x) => x.TotalTax); b.Subtotal = Math.round((b.Subtotal + 10) * 100) / 100; return r; };
    const to = await go('pr', { bills: off });
    ok('pr: a bill that does not add up is named with its figures', red(to) && /✗ Each bill: subtotal \+ freight \+ tax = total.*1 bill\(s\) differ, e\.g\. \d+ \(\$[\d,.]+ \+ tax \$[\d,.]+ = \$[\d,.]+ vs total \$[\d,.]+\)/.test(banner(to)), banner(to).slice(0, 600));
  }
  if (!only || only === 'pg') {
    const t = await go('pg'), bills = L.listBills({ myob_company_file_id: L.CF1, status: 'All', from_date: FY, to_date: T }).Items, tot = Math.round(bills.reduce((s, b) => s + b.TotalAmount, 0) * 100) / 100;
    ok('pg: Σ bills = the payables account\'s movement in the journals (payments left out); amount due = the payables account; green', green(t) && new RegExp('payables account\'s movement in the period\'s journals, leaving out supplier payments.*' + fmt(tot) + ' vs ' + fmt(tot)).test(banner(t)) && /✓ Σ amount due = the payables account/.test(banner(t)), banner(t).slice(0, 600));
    // a supplier debit note (a negative bill) reduces the payables account in a purchase journal: still equal
    const dn = { UID: 'dn1', Number: 'DN1', Date: '2026-08-20T00:00:00', Supplier: { UID: 'x', Name: 'Metro Wholesale', DisplayID: 'SUP000001' }, Status: 'Closed', Subtotal: -100, TotalTax: -10, TotalAmount: -110, BalanceDueAmount: 0, Terms: { DueDate: '2026-08-20T00:00:00' } };
    const tdn = await go('pg', { bills: (p) => { const r = L.listBills(p); r.Items.push(dn); r.Count++; return r; }, journals: (p) => { const r = L.listJournalTransactions(p); r.Items.push({ DisplayID: 'PJ9', JournalType: 'Purchase', DateOccurred: '2026-08-20T00:00:00', Lines: [{ Account: { DisplayID: '2-1200', Name: 'Trade Creditors' }, Amount: 110, IsCredit: false }, { Account: { DisplayID: '5-1000', Name: 'Purchases' }, Amount: 100, IsCredit: true }, { Account: { DisplayID: '2-1330', Name: 'GST Paid' }, Amount: 10, IsCredit: true }] }); return r; } });
    ok('pg: a supplier debit note (negative bill and its purchase journal) still ties, green', /✓ Σ bill amounts/.test(banner(tdn)) && green(tdn), banner(tdn).slice(0, 400));
    ok('pg: MYOB\'s columns — Date | PO No. | Supplier Inv No. | Supplier name | Amount | Amount due | Status', /DatePO No\.Supplier Inv No\.Supplier nameAmount \(\$\)Amount due \(\$\)Status/.test(body(t)) && t.doc.querySelectorAll('#pg-grid tbody tr').length === bills.length);
    const st = t.doc.getElementById('mk-enum-0'); st.value = 'Open'; st.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    ok('pg: Bill status = Open → only open bills, no refetch', [...t.doc.querySelectorAll('#pg-grid tbody tr')].every((tr) => /Open$/.test(tr.textContent.trim())) && t.calls.filter((c) => c.requery).length === 0);
    const tj = await go('pg', { journals: (p) => { const r = L.listJournalTransactions(p); r.Items.push({ DisplayID: 'GJ9', JournalType: 'General', DateOccurred: '2026-08-15T00:00:00', Lines: [{ Account: { DisplayID: '6-1100', Name: 'Advertising' }, Amount: 40, IsCredit: false }, { Account: { DisplayID: '2-1200', Name: 'Trade Creditors' }, Amount: 40, IsCredit: true }] }); return r; } });
    ok('pg: a general journal straight to the payables account → the bills-vs-journals tie fails by $40.00', /✗ Σ bill amounts/.test(banner(tj)) && /difference \$40\.00/.test(banner(tj)) && red(tj), banner(tj).slice(0, 500));
    const part = await go('pg', {}, {}, { from_date: '2026-09-01', display: man('pg').inputs.find((i) => i.name === 'display').default.replace('this_fy_td', 'custom') });
    const allOpenInSep = L.listBills({ myob_company_file_id: L.CF1, status: 'Open' }).Items.every((b) => b.Date.slice(0, 10) >= '2026-09-01');
    ok('pg: a period without every open bill → the payables-account line is information, not a failure', allOpenInSep ? /✓ Σ amount due/.test(banner(part)) : /ℹ Σ amount due vs the payables account \(information/.test(banner(part)) && !red(part), banner(part).slice(0, 500));
    const s = await go('sp');
    ok('sp (Supplier purchases): opens on the supplier view, balances tie to the payables account, green', /Supplier Purchases/.test(text(s.doc, 'header')) && /Supplier nameSupplier numberPurchase amount/.test(body(s)) && /✓ Every supplier's current balance/.test(banner(s)) && green(s), banner(s).slice(0, 500));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

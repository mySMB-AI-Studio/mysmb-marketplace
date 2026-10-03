// Wave 1 MYOB kit reports against the ledger (ledger.js): every response comes from one set of books, so each report's ties must
// pass, and a tampered source must fail. node test-wave1.js [report]
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), body = (t) => text(t.doc, '#mk-body');
const green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_invoices: L.listInvoices, list_journal_transactions: L.listJournalTransactions };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; return c; };
const go = async (r, over, opts) => { const m = onFile(man(r)); const t = await run(r, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const tamperBs = (id, delta, onDate) => (p) => { const r = L.balanceSheet(p); if (!onDate || p.date === onDate) r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === id) x.AccountTotal = Math.round((x.AccountTotal + delta) * 100) / 100; }); return r; };
const E = L.expect, T = L.TODAY, FY = '2026-07-01';

(async () => {
  if (!only || only === 'tb') {
    const t = await go('tb'), bal = E.balances(T, L.CF1), np = E.netProfit(FY, T, false, L.CF1);
    ok('tb: debits = credits, CYE = profit year to date, green', green(t) && /3\/3 checks passed/.test(banner(t)) && new RegExp('Current Year Earnings.*' + fmt(np) + ' vs ' + fmt(np)).test(banner(t)), banner(t).slice(0, 500));
    ok('tb: Current Year Earnings is left out (its detail is the income and expense accounts)', !/3-9000/.test(body(t)) && /4-1400/.test(body(t)) && /6-5130/.test(body(t)));
    const bankRow = [...t.doc.querySelectorAll('#tb-grid tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())).find((r) => r[0] === '1-1110');
    ok('tb: the bank (an asset with a debit balance) is in the Debit column at its Balance Sheet value', bankRow && new RegExp('^' + fmt(bal['1-1110']) + '$').test(bankRow[3]) && bankRow[4] === '', bankRow);
    const od = await go('tb', { bs: tamperBs('1-1110', -2 * bal['1-1110'] - 100) }), odRow = [...od.doc.querySelectorAll('#tb-grid tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())).find((r) => r[0] === '1-1110');
    ok('tb: an overdrawn bank moves to the Credit column (and the trial balance no longer balances on the tampered data)', odRow && odRow[3] === '' && /\$/.test(odRow[4]) && /✗ Total debits = total credits/.test(banner(od)), odRow);
    const tt = await go('tb', { bs: tamperBs('3-9000', 100) });
    ok('tb: Current Year Earnings ≠ the year\'s profit → that check fails, red', /✗ Current Year Earnings/.test(banner(tt)) && red(tt), banner(tt).slice(0, 400));
    // a file not rolled over: Retained Earnings still lacks last year's profit → debits ≠ credits by exactly that profit → its own line
    const last = E.netProfit('2025-07-01', '2026-06-30', false, L.CF1), tu = await go('tb', { bs: tamperBs('3-8000', -last) });
    ok('tb: last year\'s profit not closed → shown as its own line and the trial balance still balances', /Prior year earnings not yet closed/.test(body(tu)) && /✓ Total debits = total credits/.test(banner(tu)), banner(tu).slice(0, 400));
  }
  if (!only || only === 'ar') {
    const t = await go('ar'), ar = E.balances(T, L.CF1)['1-1200'];
    ok('ar: total due = the receivables account (1-1200), green', green(t) && new RegExp('Total due = the receivables account on the Balance Sheet \\(1-1200\\) — ' + fmt(ar) + ' vs ' + fmt(ar)).test(banner(t)), banner(t).slice(0, 500));
    ok('ar: MYOB\'s columns, ageing by invoice date by default', /Customer nameCustomer number0 - 3031 - 6061 - 9090\+Total due \(\$\)/.test(body(t)), body(t).slice(0, 300));
    const n0 = t.calls.length, sel = t.doc.getElementById('mk-enum-0'); sel.value = 'Due date'; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    ok('ar: ageing by due date → a Not due column, the same total, no refetch', /Not due1 - 30/.test(body(t)) && new RegExp('Total due' + fmt(ar)).test(body(t)) && t.calls.slice(n0).filter((c) => c.requery).length === 0, body(t).slice(0, 300));
    const ta = await go('ar', { bs: tamperBs('1-1200', 50) });
    ok('ar: a receivables account $50 off → the tie fails with the out-of-balance amount', /✗ Total due = the receivables account/.test(banner(ta)) && /out of balance \(\$50\.00\)/.test(banner(ta)) && red(ta), banner(ta).slice(0, 400));
    const ag = await go('ag');
    ok('ag (Aged receivables): opens aged by due date, same total', /Aged receivables/.test(text(ag.doc, 'header')) && /Not due/.test(body(ag)) && green(ag), text(ag.doc, 'header'));
  }
  if (!only || only === 'rr') {
    const t = await go('rr');
    ok('rr: out of balance 0.00, in balance, green', green(t) && /Out of balance\$0\.00/.test(body(t)) && /In balance/.test(body(t)), banner(t).slice(0, 400));
    await view(t, 'exceptions');
    ok('rr: Exceptions view (M34) — the tie-out only, "No exceptions"', /No exceptions/.test(body(t)) && !t.doc.querySelector('#rr-grid'));
    const tr = await go('rr', { bs: tamperBs('1-1200', -75) });
    ok('rr: receivables account $75 short → out of balance $75.00, red', /Out of balance amount\$75\.00/.test(body(tr)) && red(tr) && /Out of balance/.test(body(tr)), body(tr).slice(0, 300));
  }
  if (!only || only === 'sr') {
    const t = await go('sr'), inc = E.plByAccount(FY, T, false, L.CF1), income = Math.round(((inc['4-1300'] || 0) + (inc['4-1400'] || 0)) * 100) / 100;
    ok('sr: Σ sale amount = P&L income for the period, amount due = receivables, green', green(t) && new RegExp('Income on the Profit and Loss for the period.*' + fmt(income) + ' vs ' + fmt(income)).test(banner(t)), banner(t).slice(0, 500));
    const st = t.doc.getElementById('mk-enum-0'); st.value = 'Open'; st.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    ok('sr: Sale status = Open → only open invoices listed', [...t.doc.querySelectorAll('#sr-grid tbody tr')].every((tr) => /Open$/.test(tr.textContent.trim())), body(t).slice(0, 200));
    const m = onFile(man('sr')); m.inputs.find((i) => i.name === 'from_date').default = '2026-09-01'; m.inputs.find((i) => i.name === 'display').default = m.inputs.find((i) => i.name === 'display').default.replace('this_fy_td', 'custom');
    const ts = await run('sr', m, FX(m), { bundleInputs: true }); await wait(80);
    ok('sr: a period without every open invoice → the receivables line is information, not a failure', /ℹ Σ amount due vs the receivables account \(information/.test(banner(ts)) && !red(ts), banner(ts).slice(0, 500));
    const cs = await go('cs');
    ok('cs (Customer sales): opens on the customer view, balances tie to the receivables account', /Customer sales/.test(text(cs.doc, 'header')) && /Customer nameCustomer numberSale amount/.test(body(cs)) && /✓ Every customer's current balance/.test(banner(cs)) && green(cs), banner(cs).slice(0, 500));
  }
  if (!only || only === 'cm') {
    const t = await go('cm');
    ok('cm: closing = opening + net cash movement, green (financial year to date)', green(t) && /✓ Closing balance = opening balance \+ net cash movement/.test(banner(t)), banner(t).slice(0, 400));
    await view(t, 'bank');
    ok('cm: Bank accounts view — every bank account with opening, movement, closing', /1-1110/.test(body(t)) && /1-1120/.test(body(t)) && /Opening balance/.test(body(t)));
    const tc = await go('cm', { bs_close: tamperBs('1-1110', 20, T) });
    ok('cm: a bank balance $20 off on the closing Balance Sheet → the tie fails', /✗ Closing balance = opening balance \+ net cash movement/.test(banner(tc)) && red(tc), banner(tc).slice(0, 400));
  }
  if (!only || only === 'gl') {
    const t = await go('gl');
    ok('gl: this month — debits = credits, balance-sheet and P&L ties, green', green(t) && /3\/3 checks passed/.test(banner(t)), banner(t).slice(0, 500));
    await view(t, 'transactions');
    ok('gl: Transactions view lists journal lines', t.doc.querySelectorAll('#gl-grid tbody tr').length > 10);
    const tj = await go('gl', { journals: (p) => { const r = L.listJournalTransactions(p); r.Items[0].Lines[0].Amount += 5; return r; } });
    ok('gl: a journal line $5 off → out of balance and the ties fail', /✗ Σ debits = Σ credits/.test(banner(tj)) && red(tj), banner(tj).slice(0, 400));
    const tp = await go('gl', { pnl_period: (p) => { const r = L.profitAndLoss(p); r.AccountsBreakdown[0].AccountTotal += 10; return r; } });
    ok('gl: a P&L that differs from the journals → the income and expense tie fails', /✗ Income and expense categories/.test(banner(tp)) && red(tp), banner(tp).slice(0, 400));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

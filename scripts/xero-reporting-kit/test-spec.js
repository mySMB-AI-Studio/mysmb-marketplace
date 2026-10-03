// Tests for the reports that were written specifications before they moved onto the kit (Sales register, Exceptions dashboard,
// Bank reconciliation status, General Ledger …), against the ledger fixture (ledger.js): every figure comes from one set of
// books, so a report's ties must pass, and a tampered source must fail. node test-spec.js [report]
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const DIR = process.env.KIT_DIR || __dirname;
const man = (n) => JSON.parse(fs.readFileSync(path.join(DIR, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 900) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#xk-banner'), body = (t) => text(t.doc, '#xk-body');
const green = (t) => t.doc.querySelector('#xk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#xk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const view = async (t, v) => { const el = t.doc.getElementById('xk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const xlsx = async (t) => { t.doc.getElementById('xk-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
const E = L.expect, FY = '2026-07-01', TO = '2026-09-25';
const between = (s, a, b) => s >= a && s <= b;
const d10 = (v) => new Date(+/-?\d+/.exec(v)[0]).toISOString().slice(0, 10);

(async () => {
  if (!only || only === 'sr') {
    const FX = () => ({ invoices: L.listInvoices, credit_notes: L.listCreditNotes, pnl: L.pnl, accounts: L.listAccounts, org: L.organisation, connections: L.connections });
    const t = await run('sr', man('sr'), FX()); await wait(40);
    const B = E.books(), inv = B.docs.filter((d) => d.Type === 'ACCREC' && d.status === 'AUTHORISED' && between(d.date, FY, TO)), cn = B.credits.filter((c) => c.Type === 'ACCRECCREDIT' && between(c.date, FY, TO));
    const net = L.r2(inv.reduce((a, d) => a + d.Total, 0) - cn.reduce((a, c) => a + c.Total, 0));
    ok('sr: financial year to date by default, Xero period wording', /For the period 1 July 2026 to 25 September 2026/.test(text(t.doc, '#xk-head')), text(t.doc, '#xk-head'));
    ok('sr: register total = the books (approved and paid invoices − credit notes in the period)', new RegExp('Net sales incl\\. tax\\s*' + fmt(net)).test(body(t)), [net, body(t).slice(0, 200)]);
    ok('sr: drafts and invoices awaiting approval are left out', !/DRAFT|SUBMITTED/.test(body(t)));
    ok('sr: every check passes, the P&L income tie matches (information), green', green(t) && /4\/4 checks passed · 1 for information/.test(banner(t)) && /they match/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 500));
    await view(t, 'customers');
    const rows = [...t.doc.querySelectorAll('#sr-grid tbody tr')].map((tr) => tr.children[0].textContent);
    ok('sr: By customer — one row per customer, same total, no refetch', rows.length === new Set(inv.concat(cn).map((d) => d.Contact.Name)).size && new RegExp('Total\\s*' + inv.length).test(text(t.doc, '#sr-grid tfoot')) && t.calls.filter((c) => c.requery).length === 0, [rows.length, text(t.doc, '#sr-grid tfoot')]);
    const xs = await xlsx(t); ok('sr: Excel has the register and the by-customer sheets', /Sales register/.test(xs) && /By customer/.test(xs));
    // a new period refetches with the right filter
    const n0 = t.calls.length, from = t.doc.getElementById('xk-from'); from.value = '2026-08-01'; from.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(40);
    const q = t.calls.slice(n0).find((c) => c.id === 'invoices');
    ok('sr: changing From refetches invoices with the new period filter', q && q.params.where === 'Type=="ACCREC" AND Date>=DateTime(2026,08,01) AND Date<=DateTime(2026,09,25)', q && q.params.where);
    // a document whose total ≠ subtotal + tax fails its check
    const bad = (p) => { const r = L.listInvoices(p); if ((p.page || 1) === 1 && r.Invoices[0]) r.Invoices[0].Total = r.Invoices[0].Total + 10; return r; };
    const tb = await run('sr', man('sr'), Object.assign(FX(), { invoices: bad })); await wait(40);
    ok('sr: a document with total ≠ subtotal + tax → that check fails, red', /✗ Each document: subtotal \+ tax = total/.test(banner(tb)) && red(tb), banner(tb).slice(0, 400));
  }
  if (!only || only === 'ex') {
    const FX = () => ({ invoices: L.listInvoices, bills: L.listInvoices, bs: L.bs, org: L.organisation, connections: L.connections });
    const t = await run('ex', man('ex'), FX()); await wait(40);
    const out = (type) => L.listInvoices({ where: 'Type=="' + type + '"', statuses: 'DRAFT,SUBMITTED,AUTHORISED' }).Invoices;
    const drafts = out('ACCREC').filter((d) => /DRAFT|SUBMITTED/.test(d.Status)), over = out('ACCREC').filter((d) => d.Status === 'AUTHORISED' && d.AmountDue > 0 && d.DueDateString.slice(0, 10) < TO);
    ok('ex: as at today, Xero wording', /As at 25 September 2026/.test(text(t.doc, '#xk-head')), text(t.doc, '#xk-head'));
    ok('ex: draft sales card = draft + awaiting approval sales invoices in the books', new RegExp('Draft sales \\(' + drafts.length + '\\)\\s*' + fmt(L.r2(drafts.reduce((a, d) => a + d.Total, 0)))).test(body(t)), body(t).slice(0, 200));
    ok('ex: overdue sales card = approved invoices past due with an amount due', new RegExp('Overdue sales \\(' + over.length + '\\)\\s*' + fmt(L.r2(over.reduce((a, d) => a + d.AmountDue, 0)))).test(body(t)), body(t).slice(0, 300));
    ok('ex: every check passes, green; the Balance Sheet line is information', green(t) && /3\/3 checks passed · 1 for information/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 400));
    const first = [...t.doc.querySelectorAll('#ex-grid tbody tr')][0], days = [...t.doc.querySelectorAll('#ex-grid tbody tr')].map((tr) => tr.children[6].textContent).filter(Boolean).map(Number);
    ok('ex: most overdue first, with an age band', first && days.every((d, i) => !i || d <= days[i - 1]) && /90\+ days|61–90 days|31–60 days|1–30 days/.test(first.textContent), days.slice(0, 6));
    await view(t, 'drafts');
    ok('ex: Drafts only → only drafts and awaiting approval, no refetch', [...t.doc.querySelectorAll('#ex-grid tbody tr')].every((tr) => /Draft|Awaiting approval/.test(tr.children[1].textContent)) && t.calls.filter((c) => c.requery).length === 0);
    const leak = (p) => { const r = L.listInvoices(p); if ((p.page || 1) === 1 && /ACCREC/.test(p.where)) r.Invoices.push(Object.assign({}, r.Invoices[0], { InvoiceID: 'x-paid', InvoiceNumber: 'INV-PAID', Status: 'PAID', AmountDue: 0 })); return r; };
    const tl = await run('ex', man('ex'), Object.assign(FX(), { invoices: leak })); await wait(40);
    ok('ex: a paid invoice in the feed is not listed (still green)', !/INV-PAID/.test(body(tl)) && green(tl), banner(tl).slice(0, 300));
  }
  if (!only || only === 'br') {
    const FX = () => ({ open_tx: L.listBankTransactions, open_pay: L.listPayments, done_tx: L.listBankTransactions, done_pay: L.listPayments, accounts: L.listAccounts, bank: L.bankSummary, org: L.organisation, connections: L.connections });
    const t = await run('br', man('br'), FX()); await wait(40);
    const B = E.books(), openBt = B.bank.filter((x) => !x.IsReconciled && x.date <= TO), openPay = B.pays.filter((x) => !x.IsReconciled && x.date <= TO);
    const oldest = openBt.concat(openPay).map((x) => x.date).sort()[0];
    ok('br: unreconciled = the books (spend / receive money and payments not reconciled, up to the period end)', new RegExp('Unreconciled items\\s*' + (openBt.length + openPay.length) + '(?!\\d)').test(body(t)), [openBt.length + openPay.length, body(t).slice(0, 200)]);
    ok('br: the oldest unreconciled item is the June bank fee, with its age', oldest.startsWith('2026-06') && new RegExp('Oldest unreconciled\\s*' + (+oldest.slice(8)) + ' Jun 2026').test(body(t)), [oldest, body(t).slice(0, 300)]);
    ok('br: every bank account is listed, with its balance in Xero', /Business Cheque Account/.test(body(t)) && /Business Savings Account/.test(body(t)) && new RegExp(fmt(E.bankBalance('091', TO))).test(body(t)), body(t).slice(200, 600));
    ok('br: 5/5 checks pass, green', green(t) && /5\/5 checks passed/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 400));
    await view(t, 'items');
    const ages = [...t.doc.querySelectorAll('#br-grid tbody tr')].map((tr) => +tr.children[5].textContent);
    ok('br: Unreconciled items — oldest first, with age bands', ages.length === openBt.length + openPay.length && ages.every((a, i) => !i || a <= ages[i - 1]) && /61–90 days|90\+ days/.test(text(t.doc, '#br-grid')), ages);
    const leak = (p) => { const r = L.listBankTransactions(p); if ((p.page || 1) === 1 && /IsReconciled==false/.test(p.where)) r.BankTransactions.push(Object.assign({}, r.BankTransactions[0], { BankTransactionID: 'x-rec', IsReconciled: true })); return r; };
    const tl = await run('br', man('br'), Object.assign(FX(), { open_tx: leak })); await wait(40);
    ok('br: a reconciled item in the unreconciled list → that check fails, red', /✗ Every unreconciled item is approved, unreconciled/.test(banner(tl)) && red(tl), banner(tl).slice(0, 300));
  }
  if (!only || only === 'gl') {
    const FX = () => ({ journals: L.listJournals, pnl: L.pnl, org: L.organisation, connections: L.connections });
    const t = await run('gl', man('gl'), FX()); await wait(150);
    const offs = t.calls.filter((c) => c.id === 'journals').map((c) => c.params.offset);
    ok('gl: finds the period in the journal feed instead of reading every earlier page', offs[0] === 0 && offs.length < 12 && t.calls.filter((c) => c.id === 'journals' && c.requery).length >= 3, offs);
    const np = E.netProfit(FY, TO, false);
    ok('gl: income and expense movement = the Profit and Loss, account by account (green)', green(t) && new RegExp('✓ Income and expense movement = the Profit and Loss.*Net profit ' + fmt(np) + ' vs ' + fmt(np)).test(banner(t)) && /4\/4 checks passed/.test(banner(t)), banner(t).slice(0, 600));
    ok('gl: debits = credits, and the feed position is stated', /✓ Total debits = total credits/.test(banner(t)) && /read from journal #\d+/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 600));
    // every journal dated in the period is shown, and nothing outside it
    let all = [], off = 0; for (;;) { const r = L.listJournals({ offset: off }).Journals; if (!r.length) break; all = all.concat(r); off = r[r.length - 1].JournalNumber; if (r.length < 100) break; }
    const inP = all.filter((j) => between(d10(j.JournalDate), FY, TO));
    ok('gl: every journal dated in the period is shown, nothing outside it', new RegExp('Journals in the period\\s*' + inP.length + '(?!\\d)').test(body(t)), [inP.length, body(t).slice(0, 120)]);
    // account filter: running total ends at the account's movement
    const sel = t.doc.getElementById('gl-acc'), code200 = [...sel.options].find((o) => /^200 /.test(o.textContent)).value; sel.value = code200; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    const runs = [...t.doc.querySelectorAll('#gl-grid tbody tr')].map((tr) => tr.lastElementChild.textContent), sales = E.plByAccount(FY, TO, false)['200'];
    ok('gl: account filter (200 Sales) → its lines with a running total that ends at −(the P&L sales), no refetch', runs.length > 0 && new RegExp('^' + fmt(-sales) + '$').test(runs[runs.length - 1]) && /filtered/.test(body(t)) && t.calls.filter((c) => c.requery && c.id !== 'journals').length === 0, [runs.slice(-1), sales]);
    ok('gl: the account filter is kept in the display input', /acc=/.test(JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).o || ''), t.setInputsLog.slice(-1));
    await view(t, 'accounts');
    ok('gl: Account summary lists each account\'s debits, credits and net movement', /Net movement/.test(body(t)) && /Business Cheque Account/.test(body(t)));
    // no journals scope
    const denied = await run('gl', man('gl'), Object.assign(FX(), {}), { fail: { journals: { code: 'tool_error', message: 'Xero API GET https://api.xero.com/api.xro/2.0/Journals 401: {"Title":"Unauthorized","Detail":"AuthorizationUnsuccessful"}' } } }); await wait(40);
    ok('gl: without the journals scope → a plain message, no ledger from other data, red', /not available on this Xero connection: it needs the journals permission/.test(body(denied)) && red(denied) && !/Journals in the period/.test(body(denied)), body(denied).slice(0, 300));
    // a tampered P&L fails the tie
    const tp = (q) => { const r = L.pnl(q); const sec = r.Reports[0].Rows.find((x) => x.Title === 'Income'); sec.Rows[0].Cells[1].Value = '1.00'; return r; };
    const tt = await run('gl', man('gl'), Object.assign(FX(), { pnl: tp })); await wait(150);
    ok('gl: a P&L that differs from the journals → the tie fails and names the account', /✗ Income and expense movement = the Profit and Loss.*200/.test(banner(tt)) && red(tt), banner(tt).slice(0, 500));
    // a short feed (cut at 20 pages) → the tie is N/A and completeness fails
    const cut = await run('gl', man('gl'), FX(), { htmlPatch: (h) => h.replace("key: 'Journals', max: 20,", "key: 'Journals', max: 1,") }); await wait(150);
    ok('gl: a feed cut short → completeness fails, the P&L tie is N/A (never a false pass)', /✗ All journals for the period loaded/.test(banner(cut)) && /– Income and expense movement = the Profit and Loss for the same dates — N\/A — the journal feed was cut short/.test(banner(cut)), banner(cut).slice(0, 500));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

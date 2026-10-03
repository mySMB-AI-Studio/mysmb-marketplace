// Tests for the reports that were written specifications before they moved onto the kit (Sales register, Exceptions dashboard,
// Bank reconciliation status, General Ledger, Tracking P&L, Budget vs Actual, GST reconciliation, Report pack), against the ledger fixture (ledger.js): every figure comes from one set of
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
    const FX = () => ({ invoices: L.listInvoices, bills: L.listInvoices, tb: L.trialBalance, org: L.organisation, connections: L.connections });
    const t = await run('ex', man('ex'), FX()); await wait(40);
    const out = (type) => L.listInvoices({ where: 'Type=="' + type + '"', statuses: 'DRAFT,SUBMITTED,AUTHORISED' }).Invoices;
    const drafts = out('ACCREC').filter((d) => /DRAFT|SUBMITTED/.test(d.Status)), over = out('ACCREC').filter((d) => d.Status === 'AUTHORISED' && d.AmountDue > 0 && d.DueDateString.slice(0, 10) < TO);
    ok('ex: as at today, Xero wording', /As at 25 September 2026/.test(text(t.doc, '#xk-head')), text(t.doc, '#xk-head'));
    ok('ex: draft sales card = draft + awaiting approval sales invoices in the books', new RegExp('Draft sales \\(' + drafts.length + '\\)\\s*' + fmt(L.r2(drafts.reduce((a, d) => a + d.Total, 0)))).test(body(t)), body(t).slice(0, 200));
    ok('ex: overdue sales card = approved invoices past due with an amount due', new RegExp('Overdue sales \\(' + over.length + '\\)\\s*' + fmt(L.r2(over.reduce((a, d) => a + d.AmountDue, 0)))).test(body(t)), body(t).slice(0, 300));
    ok('ex: every check passes, green; the Trial Balance line is information', green(t) && /3\/3 checks passed · 1 for information/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 400));
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
  if (!only || only === 'tc') {
    const FX = () => ({ by_cat: L.pnl, by_cat_cash: L.pnl, pnl: L.pnl, pnl_cash: L.pnl, cats: L.listTrackingCategories, org: L.organisation, connections: L.connections });
    const t = await run('tc', man('tc'), FX()); await wait(150);
    const np = E.netProfit(FY, TO, false), cat = L.TRACKING[0];
    ok('tc: a copy without a category opens on the first one (Region) and refetches only the tracking calls', /Profit and Loss by Region/.test(text(t.doc, '#xk-head')) && t.calls.filter((c) => c.requery).every((c) => /^by_cat/.test(c.id)) && t.calls.some((c) => c.requery && c.params.trackingCategoryID === cat.TrackingCategoryID), t.calls.filter((c) => c.requery).map((c) => c.id));
    ok('tc: columns North | South | Unassigned | Total', [...t.doc.querySelectorAll('.xk-stmt thead th')].map((x) => x.textContent).slice(1).join('|') === 'North|South|Unassigned|Total');
    ok('tc: 4/4 checks pass; the Total column\'s net profit = the P&L without tracking', green(t) && /4\/4 checks passed/.test(banner(t)) && new RegExp('the Profit and Loss without tracking.*' + fmt(np) + ' vs ' + fmt(np)).test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 500));
    const os = t.doc.getElementById('tc-opt'); os.value = 'opt-north'; os.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    ok('tc: one option → its column beside the total, no refetch, kept in the display input', [...t.doc.querySelectorAll('.xk-stmt thead th')].map((x) => x.textContent).slice(1).join('|') === 'North|Total' && /opt=opt-north/.test(JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).o), [...t.doc.querySelectorAll('.xk-stmt thead th')].map((x) => x.textContent));
    const tp = (q) => { const r = L.pnl(q); if (q.trackingCategoryID) { const s = r.Reports[0].Rows.find((x) => x.Title === 'Income'); s.Rows[0].Cells[1].Value = '1.00'; } return r; };
    const tt = await run('tc', man('tc'), Object.assign(FX(), { by_cat: tp })); await wait(150);
    ok('tc: an option column that does not add up to the total → that check fails, red', /✗ Options \+ Unassigned = the Total column/.test(banner(tt)) && red(tt), banner(tt).slice(0, 400));
    const none = await run('tc', man('tc'), Object.assign(FX(), { cats: () => ({ TrackingCategories: [] }) })); await wait(80);
    ok('tc: no tracking categories → says so, no error', /no active tracking categories/.test(body(none)) && none.errs.length === 0, body(none).slice(0, 200));
  }
  if (!only || only === 'bv') {
    const FX = () => ({ budget_fwd: L.budgetSummary, budget_back: L.budgetSummary, actual: L.pnl, actual_m: L.pnl, budgets: L.listBudgets, org: L.organisation, connections: L.connections });
    const t = await run('bv', man('bv'), FX()); await wait(150);
    const months = ['2026-07', '2026-08'], np = E.netProfit('2026-07-01', '2026-08-31', false);
    const budNp = (() => { let n = 0; months.forEach((ym) => { const b = L.budgetMonth(ym); Object.keys(b).forEach((k) => { n += (/REVENUE|OTHERINCOME/.test(L.ACC[k].Type) ? 1 : -1) * b[k]; }); }); return Math.round(n * 100) / 100; })();
    const whole = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.round(Math.abs(v)).toLocaleString('en-AU');
    ok('bv: financial year to the end of last month by default (1 Jul – 31 Aug)', /For the 2 months ended 31 August 2026/.test(text(t.doc, '#xk-head')), text(t.doc, '#xk-head'));
    ok('bv: net profit budget = the overall budget for July–August; actual = the books', new RegExp('Net profit — budget\\s*' + whole(budNp)).test(body(t)) && new RegExp('Net profit — actual\\s*' + whole(np)).test(body(t)), [budNp, np, body(t).slice(0, 160)]);
    ok('bv: 4/4 checks pass (monthly actuals tie), green; several budgets → says the overall one is shown', green(t) && /4\/4 checks passed/.test(banner(t)) && /✓ Monthly actuals/.test(banner(t)) && /The Budget Summary always returns the overall budget/.test(body(t)) && t.errs.length === 0, banner(t).slice(0, 500));
    ok('bv: an expense over budget is red, income over budget green', !!t.doc.querySelector('#bv-main td.num.pos') && !!t.doc.querySelector('#bv-main td.num.neg'));
    await view(t, 'months');
    ok('bv: By month — one row per month, no refetch', [...t.doc.querySelectorAll('#bv-main tbody tr')].length === 2 && t.calls.filter((c) => c.requery).length === 0);
    // the other reading of the Budget Summary date (12 months ending at the date) is picked up too
    const back = (q) => L.budgetSummary(Object.assign({}, q, { date: L.shiftMonths(q.date, -11, false) }));
    const tb = await run('bv', man('bv'), Object.assign(FX(), { budget_fwd: back, budget_back: back })); await wait(150);
    ok('bv: if Xero reads the date as the last month, the other call covers the period (still green)', green(tb) && new RegExp('Net profit — budget\\s*' + whole(budNp)).test(body(tb)), banner(tb).slice(0, 400));
    const empty = (q) => { const r = L.budgetSummary(q); r.Reports[0].Rows.forEach((x) => (x.Rows || []).forEach((y) => y.Cells.slice(1).forEach((cl) => { cl.Value = '0.00'; }))); return r; };
    const te = await run('bv', man('bv'), Object.assign(FX(), { budget_fwd: empty, budget_back: empty })); await wait(150);
    ok('bv: no budget in Xero → says so, budget N/A (never $0)', /There is no budget in Xero/.test(body(te)) && /N\/A — no budget/.test(body(te)) && !red(te), body(te).slice(0, 300));
  }
  if (!only || only === 'gr') {
    const FX = () => ({ invoices: L.listInvoices, credit_notes: L.listCreditNotes, bank_tx: L.listBankTransactions, tax_rates: L.listTaxRates, accounts: L.listAccounts, bs_end: L.bs, bs_start: L.bs, org: L.organisation, connections: L.connections });
    const t = await run('gr', man('gr'), FX()); await wait(120);
    const net = E.gst('2026-04-01', '2026-06-30');
    ok('gr: last quarter by default; says plainly it is not a lodgeable BAS', /For the 3 months ended 30 June 2026/.test(text(t.doc, '#xk-head')) && /not a lodgeable BAS/.test(body(t)), text(t.doc, '#xk-head'));
    ok('gr: net GST = the books', new RegExp('Net GST payable\\s*' + fmt(net)).test(body(t)), [net, body(t).slice(0, 300)]);
    ok('gr: 5/5 checks pass — the GST account reconciles over two Balance Sheets (difference $0.00)', green(t) && /5\/5 checks passed/.test(banner(t)) && /Difference\$0\.00/.test(body(t).replace(/\s/g, '')) && t.errs.length === 0, banner(t).slice(0, 500));
    await view(t, 'lines');
    ok('gr: Tax lines — every line, filterable, no refetch', t.doc.querySelectorAll('#gr-grid tbody tr').length > 20 && t.calls.filter((c) => c.requery).length === 0);
    const off = (q) => { const r = L.bs(q); for (const s of r.Reports[0].Rows) for (const k of s.Rows || []) if (k.Cells && k.Cells[0].Value === 'GST' && q.date === '2026-06-30') k.Cells[1].Value = String(+k.Cells[1].Value + 100); return r; };
    const to = await run('gr', man('gr'), Object.assign(FX(), { bs_end: off })); await wait(120);
    ok('gr: a GST account $100 out → the tie fails and lists possible causes (not asserted)', /✗ GST account at the period end/.test(banner(to)) && /Possible causes \(not checked\)/.test(body(to)) && red(to), banner(to).slice(0, 400));
  }
  if (!only || only === 'rp') {
    const FX = () => ({ pnl: L.pnl, pnl_ytd: L.pnl, bs: L.bs, invoices: L.listInvoices, bills: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, org: L.organisation, connections: L.connections });
    const t = await run('rp', man('rp'), FX()); await wait(150);
    ok('rp: last month by default, cover and contents with four sections', /For the month ended 31 August 2026/.test(text(t.doc, '#xk-head')) && t.doc.querySelectorAll('#xk-body ol li').length === 4, text(t.doc, '#xk-head'));
    ok('rp: green; CYE = the P&L from the year start; ageing vs past Balance Sheet is information', green(t) && /✓ Current Year Earnings on the Balance Sheet = Net Profit/.test(banner(t)) && /ℹ Aged Receivables \(today\)/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 500));
    const AR = E.balances(TO)['610'];
    const m2 = man('rp'); m2.inputs.find((i) => i.name === 'to_date').default = 'today'; m2.inputs.find((i) => i.name === 'from_date').default = FY; const dd = m2.inputs.find((i) => i.name === 'display'); dd.default = dd.default.replace('"p":"last_month"', '"p":"this_fy_td"');
    const t2 = await run('rp', m2, FX(), { bundleInputs: true }); await wait(150);
    // live QA, 4 Oct 2026: Xero's Balance Sheet answers any date with that month's end — a pack ending today (mid-month) shows the
    // Balance Sheet at the month end, says so, ties its Current Year Earnings to the P&L to that month end, and the ageing (today)
    // against it is information (different dates)
    ok('rp: ending today (mid-month) → Balance Sheet at the month end, said on the page; CYE ties at that date; ageing vs it is information; green', green(t2) && /4\/4 checks passed · 2 for information/.test(banner(t2)) && /✓ Current Year Earnings on the Balance Sheet = Net Profit from the financial-year start to 2026-09-30/.test(banner(t2)) && /ℹ Aged Receivables \(today\) vs Accounts Receivable on the Balance Sheet at 2026-09-30 \(information — different dates\)/.test(banner(t2)) && /As at 30 September 2026 · Xero gives the Balance Sheet at month ends/.test(text(t2.doc, '#xk-body')), banner(t2).slice(0, 600));
    const cb = [...t.doc.querySelectorAll('.rp-sec')].find((x) => x.value === 'ap'); cb.checked = false; cb.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30);
    ok('rp: switching a section off removes it, no refetch, kept in the display input', t.doc.querySelectorAll('#xk-body ol li').length === 3 && !/Aged Payables/.test(text(t.doc, '#xk-body ol')) && /s=pl,bs,ar/.test(JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).o) && t.calls.filter((c) => c.requery).length === 0);
    const xs = await xlsx(t); ok('rp: Excel — one sheet per section shown', /Profit and Loss/.test(xs) && /Balance Sheet/.test(xs) && /Aged Receivables/.test(xs));
    const tb = (q) => { const r = L.bs(q); for (const s of r.Reports[0].Rows) for (const k of s.Rows || []) if (k.Cells && k.Cells[0].Value === 'Current Year Earnings') k.Cells[1].Value = '1.00'; return r; };
    const tt = await run('rp', man('rp'), Object.assign(FX(), { bs: tb })); await wait(150);
    ok('rp: Current Year Earnings that differs from the P&L → that check fails, red', /✗ Current Year Earnings on the Balance Sheet/.test(banner(tt)) && red(tt), banner(tt).slice(0, 400));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

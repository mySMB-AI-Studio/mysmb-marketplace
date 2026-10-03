// Wave 1B MYOB kit reports (Dashboard M00, Exceptions dashboard M59) against the ledger (ledger.js): every response comes from one set
// of books, so each report's ties must pass, and a tampered source must fail. node test-wave1b.js [report]
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), body = (t) => text(t.doc, '#mk-body');
const green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '-\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.');
const fmtP = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, get_profit_and_loss: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions, list_tax_codes: L.listTaxCodes };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, opts, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(100); return t; };
const tamperBs = (id, delta) => (p) => { const r = L.balanceSheet(p); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === id) x.AccountTotal = Math.round((x.AccountTotal + delta) * 100) / 100; }); return r; };
const E = L.expect, T = L.TODAY, FY = '2026-07-01', r2 = L.r2;
const xlsxText = async (t) => { const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };

(async () => {
  if (!only || only === 'db') {
    const t = await go('db'), bal = E.balances(T, L.CF1), pl3 = E.plByAccount('2026-07-01', T, false, L.CF1), np = E.netProfit(FY, T, false, L.CF1);
    const sumIf = (o, re) => r2(Object.keys(o).filter((id) => re.test(id)).reduce((s, id) => s + o[id], 0));
    const inc3 = sumIf(pl3, /^[48]-/), exp3 = sumIf(pl3, /^[569]-/), gst = r2(bal['2-1310'] + bal['2-1330']), bank = r2(bal['1-1110'] + bal['1-1120']);
    ok('db: 5/5 checks pass (two ties across MYOB sources, profit = Current Year Earnings, receivables), GST for information, green', green(t) && /5\/5 checks passed · 1 for information/.test(banner(t)), banner(t).slice(0, 600));
    ok('db: Income / Expenses (last 3 months) and Financial position are the books\' figures', new RegExp('Income' + fmt(inc3) + 'Last 3 months').test(body(t)) && /<sup>\.\d\d<\/sup>/.test(t.doc.getElementById('mk-body').innerHTML) && new RegExp('Expenses' + fmt(exp3)).test(body(t)) && new RegExp('Financial position' + fmt(np)).test(body(t)), { inc3, exp3, np, b: body(t).slice(0, 400) });
    ok('db: Bank balance, credit card, GST to pay, super and PAYG are the Balance Sheet\'s', new RegExp('Bank balance' + fmt(bank)).test(body(t)) && new RegExp('Money owed \\(credit cards\\)' + fmt(bal['2-1110'])).test(body(t)) && new RegExp('GST' + fmt(gst) + 'to pay').test(body(t)) &&
      new RegExp('Superannuation payable' + fmt(bal['2-1420'])).test(body(t)) && new RegExp('PAYG withholding' + fmt(bal['2-1410'])).test(body(t)), { bank, gst, b: body(t).slice(300, 1200) });
    ok('db: GST accounts come from the tax codes (GST Collected / GST Paid)', /2-1310, 2-1330, the accounts the GST tax codes post to/.test(banner(t)));
    const inv = L.listInvoices({ myob_company_file_id: L.CF1, status: 'Open' }).Items, od = inv.filter((i) => i.BalanceDueAmount > 0 && i.Terms.DueDate.slice(0, 10) < T);
    const days = (i) => Math.round((Date.parse(T) - Date.parse(i.Terms.DueDate.slice(0, 10))) / 86400000), band = (f) => r2(od.filter((i) => f(days(i))).reduce((s, i) => s + i.BalanceDueAmount, 0));
    ok('db: Up next = the overdue invoices; the three bands are the books\' (by days past due)', new RegExp('Up next ?' + od.length + ' ?Overdue invoice').test(body(t)) && new RegExp('Over 30 days overdue \\(\\d+\\)' + fmt(band((d) => d > 30))).test(body(t)) && new RegExp('16 to 30 days overdue \\(\\d+\\)' + fmt(band((d) => d >= 16 && d <= 30))).test(body(t)), { n: od.length, b: body(t).slice(1200, 1700) });
    ok('db: pay runs are N/A (no pay-run list in the connector), listed under Sources', /Pay runsN\/A — the MYOB connector has no list of pay runs/.test(body(t)) && /Pay runs \(the MYOB connector has no list of pay runs\)/.test(text(t.doc, '#mk-sources')));
    ok('db: the monthly chart runs from July and stops at this month', (t.doc.querySelector('#db-chart svg') || { innerHTML: '' }).innerHTML.split('<polyline').length === 4 && /JulAugSep/.test(text(t.doc, '#db-chart')) && !/Income · Oct/.test(t.doc.getElementById('db-chart').innerHTML));
    const tp = await go('db', { pnl_3m: (p) => { const r = L.profitAndLoss(p); r.AccountsBreakdown.find((x) => x.Account.DisplayID === '4-1400').AccountTotal += 10; return r; } });
    ok('db: a P&L $10 off the journals → the last-3-months tie fails, red', /✗ Last 3 months/.test(banner(tp)) && red(tp), banner(tp).slice(0, 400));
    const tc = await go('db', { bs: tamperBs('3-9000', 25) });
    ok('db: Current Year Earnings $25 off → Financial position = Current Year Earnings fails', /✗ Financial position = Current Year Earnings/.test(banner(tc)) && red(tc), banner(tc).slice(0, 400));
    const ta = await go('db', { bs: tamperBs('1-1200', 40) });
    ok('db: receivables account $40 off → the money-owed-to-you tie fails', /✗ Money owed to you/.test(banner(ta)) && red(ta), banner(ta).slice(0, 400));
    const tx = await go('db', {}, { fail: { tax_codes: { code: 'tool_error', message: 'boom' } } });
    ok('db: tax codes fail → GST accounts found by name, same GST figure, banner still green (an optional source)', green(tx) && /found by name/.test(banner(tx)) && new RegExp('GST' + fmt(gst) + 'to pay').test(body(tx)) && /Tax codes did not load/.test(text(tx.doc, '#mk-sources')), banner(tx).slice(0, 400));
    const tj = await go('db', {}, { fail: { journals: { code: 'tool_error', message: 'journals down' } } });
    ok('db: journals fail → the chart says so, its checks are N/A, banner red', red(tj) && /journals down/.test(text(tj.doc, '#db-chart')) && /– Last 3 months/.test(banner(tj)) && /✓ Financial position = Current Year Earnings/.test(banner(tj)), banner(tj).slice(0, 500));
    // a saved dashboard reopened later: as_at rolls to today and the 3-month window and financial year follow
    const tr = await go('db', {}, {}, { as_at: '2026-05-20', m3_start: '2026-03-01', fy_start: '2025-07-01', chart_from: '2025-07-01' });
    const rq = tr.calls.filter((c) => c.requery && c.id === 'pnl_3m').pop();
    ok('db: reopened later → as at today, last 3 months from 1 July, financial year 2026-27, refetched', rq && rq.params.from_date === '2026-07-01' && rq.params.to_date === T && /As at 28 September 2026/.test(text(tr.doc, 'header')) && green(tr), { rq: rq && rq.params, h: text(tr.doc, 'header') });
    t.doc.getElementById('mk-xlsx').click(); await t.settle(); const xs = await xlsxText(t);
    ok('db: Excel has the Dashboard, Monthly and Overdue invoices sheets', /Dashboard/.test(xs) && /Monthly/.test(xs) && /Overdue invoices/.test(xs) && /Validation/.test(xs));
    const cl = await go('db', {}, {}, { persona: 'Client' });
    ok('db: View as Client hides the account lists, keeps the figures', cl.doc.body.classList.contains('persona-summary') && /Bank balance/.test(body(cl)));
  }
  if (!only || only === 'ex') {
    const t = await go('ex');
    ok('ex: clean books — 5 checks pass, the 2 the connector cannot supply are N/A; readiness 5/7, risk $0.00, green', green(t) && /5\/5 checks passed · 2 N\/A/.test(banner(t)) && /Readiness5\/7/.test(body(t)) && /Dollarised risk\(?\$0\.00/.test(body(t)), banner(t).slice(0, 600));
    ok('ex: MYOB\'s layout — Transaction review then Tax review, the period line and the last run', /Transaction reviewCheckExceptionsDescriptionReceivables reconciliation exceptions/.test(body(t)) && /Tax reviewCheckExceptionsDescriptionTax amount variance/.test(body(t)) && /1 July 2026 - 28 September 2026/.test(body(t)) && /Last review run at/.test(body(t)));
    const ar = await go('ex', { bs: tamperBs('1-1200', 50) });
    ok('ex: receivables account $50 off → 1 exception of $50.00, red, with its detail', /✗ Receivables reconciliation exceptions/.test(banner(ar)) && red(ar) && /Receivables reconciliation exceptions \(1\)/.test(body(ar)) && /Dollarised risk\$50\.00/.test(body(ar)), body(ar).slice(0, 500));
    const ap = await go('ex', { bs: tamperBs('2-1200', -30) });
    ok('ex: payables account $30 off → the payables check fails', /✗ Payables reconciliation exceptions/.test(banner(ap)) && /✓ Receivables reconciliation/.test(banner(ap)), banner(ap).slice(0, 400));
    const fut = { DisplayID: 'GJ999999', JournalType: 'General', DateOccurred: '2026-10-15T00:00:00', DatePosted: '2026-09-20T00:00:00', Description: 'Accrued rent', Lines: [{ Account: { DisplayID: '6-4100', Name: 'Rent' }, Amount: 2200, IsCredit: false }, { Account: { DisplayID: '2-1200', Name: 'Trade Creditors' }, Amount: 2200, IsCredit: true }] };
    const tf = await go('ex', { journals_after: (p) => { const r = L.listJournalTransactions(p); r.Items.push(fut); r.Count++; return r; } });
    const fc = tf.calls.find((c) => c.id === 'journals_after');
    ok('ex: a journal dated after today → 1 future dated transaction of $2,200.00 (queried from tomorrow)', /✗ Future dated transactions — 1 exception, \(?\$2,200\.00/.test(banner(tf)) && fc.params.from_date === '2026-09-29' && /Accrued rent/.test(body(tf)), banner(tf).slice(0, 500));
    const prep = (p) => { const r = L.listInvoices(p); const x = r.Items.find((i) => i.Status === 'Closed' && i.Date >= FY); x.LastPaymentDate = L.addDays(x.Date.slice(0, 10), -3) + 'T00:00:00'; return r; };
    const tpp = await go('ex', { inv_period: prep });
    ok('ex: an invoice paid three days before its date → 1 prepaid transaction', /✗ Prepaid transactions — 1 exception/.test(banner(tpp)) && /Prepaid transactions \(1\)/.test(body(tpp)), banner(tpp).slice(0, 500));
    const tv = await go('ex', { bills_period: (p) => { const r = L.listBills(p); const x = r.Items[0]; x.TotalTax = r2(x.TotalTax + 5); x.TotalAmount = r2(x.TotalAmount + 5); return r; } });
    ok('ex: a bill with $5 more tax than GST allows → tax amount variance (document level)', /✗ Tax amount variance — 1 exception, \(?\$5\.00/.test(banner(tv)) && /more than GST/.test(body(tv)), banner(tv).slice(0, 500));
    // when MYOB returns invoice lines with tax codes: line-level tax and the account's default code
    const B = E.books(L.CF1), byUid = {}; B.invoices.forEach((i) => { byUid[i.UID] = i; });
    const withLines = (p) => { const r = L.listInvoices(p); r.Items.forEach((x) => { const i = byUid[x.UID]; x.Lines = [{ Type: 'Transaction', Total: i.Subtotal, Account: { UID: B.acc[i.account].UID, DisplayID: i.account, Name: B.acc[i.account].Name }, TaxCode: { Code: i.TaxCode } }]; }); return r; };
    const fre = B.invoices.filter((i) => i.TaxCode === 'FRE' && i.date >= FY && i.date <= T);
    const tl = await go('ex', { inv_period: withLines });
    ok('ex: invoice lines with tax codes → GST-free lines on a GST account are tax code exceptions; their tax still ties to the codes', fre.length > 0 ? new RegExp('✗ Tax code exceptions \\(invoice transactions\\) — ' + fre.length + ' exception').test(banner(tl)) && /✓ Tax amount variance — line tax codes/.test(banner(tl)) : /✓ Tax code exceptions \(invoice transactions\)/.test(banner(tl)), { fre: fre.length, b: banner(tl).slice(0, 700) });
    const n0 = t.calls.length; t.doc.getElementById('ex-run').click(); await t.settle(); await wait(80);
    const again = t.calls.slice(n0).filter((c) => c.requery).map((c) => c.id);
    ok('ex: Run review refetches every source', ['inv_open', 'bills_open', 'bs', 'inv_period', 'bills_period', 'journals_after'].every((id) => again.includes(id)), again);
    const nt = await go('ex', {}, { fail: { tax_codes: { code: 'tool_error', message: 'boom' } } });
    ok('ex: tax codes fail → not a failed check (optional), the tax check uses 10% GST', green(nt) && /✓ Tax amount variance/.test(banner(nt)), banner(nt).slice(0, 400));
    const sp = await run('ex', onFile(man('ex')), FX(man('ex')), { mode: 'snapshot', bundleInputs: true }); await wait(80);
    ok('ex: snapshot → Run review is disabled', sp.doc.getElementById('ex-run').disabled === true);
  }
  if (!only || only === 'sc') {
    const t = await go('sc'), bank = (d) => { const b = E.balances(d, L.CF1); return r2(b['1-1110'] + b['1-1120']); }, open = bank('2026-08-31'), close = bank(T);
    ok('sc: this month to date — cash at the end = beginning + net increase, green', green(t) && /3\/3 checks passed/.test(banner(t)) && new RegExp('Cash at the beginning of the period' + fmtP(open)).test(body(t)) && new RegExp('Cash at the end of the period' + fmtP(close)).test(body(t)), { open, close, b: banner(t).slice(0, 400) });
    ok('sc: MYOB\'s layout — Classification | Net cash flow, the three activities expanded to category lines, from net profit', /ClassificationNet cash flow \(\$\)Cash flow from operating activitiesNet profit/.test(body(t)) && /1-1200 Trade Debtors/.test(body(t)) && /Cash flow from investing activities/.test(body(t)) && /Cash flow from financing activities/.test(body(t)));
    await (async () => { const el = t.doc.getElementById('mk-view'); el.value = 'summary'; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); })();
    ok('sc: Collapsed — the activities only, no category lines', !/1-1200/.test(body(t)) && /Net increase\/decrease for the period/.test(body(t)));
    const fy = await go('sc', {}, {}, { from_date: '2025-07-01', to_date: '2026-06-30', prev_day: '2025-06-30', display: man('sc').inputs.find((i) => i.name === 'display').default.replace('this_month_td', 'custom') });
    ok('sc: last financial year — the equipment bought is investing ($2,400.00), the year-end close is information, green', green(fy) && /Total cash flow from investing activities\(\$2,400\.00\)/.test(body(fy)) && /ℹ The year-end close/.test(banner(fy)), { b: banner(fy).slice(0, 500), body: body(fy).slice(0, 300) });
    const tb = await go('sc', { bs_close: tamperBs('1-1110', 20) });
    ok('sc: a bank balance $20 off on the closing Balance Sheet → the tie fails, red', /✗ Cash at the end = cash at the beginning/.test(banner(tb)) && red(tb), banner(tb).slice(0, 300));
  }
  if (!only || only === 'rp') {
    const t = await go('rp'), ids = (x) => [...x.doc.querySelectorAll('section.rp-page')].map((s) => s.id.replace('rp-', '')).join(''), np = E.netProfit('2026-08-01', '2026-08-31', false, L.CF1);
    ok('rp: last month — 4/4 checks (balance sheet balances, net profit = CYE movement = cash movement\'s P&L line, cash tie), green', green(t) && /4\/4 checks passed/.test(banner(t)) && new RegExp('Net profit \\(P&L\\) = the Current Year Earnings movement.*' + fmtP(np) + ' vs ' + fmtP(np) + ' vs ' + fmtP(np)).test(banner(t)), banner(t).slice(0, 600));
    ok('rp: MYOB\'s Management Report pages in order, with the executive summary; cover names the business and period', ids(t) === 'CTSBPM' && /mySMB\.comManagement ReportAugust 2026/.test(body(t)) && /ContentsExecutive summaryBalance sheetProfit & lossCash movement/.test(body(t)));
    const click = async (sel) => { t.doc.querySelector(sel).click(); await t.settle(); await wait(30); }, tick = async (k, on) => { const el = t.doc.querySelector('input[data-pg="' + k + '"]'); el.checked = on; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
    await tick('S', false);
    ok('rp: removing the executive summary takes it out of the pack and the contents, and is saved in the display settings', ids(t) === 'CTBPM' && !/Executive summary/.test(text(t.doc, '.rp-toc')) && JSON.parse(t.setInputsLog.pop().display).x === 'CTBPM');
    await click('button[data-up="M"]');
    ok('rp: moving Cash movement up puts it before Profit & loss', ids(t) === 'CTBMP', ids(t));
    await tick('D', true);
    ok('rp: adding the disclaimer puts a full page at the end', ids(t) === 'CTBMPD' && /has not been audited or reviewed/.test(body(t)));
    ok('rp: page changes never refetch', t.calls.filter((c) => c.requery).length === 0);
    const tc = await go('rp', { bs_close: tamperBs('3-9000', 30) });
    ok('rp: Current Year Earnings $30 off → the pack cross-check fails, red', /✗ Net profit \(P&L\) = the Current Year Earnings movement/.test(banner(tc)) && red(tc), banner(tc).slice(0, 400));
    const jul = await go('rp', {}, {}, { from_date: '2026-07-01', to_date: '2026-07-31', prev_day: '2026-06-30', display: man('rp').inputs.find((i) => i.name === 'display').default.replace('last_month', 'custom') });
    ok('rp: July (the year\'s first month) — Current Year Earnings at the end = July\'s profit, green', green(jul) && /July 2026/.test(text(jul.doc, '.rp-cover')) && /✓ Net profit \(P&L\) = the Current Year Earnings movement/.test(banner(jul)), banner(jul).slice(0, 400));
    const x = await go('rp', {}, {}, { from_date: '2026-06-01', to_date: '2026-07-31', prev_day: '2026-05-31', display: man('rp').inputs.find((i) => i.name === 'display').default.replace('last_month', 'custom') });
    ok('rp: a period across the financial-year start — that cross-check is N/A, not a failure', /– Net profit = the Current Year Earnings movement on the Balance Sheet — N\/A — the period starts before/.test(banner(x)) && !red(x), banner(x).slice(0, 400));
    t.doc.getElementById('mk-xlsx').click(); await t.settle(); const xs = await xlsxText(t);
    ok('rp: Excel has the Balance sheet, Profit & loss and Cash movement sheets', /Balance sheet/.test(xs) && /Profit &amp; loss/.test(xs) && /Cash movement/.test(xs));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

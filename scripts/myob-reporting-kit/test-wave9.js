// Jobs reports that were written specifications: Job Profit and Loss (M53) and its comparison (M54), Job Transactions (M55), Job
// Activity (M56) and Job Exceptions (M57 cash / M58 invoice), on the ledger's job-coded lines, with tampered sources that must fail.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_journal_transactions: L.listJournalTransactions, list_job_register: L.listJobRegister, get_profit_and_loss_3m: L.profitAndLoss, list_accounts: L.listAccounts, list_company_files: L.companyFiles };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const disp = (r, patch) => { const d = JSON.parse(man(r).inputs.find((i) => i.name === 'display').default); return JSON.stringify(Object.assign(d, patch)); };
const go = async (r, over, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
const fmt = (v) => (v < 0 ? '($' : '$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : '');
// expected, from the ledger's journal lines: per job, income − expenses (P&L categories, normal balance) in [a, b]
const PLC = /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/, cls = {}; L.listAccounts({ myob_company_file_id: L.CF1 }).Items.forEach((a) => { cls[a.DisplayID] = a.Classification; });
const jobNet = (a, b) => { const o = {}; L.listJournalTransactions({ myob_company_file_id: L.CF1, from_date: a, to_date: b }).Items.forEach((t) => t.Lines.forEach((l) => { const c = cls[l.Account.DisplayID]; if (!l.Job || !PLC.test(c)) return;
  o[l.Job.Number] = Math.round(((o[l.Job.Number] || 0) + (l.IsCredit ? l.Amount : -l.Amount)) * 100) / 100; })); return o; };
(async () => {
  // ---------------- Job Profit and Loss (M53)
  let t = await go('jp');
  const N = jobNet('2026-07-01', '2026-09-28'), all = Math.round(Object.values(N).reduce((s, v) => s + v, 0) * 100) / 100;
  ok('job P&L: checks pass, the register tie on July and August (September is not a whole month)', t.errs.length === 0 && green(t) && /2026-07 to 2026-08/.test(banner(t)), [t.errs, banner(t).slice(0, 500)]);
  ok('job P&L: three jobs, net profit = Σ the job-coded income and expense lines ' + fmt(all), kpi(t, 'Jobs') === '3' && kpi(t, 'Net profit') === fmt(all), [kpi(t, 'Jobs'), kpi(t, 'Net profit')]);
  ok('job P&L: one statement per job, with gross and net profit', t.doc.querySelectorAll('#mk-body .mk-card h3').length === 3 && /J300 Coastal Freight depot/.test(text(t.doc, '#mk-body')) && /Net Profit/.test(text(t.doc, '#mk-body')));
  ok('job P&L: lines with no job and balance-sheet job lines are information', /Income and expense lines with no job/.test(banner(t)) && /Job-coded lines on balance-sheet categories \(not in a P&L\) — 0 lines/.test(banner(t)), banner(t).slice(0, 600));
  t = await go('jp', null, { display: disp('jp', { x: 'J300' }) });
  ok('job P&L: the job picker shows one job, ' + fmt(N.J300), text(t.doc, 'header .ti') === 'Job Profit and Loss — J300 Coastal Freight depot' && kpi(t, 'Net profit') === fmt(N.J300), [text(t.doc, 'header .ti'), kpi(t, 'Net profit')]);
  t = await go('jp', { register: (p) => { const r = L.listJobRegister(p); const x = r.Items.find((i) => i.Year === 2027 && i.Month === 8); x.Activity += 100; return r; } });
  ok('job P&L: a register month that differs from the journals fails', red(t) && /✗ MYOB's job register = the job-coded journal lines/.test(banner(t)) && /register .* vs journals/.test(banner(t)), banner(t).slice(0, 400));
  t = await go('jp', { register: (p) => { const r = L.listJobRegister(p); r.Items.forEach((i) => { if (i.Month >= 7) i.Year -= 1; }); return r; } });
  ok('job P&L: a register read as calendar years does not tie (Year is the financial year)', red(t), banner(t).slice(0, 300));
  t = await go('jp', null, { from_date: '2026-09-01', display: disp('jp', { p: 'custom' }) });
  ok('job P&L: no whole month in the period — the tie is N/A, not red', !red(t) && /– MYOB's job register .* N\/A — no whole month/.test(banner(t)), banner(t).slice(0, 300));
  // ---------------- Job Profit and Loss Comparison (M54)
  t = await go('jc');
  const th = [...t.doc.querySelectorAll('#mk-body thead th')].map((x) => x.textContent.trim());
  ok('comparison: own title, a column per job and a Total column', text(t.doc, 'header .ti') === 'Job Profit and Loss Comparison' && th.join('|') === '|J100 Bluegum fit-out|J200 Harbour Cafe refit|J300 Coastal Freight depot|Total' && green(t), th);
  const box = t.doc.querySelector('#jp-pick input[value="J200"]'); box.checked = false; box.dispatchEvent(new t.w.Event('change', { bubbles: true })); await t.settle();
  const th2 = [...t.doc.querySelectorAll('#mk-body thead th')].map((x) => x.textContent.trim());
  ok('comparison: unticking a job removes its column and saves the choice', th2.length === 4 && !th2.includes('J200 Harbour Cafe refit') && t.setInputsLog[t.setInputsLog.length - 1].jobs === 'J100,J300', [th2, t.setInputsLog.slice(-1)]);
  // ---------------- Job Transactions (M55)
  const aug = { from_date: '2026-08-01', display: disp('jt', { p: 'custom' }) };
  t = await go('jt', null, aug);
  ok('job transactions: 3/3 checks — the register (August), the Profit and Loss and every transaction balances', t.errs.length === 0 && green(t) && /3\/3 checks passed/.test(banner(t)), [t.errs, banner(t).slice(0, 500)]);
  const body = text(t.doc, '#mk-body');
  ok('job transactions: the 10 September sale on J300 with all its lines, the job line marked', /J300 Coastal Freight depot.*2026-09-10/.test(body) && /1-1200 Trade Debtors/.test(body) && t.doc.querySelectorAll('#mk-body .chip').length === 8, body.slice(0, 400));
  t = await go('jt', { pnl: (p) => { const r = L.profitAndLoss(p); r.AccountsBreakdown[0].AccountTotal += 50; return r; } }, aug);
  ok('job transactions: a Profit and Loss that differs from the journals fails', red(t) && /✗ Income and expense lines in the journals = MYOB's Profit and Loss/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('jt', { journals: (p) => { const r = L.listJournalTransactions(p); r.Items.find((x) => x.DateOccurred.startsWith('2026-08-21')).Lines.forEach((l) => { l.Job = null; }); return r; } }, aug);
  ok('job transactions: a job dropped from a journal line fails the register tie', red(t) && /✗ MYOB's job register/.test(banner(t)), banner(t).slice(0, 300));
  // ---------------- Job Activity (M56)
  t = await go('ja', null, { display: disp('ja', { x: 'J200' }) });
  const act = text(t.doc, '#mk-body');
  ok('job activity: J200 by category — only the job\'s lines, the reallocation journal included', text(t.doc, 'header .ti') === 'Job Activity — J200 Harbour Cafe refit' && /5-1000 Purchases/.test(act) && /Materials used on J200/.test(act) && !/Trade Debtors/.test(act), act.slice(0, 400));
  ok('job activity: the category\'s net activity', /Total for 5-1000 Purchases · net activity \$300\.00/.test(act), act.slice(0, 600));
  // ---------------- Job Exceptions (M57 / M58)
  t = await go('jx');
  const ex = text(t.doc, '#mk-body');
  ok('job exceptions: own title, both sides, checks pass', text(t.doc, 'header .ti') === 'Job Exceptions' && /Cash transactions/.test(ex) && /Invoice transactions/.test(ex) && green(t), banner(t).slice(0, 300));
  ok('job exceptions: cash — the pay run, bank fees and the reallocation\'s unassigned line; invoice — sales without a job', /Paycheque/.test(ex) && /6-2500 Bank Fees/.test(ex) && /Materials used on J200/.test(ex) && /SaleInvoice/.test(ex) && !/1-1110 Business Bank/.test(ex), ex.slice(0, 500));
  const nc = +kpi(t, 'Unassigned lines — cash'), ni = +kpi(t, 'Unassigned lines — invoices'), un = [0, 0];
  L.listJournalTransactions({ myob_company_file_id: L.CF1, from_date: '2026-09-01', to_date: '2026-09-28' }).Items.forEach((tr) => tr.Lines.forEach((l) => { const c = cls[l.Account.DisplayID]; if (l.Job || !PLC.test(c)) return; const inc = /Income/.test(c); un[inc ? 0 : 1] += (inc === !!l.IsCredit ? 1 : -1) * l.Amount; }));
  ok('job exceptions: income ' + fmt(un[0]) + ' and expenses ' + fmt(un[1]) + ' with no job, counted separately', kpi(t, 'Income with no job') === fmt(Math.round(un[0] * 100) / 100) && kpi(t, 'Expenses with no job') === fmt(Math.round(un[1] * 100) / 100), [kpi(t, 'Income with no job'), kpi(t, 'Expenses with no job')]);
  t = await go('jx', null, { display: disp('jx', { x: 'invoice' }) });
  ok('job exceptions: show invoice transactions only', !/Cash transactions —/.test(text(t.doc, '#mk-body')) && t.doc.querySelectorAll('#mk-body .mk-card').length === 1 && nc > 0 && ni > 0, [nc, ni]);

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

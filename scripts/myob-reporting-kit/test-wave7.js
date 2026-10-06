// Payroll reports that were written specifications: Pay Item Transactions (M30, a payroll view), Timesheets (M24) and Leave Balance
// (M28/M29, list_employee_leave_balances) — against the ledger, with tampered sources that must fail.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_payroll_advices: L.listPayrollAdvices, get_payroll_category_summary: L.payrollCategorySummary, list_journal_transactions: L.listJournalTransactions, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_timesheets: L.listTimesheets, list_employee_leave_balances: L.listEmployeeLeaveBalances };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const said = (t) => t.setInputsLog[t.setInputsLog.length - 1] || {};
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
(async () => {
  // ---------------- Pay Item Transactions (M30)
  let t = await go('pyi');
  ok('pay item transactions: own title, checks pass (category-summary tie, pay items = every line)', t.errs.length === 0 && text(t.doc, 'header .ti') === 'Pay Item Transactions' && green(t) && /✓ Pay item totals = every paycheque line/.test(banner(t)) && /✓ Wages and PAYG on the paycheques = MYOB/.test(banner(t)), [t.errs, banner(t).slice(0, 400)]);
  const heads = [...t.doc.querySelectorAll('#py-grid tr.k-header')].map((r) => r.textContent);
  ok('pay item transactions: a section per pay item', heads.some((x) => /^Base Salary/.test(x)) && heads.some((x) => /^PAYG Withholding/.test(x)) && heads.some((x) => /^Superannuation Guarantee/.test(x)), heads);
  ok('pay item transactions: employees under each pay item, with totals', /Alex Morgan/.test(text(t.doc, '#py-grid')) && /Sam Lee/.test(text(t.doc, '#py-grid')) && /Total for Base Salary/.test(text(t.doc, '#py-grid')));
  await view(t, 'runs');
  ok('pay item transactions: the other payroll views are there (title follows the view)', text(t.doc, 'header .ti') === 'Pay Run History');
  t = await go('pyi', { cats: (p) => { const r = L.payrollCategorySummary(p); r.PayrollCategoryBreakdown = r.PayrollCategoryBreakdown.map((x) => (x.PayrollCategory.Type === 'Wage' ? Object.assign({}, x, { Amount: x.Amount + 100 }) : x)); return r; } });
  ok('pay item transactions: wages that disagree with MYOB\'s category summary fail', red(t) && /✗ Wages and PAYG on the paycheques/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Timesheets (M24)
  t = await go('tm');
  const P = { from_date: said(t).from_date, to_date: said(t).to_date, myob_company_file_id: L.CF1 };
  let H = 0, HP = 0; L.listTimesheets(P).Items.forEach((s) => s.Lines.forEach((l) => l.Entries.forEach((e) => { const d = e.Date.slice(0, 10); if (d >= P.from_date && d <= P.to_date) { H += e.Hours; if (e.Processed) HP += e.Hours; } })));
  H = Math.round(H * 100) / 100; HP = Math.round(HP * 100) / 100;
  ok('timesheets: 2/2 checks and the unprocessed hours line', t.errs.length === 0 && green(t) && /2\/2 checks passed/.test(banner(t)) && /Hours not yet processed in a pay run/.test(banner(t)), banner(t).slice(0, 300));
  ok('timesheets: hours logged ' + H.toFixed(2) + ', processed ' + HP.toFixed(2), kpi(t, 'Hours logged') === H.toFixed(2) && kpi(t, 'Processed in a pay run') === HP.toFixed(2) && kpi(t, 'Employees') === '2', [kpi(t, 'Hours logged'), kpi(t, 'Processed in a pay run')]);
  ok('timesheets: weeks per employee with daily entries, job and customer, and the processed status', /Week 2026-09/.test(text(t.doc, '#mk-body')) && /Job J100 Bluegum fit-out · Bluegum Architects · On site/.test(text(t.doc, '#mk-body')) && /Not processed/.test(text(t.doc, '#mk-body')));
  const n0 = t.calls.length, sel = t.doc.getElementById('tm-emp'); sel.value = sel.options[1].value; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(20);
  ok('timesheets: the employee picker narrows without a refetch', t.calls.length === n0 && kpi(t, 'Employees') === '1' && /Timesheets — /.test(text(t.doc, 'header .ti')));
  await view(t, 'summary');
  ok('timesheets: hours by employee and payroll category', /Base Hourly/.test(text(t.doc, '#mk-body')) && /Not yet processed/.test(text(t.doc, '#mk-body')));
  t = await go('tm', { sheets: (p) => { const r = L.listTimesheets(p); r.Items = JSON.parse(JSON.stringify(r.Items)); r.Items[0].Lines[0].Entries[0].Date = '2026-12-25T00:00:00'; return r; } });
  ok('timesheets: an entry dated outside its week fails', red(t) && /✗ Every entry is dated inside its timesheet week/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Leave Balance (M28 / M29)
  t = await go('lv');
  ok('leave balance: checks pass (carried over + this year = balance), negative balance flagged', t.errs.length === 0 && green(t) && /✓ Carried over \+ this year = balance/.test(banner(t)) && /Sam Lee Personal Leave Accrual -2\.50/.test(banner(t)), banner(t).slice(0, 400));
  ok('leave balance: Alex Morgan holiday 114.50 hours (76.00 + 38.50), valued at $45 an hour', (() => { const r = [...t.doc.querySelectorAll('#mk-body tr.k-row')].find((x) => /Holiday Leave Accrual/.test(x.textContent) && x.closest('tbody').textContent.indexOf('Alex Morgan') >= 0); return r && /76\.00/.test(r.textContent) && /38\.50/.test(r.textContent) && /114\.50/.test(r.textContent) && /\$5,152\.50/.test(r.textContent); })(), text(t.doc, '#mk-body').slice(0, 500));
  ok('leave balance: an unassigned entitlement with no hours is left out; the terminated employee too', !/Long Service Leave/.test(text(t.doc, '#mk-body')) && !/Jo Park/.test(text(t.doc, '#mk-body')) && kpi(t, 'Employees') === '2');
  ok('leave balance: a negative balance is shown above the table', /1 negative balance: Sam Lee — Personal Leave Accrual/.test(text(t.doc, '#mk-body')));
  ok('leave balance: never shows tax file numbers, dates of birth or emails', !/TaxFileNumber|DateOfBirth|@/.test(t.doc.body.innerHTML));
  await view(t, 'entitlements');
  ok('leave balance (detail): by entitlement, employees under each', text(t.doc, 'header .ti') === 'Leave Balance (Detail)' && /Total for Holiday Leave Accrual/.test(text(t.doc, '#mk-body')));
  t = await go('lv', { leave: (p) => { const r = L.listEmployeeLeaveBalances(p); r.Items[0].Entitlements[0].Total = 100; return r; } });
  ok('leave balance: a balance that is not carried over + this year fails', red(t) && /✗ Carried over \+ this year = balance/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('lv', { leave: () => ({ Count: 0, Items: [] }) });
  ok('leave balance: no entitlements → says so, not red', /MYOB returned no leave entitlements/.test(text(t.doc, '#mk-body')) && !red(t) && t.errs.length === 0);

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

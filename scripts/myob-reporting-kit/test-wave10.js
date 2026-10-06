// Budget Management (M01), a written specification until now: the budget by month, budget vs actual, the rolling budget year, the
// empty next year, and tampered budgets that must fail.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { get_budget: L.getBudget, get_profit_and_loss_3m: L.profitAndLoss, list_accounts: L.listAccounts, list_company_files: L.companyFiles };
const calls = [];
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = (p) => { calls.push([b.id, p]); return TOOL[b.tool.name](p); }; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const disp = (patch) => { const d = JSON.parse(man('bu').inputs.find((i) => i.name === 'display').default); return JSON.stringify(Object.assign(d, patch)); };
const go = async (over, set) => { const m = onFile(man('bu'), set); const t = await run('bu', m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
const fmt0 = (v) => (v < 0 ? '($' : '$') + Math.abs(Math.round(v)).toLocaleString('en-AU') + (v < 0 ? ')' : '');
// expected budget net profit for the first n months of FY2027, from the ledger's budget (income + / expenses −, balance sheet left out)
const budNp = (n) => { let s = 0; L.getBudget({ myob_company_file_id: L.CF1, financial_year: 2027 }).Budgets.forEach((b) => { const id = b.Account.DisplayID, sg = /^[48]-/.test(id) ? 1 : /^[569]-/.test(id) ? -1 : 0; b.MonthlyBudgets.slice(0, n).forEach((x) => { s += sg * x.Amount; }); }); return Math.round(s * 100) / 100; };
(async () => {
  let t = await go();
  ok('budget: 4/4 checks, FY2027 — July 2026 to June 2027', t.errs.length === 0 && green(t) && /4\/4 checks passed/.test(banner(t)) && /Financial year 1 July 2026 – 30 June 2027/.test(text(t.doc, 'header')), [t.errs, banner(t).slice(0, 400), text(t.doc, 'header').slice(0, 200)]);
  const th = [...t.doc.querySelectorAll('#mk-body table')[0].querySelectorAll('thead th')].map((x) => x.textContent.trim());
  ok('budget: 12 month columns from July and a Total', th.length === 14 && th[1] === 'Jul 26' && th[12] === 'Jun 27' && th[13] === 'Total', th);
  ok('budget: budgeted net profit for the year ' + fmt0(budNp(12)), kpi(t, 'Budgeted net profit') === fmt0(budNp(12)) && kpi(t, 'Categories budgeted') === '11', [kpi(t, 'Budgeted net profit'), kpi(t, 'Categories budgeted')]);
  ok('budget: the bank\'s budget under Balance sheet budgets, not in the P&L', /Balance sheet budgets/.test(text(t.doc, '#mk-body')) && /1-1110 Business Bank Account #1/.test(text(t.doc, '#mk-body')));
  calls.length = 0; t = await go(null, { financial_year: 2026, fy_start: '2025-07-01', act_end: '2025-08-31' });
  ok('budget: a saved report with last year\'s inputs rolls to the current year (MYOB refuses older years)', green(t) && calls.some(([id, p]) => id === 'budget' && p.financial_year === 2027) && /FY2027/.test(banner(t)), [banner(t).slice(0, 300), calls.filter((c) => c[0] === 'budget').map((c) => c[1].financial_year)]);
  t = await go(null, { budget_year: 'next' });
  ok('budget: next year (FY2028) has no budget — said plainly, nothing invented, not red', /No budget is set up in MYOB for the financial year 1 July 2027 – 30 June 2028/.test(text(t.doc, '#mk-body')) && !red(t) && !t.doc.querySelector('#mk-body table'), banner(t).slice(0, 300));
  // ---------------- Budget vs actual
  t = await go(null, { display: disp({ v: 'actual' }) });
  const act = L.expect.netProfit('2026-07-01', '2026-08-31', false, L.CF1);
  ok('budget vs actual: July and August — budget ' + fmt0(budNp(2)) + ', actual ' + fmt0(act), text(t.doc, 'header .ti') === 'Budget vs Actual' && kpi(t, 'Months compared') === 'Jul 26 – Aug 26' && kpi(t, 'Budgeted net profit') === fmt0(budNp(2)) && kpi(t, 'Actual net profit') === fmt0(act) && kpi(t, 'Variance') === fmt0(act - budNp(2)),
    ['Months', 'Budgeted net profit', 'Actual net profit', 'Variance'].map((l) => kpi(t, l === 'Months' ? 'Months compared' : l)));
  ok('budget vs actual: budget, actual and variance columns', [...t.doc.querySelectorAll('#mk-body thead th')].map((x) => x.textContent.trim()).join('|') === '|Budget|Actual|Variance ($)|Variance (%)');
  // ---------------- tampered budgets
  t = await go({ budget: (p) => Object.assign(L.getBudget(p), { LastMonthInFinancialYear: 12 }) });
  ok('budget: a year that ends in December when the report expects June fails', red(t) && /✗ MYOB's budget is for the financial year asked for/.test(banner(t)), banner(t).slice(0, 300));
  t = await go({ budget: (p) => { const r = L.getBudget(p); r.Budgets[0].MonthlyBudgets[11] = { Year: 2027, Month: 7, Amount: 99 }; return r; } });
  ok('budget: a month outside the financial year fails', red(t) && /✗ Every budget month falls in the financial year/.test(banner(t)), banner(t).slice(0, 300));
  t = await go({ budget: (p) => { const r = L.getBudget(p); r.Budgets.push({ Account: { UID: 'zzz', DisplayID: '6-9999', Name: 'Mystery' }, MonthlyBudgets: [{ Year: 2026, Month: 7, Amount: 10 }] }); return r; }, accounts: (p) => L.listAccounts(p) });
  ok('budget: a budgeted category missing from the chart of accounts fails', red(t) && /✗ Every budgeted category is in the chart of accounts .*6-9999/.test(banner(t)), banner(t).slice(0, 300));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

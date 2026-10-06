// CRA-01 Financial Overview (MYOB) on the MYOB kit's ledger (one set of books, two company files): the figures are the books', every
// tie passes, a tampered source fails its check, controls refetch only what they change, LIB-002 isolation holds.
const { suite } = require('../harness.js');
const { L, E, go, text, wait, banner, body, green, red, fmt, xlsxText, conformance, common } = require('./lib.js');
const { ok, done } = suite('myob/financial-overview');
const ID = 'financial-overview', r2 = L.r2, CF = L.CF1, T = L.TODAY;
const pl = (a, b, cash) => { const p = E.plByAccount(a, b, cash, CF), s = (re) => r2(Object.keys(p).filter((id) => re.test(id)).reduce((x, id) => x + p[id], 0)); const rev = s(/^4-/), gp = r2(rev - s(/^5-/)); return { rev, gp, np: E.netProfit(a, b, cash, CF) }; };
const ticks = (t) => [...t.doc.querySelectorAll('#cra-trend text.tick')].map((x) => x.textContent);
const tamper =(fn, id, d) => (p) => { const r = fn(p); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === id) x.AccountTotal = r2(x.AccountTotal + d); }); return r; };
(async () => {
  const t = await go(ID), K = pl('2026-07-01', '2026-09-30', false), LY = pl('2025-07-01', '2025-09-30', false);
  ok('opens green: every check passes on the books (P&L rows, journals this year and last, Current Year Earnings, Balance Sheet, both ageings)', green(t) && /✓ Validation: 9\/9 checks passed/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 900));
  ok('KPIs: revenue, gross profit and net profit are the books\' for Jul–Sep 2026, each with last year\'s', new RegExp('Revenue' + fmt(K.rev)).test(body(t)) && new RegExp('Gross profit' + fmt(K.gp)).test(body(t)) && new RegExp('Net profit' + fmt(K.np)).test(body(t)) && new RegExp('Last year ' + fmt(LY.rev)).test(body(t)), { K, LY, b: body(t).slice(0, 500) });
  ok('margins shown as percentages with the change in points', new RegExp('Gross margin' + (K.gp / K.rev * 100).toFixed(1) + '%').test(body(t)) && /pts/.test(body(t)));
  const bal = E.balances('2026-09-30', CF), bank = r2(bal['1-1110'] + bal['1-1120']);
  ok('bank balances: each bank account and the total at the period end', new RegExp('Business Bank Account #1' + fmt(bal['1-1110'])).test(text(t.doc, '#cra-bank')) && new RegExp('Total' + fmt(bank)).test(text(t.doc, '#cra-bank')), text(t.doc, '#cra-bank'));
  const ar = L.agedReceivables({ myob_company_file_id: CF, report_date: T }), ap = L.agedPayables({ myob_company_file_id: CF, report_date: T });
  ok('ageing: receivables and payables totals are the connector\'s, with top 5 customers', new RegExp('All customers(\\(?\\$[\\d,.]+\\)?){5}' + fmt(ar.grand_total)).test(body(t)) && new RegExp(fmt(ap.grand_total)).test(body(t)) && t.doc.querySelectorAll('#mk-body .mk-grid tr.detail-block').length > 0, { ar: ar.grand_total, ap: ap.grand_total });
  ok('trend: one point per month of the period from the journals', (t.doc.querySelector('#cra-trend svg') || { innerHTML: '' }).innerHTML.split('<polyline').length === 3 && /Jul 26Aug 26Sep 26/.test(text(t.doc, '#cra-trend')));
  ok('every MYOB call carries the chosen company file; ageing and today\'s Balance Sheet use today', t.calls.filter((c) => c.params && c.id !== 'company_files').every((c) => c.params.myob_company_file_id === CF) && t.calls.find((c) => c.id === 'aged_ar').params.report_date === T && t.calls.find((c) => c.id === 'pnl_ly').params.from_date === '2025-07-01');
  // ---- controls: a one-month period shows the latest 12 months; basis refetches only what it changes
  const n0 = t.calls.length; const pre = t.doc.getElementById('mk-preset'); pre.value = 'last_month'; pre.dispatchEvent(new t.w.Event('change')); await wait(150);
  const re1 = t.calls.slice(n0).map((c) => c.id);
  ok('period preset → P&L, last year, Balance Sheet and journals refetched (not the ageing or accounts); last year moves with it', ['pnl', 'pnl_ly', 'bs', 'journals'].every((id) => re1.includes(id)) && !re1.includes('aged_ar') && !re1.includes('accounts') && t.calls.slice(n0).find((c) => c.id === 'pnl_ly').params.from_date === '2025-08-01', re1);
  ok('a one-month period: the trend shows the 12 months to its end, still green', ticks(t).length === 12 && ticks(t)[0] === 'Sep 25' && ticks(t)[11] === 'Aug 26' && green(t), ticks(t).join(',') + ' ' + banner(t).slice(0, 300));
  const n1 = t.calls.length; const cash = t.doc.querySelector('input[name="mk-basis"][value="Cash"]'); cash.checked = true; cash.dispatchEvent(new t.w.Event('change')); await wait(150);
  const re2 = t.calls.slice(n1).map((c) => c.id), KC = pl('2026-08-01', '2026-08-31', true);
  ok('cash basis → only the P&Ls and the period-end Balance Sheet refetch, on Cash', re2.sort().join() === 'bs,pnl,pnl_ly' && t.calls.slice(n1).every((c) => c.params.reporting_basis === 'Cash'), re2);
  ok('cash basis: KPIs are the cash P&L; the trend says N/A (journals are accrual) instead of faking months', new RegExp('Revenue' + fmt(KC.rev)).test(body(t)) && /N\/A — not in source: the monthly trend/.test(text(t.doc, '#cra-trend')) && !/✗/.test(banner(t)), { KC, b: banner(t).slice(0, 400) });
  // ---- tampering
  const tp = await go(ID, { pnl: tamper(L.profitAndLoss, '4-1400', 10) });
  ok('a P&L $10 off the journals → the journals tie and Current Year Earnings fail, red', /✗ Revenue and net profit = MYOB’s journals/.test(banner(tp)) && /✗ Net profit \(financial year/.test(banner(tp)) && red(tp), banner(tp).slice(0, 500));
  const tl = await go(ID, { pnl_ly: (p) => L.profitAndLoss(Object.assign({}, p, { from_date: '2025-06-01' })) });
  ok('last-year P&L for other dates → the comparison-dates check fails', /✗ Last-year figures come from a Profit and Loss for exactly 2025-07-01 to 2025-09-30/.test(banner(tl)) && red(tl), banner(tl).slice(0, 400));
  const ta = await go(ID, { bs_now: tamper(L.balanceSheet, '1-1200', 40) });
  ok('receivables control $40 off the ageing → the receivables ageing tie fails', /✗ Receivables ageing/.test(banner(ta)) && !/✗ Payables ageing/.test(banner(ta)) && red(ta), banner(ta).slice(0, 400));
  const tb = await go(ID, { bs: tamper(L.balanceSheet, '1-1110', 5) });
  ok('period-end Balance Sheet out of balance → its check fails', /✗ Balance Sheet at 2026-09-30 balances/.test(banner(tb)) && red(tb));
  const tf = await go(ID, null, { fail: { aged_ap: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('a failed ageing source is never silent: the section says so and the banner is red', /MYOB returned an error/.test(body(tf)) && red(tf), banner(tf).slice(0, 300));
  // ---- Excel
  t.doc.getElementById('mk-xlsx').click(); await wait(40); const xs = await xlsxText(t);
  ok('Excel: Overview, Trend-free on cash, Bank balances, both ageings; header block with client, period, basis and currency', ['Overview', 'Bank balances', 'Receivables ageing', 'Payables ageing'].every((s) => xs.includes(s)) && xs.includes('Basis: Cash') && xs.includes('Currency: AUD') && xs.includes(L.FILES[CF].Name));
  await common(ID, ok);
  await conformance(ID, ok);
  done();
})();

// Wave 4 behaviour tests: forecast maths, assumptions, views, snapshot, Excel; employees and time hours, filters, views, cap.
const { run, hydrate } = require('./harness.js');
const F = require('./fixtures.js');
const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
let total = 0, fails = 0;
function ok(n, c, info) { total++; if (!c) { fails++; console.log('  FAIL', n, info === undefined ? '' : String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)); } }
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); };
const rowCells = (d, label) => { const tr = [...d.querySelectorAll('#g1 tr')].find((r) => (r.cells[0] || {}).textContent === label); return tr ? [...tr.cells].map((c) => c.textContent) : null; };
const lastInputs = (t) => t.setInputsLog[t.setInputsLog.length - 1] || {};
const CI = () => F.companyInfo, PR = () => F.prefs;
(async () => {
  // ---------------- Forecast (Q09)
  const fm = man('forecast'), ffx = { pnl_monthly: F.pnl, company_info: CI, prefs: PR };
  let t = await run('forecast', fm, ffx);
  ok('forecast: no errors', t.errs.length === 0, t.errs);
  const head = [...t.doc.querySelectorAll('#g1 thead th')].map((x) => x.textContent);
  ok('forecast: 12 forecast months Sep 2026 … Aug 2027', head.includes('Sep 2026') && head.includes('Aug 2027') && !head.includes('Sep 2027'), head);
  ok('forecast: period line names base and forecast', /Base period September 2025 - August 2026|Base period .*2025.*2026/.test(text(t.doc, '#qb-head .pe')) && /forecast Sep 2026 - Aug 2027/.test(text(t.doc, '#qb-head .pe')), text(t.doc, '#qb-head .pe'));
  ok('forecast: title says method', text(t.doc, '#qb-head .ti') === 'Forecast — Linear trend', text(t.doc, '#qb-head .ti'));
  ok('forecast: band drawn', !!t.doc.querySelector('#ch1 polygon'));
  ok('forecast: estimate note', text(t.doc, '#qb-sources').includes('This is an estimate'));
  ok('forecast: base-period check passes', /✓ Base period equals actuals/.test(text(t.doc, '#qb-banner')), text(t.doc, '#qb-banner'));
  // Executive persona hides account rows; Bookkeeper shows Adjust % column
  ok('forecast: summary persona has no Adjust % column', !head.includes('Adjust %'));
  await set(t, 'qb-persona', 'Bookkeeper');
  ok('forecast: bookkeeper shows Adjust %', [...t.doc.querySelectorAll('#g1 thead th')].some((x) => x.textContent === 'Adjust %'));
  // Average: R&D - Rent = mean of per(9600) over 12 months = 9600 × 1.05 = 10,080
  await set(t, 'qb-enum-1', 'average');
  let rent = rowCells(t.doc, 'R&D - Rent');
  ok('forecast: average method Rent = A$10,080', rent && rent[2] === 'A$10,080' && rent[13] === 'A$10,080', rent);
  ok('forecast: title follows method', text(t.doc, '#qb-head .ti') === 'Forecast — Average of base period');
  // Seasonal: Sep 2026 = Sep 2025 (m % 3 = 0 → 9,600); Oct 2026 = Oct 2025 (×1.05 → 10,080)
  await set(t, 'qb-enum-1', 'seasonal');
  rent = rowCells(t.doc, 'R&D - Rent');
  ok('forecast: seasonal Rent Sep = A$9,600, Oct = A$10,080', rent && rent[2] === 'A$9,600' && rent[3] === 'A$10,080', rent);
  // Section adjustment: Expenses +10% → Rent Sep 10,560
  const c0 = t.calls.length;
  let inp = t.doc.querySelector('input.w-adj[data-k="Expenses"]'); inp.value = '10'; inp.dispatchEvent(new t.w.Event('change')); await t.settle();
  rent = rowCells(t.doc, 'R&D - Rent');
  ok('forecast: Expenses +10% applied', rent && rent[2] === 'A$10,560', rent);
  ok('forecast: assumptions never refetch', t.calls.slice(c0).filter((c) => c.requery).length === 0, t.calls.slice(c0));
  ok('forecast: adjust input announced', lastInputs(t).adjust === '{"Expenses":10}', lastInputs(t));
  ok('forecast: KPI shows adjustment', text(t.doc, '.qb-kpis').includes('Expenses +10%'));
  // Account override: Rent −50% beats the section +10%
  inp = t.doc.querySelector('input.w-adj[data-k="a:61"]'); inp.value = '-50'; inp.dispatchEvent(new t.w.Event('change')); await t.settle();
  rent = rowCells(t.doc, 'R&D - Rent');
  ok('forecast: account override Rent −50% = A$4,800', rent && rent[2] === 'A$4,800', rent);
  ok('forecast: adjust JSON holds both', JSON.parse(lastInputs(t).adjust)['a:61'] === -50 && JSON.parse(lastInputs(t).adjust).Expenses === 10, lastInputs(t).adjust);
  // Net profit row = identity of section totals
  const np = rowCells(t.doc, 'Net Profit'), ti = rowCells(t.doc, 'Total for Income'), tc = rowCells(t.doc, 'Total for Cost of Sales'), te = rowCells(t.doc, 'Total for Expenses'), to = rowCells(t.doc, 'Total for Other Income');
  const num = (s) => Number(String(s).replace(/[^0-9.-]/g, '')) * (/^-/.test(s) ? 1 : 1);
  ok('forecast: Net Profit = I − COGS − E + OI (Sep)', np && Math.abs(num(np[2]) - (num(ti[2]) - num(tc[2]) - num(te[2]) + num(to[2]))) <= 2, [np && np[2], ti && ti[2], tc && tc[2], te && te[2], to && to[2]]);
  // Scenarios view
  await set(t, 'qb-view', 'scenarios');
  ok('forecast: scenarios columns', text(t.doc, '#g1').includes('Forecast — no adjustments') && text(t.doc, '#g1').includes('Forecast — with adjustments'));
  const sc = rowCells(t.doc, 'Total for Expenses');
  ok('forecast: scenario change is non-zero with adjustments', sc && sc[4] !== 'A$0', sc);
  // Forecast vs actual: Sep 2026 (month to date) has actuals after the base
  await set(t, 'qb-view', 'fva');
  const fva = rowCells(t.doc, 'Sep 2026 (month to date)');
  ok('forecast: fva row has forecast, actual and variance', fva && fva.length === 6 && fva.every((x, i) => i === 0 || /A\$\d/.test(x)), fva);
  ok('forecast: fva lists Sep 2026 month to date', text(t.doc, '#g1').includes('Sep 2026 (month to date)'), text(t.doc, '#g1').slice(0, 200));
  // Clear adjustments
  t.doc.getElementById('w-adj-reset').click(); await t.settle();
  ok('forecast: clear adjustments', lastInputs(t).adjust === '{}');
  // Short base + seasonal → falls back to average, check N/A
  await set(t, 'qb-from', '2026-03-01');
  ok('forecast: short base note', text(t.doc, '#qb-sources').includes('Same month last year needs 12 complete base months'), text(t.doc, '#qb-sources'));
  ok('forecast: history check N/A not fail', /– Base period has enough history/.test(text(t.doc, '#qb-banner')) && t.doc.querySelector('#qb-banner').className.includes('pass'), text(t.doc, '#qb-banner'));
  // Excel
  await set(t, 'qb-view', 'grid');
  t.doc.getElementById('qb-xlsx').click(); await t.settle();
  const blob = t.downloads.find((d) => d.blob); const bytes = blob ? Buffer.from(await blob.blob.arrayBuffer()).toString('latin1') : '';
  ok('forecast: xlsx sheets', ['Forecast', 'Assumptions', 'Forecast vs actual', 'Validation', 'Parameters'].every((n) => bytes.includes('name="' + n + '"')), bytes.match(/<sheet [^>]*>/g));
  ok('forecast: no errors after all', t.errs.length === 0, t.errs);
  t = await run('forecast', fm, ffx);
  await set(t, 'qb-persona', 'Bookkeeper');
  t.doc.querySelector('input.w-adj[data-k="Income"]').value = '2'; t.doc.querySelector('input.w-adj[data-k="Income"]').dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('forecast: section adjust ok', lastInputs(t).adjust === '{"Income":2}');
  // Snapshot keeps the saved base end (not the capture date) and renders
  const snap = await run('forecast', fm, ffx, { mode: 'snapshot', bundle: hydrate(fm, ffx, {}) });
  ok('forecast: snapshot no errors', snap.errs.length === 0, snap.errs);
  ok('forecast: snapshot base period ends Aug 2026', /forecast Sep 2026/.test(text(snap.doc, '#qb-head .pe')), text(snap.doc, '#qb-head .pe'));
  await set(snap, 'qb-enum-1', 'average');
  ok('forecast: snapshot method change redraws', text(snap.doc, '#qb-head .ti') === 'Forecast — Average of base period', text(snap.doc, '#qb-head .ti'));
  await set(snap, 'qb-persona', 'Bookkeeper');
  ok('forecast: snapshot persona change redraws', [...snap.doc.querySelectorAll('#g1 thead th')].some((x) => x.textContent === 'Adjust %'));
  // Live QA: front-loaded history (income early, then nothing) — the linear trend must not forecast negative income
  const frontLoaded = (p) => { const r = F.pnl(p), cols = r.Columns.Column.length - 1; const walkRows = (rows) => rows.forEach((x) => { if (x.Rows) walkRows(x.Rows.Row); [x.ColData, x.Summary && x.Summary.ColData].forEach((cd) => { if (!cd) return; for (let i = 1; i <= cols; i++) { const v = Number(cd[i].value); if (cd[i].value !== '' && isFinite(v)) { const k = i === cols ? null : (i - 1); cd[i].value = (k == null ? v : v * Math.max(0, 1 - k / 4)).toFixed(2); } } }); }); walkRows(r.Rows.Row); return r; };
  const fl = await run('forecast', fm, { pnl_monthly: frontLoaded, company_info: CI, prefs: PR });
  const inc = rowCells(fl.doc, 'Total for Income'), exp = rowCells(fl.doc, 'Total for Expenses');
  ok('forecast: trend never forecasts negative income or expenses', inc && exp && inc.slice(1).concat(exp.slice(1)).every((x) => !/^-/.test(x)), [inc, exp]);
  ok('forecast: held-at-zero note', text(fl.doc, '#qb-sources').includes('are held at zero'), text(fl.doc, '#qb-sources').slice(0, 400));
  ok('forecast: front-loaded has no script errors', fl.errs.length === 0, fl.errs);
  // Not connected
  const nc = await run('forecast', fm, ffx, { fail: { pnl_monthly: { code: 'needs_connection', message: 'x' } } });
  ok('forecast: needs_connection', text(nc.doc, 'main').includes('Connect QuickBooks'));

  // ---------------- Employees and time (Q31)
  const em = man('employees-time'), efx = { time_activities: F.timeActivities, employees: F.employees, company_info: CI, prefs: PR };
  t = await run('employees-time', em, efx);
  ok('time: no errors', t.errs.length === 0, t.errs);
  const tot = rowCells(t.doc, 'TOTAL');
  ok('time: total 31:30 and A$4,473.75', tot && tot[1] === '31:30' && tot[3] === 'A$4,473.75', tot);
  const mb = rowCells(t.doc, 'Total for Melanie Burrows'), ys = rowCells(t.doc, 'Total for Yucheng Sun');
  ok('time: Melanie 14:30', mb && mb[1] === '14:30', mb);
  ok('time: Yucheng 11:00 (start/end less break)', ys && ys[1] === '11:00', ys);
  ok('time: billable 24:30', text(t.doc, '.qb-kpis').includes('24:30'), text(t.doc, '.qb-kpis'));
  ok('time: August excluded', !text(t.doc, '#g1').includes('2026-08-28'));
  ok('time: supplier marked', text(t.doc, '#g1').includes('Gareth Owen Chainey (supplier)'));
  ok('time: checks pass', t.doc.querySelector('#qb-banner').className.includes('pass'), text(t.doc, '#qb-banner'));
  await set(t, 'w-emp', 'E:301');
  ok('time: filter to Melanie', text(t.doc, '#qb-head .ti') === 'Time Activities by Employee Detail — Melanie Burrows' && !text(t.doc, '#g1').includes('Yucheng'), text(t.doc, '#qb-head .ti'));
  ok('time: filter stored in display x', JSON.parse(lastInputs(t).display).x === 'E:301');
  await set(t, 'w-emp', '');
  await set(t, 'qb-view', 'timesheet');
  ok('time: timesheet start/end', text(t.doc, '#g1').includes('09:00') && text(t.doc, '#g1').includes('17:30') && text(t.doc, '#g1').includes('0:30'), text(t.doc, '#g1').slice(0, 300));
  await set(t, 'qb-view', 'recent');
  ok('time: recent shows edited T9', text(t.doc, '#g1').includes('Edited') && text(t.doc, '#g1').includes('2026-09-25 16:20'), text(t.doc, '#g1').slice(0, 300));
  await set(t, 'qb-view', 'pay_type');
  ok('time: pay type N/A without payroll', text(t.doc, '#g1').includes('Pay types are not in this QuickBooks company'));
  await set(t, 'qb-view', 'contacts');
  ok('time: contacts address', text(t.doc, '#g1').includes('1 George St, Sydney, NSW, 2000') && text(t.doc, '#g1').includes('yucheng@example.com'), text(t.doc, '#g1').slice(0, 300));
  ok('time: contacts period line', text(t.doc, '#qb-head .pe') === 'Active employees');
  t.doc.getElementById('qb-xlsx').click(); await t.settle();
  const eb = t.downloads.find((d) => d.blob); const ebytes = eb ? Buffer.from(await eb.blob.arrayBuffer()).toString('latin1') : '';
  ok('time: contacts xlsx sheet', ebytes.includes('name="Employee Contact List"'));
  // Pay types present
  const tp = await run('employees-time', em, Object.assign({}, efx, { time_activities: F.timeActivitiesPay }));
  await set(tp, 'qb-view', 'pay_type');
  ok('time: pay type summary', text(tp.doc, '#g1').includes('Ordinary hours') && text(tp.doc, '#g1').includes('Overtime'), text(tp.doc, '#g1').slice(0, 200));
  // 1,000 cap reached inside the period → red check
  const many = () => { const r = F.timeActivities(); const one = r.QueryResponse.TimeActivity[0]; r.QueryResponse.TimeActivity = Array.from({ length: 1000 }, (_, i) => Object.assign({}, one, { Id: 'X' + i, TxnDate: '2026-09-20' })); return r; };
  const tc2 = await run('employees-time', em, Object.assign({}, efx, { time_activities: many }));
  ok('time: capped period flagged', tc2.doc.querySelector('#qb-banner').className.includes('fail') && text(tc2.doc, '#qb-banner').includes('latest 1,000'), text(tc2.doc, '#qb-banner'));
  // Employees failing only affects the contact list
  const ef = await run('employees-time', em, efx, { fail: { employees: { code: 'tool_error', message: 'boom' } } });
  ok('time: employees failure visible', ef.doc.querySelector('#qb-banner').className.includes('fail'));
  ok('time: time still shown when employees fail', text(ef.doc, '#g1').includes('Total for Melanie Burrows'));
  // ---------------- QA #2: Balance Sheet in the AU layout (no groups, no 'Total liabilities', "Total shareholders' equity", 'Profit for the year')
  const bm = man('bs'), bfx = { bs: F.bsAU, bs_compare: F.bsAU, pnl_ytd: F.pnl, company_info: CI, prefs: PR };
  const b = await run('bs', bm, bfx);
  ok('bs AU: no errors', b.errs.length === 0, b.errs);
  ok('bs AU: Net Earnings tie passes', /✓ Net Earnings = P&L financial year to date — Profit for the year/.test(text(b.doc, '#qb-banner')), text(b.doc, '#qb-banner'));
  ok('bs AU: 4/4 checks', /4\/4 checks passed/.test(text(b.doc, '#qb-banner')), text(b.doc, '#qb-banner').slice(0, 120));
  ok('bs AU: liabilities and equity KPIs filled', !text(b.doc, '.qb-kpis').includes('N/A'), text(b.doc, '.qb-kpis'));
  ok('bs AU: chart has all four bars', b.doc.querySelectorAll('#ch1 rect').length === 4, b.doc.querySelectorAll('#ch1 rect').length);
  ok('bs AU: derived liabilities explained', text(b.doc, '#qb-sources').includes('QuickBooks shows no liabilities total'));
  ok('bs AU: profit line keeps QuickBooks wording', text(b.doc, '#qb-body').includes('Profit for the year'));
  const bu = await run('bs', bm, { bs: F.bs, bs_compare: F.bs, pnl_ytd: F.pnl, company_info: CI, prefs: PR });
  ok('bs US: Net Income shown as Net Earnings, no derived note', text(bu.doc, '#qb-body').includes('Net Earnings') && !text(bu.doc, '#qb-sources').includes('QuickBooks shows no liabilities total'));
  // ---------------- QA #3: donut with a single slice (all A/R in one band) must still draw a ring
  const dn = t.doc.createElement('div'); t.w.QB.donut(dn, { items: [{ label: '91 and over', value: 25475 }], centre: 'A$25,475' }, { currency: 'AUD', display: t.w.QB.DISPLAY_DEFAULT });
  const dp = dn.querySelector('path');
  ok('donut: single slice draws a ring', !!dp && /A80 80 0 1 1 100 180/.test(dp.getAttribute('d')), dp && dp.getAttribute('d'));
  // ---------------- QA #5: cash at end of period as a Data row, or with no groups and IFRS wording
  const hm = man('homepage'), scm = man('scf');
  for (const [nm, cf] of [['rows', F.cashflowRows], ['AU', F.cashflowAU]]) {
    const hp = await run('homepage', hm, { pl_widget: F.pnl, expenses_widget: F.pnl, bank_accounts: F.accounts, cash_flow_12m: cf, company_info: CI, prefs: PR });
    ok('homepage ' + nm + ': today\'s cash balance shown', /Today's cash balance\s*A\$/.test(text(hp.doc, '#qb-body')), text(hp.doc, '#qb-body').slice(0, 400));
    ok('homepage ' + nm + ': bank = ledger cash passes', /✓ Bank 'In QuickBooks' = ledger cash/.test(text(hp.doc, '#qb-banner')), text(hp.doc, '#qb-banner'));
    ok('homepage ' + nm + ': cash balance line drawn', hp.doc.querySelectorAll('#w4 polyline').length === 2);
    const sc = await run('scf', scm, { cash_flow: cf, cash_flow_compare: cf, company_info: CI, prefs: PR });
    ok('scf ' + nm + ': cash at end tie passes', /✓ Cash at end = Cash at beginning \+ Net cash increase/.test(text(sc.doc, '#qb-banner')), text(sc.doc, '#qb-banner'));
  }
  const hp0 = await run('homepage', hm, { pl_widget: F.pnl, expenses_widget: F.pnl, bank_accounts: F.accounts, cash_flow_12m: F.cashflow, company_info: CI, prefs: PR });
  const empty = (p) => ({ Header: F.header('ProfitAndLoss', p, { Option: [{ Name: 'NoReportData', Value: 'true' }] }), Columns: { Column: [] }, Rows: {} });
  const hpe = await run('homepage', hm, { pl_widget: empty, expenses_widget: empty, bank_accounts: F.accounts, cash_flow_12m: F.cashflow, company_info: CI, prefs: PR });
  ok('homepage: no-activity notes on P&L and expenses', text(hpe.doc, '#qb-body').includes('QuickBooks recorded no income or expenses in this period') && text(hpe.doc, '#qb-body').includes('QuickBooks recorded no expenses in this period') && hpe.errs.length === 0, [hpe.errs, text(hpe.doc, '#qb-body').slice(0, 300)]);
  // QA #7: no budget in QuickBooks → neutral notice and neutral banner, never zeros
  const bg = await run('budgets', man('budgets'), { budgets: () => ({ QueryResponse: {} }), pnl_monthly: F.pnlBudget, company_info: CI, prefs: PR });
  ok('budgets: no budget is a neutral notice', !!bg.doc.querySelector('#qb-body .qb-banner.na') && text(bg.doc, '#qb-body').includes('No Profit and Loss budget in QuickBooks') && !text(bg.doc, '#qb-body').includes('A$0'), text(bg.doc, '#qb-body').slice(0, 200));
  ok('budgets: banner says no check could run', bg.doc.querySelector('#qb-banner').className.includes('na') && /no check could run/.test(text(bg.doc, '#qb-banner')), text(bg.doc, '#qb-banner'));
  // QA #8: contra-asset accounts (accumulated depreciation, bad-debt allowance) are negative by design — not an issue
  const accX = () => { const r = F.accountsAll(); r.QueryResponse.Account.push(
    { Id: '901', Name: 'Accumulated depreciation on property, plant and equipment', AccountType: 'Fixed Asset', AccountSubType: 'AccumulatedDepreciation', Classification: 'Asset', CurrentBalance: -399.96, Active: true },
    { Id: '902', Name: 'Allowance for bad debts', AccountType: 'Other Current Asset', AccountSubType: 'AllowanceForBadDebts', Classification: 'Asset', CurrentBalance: -250, Active: true },
    { Id: '903', Name: 'Westpac - EveryBusiness', AccountType: 'Bank', AccountSubType: 'Checking', Classification: 'Asset', CurrentBalance: -1375, Active: true }); return r; };
  const co = await run('client-overview', man('client-overview'), { accounts: accX, balance_sheet: F.bs, aged_receivables: F.ar, aged_payables: F.ap, transactions_30d: F.transactionList, company_info: CI, prefs: PR });
  const coTxt = text(co.doc, '#qb-body');
  ok('client overview: contra assets not flagged, negative bank is', !/Accumulated depreciation on property/.test(coTxt) && !/Allowance for bad debts/.test(coTxt) && /Westpac - EveryBusiness/.test(coTxt) && co.errs.length === 0, coTxt.slice(coTxt.indexOf('Negative asset'), coTxt.indexOf('Negative asset') + 200));
  // GST: TaxSummary needs agency_id. Opened with no id, the report finds the ATO, refetches, and shows the BAS labels.
  const gm = man('gst'), gfx = { gst_summary: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, bs_end: F.bs, company_info: CI, prefs: PR };
  const g = await run('gst', gm, gfx);
  ok('gst: refetched with the ATO agency id', g.calls.some((x) => x.requery && x.id === 'gst_summary' && x.params.agency_id === '1'), g.calls.filter((x) => x.id === 'gst_summary'));
  ok('gst: agency announced as an input', lastInputs(g).agency_id === '1', lastInputs(g));
  ok('gst: BAS labels shown, 1A − 1B = 9 passes', text(g.doc, '#qb-body').includes('1A GST ON SALES') && /✓ 1A − 1B = 9/.test(text(g.doc, '#qb-banner')) && g.errs.length === 0, text(g.doc, '#qb-banner').slice(0, 300));
  const g2 = await run('gst', gm, Object.assign({}, gfx, { tax_agencies: () => ({ QueryResponse: {} }) }));
  ok('gst: no tax agency → clear message, no figures', text(g2.doc, '#qb-body').includes('No tax agency is set up in QuickBooks') && !text(g2.doc, '#qb-body').includes('1A GST ON SALES') && g2.errs.length === 0, text(g2.doc, '#qb-body').slice(0, 200));
  const go = await run('gst-overview', man('gst-overview'), { gst_current: F.taxSummaryByAgency, gst_previous: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, bs_end: F.bs, company_info: CI, prefs: PR });
  ok('gst overview: both periods refetched with the agency', ['gst_current', 'gst_previous'].every((id) => go.calls.some((x) => x.requery && x.id === id && x.params.agency_id === '1')) && go.errs.length === 0);
  // QA #4 re-run: AU companies may name the GST account 'BAS Liabilities Payable'
  const ga = await run('gst', gm, Object.assign({}, gfx, { bs_end: F.bsAU }));
  ok('gst AU: BAS Liabilities Payable found on the balance sheet', text(ga.doc, '#qb-banner').includes('GST Liabilities on the balance sheet at period end (information) — BAS Liabilities Payable -A$6,932.77') && ga.errs.length === 0, text(ga.doc, '#qb-banner'));
  // Banner: information lines are listed with ℹ but never counted in "x/y passed"
  ok('banner: info line not counted as a missed check', /✓ Validation: 3\/3 checks passed · 1 for information/.test(text(ga.doc, '#qb-banner')) && !/\/4/.test(text(ga.doc, '#qb-banner')) && !!ga.doc.querySelector('#qb-banner li.info') && ga.doc.querySelector('#qb-banner').className.includes('pass'), text(ga.doc, '#qb-banner').slice(0, 160));
  ok('banner: failures still turn it red and are counted', /⚠ Validation: \d+ checks? failed/.test(text(tc2.doc, '#qb-banner')) && tc2.doc.querySelector('#qb-banner').className.includes('fail'), text(tc2.doc, '#qb-banner').slice(0, 160));
  const noGst = (p) => { const s = JSON.stringify(F.bs(p)).split('GST Liabilities Payable').join('Sundry creditors'); return JSON.parse(s); };
  const gn = await run('gst', gm, Object.assign({}, gfx, { bs_end: noGst }));
  ok('banner: info line with no data still green, not a failure', gn.doc.querySelector('#qb-banner').className.includes('pass') && /3\/3 checks passed · 1 for information/.test(text(gn.doc, '#qb-banner')), text(gn.doc, '#qb-banner').slice(0, 200));
  // Nil period (agency known, no GST transactions): A$0 with the page filled in, green banner — not "unavailable"
  const nilCur = (p) => p.start_date === '2026-07-01' ? F.taxSummary(Object.assign({ __empty: true }, p)) : F.taxSummaryByAgency(p);
  const gs0 = await run('gst', gm, Object.assign({}, gfx, { gst_summary: nilCur }));
  ok('gst nil: A$0 labels, nil card, green banner', text(gs0.doc, '#qb-body').includes('Nil period') && /✓ Validation: 1\/1 check passed · 2 for information/.test(text(gs0.doc, '#qb-banner')) && !/unavailable/.test(text(gs0.doc, '#qb-body')) && gs0.doc.querySelector('#qb-banner').className.includes('pass') && gs0.errs.length === 0, text(gs0.doc, '#qb-banner').slice(0, 200));
  const gon = await run('gst-overview', man('gst-overview'), { gst_current: nilCur, gst_previous: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, bs_end: F.bsAU, company_info: CI, prefs: PR });
  const gonB = text(gon.doc, '#qb-body');
  ok('gst overview nil: tiles, history with the previous quarter, green banner', gonB.includes('Nil period — no GST transactions') && gonB.includes('April - June, 2026') && gonB.includes('History') && /✓ Validation: 1\/1 check passed · 1 for information/.test(text(gon.doc, '#qb-banner')) && !/unavailable/.test(gonB) && gon.errs.length === 0, text(gon.doc, '#qb-banner').slice(0, 200) + ' | ' + gonB.slice(0, 300));
  const gonX = await run('gst-overview', man('gst-overview'), { gst_current: F.taxSummaryByAgency, gst_previous: F.taxSummaryByAgency, tax_agencies: () => ({ QueryResponse: {} }), bs_end: F.bsAU, company_info: CI, prefs: PR });
  ok('gst overview: no tax agency → unavailable, not zero', text(gonX.doc, '#qb-body').includes('No tax agency is set up in QuickBooks') && !text(gonX.doc, '#qb-body').includes('History'), text(gonX.doc, '#qb-body').slice(0, 200));
  const mrm = man('management-reports');
  const mrn = await run('management-reports', mrm, { pnl: F.pnl, balance_sheet: F.bsAU, cash_flow: F.cashflow, aged_receivables: F.ar, aged_payables: F.ap, gst_summary: (p) => F.taxSummary(Object.assign({ __empty: true }, p)), tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, company_info: CI, prefs: PR });
  await set(mrn, 'qb-view', 'bas');
  ok('BAS pack nil: nil page, information line, not red', text(mrn.doc, '#qb-body').includes('Nil period') && text(mrn.doc, '#qb-banner').includes('GST Summary: GST activity in the period (information)') && !mrn.doc.querySelector('#qb-banner').className.includes('fail') && !/unavailable/.test(text(mrn.doc, '#qb-body')), text(mrn.doc, '#qb-banner').slice(0, 300));
  const goa = await run('gst-overview', man('gst-overview'), { gst_current: F.taxSummaryByAgency, gst_previous: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, bs_end: F.bsAU, company_info: CI, prefs: PR });
  ok('gst overview AU: liabilities tile has a figure', !/GST liabilities \(balance sheet\)\s*N\/A/.test(text(goa.doc, '#qb-body')) && goa.errs.length === 0, text(goa.doc, '#qb-body').slice(0, 400));
  const accB = () => { const r = F.accountsAll(); r.QueryResponse.Account.forEach((a) => { if (a.Name === 'GST Liabilities Payable') a.Name = 'BAS Liabilities Payable'; }); return r; };
  const coB = await run('client-overview', man('client-overview'), { accounts: accB, balance_sheet: F.bs, aged_receivables: F.ar, aged_payables: F.ap, transactions_30d: F.transactionList, company_info: CI, prefs: PR });
  ok('client overview: BAS Liabilities Payable listed as the GST account', /GST \/ BAS accounts\s*BAS Liabilities Payable/.test(text(coB.doc, '#qb-body')), text(coB.doc, '#qb-body').slice(text(coB.doc, '#qb-body').indexOf('GST / BAS'), text(coB.doc, '#qb-body').indexOf('GST / BAS') + 120));
  // QA v0.0.12 #8: the account list returns money owed as negative; the balance sheet shows it positive
  const accAU = () => { const r = F.accountsAll(); r.QueryResponse.Account = r.QueryResponse.Account.filter((a) => a.Classification !== 'Liability').concat([
    { Id: '43', Name: 'BAS Liabilities Payable', AccountType: 'Other Current Liability', AccountSubType: 'GlobalTaxPayable', Classification: 'Liability', CurrentBalance: -812.43, Active: true },
    { Id: '33', Name: 'Accounts Payable (A/P)', AccountType: 'Accounts Payable', Classification: 'Liability', CurrentBalance: -433.15, Active: true },
    { Id: '905', Name: 'Note Payable', AccountType: 'Long Term Liability', Classification: 'Liability', CurrentBalance: -45102.12, Active: true },
    { Id: '906', Name: 'Visa Credit Card', AccountType: 'Credit Card', Classification: 'Liability', CurrentBalance: -3370.60, Active: true },
    { Id: '908', Name: 'BAS Suspense', AccountType: 'Other Current Liability', AccountSubType: 'GlobalTaxSuspense', Classification: 'Liability', CurrentBalance: 740.83, Active: true },
    { Id: '907', Name: 'Customer deposits', AccountType: 'Other Current Liability', Classification: 'Liability', CurrentBalance: 150, Active: true },
    { Id: '903', Name: 'Westpac - EveryBusiness', AccountType: 'Bank', AccountSubType: 'Checking', Classification: 'Asset', CurrentBalance: -1375, Active: true }]); return r; };
  const bsSign = () => ({ Header: { ReportName: 'BalanceSheet', Option: [] }, Columns: { Column: [{ ColTitle: '' }, { ColTitle: 'Total' }] }, Rows: { Row: [
    { type: 'Data', ColData: [{ value: 'BAS Liabilities Payable', id: '43' }, { value: '812.43' }] }, { type: 'Data', ColData: [{ value: 'Accounts Payable (A/P)', id: '33' }, { value: '433.15' }] },
    { type: 'Data', ColData: [{ value: 'Note Payable', id: '905' }, { value: '45102.12' }] }] } });
  const coS = await run('client-overview', man('client-overview'), { accounts: accAU, balance_sheet: bsSign, aged_receivables: F.ar, aged_payables: F.ap, transactions_30d: F.transactionList, company_info: CI, prefs: PR });
  const coSt = text(coS.doc, '#qb-body'), negTxt = coSt.slice(coSt.indexOf('Negative asset'), coSt.indexOf('GST / BAS accounts'));
  ok('client overview: owed liabilities not flagged; debit liability and negative bank are', !/Accounts Payable|Note Payable|BAS Liabilities|BAS Suspense|Visa/.test(negTxt) && /Westpac - EveryBusiness -A\$1,375/.test(negTxt) && /Customer deposits -A\$150/.test(negTxt) && coS.errs.length === 0, negTxt);
  ok('client overview: GST account shown as on the balance sheet', /GST \/ BAS accounts\s*BAS Liabilities Payable A\$812\.43 · BAS Suspense -A\$740\.83/.test(coSt), coSt.slice(coSt.indexOf('GST / BAS accounts'), coSt.indexOf('GST / BAS accounts') + 80));
  const coF = await run('client-overview', man('client-overview'), { accounts: accAU, balance_sheet: F.bs, aged_receivables: F.ar, aged_payables: F.ap, transactions_30d: F.transactionList, company_info: CI, prefs: PR }, { fail: { balance_sheet: { code: 'tool_error', message: 'boom' } } });
  const coFt = text(coF.doc, '#qb-body'), negF = coFt.slice(coFt.indexOf('Negative asset'), coFt.indexOf('GST / BAS accounts'));
  ok('client overview: without the balance sheet, the majority sign still reads owed liabilities as normal', !/Accounts Payable|Note Payable|BAS Liabilities|Visa/.test(negF) && /Westpac/.test(negF), negF);
  // QA v0.0.12 #5: closing cash lives in the month columns; the Total column is blank
  const cfBlankTotal = (p) => { const r = F.cashflow(p); const fix = (rows) => rows.forEach((x) => { if (x.group === 'EndingCash' && x.Summary) x.Summary.ColData[x.Summary.ColData.length - 1].value = ''; if (x.Rows) fix(x.Rows.Row); }); fix(r.Rows.Row); return r; };
  const hpB = await run('homepage', man('homepage'), { pl_widget: F.pnl, expenses_widget: F.pnl, bank_accounts: F.accounts, cash_flow_12m: cfBlankTotal, company_info: CI, prefs: PR });
  ok("homepage: today's cash from the last month when Total is blank", !/Today's cash balance\s*N\/A/.test(text(hpB.doc, '#qb-body')) && !/Cash at end of period today\) — A\$[\d,.]+ vs\s*$/m.test(text(hpB.doc, '#qb-banner')), text(hpB.doc, '#qb-banner').slice(0, 400));
  const emptyPL = (p) => ({ Header: { ReportName: 'ProfitAndLoss', StartPeriod: p.start_date, EndPeriod: p.end_date, ReportBasis: 'Accrual', Currency: 'AUD', Option: [{ Name: 'NoReportData', Value: 'true' }] }, Columns: { Column: [{ ColTitle: '' }, { ColTitle: 'Total' }] }, Rows: {} }), noSpend = emptyPL;
  const hpZ = await run('homepage', man('homepage'), { pl_widget: F.pnl, expenses_widget: noSpend, bank_accounts: F.accounts, cash_flow_12m: F.cashflow, company_info: CI, prefs: PR });
  ok('homepage: no spending → information line, not N/A', /Category shares sum to the spending total \(information\) — No spending/.test(text(hpZ.doc, '#qb-banner')) || /no expenses/i.test(text(hpZ.doc, '#qb-body')), text(hpZ.doc, '#qb-banner').slice(0, 300));
  // QA v0.0.12 #2: no activity since the financial year started — P&L empty, Net Income line blank → A$0 = A$0
  const bsBlankNI = (p) => { const r = F.bsAU(p); const fix = (rows) => rows.forEach((x) => { if (x.ColData && x.ColData[0].value === 'Profit for the year') { x.ColData[0].value = 'Net Income'; x.ColData[1].value = ''; } if (x.Rows) fix(x.Rows.Row); }); fix(r.Rows.Row); return r; };
  const bn = await run('bs', man('bs'), { bs: F.bsAU, bs_compare: F.bsAU, pnl_ytd: emptyPL, company_info: CI, prefs: PR });
  ok('bs: empty P&L but a profit on the balance sheet still fails', /✗ Net Earnings = P&L financial year to date/.test(text(bn.doc, '#qb-banner')), text(bn.doc, '#qb-banner').slice(0, 500));
  const bn2 = await run('bs', man('bs'), { bs: bsBlankNI, bs_compare: bsBlankNI, pnl_ytd: emptyPL, company_info: CI, prefs: PR });
  ok('bs: blank Net Income line + empty P&L ties at A$0', /✓ Net Earnings = P&L financial year to date/.test(text(bn2.doc, '#qb-banner')), text(bn2.doc, '#qb-banner').slice(0, 500));
  // Stale reload: a slow request for an earlier period must not overwrite a faster, newer one
  const slowFirst = (p) => p.start_date === '2025-07-01' ? F.taxSummaryByAgency(p) : new Promise((r) => setTimeout(() => r(F.taxSummary(Object.assign({ __empty: true }, p))), 150));
  const sr = await run('gst-overview', man('gst-overview'), { gst_current: slowFirst, gst_previous: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, bs_end: F.bsAU, company_info: CI, prefs: PR });
  await new Promise((r) => setTimeout(r, 400));
  const pr = sr.doc.getElementById('qb-preset'); pr.value = 'this_month'; pr.dispatchEvent(new sr.w.Event('change')); pr.value = 'last_fy'; pr.dispatchEvent(new sr.w.Event('change'));
  await new Promise((r) => setTimeout(r, 500)); await sr.settle();
  ok('stale reload: the newer period wins', !text(sr.doc, '#qb-body').includes('Nil period') && /Refund \/ payable/.test(text(sr.doc, '#qb-banner')), text(sr.doc, '#qb-banner').slice(0, 200));
  // QA v0.0.13 #5: the AU cash flow report has no opening / closing cash lines — month-ends are worked back
  const CFR = require('./fixture-cf-au-real.js');
  const hpR = await run('homepage', man('homepage'), { pl_widget: F.pnl, expenses_widget: F.pnl, bank_accounts: CFR.accounts, cash_flow_12m: CFR, company_info: CI, prefs: PR });
  const hpRb = text(hpR.doc, '#qb-body'), hpRn = text(hpR.doc, '#qb-banner');
  ok("homepage AU real: today's cash = bank accounts A$44,735", /Today's cash balance\s*A\$44,735/.test(hpRb) && hpR.errs.length === 0, hpRb.slice(hpRb.indexOf('CASH FLOW'), hpRb.indexOf('CASH FLOW') + 120));
  ok('homepage AU real: worked-back line is information, banner green', /ℹ Month-end cash worked back from today's bank balances \(information\)/.test(hpRn) && hpR.doc.querySelector('#qb-banner').className.includes('pass') && !/Cash at end of period today/.test(hpRn), hpRn.slice(0, 400));
  const hpX = hpR.w.QB, hpCF = CFR(), hpL = hpX.walk(hpCF), hpIdx = hpX.cols(hpCF).slice(1).filter((x) => !/^total$/i.test(x.title)).map((x) => x.i - 1), hpE = hpX.cashEnd(hpL, hpIdx, 44735.46);
  ok('cashEnd: Oct 2025 month-end = 44,735.46 − Σ(Nov..Sep) = 76,131.67; opening 73,083.20', hpE.derived && Math.abs(hpE.values[hpIdx[0]] - 76131.67) < 0.01 && Math.abs(hpE.open - 73083.2) < 0.01 && Math.abs(hpE.values[hpIdx[11]] - 44735.46) < 0.01, JSON.stringify({ oct: hpE.values[hpIdx[0]], open: hpE.open }));
  const cfoR = await run('cash-flow-overview', man('cash-flow-overview'), { cash_accounts: CFR.accounts, cash_flow_12m: CFR, open_invoices: F.invoices, open_bills: F.bills, payments_received: F.payments, bill_payments: F.billPayments, expenses_paid: F.purchases, company_info: CI, prefs: PR });
  ok('cash flow overview AU real: chart worked back, information line, no failure', /Cash balance chart worked back from today's bank balances \(information\)/.test(text(cfoR.doc, '#qb-banner')) && !cfoR.doc.querySelector('#qb-banner').className.includes('fail') && cfoR.errs.length === 0, text(cfoR.doc, '#qb-banner').slice(0, 400));
  const scfR = await run('scf', man('scf'), { cash_flow: CFR, cash_flow_compare: CFR, bs_end: CFR.bs, bank_accounts: CFR.accounts, company_info: CI, prefs: PR });
  const scfB = text(scfR.doc, '#qb-body'), scfN = text(scfR.doc, '#qb-banner');
  ok('scf AU real: closing cash from the balance sheet banks, opening worked back', /Cash at end of period\s*A\$44,735/.test(scfB) && /Opening cash worked back from the balance sheet \(information\)/.test(scfN) && !scfR.doc.querySelector('#qb-banner').className.includes('fail') && scfR.errs.length === 0, scfN.slice(0, 500) + ' | ' + scfB.slice(0, 200));
  ok('scf AU real: Net increase = Operating + Financing passes', /✓ Net cash increase = Operating \+ Investing \+ Financing/.test(scfN), scfN.slice(0, 500));
  const mrR = await run('management-reports', man('management-reports'), { pnl: F.pnl, balance_sheet: F.bsAU, cash_flow: CFR, aged_receivables: F.ar, aged_payables: F.ap, gst_summary: F.taxSummaryByAgency, tax_agencies: F.taxAgencies, gst_probe: F.taxSummaryByAgency, company_info: CI, prefs: PR });
  await set(mrR, 'qb-view', 'expanded');
  ok('management pack AU real: cash flow line is information, not N/A', /ℹ Cash Flows: net increase in cash \(information\) — -A\$28,347\.74/.test(text(mrR.doc, '#qb-banner')) && mrR.errs.length === 0, text(mrR.doc, '#qb-banner').slice(0, 600));
  // Production connector today: agency_id is dropped, so every Tax Summary is empty — never claim a nil period
  const dropped = (p) => F.taxSummary(Object.assign({ __empty: true }, p));
  const pg = await run('gst', gm, Object.assign({}, gfx, { gst_summary: dropped, gst_probe: dropped }));
  ok('prod connector: GST Summary says unavailable, not "Nil period"', !text(pg.doc, '#qb-body').includes('Nil period') && /unavailable, not zero/.test(text(pg.doc, '#qb-body')) && /may not be passing the tax agency/.test(text(pg.doc, '#qb-body')) && !pg.doc.querySelector('#qb-banner').className.includes('pass') && pg.errs.length === 0, text(pg.doc, '#qb-body').slice(0, 300));
  const po = await run('gst-overview', man('gst-overview'), { gst_current: dropped, gst_previous: dropped, gst_probe: dropped, tax_agencies: F.taxAgencies, bs_end: F.bsAU, company_info: CI, prefs: PR });
  ok('prod connector: GST overview says unavailable, no A$0 tiles', !text(po.doc, '#qb-body').includes('Nil period') && /unavailable, not zero/.test(text(po.doc, '#qb-body')) && !text(po.doc, '#qb-body').includes('History') && po.errs.length === 0, text(po.doc, '#qb-body').slice(0, 300));
  const pm = await run('management-reports', man('management-reports'), { pnl: F.pnl, balance_sheet: F.bsAU, cash_flow: F.cashflow, aged_receivables: F.ar, aged_payables: F.ap, gst_summary: dropped, gst_probe: dropped, tax_agencies: F.taxAgencies, company_info: CI, prefs: PR });
  await set(pm, 'qb-view', 'bas');
  ok('prod connector: BAS pack says unavailable, not nil', !text(pm.doc, '#qb-body').includes('Nil period') && /unavailable, not zero/.test(text(pm.doc, '#qb-body')) && !/GST activity in the period \(information\)/.test(text(pm.doc, '#qb-banner')), text(pm.doc, '#qb-banner').slice(0, 300));
  const pf = await run('gst', gm, Object.assign({}, gfx, { gst_summary: nilCur }), { fail: { gst_probe: { code: 'tool_error', message: 'boom' } } });
  ok('probe failed: no nil claim either', !text(pf.doc, '#qb-body').includes('Nil period') && /unavailable, not zero/.test(text(pf.doc, '#qb-body')), text(pf.doc, '#qb-body').slice(0, 200));
  ok('homepage: no all-N/A bank balance column', ![...hp0.doc.querySelectorAll('#w3 th')].some((x) => x.textContent === 'Bank balance') && text(hp0.doc, '#w3').includes('Bank balance (bank feed): N/A'));
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

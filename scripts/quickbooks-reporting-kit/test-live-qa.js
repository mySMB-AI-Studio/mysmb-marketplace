// Live QA regressions (QA, 4 Oct 2026, the QuickBooks US sandbox "Craig's Design and Landscaping Services"): the report shapes
// that failed live, rebuilt as fixtures. P&L parent accounts with their own amount, General Ledger sub-accounts nested inside
// their parent, Customer Sales / Supplier Purchases against the P&L, Tax Summary refused for a US company, Report Pack period.
const { run } = require('./harness.js');
const F = require('./fixtures.js');
const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
let total = 0, fails = 0;
function ok(n, c, info) { total++; if (!c) { fails++; console.log('  FAIL', n, info === undefined ? '' : String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)); } }
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); };
const banner = (t) => text(t.doc, '#qb-banner'), red = (t) => t.doc.querySelector('#qb-banner').className.includes('fail');
const cell = (v) => ({ value: v == null ? '' : typeof v === 'number' ? v.toFixed(2) : String(v) });
const acct = (name, id) => ({ value: name, id: String(id) });
const hdr = (name, p) => ({ Time: '2026-10-04T09:00:00-07:00', ReportName: name, ReportBasis: p.accounting_method || 'Accrual', StartPeriod: p.start_date, EndPeriod: p.end_date, SummarizeColumnsBy: 'Total', Currency: 'USD', Option: [{ Name: 'NoReportData', Value: 'false' }] });
const US_CI = () => ({ QueryResponse: { CompanyInfo: [{ Id: '1', CompanyName: "Craig's Design and Landscaping Services", LegalName: "Craig's Design and Landscaping Services", Country: 'US', FiscalYearStartMonth: 'January' }] } });
const US_PR = () => ({ Preferences: { AccountingInfoPrefs: { FirstMonthOfFiscalYear: 'January' }, CurrencyPrefs: { MultiCurrencyEnabled: false, HomeCurrency: { value: 'USD' } } } });

// P&L: 'Landscaping Services' is a parent account with its own amount on its section header AND sub-accounts below it
function usPnl(p) {
  const row = (n, id, v) => ({ type: 'Data', ColData: [acct(n, id), cell(v)] });
  const sec = (n, id, own, rows, tot) => ({ type: 'Section', Header: { ColData: [acct(n, id), cell(own)] }, Rows: { Row: rows }, Summary: { ColData: [cell('Total ' + n), cell(tot)] } });
  const income = [row('Design income', 82, 2250), row('Discounts given', 86, -30.5),
    sec('Landscaping Services', 45, 1477.5, [
      sec('Job Materials', 46, '', [row('Fountains and Garden Lighting', 48, 2246.5), row('Plants and Soil', 49, 2351.97), row('Sprinklers and Drip Systems', 50, 30)], 4628.47),
      sec('Labor', 51, '', [row('Installation', 52, 250), row('Maintenance and Repair', 53, 50)], 300)], 6405.97),
    row('Pest Control Services', 54, 110), row('Sales of Product Income', 79, 912.75), row('Services', 1, 503.55)];
  return { Header: hdr('ProfitAndLoss', p), Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, { ColTitle: 'Total', ColType: 'Money' }] }, Rows: { Row: [
    { type: 'Section', group: 'Income', Header: { ColData: [cell('Income'), cell('')] }, Rows: { Row: income }, Summary: { ColData: [cell('Total Income'), cell(10151.77)] } },
    { type: 'Section', group: 'COGS', Header: { ColData: [cell('Cost of Goods Sold'), cell('')] }, Rows: { Row: [row('Cost of Goods Sold', 80, 405)] }, Summary: { ColData: [cell('Total Cost of Goods Sold'), cell(405)] } },
    { type: 'Section', group: 'GrossProfit', Summary: { ColData: [cell('Gross Profit'), cell(9746.77)] } },
    { type: 'Section', group: 'Expenses', Header: { ColData: [cell('Expenses'), cell('')] }, Rows: { Row: [row('Advertising', 7, 74.86), sec('Automobile', 55, '', [row('Fuel', 56, 349.41)], 349.41), row('Legal & Professional Fees', 12, 575.73)] }, Summary: { ColData: [cell('Total Expenses'), cell(1000)] } },
    { type: 'Section', group: 'NetOperatingIncome', Summary: { ColData: [cell('Net Operating Income'), cell(8746.77)] } },
    { type: 'Section', group: 'NetIncome', Summary: { ColData: [cell('Net Income'), cell(8746.77)] } }] } };
}

// General Ledger: a sub-account is its own section INSIDE its parent (own Beginning Balance, transactions, running balance), and
// 'Total for <parent>' includes its sub-accounts. Three levels: Job Expenses > Job Materials > Decks and Patios / Plants and Soil.
function usGl(p) {
  const tx = (d, t, n, who, amt, bal) => ({ type: 'Data', ColData: [cell(d), cell(t), cell(n), cell(who), cell(''), cell('Checking'), cell(amt), cell(bal)] });
  const beg = (b) => ({ type: 'Data', ColData: [cell('Beginning Balance'), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell(b)] });
  const sec = (n, id, rows, amt, bal) => ({ type: 'Section', Header: { ColData: [acct(n, id), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell('')] }, Rows: { Row: rows }, Summary: { ColData: [cell('Total for ' + n), cell(''), cell(''), cell(''), cell(''), cell(''), cell(amt), cell(bal)] } });
  return { Header: hdr('GeneralLedger', p), Columns: { Column: ['Date', 'Transaction Type', 'Num', 'Name', 'Memo/Description', 'Split', 'Amount', 'Balance'].map((t, i) => ({ ColTitle: t, ColType: i >= 6 ? 'Money' : 'String' })) }, Rows: { Row: [
    sec('Checking', 35, [beg(1000), tx('2026-09-10', 'Expense', '12', 'Mahoney Mugs', -19.99, 980.01)], -19.99, 980.01),
    sec('Automobile', 55, [beg(0), tx('2026-09-10', 'Expense', '13', 'Mahoney Mugs', 19.99, 19.99),
      sec('Fuel', 56, [tx('2026-09-12', 'Expense', '14', 'Chin\'s Gas and Oil', 63.15, 63.15), tx('2026-09-19', 'Expense', '15', 'Chin\'s Gas and Oil', 52.56, 115.71)], 115.71, 115.71)], 135.7, 135.7),
    sec('Job Expenses', 58, [tx('2026-09-05', 'Bill', '', 'Tania\'s Nursery', 108.09, 108.09),
      sec('Job Materials', 63, [
        sec('Decks and Patios', 64, [beg(0), tx('2026-09-08', 'Bill', '', 'Hicks Hardware', 88.09, 88.09)], 88.09, 88.09),
        sec('Plants and Soil', 66, [tx('2026-09-15', 'Bill', '', 'Tania\'s Nursery', 200, 200)], 200, 200)], 288.09, 288.09)], 396.18, 396.18)] } };
}

(async () => {
  // ---------------- 1. Profit and Loss: a parent account's own amount counts towards Total for Income
  const pm = man('pnl'), pfx = { pnl: usPnl, pnl_compare: usPnl, company_info: US_CI, prefs: US_PR };
  let t = await run('pnl', pm, pfx);
  ok('pnl US: no script errors', t.errs.length === 0, t.errs);
  ok('pnl US: Total for Income = Σ income accounts, with Landscaping Services\' own amount', banner(t).includes('✓ Total for Income = Σ income accounts') && !red(t), banner(t).slice(0, 400));
  ok('pnl US: parent account shown with its amount', text(t.doc, '#qb-body').includes('Landscaping Services'), text(t.doc, '#qb-body').slice(0, 200));

  // ---------------- 2. General Ledger: sub-accounts nested in their parent
  const gm = man('gl'), gfx = { general_ledger: usGl, journal: F.journalReport, transaction_list: F.transactionList, account_list: F.accountList, company_info: US_CI, prefs: US_PR };
  t = await run('gl', gm, gfx);
  ok('gl US: no script errors', t.errs.length === 0, t.errs);
  ok('gl US: balance check covers every account and sub-account', banner(t).includes('✓ Balance = beginning + Σ amounts (every account) — 7 accounts and sub-accounts'), banner(t).slice(0, 400));
  ok('gl US: Total for each account ties, with its sub-accounts', banner(t).includes("✓ 'Total for <account>' amount = Σ its transactions (and its sub-accounts')") && !red(t), banner(t).slice(0, 400));
  // and a real break is still caught: Fuel's running balance off by 10
  const bad = (p) => { const r = usGl(p); r.Rows.Row[1].Rows.Row[2].Rows.Row[1].ColData[7] = cell(125.71); return r; };
  t = await run('gl', gm, Object.assign({}, gfx, { general_ledger: bad }));
  ok('gl US: a broken sub-account balance fails, named parent:sub', red(t) && banner(t).includes('Mismatch: Automobile:Fuel'), banner(t).slice(0, 400));

  // ---------------- 3. Customer Sales / Supplier Purchases: the P&L comparison is information, never red
  const sfx = { customer_sales: F.customerSales, item_sales: F.itemSales, customer_income: F.customerIncome, pnl: F.pnl, customers: F.customers, products: F.items, quotes: F.estimates, company_info: () => F.companyInfo, prefs: () => F.prefs };
  t = await run('sales', man('sales'), sfx);
  ok('sales: P&L income differs → information line, banner not red', banner(t).includes('ℹ Sales by customer vs Profit and Loss Total for Income (information)') && banner(t).includes('income not raised on a sales form') && !red(t), banner(t).slice(0, 500));
  const efx = { vendor_expenses: F.vendorExpenses, pnl: F.pnl, purchases: F.purchasesMany, bills: F.bills, suppliers: F.vendors, company_info: () => F.companyInfo, prefs: () => F.prefs };
  t = await run('expenses', man('expenses'), efx);
  ok('expenses: P&L expenses differ → information line, banner not red', banner(t).includes('ℹ Expenses by supplier vs Profit and Loss expenses (information)') && banner(t).includes('expenses with no supplier') && !red(t), banner(t).slice(0, 500));

  // ---------------- 4. Tax Summary refused for a US company (400 Permission Denied, 5020): N/A, not red
  const DENIED = { code: 'tool_error', message: 'QuickBooks API error 400: Permission Denied Error (code 5020)' };
  const usAg = () => ({ QueryResponse: { TaxAgency: [{ Id: '1', DisplayName: 'California Department of Tax and Fee Administration' }] } });
  const deny = (ids) => { const f = {}; ids.forEach((id) => { f[id] = DENIED; }); return f; };
  t = await run('gst-overview', man('gst-overview'), { tax_agencies: usAg, bs_end: F.bsAU, company_info: US_CI, prefs: US_PR }, { fail: deny(['gst_current', 'gst_previous', 'gst_probe']) });
  ok('gst overview US: N/A banner, not red', text(t.doc, '#qb-body').includes('GST does not apply to this company') && !red(t) && !banner(t).includes('✗') && t.errs.length === 0, banner(t).slice(0, 400) + ' | ' + text(t.doc, '#qb-body').slice(0, 200));
  ok('gst overview US: listed under N/A with the reason', text(t.doc, '#qb-sources').includes('GST (US company: sales tax, no GST)'), text(t.doc, '#qb-sources').slice(-400));
  t = await run('gst', man('gst'), { tax_agencies: usAg, bs_end: F.bsAU, company_info: US_CI, prefs: US_PR }, { fail: deny(['gst_summary', 'gst_probe']) });
  ok('gst summary US: N/A banner, not red', text(t.doc, '#qb-body').includes('GST does not apply to this company') && !red(t) && !banner(t).includes('✗') && t.errs.length === 0, banner(t).slice(0, 400));
  const mfx = { pnl: usPnl, balance_sheet: F.bsAU, cash_flow: F.cashflow, aged_receivables: F.ar, aged_payables: F.ap, tax_agencies: usAg, company_info: US_CI, prefs: US_PR };
  t = await run('management-reports', man('management-reports'), mfx, { fail: deny(['gst_summary', 'gst_probe']) });
  ok('report pack US (basic): the GST refusal is not a red "Data loaded" line', !banner(t).includes('Data loaded: get_report_tax_summary') && !red(t), banner(t).slice(0, 400));
  await set(t, 'qb-view', 'bas');
  ok('report pack US (BAS workpapers): GST page N/A, not red', text(t.doc, '#qb-body').includes('GST does not apply to this company') && !red(t), banner(t).slice(0, 400));
  // the same refusal for a non-US company is still a failure (a real permissions problem)
  t = await run('gst', man('gst'), { tax_agencies: F.taxAgencies, bs_end: F.bsAU, company_info: () => F.companyInfo, prefs: () => F.prefs }, { fail: deny(['gst_summary', 'gst_probe']) });
  ok('gst summary AU: Permission Denied stays red', red(t) && banner(t).includes('Permission Denied'), banner(t).slice(0, 400));

  // ---------------- 5. Report Pack opens on last month (it opened on today–today with the old Custom default)
  t = await run('management-reports', man('management-reports'), mfx);
  const li = t.setInputsLog[t.setInputsLog.length - 1] || {};
  ok('report pack: opens on last month', li.start_date === '2026-08-01' && li.end_date === '2026-08-31' && text(t.doc, '#qb-body').includes('For the period ended 31 August 2026'), li);

  // ---------------- Round 2 (QA after #1055, 4 Oct 2026)
  // 6. General Ledger 'Total for' failed with no detail. Rows QuickBooks groups in a section with no header count towards the account,
  //    and a real mismatch names the account and both figures.
  const glGrouped = (p) => { const r = usGl(p), auto = r.Rows.Row[1], ownRows = auto.Rows.Row.slice(0, 2);
    auto.Rows.Row = [{ type: 'Section', Rows: { Row: ownRows }, Summary: { ColData: ['', '', '', '', '', '', 19.99, 19.99].map(cell) } }, auto.Rows.Row[2]]; return r; };
  t = await run('gl', gm, Object.assign({}, gfx, { general_ledger: glGrouped }));
  ok('gl: own rows grouped in a headerless section still tie', !red(t) && banner(t).includes("✓ 'Total for <account>' amount = Σ its transactions (and its sub-accounts') — 7 accounts and sub-accounts"), banner(t).slice(0, 500));
  const glBadTot = (p) => { const r = usGl(p); r.Rows.Row[1].Summary.ColData[6] = cell(140); return r; };
  t = await run('gl', gm, Object.assign({}, gfx, { general_ledger: glBadTot }));
  ok('gl: a wrong Total for names the account and both figures', red(t) && banner(t).includes('Mismatch: Automobile (Total US$140.00 vs Σ US$135.70)'), banner(t).slice(0, 500));

  // 7. Report Pack's P&L check was N/A for a month with no income (QuickBooks leaves out empty sections)
  const pnlNoInc = (p) => { const r = usPnl(p); r.Rows.Row = r.Rows.Row.filter((s) => !/^(Income|COGS|GrossProfit)$/.test(s.group));
    r.Rows.Row.filter((s) => /^(NetOperatingIncome|NetIncome)$/.test(s.group)).forEach((s) => { s.Summary.ColData[1] = cell(-1000); }); return r; };
  t = await run('management-reports', man('management-reports'), Object.assign({}, mfx, { pnl: pnlNoInc }), { fail: deny(['gst_summary', 'gst_probe']) });
  ok('report pack: a month with no income still checks the P&L', banner(t).includes('✓ P&L: Gross Profit = Income − Cost of Sales') && !red(t), banner(t).slice(0, 400));
  t = await run('pnl', pm, Object.assign({}, pfx, { pnl: pnlNoInc }));
  ok('pnl: a month with no income checks Gross Profit and Net Earnings', banner(t).includes('✓ Gross Profit = Income − Cost of Sales') && banner(t).includes('✓ Net Earnings') && !red(t), banner(t).slice(0, 400));

  // 8. Customer Sales: 'Σ products/services = sales total' was N/A — with no TOTAL from QuickBooks, Σ the product rows
  const isNoTot = (p) => { const r = F.itemSales(p); r.Rows.Row = r.Rows.Row.filter((x) => x.group !== 'GrandTotal'); return r; };
  t = await run('sales', man('sales'), Object.assign({}, sfx, { item_sales: isNoTot }));
  ok('sales: no TOTAL row → Σ product rows, said in the detail', banner(t).includes('✓ Σ products/services = sales total') && banner(t).includes('Σ product rows: QuickBooks returned no TOTAL'), banner(t).slice(0, 500));

  // 9. GST for a US company: Sources & limitations says N/A instead of the raw red QuickBooks error
  t = await run('gst-overview', man('gst-overview'), { tax_agencies: usAg, bs_end: F.bsAU, company_info: US_CI, prefs: US_PR }, { fail: deny(['gst_current', 'gst_previous', 'gst_probe']) });
  ok('gst overview US: sources say N/A, no raw error', text(t.doc, '#qb-sources').includes('N/A (US company: sales tax, no GST)') && !text(t.doc, '#qb-sources').includes('Permission Denied'), text(t.doc, '#qb-sources').slice(0, 400));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

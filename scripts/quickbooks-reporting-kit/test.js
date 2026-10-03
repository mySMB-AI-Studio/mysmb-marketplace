const QB = require('./qb-kit.js');
const fs = require('fs');
let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
  else console.log('ok  ', name);
}
// Realistic QBO ProfitAndLoss response (shape per Intuit Accounting API v3 reports)
const pnl = {
  Header: { Time: '2026-09-10T10:52:00-07:00', ReportName: 'ProfitAndLoss', ReportBasis: 'Accrual', StartPeriod: '2026-08-01', EndPeriod: '2026-08-31', Currency: 'AUD', Option: [{ Name: 'NoReportData', Value: 'false' }] },
  Columns: { Column: [{ ColTitle: '', ColType: 'Account', MetaData: [{ Name: 'ColKey', Value: 'account' }] }, { ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] }] },
  Rows: { Row: [
    { type: 'Section', group: 'Income', Header: { ColData: [{ value: 'Income' }, { value: '' }] }, Rows: { Row: [
      { type: 'Data', ColData: [{ value: 'SaaS - Consulting Services', id: '81' }, { value: '7000.00' }] },
      { type: 'Data', ColData: [{ value: 'SaaS - Subscription Licence', id: '82' }, { value: '57833.33' }] } ] },
      Summary: { ColData: [{ value: 'Total Income' }, { value: '64833.33' }] } },
    { type: 'Section', group: 'COGS', Header: { ColData: [{ value: 'Cost of Sales' }, { value: '' }] }, Rows: { Row: [
      { type: 'Section', Header: { ColData: [{ value: 'Infrastructure - Production', id: '90' }, { value: '' }] }, Rows: { Row: [
        { type: 'Data', ColData: [{ value: 'Hosting (Azure/AWS)', id: '91' }, { value: '-13775.01' }] } ] },
        Summary: { ColData: [{ value: 'Total Infrastructure - Production' }, { value: '-13775.01' }] } } ] },
      Summary: { ColData: [{ value: 'Total Cost of Sales' }, { value: '-13775.01' }] } },
    { type: 'Section', group: 'GrossProfit', Summary: { ColData: [{ value: 'Gross Profit' }, { value: '78608.34' }] } },
    { type: 'Section', group: 'Expenses', Header: { ColData: [{ value: 'Expenses' }, { value: '' }] }, Rows: { Row: [
      { type: 'Data', ColData: [{ value: 'G&A - Insurance', id: '60' }, { value: '5859.00' }] },
      { type: 'Data', ColData: [{ value: 'R&D - Rent', id: '61' }, { value: '255853.88' }] } ] },
      Summary: { ColData: [{ value: 'Total Expenses' }, { value: '261712.88' }] } },
    { type: 'Section', group: 'NetOperatingIncome', Summary: { ColData: [{ value: 'Net Operating Income' }, { value: '-183104.54' }] } },
    { type: 'Section', group: 'OtherIncome', Header: { ColData: [{ value: 'Other Income' }, { value: '' }] }, Rows: { Row: [
      { type: 'Data', ColData: [{ value: 'Interest income', id: '70' }, { value: '7817.79' }] } ] },
      Summary: { ColData: [{ value: 'Total Other Income' }, { value: '7817.79' }] } },
    { type: 'Section', group: 'NetOtherIncome', Summary: { ColData: [{ value: 'Net Other Income' }, { value: '7817.79' }] } },
    { type: 'Section', group: 'NetIncome', Summary: { ColData: [{ value: 'Net Income' }, { value: '-175286.75' }] } }
  ] }
};
const rows = QB.walk(pnl);
eq('walk count', rows.length, 20);
eq('income total by group', QB.val(QB.find(rows, 'Income')), 64833.33);
eq('cogs total', QB.val(QB.find(rows, 'COGS')), -13775.01);
eq('gross profit (summary-only section)', QB.val(QB.find(rows, 'GrossProfit')), 78608.34);
eq('net income', QB.val(QB.find(rows, 'NetIncome')), -175286.75);
eq('find by label fallback', QB.val(QB.find(rows, null, /^total expenses$/i)), 261712.88);
eq('nested row depth', rows.find(r => r.label === 'Hosting (Azure/AWS)').depth, 2);
eq('Σ income rows', QB.sum(rows.filter(r => r.kind === 'row' && r.path[0] === 'Income').map(r => QB.val(r))), 64833.33);
const inc = 64833.33, cogs = -13775.01, gp = 78608.34, exp = 261712.88, oi = 7817.79, oe = 0, ni = -175286.75;
eq('GP = Income − COGS', QB.near(gp, inc - cogs), true);
eq('Net = GP + OI − Exp − OE', QB.near(ni, gp + oi - exp - oe), true);
eq('totalFor', [QB.totalFor('Total Income'), QB.totalFor('Total for Income'), QB.totalFor('Gross Profit')], ['Total for Income', 'Total for Income', 'Gross Profit']);
eq('noData false', QB.noData(pnl), false);
eq('noData true', QB.noData({ Header: { Option: [{ Name: 'NoReportData', Value: 'true' }] }, Rows: {} }), true);
eq('cols', QB.cols(pnl).map(c => c.key), ['account', 'total']);
// money
const d = QB.DISPLAY_DEFAULT;
eq('money pos', QB.money(1234.56, 'AUD', d), 'A$1,234.56');
eq('money neg minus', QB.money(-175286.75, 'AUD', d), '-A$175,286.75');
eq('money paren', QB.money(-100, 'AUD', Object.assign({}, d, { neg: 'paren' })), '(A$100.00)');
eq('money trail', QB.money(-100, 'AUD', Object.assign({}, d, { neg: 'trail' })), 'A$100.00-');
eq('money nocents', QB.money(1234.56, 'AUD', Object.assign({}, d, { cents: 0 })), 'A$1,235');
eq('money k', QB.money(261712.88, 'AUD', Object.assign({}, d, { k: 1 })), 'A$261.7k');
eq('money zero neg', QB.money(-0.001, 'AUD', d), 'A$0.00');
eq('money usd', QB.money(5, 'USD', d), 'US$5.00');
// display round-trip
eq('display rt', QB.readDisplay(QB.writeDisplay(Object.assign({}, d, { neg: 'paren', style: 'mysmb' }))).style, 'mysmb');
eq('display bad json', QB.readDisplay('{nope').cents, 1);
eq('display length', QB.writeDisplay(d).length < 200, true);
// fiscal year
eq('fy from CompanyInfo', QB.fiscalStart({ QueryResponse: { CompanyInfo: [{ CompanyName: 'Enterprise AI Pty Ltd', FiscalYearStartMonth: 'July' }] } }, null), { month: 7, source: 'CompanyInfo' });
eq('fy from prefs', QB.fiscalStart(null, { Preferences: { AccountingInfoPrefs: { FirstMonthOfFiscalYear: 'January' } } }), { month: 1, source: 'Preferences' });
eq('fy fallback', QB.fiscalStart({}, {}), { month: 7, source: 'Fallback (1 July)' });
eq('company name', QB.companyInfo({ QueryResponse: { CompanyInfo: [{ CompanyName: 'Enterprise AI Pty Ltd' }] } }).name, 'Enterprise AI Pty Ltd');
eq('home currency from header', QB.homeCurrency(null, pnl), 'AUD');
// presets (today = 2026-09-25, a Friday; FY starts July)
const T = '2026-09-25';
eq('this month', QB.preset('this_month', 7, T), { start: '2026-09-01', end: '2026-09-30' });
eq('last month', QB.preset('last_month', 7, T), { start: '2026-08-01', end: '2026-08-31' });
eq('this quarter', QB.preset('this_quarter', 7, T), { start: '2026-07-01', end: '2026-09-30' });
eq('last quarter', QB.preset('last_quarter', 7, T), { start: '2026-04-01', end: '2026-06-30' });
eq('this fy', QB.preset('this_fy', 7, T), { start: '2026-07-01', end: '2027-06-30' });
eq('this fy td', QB.preset('this_fy_td', 7, T), { start: '2026-07-01', end: '2026-09-25' });
eq('last fy', QB.preset('last_fy', 7, T), { start: '2025-07-01', end: '2026-06-30' });
eq('fy jan', QB.preset('this_fy', 1, T), { start: '2026-01-01', end: '2026-12-31' });
eq('this week (Mon-Sun)', QB.preset('this_week', 7, T), { start: '2026-09-21', end: '2026-09-27' });
eq('last week', QB.preset('last_week', 7, T), { start: '2026-09-14', end: '2026-09-20' });
eq('last 30', QB.preset('last_30', 7, T), { start: '2026-08-27', end: '2026-09-25' });
eq('jan last month wraps year', QB.preset('last_month', 7, '2026-01-15'), { start: '2025-12-01', end: '2025-12-31' });
eq('q1 last quarter wraps', QB.preset('last_quarter', 7, '2026-02-10'), { start: '2025-10-01', end: '2025-12-31' });
eq('custom null', QB.preset('custom', 7, T), null);
eq('as at end last month', QB.asAt('end_last_month', 7, T), '2026-08-31');
eq('as at end last fy', QB.asAt('end_last_fy', 7, T), '2026-06-30');
eq('as at end last quarter', QB.asAt('end_last_quarter', 7, T), '2026-06-30');
// compare
eq('prev period month', QB.compare('2026-08-01', '2026-08-31', 'prev_period', 7), { start: '2026-07-01', end: '2026-07-31' });
eq('prev period quarter', QB.compare('2026-07-01', '2026-09-30', 'prev_period', 7), { start: '2026-04-01', end: '2026-06-30' });
eq('prev period days', QB.compare('2026-09-11', '2026-09-20', 'prev_period', 7), { start: '2026-09-01', end: '2026-09-10' });
eq('prev year', QB.compare('2026-08-01', '2026-08-31', 'prev_year', 7), { start: '2025-08-01', end: '2025-08-31' });
eq('prev year leap', QB.compare('2028-02-01', '2028-02-29', 'prev_year', 7), { start: '2027-02-01', end: '2027-02-28' });
eq('ytd', QB.compare('2026-08-01', '2026-08-31', 'ytd', 7), { start: '2026-07-01', end: '2026-08-31' });
// period lines
eq('period month', QB.periodLine('2026-08-01', '2026-08-31'), 'August 2026');
eq('period quarter', QB.periodLine('2026-07-01', '2026-09-30'), 'July - September, 2026');
eq('period cross-year', QB.periodLine('2025-07-01', '2026-06-30'), 'July 2025 - June 2026');
eq('period partial', QB.periodLine('2026-07-01', '2026-09-17'), '1 July 2026 - 17 September 2026');
eq('as of', QB.asOfLine('2026-08-31'), 'As of August 31, 2026');
eq('footer shape', /^Accrual basis \| \w+, \d{1,2} \w+, \d{4} \d{1,2}:\d{2} (AM|PM) GMT[+-]\d{2}:\d{2}$/.test(QB.footerStamp('Accrual', '2026-09-10T02:52:00Z')), true);
eq('freshest map', QB.freshest({ fetchedAt: { a: '2026-09-10T01:00:00Z', b: '2026-09-10T02:00:00Z' } }), '2026-09-10T02:00:00Z');
eq('freshest str', QB.freshest({ fetchedAt: '2026-09-10T01:00:00Z' }), '2026-09-10T01:00:00Z');
// reportv2 / deep link
eq('reportv2 params', QB.reportv2Params({ token: 'PANDL', start: '2026-08-01', end: '2026-08-31', basis: 'Cash', display: d }), { token: 'PANDL', low_date: '2026-08-01', high_date: '2026-08-31', cash_basis: 'yes', divideby1000: 'false', hidecents: 'false', exceptzeros: 'false', negativenums: '1', negativered: 'false', show_header_title: 'true', show_header_range: 'true', show_header_company: 'true' });
eq('deep link', QB.deepLink('BAL_SHEET', 'reportv2', 'last_month'), 'https://qbo.intuit.com/app/reportv2?token=BAL_SHEET&date_macro=Last%20Month');
// xlsx
const sheet = QB.sheetFromLines('Profit and Loss', 'Enterprise AI Pty Ltd', 'August 2026', ['', 'Total'], rows.map(r => Object.assign({}, r, { label: QB.totalFor(r.label) })), QB.footerStamp('Accrual'));
sheet.rows.push([{ v: 'Check: Σ income', s: 'bold' }, { v: 64833.33, f: 'SUM(B7:B8)', s: 'moneyBold' }]);
const bytes = QB.xlsx([sheet, { name: 'Validation', rows: [['Check', 'Result'], ['Gross Profit = Income − Cost of Sales', 'Pass'], ['Name/with:bad*chars?', 1.5]] }, { name: 'Validation', rows: [['dupe name']] }], 'AUD');
fs.mkdirSync(__dirname + "/out", { recursive: true }); fs.writeFileSync(__dirname + "/out/test.xlsx", Buffer.from(bytes));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED', '| xlsx bytes', bytes.length);
process.exit(fails ? 1 : 0);

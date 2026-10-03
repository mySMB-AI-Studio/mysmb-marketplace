// Statement of Cash Flows exactly as returned live by Sandbox Company AU 1870 (2025-10-01 to 2026-09-28, by month).
// No BeginningCash / EndingCash rows at all — only operating, financing and the net increase.
const M = ['Oct. 2025', 'Nov. 2025', 'Dec. 2025', 'Jan. 2026', 'Feb. 2026', 'Mar. 2026', 'Apr. 2026', 'May 2026', 'Jun. 2026', 'Jul. 2026', 'Aug. 2026', '1-28 Sep., 2026'];
const cd = (label, vals, id) => [Object.assign({ value: label }, id ? { id } : {})].concat(vals.map((v) => ({ value: v })));
const blank = (n) => Array(n).fill('');
module.exports = function cashflowAUreal(p) {
  return {
    Header: { ReportName: 'CashFlow', StartPeriod: (p && p.start_date) || '2025-10-01', EndPeriod: (p && p.end_date) || '2026-09-28', SummarizeColumnsBy: 'Month', Currency: 'AUD', Option: [{ Name: 'NoReportData', Value: 'false' }] },
    Columns: { Column: [{ ColTitle: '', ColType: 'Account' }].concat(M.map((t) => ({ ColTitle: t, ColType: 'Money' }))).concat([{ ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] }]) },
    Rows: { Row: [
      { Header: { ColData: cd('Cash flows from operating activities', blank(12)) }, Rows: { Row: [
        { ColData: cd('Profit for the year', ['-2419.62', '12460.73', '-17641.07', '1720.19', '1446.94', '', '2230.45', '6344.26', '', '', '', '', '4141.88']), type: 'Data', group: 'NetIncome' },
        { Header: { ColData: cd('Adjustments for non-cash income and expenses:', blank(11).concat(['0.00'])) }, Rows: { Row: [
          { ColData: cd('Accounts Receivable (A/R)', ['6040.65', '-24795.65', '-2090.00', '-8305.00', '0.00', '', '-450.00', '-6600.00', '', '', '', '', '-36200.00'], '95'), type: 'Data' },
          { ColData: cd('Inventory Asset', ['', '4250.00', '750.00', '-1406.52', '1950.00', '', '', '', '', '', '', '', '5543.48'], '87'), type: 'Data' },
          { ColData: cd('Accumulated depreciation on property, plant and equipment', ['33.33', '33.33', '33.33', '33.33', '33.33', '', '', '33.33', '', '', '', '', '199.98'], '6'), type: 'Data' },
          { ColData: cd('Accounts Payable (A/P)', ['', '220.00', '1210.00', '', '', '', '', '213.15', '', '', '', '', '1643.15'], '92'), type: 'Data' },
          { ColData: cd('Visa Credit Card', ['', '-754.20', '', '', '', '', '146.50', '146.50', '', '', '', '', '-461.20'], '86'), type: 'Data' },
          { ColData: cd('BAS Liabilities Payable', ['-229.13', '1683.90', '-1676.28', '53.70', '319.60', '', '223.05', '637.76', '', '', '', '', '1012.60'], '71'), type: 'Data' },
          { ColData: cd('BAS Suspense', ['', '', '', '', '32.93', '', '', '', '', '', '', '', '32.93'], '72'), type: 'Data' }] },
          Summary: { ColData: cd('Total Adjustments for non-cash income and expenses:', ['5844.85', '-19362.62', '-1772.95', '-9624.49', '2335.86', '0.00', '-80.45', '-5569.26', '0.00', '0.00', '0.00', '0.00', '-28229.06']) }, type: 'Section', group: 'OperatingAdjustments' }] },
        Summary: { ColData: cd('Net cash from operating activities', ['3425.23', '-6901.89', '-19414.02', '-7904.30', '3782.80', '0.00', '2150.00', '775.00', '0.00', '0.00', '0.00', '0.00', '-24087.18']) }, type: 'Section', group: 'OperatingActivities' },
      { Header: { ColData: cd('Cash flows from financing activities', blank(12)) }, Rows: { Row: [
        { ColData: cd('Note Payable', ['-376.76', '-376.76', '-376.76', '-753.52', '-376.76', '', '', '', '', '', '', '', '-2260.56'], '79'), type: 'Data' },
        { ColData: cd("Owner's Drawings", ['', '', '-1000.00', '-500.00', '-500.00', '', '', '', '', '', '', '', '-2000.00'], '96'), type: 'Data' }] },
        Summary: { ColData: cd('Net cash used in financing activities', ['-376.76', '-376.76', '-1376.76', '-1253.52', '-876.76', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '-4260.56']) }, type: 'Section', group: 'FinancingActivities' },
      { Summary: { ColData: cd('Net increase (decrease) in cash and cash equivalents', ['3048.47', '-7278.65', '-20790.78', '-9157.82', '2906.04', '0.00', '2150.00', '775.00', '0.00', '0.00', '0.00', '0.00', '-28347.74']) }, type: 'Section', group: 'CashIncrease' }] }
  };
};
// Bank and card accounts as in the sandbox (list_account); banks total A$44,735.46
module.exports.accounts = () => ({ QueryResponse: { Account: [
  { Id: '35', Name: 'Cash and cash equivalents', AccountType: 'Bank', Classification: 'Asset', CurrentBalance: 46110.46, Active: true },
  { Id: '36', Name: 'ComBank - Online Saver', AccountType: 'Bank', Classification: 'Asset', CurrentBalance: 0, Active: true },
  { Id: '86', Name: 'Visa Credit Card', AccountType: 'Credit Card', Classification: 'Liability', CurrentBalance: -3370.60, Active: true },
  { Id: '903', Name: 'Westpac - EveryBusiness', AccountType: 'Bank', Classification: 'Asset', CurrentBalance: -1375, Active: true }] } });
// Balance sheet rows for the bank accounts at a date (id-matched), plus a non-bank row that must be ignored
module.exports.bs = () => ({ Header: { ReportName: 'BalanceSheet', Option: [] }, Columns: { Column: [{ ColTitle: '' }, { ColTitle: 'Total' }] }, Rows: { Row: [
  { ColData: [{ value: 'Accounts Receivable (A/R)', id: '95' }, { value: '25475.00' }], type: 'Data' },
  { ColData: [{ value: 'Cash and cash equivalents', id: '35' }, { value: '46110.46' }], type: 'Data' },
  { ColData: [{ value: 'Westpac - EveryBusiness', id: '903' }, { value: '-1375.00' }], type: 'Data' }] } });

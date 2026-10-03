// MYOB-shaped test data modelled on the live mySMB.com file (28 Sep 2026):
// P&L FY26-27 to date: Income 4,317.25, Expenses 2,134.49, Net Profit 2,182.76 (Professional Fees 0.00 shown by MYOB).
// Balance Sheet: Assets 3,896.01 (receivables 4,328.96, overdrawn bank −432.95), Liabilities 1,713.25, Equity 2,182.76
// (= Current Year Earnings). Field names per MYOB API v2 docs / SDK; values positive in each account's normal balance
// (confirmed live). The split of liabilities and expenses across accounts is illustrative.
const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const A = (n, id, name, cls, type, bal, extra) => Object.assign({ UID: U(n), DisplayID: id, Name: name, Classification: cls, Type: type, IsHeader: false, IsActive: true, Level: 3, CurrentBalance: bal, OpeningBalance: 0 }, extra || {});
const H = (n, id, name, cls) => A(n, id, name, cls, cls, 0, { IsHeader: true, Level: 1 });
const CHART = [
  H(1, '1-0000', 'Assets', 'Asset'),
  A(2, '1-1110', 'Business Bank Account #1', 'Asset', 'Bank', -432.95),
  A(3, '1-1160', 'Petty Cash', 'Asset', 'Bank', 0),
  A(4, '1-1170', 'Undeposited Funds Account', 'Asset', 'Bank', 0),
  A(5, '1-1200', 'Trade Debtors', 'Asset', 'AccountReceivable', 4328.96),
  A(6, '1-1210', 'Other Receivables', 'Asset', 'OtherCurrentAsset', 0),
  H(10, '2-0000', 'Liabilities', 'Liability'),
  A(11, '2-1200', 'Trade Creditors', 'Liability', 'AccountsPayable', 1320.77),
  A(12, '2-1310', 'GST Collected', 'Liability', 'OtherCurrentLiability', 392.48),
  H(20, '3-0000', 'Equity', 'Equity'),
  A(21, '3-8000', 'Retained Earnings', 'Equity', 'Equity', 0),
  A(22, '3-9000', 'Current Year Earnings', 'Equity', 'Equity', 2182.76),
  A(23, '3-9999', 'Historical Balancing', 'Equity', 'Equity', 0),
  H(30, '4-0000', 'Income', 'Income'),
  A(31, '4-1300', 'Professional Fees', 'Income', 'Income', 0),
  A(32, '4-1400', 'Sales', 'Income', 'Income', 4317.25),
  H(40, '6-0000', 'Expenses', 'Expense'),
  A(41, '6-1430', 'Electricity & Gas', 'Expense', 'Expense', 1100.00),
  A(42, '6-3020', 'Office Supplies', 'Expense', 'Expense', 534.49),
  A(43, '6-4460', 'Telephone & Internet', 'Expense', 'Expense', 500.00),
  A(50, '9-1000', 'Interest Expense', 'OtherExpense', 'OtherExpense', 0),
  A(51, '9-2000', 'Income Tax Expense', 'OtherExpense', 'OtherExpense', 0),
];
const byId = (id) => CHART.find((a) => a.DisplayID === id);
const row = (id, total) => { const a = byId(id); return { AccountTotal: total, Account: { UID: a.UID, Name: a.Name, DisplayID: a.DisplayID, URI: 'https://arl2.api.myob.com/accountright/cf/GeneralLedger/Account/' + a.UID } }; };
const ISO = (d, end) => d + (end ? 'T23:59:59' : 'T00:00:00');

// FY26-27 activity (1 Jul 2026 onwards) and nothing before (golden: last year 0.00).
function accounts() { return { Items: JSON.parse(JSON.stringify(CHART)), NextPageLink: null, Count: CHART.length }; }
function pnl(p) {
  const cur = p.to_date >= '2026-07-01' && p.from_date <= '2026-09-28';
  const rows = cur ? [row('4-1300', 0), row('4-1400', 4317.25), row('6-1430', 1100.00), row('6-3020', 534.49), row('6-4460', 500.00), row('9-1000', 0), row('9-2000', 0)] : [];
  return { StartDate: ISO(p.from_date), EndDate: ISO(p.to_date, true), ReportingBasis: p.reporting_basis || 'Accrual', YearEndAdjust: false, AccountsBreakdown: rows, URI: 'x' };
}
function bs(p) {
  const after = (p.date || '') >= '2026-07-01';
  const rows = after ? [row('1-0000', 3896.01), row('1-1110', -432.95), row('1-1160', 0), row('1-1170', 0), row('1-1200', 4328.96), row('2-1200', 1320.77), row('2-1310', 392.48), row('3-8000', 0), row('3-9000', 2182.76), row('3-9999', 0)] : [row('3-8000', 0)];
  return { AsOfDate: ISO(p.date), YearEndAdjust: false, AccountsBreakdown: rows, URI: 'x' };
}
function companyFiles() { return [{ Id: 'cf-mysmb', Name: 'mySMB.com', Country: 'AU', Uri: 'https://arl2.api.myob.com/accountright/cf-mysmb', ProductVersion: '2026.9' }]; }
function companyFilesMulti() { return companyFiles().concat([{ Id: 'cf-demo', Name: 'Demo Pty Ltd', Country: 'AU', Uri: 'x' }]); }
const err = (msg) => () => ({ __error: msg });
module.exports = { U, CHART, accounts, pnl, bs, companyFiles, companyFilesMulti, err, byId };

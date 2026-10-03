// Xero-shaped test data (Accounting API /Reports and /Organisation, as the xero-accounting connector passes them through).
// Two organisations on one connection: Northwind Trading Pty Ltd (AU, year ends 30 June, AUD — the default tenant) and
// Southgate Services Ltd (NZ, year ends 31 March, NZD). Base figures = Northwind 1 Jul – 25 Sep 2026 (accrual):
// Income 60,650.00 · Cost of Sales 19,450.50 · Gross Profit 41,199.50 · Other Income 212.35 · Operating Expenses 30,324.35 ·
// Net Profit 11,087.50. Balance Sheet 25 Sep 2026: Total Bank 39,380.40 · Total Assets 66,046.00 · Total Liabilities 24,845.50 ·
// Net Assets = Total Equity 41,200.50 (Current Year Earnings 11,087.50 = the FY-to-date P&L). Other ranges are the base
// scaled by length (earlier years × 0.85), rounded per account, with Xero's totals re-added — so every statement ties.
const T1 = 'a1b2c3d4-0000-4000-8000-000000000001', T2 = 'a1b2c3d4-0000-4000-8000-000000000002';
const ORGS = {
  [T1]: { Name: 'Northwind Trading Pty Ltd', LegalName: 'Northwind Trading Pty Ltd', BaseCurrency: 'AUD', CountryCode: 'AU', FinancialYearEndDay: 30, FinancialYearEndMonth: 6, ShortCode: '!nWt01', OrganisationID: 'org-1', scale: 1 },
  [T2]: { Name: 'Southgate Services Ltd', LegalName: 'Southgate Services Limited', BaseCurrency: 'NZD', CountryCode: 'NZ', FinancialYearEndDay: 31, FinancialYearEndMonth: 3, ShortCode: '!sGs02', OrganisationID: 'org-2', scale: 0.5 },
};
const tenantOf = (p) => (p && p.xero_tenant_id) || T1;
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MS = MON.map((m) => m.slice(0, 3));
const long = (d) => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + MON[m - 1] + ' ' + y; };
const short = (d) => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + MS[m - 1] + ' ' + y; };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
const r2 = (n) => Math.round(n * 100) / 100;
const s2 = (n) => r2(n).toFixed(2);
const fyStart = (date, endMonth) => { const [y, m] = date.split('-').map(Number), sm = endMonth % 12 + 1; return (m >= sm ? y : y - 1) + '-' + String(sm).padStart(2, '0') + '-01'; };
const AID = (n) => '5a0c' + String(n).padStart(4, '0') + '-0000-4000-8000-00000000' + String(n).padStart(4, '0');
// P&L accounts per section (accrual; cash where different)
const PL = [
  { title: 'Income', total: 'Total Income', rows: [[1, 'Sales', 48250.00, 44100.00], [2, 'Consulting Fees', 12400.00]] },
  { title: 'Less Cost of Sales', total: 'Total Cost of Sales', rows: [[3, 'Purchases', 18300.00, 17000.00], [4, 'Freight & Courier', 1150.50]] },
  { calc: 'Gross Profit' },
  { title: 'Other Income', total: 'Total Other Income', rows: [[5, 'Interest Income', 212.35]] },
  { title: 'Less Operating Expenses', total: 'Total Operating Expenses', rows: [[6, 'Advertising', 2100.00], [7, 'Bank Fees', 84.20], [8, 'Rent', 9000.00], [9, 'Wages and Salaries', 18500.00], [10, 'Subscriptions', 640.15], [11, 'Office Expenses', 0]] },
  { calc: 'Net Profit' },
];
const BASE_DAYS = days('2026-07-01', '2026-09-25');
function plFactor(p, org) {
  const from = p.fromDate, to = p.toDate; if (!from || !to || to < from) return 0;
  const fy = fyStart(to, org.FinancialYearEndMonth), cur = fyStart('2026-09-25', org.FinancialYearEndMonth);
  return (days(from, to) / BASE_DAYS) * (fy < cur ? 0.85 : 1) * org.scale;
}
function row(id, label, v) { const a = [{ Value: AID(id), Id: 'account' }]; return { RowType: 'Row', Cells: [{ Value: label, Attributes: a }, { Value: s2(v), Attributes: a }] }; }
function sumRow(label, v) { return { RowType: 'SummaryRow', Cells: [{ Value: label }, { Value: s2(v) }] }; }
function calcSec(label, v) { return { RowType: 'Section', Title: '', Rows: [{ RowType: 'Row', Cells: [{ Value: label }, { Value: s2(v) }] }] }; }
function plNumbers(p) {
  const org = ORGS[tenantOf(p)], f = plFactor(p, org), cash = p.paymentsOnly === true, secs = [];
  let run = 0;
  PL.forEach((s) => {
    if (s.calc) { secs.push({ calc: s.calc, value: r2(run) }); return; }
    const rows = s.rows.map(([id, name, acc, csh]) => [id, name, r2((cash && csh != null ? csh : acc) * f)]);
    const tot = r2(rows.reduce((a, r) => a + r[2], 0));
    run += (/^Less /.test(s.title) ? -1 : 1) * tot;
    secs.push({ title: s.title, total: s.total, rows, value: tot });
  });
  return { org, secs, np: r2(run) };
}
function pnl(p) {
  const { org, secs } = plNumbers(p);
  const Rows = [{ RowType: 'Header', Cells: [{ Value: '' }, { Value: short(p.toDate) }] }];
  secs.forEach((s) => { if (s.calc) Rows.push(calcSec(s.calc, s.value)); else Rows.push({ RowType: 'Section', Title: s.title, Rows: s.rows.map((r) => row(r[0], r[1], r[2])).concat([sumRow(s.total, s.value)]) }); });
  return { Reports: [{ ReportID: 'ProfitAndLoss', ReportName: 'Profit and Loss', ReportType: 'ProfitAndLoss', ReportTitles: ['Profit and Loss', org.Name, long(p.fromDate) + ' to ' + long(p.toDate)], ReportDate: short('2026-09-25'), UpdatedDateUTC: '/Date(1790296320000)/', Fields: [], Rows }] };
}
// Balance sheet at a date: accounts scaled (earlier years × 0.85), Current Year Earnings = the P&L from the FY start to the date
// on the same basis, Retained Earnings = the plug (Xero closes prior years into it automatically).
const BS = [
  { parent: 'Assets' },
  { title: 'Bank', total: 'Total Bank', rows: [[20, 'Business Cheque Account', 24380.40], [21, 'Business Savings Account', 15000.00]] },
  { title: 'Current Assets', total: 'Total Current Assets', rows: [[22, 'Accounts Receivable', 18745.60, 0], [23, 'Prepayments', 1200.00]] },
  { title: 'Fixed Assets', total: 'Total Fixed Assets', rows: [[24, 'Office Equipment', 8400.00], [25, 'Less Accumulated Depreciation on Office Equipment', -1680.00]] },
  { close: 'Total Assets' },
  { parent: 'Liabilities' },
  { title: 'Current Liabilities', total: 'Total Current Liabilities', rows: [[30, 'Accounts Payable', 9120.30, 0], [31, 'GST', 3415.20], [32, 'PAYG Withholdings Payable', 2310.00], [33, 'Wages Payable - Payroll', 0]] },
  { title: 'Non-Current Liabilities', total: 'Total Non-Current Liabilities', rows: [[34, 'Loan - Westpac', 10000.00]] },
  { close: 'Total Liabilities' },
  { net: 'Net Assets' },
  { title: 'Equity', total: 'Total Equity', rows: 'equity' },
];
function bsNumbers(p, date) {
  const org = ORGS[tenantOf(p)], cash = p.paymentsOnly === true;
  const f = (fyStart(date, org.FinancialYearEndMonth) < fyStart('2026-09-25', org.FinancialYearEndMonth) ? 0.85 : 1) * org.scale;
  const cye = plNumbers({ fromDate: fyStart(date, org.FinancialYearEndMonth), toDate: date, paymentsOnly: p.paymentsOnly, xero_tenant_id: p.xero_tenant_id }).np;
  const out = []; let A = 0, L = 0, parentSum = 0;
  BS.forEach((s) => {
    if (s.parent) { out.push({ parent: s.parent }); parentSum = 0; return; }
    if (s.close) { out.push({ close: s.close, value: r2(parentSum) }); if (s.close === 'Total Assets') A = r2(parentSum); else L = r2(parentSum); return; }
    if (s.net) { out.push({ net: s.net, value: r2(A - L) }); return; }
    if (s.rows === 'equity') { const re = r2(A - L - cye); out.push({ title: 'Equity', total: 'Total Equity', rows: [[40, 'Current Year Earnings', cye], [41, 'Retained Earnings', re]], value: r2(cye + re) }); return; }
    const rows = s.rows.map(([id, name, acc, csh]) => [id, name, r2((cash && csh != null ? csh : acc) * f)]);
    const tot = r2(rows.reduce((a, r) => a + r[2], 0)); parentSum += tot;
    out.push({ title: s.title, total: s.total, rows, value: tot });
  });
  return { org, out };
}
function bs(p) {
  // Xero answers any date with the END of that month (live QA, 4 Oct 2026)
  const d0 = (([y, m]) => { const e = new Date(Date.UTC(+y, +m, 0)); return e.toISOString().slice(0, 10); })(p.date.split('-')), y = Number(d0.slice(0, 4)) - 1, d1 = y + d0.slice(4) === String(y) + '-02-29' ? y + '-02-28' : y + d0.slice(4);
  const a = bsNumbers(p, d0), b = bsNumbers(p, d1), two = (x, y2) => [x, y2];
  const cells = (label, v0, v1, attr) => [{ Value: label, Attributes: attr }, { Value: s2(v0), Attributes: attr }, { Value: s2(v1), Attributes: attr }];
  const Rows = [{ RowType: 'Header', Cells: [{ Value: '' }, { Value: short(d0) }, { Value: short(d1) }] }];
  a.out.forEach((s, i) => {
    const t = b.out[i];
    if (s.parent) Rows.push({ RowType: 'Section', Title: s.parent, Rows: [] });
    else if (s.close || s.net) Rows.push({ RowType: 'Section', Title: '', Rows: [{ RowType: 'Row', Cells: cells(s.close || s.net, s.value, t.value) }] });
    else Rows.push({ RowType: 'Section', Title: s.title, Rows: s.rows.map((r, j) => { const at = [{ Value: AID(r[0]), Id: 'account' }]; return { RowType: 'Row', Cells: cells(r[1], r[2], t.rows[j][2], at) }; }).concat([{ RowType: 'SummaryRow', Cells: cells(s.total, s.value, t.value) }]) });
    void two;
  });
  return { Reports: [{ ReportID: 'BalanceSheet', ReportName: 'Balance Sheet', ReportType: 'BalanceSheet', ReportTitles: ['Balance Sheet', a.org.Name, 'As at ' + long(d0)], ReportDate: short('2026-09-25'), UpdatedDateUTC: '/Date(1790296320000)/', Fields: [], Rows }] };
}
function organisation(p) { const o = Object.assign({}, ORGS[tenantOf(p)]); delete o.scale; return { Id: 'x', Status: 'OK', ProviderName: 'mySMB', Organisations: [o] }; }
function connections() { return { activeTenantId: T1, tenants: [{ tenantId: T1, tenantName: ORGS[T1].Name, tenantType: 'ORGANISATION' }, { tenantId: T2, tenantName: ORGS[T2].Name, tenantType: 'ORGANISATION' }] }; }
function connectionsOne() { return { activeTenantId: T1, tenants: [{ tenantId: T1, tenantName: ORGS[T1].Name, tenantType: 'ORGANISATION' }] }; }
// A Xero error reaches the report as a binding error: the connector throws, the host reports { code: 'tool_error', message }.
const fail = (msg) => () => { throw new Error(msg); };
// Trial Balance at an exact date (Xero layout: Debit | Credit | YTD Debit | YTD Credit; Debit / Credit are the month's movement):
// the income and expense accounts of the P&L for the financial year to that date, so revenue − expenses = that P&L's Net Profit.
function trialBalance(p) {
  const t = tenantOf(p), d = p.date, rep = pnl({ fromDate: fyStart(d, ORGS[t].FinancialYearEndMonth), toDate: d, xero_tenant_id: t }).Reports[0];
  const row = (c, credit) => { const v = +c[1].Value, x = credit ? ['', '', '', s2(v)] : ['', '', s2(v), '']; return { RowType: 'Row', Cells: [{ Value: c[0].Value, Attributes: c[0].Attributes }].concat(x.map((Value) => ({ Value }))) }; };
  const pick = (re, credit) => rep.Rows.filter((s) => s.RowType === 'Section' && re.test(s.Title || '')).reduce((a, s) => a.concat(s.Rows.filter((r) => r.RowType === 'Row').map((r) => row(r.Cells, credit))), []);
  const rev = pick(/income/i, true), exp = pick(/cost of sales|expenses/i, false), sum = (rows, i) => s2(rows.reduce((t2, r) => t2 + (+r.Cells[i].Value || 0), 0));
  return { Reports: [{ ReportID: 'TrialBalance', ReportName: 'Trial Balance', ReportType: 'TrialBalance', ReportTitles: ['Trial Balance', ORGS[t].Name, 'As at ' + long(d)], ReportDate: short(d),
    Rows: [{ RowType: 'Header', Cells: ['Account', 'Debit', 'Credit', 'YTD Debit', 'YTD Credit'].map((Value) => ({ Value })) }, { RowType: 'Section', Title: 'Revenue', Rows: rev }, { RowType: 'Section', Title: 'Expenses', Rows: exp },
      { RowType: 'Section', Title: '', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total' }, { Value: '0.00' }, { Value: '0.00' }, { Value: sum(rev.concat(exp), 3) }, { Value: sum(rev.concat(exp), 4) }] }] }] }] };
}
module.exports = { T1, T2, ORGS, pnl, bs, trialBalance, organisation, connections, connectionsOne, fail, plNumbers, bsNumbers, fyStart };

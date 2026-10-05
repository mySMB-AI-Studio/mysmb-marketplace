// Employment Hero Payroll fixtures (Q32–Q34), shaped like the employment-hero-payroll connector's answers
// (myhub-mcp-servers src/integrations/employment-hero-payroll/api/methods.ts; row fields from Employment Hero's AU OpenAPI spec).
// One ledger of fortnightly pay runs (paid 2 Jul 2025 … 23 Sep 2026) drives every report, so the reports tie to each other.
// Business 7001 is the main company; 7002 is a second business on the same API key with one employee and no pay runs.
const r2 = (n) => Math.round(n * 100) / 100;
const sum = (a, k) => r2(a.reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0));
const iso = (d) => d.toISOString().slice(0, 10), day = (s, n) => iso(new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const BUSINESSES = [
  { id: 7001, name: 'Enterprise AI Pty Ltd', legalName: 'Enterprise AI Pty Ltd', abn: '12345678901', state: 'NSW', region: null, numberOfEmployees: 'OneToTen', payCycleFrequency: 'Fortnightly', initialFinancialYearStart: 2024 },
  { id: 7002, name: 'Enterprise AI Trust', legalName: 'The Enterprise AI Trust', abn: '98765432109', state: 'NSW', region: null, numberOfEmployees: 'OneToTen', payCycleFrequency: 'Monthly', initialFinancialYearStart: 2025 }
];
// rate = hourly; fund = super fund (USI); salary sacrifice, phone allowance and union fees on Melanie; HELP on Daniel.
// Priya is active but has never been paid (Unpaid Employees); Tom left on 31 March 2026 (payment summary FY2026 only).
const EMP = [
  { id: 501, first: 'Melanie', last: 'Burrows', start: '2024-02-05', end: null, type: 'Full Time', title: 'Operations Manager', rate: 45, fund: ['AustralianSuper', 'STA0100AU'], open: { al: 80, pl: 40, lsl: 20 } },
  { id: 502, first: 'Daniel', last: 'Kim', start: '2025-03-10', end: null, type: 'Part Time', title: 'Developer', rate: 38, fund: ['Hostplus', 'HOS0100AU'], help: true, open: { al: 20, pl: 10 } },
  { id: 503, first: 'Priya', last: 'Shah', start: '2026-08-17', end: null, type: 'Full Time', title: 'Analyst', rate: 42, fund: ['UniSuper', 'UNI0100AU'], unpaid: true, open: { al: 0, pl: 0 } },
  { id: 504, first: 'Tom', last: 'Reyes', start: '2023-05-01', end: '2026-03-31', type: 'Full Time', title: 'Support', rate: 40, fund: ['REST', 'RES0103AU'], open: { al: 60, pl: 30 } }
];
const OTE = { 'Ordinary Hours': true, 'Annual Leave': true };
const HOURLY = { 'Ordinary Hours': true, 'Annual Leave': true, 'Overtime 1.5x': true };

// Pay runs: fortnightly, paid every second Wednesday back from 23 Sep 2026.
const RUNS = [];
for (let d = '2026-09-23'; d >= '2025-07-01'; d = day(d, -14)) RUNS.unshift(d);
const PAY_RUNS = RUNS.map((paid, i) => {
  const end = day(paid, -3), start = day(end, -13);
  return { id: 9000 + i, dateFinalised: paid + 'T09:00:00', payScheduleId: 1, payPeriodStarting: start + 'T00:00:00', payPeriodEnding: end + 'T00:00:00', datePaid: paid + 'T00:00:00', isFinalised: true, paySlipsPublished: true, notation: i === RUNS.length - 1 ? 'Includes Daniel overtime' : '', externalId: '' };
});

// Every paid employee's lines in every pay run.
const SLIPS = [];
PAY_RUNS.forEach((run, i) => {
  const paid = run.datePaid.slice(0, 10), pStart = run.payPeriodStarting.slice(0, 10), pEnd = run.payPeriodEnding.slice(0, 10);
  EMP.forEach((e) => {
    if (e.unpaid || e.start > pEnd || (e.end && e.end < pStart)) return;
    const earn = [], pre = [], post = [];
    if (e.id === 501) { earn.push(['Ordinary Hours', 76, 45]); earn.push(['Phone Allowance', 1, 50]); pre.push(['Salary Sacrifice Super', 200]); post.push(['Union Fees', 20]); }
    if (e.id === 502) { if (i % 5 === 0) { earn.push(['Ordinary Hours', 44, 38]); earn.push(['Annual Leave', 16, 38]); } else earn.push(['Ordinary Hours', 60, 38]); if (i % 3) earn.push(['Overtime 1.5x', 2 * (i % 3), 57]); }
    if (e.id === 504) earn.push(['Ordinary Hours', 76, 40]);
    const lines = earn.map((l) => ({ cat: l[0], units: l[1], rate: l[2], amount: r2(l[1] * l[2]), superAmount: OTE[l[0]] ? r2(l[1] * l[2] * 0.12) : 0 }));
    const gross = sum(lines, 'amount'), preTax = r2(pre.reduce((s, x) => s + x[1], 0)), postTax = r2(post.reduce((s, x) => s + x[1], 0));
    const taxable = r2(gross - preTax), payg = Math.round(taxable * 0.2), help = e.help ? Math.round(gross * 0.02) : 0;
    SLIPS.push({ run, paid, e, lines, pre, post, gross, preTax, taxable, payg, help, sfss: 0, postTax, net: r2(gross - preTax - payg - help - postTax),
      sgc: sum(lines, 'superAmount'), ss: preTax, hours: lines.filter((l) => HOURLY[l.cat]).reduce((s, l) => s + l.units, 0), allow: sum(lines.filter((l) => /Allowance/.test(l.cat)), 'amount') });
  });
});

const main = (p) => !p.business_id || String(p.business_id) === '7001';
const bid = (p) => String(p.business_id || '7001');
const inRange = (p) => (s) => s.paid >= p.from_date && s.paid <= p.to_date;
const add = (o, k, v) => { o[k] = r2((o[k] || 0) + v); };

const listBusinesses = () => BUSINESSES.map((b) => Object.assign({}, b));
const listPayRuns = (p) => {
  const runs = main(p) ? PAY_RUNS.filter((r) => (!p.from_date || r.datePaid.slice(0, 10) >= p.from_date) && (!p.to_date || r.datePaid.slice(0, 10) <= p.to_date)) : [];
  return { businessId: bid(p), count: runs.length, payRuns: runs.map((r) => Object.assign({}, r)) };
};
const grossToNet = (p) => {
  const by = {};
  (main(p) ? SLIPS.filter(inRange(p)) : []).forEach((s) => {
    const r = by[s.e.id] = by[s.e.id] || { payg: 0, sfss: 0, help: 0, netEarnings: 0, sgc: 0, employerContribution: 0, nonRescEmployerContribution: 0, totalGrossPlusSuper: 0, employeeId: s.e.id, firstName: s.e.first, surname: s.e.last,
      primaryLocationId: 1, primaryLocation: 'Sydney', externalId: '', totalHours: 0, grossEarnings: {}, totalGrossEarnings: 0, totalTaxExemptEarnings: 0, preTaxDeductions: {}, totalPreTaxDeductions: 0, taxableEarnings: 0,
      postTaxDeductions: {}, totalPostTaxDeductions: 0, expenses: {}, totalExpenses: 0 };
    s.lines.forEach((l) => add(r.grossEarnings, l.cat, l.amount)); s.pre.forEach((x) => add(r.preTaxDeductions, x[0], x[1])); s.post.forEach((x) => add(r.postTaxDeductions, x[0], x[1]));
    add(r, 'totalGrossEarnings', s.gross); add(r, 'totalPreTaxDeductions', s.preTax); add(r, 'taxableEarnings', s.taxable); add(r, 'payg', s.payg); add(r, 'help', s.help);
    add(r, 'totalPostTaxDeductions', s.postTax); add(r, 'netEarnings', s.net); add(r, 'sgc', s.sgc); add(r, 'employerContribution', s.ss); add(r, 'totalHours', s.hours); add(r, 'totalGrossPlusSuper', s.gross + s.sgc + s.ss);
  });
  const rows = Object.keys(by).map((k) => by[k]);
  return { businessId: bid(p), from: p.from_date, to: p.to_date, payRunId: null, employees: rows.length,
    totals: { grossEarnings: sum(rows, 'totalGrossEarnings'), taxExemptEarnings: 0, preTaxDeductions: sum(rows, 'totalPreTaxDeductions'), taxableEarnings: sum(rows, 'taxableEarnings'), payg: sum(rows, 'payg'), help: sum(rows, 'help'),
      sfss: 0, postTaxDeductions: sum(rows, 'totalPostTaxDeductions'), netEarnings: sum(rows, 'netEarnings'), sgc: sum(rows, 'sgc'), employerContribution: sum(rows, 'employerContribution'), expenses: 0, totalHours: sum(rows, 'totalHours') },
    rows };
};
// PAYG withholding by month and location; the payg column is the whole amount withheld (PAYG + HELP), as BAS W2.
const payg = (p) => {
  const by = {};
  (main(p) ? SLIPS.filter(inRange(p)) : []).forEach((s) => {
    const m = MONTHS[+s.paid.slice(5, 7) - 1] + ' ' + s.paid.slice(0, 4), r = by[s.paid.slice(0, 7)] = by[s.paid.slice(0, 7)] || { location: 'Sydney', month: m, grossEarnings: 0, taxExemptEarnings: 0, preTaxDeductions: 0, taxableEarnings: 0, payg: 0 };
    add(r, 'grossEarnings', s.gross); add(r, 'preTaxDeductions', s.preTax); add(r, 'taxableEarnings', s.taxable); add(r, 'payg', s.payg + s.help);
  });
  const rows = Object.keys(by).sort().map((k) => by[k]);
  return { businessId: bid(p), from: p.from_date, to: p.to_date, W1_grossWages: sum(rows, 'grossEarnings'), W2_paygWithheld: sum(rows, 'payg'), taxableEarnings: sum(rows, 'taxableEarnings'), rows };
};
const payRunLabel = (paid) => 'Fortnightly ' + paid.slice(8, 10) + '/' + paid.slice(5, 7) + '/' + paid.slice(0, 4);
const payCategories = (p) => {
  const rows = [];
  (main(p) ? SLIPS.filter(inRange(p)) : []).forEach((s) => s.lines.forEach((l) => rows.push({ superAmount: l.superAmount, payCategory: l.cat, payRun: payRunLabel(s.paid), datePaid: s.paid + 'T00:00:00',
    employeeId: s.e.id, firstName: s.e.first, surname: s.e.last, externalId: '', location: 'Sydney', units: l.units, rate: l.rate, amount: l.amount })));
  return { businessId: bid(p), from: p.from_date, to: p.to_date, total: sum(rows, 'amount'), superTotal: sum(rows, 'superAmount'), rows };
};
const superContributions = (p) => {
  const fund = p.group_by === 'fund', rows = [], agg = {};
  (main(p) ? SLIPS.filter(inRange(p)) : []).forEach((s) => {
    const parts = [['SuperGuarantee', s.sgc]].concat(s.ss ? [['SalarySacrifice', s.ss]] : []);
    parts.forEach((x) => {
      if (!fund) rows.push({ locationId: 1, locationName: 'Sydney', employeeId: s.e.id, firstName: s.e.first, surname: s.e.last, externalId: '', accrualDate: s.paid + 'T00:00:00', accrualType: x[0], accrualAmount: x[1], batchId: s.run.id, status: s.paid < '2026-09-20' ? 'SubmissionPaid' : 'New' });
      else { const k = s.e.id + '|' + x[0], r = agg[k] = agg[k] || { locationName: 'Sydney', employeeId: s.e.id, firstName: s.e.first, surname: s.e.last, externalId: '', superFundName: s.e.fund[0], superFundNumber: s.e.fund[1], paymentType: x[0], amount: 0 }; add(r, 'amount', x[1]); }
    });
  });
  const out = fund ? Object.keys(agg).map((k) => agg[k]) : rows;
  return { businessId: bid(p), from: p.from_date, to: p.to_date, groupBy: fund ? 'fund' : 'employee', total: sum(out, fund ? 'amount' : 'accrualAmount'), rows: out };
};
const leaveBalances = (p) => {
  const asAt = p.as_at || '2026-09-25', rows = [];
  if (main(p)) EMP.forEach((e) => {
    if (e.start > asAt || (e.end && e.end < asAt)) return;
    const mine = SLIPS.filter((s) => s.e === e && s.paid >= '2025-07-01' && s.paid <= asAt);
    const ord = (s) => s.lines.filter((l) => l.cat === 'Ordinary Hours').reduce((a, l) => a + l.units, 0);
    const cats = [['Annual Leave', 'al', 1 / 13], ["Personal/Carer's Leave", 'pl', 1 / 26]].concat(e.open.lsl != null ? [['Long Service Leave', 'lsl', 1 / 60]] : []);
    cats.forEach((c) => {
      const taken = c[1] === 'al' ? mine.reduce((a, s) => a + s.lines.filter((l) => l.cat === 'Annual Leave').reduce((b, l) => b + l.units, 0), 0) : 0;
      const bal = r2(e.open[c[1]] + mine.reduce((a, s) => a + ord(s) * c[2], 0) - taken), value = r2(bal * e.rate), loading = c[1] === 'al' ? r2(value * 0.175) : 0;
      rows.push({ accruedAmountInDays: r2(bal / 7.6), leaveValue: value, loadingValue: loading, leavePlusLoading: r2(value + loading), employeeId: e.id, externalId: '', firstName: e.first, surname: e.last, location: 'Sydney',
        leaveCategoryName: c[0], accruedAmount: bal, accruedAmountInHours: bal, unitType: 'Hours' });
    });
  });
  return { businessId: bid(p), asAt: p.as_at || null, totalLeaveValue: sum(rows, 'leaveValue'), totalLeavePlusLoading: sum(rows, 'leavePlusLoading'), rows };
};
// Employee details: the report's columns are whatever Employment Hero is set to return; the connector has already removed
// tax file numbers, bank details, dates of birth, addresses and contact details. labels=true gives display-name keys.
const employeeDetails = (labels) => (p) => {
  const people = main(p) ? EMP.filter((e) => !e.end) : [{ id: 601, first: 'Sam', last: 'Lee', start: '2025-08-01', type: 'Casual', title: 'Bookkeeper' }];
  const rows = people.map((e) => labels
    ? { 'Employee Id': e.id, 'First Name': e.first, 'Surname': e.last, 'Status': 'Active', 'Employment Type': e.type, 'Start Date': e.start + 'T00:00:00', 'Job Title': e.title, 'Primary Location': 'Sydney', 'Pay Schedule': 'Fortnightly' }
    : { EmployeeId: e.id, FirstName: e.first, Surname: e.last, Status: 'Active', EmploymentType: e.type, StartDate: e.start + 'T00:00:00', JobTitle: e.title, PrimaryLocation: 'Sydney', PaySchedule: 'Fortnightly' });
  return { businessId: bid(p), count: rows.length, rows };
};
// PAYG payment summaries: whole dollars (cents dropped), gross payments excluding allowances and salary sacrifice (RESC).
const paymentSummaries = (empty) => (p) => {
  const fy = Number(p.financial_year_ending), from = (fy - 1) + '-07-01', to = fy + '-06-30', rows = [];
  if (main(p) && !empty) EMP.forEach((e) => {
    const mine = SLIPS.filter((s) => s.e === e && s.paid >= from && s.paid <= to); if (!mine.length) return;
    const g = mine.reduce((a, s) => a + s.gross, 0), al = mine.reduce((a, s) => a + s.allow, 0), ss = mine.reduce((a, s) => a + s.ss, 0), tax = mine.reduce((a, s) => a + s.payg + s.help, 0);
    const union = mine.reduce((a, s) => a + s.post.reduce((b, x) => b + x[1], 0), 0);
    rows.push({ employeeId: e.id, employingEntityId: 1, dateGenerated: to + 'T10:00:00', paymentSummaryType: 'IndividualNonBusiness', status: 'Published', etpCode: null, isAmended: false, payeeName: e.first + ' ' + e.last,
      paymentPeriodStart: (e.start > from ? e.start : from) + 'T00:00:00', paymentPeriodEnd: (e.end && e.end < to ? e.end : to) + 'T00:00:00', financialYearStart: from + 'T00:00:00', financialYearEnd: to + 'T00:00:00',
      totalTaxWithheld: Math.floor(tax), grossPayments: Math.floor(g - al - ss), cdepPayments: 0, fringeBenefits: 0, isExemptFromFringeBenefitsTax: false, employerSuperContributions: Math.floor(ss), totalAllowances: Math.floor(al),
      lumpSumA: 0, lumpSumB: 0, lumpSumD: 0, lumpSumE: 0, lumpSumAType: null, notReportedAmount: 0, allowances: al ? { 'Phone Allowance': Math.floor(al) } : {}, unionFeeDeductions: union ? { 'Union Fees': Math.floor(union) } : {},
      workplaceGiving: 0, exemptForeignEmploymentIncome: 0, deductibleAmountOfUndeductedAnnuityPrice: 0, otherAmounts: [], payerABN: '12345678901', payerName: 'Enterprise AI Pty Ltd', payerBranch: '001', payeeABN: null,
      grossPaymentType: 'SalaryAndWages', foreignTaxPaid: 0, inputGrossEarnings: r2(g), inputPreTaxDeductionAmount: r2(ss), totalDeductions: r2(union) });
  });
  return { businessId: bid(p), financialYearEnding: fy, count: rows.length, grossPayments: sum(rows, 'grossPayments'), totalTaxWithheld: sum(rows, 'totalTaxWithheld'), employerSuperContributions: sum(rows, 'employerSuperContributions'),
    note: rows.length ? undefined : 'No payment summaries. Employers reporting through Single Touch Payroll (STP) get ATO income statements instead, which the API does not expose.', rows };
};
const stpRegistration = (p) => main(p)
  ? { businessId: bid(p), name: 'Enterprise AI Pty Ltd', branch: '001', abn: '12345678901', state: 'NSW', lodgementRole: 'Employer', taxAgentNumber: null, intermediaryAbn: null, atoIntegrationOption: 'AccessManager',
    sbrSoftwareId: 'EH-12345', sbrSoftwareProvider: 'Employment Hero', signatoryName: 'Doug Smith', sbrEnabled: true, singleTouchPayrollEnabled: true }
  : { businessId: bid(p), name: 'Enterprise AI Trust', branch: '001', abn: '98765432109', state: 'NSW', lodgementRole: 'Employer', atoIntegrationOption: 'None', sbrEnabled: false, singleTouchPayrollEnabled: false };

module.exports = { BUSINESSES, EMP, PAY_RUNS, SLIPS, listBusinesses, listPayRuns, grossToNet, payg, payCategories, superContributions, leaveBalances, employeeDetails: employeeDetails(false), employeeDetailsLabels: employeeDetails(true),
  paymentSummaries: paymentSummaries(false), paymentSummariesStp: paymentSummaries(true), stpRegistration, r2 };

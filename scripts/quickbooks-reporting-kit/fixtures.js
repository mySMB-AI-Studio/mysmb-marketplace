// QuickBooks Online Accounting API v3 shaped fixtures (Header / Columns / Rows) and QueryResponse entities.
const r2 = (n) => Math.round(n * 100) / 100;
function months(start, end) {
  const out = []; let [y, m] = start.split('-').map(Number); const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push([y, m]); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const data = (label, id, vals) => ({ type: 'Data', ColData: [{ value: label, id }].concat(vals.map((v) => ({ value: v == null ? '' : v.toFixed(2) }))) });
const sum = (rows, n) => Array.from({ length: n }, (_, i) => r2(rows.reduce((s, r) => s + r[i], 0)));
const summary = (label, vals) => ({ ColData: [{ value: label }].concat(vals.map((v) => ({ value: v.toFixed(2) }))) });
function section(group, title, accts, n) {
  const tot = sum(accts.map((a) => a[2]), n);
  return { tot, row: { type: 'Section', group, Header: { ColData: [{ value: title }].concat(Array(n).fill({ value: '' })) }, Rows: { Row: accts.map((a) => data(a[0], a[1], a[2])) }, Summary: summary('Total ' + title, tot) } };
}
function header(name, p, extra) {
  return Object.assign({ Time: '2026-09-25T10:52:00+08:00', ReportName: name, ReportBasis: p.accounting_method || 'Accrual', StartPeriod: p.start_date, EndPeriod: p.end_date, SummarizeColumnsBy: p.summarize_column_by || 'Total', Currency: 'AUD', Option: [{ Name: 'AccountingStandard', Value: 'AU' }, { Name: 'NoReportData', Value: 'false' }] }, extra || {});
}
// P&L: monthly amounts; cash basis shifts consulting income; columns per summarize_column_by (Total | Month)
function pnl(p) {
  const ms = months(p.start_date, p.end_date), byMonth = p.summarize_column_by === 'Month', cash = p.accounting_method === 'Cash';
  const per = (base) => ms.map(([, m]) => r2(base * (1 + (m % 3) * 0.05)));
  const acc = {
    inc: [['SaaS - Consulting Services', '81', per(cash ? 6000 : 7000)], ['SaaS - Subscription Licence', '82', per(57833.33)]],
    cogs: [['Hosting (Azure/AWS)', '91', per(-13775.01)]],
    exp: [['G&A - Insurance', '60', per(5859)], ['R&D - Rent', '61', per(9600)], ['S&M - Advertising and marketing', '62', per(6113)], ['R&D - Contractors', '63', per(240140.88)]],
    oi: [['Interest income', '70', per(7817.79)]]
  };
  const n = byMonth ? ms.length + 1 : 1;
  const shape = (vals) => (byMonth ? vals.concat([r2(vals.reduce((s, v) => s + v, 0))]) : [r2(vals.reduce((s, v) => s + v, 0))]);
  const mk = (list) => list.map(([l, id, v]) => [l, id, shape(v)]);
  const I = section('Income', 'Income', mk(acc.inc), n), C = section('COGS', 'Cost of Sales', mk(acc.cogs), n), E = section('Expenses', 'Expenses', mk(acc.exp), n), O = section('OtherIncome', 'Other Income', mk(acc.oi), n);
  const gp = I.tot.map((v, i) => r2(v - C.tot[i])), noi = gp.map((v, i) => r2(v - E.tot[i])), ni = noi.map((v, i) => r2(v + O.tot[i]));
  const cols = [{ ColTitle: '', ColType: 'Account', MetaData: [{ Name: 'ColKey', Value: 'account' }] }].concat(byMonth ? ms.map(([y, m]) => ({ ColTitle: MON[m - 1] + ' ' + y, ColType: 'Money', MetaData: [{ Name: 'StartDate', Value: y + '-' + String(m).padStart(2, '0') + '-01' }, { Name: 'EndDate', Value: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }, { Name: 'ColKey', Value: MON[m - 1] + ' ' + y }] })) : []).concat([{ ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] }]);
  return { Header: header('ProfitAndLoss', p), Columns: { Column: cols }, Rows: { Row: [I.row, C.row,
    { type: 'Section', group: 'GrossProfit', Summary: summary('Gross Profit', gp) }, E.row,
    { type: 'Section', group: 'NetOperatingIncome', Summary: summary('Net Operating Income', noi) }, O.row,
    { type: 'Section', group: 'NetOtherIncome', Summary: summary('Net Other Income', O.tot) },
    { type: 'Section', group: 'NetIncome', Summary: summary('Net Income', ni) }] } };
}
const MIDX = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const COLT = (titles) => ({ Column: titles.map((t, i) => { const mm = /^([A-Z][a-z]{2}) (\d{4})$/.exec(t || ''); const md = mm ? [{ Name: 'StartDate', Value: mm[2] + '-' + String(MIDX[mm[1]]).padStart(2, '0') + '-01' }, { Name: 'EndDate', Value: new Date(Date.UTC(+mm[2], MIDX[mm[1]], 0)).toISOString().slice(0, 10) }] : [];
  return { ColTitle: t, ColType: i ? 'Money' : 'Account', MetaData: md.concat([{ Name: 'ColKey', Value: i ? (t || 'total').toLowerCase() : 'account' }]) }; }) });
function sec(group, title, children, n, sumLabel) {
  const tot = Array.from({ length: n }, (_, i) => r2(children.reduce((s, c) => s + (c.__t ? c.__t[i] : 0), 0)));
  const row = { type: 'Section', group, Header: { ColData: [{ value: title }].concat(Array(n).fill({ value: '' })) }, Rows: { Row: children.map((c) => c.__row) }, Summary: summary(sumLabel || 'Total ' + title, tot) };
  return { __row: row, __t: tot };
}
const leaf = (label, id, vals) => ({ __row: data(label, id, vals), __t: vals });
// Balance sheet: as-of end_date; summarize Month adds month-end columns. Balances drift by month so ratios move.
function bs(p) {
  const byMonth = p.summarize_column_by === 'Month', ms = byMonth ? months(p.start_date || p.end_date, p.end_date) : [p.end_date.split('-').map(Number)];
  const n = byMonth ? ms.length + 1 : 1, k = (base, drift) => { const v = ms.map((_, i) => r2(base + drift * i)); return byMonth ? v.concat([v[v.length - 1]]) : [v[v.length - 1]]; };
  const shift = p.end_date < '2026-07-01' ? -5000 : 0;
  const bank = sec('BankAccounts', 'Cash and Cash Equivalents', [leaf('Wise-AUD', '35', k(147337 + shift, 1200)), leaf('ANZ', '36', k(99, 0)), leaf('PHP Bank', '37', k(2.69, 0))], n);
  const ar = sec('AR', 'Accounts Receivable (A/R)', [leaf('Accounts Receivable (A/R)', '84', k(39105, 500))], n);
  const oca = sec('OtherCurrentAssets', 'Other Current Assets', [leaf('Prepaid expenses', '40', k(11966.18, 0)), leaf('Security Deposit', '41', k(28800, 0))], n);
  const ca = sec('CurrentAssets', 'Current Assets', [bank, ar, oca], n);
  const nca = sec('OtherAssets', 'Non-current Assets', [leaf('Intangibles - Trademarks', '45', k(18294.11, 0))], n);
  const assets = sec('TotalAssets', 'Assets', [ca, nca], n, 'Total Assets');
  const ap = sec('AP', 'Accounts Payable (A/P)', [leaf('Accounts Payable (A/P)', '33', k(169320.97, 300)), leaf('Accounts Payable (A/P) - USD', '34', k(95858.82, 0))], n);
  const cc = sec('CreditCards', 'Credit Cards', [leaf("Doug's Amex Card", '42', k(25803.79, 0))], n);
  const gst = sec('OtherCurrentLiabilities', 'Other Current Liabilities', [leaf('GST Liabilities Payable', '43', k(-6932.77, 0))], n);
  const cl = sec('CurrentLiabilities', 'Current Liabilities', [ap, cc, gst], n);
  const liab = sec('Liabilities', 'Liabilities', [cl], n);
  const aTot = assets.__t, lTot = liab.__t;
  const fyS = (d) => { const [y, m] = d.split('-').map(Number); return (m >= 7 ? y : y - 1) + '-07-01'; };
  const niAt = (end) => { const r = pnl({ start_date: fyS(end), end_date: end, accounting_method: p.accounting_method }); const s = r.Rows.Row.find((x) => x.group === 'NetIncome'); return Number(s.Summary.ColData[1].value); };
  const ends = byMonth ? ms.map(([y, m]) => { const e = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return e > p.end_date ? p.end_date : e; }) : [p.end_date];
  const ni = (byMonth ? ends.concat([p.end_date]) : ends).map(niAt), re = Array.from({ length: n }, (_, i) => r2(aTot[i] - lTot[i] - ni[i]));
  const eq = sec('Equity', 'Equity', [leaf('Retained Earnings', '2', re), leaf('Net Income', '', ni)], n);
  const le = sec('TotalLiabilitiesAndEquity', 'Liabilities and Equity', [liab, eq], n, 'Total Liabilities and Equity');
  const cols = [''].concat(byMonth ? ms.map(([y, m]) => MON[m - 1] + ' ' + y).concat(['Total']) : ['Total']);
  return { Header: header('BalanceSheet', { start_date: p.start_date || p.end_date, end_date: p.end_date, accounting_method: p.accounting_method, summarize_column_by: p.summarize_column_by }), Columns: COLT(cols), Rows: { Row: [assets.__row, le.__row] }, __ni: ni };
}
// Cash flow statement; summarize Month gives monthly net change columns.
function cashflow(p) {
  const byMonth = p.summarize_column_by === 'Month', ms = months(p.start_date, p.end_date), n = byMonth ? ms.length + 1 : 1;
  const per = (base) => { const v = ms.map(([, m]) => r2(base * (1 + (m % 3) * 0.1))); return byMonth ? v.concat([r2(v.reduce((s, x) => s + x, 0))]) : [r2(v.reduce((s, x) => s + x, 0))]; };
  const niV = per(-18000), adj = sec('OperatingAdjustments', 'Adjustments to reconcile Net Income to Net Cash provided by operations:', [leaf('Accounts Receivable (A/R)', '84', per(52800)), leaf('Accounts Payable (A/P)', '33', per(-9000)), leaf('GST Liabilities Payable', '43', per(-1200))], n, 'Total Adjustments to reconcile Net Income to Net Cash provided by operations:');
  const op = sec('OperatingActivities', 'OPERATING ACTIVITIES', [leaf('Net Income', '', niV), adj], n, 'Net cash provided by operating activities');
  const inv = sec('InvestingActivities', 'INVESTING ACTIVITIES', [leaf('Intangibles - Trademarks', '45', per(-500))], n, 'Net cash provided by investing activities');
  const fin = sec('FinancingActivities', 'FINANCING ACTIVITIES', [leaf('Owner investment', '3', per(0))], n, 'Net cash provided by financing activities');
  // closing cash ties to the bank accounts fixture (A$145,320.70) at the end of the window
  const inc = op.__t.map((v, i) => r2(v + inv.__t[i] + fin.__t[i])), incTot = inc[n - 1], begTot = r2(145320.70 - incTot);
  const beg = Array.from({ length: n }, (_, i) => r2(begTot + (byMonth && i < ms.length ? inc.slice(0, i).reduce((s, x) => s + x, 0) : 0)));
  const end = beg.map((b, i) => r2(b + inc[i]));
  const cols = [''].concat(byMonth ? ms.map(([y, m]) => MON[m - 1] + ' ' + y).concat(['Total']) : ['Total']);
  return { Header: header('CashFlow', p), Columns: COLT(cols), Rows: { Row: [op.__row, inv.__row, fin.__row,
    { type: 'Section', group: 'CashIncrease', Summary: summary('NET CASH INCREASE FOR PERIOD', inc) },
    { type: 'Section', group: 'BeginningCash', Summary: summary('Cash at beginning of period', beg) },
    { type: 'Section', group: 'EndingCash', Summary: summary('CASH AT END OF PERIOD', end) }] } };
}
const BANDS = ['Current', '1 - 30', '31 - 60', '61 - 90', '91 and over'];
const PARTIES = {};
function aged(kind) { // kind 'AR' | 'AP'
  const parties = PARTIES[kind] = kind === 'AR' ? [['Civica Pty Ltd', '58', [39105, 0, 0, 0, 0]]] : [['Adaptovate Pty Ltd - AUD', '70', [20000, 4480.78, 20000, 10000, 10000]], ['Gareth Owen Chainey', '71', [12000, 0, 10240, 10000, 10000]], ['Futurenow Business Services', '72', [11000, 5500, 11000, 8250, 8250]], ['Other suppliers', '73', [25299.44, 7252.59, 21822.81, 20074.5, 40009.67]]];
  return function (p) {
    const rows = parties.map(([n, id, b]) => ({ type: 'Data', ColData: [{ value: n, id }].concat(b.concat([r2(b.reduce((s, x) => s + x, 0))]).map((v) => ({ value: v.toFixed(2) }))) }));
    const tot = BANDS.map((_, i) => r2(parties.reduce((s, x) => s + x[2][i], 0))); tot.push(r2(tot.reduce((s, x) => s + x, 0)));
    return { Header: Object.assign(header(kind === 'AR' ? 'AgedReceivables' : 'AgedPayables', { start_date: '2026-09-25', end_date: '2026-09-25' }), { Option: [{ Name: 'report_date', Value: '2026-09-25' }, { Name: 'NoReportData', Value: 'false' }] }),
      Columns: COLT([''].concat(BANDS, ['Total'])), Rows: { Row: rows.concat([{ type: 'Section', group: 'GrandTotal', Summary: summary('TOTAL', tot) }]) } };
  };
}
function agedDetail(kind) {
  const party = kind === 'AR' ? 'Customer' : 'Vendor', labels = ['Current', '1 - 30 days past due', '31 - 60 days past due', '61 - 90 days past due', '91 or more days past due'];
  return function () {
    const parties = PARTIES[kind] || [], secs = labels.map((band, bi) => [band, parties.filter((pt) => pt[2][bi]).map((pt, j) => ['2026-0' + (9 - bi) + '-0' + (j + 1), kind === 'AR' ? 'Invoice' : 'Bill', String(1000 + bi * 10 + j), pt[0], '2026-0' + (9 - bi) + '-2' + (j + 1), pt[2][bi], pt[2][bi]])]).filter(([, l]) => l.length);
    return { Header: header(kind === 'AR' ? 'AgedReceivableDetail' : 'AgedPayableDetail', { start_date: '2026-09-25', end_date: '2026-09-25' }),
      Columns: { Column: ['Date', 'Transaction Type', 'Num', party, 'Due Date', 'Amount', 'Open Balance'].map((t, i) => ({ ColTitle: t, ColType: i >= 5 ? 'Money' : 'String' })) },
      Rows: { Row: secs.map(([band, list]) => ({ type: 'Section', Header: { ColData: [{ value: band }].concat(Array(6).fill({ value: '' })) }, Rows: { Row: list.map((d) => ({ type: 'Data', ColData: d.map((v) => ({ value: typeof v === 'number' ? v.toFixed(2) : v })) })) },
        Summary: { ColData: [{ value: 'Total for ' + band }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: r2(list.reduce((s2, d) => s2 + d[5], 0)).toFixed(2) }, { value: r2(list.reduce((s2, d) => s2 + d[6], 0)).toFixed(2) }] } })) } };
  };
}
function trialBalance(p) {
  const acc = [['ANZ', 99, null], ['PHP Bank', 2.69, null], ['Wise-AUD', 147337, null], ['Accounts Receivable (A/R)', 91905, null], ['Prepaid expenses', 11966.18, null], ['Security Deposit', 28800, null], ['Intangibles - Trademarks', 18294.11, null],
    ['Accounts Payable (A/P)', null, 175222.57], ['Accounts Payable (A/P) - USD', null, 95858.82], ["Doug's Amex Card", null, 25803.79], ['Retained Earnings', null, 176485.55], ['SaaS - Subscription Licence', null, 57833.33], ['R&D - Contractors', 232800.08, null]];
  const dr = r2(acc.reduce((s, a) => s + (a[1] || 0), 0)), cr = r2(acc.reduce((s, a) => s + (a[2] || 0), 0));
  return { Header: header('TrialBalance', p), Columns: COLT(['', 'Debit', 'Credit']), Rows: { Row: acc.map((a, i) => ({ type: 'Data', ColData: [{ value: a[0], id: String(100 + i) }, { value: a[1] == null ? '' : a[1].toFixed(2) }, { value: a[2] == null ? '' : a[2].toFixed(2) }] })).concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }, { value: dr.toFixed(2) }, { value: cr.toFixed(2) }] } }]) } };
}
// AU TaxSummary: shape not confirmed on a live company (it returned no rows) — fixture models BAS-labelled rows.
function taxSummary(p) {
  if (p.__empty) return { Header: Object.assign(header('TaxSummary', p), { Option: [{ Name: 'NoReportData', Value: 'true' }] }), Columns: COLT(['', 'Total']), Rows: {} };
  const q = p.start_date >= '2026-07-01' ? 1 : 0.8;
  const rowsV = [['Net amount for G1', 127550 * q], ['Tax amount for G1', 12755 * q], ['GST-Free sales', 0], ['G1 TOTAL SALES', 140305 * q], ['1A GST ON SALES', 12755 * q], ['1B GST ON PURCHASES', 19687.77 * q], ['9 REFUND OR PAYMENT DUE', (12755 - 19687.77) * q]];
  return { Header: header('TaxSummary', p), Columns: COLT(['', 'Total']), Rows: { Row: rowsV.map(([l, v]) => ({ type: 'Data', ColData: [{ value: l }, { value: r2(v).toFixed(2) }] })) } };
}
const Q = (entity, list) => ({ QueryResponse: { [entity]: list, startPosition: 1, maxResults: list.length }, time: '2026-09-25T10:52:00+08:00' });
const accounts = () => Q('Account', [
  { Id: '35', Name: 'Wise-AUD', AccountType: 'Bank', AccountSubType: 'Checking', CurrentBalance: 145218.01, CurrencyRef: { value: 'AUD' }, Active: true },
  { Id: '36', Name: 'ANZ', AccountType: 'Bank', CurrentBalance: 99, CurrencyRef: { value: 'AUD' }, Active: true },
  { Id: '37', Name: 'PHP Bank', AccountType: 'Bank', CurrentBalance: 3.69, CurrencyRef: { value: 'AUD' }, Active: true },
  { Id: '42', Name: "Doug's Amex Card", AccountType: 'Credit Card', CurrentBalance: 16708.64, CurrencyRef: { value: 'AUD' }, Active: true }]);
const invoices = () => Q('Invoice', [{ Id: '1042', DocNumber: '1042', TxnDate: '2026-09-01', DueDate: '2026-10-01', TotalAmt: 39105, Balance: 39105, CustomerRef: { value: '58', name: 'Civica Pty Ltd' } }]);
const bills = () => Q('Bill', [
  { Id: 'B201', DocNumber: 'B-201', TxnDate: '2026-09-10', DueDate: '2026-09-30', TotalAmt: 20000, Balance: 20000, VendorRef: { value: '70', name: 'Adaptovate Pty Ltd - AUD' } },
  { Id: 'B117', DocNumber: 'B-117', TxnDate: '2026-05-01', DueDate: '2026-05-31', TotalAmt: 40009.67, Balance: 40009.67, VendorRef: { value: '73', name: 'Other suppliers' } },
  { Id: 'B150', DocNumber: 'B-150', TxnDate: '2026-08-15', DueDate: '2026-09-14', TotalAmt: 6929.33, Balance: 6929.33, VendorRef: { value: '72', name: 'Futurenow Business Services' } }]);
const payments = () => Q('Payment', [{ Id: 'P1', TxnDate: '2026-09-05', TotalAmt: 52800, CustomerRef: { value: '58', name: 'Civica Pty Ltd' } }, { Id: 'P0', TxnDate: '2026-08-20', TotalAmt: 10000, CustomerRef: { value: '58', name: 'Civica Pty Ltd' } }]);
const billPayments = () => Q('BillPayment', [{ Id: 'BP1', TxnDate: '2026-09-12', TotalAmt: 120000, VendorRef: { value: '71', name: 'Gareth Owen Chainey' } }]);
const purchases = () => Q('Purchase', [{ Id: 'E1', TxnDate: '2026-09-02', TotalAmt: 43105, PaymentType: 'CreditCard', EntityRef: { name: 'AWS' } }]);
// ---------- Wave 2 fixtures ----------
const COLS = (titles, types) => ({ Column: titles.map((t, i) => ({ ColTitle: t, ColType: (types && types[i]) || (i ? 'Money' : 'Account') })) });
const cell = (v) => ({ value: v == null ? '' : typeof v === 'number' ? v.toFixed(2) : String(v) });
// GeneralLedger: section per account; Beginning Balance row, transaction rows, Summary 'Total for <acct>' (Amount, Balance)
function generalLedger(p) {
  const accts = [['Wise-AUD', 140000, [['2026-08-03', 'Deposit', '', 'Civica Pty Ltd', 'Payment received', 'Accounts Receivable (A/R)', 52800], ['2026-08-12', 'Expense', '301', 'AWS', 'Hosting', 'Hosting (Azure/AWS)', -13775.01], ['2026-08-20', 'Bill Payment', '302', 'Gareth Owen Chainey', '', 'Accounts Payable (A/P)', -33703.29]]],
    ['PHP Bank', -8.52, [['2026-08-15', 'Transfer', '', '', 'Wise transfer', 'Wise-AUD', 5.83]]]];
  const rows = accts.map(([name, beg, tx]) => { let bal = beg; const tr = tx.map((t) => { bal = r2(bal + t[6]); return { type: 'Data', ColData: [cell(t[0]), cell(t[1]), cell(t[2]), cell(t[3]), cell(t[4]), cell(t[5]), cell(t[6]), cell(bal)] }; });
    const amt = r2(tx.reduce((s, t) => s + t[6], 0));
    return { type: 'Section', Header: { ColData: [{ value: name }, cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell('')] }, Rows: { Row: [{ type: 'Data', ColData: [cell('Beginning Balance'), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell(beg)] }].concat(tr) },
      Summary: { ColData: [cell('Total for ' + name), cell(''), cell(''), cell(''), cell(''), cell(''), cell(amt), cell(r2(beg + amt))] } };
  });
  return { Header: header('GeneralLedger', p), Columns: COLS(['Date', 'Transaction Type', 'Num', 'Name', 'Memo/Description', 'Split', 'Amount', 'Balance'], ['Date', 'String', 'String', 'String', 'String', 'String', 'Money', 'Money']), Rows: { Row: rows } };
}
function transactionList(p) {
  const tx = [['2026-09-01', 'Invoice', '1042', 'Civica Pty Ltd', 'Accounts Receivable (A/R)', 39105], ['2026-09-05', 'Payment', '', 'Civica Pty Ltd', 'Wise-AUD', 52800], ['2026-09-10', 'Bill', 'B-201', 'Adaptovate Pty Ltd - AUD', 'Accounts Payable (A/P)', 20000], ['2026-09-12', 'Bill Payment (Cheque)', '303', 'Gareth Owen Chainey', 'Wise-AUD', 120000], ['2026-09-02', 'Expense', '304', 'AWS', "Doug's Amex Card", 43105], ['2026-09-15', 'Journal Entry', 'JE-9', '', 'Prepaid expenses', 1200]];
  return { Header: header('TransactionList', p), Columns: COLS(['Date', 'Transaction Type', 'Num', 'Name', 'Account', 'Amount'], ['Date', 'String', 'String', 'String', 'String', 'Money']), Rows: { Row: tx.map((t) => ({ type: 'Data', ColData: t.map(cell) })) } };
}
function journalReport(p) {
  const je = [['2026-09-15', 'Journal Entry', 'JE-9', [['Prepaid expenses', 1200, null], ['Accounts Payable (A/P)', null, 1200]]], ['2026-09-02', 'Expense', '304', [['Hosting (Azure/AWS)', 43105, null], ["Doug's Amex Card", null, 43105]]]];
  const rows = je.map(([d, t, n, lines]) => ({ type: 'Section', Header: { ColData: [cell(d), cell(t), cell(n), cell(''), cell(''), cell('')] }, Rows: { Row: lines.map((l) => ({ type: 'Data', ColData: [cell(''), cell(''), cell(''), cell(l[0]), cell(l[1]), cell(l[2])] })) },
    Summary: { ColData: [cell(''), cell(''), cell(''), cell(''), cell(r2(lines.reduce((s, l) => s + (l[1] || 0), 0))), cell(r2(lines.reduce((s, l) => s + (l[2] || 0), 0)))] } }));
  const dr = r2(je.reduce((s, j) => s + j[3].reduce((a, l) => a + (l[1] || 0), 0), 0)), cr = r2(je.reduce((s, j) => s + j[3].reduce((a, l) => a + (l[2] || 0), 0), 0));
  return { Header: header('JournalReport', p), Columns: COLS(['Date', 'Transaction Type', 'Num', 'Account', 'Debit', 'Credit'], ['Date', 'String', 'String', 'String', 'Money', 'Money']), Rows: { Row: rows.concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(''), cell(''), cell(''), cell(dr), cell(cr)] } }]) } };
}
function accountList() {
  const a = [['Wise-AUD', 'Bank', 'Checking', 145218.01], ['Accounts Receivable (A/R)', 'Accounts receivable (A/R)', '', 39105], ['Undeposited Funds', 'Other Current Assets', 'UndepositedFunds', 1250], ['Accounts Payable (A/P)', 'Accounts payable (A/P)', '', 169320.97], ['SaaS - Subscription Licence', 'Income', 'SalesOfProductIncome', null]];
  return { Header: header('AccountList', {}), Columns: COLS(['Account', 'Type', 'Detail Type', 'Balance'], ['String', 'String', 'String', 'Money']), Rows: { Row: a.map((x) => ({ type: 'Data', ColData: x.map(cell) })) } };
}
// Sales reports
const CUST = [['Civica Pty Ltd', '58', 57833.33], ['Northwind Traders', '59', 7000], ['Contoso Pty Ltd', '60', 1500]];
function customerSales(p) {
  const tot = r2(CUST.reduce((s, c) => s + c[2], 0));
  return { Header: header('CustomerSales', p), Columns: COLT(['', 'Total']), Rows: { Row: CUST.map(([n, id, v]) => ({ type: 'Data', ColData: [{ value: n, id }, cell(v)] })).concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(tot)] } }]) } };
}
function itemSales(p) {
  const it = [['SaaS Subscription', '11', 12, 57833.33], ['Consulting', '12', 40, 8500]];
  const tot = r2(it.reduce((s, x) => s + x[3], 0));
  // QuickBooks' real shape: the money columns are nested under "Total" (Intuit's ItemSales sample), each row's ColData is flat
  const sub = ['Quantity', 'Amount', '% of Sales', 'Avg Price', 'COGS', 'Gross Margin', 'Gross Margin %'].map((t) => ({ ColType: 'Money', ColTitle: t }));
  return { Header: header('ItemSales', p), Columns: { Column: [{ ColType: 'ProductsAndService', ColTitle: '' }, { ColType: 'Money', ColTitle: 'Total', Columns: { Column: sub } }] },
    Rows: { Row: it.map(([n, id, q, a]) => ({ type: 'Data', ColData: [{ value: n, id }, cell(q), cell(a), { value: r2((a / tot) * 100).toFixed(2) + ' %' }, cell(r2(a / q)), cell(''), cell(''), cell('')] }))
      .concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(52), cell(tot), { value: '100.00 %' }, cell(''), cell(''), cell(''), cell('')] } }]) } };
}
function customerIncome(p) {
  const rows = CUST.map(([n, id, v]) => [n, id, v, r2(v * 0.2)]);
  const ti = r2(rows.reduce((s, x) => s + x[2], 0)), te = r2(rows.reduce((s, x) => s + x[3], 0));
  return { Header: header('CustomerIncome', p), Columns: COLS(['', 'Income', 'Expenses', 'Net Income']), Rows: { Row: rows.map((x) => ({ type: 'Data', ColData: [{ value: x[0], id: x[1] }, cell(x[2]), cell(x[3]), cell(r2(x[2] - x[3]))] })).concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(ti), cell(te), cell(r2(ti - te))] } }]) } };
}
const VEND = [['Adaptovate Pty Ltd - AUD', '70', 125000], ['Microsoft', '74', 52000], ['AWS', '75', 43391.28], ['Gareth Owen Chainey', '71', 30240], ['Futurenow Business Services', '72', 18455.85]];
function vendorExpenses(p) {
  const tot = r2(VEND.reduce((s, v) => s + v[2], 0));
  return { Header: header('VendorExpenses', p), Columns: COLT(['', 'Total']), Rows: { Row: VEND.map(([n, id, v]) => ({ type: 'Data', ColData: [{ value: n, id }, cell(v)] })).concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(tot)] } }]) } };
}
// P&L whose totals tie to the sales / vendor fixtures (used for the sales-by-customer and expenses-by-supplier information lines)
function pnlTied(p) {
  const inc = r2(CUST.reduce((s, c) => s + c[2], 0)), exp = r2(VEND.reduce((s, v) => s + v[2], 0));
  const I = section('Income', 'Income', [['Sales', '80', [inc]]], 1), E = section('Expenses', 'Expenses', [['Supplier costs', '60', [exp]]], 1);
  return { Header: header('ProfitAndLoss', p), Columns: COLT(['', 'Total']), Rows: { Row: [I.row, { type: 'Section', group: 'GrossProfit', Summary: summary('Gross Profit', I.tot) }, E.row, { type: 'Section', group: 'NetIncome', Summary: summary('Net Income', [r2(inc - exp)]) }] } };
}
const accountsAll = () => Q('Account', [
  { Id: '35', Name: 'Wise-AUD', AccountType: 'Bank', Classification: 'Asset', CurrentBalance: 145218.01, Active: true },
  { Id: '36', Name: 'ANZ', AccountType: 'Bank', Classification: 'Asset', CurrentBalance: 99, Active: true },
  { Id: '42', Name: "Doug's Amex Card", AccountType: 'Credit Card', Classification: 'Liability', CurrentBalance: 16708.64, Active: true },
  { Id: '50', Name: 'Undeposited Funds', AccountType: 'Other Current Asset', AccountSubType: 'UndepositedFunds', Classification: 'Asset', CurrentBalance: 1250, Active: true },
  { Id: '51', Name: 'Uncategorised Expense', AccountType: 'Expense', Classification: 'Expense', CurrentBalance: 0, Active: true },
  { Id: '52', Name: 'Uncategorised Asset', AccountType: 'Other Current Asset', Classification: 'Asset', CurrentBalance: 320, Active: true },
  { Id: '53', Name: 'Opening Balance Equity', AccountType: 'Equity', Classification: 'Equity', CurrentBalance: 0, Active: true },
  { Id: '54', Name: 'Security Deposit', AccountType: 'Other Current Asset', Classification: 'Asset', CurrentBalance: -150, Active: true },
  { Id: '43', Name: 'GST Liabilities Payable', AccountType: 'Other Current Liability', Classification: 'Liability', CurrentBalance: -6932.77, Active: true }]);
const customers = () => Q('Customer', CUST.map(([n, id]) => ({ Id: id, DisplayName: n, PrimaryEmailAddr: { Address: n.split(' ')[0].toLowerCase() + '@example.com' }, PrimaryPhone: { FreeFormNumber: '02 9000 00' + id }, Balance: id === '58' ? 39105 : 0, Active: true })));
const items = () => Q('Item', [{ Id: '11', Name: 'SaaS Subscription', Type: 'Service', UnitPrice: 4819.44, Active: true }, { Id: '12', Name: 'Consulting', Type: 'Service', UnitPrice: 212.5, Active: true }]);
const estimates = () => Q('Estimate', [{ Id: 'E1', DocNumber: 'Q-7', TxnDate: '2026-09-18', TotalAmt: 12000, TxnStatus: 'Pending', CustomerRef: { value: '59', name: 'Northwind Traders' } }]);
const vendors = () => Q('Vendor', VEND.map(([n, id]) => ({ Id: id, DisplayName: n, PrimaryEmailAddr: { Address: 'ap@' + n.split(' ')[0].toLowerCase() + '.com' }, PrimaryPhone: { FreeFormNumber: '03 8000 00' + id }, Balance: 0, Active: true })));
const purchasesMany = () => Q('Purchase', [{ Id: 'E1', TxnDate: '2026-09-02', TotalAmt: 43105, PaymentType: 'CreditCard', EntityRef: { name: 'AWS' }, AccountRef: { name: "Doug's Amex Card" } }, { Id: 'E2', TxnDate: '2026-08-28', TotalAmt: 880, PaymentType: 'Check', DocNumber: '1007', EntityRef: { name: 'Futurenow Business Services' }, AccountRef: { name: 'Wise-AUD' } }]);
function budgets() {
  const accts = [['80', 'Sales', 22000], ['60', 'Supplier costs', 90000]], months = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01'];
  return Q('Budget', [{ Id: '1', Name: 'FY2027 Budget', StartDate: '2026-07-01', EndDate: '2027-06-30', BudgetType: 'ProfitAndLoss', BudgetEntryType: 'Monthly', Active: true,
    BudgetDetail: accts.flatMap(([id, n, amt]) => months.map((m) => ({ BudgetDate: m, Amount: amt, AccountRef: { value: id, name: n } }))) }]);
}
// P&L by month whose account rows carry ids that match the budget accounts
function pnlBudget(p) {
  const ms = months(p.start_date, p.end_date), n = ms.length + 1, v = (base) => { const x = ms.map((_, i) => r2(base * (1 + i * 0.03))); return x.concat([r2(x.reduce((s, y) => s + y, 0))]); };
  const I = section('Income', 'Income', [['Sales', '80', v(21000)]], n), E = section('Expenses', 'Expenses', [['Supplier costs', '60', v(95000)]], n);
  const cols = [{ ColTitle: '', ColType: 'Account' }].concat(ms.map(([y, m]) => ({ ColTitle: MON[m - 1] + ' ' + y, ColType: 'Money', MetaData: [{ Name: 'StartDate', Value: y + '-' + String(m).padStart(2, '0') + '-01' }, { Name: 'EndDate', Value: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }] })), [{ ColTitle: 'Total', ColType: 'Money' }]);
  return { Header: header('ProfitAndLoss', p), Columns: { Column: cols }, Rows: { Row: [I.row, { type: 'Section', group: 'GrossProfit', Summary: summary('Gross Profit', I.tot) }, E.row, { type: 'Section', group: 'NetIncome', Summary: summary('Net Income', I.tot.map((x, i) => r2(x - E.tot[i]))) }] } };
}
// Open bills that tie to the A/P ageing fixture (one bill per supplier per non-zero band)
function billsTied() { aged('AP')(); const due = ['2026-10-10', '2026-09-10', '2026-08-10', '2026-07-10', '2026-05-10'], out = [];
  (PARTIES.AP || []).forEach(([n, id, b]) => b.forEach((amt, i) => { if (amt) out.push({ Id: id + '-' + i, DocNumber: 'B-' + id + i, TxnDate: '2026-04-01', DueDate: due[i], TotalAmt: amt, Balance: amt, VendorRef: { value: id, name: n } }); }));
  return Q('Bill', out); }
// ---------- Wave 3 fixtures (inventory, projects, customer hub, FX) — sample company had none: shapes per the Accounting API docs ----------
const INV = [['Widget A', '21', 'WA-01', 40, 10, 12.5], ['Widget B', '22', 'WB-02', 6, 10, 20], ['Gadget C', '23', 'GC-03', 0, 5, 48], ['Gizmo D', '24', 'GD-04', 150, 0, 3.2]];
const invItems = () => Q('Item', INV.map(([n, id, sku, q, rp, c]) => ({ Id: id, Name: n, Sku: sku, Type: 'Inventory', QtyOnHand: q, ReorderPoint: rp, PurchaseCost: c, UnitPrice: r2(c * 1.8), TrackQtyOnHand: true, Active: true, AssetAccountRef: { value: '90', name: 'Inventory Asset' } })));
function inventoryValuation() {
  const rows = INV.map(([n, id, sku, q, , c]) => ({ type: 'Data', ColData: [{ value: n, id }, cell(sku), cell(q), cell(r2(q * c)), cell(c)] }));
  const tq = INV.reduce((s, x) => s + x[3], 0), tv = r2(INV.reduce((s, x) => s + x[3] * x[5], 0));
  return { Header: header('InventoryValuationSummary', { start_date: '2026-09-25', end_date: '2026-09-25' }), Columns: COLS(['', 'SKU', 'Qty', 'Asset Value', 'Calc. Avg'], ['Account', 'String', 'Money', 'Money', 'Money']),
    Rows: { Row: rows.concat([{ type: 'Section', group: 'GrandTotal', Summary: { ColData: [cell('TOTAL'), cell(''), cell(tq), cell(tv), cell('')] } }]) } };
}
const invAssetAccount = () => Q('Account', [{ Id: '90', Name: 'Inventory Asset', AccountType: 'Other Current Asset', AccountSubType: 'Inventory', Classification: 'Asset', CurrentBalance: r2(INV.reduce((s, x) => s + x[3] * x[5], 0)), Active: true }]);
const purchaseOrders = () => Q('PurchaseOrder', [{ Id: 'PO1', DocNumber: 'PO-101', TxnDate: '2026-09-15', DueDate: '2026-10-05', POStatus: 'Open', TotalAmt: 960, VendorRef: { name: 'Widget Supplies Pty Ltd' }, Line: [{ Amount: 960, ItemBasedExpenseLineDetail: { ItemRef: { value: '23', name: 'Gadget C' }, Qty: 20, UnitPrice: 48 } }] }, { Id: 'PO0', DocNumber: 'PO-099', TxnDate: '2026-08-01', POStatus: 'Closed', TotalAmt: 500, VendorRef: { name: 'Widget Supplies Pty Ltd' }, Line: [] }]);
// Projects = sub-customers with IsProject; P&L by Customers has one column per customer plus 'Not Specified' and Total
const PROJ = [['Website Rebuild', '101', 42000, 18500], ['Mobile App', '102', 30000, 26400], ['Data Migration', '103', 12000, 4100]];
const projectCustomers = () => Q('Customer', [{ Id: '58', DisplayName: 'Civica Pty Ltd', Job: false, Active: true }].concat(PROJ.map(([n, id]) => ({ Id: id, DisplayName: 'Civica Pty Ltd:' + n, FullyQualifiedName: 'Civica Pty Ltd:' + n, Job: true, IsProject: true, ParentRef: { value: '58' }, Active: true }))));
function pnlByCustomer(p) {
  const custs = PROJ.map(([n, id, inc, cost]) => ['Civica Pty Ltd:' + n, id, inc, cost]).concat([['Not Specified', null, 5000, 90000]]), n = custs.length + 1;
  const col = (vals) => vals.concat([r2(vals.reduce((s, v) => s + v, 0))]);
  const I = section('Income', 'Income', [['Services', '80', col(custs.map((c) => c[2]))]], n), E = section('Expenses', 'Expenses', [['Contractors', '63', col(custs.map((c) => c[3]))]], n);
  const cols = [{ ColTitle: '', ColType: 'Account' }].concat(custs.map((c) => ({ ColTitle: c[0], ColType: 'Money', MetaData: c[1] ? [{ Name: 'ColKey', Value: c[1] }] : [] })), [{ ColTitle: 'Total', ColType: 'Money' }]);
  return { Header: header('ProfitAndLoss', Object.assign({}, p, { summarize_column_by: 'Customers' })), Columns: { Column: cols }, Rows: { Row: [I.row, { type: 'Section', group: 'GrossProfit', Summary: summary('Gross Profit', I.tot) }, E.row, { type: 'Section', group: 'NetIncome', Summary: summary('Net Income', I.tot.map((x, i) => r2(x - E.tot[i]))) }] } };
}
const projectEstimates = () => Q('Estimate', [{ Id: 'E11', DocNumber: 'Q-11', TxnDate: '2026-06-01', TotalAmt: 45000, TxnStatus: 'Accepted', CustomerRef: { value: '101', name: 'Civica Pty Ltd:Website Rebuild' } }, { Id: 'E12', DocNumber: 'Q-12', TxnDate: '2026-06-15', TotalAmt: 28000, TxnStatus: 'Accepted', CustomerRef: { value: '102', name: 'Civica Pty Ltd:Mobile App' } }, { Id: 'E13', DocNumber: 'Q-13', TxnDate: '2026-09-20', TotalAmt: 9000, TxnStatus: 'Pending', ExpirationDate: '2026-10-01', CustomerRef: { value: '59', name: 'Northwind Traders' } }]);
// FX: foreign-currency open documents with booked ExchangeRate; current rates from ExchangeRate query
const fxBills = () => Q('Bill', [{ Id: 'FB1', DocNumber: 'US-7', TxnDate: '2026-07-10', DueDate: '2026-08-10', TotalAmt: 60000, Balance: 60000, CurrencyRef: { value: 'USD' }, ExchangeRate: 1.5, VendorRef: { name: 'Adaptovate LLC (USD)' } }, { Id: 'FB2', DocNumber: 'EU-3', TxnDate: '2026-08-01', DueDate: '2026-09-01', TotalAmt: 10000, Balance: 10000, CurrencyRef: { value: 'EUR' }, ExchangeRate: 1.65, VendorRef: { name: 'Berlin GmbH (EUR)' } }, { Id: 'AB1', DocNumber: 'AU-1', TxnDate: '2026-08-01', TotalAmt: 500, Balance: 500, CurrencyRef: { value: 'AUD' }, ExchangeRate: 1, VendorRef: { name: 'Local' } }]);
const fxInvoices = () => Q('Invoice', [{ Id: 'FI1', DocNumber: 'INV-US1', TxnDate: '2026-08-05', DueDate: '2026-09-05', TotalAmt: 20000, Balance: 20000, CurrencyRef: { value: 'USD' }, ExchangeRate: 1.52, CustomerRef: { name: 'Acme Inc (USD)' } }]);
const exchangeRates = () => Q('ExchangeRate', [{ SourceCurrencyCode: 'USD', TargetCurrencyCode: 'AUD', Rate: 1.48, AsOfDate: '2026-09-25' }, { SourceCurrencyCode: 'EUR', TargetCurrencyCode: 'AUD', Rate: 1.7, AsOfDate: '2026-09-25' }]);
function pnlFx(p) {
  const I = section('Income', 'Income', [['Sales', '80', [100000]]], 1), O = section('OtherIncome', 'Other Income', [['Exchange Gain or Loss', '95', [-1234.56]], ['Interest income', '70', [800]]], 1);
  return { Header: header('ProfitAndLoss', p), Columns: COLT(['', 'Total']), Rows: { Row: [I.row, { type: 'Section', group: 'GrossProfit', Summary: summary('Gross Profit', I.tot) }, O.row, { type: 'Section', group: 'NetIncome', Summary: summary('Net Income', [r2(I.tot[0] + O.tot[0])]) }] } };
}
const prefsMulti = { Preferences: { AccountingInfoPrefs: { FirstMonthOfFiscalYear: 'July' }, CurrencyPrefs: { MultiCurrencyEnabled: true, HomeCurrency: { value: 'AUD' } } } };
const customersHub = () => Q('Customer', [{ Id: '58', DisplayName: 'Civica Pty Ltd', Balance: 39105, Active: true, MetaData: { CreateTime: '2025-11-02T10:00:00+08:00' } }, { Id: '59', DisplayName: 'Northwind Traders', Balance: 0, Active: true, MetaData: { CreateTime: '2026-08-20T10:00:00+08:00' } }].concat(PROJ.map(([n, id]) => ({ Id: id, DisplayName: 'Civica Pty Ltd:' + n, Job: true, IsProject: true, Balance: 0, Active: true, MetaData: { CreateTime: '2026-05-01T10:00:00+08:00' } }))));
const companyInfo = { QueryResponse: { CompanyInfo: [{ Id: '1', CompanyName: 'Enterprise AI Pty Ltd', LegalName: 'Enterprise AI Pty Ltd', Country: 'AU', FiscalYearStartMonth: 'July' }], startPosition: 1, maxResults: 1 }, time: '2026-09-25T10:52:00+08:00' };
const prefs = { Preferences: { AccountingInfoPrefs: { FirstMonthOfFiscalYear: 'July', TaxYearMonth: 'July' }, CurrencyPrefs: { MultiCurrencyEnabled: true, HomeCurrency: { value: 'AUD' } } }, time: '2026-09-25T10:52:00+08:00' };
// Employees and time (Q31)
const employees = () => Q('Employee', [
  { Id: '301', DisplayName: 'Melanie Burrows', GivenName: 'Melanie', FamilyName: 'Burrows', PrimaryPhone: { FreeFormNumber: '02 9000 1301' }, Mobile: { FreeFormNumber: '0400 000 301' }, PrimaryEmailAddr: { Address: 'melanie@example.com' }, PrimaryAddr: { Line1: '1 George St', City: 'Sydney', CountrySubDivisionCode: 'NSW', PostalCode: '2000' }, EmployeeNumber: 'E-01', Active: true },
  { Id: '302', DisplayName: 'Yucheng Sun', GivenName: 'Yucheng', FamilyName: 'Sun', PrimaryEmailAddr: { Address: 'yucheng@example.com' }, EmployeeNumber: 'E-02', Active: true },
  { Id: '303', DisplayName: 'Priya Nair', GivenName: 'Priya', FamilyName: 'Nair', Mobile: { FreeFormNumber: '0400 000 303' }, Active: true }]);
const TA = (id, date, who, cust, item, h, m, status, rate, extra) => Object.assign({ Id: id, TxnDate: date, NameOf: who[0], [who[0] === 'Vendor' ? 'VendorRef' : 'EmployeeRef']: { value: who[1], name: who[2] }, CustomerRef: cust ? { value: cust[0], name: cust[1] } : undefined, ItemRef: item ? { value: item[0], name: item[1] } : undefined,
  BillableStatus: status, HourlyRate: rate, Hours: h, Minutes: m, Description: 'Work for ' + (cust ? cust[1] : 'internal'), MetaData: { CreateTime: date + 'T09:00:00+10:00', LastUpdatedTime: date + 'T09:00:00+10:00' } }, extra || {});
const MB = ['Employee', '301', 'Melanie Burrows'], YS = ['Employee', '302', 'Yucheng Sun'], GC = ['Vendor', '71', 'Gareth Owen Chainey'], CIV = ['58', 'Civica Pty Ltd'], NW = ['59', 'Northwind Traders'], CONS = ['12', 'Consulting'];
const timeActivities = () => Q('TimeActivity', [
  TA('T9', '2026-09-24', MB, CIV, CONS, 7, 30, 'Billable', 212.5, { MetaData: { CreateTime: '2026-09-24T09:00:00+10:00', LastUpdatedTime: '2026-09-25T16:20:00+10:00' } }),
  TA('T8', '2026-09-22', YS, NW, CONS, 3, 0, 'Billable', 180),
  TA('T7', '2026-09-18', MB, null, null, 2, 15, 'NotBillable', 0),
  TA('T6', '2026-09-15', GC, CIV, CONS, 6, 0, 'HasBeenBilled', 150),
  TA('T5', '2026-09-10', YS, CIV, CONS, undefined, undefined, 'Billable', 180, { StartTime: '2026-09-10T09:00:00+10:00', EndTime: '2026-09-10T17:30:00+10:00', BreakHours: 0, BreakMinutes: 30 }),
  TA('T4', '2026-09-02', MB, NW, CONS, 4, 45, 'NotBillable', 0),
  TA('T3', '2026-08-28', MB, CIV, CONS, 8, 0, 'Billable', 212.5),
  TA('T2', '2026-08-14', YS, null, null, 1, 30, 'NotBillable', 0)]);
const timeActivitiesPay = () => { const r = timeActivities(); r.QueryResponse.TimeActivity.forEach((t, i) => { if (t.NameOf === 'Employee') t.PayrollItemRef = { value: String(i % 2), name: i % 2 ? 'Overtime' : 'Ordinary hours' }; }); return r; };
function bsAU(p) {
  const r = JSON.parse(JSON.stringify(bs(p)));
  const strip = (rows) => rows.forEach((x) => { delete x.group; if (x.Rows) strip(x.Rows.Row); });
  const relabel = (node, from, to) => { if (node && node.ColData && node.ColData[0].value === from) node.ColData[0].value = to; };
  const le = r.Rows.Row[1], liab = le.Rows.Row[0], eq = le.Rows.Row[1];
  le.Rows.Row = liab.Rows.Row.concat([eq]);              // no 'Liabilities' wrapper and no 'Total liabilities'
  relabel(le.Header, 'Liabilities and Equity', "Liabilities and shareholder's equity"); relabel(le.Summary, 'Total Liabilities and Equity', 'Total liabilities and equity');
  const cl = le.Rows.Row[0]; relabel(cl.Header, 'Current Liabilities', 'Current liabilities:'); relabel(cl.Summary, 'Total Current Liabilities', 'Total current liabilities');
  relabel(eq.Header, 'Equity', "Shareholders' equity"); relabel(eq.Summary, 'Total Equity', "Total shareholders' equity");
  eq.Rows.Row.forEach((x) => { if (x.ColData[0].value === 'Net Income') { x.ColData[0].value = 'Profit for the year'; delete x.ColData[0].id; } });
  const bas = (rows) => rows.forEach((x) => { if (x.ColData && x.ColData[0].value === 'GST Liabilities Payable') x.ColData[0].value = 'BAS Liabilities Payable'; if (x.Rows) bas(x.Rows.Row); });
  bas(r.Rows.Row);                                        // sandbox AU 1870 names the GST account this way
  strip(r.Rows.Row);
  return r;
}
function cashflowRows(p) { const r = cashflow(p); r.Rows.Row = r.Rows.Row.map((x) => (x.group === 'EndingCash' || x.group === 'BeginningCash') ? { type: 'Data', group: x.group, ColData: x.Summary.ColData } : x); return r; }
function cashflowAU(p) {
  const r = JSON.parse(JSON.stringify(cashflow(p))), L = { CashIncrease: 'Net increase in cash and cash equivalents', BeginningCash: 'Cash and cash equivalents at beginning of period', EndingCash: 'Cash and cash equivalents at end of period' };
  const strip = (rows) => rows.forEach((x) => { if (L[x.group] && x.Summary) x.Summary.ColData[0].value = L[x.group]; delete x.group; if (x.Rows) strip(x.Rows.Row); });
  strip(r.Rows.Row); return r;
}
const taxAgencies = () => Q('TaxAgency', [{ Id: '1', DisplayName: 'Australian Tax Office', TaxTrackedOnSales: true, TaxTrackedOnPurchases: true }]);
const taxSummaryByAgency = (p) => taxSummary(p.agency_id === '1' ? p : Object.assign({ __empty: true }, p));
module.exports = { taxAgencies, taxSummaryByAgency, cashflowRows, cashflowAU, bsAU, employees, timeActivities, timeActivitiesPay, invItems, inventoryValuation, invAssetAccount, purchaseOrders, projectCustomers, pnlByCustomer, projectEstimates, fxBills, fxInvoices, exchangeRates, pnlFx, prefsMulti, customersHub, billsTied, generalLedger, transactionList, journalReport, accountList, customerSales, itemSales, customerIncome, vendorExpenses, pnlTied, accountsAll, customers, items, estimates, vendors, purchasesMany, budgets, pnlBudget, pnl, bs, cashflow, ar: aged('AR'), ap: aged('AP'), arDetail: agedDetail('AR'), apDetail: agedDetail('AP'), trialBalance, taxSummary, accounts, invoices, bills, payments, billPayments, purchases, companyInfo, prefs, header, section, summary, data, months, r2, sum };

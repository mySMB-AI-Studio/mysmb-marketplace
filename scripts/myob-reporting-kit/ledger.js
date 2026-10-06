// A MYOB AccountRight company file as one set of books: every MYOB-shaped response the kit reports read is DERIVED from the
// same transactions, so a report's ties must pass on it, and a tampered response must fail. Two company files (LIB-002).
// Shapes follow the myob-accounting connector (myhub-mcp-servers src/integrations/myob-accounting): lists are {Count, Items}
// of MYOB API v2 objects; the P&L and Balance Sheet summaries are {…, AccountsBreakdown:[{Account{UID,Name,DisplayID}, AccountTotal}]}
// with every account positive in its normal balance; the ageing tools return the connector's own summary.
const TODAY = '2026-09-28';
const CF1 = 'cf-mysmb', CF2 = 'cf-demo';
const FILES = { [CF1]: { Id: CF1, Name: 'mySMB.com', Country: 'AU', seed: 11, scale: 1 }, [CF2]: { Id: CF2, Name: 'Demo Pty Ltd', Country: 'AU', seed: 29, scale: 2.4 } };
const r2 = (v) => Math.round(v * 100) / 100;
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const iso = (dt) => dt.toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return D(y, m, d); };
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * 86400000));
const eom = (y, m) => iso(D(y, m + 1, 0));
const ISO = (d, end) => d + (end ? 'T23:59:59' : 'T00:00:00');
const fyStart = (s) => { const [y, m] = s.split('-').map(Number); return (m >= 7 ? y : y - 1) + '-07-01'; };
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const U = (cf, n) => (cf === CF1 ? '00000000' : '11111111') + '-0000-4000-8000-' + String(n).padStart(12, '0');

// Chart of accounts (AU AccountRight style). [n, DisplayID, Name, Classification, Type, header?]
const CHART_DEF = [
  [1, '1-0000', 'Assets', 'Asset', 'Asset', 1], [2, '1-1110', 'Business Bank Account #1', 'Asset', 'Bank'], [3, '1-1120', 'Business Savings Account', 'Asset', 'Bank'],
  [5, '1-1200', 'Trade Debtors', 'Asset', 'AccountReceivable'], [6, '1-1400', 'Prepayments', 'Asset', 'OtherCurrentAsset'], [7, '1-2110', 'Office Equipment at Cost', 'Asset', 'FixedAsset'],
  [10, '2-0000', 'Liabilities', 'Liability', 'Liability', 1], [17, '2-1110', 'Business Credit Card', 'Liability', 'CreditCard'], [11, '2-1200', 'Trade Creditors', 'Liability', 'AccountsPayable'], [12, '2-1310', 'GST Collected', 'Liability', 'OtherCurrentLiability'],
  [13, '2-1330', 'GST Paid', 'Liability', 'OtherCurrentLiability'], [15, '2-1410', 'PAYG Withholding Payable', 'Liability', 'OtherCurrentLiability'], [16, '2-1420', 'Superannuation Payable', 'Liability', 'OtherCurrentLiability'],
  [14, '2-2100', 'Business Loan', 'Liability', 'LongTermLiability'],
  [20, '3-0000', 'Equity', 'Equity', 'Equity', 1], [21, '3-1000', "Owner's Capital", 'Equity', 'Equity'], [22, '3-8000', 'Retained Earnings', 'Equity', 'Equity'], [23, '3-9000', 'Current Year Earnings', 'Equity', 'Equity'],
  [30, '4-0000', 'Income', 'Income', 'Income', 1], [31, '4-1300', 'Professional Fees', 'Income', 'Income'], [32, '4-1400', 'Sales', 'Income', 'Income'],
  [35, '5-0000', 'Cost Of Sales', 'CostOfSales', 'CostOfSales', 1], [36, '5-1000', 'Purchases', 'CostOfSales', 'CostOfSales'],
  [40, '6-0000', 'Expenses', 'Expense', 'Expense', 1], [41, '6-1100', 'Advertising', 'Expense', 'Expense'], [42, '6-1430', 'Electricity & Gas', 'Expense', 'Expense'], [43, '6-2500', 'Bank Fees', 'Expense', 'Expense'],
  [44, '6-3020', 'Office Supplies', 'Expense', 'Expense'], [45, '6-4100', 'Rent', 'Expense', 'Expense'], [46, '6-4460', 'Telephone & Internet', 'Expense', 'Expense'], [47, '6-5130', 'Wages & Salaries', 'Expense', 'Expense'], [50, '6-5140', 'Superannuation', 'Expense', 'Expense'],
  [48, '8-1000', 'Interest Income', 'OtherIncome', 'OtherIncome'], [49, '9-1000', 'Interest Expense', 'OtherExpense', 'OtherExpense'],
];
const NORMAL_DR = { Asset: 1, Expense: 1, CostOfSales: 1, OtherExpense: 1 };
const CODES = [[901, 'GST', 'Goods & Services Tax', 'GST_VAT', 10], [902, 'FRE', 'GST Free', 'GST_VAT', 0], [903, 'CAP', 'Capital Acquisitions', 'GST_VAT', 10], [904, 'N-T', 'Not Reportable', 'GST_VAT', 0], [905, 'ITS', 'Input Taxed', 'InputTaxed', 0]];
const DEFAULT_CODE = { '6-5130': 'N-T', '6-5140': 'N-T', '6-2500': 'ITS', '8-1000': 'ITS', '9-1000': 'ITS', '1-2110': 'CAP' };
const codeRef = (cf, code) => { const c = CODES.find((x) => x[1] === code); return { UID: U(cf, c[0]), Code: code, URI: 'x' }; };
const chart = (cf) => CHART_DEF.map(([n, id, name, cls, type, hd]) => ({ UID: U(cf, n), DisplayID: id, Name: name, Classification: cls, Type: type, IsHeader: !!hd, IsActive: true, Level: hd ? 1 : 3, CurrentBalance: 0, OpeningBalance: 0,
  TaxCode: hd || !/^[124689]-|^5-/.test(id) || /^[12]-/.test(id) && id !== '1-2110' ? null : codeRef(cf, DEFAULT_CODE[id] || 'GST') }));
const TAX = { GST: 0.1, FRE: 0, 'N-T': 0, CAP: 0.1 };
const CUSTOMERS = ['Harbour Cafe Group', 'Bluegum Architects', 'Coastal Freight Co', 'Redwood Dental', 'Summit Legal', 'Parkside Physio', 'Eastside Motors', 'Lakeview Hotel'];
const SUPPLIERS = ['Metro Wholesale', 'SocialAds Pty Ltd', 'City Property Group', 'PowerDirect', 'TelcoOne', 'Office Hub Supplies'];

const BOOKS = {};
function books(cfIn) {
  const cf = FILES[cfIn] ? cfIn : CF1; if (BOOKS[cf]) return BOOKS[cf];
  const F = FILES[cf], rnd = prng(F.seed), S = F.scale, acc = {}; chart(cf).forEach((a) => { acc[a.DisplayID] = a; });
  const tx = [], invoices = [], bills = [], pays = [], spays = [];
  const contact = (name, kind, i) => ({ UID: U(cf, (kind === 'c' ? 1000 : 2000) + i), Name: name, DisplayID: (kind === 'c' ? 'CUS' : 'SUP') + String(i + 1).padStart(6, '0') });
  const line = (id, amount, isCredit, desc) => ({ Account: { UID: acc[id].UID, Name: acc[id].Name, DisplayID: id }, Amount: r2(amount), IsCredit: !!isCredit, Job: null, LineDescription: desc || '' });
  let jn = 0, invNo = 1000, billNo = 500, accPayg = 0, accSup = 0, card = 0;
  const post = (date, type, src, desc, lines) => tx.push({ UID: U(cf, 50000 + (++jn)), DisplayID: (type === 'General' ? 'GJ' : type.slice(0, 2).toUpperCase()) + String(jn).padStart(6, '0'), JournalType: type, SourceTransaction: src, DateOccurred: ISO(date), DatePosted: ISO(date), Description: desc, Lines: lines.filter((l) => Math.abs(l.Amount) >= 0.005) });
  // opening position on 30 Jun 2025: cash from the owner and a loan
  post('2025-06-30', 'General', { TransactionType: 'GeneralJournal' }, 'Opening balances', [line('1-1110', 18000 * S, false), line('1-1120', 9000 * S, false), line('3-1000', 15000 * S, true), line('2-2100', 12000 * S, true)]);
  // 15 months of trading: Jul 2025 → Sep 2026, plus a few documents dated after today
  for (let k = 0; k < 15; k++) {
    const y = 2025 + Math.floor((6 + k) / 12), m = (6 + k) % 12 + 1, last = +eom(y, m).slice(8), g = 1 + k * 0.02;
    const day = (lo, hi) => y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(lo + Math.floor(rnd() * (hi - lo + 1)), last)).padStart(2, '0');
    if (m % 3 === 1 && k) { // the BAS for the quarter just ended is lodged and paid on the 28th: GST collected and paid are cleared to the bank
      const qEnd = eom(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), gb = (id) => r2(tx.filter((t) => dateOf(t) <= qEnd).reduce((v, t) => v + t.Lines.filter((l) => l.Account.DisplayID === id).reduce((w, l) => w + (l.IsCredit ? l.Amount : -l.Amount), 0), 0));
      const col = gb('2-1310'), paid = -gb('2-1330'); post(day(28, 28), 'General', { TransactionType: 'GeneralJournal' }, 'BAS payment', [line('2-1310', col, false), line('2-1330', paid, true), line('1-1110', r2(col - paid), true)]);
    }
    for (let j = 0; j < 4; j++) { // sales invoices
      const ci = (k * 3 + j) % CUSTOMERS.length, date = day(1, 24), terms = j % 2 ? 14 : 30, prof = j === 1, code = j === 3 && k % 4 === 0 ? 'FRE' : 'GST';
      const sub = r2((900 + rnd() * 1500) * g * S), tax = r2(sub * TAX[code]), inv = { UID: U(cf, 10000 + (++invNo)), Number: String(invNo).padStart(8, '0'), Date: ISO(date), date, due: addDays(date, terms), Customer: contact(CUSTOMERS[ci], 'c', ci), Subtotal: sub, TotalTax: tax, TotalAmount: r2(sub + tax), account: prof ? '4-1300' : '4-1400', TaxCode: code, InvoiceType: 'Service', IsTaxInclusive: false };
      invoices.push(inv);
      post(date, 'Sale', { UID: inv.UID, TransactionType: 'SaleInvoice' }, 'Sale; ' + inv.Customer.Name, [line('1-1200', inv.TotalAmount, false), line(inv.account, sub, true), line('2-1310', tax, true)]);
      const late = Math.floor(rnd() * 25) - 5, pd = addDays(inv.due, late), open = (k === 12 && j === 2) || (k === 13 && j === 0) || (k >= 14 && j < 3);
      if (!open && pd <= TODAY) { const amt = (k === 13 && j === 3) ? r2(inv.TotalAmount / 2) : inv.TotalAmount; pays.push({ UID: U(cf, 20000 + pays.length), inv, date: pd, amount: amt, acct: '1-1110' }); }
    }
    const billOf = (si, id, net, code, dd, terms) => { const sub = r2(net * S), tax = r2(sub * TAX[code]), date = day(dd, dd + 3), b = { UID: U(cf, 30000 + (++billNo)), Number: String(billNo).padStart(8, '0'), Date: ISO(date), date, due: addDays(date, terms), Supplier: contact(SUPPLIERS[si], 's', si), Subtotal: sub, TotalTax: tax, TotalAmount: r2(sub + tax), account: id, TaxCode: code, BillType: 'Service', SupplierInvoiceNumber: 'S' + billNo };
      bills.push(b); post(date, 'Purchase', { UID: b.UID, TransactionType: 'Bill' }, 'Purchase; ' + b.Supplier.Name, [line(id, sub, false), line('2-1330', tax, false), line('2-1200', b.TotalAmount, true)]); return b; };
    const bl = [billOf(0, '5-1000', (700 + rnd() * 400) * g, 'GST', 3, 30), billOf(1, '6-1100', 180 + rnd() * 120, 'GST', 9, 14), billOf(2, '6-4100', 2200, 'GST', 1, 7), billOf(3, '6-1430', 260 + rnd() * 90, 'GST', 12, 14), billOf(4, '6-4460', 140 + rnd() * 40, 'GST', 15, 14)];
    if (k === 6) bl.push(billOf(5, '1-2110', 2400, 'CAP', 18, 30));
    bl.forEach((b, j) => { const pd = addDays(b.due, Math.floor(rnd() * 6) - 2), open = (k >= 14 && j < 2) || (k === 12 && j === 0); if (!open && pd <= TODAY) spays.push({ UID: U(cf, 40000 + spays.length), bill: b, date: pd, amount: b.TotalAmount, acct: '1-1110' }); });
    // spend / receive money: wages (no GST), bank fees, interest
    if (m % 3 === 1 && accPayg) { post(day(21, 21), 'CashPayment', { TransactionType: 'SpendMoney' }, 'PAYG withholding and super for the quarter', [line('2-1410', accPayg, false), line('2-1420', accSup, false), line('1-1110', r2(accPayg + accSup), true)]); accPayg = 0; accSup = 0; }
    const gross = r2(2300 * g * S), payg = r2(gross * 0.15), sup = r2(gross * 0.115); accPayg = r2(accPayg + payg); accSup = r2(accSup + sup);
    post(day(27, 27), 'CashPayment', { TransactionType: 'Paycheque' }, 'Pay run', [line('6-5130', gross, false), line('6-5140', sup, false), line('1-1110', r2(gross - payg), true), line('2-1410', payg, true), line('2-1420', sup, true)]);
    if (card) { post(day(5, 5), 'CashPayment', { TransactionType: 'SpendMoney' }, 'Credit card payment', [line('2-1110', card, false), line('1-1110', card, true)]); card = 0; }
    const cs = r2((80 + rnd() * 40) * S), ct = r2(cs * 0.1); card = r2(cs + ct); post(day(10, 10), 'CashPayment', { TransactionType: 'SpendMoney' }, 'Office supplies on the credit card', [line('6-3020', cs, false), line('2-1330', ct, false), line('2-1110', card, true)]);
    const fee = r2((18 + rnd() * 10) * S); post(day(28, 28), 'CashPayment', { TransactionType: 'SpendMoney' }, 'Bank fees', [line('6-2500', fee, false), line('1-1110', fee, true)]);
    const int = r2((20 + rnd() * 12) * S); post(day(28, 28), 'CashReceipt', { TransactionType: 'ReceiveMoney' }, 'Interest', [line('1-1120', int, false), line('8-1000', int, true)]);
    const ie = r2(60 * S); post(day(26, 26), 'CashPayment', { TransactionType: 'SpendMoney' }, 'Loan interest', [line('9-1000', ie, false), line('1-1110', ie, true)]);
  }
  // receipts and supplier payments
  pays.forEach((p) => post(p.date, 'CashReceipt', { UID: p.UID, TransactionType: 'CustomerPayment' }, 'Payment; ' + p.inv.Customer.Name, [line(p.acct, p.amount, false), line('1-1200', p.amount, true)]));
  spays.forEach((p) => post(p.date, 'CashPayment', { UID: p.UID, TransactionType: 'SupplierPayment' }, 'Payment; ' + p.bill.Supplier.Name, [line('2-1200', p.amount, false), line(p.acct, p.amount, true)]));
  // a general journal: prepaid insurance from the savings account
  post('2026-08-20', 'General', { TransactionType: 'GeneralJournal' }, 'Insurance prepaid', [line('1-1400', 1200 * S, false), line('1-1120', 1200 * S, true)]);
  tx.sort((a, b) => a.DateOccurred.localeCompare(b.DateOccurred));
  const B = { cf, F, acc, tx, invoices, bills, pays, spays };
  BOOKS[cf] = B; return B;
}
// ---------- derived ----------
const dateOf = (t) => t.DateOccurred.slice(0, 10);
// Debit-minus-credit movement per account over [a, b] (inclusive)
function movement(B, a, b) { const m = {}; B.tx.forEach((t) => { const d = dateOf(t); if (d < a || d > b) return; t.Lines.forEach((l) => { const id = l.Account.DisplayID; m[id] = r2((m[id] || 0) + (l.IsCredit ? -l.Amount : l.Amount)); }); }); return m; }
const natural = (B, id, drMinusCr) => r2(NORMAL_DR[B.acc[id].Classification] ? drMinusCr : -drMinusCr);
const PL = (cls) => /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/.test(cls);
function plByAccount(B, a, b, cash) {
  const out = {};
  if (!cash) { const m = movement(B, a, b); Object.keys(m).forEach((id) => { if (PL(B.acc[id].Classification)) out[id] = natural(B, id, m[id]); }); return out; }
  // cash basis: invoice and bill lines recognised pro rata on their payment dates; spend / receive money as it happens
  const add = (id, v) => { out[id] = r2((out[id] || 0) + v); };
  B.pays.filter((p) => p.date >= a && p.date <= b).forEach((p) => add(p.inv.account, p.amount / p.inv.TotalAmount * p.inv.Subtotal));
  B.spays.filter((p) => p.date >= a && p.date <= b).forEach((p) => { if (PL(B.acc[p.bill.account].Classification)) add(p.bill.account, p.amount / p.bill.TotalAmount * p.bill.Subtotal); });
  B.tx.filter((t) => (t.JournalType === 'CashPayment' || t.JournalType === 'CashReceipt') && !t.SourceTransaction.UID && dateOf(t) >= a && dateOf(t) <= b).forEach((t) => t.Lines.forEach((l) => { const id = l.Account.DisplayID; if (PL(B.acc[id].Classification)) add(id, natural(B, id, l.IsCredit ? -l.Amount : l.Amount)); }));
  Object.keys(out).forEach((k) => { out[k] = r2(out[k]); }); return out;
}
const netProfit = (B, a, b, cash) => { const p = plByAccount(B, a, b, cash); let n = 0; Object.keys(p).forEach((id) => { n += (/Income/.test(B.acc[id].Classification) ? 1 : -1) * p[id]; }); return r2(n); };
// Balance Sheet at date (accrual): balance accounts from all movement to date; Current Year Earnings = this FY's net profit;
// Retained Earnings = earlier years' profit (the file is rolled over each 1 July).
function balances(B, date) {
  const m = movement(B, '1900-01-01', date), out = {}, fy = fyStart(date);
  Object.keys(m).forEach((id) => { if (!PL(B.acc[id].Classification)) out[id] = natural(B, id, m[id]); });
  out['3-9000'] = netProfit(B, fy, date, false); out['3-8000'] = r2((out['3-8000'] || 0) + netProfit(B, '1900-01-01', addDays(fy, -1), false));
  return out;
}
const row = (B, id, total) => ({ AccountTotal: r2(total), Account: { UID: B.acc[id].UID, Name: B.acc[id].Name, DisplayID: id, URI: 'https://arl2.api.myob.com/accountright/' + B.cf + '/GeneralLedger/Account/' + B.acc[id].UID } });
const sortIds = (ids) => ids.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
// ---------- tool answers ----------
function profitAndLoss(p) { const B = books(p.myob_company_file_id), cash = p.reporting_basis === 'Cash', pl = plByAccount(B, p.from_date, p.to_date, cash);
  return { StartDate: ISO(p.from_date), EndDate: ISO(p.to_date, true), ReportingBasis: p.reporting_basis || 'Accrual', YearEndAdjust: false, AccountsBreakdown: sortIds(Object.keys(pl)).map((id) => row(B, id, pl[id])), URI: 'x' }; }
function balanceSheet(p) { const B = books(p.myob_company_file_id), bal = balances(B, p.date), ids = sortIds(Object.keys(bal));
  // MYOB's summary also lists the header accounts with their section totals; the kit skips headers by the chart
  const hdr = (hid, cls) => row(B, hid, ids.filter((id) => B.acc[id].Classification === cls).reduce((s, id) => s + bal[id], 0));
  return { AsOfDate: ISO(p.date), YearEndAdjust: false, AccountsBreakdown: [hdr('1-0000', 'Asset'), hdr('2-0000', 'Liability'), hdr('3-0000', 'Equity')].concat(ids.map((id) => row(B, id, bal[id]))), URI: 'x' }; }
function listAccounts(p) { const B = books(p && p.myob_company_file_id), bal = balances(B, TODAY), pl = plByAccount(B, fyStart(TODAY), TODAY, false);
  const list = chart(B.cf).map((a) => Object.assign(a, { CurrentBalance: a.IsHeader ? 0 : r2(bal[a.DisplayID] != null ? bal[a.DisplayID] : pl[a.DisplayID] || 0), LastReconciledDate: LAST_RECONCILED[a.DisplayID] ? LAST_RECONCILED[a.DisplayID] + "T00:00:00" : null })).filter((a) => (!p || !p.classification || a.Classification === p.classification) && (!p || !p.type || a.Type === p.type));
  return { Items: list, NextPageLink: null, Count: list.length }; }
const paidBy = (list, doc, date) => r2(list.filter((x) => (x.inv || x.bill) === doc && x.date <= date).reduce((a, x) => a + x.amount, 0));
function invoiceOut(B, i) { const due = r2(i.TotalAmount - paidBy(B.pays, i, TODAY)), last = B.pays.filter((x) => x.inv === i).map((x) => x.date).sort().pop();
  return { UID: i.UID, Number: i.Number, Date: i.Date, CustomerPurchaseOrderNumber: '', Customer: Object.assign({ URI: 'x' }, i.Customer), InvoiceType: i.InvoiceType, Status: due <= 0.004 ? 'Closed' : 'Open', Subtotal: i.Subtotal, TotalTax: i.TotalTax, TotalAmount: i.TotalAmount, BalanceDueAmount: Math.max(0, due), IsTaxInclusive: false, Terms: { PaymentIsDue: 'InAGivenNumberOfDays', DueDate: ISO(i.due), BalanceDueDate: 30 }, LastPaymentDate: last ? ISO(last) : null, URI: 'x' }; }
function billOut(B, b) { const due = r2(b.TotalAmount - paidBy(B.spays, b, TODAY)), last = B.spays.filter((x) => x.bill === b).map((x) => x.date).sort().pop();
  return { UID: b.UID, Number: b.Number, Date: b.Date, SupplierInvoiceNumber: b.SupplierInvoiceNumber, Supplier: Object.assign({ URI: 'x' }, b.Supplier), BillType: b.BillType, Status: due <= 0.004 ? 'Closed' : 'Open', Subtotal: b.Subtotal, TotalTax: b.TotalTax, TotalAmount: b.TotalAmount, BalanceDueAmount: Math.max(0, due), IsTaxInclusive: false, Terms: { PaymentIsDue: 'InAGivenNumberOfDays', DueDate: ISO(b.due), BalanceDueDate: 14 }, LastPaymentDate: last ? ISO(last) : null, URI: 'x' }; }
const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);
function listInvoices(p) { const B = books(p.myob_company_file_id); let l = B.invoices.filter((i) => inRange(i.date, p.from_date, p.to_date) && (!p.customer_uid || i.Customer.UID === p.customer_uid)).map((i) => invoiceOut(B, i)).filter((o) => !p.status || p.status === 'All' || o.Status === p.status);
  l.sort((a, b) => (p.order_desc === false ? 1 : -1) * a.Date.localeCompare(b.Date)); return { Count: l.length, Items: l }; }
function listBills(p) { const B = books(p.myob_company_file_id); let l = B.bills.filter((b) => inRange(b.date, p.from_date, p.to_date) && (!p.supplier_uid || b.Supplier.UID === p.supplier_uid)).map((b) => billOut(B, b)).filter((o) => !p.status || p.status === 'All' || o.Status === p.status);
  l.sort((a, b) => b.Date.localeCompare(a.Date)); return { Count: l.length, Items: l }; }
function listJournalTransactions(p) { const B = books(p.myob_company_file_id); const l = JSON.parse(JSON.stringify(B.tx.filter((t) => inRange(dateOf(t), p.from_date, p.to_date) && (!p.account_uid || t.Lines.some((x) => x.Account.UID === p.account_uid)))));
  l.forEach((t) => t.Lines.forEach((x) => { x.ReconciledDate = reconciledOn(x.Account.DisplayID, dateOf(t), t.Description); }));
  return { Count: l.length, Items: l }; }
// Bank reconciliation in the books: each bank account is reconciled at month end up to its last reconciled date; MYOB puts the
// reconciliation date on each journal line (null = not reconciled). July 2026's bank fees are left uncleared on the cheque account
// (an old unreconciled item); the credit card has never been reconciled.
const LAST_RECONCILED = { '1-1110': '2026-08-31', '1-1120': '2026-06-30', '2-1110': null };
function reconciledOn(id, date, desc) {
  if (!(id in LAST_RECONCILED)) return null;
  const last = LAST_RECONCILED[id]; if (!last || date > last) return null;
  if (id === '1-1110' && desc === 'Bank fees' && date.slice(0, 7) === '2026-07') return null;
  return eom(+date.slice(0, 4), +date.slice(5, 7)) + 'T00:00:00';
}
// The connector's own ageing (get_aged_receivables / get_aged_payables): today's open documents bucketed by days past due.
function aged(B, docs, partyKey, asOf) { const parties = {}, bt = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };
  docs.forEach((o) => { const dd = o.Terms.DueDate.slice(0, 10), od = Math.round((parse(asOf) - parse(dd)) / 86400000), k = od <= 0 ? 'current' : od <= 30 ? '1_30' : od <= 60 ? '31_60' : od <= 90 ? '61_90' : '90_plus', who = o[partyKey];
    if (!parties[who.UID]) parties[who.UID] = { uid: who.UID, name: who.Name, total: 0, bucket_totals: { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 }, items: [] };
    const P = parties[who.UID]; P.total = r2(P.total + o.BalanceDueAmount); P.bucket_totals[k] = r2(P.bucket_totals[k] + o.BalanceDueAmount); bt[k] = r2(bt[k] + o.BalanceDueAmount);
    P.items.push({ number: o.Number, due_date: dd, amount: o.BalanceDueAmount, days_overdue: Math.max(0, od), bucket: k }); });
  const list = Object.values(parties); return { as_of_date: asOf, party_count: list.length, grand_total: r2(list.reduce((s, x) => s + x.total, 0)), bucket_totals: bt, parties: list }; }
function agedReceivables(p) { const B = books(p.myob_company_file_id); return aged(B, B.invoices.map((i) => invoiceOut(B, i)).filter((o) => o.Status === 'Open'), 'Customer', p.report_date || TODAY); }
function agedPayables(p) { const B = books(p.myob_company_file_id); return aged(B, B.bills.map((b) => billOut(B, b)).filter((o) => o.Status === 'Open'), 'Supplier', p.report_date || TODAY); }
function listTaxCodes(p) { const B = books(p && p.myob_company_file_id), A = (id) => ({ UID: B.acc[id].UID, Name: B.acc[id].Name, DisplayID: id, URI: 'x' });
  const list = CODES.map(([n, code, desc, type, rate]) => ({ UID: U(B.cf, n), Code: code, Description: desc, Type: type, Rate: rate, IsRateNegative: false, TaxCollectedAccount: type === 'GST_VAT' && code !== 'N-T' ? A('2-1310') : null, TaxPaidAccount: type === 'GST_VAT' && code !== 'N-T' ? A('2-1330') : null, URI: 'x' }));
  return { Items: list, NextPageLink: null, Count: list.length }; }
// Report/TaxCodeSummary (MYOB's shape): per tax code, GST-inclusive sales and purchases totals and the tax on them. Accrual:
// invoices and bills dated in the period; cash: their amounts pro rata to payments in the period. Spend / receive money without a
// source document is coded by its account's default tax code (bank fees and interest input-taxed, wages N-T); a GST paid line makes
// it a GST purchase (the office supplies on the credit card).
function taxCodeSummary(p) {
  const B = books(p.myob_company_file_id), a = p.from_date, b = p.to_date, cash = p.reporting_basis === 'Cash', by = {};
  const add = (code, sale, amt, tax) => { const r = by[code] || (by[code] = { s: 0, p: 0, tc: 0, tp: 0 }); if (sale) { r.s += amt; r.tc += tax; } else { r.p += amt; r.tp += tax; } };
  if (!cash) {
    B.invoices.filter((i) => i.date >= a && i.date <= b).forEach((i) => add(i.TaxCode, true, i.TotalAmount, i.TotalTax));
    B.bills.filter((x) => x.date >= a && x.date <= b).forEach((x) => add(x.TaxCode, false, x.TotalAmount, x.TotalTax));
  } else {
    B.pays.filter((q) => q.date >= a && q.date <= b).forEach((q) => add(q.inv.TaxCode, true, q.amount, q.inv.TotalTax * q.amount / q.inv.TotalAmount));
    B.spays.filter((q) => q.date >= a && q.date <= b).forEach((q) => add(q.bill.TaxCode, false, q.amount, q.bill.TotalTax * q.amount / q.bill.TotalAmount));
  }
  B.tx.filter((t) => (t.JournalType === 'CashPayment' || t.JournalType === 'CashReceipt') && !t.SourceTransaction.UID && dateOf(t) >= a && dateOf(t) <= b).forEach((t) => {
    const g = t.Lines.find((l) => l.Account.DisplayID === '2-1330' && !l.IsCredit);
    t.Lines.forEach((l) => { const id = l.Account.DisplayID, cls = B.acc[id].Classification; if (!PL(cls)) return;
      const sale = /Income/.test(cls), code = g && !sale ? 'GST' : DEFAULT_CODE[id] || 'GST';
      add(code, sale, l.Amount + (g && !sale ? g.Amount : 0), g && !sale ? g.Amount : 0); });
  });
  const codes = CODES.map(([n, code, , , rate]) => ({ code, uid: U(B.cf, n), rate }));
  return { StartDate: ISO(a), EndDate: ISO(b, true), ReportingBasis: p.reporting_basis || 'Accrual', YearEndAdjust: false,
    TaxCodeBreakdown: Object.keys(by).sort().map((code) => { const r = by[code], tc = codes.find((c) => c.code === code) || {}; return { SalesTotal: r2(r.s), PurchasesTotal: r2(r.p), TaxCollected: r2(r.tc), TaxPaid: r2(r.tp), TaxRate: tc.rate || 0, TaxCode: { UID: tc.uid, Code: code, URI: 'x' } }; }), URI: 'x' };
}
// list_invoice_lines / list_bill_lines (the connector's flattened layout lines, mcp-servers #636): product sales (4-1400) are
// Item invoices with two item lines; professional fees (4-1300) and bills are Service documents with one line. Line totals exclude
// tax (every document is tax-exclusive), so they add up to the document's Subtotal.
const ITEMS = [['WID-100', 'Widget standard', 0.6, 40], ['WID-200', 'Widget deluxe', 0.4, 95]];
function docLines(B, list, contactKey, p, itemise) {
  const rows = [], docs = {}, cr = (x) => (x ? { UID: x.UID, Name: x.Name, DisplayID: x.DisplayID } : null);
  list.filter((d) => inRange(d.date, p.from_date, p.to_date) && (!p.status || p.status === 'All' || (contactKey === 'Customer' ? invoiceOut(B, d) : billOut(B, d)).Status === p.status)).forEach((d) => {
    const layout = itemise(d) ? 'Item' : 'Service', st = (contactKey === 'Customer' ? invoiceOut(B, d) : billOut(B, d)).Status; docs[layout] = (docs[layout] || 0) + 1;
    const head = { DocumentUID: d.UID, Number: d.Number, Date: d.Date, Layout: layout, Status: st, IsTaxInclusive: false, [contactKey]: cr(d[contactKey]) };
    const acc = { UID: B.acc[d.account].UID, DisplayID: d.account, Name: B.acc[d.account].Name }, tc = codeRef(B.cf, d.TaxCode);
    if (layout === 'Item') { let left = d.Subtotal; ITEMS.forEach(([num, name, share, price], k) => { const tot = k === ITEMS.length - 1 ? r2(left) : r2(d.Subtotal * share); left = r2(left - tot); const q = Math.max(1, Math.round(tot / price));
      rows.push(Object.assign({}, head, { RowID: k + 1, Type: 'Transaction', Description: name, Total: tot, TaxCode: { UID: tc.UID, Code: tc.Code }, Account: acc, Job: null, Item: { UID: U(B.cf, 700 + k), Number: num, Name: name }, Quantity: q, UnitPrice: r2(tot / q), DiscountPercent: 0 })); }); }
    else rows.push(Object.assign({}, head, { RowID: 1, Type: 'Transaction', Description: (contactKey === 'Customer' ? 'Services — ' : '') + acc.Name, Total: d.Subtotal, TaxCode: { UID: tc.UID, Code: tc.Code }, Account: acc, Job: null, Item: null, Quantity: null, UnitPrice: null, DiscountPercent: 0 }));
  });
  return { Count: rows.length, Items: rows, Truncated: false, Documents: docs };
}
function listItems(p) { const B = books(p && p.myob_company_file_id), list = ITEMS.map(([num, name, , price], k) => ({ UID: U(B.cf, 700 + k), Number: num, Name: name, IsActive: true, IsSold: true, AverageCost: r2(price * 0.55), BaseSellingPrice: price, URI: 'x' })); return { Items: list, NextPageLink: null, Count: list.length }; }
function listInvoiceLines(p) { const B = books(p.myob_company_file_id); return docLines(B, B.invoices, 'Customer', p, (d) => d.account === '4-1400'); }
function listBillLines(p) { const B = books(p.myob_company_file_id); return docLines(B, B.bills, 'Supplier', p, () => false); }
// list_payroll_advices (mcp-servers #636): each monthly pay run's journal split into two employees' paycheques (60 / 40), with the
// connector's pay runs rebuilt from them. Wages, tax and super add up to the run's journal, so they tie to the category summary.
const EMPLOYEES = [['Alex Morgan', 'EMP001', 0.6, 'AustralianSuper', 98], ['Sam Lee', 'EMP002', 0.4, 'Hostplus', 99]];
function listPayrollAdvices(p) {
  const B = books(p.myob_company_file_id), out = [];
  B.tx.filter((t) => t.SourceTransaction.TransactionType === 'Paycheque').forEach((t) => {
    const d = dateOf(t), ps = d.slice(0, 8) + '01', pe = eom(+d.slice(0, 4), +d.slice(5, 7)); if ((p.from_date && ps < p.from_date) || (p.to_date && pe > p.to_date)) return;
    const amt = (id, credit) => t.Lines.filter((l) => l.Account.DisplayID === id && l.IsCredit === credit).reduce((s, l) => s + l.Amount, 0), gross = amt('6-5130', false), payg = amt('2-1410', true), sup = amt('6-5140', false);
    let lg = gross, lt = payg, ls = sup;
    EMPLOYEES.forEach(([name, id, share, fund, n], k) => { const last = k === EMPLOYEES.length - 1, g = last ? r2(lg) : r2(gross * share), tx = last ? r2(lt) : r2(payg * share), s = last ? r2(ls) : r2(sup * share); lg -= g; lt -= tx; ls -= s;
      out.push({ Employer: { CompanyName: B.F.Name }, Employee: { UID: U(B.cf, 800 + k), Name: name, DisplayID: id }, PayPeriodStartDate: ps + 'T00:00:00', PayPeriodEndDate: pe + 'T00:00:00', PaymentDate: d + 'T00:00:00', PayFrequency: 'Monthly',
        GrossPay: g, NetPay: r2(g - tx), SuperannuationFund: { UID: U(B.cf, 900 + n), Name: fund }, Lines: [{ PayrollCategory: { Name: 'Base Salary', Type: 'Wage' }, Hours: Math.round(152 * share), Amount: g }, { PayrollCategory: { Name: 'PAYG Withholding', Type: 'Tax' }, Hours: 0, Amount: tx }, { PayrollCategory: { Name: 'Superannuation Guarantee', Type: 'Superannuation' }, Hours: 0, Amount: s }] }); });
  });
  const runs = {}; out.forEach((a) => { const k = a.PaymentDate; const r = runs[k] || (runs[k] = { PaymentDate: a.PaymentDate, PayPeriodStartDate: a.PayPeriodStartDate, PayPeriodEndDate: a.PayPeriodEndDate, Employees: 0, GrossPay: 0, NetPay: 0, Tax: 0, Superannuation: 0, Deductions: 0, Hours: 0 }); r.Employees++; r.GrossPay = r2(r.GrossPay + a.GrossPay); r.NetPay = r2(r.NetPay + a.NetPay); r.Tax = r2(r.Tax + a.Lines[1].Amount); r.Superannuation = r2(r.Superannuation + a.Lines[2].Amount); r.Hours += a.Lines[0].Hours; });
  return { Count: out.length, PayRuns: Object.values(runs), Items: out };
}
// Report/PayrollCategorySummary: the pay runs in the period (Wage = gross, Tax = PAYG withheld, Superannuation = super)
function payrollCategorySummary(p) {
  const B = books(p.myob_company_file_id), runs = B.tx.filter((t) => t.SourceTransaction.TransactionType === 'Paycheque' && dateOf(t) >= p.from_date && dateOf(t) <= p.to_date);
  const tot = (id, credit) => r2(runs.reduce((s, t) => s + t.Lines.filter((l) => l.Account.DisplayID === id && l.IsCredit === credit).reduce((w, l) => w + l.Amount, 0), 0));
  const cat = (n, name, type, amount) => ({ Amount: amount, Hours: 0, PayrollCategory: { UID: U(B.cf, n), Name: name, Type: type, URI: 'x' } });
  return { StartDate: ISO(p.from_date), EndDate: ISO(p.to_date, true), ReportingBasis: p.reporting_basis || 'Accrual', YearEndAdjust: false,
    PayrollCategoryBreakdown: runs.length ? [cat(951, 'Base Salary', 'Wage', tot('6-5130', false)), cat(952, 'PAYG Withholding', 'Tax', tot('2-1410', true)), cat(953, 'Superannuation Guarantee', 'Superannuation', tot('6-5140', false))] : [], URI: 'x' };
}
function companyFiles() { return [CF1, CF2].map((id) => ({ Id: id, Name: FILES[id].Name, Country: FILES[id].Country, Uri: 'https://arl2.api.myob.com/accountright/' + id, ProductVersion: '2026.9' })); }
// Contacts (/Contact, every type): MYOB's generic list has no addresses, but some files return them — a few customers carry an email and
// phone; the employee's are personal and must never show. CurrentBalance = the open invoices (customers) or bills (suppliers) today.
function listContacts(p) {
  const cf = (p && p.myob_company_file_id) || CF1, owed = {};
  listInvoices({ myob_company_file_id: cf, status: 'Open' }).Items.forEach((i) => { owed[i.Customer.UID] = r2((owed[i.Customer.UID] || 0) + i.BalanceDueAmount); });
  listBills({ myob_company_file_id: cf, status: 'Open' }).Items.forEach((b) => { owed[b.Supplier.UID] = r2((owed[b.Supplier.UID] || 0) + b.BalanceDueAmount); });
  const co = (uid, name, type, id, extra) => Object.assign({ UID: uid, CompanyName: name, FirstName: null, LastName: null, IsIndividual: false, DisplayID: id, IsActive: true, Type: type, CurrentBalance: owed[uid] || 0, LastModified: TODAY + 'T09:00:00', URI: 'https://arl2.api.myob.com/accountright/' + cf + '/Contact/' + uid }, extra || {});
  const site = (n) => n.toLowerCase().replace(/[^a-z]+/g, '');
  let list = CUSTOMERS.map((n, i) => co(U(cf, 1000 + i), n, 'Customer', 'CUS' + String(i + 1).padStart(6, '0'), i < 3 ? { Addresses: [{ Location: 1, Email: 'accounts@' + site(n) + '.com.au', Phone1: '02 9000 00' + String(i + 1).padStart(2, '0') }] } : null))
    .concat([co(U(cf, 1100), null, 'Customer', 'CUS000100', { FirstName: 'Jamie', LastName: 'Nguyen', IsIndividual: true })])
    .concat(SUPPLIERS.map((n, i) => co(U(cf, 2000 + i), n, 'Supplier', 'SUP' + String(i + 1).padStart(6, '0'))))
    .concat([co(U(cf, 2100), 'Old Printing Co', 'Supplier', 'SUP000100', { IsActive: false }), co(U(cf, 3000), null, 'Employee', 'EMP000001', { FirstName: 'Alex', LastName: 'Morgan', IsIndividual: true, CurrentBalance: 0, Addresses: [{ Location: 1, Email: 'alex.morgan@home.example', Phone1: '0400 000 000', Street: '1 Home St' }] })]);
  if (p && p.type && p.type !== 'All') list = list.filter((x) => x.Type === p.type);
  if (p && p.is_active != null) list = list.filter((x) => x.IsActive === p.is_active);
  list = list.slice(0, (p && p.page_size) || 100);
  return { Items: list, NextPageLink: null, Count: list.length };
}
// Customer payments (Sale/CustomerPayment) and supplier payments (Purchase/SupplierPayment), from the books' receipts and payments.
const accRef = (B, id) => ({ UID: B.acc[id].UID, Name: B.acc[id].Name, DisplayID: id });
function listPayments(p) { const B = books(p && p.myob_company_file_id);
  let l = B.pays.filter((x) => inRange(x.date, p.from_date, p.to_date) && (!p.contact_uid || x.inv.Customer.UID === p.contact_uid)).map((x, i) => ({ UID: x.UID, ReceiptNumber: 'CR' + String(B.pays.indexOf(x) + 1).padStart(6, '0'), Date: ISO(x.date), Customer: Object.assign({ URI: 'x' }, x.inv.Customer), Account: accRef(B, x.acct), AmountReceived: x.amount, Memo: 'Payment; ' + x.inv.Customer.Name, Invoices: [{ UID: x.inv.UID, Number: x.inv.Number, AmountApplied: x.amount, Type: 'Invoice' }] }));
  l = l.slice(0, (p && p.page_size) || 100); return { Items: l, NextPageLink: null, Count: l.length }; }
function listSupplierPayments(p) { const B = books(p && p.myob_company_file_id);
  let l = B.spays.filter((x) => inRange(x.date, p.from_date, p.to_date) && (!p.supplier_uid || x.bill.Supplier.UID === p.supplier_uid)).map((x) => ({ UID: x.UID, PaymentNumber: 'CP' + String(B.spays.indexOf(x) + 1).padStart(6, '0'), Date: ISO(x.date), Supplier: Object.assign({ URI: 'x' }, x.bill.Supplier), Account: accRef(B, x.acct), AmountPaid: x.amount, Memo: 'Payment; ' + x.bill.Supplier.Name, Lines: [{ Type: 'Bill', Purchase: { UID: x.bill.UID, Number: x.bill.Number }, AmountApplied: x.amount }] }));
  l = l.slice(0, (p && p.page_size) || 100); return { Items: l, NextPageLink: null, Count: l.length }; }
// Bank-feed statement lines (Banking/Statement) for the bank and credit-card accounts: every journal line on them is a Coded line
// (IsCredit = money in = a debit in the ledger); the last days' feed also has Uncoded lines that are not in the ledger yet, and one
// Hidden duplicate.
const FEED = ['1-1110', '1-1120', '2-1110'];
function statementLines(B) {
  if (B.feed) return B.feed;
  const out = [];
  B.tx.forEach((t) => t.Lines.forEach((l, i) => { if (FEED.includes(l.Account.DisplayID)) out.push({ UID: t.UID.slice(0, -4) + 'f' + String(i).padStart(3, '0'), Date: t.DateOccurred, Description: t.Description, Account: accRef(B, l.Account.DisplayID), Amount: l.Amount, IsCredit: !l.IsCredit, Status: 'Coded', Reference: t.DisplayID }); }));
  const S = B.F.scale, u = (n) => U(B.cf, 90000 + n);
  out.push({ UID: u(1), Date: ISO('2026-09-24'), Description: 'EFTPOS SQUARE *HARBOUR CAFE', Account: accRef(B, '1-1110'), Amount: r2(47.5 * S), IsCredit: false, Status: 'Uncoded', Reference: '' });
  out.push({ UID: u(2), Date: ISO('2026-09-25'), Description: 'TRANSFER FROM BLUEGUM ARCHITECTS', Account: accRef(B, '1-1110'), Amount: r2(1250 * S), IsCredit: true, Status: 'Uncoded', Reference: '' });
  out.push({ UID: u(3), Date: ISO('2026-09-26'), Description: 'ADOBE CREATIVE CLOUD', Account: accRef(B, '2-1110'), Amount: r2(32.99 * S), IsCredit: false, Status: 'Uncoded', Reference: '' });
  out.push({ UID: u(4), Date: ISO('2026-09-12'), Description: 'DUPLICATE FEED LINE', Account: accRef(B, '1-1110'), Amount: r2(19.9 * S), IsCredit: false, Status: 'Hidden', Reference: '' });
  out.sort((a, b) => a.Date.localeCompare(b.Date)); B.feed = out; return out;
}
function listBankStatementLines(p) { const B = books(p && p.myob_company_file_id);
  const l = statementLines(B).filter((x) => inRange(x.Date.slice(0, 10), p.from_date, p.to_date) && (!p.account_uid || x.Account.UID === p.account_uid) && (!p.status || p.status === 'All' || x.Status === p.status));
  return { Items: l.map((x) => Object.assign({}, x)), NextPageLink: null, Count: l.length }; }
// Timesheets (Payroll/TimeSheet): one per employee per week (Monday–Sunday), lines by payroll category with an optional job or
// customer, daily entries; weeks ending after 20 Sep 2026 are not yet processed. The connector keeps sheets overlapping the range.
function listTimesheets(p) {
  const B = books(p && p.myob_company_file_id), out = [];
  for (let wk = '2026-06-29'; wk <= '2026-09-28'; wk = addDays(wk, 7)) EMPLOYEES.forEach(([name, id], k) => {
    const end = addDays(wk, 6), days = k === 0 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3], hrs = k === 0 ? 7.6 : 4, done = end <= '2026-09-20';
    const entries = (ds, h) => ds.map((d) => ({ Date: addDays(wk, d) + 'T00:00:00', Hours: h, Processed: done }));
    const lines = k === 0
      ? [{ PayrollCategory: { UID: U(B.cf, 960), Name: 'Base Hourly' }, Job: null, Activity: null, Customer: null, Notes: '', Entries: entries([0, 1, 2], hrs) },
         { PayrollCategory: { UID: U(B.cf, 960), Name: 'Base Hourly' }, Job: { UID: U(B.cf, 970), Number: 'J100', Name: 'Bluegum fit-out' }, Activity: null, Customer: { UID: U(B.cf, 1001), Name: 'Bluegum Architects' }, Notes: 'On site', Entries: entries([3, 4], hrs) }]
      : [{ PayrollCategory: { UID: U(B.cf, 960), Name: 'Base Hourly' }, Job: null, Activity: null, Customer: null, Notes: '', Entries: entries(days, hrs) }];
    out.push({ Employee: { UID: U(B.cf, 800 + k), Name: name, DisplayID: id }, StartDate: wk + 'T00:00:00', EndDate: end + 'T00:00:00', Lines: lines });
  });
  const l = out.filter((t) => (!p.employee_uid || t.Employee.UID === p.employee_uid) && (!p.to_date || t.StartDate.slice(0, 10) <= p.to_date) && (!p.from_date || t.EndDate.slice(0, 10) >= p.from_date));
  return { Count: l.length, Items: l };
}
// Leave balances (Contact/EmployeePayrollDetails entitlements, as the connector returns them): Total = CarryOver + YearToDate.
function listEmployeeLeaveBalances(p) {
  const B = books(p && p.myob_company_file_id), ent = (n, name, co, ytd, assigned) => ({ UID: U(B.cf, n), Name: name, IsAssigned: assigned !== false, CarryOver: co, YearToDate: ytd, Total: r2(co + ytd) });
  const all = [
    { Employee: { UID: U(B.cf, 800), Name: 'Alex Morgan', DisplayID: 'EMP001' }, EmploymentStatus: 'FullTime', StartDate: '2023-02-06T00:00:00', TerminationDate: null, PayBasis: 'Hourly', HourlyRate: 45, PayFrequency: 'Monthly',
      Entitlements: [ent(981, 'Holiday Leave Accrual', 76, 38.5), ent(982, 'Personal Leave Accrual', 30.4, 18.2), ent(983, 'Long Service Leave', 0, 0, false)] },
    { Employee: { UID: U(B.cf, 801), Name: 'Sam Lee', DisplayID: 'EMP002' }, EmploymentStatus: 'PartTime', StartDate: '2025-03-10T00:00:00', TerminationDate: null, PayBasis: 'Hourly', HourlyRate: 38, PayFrequency: 'Monthly',
      Entitlements: [ent(981, 'Holiday Leave Accrual', 20, 12.25), ent(982, 'Personal Leave Accrual', 10, -12.5)] },
    { Employee: { UID: U(B.cf, 802), Name: 'Jo Park', DisplayID: 'EMP003' }, EmploymentStatus: 'Casual', StartDate: '2024-01-15T00:00:00', TerminationDate: '2026-03-31T00:00:00', PayBasis: 'Hourly', HourlyRate: 32, PayFrequency: 'Monthly',
      Entitlements: [ent(981, 'Holiday Leave Accrual', 0, 0)] }];
  const l = all.filter((x) => (!p.employee_uid || x.Employee.UID === p.employee_uid) && (p.include_terminated || !x.TerminationDate));
  return { Count: l.length, Items: JSON.parse(JSON.stringify(l)) };
}
// expected figures computed independently of the MYOB JSON (for assertions)
const expect = { balances: (date, cf) => balances(books(cf), date), plByAccount: (a, b, cash, cf) => plByAccount(books(cf), a, b, cash), netProfit: (a, b, cash, cf) => netProfit(books(cf), a, b, cash), movement: (a, b, cf) => movement(books(cf), a, b), books, invoiceOut: (i, cf) => invoiceOut(books(cf), i), billOut: (b, cf) => billOut(books(cf), b) };
module.exports = { TODAY, CF1, CF2, FILES, U, profitAndLoss, balanceSheet, listAccounts, listInvoices, listBills, listContacts, listPayments, listSupplierPayments, listBankStatementLines, listTimesheets, listEmployeeLeaveBalances, listJournalTransactions, listTaxCodes, taxCodeSummary, payrollCategorySummary, listInvoiceLines, listBillLines, listItems, listPayrollAdvices, agedReceivables, agedPayables, companyFiles, expect, fyStart, addDays, eom, r2 };

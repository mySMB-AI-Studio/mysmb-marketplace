// Taxable payments fixtures (M14), MYOB-shaped and consistent with each other, for the financial year 1 July 2025 – 30 June 2026:
// supplier cards (ABN, set up for taxable payments or not), bills (each with its own IsReportable flag), the supplier payments that
// settle them, spend money transactions, and the journal transactions MYOB posts for those payments (the independent tie).
// The main ledger (ledger.js) pays no contractors, so the TPAR report is tested on these.
const L = require('./ledger.js');
const CF = L.CF1, U = (n) => L.U(CF, n), r2 = (n) => Math.round(n * 100) / 100, T = (d) => d + 'T00:00:00';
const BANK = { UID: U(2), Name: 'Business Bank Account #1', DisplayID: '1-1110' }, AP = { UID: U(11), Name: 'Trade Creditors', DisplayID: '2-1200' };
// [n, display ID, company or [first, last], ABN, set up for taxable payments]
const CARDS = [[3001, 'SUP000101', 'Sparky Electrical Pty Ltd', '51 824 753 556', true], [3002, 'SUP000102', ['Jo', 'Smith'], '53 004 085 616', true],
  [3003, 'SUP000103', 'Quick Couriers', '53 004 742 893', true], [3004, 'SUP000001', 'Metro Wholesale', '53 006 009 933', false], [3005, 'SUP000006', 'Office Hub Supplies', null, false]];
const SUP = CARDS.map(([n, id, nm, abn, rep]) => ({ UID: U(n), DisplayID: id, Name: Array.isArray(nm) ? nm.join(' ') : nm, CompanyName: Array.isArray(nm) ? null : nm, FirstName: Array.isArray(nm) ? nm[0] : null, LastName: Array.isArray(nm) ? nm[1] : null,
  IsIndividual: Array.isArray(nm), IsActive: true, ABN: abn, ABNBranch: null, IsReportable: rep, ExpenseAccount: null, TaxCode: { UID: U(901), Code: 'GST' } }));
const ref = (k) => ({ UID: SUP[k].UID, Name: SUP[k].Name, DisplayID: SUP[k].DisplayID });
// bills: [n, number, date, supplier, total incl. GST, reportable flag on the bill]
const BILLS = [[4001, 'B1001', '2025-06-20', 0, 1100, true], [4002, 'B1002', '2025-11-05', 0, 2200, true], [4003, 'B1003', '2026-06-25', 0, 550, true],
  [4004, 'B1004', '2025-09-01', 3, 3300, false], [4005, 'B1005', '2026-02-10', 2, 440, true], [4006, 'B1006', '2026-01-15', 0, 330, false]];
const bill = (n) => BILLS.find((b) => b[0] === n);
// supplier payments: [n, number, date, [[bill n, amount applied]]]
const PAYS = [[5001, 'CP1001', '2025-07-10', [[4001, 1100]]], [5002, 'CP1002', '2025-12-01', [[4002, 2200]]], [5003, 'CP1003', '2026-07-05', [[4003, 550]]],
  [5004, 'CP1004', '2025-10-01', [[4004, 3300]]], [5005, 'CP1005', '2026-03-01', [[4005, 240]]], [5006, 'CP1006', '2026-04-01', [[4005, 200]]], [5007, 'CP1007', '2026-02-01', [[4006, 330]]]];
// spend money: [n, number, date, payee (supplier index, 'personal' or null), amount incl. GST, GST, expense account, memo]
const SPEND = [[6001, 'CS2001', '2025-08-15', 1, 660, 60, ['6-3400', 'Cleaning'], 'Office clean — August'], [6002, 'CS2002', '2026-05-20', 1, 660, 60, ['6-3400', 'Cleaning'], 'Office clean — May'],
  [6003, 'CS2003', '2026-03-10', null, 25, 0, ['6-2500', 'Bank Fees'], 'Bank fees'], [6004, 'CS2004', '2025-10-10', 4, 110, 10, ['6-3020', 'Office Supplies'], 'Stationery'],
  [6005, 'CS2005', '2026-01-20', 'personal', 500, 0, ['3-2000', "Owner's Drawings"], 'Drawings']];
const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);
function listSuppliers(p) { const l = SUP.filter((s) => !(p && p.reportable_only) || s.IsReportable); return { Count: l.length, Items: JSON.parse(JSON.stringify(l)) }; }
function listBills(p) { const l = BILLS.filter((b) => inRange(b[2], p.from_date, p.to_date)).map(([n, num, d, s, tot, rep]) => { const tax = r2(tot / 11), paid = PAYS.reduce((a, x) => a + x[3].filter((y) => y[0] === n).reduce((q, y) => q + y[1], 0), 0);
  return { UID: U(n), Number: num, Date: T(d), Supplier: ref(s), IsTaxInclusive: true, IsReportable: rep, Subtotal: r2(tot - tax), TotalTax: tax, TotalAmount: tot, BalanceDueAmount: r2(tot - paid), Status: tot - paid <= 0.004 ? 'Closed' : 'Open', BillType: 'Service', URI: 'x' }; });
  return { Count: l.length, Items: l }; }
function listSupplierPayments(p) { const l = PAYS.filter((x) => inRange(x[2], p.from_date, p.to_date)).map(([n, num, d, ls]) => ({ UID: U(n), PaymentNumber: num, Date: T(d), Supplier: ref(bill(ls[0][0])[3]), Account: BANK, PayFrom: 'Account',
  AmountPaid: r2(ls.reduce((a, y) => a + y[1], 0)), Memo: 'Payment', Lines: ls.map(([b, amt], i) => ({ RowID: i + 1, Type: 'Bill', Purchase: { UID: U(b), Number: bill(b)[1] }, AmountApplied: amt })) })).slice(0, (p && p.page_size) || 100);
  return { Count: l.length, Items: l }; }
function listSpendMoney(p) { const l = SPEND.filter((x) => inRange(x[2], p.from_date, p.to_date)).map(([n, num, d, who, amt, gst, acc, memo]) => ({ UID: U(n), PaymentNumber: num, Date: T(d), PayFrom: 'Account', Account: BANK,
  Contact: who === null ? null : who === 'personal' ? { UID: U(3999), Name: 'Alex Owner', DisplayID: '*None', Type: 'Personal' } : Object.assign(ref(who), { Type: 'Supplier' }),
  AmountPaid: amt, IsTaxInclusive: true, TotalTax: gst, Memo: memo, IsReportable: null, Lines: [{ RowID: 1, Account: { UID: U(7000 + n % 100), DisplayID: acc[0], Name: acc[1] }, Job: null, TaxCode: { UID: U(901), Code: gst ? 'GST' : 'FRE' }, Amount: amt, Memo: memo }] }));
  return { Count: l.length, Items: l }; }
// the journals MYOB posts for those payments (and a sale, which the tie leaves alone)
function listJournalTransactions(p) { const j = [];
  PAYS.forEach(([n, num, d, ls]) => { const amt = r2(ls.reduce((a, y) => a + y[1], 0)); j.push({ UID: U(n + 10000), DisplayID: num, JournalType: 'CashPayment', SourceTransaction: { UID: U(n), TransactionType: 'SupplierPayment' }, DateOccurred: T(d), Description: 'Payment', Lines: [{ Account: AP, Amount: amt, IsCredit: false, Job: null }, { Account: BANK, Amount: amt, IsCredit: true, Job: null }] }); });
  SPEND.forEach(([n, num, d, , amt]) => { j.push({ UID: U(n + 10000), DisplayID: num, JournalType: 'CashPayment', SourceTransaction: { UID: U(n), TransactionType: 'SpendMoney' }, DateOccurred: T(d), Description: 'Spend money', Lines: [{ Account: { UID: U(7001), DisplayID: '6-3400', Name: 'Cleaning' }, Amount: amt, IsCredit: false, Job: null }, { Account: BANK, Amount: amt, IsCredit: true, Job: null }] }); });
  j.push({ UID: U(19999), DisplayID: 'SA9001', JournalType: 'Sale', SourceTransaction: { UID: U(9001), TransactionType: 'SaleInvoice' }, DateOccurred: T('2025-09-09'), Description: 'Sale', Lines: [{ Account: { UID: U(5), DisplayID: '1-1200', Name: 'Trade Debtors' }, Amount: 990, IsCredit: false, Job: null }, { Account: { UID: U(32), DisplayID: '4-1400', Name: 'Sales' }, Amount: 990, IsCredit: true, Job: null }] });
  const l = j.filter((t) => inRange(t.DateOccurred.slice(0, 10), p.from_date, p.to_date)); return { Count: l.length, Items: l }; }
module.exports = { SUP, listSuppliers, listBills, listSupplierPayments, listSpendMoney, listJournalTransactions, companyFiles: L.companyFiles };

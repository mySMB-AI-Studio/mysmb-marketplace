// One set of AU GST books (Jan–Sep 2026) from which every QuickBooks response for CRA-05 / CRA-07 is derived: the transaction
// entities (Invoice, CreditMemo, SalesReceipt, Bill, VendorCredit, Purchase, JournalEntry) in the QuickBooks Online Accounting
// API v3 entity shape (Line[].…LineDetail.TaxCodeRef, TxnTaxDetail.TaxLine[].TaxLineDetail {TaxRateRef, TaxPercent, NetAmountTaxable}),
// TaxCode with Sales/PurchaseTaxRateList, Item with Income/ExpenseAccountRef, the TaxSummary (BAS labels, as the QuickBooks kit's
// fixture models it) and a monthly Balance Sheet whose GST account moves with net GST less payments to the ATO.
// NOTE: these entity tax fields follow Intuit's published schema; no live QuickBooks recording of them exists yet (verify on QA).
const F = require('../../quickbooks-reporting-kit/fixtures.js');
const r2 = (n) => Math.round(n * 100) / 100;
const Q = (entity, list) => ({ QueryResponse: { [entity]: list, startPosition: 1, maxResults: list.length }, time: '2026-09-25T10:52:00+08:00' });
const RATES = { 20: ['GST (sales)', 10, 'S', '10'], 21: ['GST (purchases)', 10, 'P', '10'], 22: ['GST free (sales)', 0, 'S', '11'], 23: ['GST free (purchases)', 0, 'P', '11'], 24: ['GST on capital', 10, 'P', '12'] };
const CODES = [{ Id: '10', Name: 'GST', Description: 'GST 10%', s: ['20'], p: ['21'] }, { Id: '11', Name: 'FRE', Description: 'GST free', s: ['22'], p: ['23'] }, { Id: '12', Name: 'CAP', Description: 'Capital purchases', s: [], p: ['24'] }];
const taxCodes = () => Q('TaxCode', CODES.map((c) => ({ Id: c.Id, Name: c.Name, Description: c.Description, Active: true, Taxable: true,
  SalesTaxRateList: { TaxRateDetail: c.s.map((r) => ({ TaxRateRef: { value: r, name: RATES[r][0] }, TaxTypeApplicable: 'TaxOnAmount', TaxOrder: 0 })) },
  PurchaseTaxRateList: { TaxRateDetail: c.p.map((r) => ({ TaxRateRef: { value: r, name: RATES[r][0] }, TaxTypeApplicable: 'TaxOnAmount', TaxOrder: 0 })) } })));
const ITEMS = { 1: ['Consulting', 'Consulting income', null], 2: ['Training', 'Training income', null], 3: ['Stationery', null, 'Office expenses'] };
const items = () => Q('Item', Object.keys(ITEMS).map((id) => Object.assign({ Id: id, Name: ITEMS[id][0], Type: 'Service', Active: true },
  ITEMS[id][1] ? { IncomeAccountRef: { value: '4' + id, name: ITEMS[id][1] } } : {}, ITEMS[id][2] ? { ExpenseAccountRef: { value: '6' + id, name: ITEMS[id][2] } } : {})));
const RATE_OF_CODE = { S: { 10: '20', 11: '22' }, P: { 10: '21', 11: '23', 12: '24' } };
// lines: [kind 'item'|'acct', ref, code, net]; side S/P
function doc(entity, id, date, who, lines, side, extra) {
  const L = lines.map(([k, ref, code, net], i) => {
    const det = { TaxCodeRef: { value: code } };
    if (k === 'item' && side === 'S') det.ItemRef = { value: ref, name: ITEMS[ref][0] };
    if (k === 'item' && side === 'P') det.ItemRef = { value: ref, name: ITEMS[ref][0] };
    if (k === 'acct') det.AccountRef = { value: '6' + i, name: ref };
    const dt = side === 'S' ? 'SalesItemLineDetail' : k === 'item' ? 'ItemBasedExpenseLineDetail' : 'AccountBasedExpenseLineDetail';
    return { Id: String(i + 1), LineNum: i + 1, Amount: net, DetailType: dt, [dt]: det };
  });
  const byRate = {};
  lines.forEach(([, , code, net]) => { const r = RATE_OF_CODE[side][code]; byRate[r] = r2((byRate[r] || 0) + net); });
  const TaxLine = Object.keys(byRate).map((r) => ({ Amount: r2(byRate[r] * RATES[r][1] / 100), DetailType: 'TaxLineDetail', TaxLineDetail: { TaxRateRef: { value: r }, PercentBased: true, TaxPercent: RATES[r][1], NetAmountTaxable: byRate[r] } }));
  const tax = r2(TaxLine.reduce((s, t) => s + t.Amount, 0)), net = r2(lines.reduce((s, l) => s + l[3], 0));
  L.push({ Amount: net, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} });
  const ref = side === 'S' ? { CustomerRef: { value: '5', name: who } } : entity === 'Purchase' ? { EntityRef: { value: '7', name: who, type: 'Vendor' } } : { VendorRef: { value: '7', name: who } };
  return Object.assign({ Id: id, DocNumber: id, TxnDate: date, GlobalTaxCalculation: 'TaxExcluded', Line: L, TxnTaxDetail: { TotalTax: tax, TaxLine }, TotalAmt: r2(net + tax), Balance: 0 }, ref, extra || {});
}
function je(id, date, acct, amt, tax) {
  return { Id: id, DocNumber: id, TxnDate: date, Line: [
    { Id: '1', Amount: amt, DetailType: 'JournalEntryLineDetail', JournalEntryLineDetail: { PostingType: 'Debit', AccountRef: { value: '61', name: acct }, TaxCodeRef: { value: '10' }, TaxApplicableOn: 'Purchase', TaxAmount: tax } },
    { Id: '2', Amount: r2(amt + tax), DetailType: 'JournalEntryLineDetail', JournalEntryLineDetail: { PostingType: 'Credit', AccountRef: { value: '80', name: 'Accrued liabilities' } } }] };
}
const BOOKS = (() => {
  const E = { Invoice: [], CreditMemo: [], SalesReceipt: [], Bill: [], VendorCredit: [], Purchase: [], JournalEntry: [] };
  for (let m = 1; m <= 9; m++) {
    const d = (day) => '2026-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    E.Invoice.push(doc('Invoice', 'INV-' + m, d(5), 'Civica Pty Ltd', [['item', '1', '10', 10000 + 100 * m], ['item', '2', '11', 2000]], 'S', m === 6 || m === 9 ? { Balance: 1 } : {}));
    E.Bill.push(doc('Bill', 'BILL-' + m, d(10), 'Office Supplies Co', [['acct', 'Office expenses', '10', 3000 + 50 * m], ['item', '3', '10', 250]], 'P'));
    E.Purchase.push(doc('Purchase', 'EXP-' + m, d(12), 'AWS', [['acct', 'Hosting', '10', 1500]].concat(m === 5 ? [['acct', 'Computer equipment', '12', 4000]] : []), 'P', { PaymentType: 'CreditCard', AccountRef: { value: '42', name: 'Amex' } }));
    if (m % 2) E.SalesReceipt.push(doc('SalesReceipt', 'SR-' + m, d(15), 'Walk-in customer', [['item', '1', '10', 500]], 'S'));
    if (m === 5 || m === 8) E.CreditMemo.push(doc('CreditMemo', 'CN-' + m, d(20), 'Civica Pty Ltd', [['item', '1', '10', 1000]], 'S'));
    if (m === 6) E.VendorCredit.push(doc('VendorCredit', 'VC-' + m, d(22), 'Office Supplies Co', [['acct', 'Office expenses', '10', 200]], 'P'));
    if (m === 4 || m === 7) E.JournalEntry.push(je('JE-' + m, d(28), 'Office expenses', 100, 10));
  }
  return E;
})();
const SIGN = { Invoice: 1, SalesReceipt: 1, CreditMemo: -1, Bill: 1, Purchase: 1, VendorCredit: -1 };
const SIDE = { Invoice: 'S', SalesReceipt: 'S', CreditMemo: 'S', Bill: 'P', Purchase: 'P', VendorCredit: 'P' };
// GST totals for a window from the books: {a1, b1, salesNet (taxable), free (GST-free sales)}
function gst(start, end, cash) {
  const o = { a1: 0, b1: 0, net: 0, free: 0 };
  Object.keys(BOOKS).forEach((ent) => BOOKS[ent].forEach((t) => {
    if (t.TxnDate < start || t.TxnDate > end || (cash && t.Balance > 0)) return;
    if (ent === 'JournalEntry') { t.Line.forEach((l) => { const x = l.JournalEntryLineDetail; if (x.TaxAmount != null) o.b1 += x.PostingType === 'Debit' ? x.TaxAmount : -x.TaxAmount; }); return; }
    t.TxnTaxDetail.TaxLine.forEach((tl) => { const s = SIGN[ent], d = tl.TaxLineDetail;
      if (SIDE[ent] === 'S') { o.a1 += s * tl.Amount; if (d.TaxPercent) o.net += s * d.NetAmountTaxable; else o.free += s * d.NetAmountTaxable; } else o.b1 += s * tl.Amount; });
  }));
  Object.keys(o).forEach((k) => { o[k] = r2(o[k]); });
  return o;
}
function taxSummary(p) {
  const hdr = F.header('TaxSummary', p);
  const any = Object.keys(BOOKS).some((e) => BOOKS[e].some((t) => t.TxnDate >= p.start_date && t.TxnDate <= p.end_date)); // QuickBooks answers a nil period with NoReportData
  if (p.agency_id !== '1' || !any) return { Header: Object.assign(hdr, { Option: [{ Name: 'NoReportData', Value: 'true' }] }), Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, { ColTitle: 'Total', ColType: 'Money' }] }, Rows: {} };
  const g = gst(p.start_date, p.end_date, p.accounting_method === 'Cash');
  const rows = [['Net amount for G1', g.net], ['Tax amount for G1', g.a1], ['GST-Free sales', g.free], ['G1 TOTAL SALES', r2(g.net + g.a1 + g.free)], ['1A GST ON SALES', g.a1], ['1B GST ON PURCHASES', g.b1], ['9 REFUND OR PAYMENT DUE', r2(g.a1 - g.b1)]];
  return { Header: hdr, Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, { ColTitle: 'Total', ColType: 'Money' }] }, Rows: { Row: rows.map(([l, v]) => ({ type: 'Data', ColData: [{ value: l }, { value: v.toFixed(2) }] })) } };
}
// ATO payments posted to the GST account (not GST-coded transactions): each quarter's net GST, paid on the 28th after the quarter
const PAY = [['2026-04-28', '2026-01-01', '2026-03-31'], ['2026-07-28', '2026-04-01', '2026-06-30']];
function gstBalance(at) {
  const g = gst('2026-01-01', at, false); let b = r2(g.a1 - g.b1);
  PAY.forEach(([d, s, e]) => { if (d <= at) { const q = gst(s, e, false); b = r2(b - (q.a1 - q.b1)); } });
  return b;
}
function bsMonths(p) {
  const ms = F.months(p.start_date, p.end_date), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ends = ms.map(([y, m]) => { const e = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return e > p.end_date ? p.end_date : e; });
  const g = ends.map(gstBalance).concat([gstBalance(p.end_date)]), bank = g.map((v) => r2(100000 + v)), cell = (v) => ({ value: v.toFixed(2) });
  const cols = [{ ColTitle: '', ColType: 'Account' }].concat(ms.map(([y, m], i) => ({ ColTitle: MON[m - 1] + ' ' + y, ColType: 'Money', MetaData: [{ Name: 'StartDate', Value: y + '-' + String(m).padStart(2, '0') + '-01' }, { Name: 'EndDate', Value: ends[i] }] })), [{ ColTitle: 'Total', ColType: 'Money' }]);
  return { Header: F.header('BalanceSheet', Object.assign({}, p, { summarize_column_by: 'Month' })), Columns: { Column: cols }, Rows: { Row: [
    { type: 'Section', group: 'TotalAssets', Header: { ColData: [{ value: 'Assets' }].concat(g.map(() => ({ value: '' }))) }, Rows: { Row: [{ type: 'Data', ColData: [{ value: 'Cheque account', id: '35' }].concat(bank.map(cell)) }] }, Summary: { ColData: [{ value: 'Total Assets' }].concat(bank.map(cell)) } },
    { type: 'Section', group: 'TotalLiabilitiesAndEquity', Header: { ColData: [{ value: 'Liabilities and Equity' }].concat(g.map(() => ({ value: '' }))) }, Rows: { Row: [
      { type: 'Section', group: 'Liabilities', Header: { ColData: [{ value: 'Liabilities' }].concat(g.map(() => ({ value: '' }))) }, Rows: { Row: [{ type: 'Data', ColData: [{ value: 'GST Liabilities Payable', id: '43' }].concat(g.map(cell)) }] }, Summary: { ColData: [{ value: 'Total Liabilities' }].concat(g.map(cell)) } },
      { type: 'Section', group: 'Equity', Header: { ColData: [{ value: 'Equity' }].concat(g.map(() => ({ value: '' }))) }, Rows: { Row: [{ type: 'Data', ColData: [{ value: 'Retained Earnings', id: '2' }].concat(g.map(() => cell(100000))) }] }, Summary: { ColData: [{ value: 'Total Equity' }].concat(g.map(() => cell(100000))) } }] },
      Summary: { ColData: [{ value: 'Total Liabilities and Equity' }].concat(bank.map(cell)) } }] } };
}
// list_<entity> with where "TxnDate >= 'a' AND TxnDate <= 'b'"
function list(entity) {
  return (p) => { const m = /TxnDate >= '(\d{4}-\d\d-\d\d)' AND TxnDate <= '(\d{4}-\d\d-\d\d)'/.exec(p.where || ''); if (!m) throw new Error('QBO query: bad where ' + p.where);
    return Q(entity, JSON.parse(JSON.stringify(BOOKS[entity].filter((t) => t.TxnDate >= m[1] && t.TxnDate <= m[2])))); };
}
const fx = () => ({ invoices: list('Invoice'), credit_memos: list('CreditMemo'), sales_receipts: list('SalesReceipt'), bills: list('Bill'), vendor_credits: list('VendorCredit'), purchases: list('Purchase'), journal_entries: list('JournalEntry'),
  tax_codes: taxCodes, items, tax_agencies: F.taxAgencies, gst_period: taxSummary, bs_months: bsMonths, company_info: () => F.companyInfo, prefs: () => F.prefs });
module.exports = { fx, gst, BOOKS, taxSummary, bsMonths, gstBalance, Q };

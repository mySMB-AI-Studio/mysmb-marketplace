// A small double-entry Xero-like books model for the dashboard tests. Documents (sales invoices, bills, payments, spend/receive
// money, credit notes, an overpayment, BAS payments) are generated deterministically; every Xero response the reports read is
// derived from them, so the Balance Sheet balances, AR/AP equal the open documents, Current Year Earnings equals the P&L and the
// Bank Summary equals the bank balances — by construction. "Today" = 2026-09-25 (the harness clock).
const TODAY = '2026-09-25';
const T1 = 'a1b2c3d4-0000-4000-8000-000000000001', T2 = 'a1b2c3d4-0000-4000-8000-000000000002';
const ORG = {
  [T1]: { Name: 'Northwind Trading Pty Ltd', LegalName: 'Northwind Trading Pty Ltd', BaseCurrency: 'AUD', CountryCode: 'AU', FinancialYearEndDay: 30, FinancialYearEndMonth: 6, SalesTaxBasis: 'INVOICE', SalesTaxPeriod: 'QUARTERLY1', ShortCode: '!nWt01', OrganisationID: 'org-1', seed: 7, scale: 1 },
  [T2]: { Name: 'Southgate Services Ltd', LegalName: 'Southgate Services Limited', BaseCurrency: 'NZD', CountryCode: 'NZ', FinancialYearEndDay: 31, FinancialYearEndMonth: 3, SalesTaxBasis: 'PAYMENTS', SalesTaxPeriod: 'TWOMONTHS', ShortCode: '!sGs02', OrganisationID: 'org-2', seed: 11, scale: 0.5 },
};
const r2 = (n) => Math.round(n * 100) / 100, s2 = (n) => r2(n).toFixed(2);
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const iso = (dt) => dt.toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return D(y, m, d); };
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * 86400000));
const eom = (y, m) => iso(D(y, m + 1, 0));
const isEom = (s) => { const [y, m] = s.split('-').map(Number); return s === eom(y, m); };
const shiftMonths = (s, k, keepEom) => { const [y, m, d] = s.split('-').map(Number); const t = D(y, m + k, 1), ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1, last = +eom(ty, tm).slice(8); return iso(D(ty, tm, keepEom ? last : Math.min(d, last))); };
const long = (s) => { const [y, m, d] = s.split('-').map(Number); return d + ' ' + MON[m - 1] + ' ' + y; };
const short = (s) => { const [y, m, d] = s.split('-').map(Number); return d + ' ' + MON[m - 1].slice(0, 3) + ' ' + y; };
const msDate = (s) => '/Date(' + parse(s).getTime() + '+0000)/';
const fyStart = (s, endMonth) => { const [y, m] = s.split('-').map(Number), sm = endMonth % 12 + 1; return (m >= sm ? y : y - 1) + '-' + String(sm).padStart(2, '0') + '-01'; };
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const ACCOUNTS = [
  ['090', 'Business Cheque Account', 'BANK'], ['091', 'Business Savings Account', 'BANK'],
  ['610', 'Accounts Receivable', 'CURRENT'], ['620', 'Prepayments', 'CURRENT'],
  ['710', 'Office Equipment', 'FIXED'], ['711', 'Less Accumulated Depreciation on Office Equipment', 'FIXED'],
  ['800', 'Accounts Payable', 'CURRLIAB'], ['820', 'GST', 'CURRLIAB'], ['850', 'Suspense', 'CURRLIAB'],
  ['900', 'Loan - Westpac', 'TERMLIAB'], ['960', 'Retained Earnings', 'EQUITY'],
  ['200', 'Sales', 'REVENUE'], ['260', 'Consulting Fees', 'REVENUE'], ['270', 'Interest Income', 'OTHERINCOME'],
  ['310', 'Purchases', 'DIRECTCOSTS'], ['320', 'Freight & Courier', 'DIRECTCOSTS'],
  ['400', 'Advertising', 'EXPENSE'], ['404', 'Bank Fees', 'EXPENSE'], ['429', 'General Expenses', 'EXPENSE'], ['469', 'Rent', 'EXPENSE'], ['477', 'Wages and Salaries', 'EXPENSE'], ['485', 'Subscriptions', 'EXPENSE'],
].map(([Code, Name, Type], i) => ({ AccountID: 'acc-' + Code + '-' + String(i).padStart(4, '0'), Code, Name, Type, Status: 'ACTIVE', Class: { BANK: 'ASSET', CURRENT: 'ASSET', FIXED: 'ASSET', CURRLIAB: 'LIABILITY', TERMLIAB: 'LIABILITY', EQUITY: 'EQUITY', REVENUE: 'REVENUE', OTHERINCOME: 'REVENUE', DIRECTCOSTS: 'EXPENSE', EXPENSE: 'EXPENSE' }[Type] }));
const ACC = Object.fromEntries(ACCOUNTS.map((a) => [a.Code, a]));
const TAX_RATES = [
  ['GST on Income', 'OUTPUT', 'OUTPUT', 10], ['GST on Expenses', 'INPUT', 'INPUT', 10], ['GST on Capital', 'CAPEXINPUT', 'CAPEXINPUT', 10],
  ['GST Free Exports', 'EXEMPTEXPORT', 'EXEMPTEXPORT', 0], ['GST Free Income', 'EXEMPTOUTPUT', 'EXEMPTOUTPUT', 0], ['GST Free Expenses', 'EXEMPTEXPENSES', 'EXEMPTEXPENSES', 0],
  ['Input Taxed', 'INPUTTAXED', 'INPUTTAXED', 0], ['BAS Excluded', 'BASEXCLUDED', 'BASEXCLUDED', 0],
].map(([Name, TaxType, ReportTaxType, EffectiveRate]) => ({ Name, TaxType, ReportTaxType, EffectiveRate, Status: 'ACTIVE', CanApplyToAssets: true, CanApplyToExpenses: true, CanApplyToRevenue: true }));
const RATE = Object.fromEntries(TAX_RATES.map((t) => [t.TaxType, t.EffectiveRate / 100]));
const CUSTOMERS = ['Harbour Cafe Group', 'Bluegum Architects', 'Coastal Freight Co', 'Redwood Dental', 'Summit Legal', 'Parkside Physio', 'Eastside Motors', 'Lakeview Hotel'];
const SUPPLIERS = ['Metro Wholesale', 'FastTrack Couriers', 'SocialAds Pty Ltd', 'City Property Group', 'CloudSoft Subscriptions', 'Office Hub Supplies'];
const contact = (name, kind) => ({ ContactID: kind + '-' + name.toLowerCase().replace(/[^a-z]+/g, '-'), Name: name });

const BOOKS = {};
function books(tenant) {
  const t = tenant || T1; if (BOOKS[t]) return BOOKS[t];
  const O = ORG[t], rnd = prng(O.seed), S = O.scale, docs = [], pays = [], bank = [], credits = [], overs = [], pos = [], links = [];
  let invNo = 1000, billNo = 500, cnNo = 1, poNo = 1;
  const line = (code, net, tax, desc) => { const r = RATE[tax] || 0, ta = r2(net * r); return { Description: desc || ACC[code].Name, Quantity: 1, UnitAmount: r2(net), AccountCode: code, TaxType: tax, TaxAmount: ta, LineAmount: r2(net), LineItemID: 'li-' + Math.floor(rnd() * 1e9) }; };
  const totals = (lines) => { const sub = r2(lines.reduce((a, l) => a + l.LineAmount, 0)), tax = r2(lines.reduce((a, l) => a + l.TaxAmount, 0)); return { SubTotal: sub, TotalTax: tax, Total: r2(sub + tax) }; };
  // 27 months of trading: Jul 2024 → Sep 2026, plus a few documents dated after today (future-dated / drafts)
  for (let k = 0; k < 27; k++) {
    const y = 2024 + Math.floor((6 + k) / 12), m = (6 + k) % 12 + 1, last = +eom(y, m).slice(8), g = 1 + k * 0.015;
    const day = (lo, hi) => { const d = lo + Math.floor(rnd() * (hi - lo + 1)); return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0'); };
    // sales invoices: 5 per month
    for (let j = 0; j < 5; j++) {
      const c = contact(CUSTOMERS[(k * 3 + j) % CUSTOMERS.length], 'cus'), date = day(1, 26), terms = j % 2 ? 14 : 30;
      const lines = [line('200', r2((1200 + rnd() * 1800) * g * S), 'OUTPUT')];
      if (j === 1) lines.push(line('260', r2((600 + rnd() * 900) * g * S), 'OUTPUT'));
      if (j === 4 && k % 3 === 0) lines.push(line('200', r2(400 * g * S), 'EXEMPTEXPORT', 'Export sales'));
      const inv = Object.assign({ Type: 'ACCREC', InvoiceID: 'inv-' + t.slice(-1) + '-' + (++invNo), InvoiceNumber: 'INV-' + invNo, Reference: '', Contact: c, date, due: addDays(date, terms), status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: lines, CurrencyCode: O.BaseCurrency, CurrencyRate: 1 }, totals(lines));
      docs.push(inv);
      // payment: most on time; recent and a few old ones stay open; one part-paid
      const late = Math.floor(rnd() * 20) - 5, payDate = addDays(inv.due, late);
      const keepOpen = (k === 20 && j === 2) || (k === 23 && j === 0) || (k === 24 && j === 3) || (k === 25 && j === 1);
      if (!keepOpen && payDate <= TODAY) pays.push({ doc: inv, date: payDate, amount: (k === 22 && j === 4) ? r2(inv.Total / 2) : inv.Total, acct: '090' });
    }
    // bills: purchases, freight, advertising, rent, subscriptions
    const billOf = (sup, code, net, tax, dd, terms) => { const lines = [line(code, r2(net * S), tax)], date = day(dd, dd + 3); const b = Object.assign({ Type: 'ACCPAY', InvoiceID: 'bill-' + t.slice(-1) + '-' + (++billNo), InvoiceNumber: 'B-' + billNo, Reference: 'REF' + billNo, Contact: contact(sup, 'sup'), date, due: addDays(date, terms), status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: lines, CurrencyCode: O.BaseCurrency, CurrencyRate: 1 }, totals(lines)); docs.push(b); return b; };
    const bills = [billOf(SUPPLIERS[0], '310', (1500 + rnd() * 700) * g, 'INPUT', 3, 30), billOf(SUPPLIERS[1], '320', 120 + rnd() * 80, 'INPUT', 8, 14), billOf(SUPPLIERS[2], '400', 300 + rnd() * 250, 'INPUT', 12, 14), billOf(SUPPLIERS[3], '469', 3000, 'INPUT', 1, 7), billOf(SUPPLIERS[4], '485', 200 + rnd() * 30, 'INPUT', 15, 30)];
    if (k === 14) bills.push(billOf(SUPPLIERS[5], '710', 2400, 'CAPEXINPUT', 18, 30)); // capital purchase (G10)
    bills.forEach((b, j) => { const payDate = addDays(b.due, Math.floor(rnd() * 6) - 2), keepOpen = (k >= 25 && j < 3) || (k === 22 && j === 0); if (!keepOpen && payDate <= TODAY) pays.push({ doc: b, date: payDate, amount: b.Total, acct: '090' }); });
    // spend / receive money: wages (BAS excluded), bank fees (input taxed), interest (input taxed income), general expenses
    const bt = (type, code, net, tax, dd, acct) => { const lines = [line(code, r2(net * S), tax)], date = day(dd, dd); bank.push(Object.assign({ Type: type, BankTransactionID: 'bt-' + t.slice(-1) + '-' + bank.length, Contact: contact(type === 'SPEND' ? 'ATO / Payroll' : 'Westpac', 'bt'), date, status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: lines, BankAccount: { AccountID: ACC[acct || '090'].AccountID, Code: acct || '090', Name: ACC[acct || '090'].Name }, IsReconciled: date < addDays(TODAY, -3) }, totals(lines))); };
    bt('SPEND', '477', 4200 * g, 'BASEXCLUDED', 28); bt('SPEND', '404', 25 + rnd() * 20, 'INPUTTAXED', 27); bt('RECEIVE', '270', 30 + rnd() * 15, 'INPUTTAXED', 28, '091'); bt('SPEND', '429', 80 + rnd() * 90, 'INPUT', 20);
  }
  // quarterly BAS payments (the previous quarter's net GST) on the 28th of the month after quarter end
  docs.sort((a, b) => a.date.localeCompare(b.date));
  // a few non-approved documents for the pipeline dashboards, and future-dated ones
  const extra = (type, status, date, net, cust) => { const lines = [line(type === 'ACCREC' ? '200' : '310', r2(net * S), type === 'ACCREC' ? 'OUTPUT' : 'INPUT')]; const d = Object.assign({ Type: type, InvoiceID: (type === 'ACCREC' ? 'inv-' : 'bill-') + t.slice(-1) + '-x' + docs.length, InvoiceNumber: type === 'ACCREC' ? 'INV-' + (++invNo) : 'B-' + (++billNo), Reference: '', Contact: contact(cust, type === 'ACCREC' ? 'cus' : 'sup'), date, due: addDays(date, 30), status, LineAmountTypes: 'Exclusive', LineItems: lines, CurrencyCode: O.BaseCurrency, CurrencyRate: 1 }, totals(lines)); docs.push(d); return d; };
  extra('ACCREC', 'DRAFT', '2026-09-22', 1850, CUSTOMERS[0]); extra('ACCREC', 'DRAFT', '2026-09-24', 920, CUSTOMERS[5]); extra('ACCREC', 'SUBMITTED', '2026-09-23', 2400, CUSTOMERS[2]);
  extra('ACCPAY', 'DRAFT', '2026-09-21', 640, SUPPLIERS[5]); extra('ACCPAY', 'SUBMITTED', '2026-09-24', 1100, SUPPLIERS[0]);
  extra('ACCREC', 'AUTHORISED', '2026-10-02', 1300, CUSTOMERS[1]); // future-dated: in lists, not yet on the Balance Sheet
  // one unallocated sales credit note, one unallocated supplier credit note, one customer overpayment
  const cn = (type, date, net, who) => { const lines = [line(type === 'ACCRECCREDIT' ? '200' : '310', r2(net * S), type === 'ACCRECCREDIT' ? 'OUTPUT' : 'INPUT')]; const c = Object.assign({ Type: type, CreditNoteID: 'cn-' + t.slice(-1) + '-' + cnNo, CreditNoteNumber: 'CN-' + (cnNo++), Contact: who, date, status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: lines, CurrencyCode: O.BaseCurrency, CurrencyRate: 1 }, totals(lines)); c.RemainingCredit = c.Total; credits.push(c); };
  cn('ACCRECCREDIT', '2026-08-14', 150, contact(CUSTOMERS[3], 'cus')); cn('ACCPAYCREDIT', '2026-09-03', 80, contact(SUPPLIERS[4], 'sup'));
  overs.push({ Type: 'RECEIVE-OVERPAYMENT', OverpaymentID: 'op-' + t.slice(-1) + '-1', Contact: contact(CUSTOMERS[6], 'cus'), date: '2026-09-10', status: 'AUTHORISED', Total: r2(55 * S), RemainingCredit: r2(55 * S), CurrencyCode: O.BaseCurrency, acct: '090' });
  // purchase orders and billable expenses (linked transactions)
  [['DRAFT', 900], ['SUBMITTED', 1450], ['AUTHORISED', 2300], ['AUTHORISED', 780], ['BILLED', 1990]].forEach(([st, v], i) => pos.push({ PurchaseOrderID: 'po-' + i, PurchaseOrderNumber: 'PO-' + String(++poNo).padStart(4, '0'), Contact: contact(SUPPLIERS[i % SUPPLIERS.length], 'sup'), date: addDays(TODAY, -3 * i - 2), DeliveryDate: msDate(addDays(TODAY, 10)), Status: st, Total: r2(v * S), SubTotal: r2(v * S / 1.1), TotalTax: r2(v * S - v * S / 1.1), CurrencyCode: O.BaseCurrency }));
  const billsNow = docs.filter((d) => d.Type === 'ACCPAY' && d.date > '2026-08-15' && d.date <= TODAY).slice(0, 3);
  billsNow.forEach((b, i) => links.push({ LinkedTransactionID: 'lt-' + i, SourceTransactionID: b.InvoiceID, SourceLineItemID: b.LineItems[0].LineItemID, ContactID: contact(CUSTOMERS[i + 1], 'cus').ContactID, Status: 'APPROVED', Type: 'BILLABLEEXPENSE', SourceTransactionTypeCode: 'ACCPAY' }));
  // manual journals (LineAmount: debit positive, credit negative). Posted ones are in the books (balances and P&L); a draft,
  // a voided one and an earlier small reclass exercise the month-end rules.
  const mj = (id, date, status, narration, lines) => ({ ManualJournalID: 'mj-' + t.slice(-1) + '-' + id, date, Status: status, Narration: narration, LineAmountTypes: 'NoTax', ShowOnCashBasisReports: true,
    JournalLines: lines.map(([code, amt, desc]) => ({ LineAmount: r2(amt * S), AccountCode: code, Description: desc || '', TaxType: 'BASEXCLUDED' })) });
  const journals = [
    mj(1, '2026-08-20', 'POSTED', 'Insurance prepaid — funded by loan drawdown', [['620', 10000], ['900', -10000]]),
    mj(2, '2026-08-28', 'POSTED', 'Unidentified deposit — to suspense', [['429', 120], ['850', -120]]),
    mj(3, '2026-08-31', 'DRAFT', 'Accrued audit fee', [['429', 450], ['800', -450]]),
    mj(4, '2026-08-15', 'VOIDED', 'Duplicate entry', [['429', 99], ['850', -99]]),
    mj(5, '2026-07-31', 'POSTED', 'Subscriptions reclass', [['485', 300], ['429', -300]])];
  const B = { t, O, docs, pays, bank, credits, overs, pos, links, journals, bas: [] };
  // BAS: pay each quarter's net GST (accrual) on the 28th of the following month, up to today
  ['2024-07-01', '2024-10-01', '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01'].forEach((qs) => {
    const qe = addDays(shiftMonths(qs, 3), -1), pay = shiftMonths(qs, 3).slice(0, 8) + '28', net = gstMovement(B, qs, qe);
    if (pay <= TODAY && net > 0) { const lines = [{ Description: 'BAS ' + qs, Quantity: 1, UnitAmount: net, AccountCode: '820', TaxType: 'BASEXCLUDED', TaxAmount: 0, LineAmount: net, LineItemID: 'bas-' + qs }]; bank.push({ Type: 'SPEND', BankTransactionID: 'bt-' + t.slice(-1) + '-bas-' + qs, Contact: contact('Australian Taxation Office', 'bt'), date: pay, status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: lines, SubTotal: net, TotalTax: 0, Total: net, BankAccount: { AccountID: ACC['090'].AccountID, Code: '090', Name: ACC['090'].Name }, IsReconciled: true }); }
  });
  bank.sort((a, b) => a.date.localeCompare(b.date));
  BOOKS[t] = B; return B;
}
// ---------- derived balances ----------
const approved = (d) => d.status === 'AUTHORISED' || d.status === 'PAID';
const salesLike = (d) => d.Type === 'ACCREC' || d.Type === 'RECEIVE' || d.Type === 'ACCRECCREDIT';
const sign = (d) => (d.Type === 'ACCRECCREDIT' || d.Type === 'ACCPAYCREDIT' ? -1 : 1);
function gstMovement(B, a, b) { // net GST (collected − paid) on documents dated in [a, b]
  let g = 0;
  B.docs.filter((d) => approved(d) && d.date >= a && d.date <= b).forEach((d) => { g += (d.Type === 'ACCREC' ? 1 : -1) * d.TotalTax; });
  B.credits.filter((c) => c.date >= a && c.date <= b).forEach((c) => { g += (c.Type === 'ACCRECCREDIT' ? -1 : 1) * c.TotalTax; });
  B.bank.filter((x) => x.date >= a && x.date <= b).forEach((x) => { g += (x.Type === 'RECEIVE' ? 1 : -1) * x.TotalTax; });
  return r2(g);
}
function paidBy(B, doc, date) { return r2(B.pays.filter((p) => p.doc === doc && p.date <= date).reduce((a, p) => a + p.amount, 0)); }
function bankBalance(B, code, date) { // opening + inflows − outflows up to date
  let v = code === '090' ? 15000 * B.O.scale : 10000 * B.O.scale;
  B.pays.filter((p) => p.acct === code && p.date <= date).forEach((p) => { v += (p.doc.Type === 'ACCREC' ? 1 : -1) * p.amount; });
  B.bank.filter((x) => x.BankAccount.Code === code && x.date <= date).forEach((x) => { v += (x.Type === 'RECEIVE' ? 1 : -1) * x.Total; });
  B.overs.filter((o) => o.acct === code && o.date <= date).forEach((o) => { v += o.Total; });
  return r2(v);
}
function flows(B, code, a, b) { let rin = 0, rout = 0;
  B.pays.filter((p) => p.acct === code && p.date >= a && p.date <= b).forEach((p) => { if (p.doc.Type === 'ACCREC') rin += p.amount; else rout += p.amount; });
  B.bank.filter((x) => x.BankAccount.Code === code && x.date >= a && x.date <= b).forEach((x) => { if (x.Type === 'RECEIVE') rin += x.Total; else rout += x.Total; });
  B.overs.filter((o) => o.acct === code && o.date >= a && o.date <= b).forEach((o) => { rin += o.Total; });
  return { rin: r2(rin), rout: r2(rout) };
}
// P&L by account over [a, b]; cash = recognise invoice/bill lines pro rata on their payment dates.
function plByAccount(B, a, b, cash) {
  const out = {}, add = (code, v) => { const t = ACC[code].Type; if (!/REVENUE|OTHERINCOME|DIRECTCOSTS|EXPENSE/.test(t)) return; out[code] = r2((out[code] || 0) + v); };
  if (!cash) {
    B.docs.filter((d) => approved(d) && d.date >= a && d.date <= b).forEach((d) => d.LineItems.forEach((l) => add(l.AccountCode, l.LineAmount)));
    B.credits.filter((c) => c.date >= a && c.date <= b).forEach((c) => c.LineItems.forEach((l) => add(l.AccountCode, -l.LineAmount)));
  } else {
    B.pays.filter((p) => p.date >= a && p.date <= b).forEach((p) => { const f = p.amount / p.doc.Total; p.doc.LineItems.forEach((l) => add(l.AccountCode, r2(l.LineAmount * f))); });
  }
  B.bank.filter((x) => x.date >= a && x.date <= b).forEach((x) => x.LineItems.forEach((l) => add(l.AccountCode, l.LineAmount)));
  (B.journals || []).filter((j) => j.Status === 'POSTED' && j.date >= a && j.date <= b).forEach((j) => j.JournalLines.forEach((l) => add(l.AccountCode, /REVENUE|OTHERINCOME/.test(ACC[l.AccountCode].Type) ? -l.LineAmount : l.LineAmount)));
  return out;
}
function netProfit(B, a, b, cash) { const p = plByAccount(B, a, b, cash); let n = 0; Object.keys(p).forEach((c) => { n += (/REVENUE|OTHERINCOME/.test(ACC[c].Type) ? 1 : -1) * p[c]; }); return r2(n); }
function balances(B, date) { // Balance Sheet by account at date (accrual)
  const fy = fyStart(date, B.O.FinancialYearEndMonth), openRE = (15000 + 10000 + 8400 - 1680 - 10000) * B.O.scale;
  const ar = r2(B.docs.filter((d) => d.Type === 'ACCREC' && approved(d) && d.date <= date).reduce((a, d) => a + d.Total - paidBy(B, d, date), 0) - B.credits.filter((c) => c.Type === 'ACCRECCREDIT' && c.date <= date).reduce((a, c) => a + c.Total, 0) - B.overs.filter((o) => o.date <= date).reduce((a, o) => a + o.Total, 0));
  const ap = r2(B.docs.filter((d) => d.Type === 'ACCPAY' && approved(d) && d.date <= date).reduce((a, d) => a + d.Total - paidBy(B, d, date), 0) - B.credits.filter((c) => c.Type === 'ACCPAYCREDIT' && c.date <= date).reduce((a, c) => a + c.Total, 0));
  const basPaid = r2(B.bank.filter((x) => x.date <= date).reduce((a, x) => a + x.LineItems.filter((l) => l.AccountCode === '820').reduce((s, l) => s + l.LineAmount, 0), 0));
  const capex = r2(B.docs.filter((d) => approved(d) && d.date <= date).reduce((a, d) => a + d.LineItems.filter((l) => l.AccountCode === '710').reduce((s, l) => s + l.LineAmount, 0), 0));
  const gst = r2(gstMovement(B, '2000-01-01', date) - basPaid);
  const cye = netProfit(B, fy, date, false), re = r2(openRE + netProfit(B, '2000-01-01', addDays(fy, -1), false));
  const jd = (code) => r2((B.journals || []).filter((j) => j.Status === 'POSTED' && j.date <= date).reduce((s, j) => s + j.JournalLines.filter((l) => l.AccountCode === code).reduce((t, l) => t + l.LineAmount, 0), 0)); // debit positive
  return { '090': bankBalance(B, '090', date), '091': bankBalance(B, '091', date), '610': ar, '620': jd('620'), '710': r2(8400 * B.O.scale + capex), '711': r2(-1680 * B.O.scale), '800': ap, '820': gst, '850': r2(-jd('850')), '900': r2(10000 * B.O.scale - jd('900')), CYE: cye, '960': re };
}
// ---------- Xero report JSON ----------
const cell = (v, id) => { const a = id ? [{ Value: id, Id: 'account' }] : undefined; return a ? { Value: v, Attributes: a } : { Value: v }; };
const rowOf = (label, vals, id) => ({ RowType: 'Row', Cells: [cell(label, id)].concat(vals.map((v) => cell(s2(v), id))) });
const sumRow = (label, vals) => ({ RowType: 'SummaryRow', Cells: [cell(label)].concat(vals.map((v) => cell(s2(v)))) });
const calc = (label, vals) => ({ RowType: 'Section', Title: '', Rows: [{ RowType: 'Row', Cells: [cell(label)].concat(vals.map((v) => cell(s2(v)))) }] });
// columns for [from, to] and `periods` previous periods of `timeframe` (Xero: newest first)
function windows(from, to, periods, timeframe) {
  const k = timeframe === 'QUARTER' ? 3 : timeframe === 'YEAR' ? 12 : 1, whole = from.slice(8) === '01' && isEom(to), out = [[from, to]];
  for (let i = 1; i <= (periods || 0); i++) out.push([shiftMonths(from, -k * i, false), shiftMonths(to, -k * i, whole)]);
  return out;
}
const TRACKING = [{ TrackingCategoryID: 'trk-region-0000-4000-8000-000000000001', Name: 'Region', Status: 'ACTIVE', Options: [{ TrackingOptionID: 'opt-north', Name: 'North', Status: 'ACTIVE' }, { TrackingOptionID: 'opt-south', Name: 'South', Status: 'ACTIVE' }] }];
const SHARE = [0.6, 0.3]; // each account's amount by option; the rest is Unassigned
function listTrackingCategories() { return { TrackingCategories: JSON.parse(JSON.stringify(TRACKING)) }; }
function pnlReport(p) {
  const B = books(p.xero_tenant_id), cash = p.paymentsOnly === true, W = windows(p.fromDate, p.toDate, p.periods, p.timeframe);
  let cols = W.map(([a, b]) => plByAccount(B, a, b, cash)), heads = W.map(([, b]) => short(b));
  if (p.trackingCategoryID !== undefined) {
    const cat = TRACKING.find((t) => t.TrackingCategoryID === p.trackingCategoryID);
    if (!cat) throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss 400: {"Message":"A validation exception occurred","Elements":[{"ValidationErrors":[{"Message":"TrackingCategoryID is invalid"}]}]}');
    const base = cols[0], part = (f) => { const o = {}; Object.keys(base).forEach((k) => { o[k] = r2(base[k] * f); }); return o; }, opts = SHARE.map(part), un = {};
    Object.keys(base).forEach((k) => { un[k] = r2(base[k] - opts.reduce((s, o) => s + o[k], 0)); });
    cols = opts.concat([un, base]); heads = cat.Options.map((o) => o.Name).concat(['Unassigned', 'Total']);
  }
  const sec = (title, total, types) => { const codes = ACCOUNTS.filter((a) => types.includes(a.Type) && cols.some((c) => c[a.Code] != null)).map((a) => a.Code); if (!codes.length) return null;
    const rows = codes.map((c) => rowOf(ACC[c].Name, cols.map((col) => col[c] || 0), ACC[c].AccountID)), tot = cols.map((col) => r2(codes.reduce((s, c) => s + (col[c] || 0), 0)));
    return { row: { RowType: 'Section', Title: title, Rows: rows.concat([sumRow(total, tot)]) }, tot }; };
  const inc = sec('Income', 'Total Income', ['REVENUE']), cos = sec('Less Cost of Sales', 'Total Cost of Sales', ['DIRECTCOSTS']), oi = sec('Other Income', 'Total Other Income', ['OTHERINCOME']), ex = sec('Less Operating Expenses', 'Total Operating Expenses', ['EXPENSE']);
  const z = cols.map(() => 0), v = (s) => (s ? s.tot : z), gp = cols.map((_, i) => r2(v(inc)[i] - v(cos)[i])), np = cols.map((_, i) => r2(gp[i] + v(oi)[i] - v(ex)[i]));
  const Rows = [{ RowType: 'Header', Cells: [cell('')].concat(heads.map((t) => cell(t))) }];
  [inc, cos].forEach((s) => s && Rows.push(s.row)); Rows.push(calc('Gross Profit', gp)); [oi, ex].forEach((s) => s && Rows.push(s.row)); Rows.push(calc('Net Profit', np));
  return { Reports: [{ ReportID: 'ProfitAndLoss', ReportName: 'Profit and Loss', ReportType: 'ProfitAndLoss', ReportTitles: ['Profit and Loss', B.O.Name, long(p.fromDate) + ' to ' + long(p.toDate)], ReportDate: short(TODAY), Rows }] };
}
function bsReport(p) {
  const B = books(p.xero_tenant_id), whole = isEom(p.date), dates = [p.date]; const k = p.timeframe === 'QUARTER' ? 3 : p.timeframe === 'YEAR' ? 12 : 1;
  for (let i = 1; i <= (p.periods || 0); i++) dates.push(shiftMonths(p.date, -k * i, whole));
  const cols = dates.map((d) => balances(B, d)), val = (code) => cols.map((c) => c[code] || 0);
  const sec = (title, total, codes) => ({ RowType: 'Section', Title: title, Rows: codes.map((c) => rowOf(ACC[c].Name, val(c), ACC[c].AccountID)).concat([sumRow(total, cols.map((col) => r2(codes.reduce((s, c) => s + (col[c] || 0), 0))))]) });
  const sumc = (codes) => cols.map((col) => r2(codes.reduce((s, c) => s + (col[c] || 0), 0)));
  const TA = sumc(['090', '091', '610', '620', '710', '711']), TL = sumc(['800', '820', '850', '900']);
  const Rows = [{ RowType: 'Header', Cells: [cell('')].concat(dates.map((d) => cell(short(d)))) },
    { RowType: 'Section', Title: 'Assets', Rows: [] }, sec('Bank', 'Total Bank', ['090', '091']), sec('Current Assets', 'Total Current Assets', ['610', '620']), sec('Fixed Assets', 'Total Fixed Assets', ['710', '711']), calc('Total Assets', TA),
    { RowType: 'Section', Title: 'Liabilities', Rows: [] }, sec('Current Liabilities', 'Total Current Liabilities', ['800', '820', '850']), sec('Non-Current Liabilities', 'Total Non-Current Liabilities', ['900']), calc('Total Liabilities', TL),
    calc('Net Assets', TA.map((a, i) => r2(a - TL[i]))),
    { RowType: 'Section', Title: 'Equity', Rows: [rowOf('Current Year Earnings', val('CYE')), rowOf('Retained Earnings', val('960'), ACC['960'].AccountID), sumRow('Total Equity', cols.map((c) => r2(c.CYE + c['960'])))] }];
  return { Reports: [{ ReportID: 'BalanceSheet', ReportName: 'Balance Sheet', ReportType: 'BalanceSheet', ReportTitles: ['Balance Sheet', B.O.Name, 'As at ' + long(p.date)], ReportDate: short(TODAY), Rows }] };
}
function bankSummary(p) {
  const B = books(p.xero_tenant_id), a = p.fromDate, b = p.toDate, prev = addDays(a, -1);
  const rows = ['090', '091'].map((c) => { const o = bankBalance(B, c, prev), f = flows(B, c, a, b); return [ACC[c], o, f.rin, f.rout, r2(o + f.rin - f.rout)]; });
  const tot = [1, 2, 3, 4].map((i) => r2(rows.reduce((s, r) => s + r[i], 0)));
  return { Reports: [{ ReportID: 'BankSummary', ReportName: 'Bank Summary', ReportType: 'BankSummary', ReportTitles: ['Bank Summary', B.O.Name, 'From ' + long(a) + ' to ' + long(b)], ReportDate: short(TODAY),
    Rows: [{ RowType: 'Header', Cells: ['Bank Accounts', 'Opening Balance', 'Cash Received', 'Cash Spent', 'Closing Balance'].map((v) => cell(v)) },
      { RowType: 'Section', Title: '', Rows: rows.map((r) => ({ RowType: 'Row', Cells: [cell(r[0].Name, r[0].AccountID)].concat(r.slice(1).map((v) => cell(s2(v), r[0].AccountID))) })).concat([sumRow('Total', tot)]) }] }] };
}
// Trial Balance as at a date (Xero layout): Account | Debit | Credit | YTD Debit | YTD Credit, sections Revenue / Expenses /
// Assets / Liabilities / Equity, then an untitled section with only the grand Total SummaryRow. P&L accounts carry the
// financial year to date; balance-sheet accounts their balance; equity holds Retained Earnings (no Current Year Earnings row —
// the P&L accounts are listed instead), so debits = credits by construction.
function trialBalance(p) {
  const B = books(p.xero_tenant_id), d = p.date, b = balances(B, d), pl = plByAccount(B, fyStart(d, B.O.FinancialYearEndMonth), d, false);
  const dc = (code, v, debitNormal) => { const x = debitNormal ? v : -v; return x >= 0 ? [x, 0] : [0, -x]; };
  const row = (a, v, debitNormal) => { const [db, cr] = dc(a.Code, v, debitNormal), at = a.AccountID; return { RowType: 'Row', Cells: [cell(a.Name + ' (' + a.Code + ')', at)].concat([db, cr, db, cr].map((x) => cell(x ? s2(x) : '', at))) }; };
  const sec = (title, list) => ({ RowType: 'Section', Title: title, Rows: list });
  const accts = (types) => ACCOUNTS.filter((a) => types.includes(a.Type));
  const rev = accts(['REVENUE', 'OTHERINCOME']).filter((a) => pl[a.Code]).map((a) => row(a, pl[a.Code], false));
  const exp = accts(['DIRECTCOSTS', 'EXPENSE']).filter((a) => pl[a.Code]).map((a) => row(a, pl[a.Code], true));
  const ast = accts(['BANK', 'CURRENT', 'FIXED']).filter((a) => b[a.Code]).map((a) => row(a, b[a.Code], true));
  const lia = accts(['CURRLIAB', 'TERMLIAB']).filter((a) => b[a.Code]).map((a) => row(a, b[a.Code], false));
  const eq = [row(ACC['960'], b['960'], false)];
  const all = [].concat(rev, exp, ast, lia, eq), tot = [1, 2, 3, 4].map((i) => r2(all.reduce((t, r) => t + (+r.Cells[i].Value || 0), 0)));
  return { Reports: [{ ReportID: 'TrialBalance', ReportName: 'Trial Balance', ReportType: 'TrialBalance', ReportTitles: ['Trial Balance', B.O.Name, 'As at ' + long(d)], ReportDate: short(TODAY),
    Rows: [{ RowType: 'Header', Cells: ['Account', 'Debit', 'Credit', 'YTD Debit', 'YTD Credit'].map((v) => cell(v)) }, sec('Revenue', rev), sec('Expenses', exp), sec('Assets', ast), sec('Liabilities', lia), sec('Equity', eq),
      { RowType: 'Section', Title: '', Rows: [{ RowType: 'SummaryRow', Cells: [cell('Total')].concat(tot.map((v) => cell(s2(v)))) }] }] }] };
}
// ---------- lists (as of today) ----------
function whereFilter(where) { // tiny subset of Xero's where: A=="x", A!="x", Date>=DateTime(y,m,d), Date<=DateTime(y,m,d), joined by AND
  if (!where) return () => true;
  const parts = String(where).split(/\s+AND\s+/i).map((s) => s.trim());
  return (o) => parts.every((pt) => { let m;
    if ((m = /^(\w+)\s*(==|!=)\s*"([^"]*)"$/.exec(pt))) { const v = String(o[m[1]] == null ? '' : o[m[1]]); return m[2] === '==' ? v === m[3] : v !== m[3]; }
    if ((m = /^(\w+)\s*(>=|<=|>|<)\s*DateTime\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(pt))) { const d = m[3] + '-' + m[4].padStart(2, '0') + '-' + m[5].padStart(2, '0'), v = String(o['_' + m[1]] || '').slice(0, 10); return m[2] === '>=' ? v >= d : m[2] === '<=' ? v <= d : m[2] === '>' ? v > d : v < d; }
    throw new Error('fixture where: unsupported clause ' + pt);
  });
}
const page = (list, p, key, extra) => { const n = p.page || 1, rows = list.slice((n - 1) * 100, n * 100); return Object.assign({ Id: 'x', Status: 'OK', ProviderName: 'mySMB', DateTimeUTC: '/Date(1790296320000)/', [key]: rows }, extra || {}); };
function invoiceOut(B, d) {
  const paid = paidBy(B, d, TODAY), due = r2(d.Total - paid), st = d.status === 'AUTHORISED' && due <= 0.004 ? 'PAID' : d.status;
  return { Type: d.Type, InvoiceID: d.InvoiceID, InvoiceNumber: d.InvoiceNumber, Reference: d.Reference, Contact: d.Contact, Date: msDate(d.date), DateString: d.date + 'T00:00:00', DueDate: msDate(d.due), DueDateString: d.due + 'T00:00:00', Status: st, LineAmountTypes: d.LineAmountTypes, LineItems: d.LineItems, SubTotal: d.SubTotal, TotalTax: d.TotalTax, Total: d.Total, AmountDue: st === 'DRAFT' || st === 'SUBMITTED' ? d.Total : due, AmountPaid: paid, AmountCredited: 0, CurrencyCode: d.CurrencyCode, CurrencyRate: d.CurrencyRate, _Date: d.date, _DueDate: d.due };
}
function listInvoices(p) {
  const B = books(p.xero_tenant_id), f = whereFilter(p.where), st = p.statuses ? String(p.statuses).split(',') : null;
  let list = B.docs.map((d) => { const o = invoiceOut(B, d); if (o.Status === 'PAID') { const last = B.pays.filter((x) => x.doc === d).map((x) => x.date).sort().pop(); if (last) o.FullyPaidOnDate = msDate(last); } return o; }).filter((o) => f(o) && (!st || st.includes(o.Status)));
  if (/DueDate ASC/.test(p.order || '')) list.sort((a, b) => a._DueDate.localeCompare(b._DueDate)); else if (/Date DESC/.test(p.order || '')) list.sort((a, b) => b._Date.localeCompare(a._Date)); else list.sort((a, b) => a._Date.localeCompare(b._Date));
  return page(list.map((o) => { const c = Object.assign({}, o); delete c._Date; delete c._DueDate; return c; }), p, 'Invoices');
}
function getInvoice(p) { const B = books(p.xero_tenant_id), d = B.docs.find((x) => x.InvoiceID === p.invoiceId); if (!d) throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/Invoices/' + (p.invoiceId || '') + ' 404: {"Title":"Not Found"}'); const o = invoiceOut(B, d); delete o._Date; delete o._DueDate; return { Invoices: [o] }; }
function listCreditNotes(p) { const B = books(p.xero_tenant_id), f = whereFilter(p.where); return page(B.credits.map((c) => Object.assign({}, c, { Date: msDate(c.date), DateString: c.date + 'T00:00:00', Status: c.status, _Date: c.date })).filter(f).map((c) => { delete c._Date; delete c.date; delete c.status; return c; }), p, 'CreditNotes'); }
function listOverpayments(p) { const B = books(p.xero_tenant_id), f = whereFilter(p.where); return page(B.overs.map((o) => ({ Type: o.Type, OverpaymentID: o.OverpaymentID, Contact: o.Contact, Date: msDate(o.date), DateString: o.date + 'T00:00:00', Status: o.status, Total: o.Total, RemainingCredit: o.RemainingCredit, CurrencyCode: o.CurrencyCode, _Date: o.date })).filter(f).map((o) => { delete o._Date; return o; }), p, 'Overpayments'); }
function listPrepayments(p) { return page([], p, 'Prepayments'); }
function listPayments(p) {
  const B = books(p.xero_tenant_id), f = whereFilter(p.where);
  let list = B.pays.map((x, i) => ({ PaymentID: 'pay-' + i, Date: msDate(x.date), Amount: x.amount, PaymentType: x.doc.Type === 'ACCREC' ? 'ACCRECPAYMENT' : 'ACCPAYPAYMENT', Status: 'AUTHORISED', Reference: '', Invoice: { InvoiceID: x.doc.InvoiceID, InvoiceNumber: x.doc.InvoiceNumber, Type: x.doc.Type, Contact: x.doc.Contact }, Account: { AccountID: ACC[x.acct].AccountID, Code: x.acct }, _Date: x.date })).filter(f);
  if (/Date DESC/.test(p.order || '')) list.sort((a, b) => b._Date.localeCompare(a._Date));
  return page(list.map((o) => { delete o._Date; return o; }), p, 'Payments');
}
function listBankTransactions(p) { const B = books(p.xero_tenant_id), f = whereFilter(p.where); // Xero lists overpayments/prepayments as bank transactions too (RECEIVE-OVERPAYMENT …)
  const overs = B.overs.map((o) => ({ Type: o.Type, BankTransactionID: 'bt-' + o.OverpaymentID, OverpaymentID: o.OverpaymentID, Contact: o.Contact, date: o.date, status: 'AUTHORISED', LineAmountTypes: 'NoTax', LineItems: [], SubTotal: o.Total, TotalTax: 0, Total: o.Total, BankAccount: { AccountID: ACC[o.acct].AccountID, Code: o.acct, Name: ACC[o.acct].Name }, IsReconciled: true }));
  return page(B.bank.concat(overs).sort((x, y) => x.date.localeCompare(y.date)).map((x) => { const o = Object.assign({}, x, { Date: msDate(x.date), DateString: x.date + 'T00:00:00', Status: x.status, _Date: x.date }); delete o.date; delete o.status; return o; }).filter(f).map((o) => { delete o._Date; return o; }), p, 'BankTransactions'); }
function listPurchaseOrders(p) { const B = books(p.xero_tenant_id), f = whereFilter(p.where); return page(B.pos.map((x) => Object.assign({}, x, { Date: msDate(x.date), DateString: x.date + 'T00:00:00', _Date: x.date })).filter((o) => f(o) && (!p.status || o.Status === p.status)).map((o) => { delete o._Date; delete o.date; return o; }), p, 'PurchaseOrders'); }
function listLinked(p) { const B = books(p.xero_tenant_id); return page(B.links.filter((l) => !p.status || l.Status === p.status), p, 'LinkedTransactions'); }
function listRepeating(p) { const B = books(p.xero_tenant_id); return { RepeatingInvoices: [{ RepeatingInvoiceID: 'ri-1', Type: 'ACCREC', Contact: contact(CUSTOMERS[4], 'cus'), Schedule: { Period: 1, Unit: 'MONTHLY', DueDate: 20, DueDateType: 'OFFOLLOWINGMONTH', StartDate: msDate('2025-01-01'), NextScheduledDate: msDate('2026-10-01'), NextScheduledDateString: '2026-10-01T00:00:00' }, Status: 'AUTHORISED', SubTotal: r2(800 * B.O.scale), TotalTax: r2(80 * B.O.scale), Total: r2(880 * B.O.scale), Reference: 'Retainer' }, { RepeatingInvoiceID: 'ri-2', Type: 'ACCPAY', Contact: contact(SUPPLIERS[3], 'sup'), Schedule: { Period: 1, Unit: 'MONTHLY', DueDate: 7, DueDateType: 'DAYSAFTERBILLDATE', StartDate: msDate('2024-07-01'), NextScheduledDate: msDate('2026-10-01'), NextScheduledDateString: '2026-10-01T00:00:00' }, Status: 'AUTHORISED', SubTotal: r2(3000 * B.O.scale), TotalTax: r2(300 * B.O.scale), Total: r2(3300 * B.O.scale), Reference: 'Rent' }].filter((r) => whereFilter(p.where)(r)) }; }
function listAccounts(p) { return { Accounts: ACCOUNTS.map((a) => Object.assign({}, a)).filter(whereFilter(p && p.where)) }; }
function listTaxRates() { return { TaxRates: TAX_RATES.map((t) => Object.assign({}, t)) }; }
function organisation(p) { const o = Object.assign({}, ORG[(p && p.xero_tenant_id) || T1]); delete o.seed; delete o.scale; return { Id: 'x', Status: 'OK', ProviderName: 'mySMB', Organisations: [o] }; }
function connections() { return { activeTenantId: T1, tenants: [{ tenantId: T1, tenantName: ORG[T1].Name, tenantType: 'ORGANISATION' }, { tenantId: T2, tenantName: ORG[T2].Name, tenantType: 'ORGANISATION' }] }; }
// manual journals (list_manual_journals: where on Date, 100 per page)
function listManualJournals(p) { const B = books(p.xero_tenant_id), f = whereFilter(p.where); return page(B.journals.map((j) => ({ ManualJournalID: j.ManualJournalID, Date: msDate(j.date), Status: j.Status, Narration: j.Narration, LineAmountTypes: j.LineAmountTypes, ShowOnCashBasisReports: j.ShowOnCashBasisReports, JournalLines: j.JournalLines, _Date: j.date })).filter(f).map((j) => { delete j._Date; return j; }), p, 'ManualJournals'); }
// Xero Payroll AU (payroll.xro/1.0, raw JSON, /Date()/ dates). AU organisations only: the NZ organisation gets Xero's error.
const auOnly = (p) => { if (ORG[(p && p.xero_tenant_id) || T1].CountryCode !== 'AU') throw new Error('Xero API GET https://api.xero.com/payroll.xro/1.0/PayRuns 403: {"Message":"The organisation does not use Australian payroll"}'); };
function listPayRuns(p) {
  auOnly(p); const B = books(p.xero_tenant_id), runs = [];
  for (let k = 0; k < 26; k++) { const s0 = shiftMonths('2024-07-01', k, false), y = +s0.slice(0, 4), m = +s0.slice(5, 7), e0 = eom(y, m), wages = r2(4200 * (1 + k * 0.015) * B.O.scale);
    runs.push({ PayRunID: 'pr-' + s0.slice(0, 7), PayrollCalendarID: 'cal-monthly', PayRunPeriodStartDate: msDate(s0), PayRunPeriodEndDate: msDate(e0), PaymentDate: msDate(s0.slice(0, 8) + '28'), PayRunStatus: s0 >= '2026-08-01' ? 'DRAFT' : 'POSTED', Wages: wages, Deductions: 0, Tax: r2(wages * 0.18), Super: r2(wages * 0.115), Reimbursement: 0, NetPay: r2(wages * 0.82) }); }
  runs.sort((a, b) => b.PayRunID.localeCompare(a.PayRunID)); return page(runs, p, 'PayRuns');
}
function listTimesheets(p) {
  auOnly(p);
  const ts = [['ts-1', 'emp-1', '2026-08-03', '2026-08-09', 'APPROVED', 38], ['ts-2', 'emp-2', '2026-08-17', '2026-08-23', 'DRAFT', 35.5], ['ts-3', 'emp-3', '2026-08-24', '2026-08-30', 'DRAFT', 40], ['ts-4', 'emp-1', '2026-07-06', '2026-07-12', 'DRAFT', 38]]
    .map(([TimesheetID, EmployeeID, a, b, Status, Hours]) => ({ TimesheetID, EmployeeID, StartDate: msDate(a), EndDate: msDate(b), Status, Hours }));
  return page(ts, p, 'Timesheets');
}
function listEmployees(p) { auOnly(p); return page([['emp-1', 'Mia', 'Nguyen'], ['emp-2', 'Liam', 'Brown'], ['emp-3', 'Ava', 'Singh']].map(([EmployeeID, FirstName, LastName]) => ({ EmployeeID, FirstName, LastName, Status: 'ACTIVE' })), p, 'Employees'); }
// Xero Assets (assets.xro/1.0, camelCase, {pagination, items}); status is required by Xero.
function listAssets(p) {
  const B = books(p.xero_tenant_id), S = B.O.scale;
  const items = [{ assetId: 'as-1', assetName: 'Office Equipment', assetNumber: 'FA-0001', purchaseDate: '2024-07-01T00:00:00', purchasePrice: r2(8400 * S), assetStatus: 'Registered', accountingBookValue: r2(6720 * S), bookDepreciationDetail: { depreciationStartDate: '2024-07-01T00:00:00', priorAccumDepreciationAmount: r2(1680 * S), currentAccumDepreciationAmount: 0 } },
    { assetId: 'as-2', assetName: 'Laptop', assetNumber: 'FA-0002', purchaseDate: '2025-09-18T00:00:00', purchasePrice: r2(2400 * S), assetStatus: 'Registered', accountingBookValue: r2(2400 * S), bookDepreciationDetail: { depreciationStartDate: '2025-09-18T00:00:00', priorAccumDepreciationAmount: 0, currentAccumDepreciationAmount: 0 } },
    { assetId: 'as-3', assetName: 'Old printer', assetNumber: 'FA-0000', purchaseDate: '2020-01-10T00:00:00', purchasePrice: r2(600 * S), assetStatus: 'Disposed', accountingBookValue: 0 }].filter((a) => !p.status || a.assetStatus === p.status);
  return { pagination: { page: 1, pageSize: p.pageSize || 10, pageCount: 1, itemCount: items.length }, items };
}
// expected figures computed independently of the Xero JSON (for assertions)
const expect = {
  balances: (date, t) => balances(books(t), date), netProfit: (a, b, cash, t) => netProfit(books(t), a, b, cash), bankBalance: (code, date, t) => bankBalance(books(t), code, date),
  flows: (code, a, b, t) => flows(books(t), code, a, b), gst: (a, b, t) => gstMovement(books(t), a, b), plByAccount: (a, b, cash, t) => plByAccount(books(t), a, b, cash), books,
};
module.exports = { TODAY, T1, T2, ORG, ACCOUNTS, ACC, TRACKING, listTrackingCategories, getInvoice, pnl: pnlReport, bs: bsReport, bankSummary, trialBalance, listManualJournals, listPayRuns, listTimesheets, listEmployees, listAssets, listInvoices, listCreditNotes, listOverpayments, listPrepayments, listPayments, listBankTransactions, listPurchaseOrders, listLinked, listRepeating, listAccounts, listTaxRates, organisation, connections, expect, fyStart, addDays, shiftMonths, eom, r2 };

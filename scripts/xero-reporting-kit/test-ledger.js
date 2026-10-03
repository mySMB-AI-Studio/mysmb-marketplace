// Consistency of the ledger fixture (it must balance, or no dashboard tie means anything).
const L = require('./ledger.js'); const X = require('./xk-kit.js');
let fails = 0, total = 0; const ok = (n, c, i) => { total++; if (!c) { fails++; console.log('  FAIL ' + n + ' ' + JSON.stringify(i)); } };
for (const t of [L.T1, L.T2]) {
  for (const d of ['2024-07-31', '2025-03-15', '2025-06-30', '2025-07-01', '2026-01-31', '2026-06-30', '2026-08-31', '2026-09-25']) {
    const w = X.walk(L.bs({ date: d, xero_tenant_id: t })), f = (re) => X.val(X.find(w.lines, null, re, 'total'));
    const A = f(/^total assets$/i), Li = f(/^total liabilities$/i), E = X.val(X.find(w.lines, 'Equity', null, 'total'));
    ok('A = L + E ' + t.slice(-1) + ' ' + d, X.near(A, Li + E), [A, Li, E]);
    // Xero's Balance Sheet is at the END of the month asked for: compare it with the P&L and Bank Summary to that month end
    const me = L.eom(+d.slice(0, 4), +d.slice(5, 7)); ok('Balance Sheet for ' + d + ' is as at its month end (Xero)', L.bs({ date: d, xero_tenant_id: t }).Reports[0].ReportTitles[2] === 'As at ' + new Date(me + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), L.bs({ date: d, xero_tenant_id: t }).Reports[0].ReportTitles);
    const fy = L.fyStart(me, L.ORG[t].FinancialYearEndMonth), np = X.val(X.find(X.walk(L.pnl({ fromDate: fy, toDate: me, xero_tenant_id: t })).lines, null, /^net profit$/i, 'total'));
    ok('CYE = P&L ' + d, X.near(X.val(X.currentYearEarnings(w.lines)), np), [X.val(X.currentYearEarnings(w.lines)), np]);
    const bsum = X.walk(L.bankSummary({ fromDate: fy, toDate: me, xero_tenant_id: t })), tot = X.find(bsum.lines, null, /^total$/i, 'total');
    ok('Bank Summary closing = BS Total Bank ' + d, X.near(tot.values[3], f(/^total bank$/i) != null ? f(/^total bank$/i) : X.val(X.find(w.lines, null, /^total bank$/i, 'total'))), [tot.values, X.find(w.lines, null, /^total bank$/i, 'total')]);
    ok('Bank Summary: opening + received − spent = closing ' + d, X.near(tot.values[0] + tot.values[1] - tot.values[2], tot.values[3]), tot.values);
  }
  // AR on the BS today = open ACCREC invoices (AUTHORISED, dated ≤ today) − unallocated credits − overpayments
  const inv = L.listInvoices({ where: 'Type=="ACCREC"', statuses: 'AUTHORISED', xero_tenant_id: t }).Invoices.filter((i) => i.DateString.slice(0, 10) <= L.TODAY);
  const cn = L.listCreditNotes({ where: 'Type=="ACCRECCREDIT" AND Status=="AUTHORISED"', xero_tenant_id: t }).CreditNotes, op = L.listOverpayments({ where: 'Type=="RECEIVE-OVERPAYMENT" AND Status=="AUTHORISED"', xero_tenant_id: t }).Overpayments;
  const ar = X.sum(inv.map((i) => i.AmountDue)) - X.sum(cn.map((c) => c.RemainingCredit)) - X.sum(op.map((o) => o.RemainingCredit));
  ok('AR = open documents ' + t.slice(-1), X.near(ar, L.expect.balances(L.TODAY, t)['610']), [ar, L.expect.balances(L.TODAY, t)['610']]);
  const monthly = X.walk(L.pnl({ fromDate: '2026-08-01', toDate: '2026-08-31', periods: 11, timeframe: 'MONTH', xero_tenant_id: t }));
  const npl = X.find(monthly.lines, null, /^net profit$/i, 'total');
  ok('P&L periods=11 → 12 columns, Σ months = 12-month P&L', monthly.columns.length === 12 && X.near(X.sum(npl.values), L.expect.netProfit('2025-09-01', '2026-08-31', false, t)), [monthly.columns, X.sum(npl.values), L.expect.netProfit('2025-09-01', '2026-08-31', false, t)]);
}
const B = L.expect.books(L.T1);
console.log('docs', B.docs.length, 'payments', B.pays.length, 'bank tx', B.bank.length, '| open AR invoices', L.listInvoices({ where: 'Type=="ACCREC"', statuses: 'AUTHORISED' }).Invoices.length, '| BS today', JSON.stringify(L.expect.balances(L.TODAY)));
console.log(fails ? fails + '/' + total + ' FAILED' : 'ledger OK ' + total);
process.exit(fails ? 1 : 0);

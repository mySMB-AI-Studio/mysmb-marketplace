// CRA-11 Activity Count (QuickBooks): transaction counts by month across Invoice/Bill/Purchase/Payment/BillPayment/JournalEntry.
// The fixtures here APPLY the report's `where` clause and `maxResults` the way QuickBooks does, so the test proves the report
// asks for the period (live QA 2026-10-13: the first version sent an unfiltered "SELECT * FROM <entity>" with no MAXRESULTS —
// QuickBooks returns 100 rows by default, so a company with over 100 documents ever was silently undercounted — and said
// journals were "not in source" when list_journal_entry exists).
const U = require('./qb-test-util.js');
const { run, suite, F, text, banner, red } = U;
const manifest = require('../build.js').manifest('quickbooks/activity-count');
const REF = 'quickbooks/activity-count';
const Q = (entity, list) => ({ QueryResponse: { [entity]: list, startPosition: 1, maxResults: list.length } });
const journals = () => Q('JournalEntry', [{ Id: 'J1', TxnDate: '2026-07-15' }, { Id: 'J2', TxnDate: '2026-09-30' }, { Id: 'J3', TxnDate: '2026-06-30' }]);
// QuickBooks-like: keep rows whose TxnDate satisfies `where`, cap at maxResults (default 100, like the real API)
function applyWhere(fn) {
  return (p) => {
    const r = fn(p), qr = r.QueryResponse, ent = Object.keys(qr).find((k) => Array.isArray(qr[k]));
    const m = /TxnDate >= '([\d-]+)' AND TxnDate <= '([\d-]+)'/.exec((p && p.where) || '');
    let rows = qr[ent]; if (m) rows = rows.filter((x) => x.TxnDate >= m[1] && x.TxnDate <= m[2]);
    rows = rows.slice(0, (p && p.maxResults) || 100);
    return { QueryResponse: Object.assign({}, qr, { [ent]: rows, maxResults: rows.length }) };
  };
}
const fx = { invoices: applyWhere(F.invoices), bills: applyWhere(F.bills), purchases: applyWhere(F.purchasesMany), payments: applyWhere(F.payments),
  bill_payments: applyWhere(F.billPayments), journal_entries: applyWhere(journals), company_info: () => F.companyInfo, prefs: () => F.prefs };
const LISTS = ['invoices', 'bills', 'purchases', 'payments', 'bill_payments', 'journal_entries'];
const { ok, done } = suite('quickbooks/activity-count');
(async () => {
  const t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with a transaction-count table', text(t.doc, 'body').length > 0, text(t.doc, 'body').slice(0, 200));
  ok('every check passes, green', !red(t), banner(t).slice(0, 600));
  ok('months add up to each category total (checked)', banner(t).includes("✓ Months add up to each category's total for the period"), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', banner(t).includes('✓ Categories add up to the grand total'), banner(t).slice(0, 600));
  const calls = LISTS.map((id) => t.calls.find((c) => c.id === id) || { id });
  ok('every list is requested for the report period with MAXRESULTS 1000 (never an unfiltered query)',
    calls.every((c) => c.params && c.params.where === "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'" && c.params.maxResults === 1000), JSON.stringify(calls.map((c) => [c.id, c.tool, c.params])));
  // in Jul–Sep: 1 invoice, 2 bills (May is outside), 2 purchases + 2 payments + 1 bill payment, 2 journals (June is outside)
  ok('counts are the period’s: Sales 1, Purchases 2, Banking 5, Journals 2', /Sales 1, Purchases 2, Banking 5, Journals 2/.test(banner(t)), banner(t).slice(0, 600));
  ok('journals are counted (list_journal_entry), payroll alone reads N/A', !/no raw journal-entry list/.test(text(t.doc, 'body')) && /Payroll: N\/A/.test(text(t.doc, '#qb-body')), text(t.doc, '#qb-body').slice(0, 400));
  const capped = Object.assign({}, fx, { purchases: () => Q('Purchase', Array.from({ length: 1000 }, (_, i) => ({ Id: 'P' + i, TxnDate: '2026-08-01' }))) });
  const tc = await run(REF, manifest, capped);
  ok('a list at the 1000-row cap is a failed check, never a silent undercount', red(tc) && /Possibly truncated at 1000 rows: purchases/.test(banner(tc)), banner(tc).slice(0, 400));
  const f = await run(REF, manifest, fx, { fail: { invoices: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed activity source is never silent', text(f.doc, '#qb-body').includes('QuickBooks API error'), text(f.doc, '#qb-body').slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

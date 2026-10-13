// CRA-11 Activity Count (MYOB): transaction counts by month across sales, purchases, banking, journals and payroll.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green, red, common } = require('./lib.js');
const ID = 'activity-count';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(200);
  ok('opens green with a transaction-count table', green(t) && t.errs.length === 0, banner(t).slice(0, 600));
  ok('payroll is counted for this company file (pay advices exist)', /Payroll/.test(body(t)) && !/N\/A — no pay runs/.test(body(t)), body(t).slice(0, 300));
  ok('months add up to each category total (checked)', /✓ Months add up to each category's total for the period/.test(banner(t)), banner(t).slice(0, 600));
  ok('categories add up to the grand total (checked)', /✓ Categories add up to the grand total/.test(banner(t)), banner(t).slice(0, 600));
  // Definitions must match PRA-08 (get_practice_activity_count) so each client's figures reproduce in the practice report.
  // Live QA 2026-10-13 caught three mismatches the old checks never looked at: Open-only invoices/bills (the real tools
  // default to status Open; this ledger returns everything when no status is passed, which hid it), bank-feed statement
  // lines as "banking", and every ledger posting counted as a journal.
  const call = (id) => t.calls.find((x) => x.id === id) || {}, p = call('invoices').params || {};
  ok('invoices and bills are requested with status All (not the tools’ Open default)', call('invoices').params && call('invoices').params.status === 'All' && call('bills').params.status === 'All', JSON.stringify([call('invoices').params, call('bills').params]));
  ok('banking reads Spend Money + Customer Payments, not bank-feed statement lines', !!call('spend_money').tool && !!call('payments').tool && !t.calls.some((x) => x.tool === 'list_bank_statement_lines'), JSON.stringify(t.calls.map((x) => x.tool)));
  const q = { myob_company_file_id: L.CF1, from_date: p.from_date, to_date: p.to_date };
  const exp = { Sales: L.listInvoices(Object.assign({ status: 'All' }, q)).Items.length, Purchases: L.listBills(Object.assign({ status: 'All' }, q)).Items.length,
    Banking: L.listSpendMoney(q).Items.length + L.listPayments(Object.assign({ page_size: 1000 }, q)).Items.length,
    Journals: L.listJournalTransactions(q).Items.filter((j) => j.JournalType === 'General').length };
  const allJ = L.listJournalTransactions(q).Items.length;
  ok('the ledger fixture really mixes journal types (else the journals check proves nothing)', allJ > exp.Journals && exp.Journals > 0, allJ + ' postings, ' + exp.Journals + ' general');
  const got = {}; (banner(t).match(/(Sales|Purchases|Banking|Journals) (\d+)/g) || []).forEach((x) => { const [k, v] = x.split(' '); got[k] = +v; });
  ok('counts match PRA-08’s definitions: all-status sales/purchases, spend+receipts banking, general journals only', ['Sales', 'Purchases', 'Banking', 'Journals'].every((k) => got[k] === exp[k]), JSON.stringify({ got, exp }));
  const tr = await go(ID, { payments: (pp) => { const r = L.listPayments(pp); return { Count: r.Items.length + 500, Items: r.Items }; } }); await wait(200);
  ok('more customer payments than one page returned → a failed check, never a silent undercount', red(tr) && /Banking is undercounted/.test(banner(tr)), banner(tr).slice(0, 400));
  const f = await go(ID, null, { fail: { invoices: { code: 'tool_error', message: 'MYOB 500' } } });
  ok('a failed activity source is never silent', /MYOB 500/.test(body(f)), body(f).slice(0, 200));
  await common(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

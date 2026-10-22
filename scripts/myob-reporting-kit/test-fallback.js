// The opening bundle never arrives: on QA (19 Oct 2026) a large MYOB file passed the platform's 30-second gateway limit, the whole-report
// request failed and the viewer showed only a toast. Every kit report then loads each source on its own (mk-kit.js FALLBACK_MS): every
// binding once, the same page as a normal open, the inputs announced, a note under Sources & limitations, and a normal open never falls
// back. On the report with the most sources: at most 4 requests at a time, a timed-out source is a failed check, and a bundle that lands
// late takes over (the fallback's answers still out are dropped). node test-fallback.js [report]
const { run, hydrate, resolve } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const FAM = require('./families.js');
const man = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim();
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// every tool a kit report binds → the ledger's answer for it (as test-conformance.js)
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, get_profit_and_loss: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_contacts: L.listContacts, list_payments: L.listPayments, list_supplier_payments: L.listSupplierPayments, list_bank_statement_lines: L.listBankStatementLines, list_timesheets: L.listTimesheets, list_employee_leave_balances: L.listEmployeeLeaveBalances, list_inventory_adjustments: L.listInventoryAdjustments, list_job_register: L.listJobRegister, get_budget: L.getBudget, get_accounting_properties: L.getAccountingProperties, list_spend_money: L.listSpendMoney, list_suppliers: L.listSuppliers, list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions, list_tax_codes: L.listTaxCodes, get_aged_receivables: L.agedReceivables, get_aged_payables: L.agedPayables, get_gst_summary: L.taxCodeSummary, get_payroll_category_summary: L.payrollCategorySummary, list_invoice_lines: L.listInvoiceLines, list_bill_lines: L.listBillLines, list_items: L.listItems, list_payroll_advices: L.listPayrollAdvices };
const fixtures = (m) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return f; };
const withDefaults = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.forEach((i) => { if (i.name in set) i.default = set[i.name]; }); return c; };
const NOTE = /Loaded section by section \(the full load timed out\)/;
// the page without fetch times (a fallback's sources are fetched later than the test bundle's fixed time)
const page = (t) => ['header', '#mk-body', '#mk-banner ul'].map((q) => text(t.doc, q)).join(' | ').replace(/\d{1,2}:\d\d[ap]m \d{1,2} \w+ \d{4}/g, '<time>');
// answer each getData after `ms`, counting how many are open at once
function slow(t, ms) {
  const real = t.w.MyHubReport.getData, st = { open: 0, peak: 0, ids: [] };
  t.w.MyHubReport.getData = (id, inputs) => { st.open++; st.peak = Math.max(st.peak, st.open); st.ids.push(id); return wait(ms).then(() => real(id, inputs)).finally(() => { st.open--; }); };
  return st;
}
(async () => {
  const reports = [...new Set(FAM.map((f) => f.report))].filter((r) => !only || r === only);
  for (const r of reports) {
    const m = man(r), fx = fixtures(m), ids = m.bindings.map((b) => b.id);
    const a = await run(r, m, fx, { bundleInputs: true, fallbackMs: 20 }), n0 = a.calls.length; await wait(150);
    const b = await run(r, m, fx, { noBundle: true, fallbackMs: 20 }); await wait(250);
    const asked = b.calls.filter((x) => x.requery);
    ok(r + ': no bundle → every binding is requested once, on its own', asked.length === ids.length && ids.every((id) => asked.some((x) => x.id === id)) && !b.calls.some((x) => x.error),
      { missing: ids.filter((id) => !asked.some((x) => x.id === id)), asked: asked.length, of: ids.length, errors: b.calls.filter((x) => x.error).slice(0, 2) });
    ok(r + ': … the same page as a normal open (header, body, checks), with no script errors', page(b) === page(a) && b.errs.length === 0, { errs: b.errs.slice(0, 2), a: page(a).slice(0, 300), b: page(b).slice(0, 300) });
    ok(r + ': … announces its inputs and says so under Sources & limitations; a normal open does neither and never falls back', b.setInputsLog.length > 0 && NOTE.test(text(b.doc, '#mk-sources')) && !NOTE.test(text(a.doc, '#mk-sources')) && a.calls.length === n0,
      { said: b.setInputsLog.length, note: NOTE.test(text(b.doc, '#mk-sources')), extra: a.calls.length - n0 });
  }
  if (only) return finish();
  // ---- the report with the most sources
  const R = reports.map((r) => [r, man(r).bindings.length]).sort((x, y) => y[1] - x[1])[0][0], m = man(R), fx = fixtures(m), ids = m.bindings.map((b) => b.id);
  const c = await run(R, m, fx, { noBundle: true, fallbackMs: 60 }), st = slow(c, 25); await wait(60 + 25 * ids.length + 300);
  ok(R + ' (' + ids.length + ' sources): the fallback asks at most 4 at a time and still gets every source', st.peak === Math.min(4, ids.length) && ids.every((id) => st.ids.includes(id)) && st.ids.length === ids.length && c.errs.length === 0, { peak: st.peak, asked: st.ids.length });
  const key = m.bindings.find((x) => x.tool.name !== 'list_company_files').id;
  const d = await run(R, m, fx, { noBundle: true, fallbackMs: 20, fail: { [key]: { message: 'Failed to load live data (HTTP 504)' } } }); await wait(250);
  ok(R + ': a source that times out on its own is a failed check naming the timeout (never a silent gap)', /✗ .*MYOB returned an error for this section\. \(Failed to load live data \(HTTP 504\)\)/.test(text(d.doc, '#mk-banner')) && d.doc.getElementById('mk-banner').className.includes('fail'), text(d.doc, '#mk-banner').slice(0, 400));
  // a copy saved for company file 2: the fallback starts on the connection's default file, then the bundle lands late
  const m2 = withDefaults(m, { company_file: L.CF2 }), fx2 = fixtures(m2), e = await run(R, m2, fx2, { noBundle: true, fallbackMs: 40 }); slow(e, 120); await wait(40 + 40);
  const late = hydrate(m2, fx2, {}, null); late.inputs = resolve(m2, {}); e.w.MyHubReport._deliver(late); await wait(120 * ids.length + 500);
  const ref = await run(R, m2, fx2, { bundleInputs: true }); await wait(200);
  ok(R + ': a bundle that lands after the fallback started takes over: file 2 only, the fallback\'s late answers dropped, no fallback note', text(e.doc, 'header .co') === L.FILES[L.CF2].Name && page(e) === page(ref) && !NOTE.test(text(e.doc, '#mk-sources')),
    { head: text(e.doc, 'header .co'), same: page(e) === page(ref), note: NOTE.test(text(e.doc, '#mk-sources')) });
  finish();
})();
function finish() { console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`); process.exit(fails ? 1 : 0); }

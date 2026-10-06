// Library-wide conformance, run on every kit report against the ledger (ledger.js, two company files). node test-conformance.js [report]
// - LIB-002 cross-client isolation (Reporting Library Patch v1.2): switching company file refetches every MYOB binding for that file,
//   and nothing of the first file (its name or any of its figures) is left on the page or in the Excel download;
// - a template copy (artifact_from_template: the tested document unchanged, only the manifest defaults set) opened on company file 2
//   (and, for a period report, on other dates) shows that file and those dates only, and never asks for file 1 — the kit takes the
//   inputs the bundle ran at (bundle.inputs).
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const FAM = require('./families.js');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// every tool a kit report binds → the ledger's answer for it
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, get_profit_and_loss: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_contacts: L.listContacts, list_payments: L.listPayments, list_supplier_payments: L.listSupplierPayments, list_bank_statement_lines: L.listBankStatementLines, list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions, list_tax_codes: L.listTaxCodes, get_aged_receivables: L.agedReceivables, get_aged_payables: L.agedPayables, get_gst_summary: L.taxCodeSummary, get_payroll_category_summary: L.payrollCategorySummary, list_invoice_lines: L.listInvoiceLines, list_bill_lines: L.listBillLines, list_items: L.listItems, list_payroll_advices: L.listPayrollAdvices };
const fixtures = (m) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return f; };
const figures = (s) => new Set((s.match(/\(?\$[\d,]+\.\d\d\)?/g) || []).filter((x) => +x.replace(/[^\d.]/g, '') >= 1000));
const N1 = L.FILES[L.CF1].Name, N2 = L.FILES[L.CF2].Name;
const report = (doc) => ['header', '#mk-banner', '#mk-body', '#mk-foot', '#mk-sources'].map((q) => text(doc, q)).join(' ');
const xlsxText = async (t) => { const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
const withDefaults = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.forEach((i) => { if (i.name in set) i.default = set[i.name]; }); return c; };
const done = new Set();
(async () => {
  for (const f of FAM) {
    if ((only && only !== f.report) || done.has(f.report)) continue; done.add(f.report);
    // a report with no company figures (the catalogue: only list_company_files) still takes the client from its company_file input
    const m = man(f.report), cfIn = (m.bindings.map((b) => (b.params || {}).myob_company_file_id).filter((p) => p && p.kind === 'input')[0] || {}).input || (m.inputs.find((i) => i.name === 'company_file') || {}).name;
    ok(f.report + ': every MYOB binding is scoped to the chosen company file', !!cfIn && m.bindings.every((b) => b.tool.name === 'list_company_files' || ((b.params || {}).myob_company_file_id || {}).input === cfIn), m.bindings.filter((b) => b.tool.name !== 'list_company_files' && !((b.params || {}).myob_company_file_id)).map((b) => b.id));
    // ---- LIB-002: open on file 1, switch to file 2
    const m1 = withDefaults(m, { [cfIn]: L.CF1 }), t = await run(f.report, m1, fixtures(m1), { bundleInputs: true }); await wait(80);
    const page1 = report(t.doc);
    ok(f.report + ': opens on company file 1 by name', text(t.doc, 'header .co') === N1 && t.errs.length === 0, { head: text(t.doc, 'header .co'), errs: t.errs.slice(0, 2) });
    const before = t.calls.length, sel = t.doc.getElementById('mk-client');
    ok(f.report + ': the client selector lists the connection\'s company files', sel && [...sel.options].map((o) => o.textContent).join('|').includes(N1 + '|' + N2), sel && [...sel.options].map((o) => o.textContent));
    sel.value = L.CF2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(120);
    const re = t.calls.slice(before).filter((x) => x.params), scoped = m.bindings.filter((b) => b.tool.name !== 'list_company_files').map((b) => b.id);
    ok(f.report + ': switching refetches every MYOB binding for file 2 only', scoped.every((id) => re.some((x) => x.id === id && x.params.myob_company_file_id === L.CF2)) && !re.some((x) => x.params.myob_company_file_id && x.params.myob_company_file_id !== L.CF2), scoped.filter((id) => !re.some((x) => x.id === id && x.params.myob_company_file_id === L.CF2)));
    const m2 = withDefaults(m, { [cfIn]: L.CF2 }), t2 = await run(f.report, m2, fixtures(m2), { bundleInputs: true }); await wait(80);
    const page2 = report(t.doc), f1 = figures(page1), f2 = figures(report(t2.doc)), left = [...figures(page2)].filter((x) => f1.has(x) && !f2.has(x));
    ok(f.report + ': after the switch the page shows file 2 and nothing of file 1 (name or figures)', text(t.doc, 'header .co') === N2 && !page2.includes(N1) && left.length === 0, { head: text(t.doc, 'header .co'), left: left.slice(0, 6), hasN1: page2.includes(N1) });
    t.doc.getElementById('mk-xlsx').click(); await t.settle();
    const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs = await xlsxText(t);
    ok(f.report + ': the Excel download after the switch carries only file 2', name.startsWith(N2 + ' - ') && xs.includes(N2) && !xs.includes(N1), name);
    // ---- template copy on file 2 (and other dates for a period report), document unchanged
    const disp = m.inputs.find((i) => i.name === 'display'), d = JSON.parse(disp.default); if (d.p) d.p = 'custom'; d.cents = d.cents ? 0 : 1;
    const set = { [cfIn]: L.CF2, display: JSON.stringify(d) }, hasRange = m.inputs.some((i) => i.name === 'from_date'); if (hasRange) Object.assign(set, { from_date: '2026-08-01', to_date: '2026-08-31' });
    const mc = withDefaults(m, set), c = await run(f.report, mc, fixtures(mc), { bundleInputs: true }); await wait(120);
    const asked = c.calls.filter((x) => x.params && x.params.myob_company_file_id !== undefined), said = c.setInputsLog[0] || {};
    ok(f.report + ': a template copy set to file 2' + (hasRange ? ' and August' : '') + ' opens on it only (name, every call, announced inputs, header)', text(c.doc, 'header .co') === N2 && asked.every((x) => x.params.myob_company_file_id === L.CF2) && said[cfIn] === L.CF2 && JSON.parse(said.display || '{}').cents === d.cents && (!hasRange || (said.from_date === '2026-08-01' && /August 2026/.test(text(c.doc, 'header .pe')))) && c.errs.length === 0,
      { head: text(c.doc, 'header'), wrong: asked.filter((x) => x.params.myob_company_file_id !== L.CF2).map((x) => x.id), said: [said[cfIn], said.from_date], errs: c.errs.slice(0, 2) });
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

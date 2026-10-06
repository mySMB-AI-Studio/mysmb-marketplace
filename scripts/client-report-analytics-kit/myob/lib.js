// Shared test helpers for the MYOB Client Report Analytics reports: the ledger's answer for every tool (the MYOB kit's ledger.js, two
// company files CF1 / CF2), page helpers, and the LIB-002 conformance run copied from the MYOB kit's test-conformance.js.
const { run } = require('../harness.js');
const L = require('../../myob-reporting-kit/ledger.js');
const fs = require('fs'), path = require('path');
const man = (id) => JSON.parse(fs.readFileSync(path.join(__dirname, id + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// list_spend_money: the connector returns each line's tax code (myhub-mcp-servers methods.ts listSpendMoney picks Lines[].TaxCode); the
// ledger leaves it null, so give each line the code the ledger's own tax code summary uses for it (GST when the payment carries GST,
// else the account's default code; balance-sheet lines N-T), so the lines and the summary come from one set of books.
const DEF = { '6-5130': 'N-T', '6-5140': 'N-T', '6-2500': 'ITS', '8-1000': 'ITS', '9-1000': 'ITS', '1-2110': 'CAP' };
const codeUid = (cf, code) => (L.listTaxCodes({ myob_company_file_id: cf }).Items.find((t) => t.Code === code) || {}).UID;
function spendMoney(p) {
  const r = L.listSpendMoney(p), cf = p.myob_company_file_id || L.CF1;
  r.Items.forEach((t) => t.Lines.forEach((l) => { const id = l.Account.DisplayID, pl = /^[4-9]-/.test(id), code = !pl ? 'N-T' : t.TotalTax > 0 ? 'GST' : DEF[id] || 'GST'; l.TaxCode = { UID: codeUid(cf, code), Code: code }; }));
  return r;
}
const TOOL = { get_profit_and_loss: L.profitAndLoss, get_profit_and_loss_3m: L.profitAndLoss, get_balance_sheet: L.balanceSheet, list_accounts: L.listAccounts, list_company_files: L.companyFiles,
  list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions, list_tax_codes: L.listTaxCodes, get_aged_receivables: L.agedReceivables, get_aged_payables: L.agedPayables,
  get_gst_summary: L.taxCodeSummary, list_invoice_lines: L.listInvoiceLines, list_bill_lines: L.listBillLines, list_spend_money: spendMoney, list_payments: L.listPayments, list_supplier_payments: L.listSupplierPayments };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const withDefaults = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.forEach((i) => { if (i.name in set) i.default = set[i.name]; }); return c; };
const banner = (t) => text(t.doc, '#mk-banner'), body = (t) => text(t.doc, '#mk-body');
const green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const xlsxText = async (t) => { const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
// open a report on company file 1 (or `set` inputs), with optional tool overrides
async function go(id, over, opts, set) { const m = withDefaults(man(id), Object.assign({ company_file: L.CF1 }, set || {})); const t = await run('myob/' + id, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(opts && opts.wait || 120); t.m = m; return t; }

// LIB-002 (Reporting Library Patch v1.2) — the MYOB kit's conformance test, for one CRA report.
const figures = (s) => new Set((s.match(/\(?\$[\d,]+\.\d\d\)?/g) || []).filter((x) => +x.replace(/[^\d.]/g, '') >= 1000));
const N1 = L.FILES[L.CF1].Name, N2 = L.FILES[L.CF2].Name;
const page = (doc) => ['header', '#mk-banner', '#mk-body', '#mk-foot', '#mk-sources'].map((q) => text(doc, q)).join(' ');
async function conformance(id, ok, range) {
  const m = man(id), cfIn = 'company_file';
  ok(id + ': every MYOB binding is scoped to the chosen company file', m.bindings.every((b) => b.tool.name === 'list_company_files' || ((b.params || {}).myob_company_file_id || {}).input === cfIn), m.bindings.filter((b) => b.tool.name !== 'list_company_files' && !((b.params || {}).myob_company_file_id)).map((b) => b.id));
  const m1 = withDefaults(m, { [cfIn]: L.CF1 }), t = await run('myob/' + id, m1, FX(m1), { bundleInputs: true }); await wait(150);
  const page1 = page(t.doc);
  ok(id + ': opens on company file 1 by name', text(t.doc, 'header .co') === N1 && t.errs.length === 0, { head: text(t.doc, 'header .co'), errs: t.errs.slice(0, 2) });
  const before = t.calls.length, sel = t.doc.getElementById('mk-client');
  ok(id + ': the client selector lists the connection\'s company files', sel && [...sel.options].map((o) => o.textContent).join('|').includes(N1 + '|' + N2), sel && [...sel.options].map((o) => o.textContent));
  sel.value = L.CF2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(250);
  const re = t.calls.slice(before).filter((x) => x.params), scoped = m.bindings.filter((b) => b.tool.name !== 'list_company_files').map((b) => b.id);
  ok(id + ': switching refetches every MYOB binding for file 2 only', scoped.every((b) => re.some((x) => x.id === b && x.params.myob_company_file_id === L.CF2)) && !re.some((x) => x.params.myob_company_file_id && x.params.myob_company_file_id !== L.CF2), scoped.filter((b) => !re.some((x) => x.id === b && x.params.myob_company_file_id === L.CF2)));
  const m2 = withDefaults(m, { [cfIn]: L.CF2 }), t2 = await run('myob/' + id, m2, FX(m2), { bundleInputs: true }); await wait(250);
  const page2 = page(t.doc), f1 = figures(page1), f2 = figures(page(t2.doc)), left = [...figures(page2)].filter((x) => f1.has(x) && !f2.has(x));
  ok(id + ': after the switch the page shows file 2 and nothing of file 1 (name or figures)', text(t.doc, 'header .co') === N2 && !page2.includes(N1) && left.length === 0 && f1.size > 0, { head: text(t.doc, 'header .co'), left: left.slice(0, 6), hasN1: page2.includes(N1), n1: f1.size });
  t.doc.getElementById('mk-xlsx').click(); await t.settle();
  const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs = await xlsxText(t);
  ok(id + ': the Excel download after the switch carries only file 2', name.startsWith(N2 + ' - ') && xs.includes(N2) && !xs.includes(N1), name);
  const d = JSON.parse(m.inputs.find((i) => i.name === 'display').default); d.p = 'custom'; d.cents = d.cents ? 0 : 1;
  const set = Object.assign({ [cfIn]: L.CF2, display: JSON.stringify(d) }, range || { from_date: '2026-08-01', to_date: '2026-08-31' });
  const mc = withDefaults(m, set), c = await run('myob/' + id, mc, FX(mc), { bundleInputs: true }); await wait(250);
  const asked = c.calls.filter((x) => x.params && x.params.myob_company_file_id !== undefined), said = c.setInputsLog[0] || {};
  ok(id + ': a template copy set to file 2 and other dates opens on them only (name, every call, announced inputs, header)', text(c.doc, 'header .co') === N2 && asked.length > 0 && asked.every((x) => x.params.myob_company_file_id === L.CF2) && said[cfIn] === L.CF2 && JSON.parse(said.display || '{}').cents === d.cents && said.from_date === set.from_date && c.errs.length === 0,
    { head: text(c.doc, 'header'), wrong: asked.filter((x) => x.params.myob_company_file_id !== L.CF2).map((x) => x.id), said: [said[cfIn], said.from_date], errs: c.errs.slice(0, 2) });
  return { t, c };
}
// common kit behaviour every CRA report keeps: mySMB branding by default with the platform named, dark theme, snapshot mode, downloads
async function common(id, ok, checkName) {
  const t = await go(id);
  ok(id + ': mySMB branding by default, MYOB named in the header', t.doc.documentElement.classList.contains('style-mysmb') && /mySMB/.test(text(t.doc, 'header .mk-src')) && /MYOB/.test(text(t.doc, 'header')), text(t.doc, 'header'));
  const br = t.doc.getElementById('mk-branding'); br.value = 'myob'; br.dispatchEvent(new t.w.Event('change')); await wait(60);
  ok(id + ': MYOB branding stays available under Customise', !t.doc.documentElement.classList.contains('style-mysmb') && /Prepared from MYOB Business/.test(text(t.doc, 'header')));
  t.doc.getElementById('mk-pdf').click(); t.doc.getElementById('mk-xlsx').click(); await wait(40);
  const xs = await xlsxText(t);
  ok(id + ': Download PDF prints; Download Excel writes a workbook with the header block, Validation and Parameters sheets', t.downloads.some((x) => x.print) && /\.xlsx$/.test((t.downloads.filter((x) => x.name).pop() || {}).name || '') && xs.includes('Validation') && xs.includes('Parameters') && xs.includes(N1) && /Basis: /.test(xs));
  const dk = await go(id, null, { theme: 'dark' });
  ok(id + ': dark theme renders without errors', dk.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && dk.errs.length === 0 && green(dk), banner(dk).slice(0, 300));
  const sn = await go(id, null, { mode: 'snapshot' });
  ok(id + ': snapshot mode disables the data controls and still validates', sn.doc.getElementById('mk-from').disabled && sn.doc.getElementById('mk-client').disabled && !/✗/.test(banner(sn)) && sn.errs.length === 0, banner(sn).slice(0, 300));
  return t;
}
module.exports = { L, E: L.expect, run, man, text, wait, FX, go, withDefaults, banner, body, green, red, fmt, xlsxText, conformance, common, spendMoney, N1, N2 };

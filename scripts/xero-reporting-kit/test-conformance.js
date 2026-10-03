// Library-wide conformance, run on every kit report against the ledger (ledger.js):
// - LIB-002 cross-client isolation (Reporting Library Patch v1.2): switching organisation refetches every Xero binding for
//   that organisation, and nothing of the first organisation (its name or any of its figures) is left on the page or in
//   the Excel download;
// - a template copy (artifact_from_template: the tested document unchanged, only the manifest defaults set) opened on
//   organisation 2 shows organisation 2 only, and never refetches organisation 1;
// - the library's Excel contract: header block = report name / organisation / period / basis + currency, #,##0.00 with
//   negatives in brackets, and a file name without empty parts.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const DIR = process.env.KIT_DIR || __dirname, FAM = require('./families.js');
const man = (n) => JSON.parse(fs.readFileSync(path.join(DIR, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// every tool a kit report binds → the ledger's answer for it
const TOOL = { get_profit_and_loss: L.pnl, get_balance_sheet: L.bs, get_bank_summary: L.bankSummary, get_trial_balance: L.trialBalance, list_invoices: L.listInvoices, list_credit_notes: L.listCreditNotes, list_overpayments: L.listOverpayments, list_prepayments: L.listPrepayments, list_payments: L.listPayments, list_bank_transactions: L.listBankTransactions, list_purchase_orders: L.listPurchaseOrders, list_linked_transactions: L.listLinked, list_repeating_invoices: L.listRepeating, list_accounts: L.listAccounts, list_tax_rates: L.listTaxRates, list_manual_journals: L.listManualJournals, list_pay_runs: L.listPayRuns, list_timesheets: L.listTimesheets, list_assets: L.listAssets, list_tracking_categories: L.listTrackingCategories, list_journals: L.listJournals, get_invoice: L.getInvoice, list_bank_transfers: L.listBankTransfers, get_organisation: L.organisation, list_connections: L.connections };
const fixtures = (m) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return f; };
// the figures on a page: every money amount of $1,000 or more (smaller ones can coincide between two sets of books)
const figures = (s) => new Set((s.match(/\(?\$[\d,]+\.\d\d\)?/g) || []).filter((x) => +x.replace(/[^\d.]/g, '') >= 1000));
const xlsxText = async (t) => { const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
const rowText = (sheet, r) => ((sheet.match(new RegExp('<row r="' + r + '">([\\s\\S]*?)</row>')) || [])[1] || '').replace(/<[^>]+>/g, '');
const N1 = L.ORG[L.T1].Name, N2 = L.ORG[L.T2].Name;
// the report itself, without the controls (the organisation picker lists every organisation by design)
const report = (doc) => ['#xk-head', '#xk-banner', '#xk-body', '#xk-foot', '#xk-sources'].map((q) => text(doc, q)).join(' ');
// the same report opened directly on organisation 2: a figure on the switched page that organisation 1 showed is a leak only if organisation 2's own report doesn't show it
const onlyT2 = (fx) => { const g = {}; Object.keys(fx).forEach((k) => { g[k] = fx[k] === L.connections ? () => Object.assign(L.connections(), { activeTenantId: L.T2 }) : (q) => fx[k](Object.assign({}, q, { xero_tenant_id: L.T2 })); }); return g; };

(async () => {
  for (const f of FAM) {
    if (only && only !== f.report) continue;
    const m = man(f.report), t = await run(f.report, m, fixtures(m)); await wait(60);
    const page1 = report(t.doc);
    // ---- Excel contract (organisation 1)
    t.doc.getElementById('xk-xlsx').click(); await t.settle();
    const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs = await xlsxText(t), sh = (xs.match(/<worksheet[\s\S]*?<\/worksheet>/) || [''])[0];
    ok(f.report + ': Excel file name = organisation - report[ - dates].xlsx, no empty parts', name.startsWith(N1 + ' - ') && !/ - \.xlsx$/.test(name) && !/ -  - /.test(name), name);
    ok(f.report + ': Excel header block = report name / organisation / period / basis + currency', rowText(sh, 1) !== '' && rowText(sh, 2) === N1 && rowText(sh, 3) !== '' && /AUD$/.test(rowText(sh, 4)), [rowText(sh, 1), rowText(sh, 2), rowText(sh, 3), rowText(sh, 4)]);
    ok(f.report + ': Excel amounts #,##0.00 with negatives in brackets', xs.includes('formatCode="#,##0.00;(#,##0.00)"'));
    // ---- LIB-002: switch to organisation 2
    const before = t.calls.length, sel = t.doc.getElementById('xk-client');
    ok(f.report + ': organisation picker lists the connection\'s organisations (first control)', sel && [...sel.options].map((o) => o.textContent).join('|') === N1 + '|' + N2 && t.doc.querySelector('#xk-controls select') === sel, sel && [...sel.options].map((o) => o.textContent));
    sel.value = L.T2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); await wait(120);
    const re = t.calls.slice(before).filter((x) => x.params), orgBound = m.bindings.filter((b) => b.tool.name !== 'list_connections').map((b) => b.id);
    ok(f.report + ': switching refetches every Xero binding for the new organisation only', orgBound.every((id) => re.some((x) => x.id === id && x.params.xero_tenant_id === L.T2)) && !re.some((x) => x.params.xero_tenant_id && x.params.xero_tenant_id !== L.T2), orgBound.filter((id) => !re.some((x) => x.id === id && x.params.xero_tenant_id === L.T2)));
    const page2 = report(t.doc), t3 = await run(f.report, m, onlyT2(fixtures(m))); await wait(60);
    const f1 = figures(page1), f3 = figures(report(t3.doc)), left = [...figures(page2)].filter((x) => f1.has(x) && !f3.has(x));
    ok(f.report + ': after the switch the page shows organisation 2 and nothing of organisation 1 (name or figures)', text(t.doc, '#xk-head .co') === N2 && !page2.includes(N1) && left.length === 0, { head: text(t.doc, '#xk-head'), left: left.slice(0, 8), hasN1: page2.includes(N1) });
    t.doc.getElementById('xk-xlsx').click(); await t.settle();
    const name2 = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs2 = await xlsxText(t);
    ok(f.report + ': the Excel download after the switch carries only organisation 2', name2.startsWith(N2 + ' - ') && xs2.includes(N2) && !xs2.includes(N1), name2);
    ok(f.report + ': no script errors', t.errs.length === 0, t.errs.slice(0, 3));
    ok(f.report + ': the copy checks itself against the tested version (a good copy passes)', t.w.__xkIntegrity && t.w.__xkIntegrity.ok === true && !t.doc.querySelector('body > .xk-banner.fail'), t.w.__xkIntegrity);
    { // template copy: manifest default org = organisation 2, document unchanged (its config still says org ''); the bundle says which inputs it ran at
      const orgIn = (m.bindings.map((b) => (b.params || {}).xero_tenant_id).filter((p) => p && p.kind === 'input')[0] || {}).input;
      const m2 = JSON.parse(JSON.stringify(m)); m2.inputs.forEach((i) => { if (i.name === orgIn) i.default = L.T2; });
      const c = await run(f.report, m2, fixtures(m2), { bundleInputs: true }); await wait(120);
      const asked = c.calls.filter((x) => x.params && x.params.xero_tenant_id !== undefined), page = report(c.doc), f1 = figures(page1), f3 = figures(report(t3.doc)), left = [...figures(page)].filter((x) => f1.has(x) && !f3.has(x));
      ok(f.report + ': a template copy set to organisation 2 opens on organisation 2 only (name, figures, every call)', !!orgIn && text(c.doc, '#xk-head .co') === N2 && !page.includes(N1) && left.length === 0 && asked.every((x) => x.params.xero_tenant_id === L.T2) && (c.setInputsLog[0] || {})[orgIn] === L.T2 && c.errs.length === 0,
        { orgIn, head: text(c.doc, '#xk-head'), left: left.slice(0, 8), wrong: asked.filter((x) => x.params.xero_tenant_id !== L.T2).map((x) => x.id), announced: (c.setInputsLog[0] || {})[orgIn], errs: c.errs.slice(0, 2) }); }
    { const d = await run(f.report, m, fixtures(m), { htmlPatch: (h) => { const i = h.indexOf('isFinite('); return i < 0 ? h.replace('Math.round', 'Math.floor') : h.slice(0, i) + 'isfinite(' + h.slice(i + 9); } }); await wait(60);
      ok(f.report + ': a copy with one character changed is flagged in red at the top (damaged — create it again)', d.w.__xkIntegrity && d.w.__xkIntegrity.ok === false && /This copy of the report is damaged/.test(text(d.doc, 'body > .xk-banner.fail')), d.w.__xkIntegrity); }
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

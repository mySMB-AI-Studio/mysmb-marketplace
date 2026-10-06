// Shared test helpers for the Xero CRA reports: every binding is answered by the Xero kit's ledger (one set of books per
// organisation, T1 / T2), so cross-report ties hold by construction and a tampered source must fail. Also the LIB-002
// conformance pass (a copy of the Xero kit's test-conformance.js shape) and the size limits from the Xero kit README.
const fs = require('fs'), path = require('path');
const { run } = require('../harness.js');
const build = require('../build.js');
const L = require('../../xero-reporting-kit/ledger.js');
const TOOL = { get_profit_and_loss: L.pnl, get_balance_sheet: L.bs, get_bank_summary: L.bankSummary, get_trial_balance: L.trialBalance, list_invoices: L.listInvoices, list_credit_notes: L.listCreditNotes, list_overpayments: L.listOverpayments, list_payments: L.listPayments, list_bank_transactions: L.listBankTransactions, list_accounts: L.listAccounts, list_tax_rates: L.listTaxRates, get_organisation: L.organisation, list_connections: L.connections };
const man = (id) => build.manifest('xero/' + id);
const fixtures = (m, over) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#xk-banner'), body = (t) => text(t.doc, '#xk-body');
const green = (t) => t.doc.querySelector('#xk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#xk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); await wait(40); };
const retryFast = (h) => h.replace(/XK\.app\(\{\n  title:/, 'XK.app({\n  retryMs: 1, title:');
const busy = (fn, n) => { let left = n; return (q) => { if (left-- > 0) throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/x 429: {"Title":"Too Many Requests"}'); return fn(q); }; };
const tamper = (base, fn) => (q) => { const r = base(q); fn(r.Reports[0].Rows, r, q); return r; };
const cellOf = (rows, label) => { for (const r of rows) { for (const k of r.Rows || [r]) if (k.Cells && String(k.Cells[0].Value).startsWith(label)) return k.Cells; } return null; };
const xlsxOf = async (t) => { t.doc.getElementById('xk-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
// a list that is never short: 100 rows on every page (the kit stops at 20 pages and must say so)
const endless = (fn, key) => (q) => { const r = fn(Object.assign({}, q, { page: 1 })), base = r[key][0]; r[key] = []; for (let i = 0; i < 100; i++) r[key].push(Object.assign({}, base, { InvoiceID: 'e-' + (q.page || 1) + '-' + i, CreditNoteID: 'e-' + (q.page || 1) + '-' + i })); return r; };

// Size limits (Xero kit README): document + dataBindings ≤ 35,000 tokens, no line over 1,500 characters.
function sizes(id) {
  const html = build('xero/' + id), mf = JSON.stringify(man(id), null, 2);
  let tokens = null; try { tokens = require(path.join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer')).countTokens(html + mf); } catch (e) { tokens = null; }
  const longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
  return { tokens, longest, bytes: html.length };
}

// LIB-002 conformance (the Xero kit's test-conformance.js, on this kit's harness).
const N1 = L.ORG[L.T1].Name, N2 = L.ORG[L.T2].Name;
const figures = (s) => new Set((s.match(/\(?\$[\d,]+\.\d\d\)?/g) || []).filter((x) => +x.replace(/[^\d.]/g, '') >= 1000));
const xlsxText = async (t) => { const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
const rowText = (sheet, r) => ((sheet.match(new RegExp('<row r="' + r + '">([\\s\\S]*?)</row>')) || [])[1] || '').replace(/<[^>]+>/g, '');
const report = (doc) => ['#xk-head', '#xk-banner', '#xk-body', '#xk-foot', '#xk-sources'].map((q) => text(doc, q)).join(' ');
const onlyT2 = (fx) => { const g = {}; Object.keys(fx).forEach((k) => { g[k] = fx[k] === L.connections ? () => Object.assign(L.connections(), { activeTenantId: L.T2 }) : (q) => fx[k](Object.assign({}, q, { xero_tenant_id: L.T2 })); }); return g; };
async function conformance(id, ok) {
  const ref = 'xero/' + id, m = man(id), t = await run(ref, m, fixtures(m)); await wait(150);
  const page1 = report(t.doc);
  t.doc.getElementById('xk-xlsx').click(); await t.settle();
  const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs = await xlsxText(t), sh = (xs.match(/<worksheet[\s\S]*?<\/worksheet>/) || [''])[0];
  ok(id + ': Excel file name = organisation - report - dates.xlsx, no empty parts', name.startsWith(N1 + ' - ') && !/ - \.xlsx$/.test(name) && !/ -  - /.test(name), name);
  ok(id + ': Excel header block = report name / organisation / period / basis + currency', rowText(sh, 1) !== '' && rowText(sh, 2) === N1 && rowText(sh, 3) !== '' && /AUD$/.test(rowText(sh, 4)), [rowText(sh, 1), rowText(sh, 2), rowText(sh, 3), rowText(sh, 4)]);
  ok(id + ': Excel amounts #,##0.00 with negatives in brackets', xs.includes('formatCode="#,##0.00;(#,##0.00)"'));
  const before = t.calls.length, sel = t.doc.getElementById('xk-client');
  ok(id + ': client picker (LIB-002) lists the connection\'s organisations, first control', sel && [...sel.options].map((o) => o.textContent).join('|') === N1 + '|' + N2 && t.doc.querySelector('#xk-controls select') === sel);
  sel.value = L.T2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); await wait(200);
  const re = t.calls.slice(before).filter((x) => x.params), orgBound = m.bindings.filter((b) => b.tool.name !== 'list_connections').map((b) => b.id);
  ok(id + ': switching client refetches every Xero binding for the new organisation only', orgBound.every((b) => re.some((x) => x.id === b && x.params.xero_tenant_id === L.T2)) && !re.some((x) => x.params.xero_tenant_id && x.params.xero_tenant_id !== L.T2), orgBound.filter((b) => !re.some((x) => x.id === b && x.params.xero_tenant_id === L.T2)));
  const page2 = report(t.doc), t3 = await run(ref, m, onlyT2(fixtures(m))); await wait(150);
  const f1 = figures(page1), f3 = figures(report(t3.doc)), left = [...figures(page2)].filter((x) => f1.has(x) && !f3.has(x));
  ok(id + ': after the switch the page shows organisation 2 and nothing of organisation 1 (name or figures)', text(t.doc, '#xk-head .co') === N2 && !page2.includes(N1) && left.length === 0, { head: text(t.doc, '#xk-head'), left: left.slice(0, 8) });
  t.doc.getElementById('xk-xlsx').click(); await t.settle();
  const name2 = (t.downloads.filter((d) => d.name).pop() || {}).name || '', xs2 = await xlsxText(t);
  ok(id + ': the Excel after the switch carries only organisation 2', name2.startsWith(N2 + ' - ') && xs2.includes(N2) && !xs2.includes(N1), name2);
  ok(id + ': no script errors', t.errs.length === 0 && t3.errs.length === 0, t.errs.concat(t3.errs).slice(0, 3));
  ok(id + ': the copy checks itself against the tested version (a good copy passes)', t.w.__xkIntegrity && t.w.__xkIntegrity.ok === true);
  { const m2 = JSON.parse(JSON.stringify(m)); m2.inputs.forEach((i) => { if (i.name === 'org') i.default = L.T2; });
    const c = await run(ref, m2, fixtures(m2), { bundleInputs: true }); await wait(200);
    const asked = c.calls.filter((x) => x.params && x.params.xero_tenant_id !== undefined), page = report(c.doc), lf = [...figures(page)].filter((x) => f1.has(x) && !f3.has(x));
    ok(id + ': a template copy set to organisation 2 opens on organisation 2 only (name, figures, every call)', text(c.doc, '#xk-head .co') === N2 && !page.includes(N1) && lf.length === 0 && asked.every((x) => x.params.xero_tenant_id === L.T2) && (c.setInputsLog[0] || {}).org === L.T2 && c.errs.length === 0, { head: text(c.doc, '#xk-head'), left: lf.slice(0, 5), wrong: asked.filter((x) => x.params.xero_tenant_id !== L.T2).map((x) => x.id) }); }
  { const d = await run(ref, m, fixtures(m), { htmlPatch: (h) => { const i = h.indexOf('isFinite('); return h.slice(0, i) + 'isfinite(' + h.slice(i + 9); } }); await wait(60);
    ok(id + ': a copy with one character changed is flagged as damaged', d.w.__xkIntegrity && d.w.__xkIntegrity.ok === false && /This copy of the report is damaged/.test(text(d.doc, 'body > .xk-banner.fail'))); }
  const sz = sizes(id);
  ok(id + ': size limits — document + dataBindings ≤ 35,000 tokens, no line over 1,500 characters', sz.tokens != null && sz.tokens <= 35000 && sz.longest <= 1500, sz);
  return sz;
}
module.exports = { L, E: L.expect, run, man, fixtures, text, wait, banner, body, green, red, fmt, set, retryFast, busy, tamper, cellOf, xlsxOf, endless, conformance, sizes };

// Ledger reports that were written specifications: Journal Entries (M09) and Categories Transactions (M11) — the General ledger's
// journal and category views — Categories List (M10, the Trial balance's chart view) and Contacts (M12), against the ledger.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_journal_transactions: L.listJournalTransactions, list_accounts: L.listAccounts, get_balance_sheet: L.balanceSheet, get_profit_and_loss_3m: L.profitAndLoss, get_profit_and_loss: L.profitAndLoss, list_company_files: L.companyFiles, list_contacts: L.listContacts, list_invoices: L.listInvoices, list_bills: L.listBills };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const said = (t) => t.setInputsLog[t.setInputsLog.length - 1] || {};
const xlsx = async (t) => { t.doc.getElementById('mk-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };
const disp = (r, patch) => { const d = JSON.parse(man(r).inputs.find((i) => i.name === 'display').default); return JSON.stringify(Object.assign(d, patch)); };
(async () => {
  // ---------------- Journal Entries (M09)
  let t = await go('je');
  const P = { from_date: said(t).from_date, to_date: said(t).to_date, myob_company_file_id: L.CF1 }, TX = L.listJournalTransactions(P).Items;
  ok('journal entries: opens on its own title, 3/3 checks (balances, Balance Sheet tie, P&L tie)', t.errs.length === 0 && text(t.doc, 'header .ti') === 'Journal Entries' && green(t) && /3\/3 checks passed/.test(banner(t)), [t.errs, text(t.doc, 'header .ti'), banner(t).slice(0, 300)]);
  const blocks = [...t.doc.querySelectorAll('#gl-grid tbody[data-text]')];
  ok('journal entries: one block per transaction in the period (' + TX.length + ')', blocks.length === TX.length && TX.length > 5, [blocks.length, TX.length]);
  const one = TX[0], b0 = blocks.find((b) => b.querySelector('.k-header').textContent.includes(one.DisplayID));
  ok('journal entries: a block shows every line of its transaction and its total', b0 && b0.querySelectorAll('tr.k-row').length === one.Lines.length && /Total for/.test(b0.querySelector('.k-total').textContent) && !/out of balance/.test(b0.textContent), b0 && b0.textContent.slice(0, 300));
  ok('journal entries: no transaction is flagged out of balance', !/out of balance/.test(text(t.doc, '#gl-grid')));
  const q = t.doc.getElementById('gl-q'); q.value = one.DisplayID.toLowerCase(); q.dispatchEvent(new t.w.Event('input'));
  ok('journal entries: search narrows to the matching journal', [...t.doc.querySelectorAll('#gl-grid tbody[data-text]')].filter((b) => !b.hidden).length >= 1 && [...t.doc.querySelectorAll('#gl-grid tbody[data-text]')].filter((b) => !b.hidden).length < blocks.length);
  q.value = ''; q.dispatchEvent(new t.w.Event('input'));
  const xs = await xlsx(t);
  ok('journal entries: Excel has a Journal entries sheet', /Journal entries/.test(xs) && xs.includes(one.DisplayID));
  await view(t, 'accounts');
  ok('journal entries: the General ledger views are there (title follows the view)', text(t.doc, 'header .ti') === 'General Ledger' && green(t));
  // a tampered journal: one line's amount changed
  t = await go('je', { journals: (p) => { const r = L.listJournalTransactions(p); r.Items = JSON.parse(JSON.stringify(r.Items)); r.Items[0].Lines[0].Amount = Number(r.Items[0].Lines[0].Amount) + 10; return r; } });
  ok('journal entries: an unbalanced transaction is flagged and the check fails', red(t) && /out of balance/.test(text(t.doc, '#gl-grid')) && /✗ Σ debits = Σ credits, and every journal transaction balances/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Categories Transactions (M11)
  t = await go('cx');
  ok('categories transactions: own title, all categories with activity, 3/3 checks', t.errs.length === 0 && text(t.doc, 'header .ti') === 'Categories Transactions' && green(t) && t.doc.getElementById('gl-cat').value === '', [text(t.doc, 'header .ti'), banner(t).slice(0, 200)]);
  const accs = L.listAccounts({ myob_company_file_id: L.CF1 }).Items, bank = accs.find((a) => a.DisplayID === '1-1110');
  const n0 = t.calls.length, sel = t.doc.getElementById('gl-cat'); sel.value = bank.UID; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(20);
  const P2 = { from_date: said(t).from_date, to_date: said(t).to_date, myob_company_file_id: L.CF1 }, bankLines = L.listJournalTransactions(P2).Items.reduce((n, x) => n + x.Lines.filter((l) => l.Account.UID === bank.UID).length, 0);
  const cx = t.doc.querySelectorAll('#gl-grid tbody');
  ok('categories transactions: choosing the bank shows only its own lines, no refetch', t.calls.length === n0 && cx.length === 1 && cx[0].querySelectorAll('tr.k-row').length === bankLines && /1-1110/.test(cx[0].querySelector('.k-header').textContent) && JSON.parse(said(t).display).x === bank.UID, [cx.length, cx[0] && cx[0].querySelectorAll('tr.k-row').length, bankLines]);
  ok('categories transactions: opening and closing balances tie to the Balance Sheet (no MYOB difference shown)', /Opening/.test(cx[0].textContent) && /closing/.test(cx[0].textContent) && !/\(MYOB/.test(cx[0].textContent));
  t = await go('cx', null, { display: disp('cx', { x: bank.UID }) });
  ok('categories transactions: a copy saved on one category opens on it', t.doc.getElementById('gl-cat').value === bank.UID && t.doc.querySelectorAll('#gl-grid tbody').length === 1);

  // ---------------- Categories List (M10)
  t = await go('cl');
  const chart = accs.length, heads = accs.filter((a) => a.IsHeader).length;
  ok('categories list: own title, as at today, 4/4 checks (with the current-balance tie)', t.errs.length === 0 && text(t.doc, 'header .ti') === 'Categories List' && green(t) && /4\/4 checks passed/.test(banner(t)) && /✓ Balance-sheet categories: current balance \(list_accounts\) = the Balance Sheet today/.test(banner(t)), banner(t).slice(0, 400));
  const rowsCl = t.doc.querySelectorAll('#tb-grid tr.k-row').length, headCl = [...t.doc.querySelectorAll('#tb-grid tr.k-header')].length;
  ok('categories list: every account in the chart (' + chart + ', headers as labels)', rowsCl === chart - heads && headCl >= heads, [rowsCl, chart - heads, headCl, heads]);
  ok('categories list: a total per classification', /Total Assets/.test(text(t.doc, '#tb-grid')) && /Total Expenses/.test(text(t.doc, '#tb-grid')));
  const bal = L.expect.balances('2026-09-28', L.CF1)['1-1110'], bankRow = [...t.doc.querySelectorAll('#tb-grid tr.k-row')].find((r) => r.cells[0].textContent.trim() === '1-1110');
  ok('categories list: the bank balance at the date = the books', bankRow && bankRow.cells[3].textContent.replace(/[^\d.]/g, '') === Math.abs(bal).toFixed(2), [bankRow && bankRow.cells[3].textContent, bal]);
  t = await go('cl', null, { as_at: '2026-06-30', display: disp('cl', { a: 'custom' }) });
  ok('categories list: at another date the today tie is N/A, the rest still pass', green(t) && /– Balance-sheet categories: current balance/.test(banner(t)) && /N\/A — current balances are today/.test(banner(t)), banner(t).slice(0, 400));
  t = await go('cl', { accounts: (p) => { const r = L.listAccounts(p); r.Items = JSON.parse(JSON.stringify(r.Items)); const a = r.Items.find((x) => x.DisplayID === '1-1110'); a.CurrentBalance = a.CurrentBalance + 100; const z = r.Items.find((x) => !x.IsHeader && x.DisplayID !== '1-1110'); z.IsActive = false; return r; } });
  ok('categories list: a current balance that disagrees with the Balance Sheet fails', red(t) && /✗ Balance-sheet categories: current balance/.test(banner(t)), banner(t).slice(0, 300));
  ok('categories list: an inactive account is marked', /\(inactive\)/.test(text(t.doc, '#tb-grid')));
  await view(t, 'tb');
  ok('categories list: the Trial Balance views are there (title follows the view)', text(t.doc, 'header .ti') === 'Trial Balance');

  // ---------------- Contacts (M12)
  t = await go('co');
  const C = L.listContacts({ myob_company_file_id: L.CF1, page_size: 1000 }).Items, kpi = (l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
  ok('contacts: 3/3 checks — count, customer balances = open invoices, supplier balances = open bills', t.errs.length === 0 && green(t) && /3\/3 checks passed/.test(banner(t)), banner(t).slice(0, 400));
  ok('contacts: KPIs ' + C.length + ' contacts, 9 customers, 7 suppliers, 1 inactive, owed $13,699.50 / owing $2,817.73', kpi('Contacts') === String(C.length) && kpi('Customers') === '9' && kpi('Suppliers') === '7' && kpi('Inactive') === '1' && /13,699\.50/.test(kpi('Customers owe you')) && /2,817\.73/.test(kpi('You owe suppliers')),
    ['Contacts', 'Customers', 'Suppliers', 'Inactive', 'Customers owe you', 'You owe suppliers'].map(kpi));
  ok('contacts: grouped by type with counts', /Customers \(9\)/.test(text(t.doc, '#mk-body')) && /Suppliers \(7\)/.test(text(t.doc, '#mk-body')) && /Employees \(1\)/.test(text(t.doc, '#mk-body')));
  ok('contacts: an individual is named by first and last name', /Jamie Nguyen/.test(text(t.doc, '#mk-body')));
  ok('contacts: customer email shows; the employee\'s personal email and phone never do', /accounts@harbourcafegroup\.com\.au/.test(text(t.doc, '#mk-body')) && !/alex\.morgan@home\.example/.test(t.doc.body.innerHTML) && !/0400 000 000/.test(t.doc.body.innerHTML));
  const qc = t.doc.getElementById('co-q'); qc.value = 'harbour'; qc.dispatchEvent(new t.w.Event('input'));
  ok('contacts: search', [...t.doc.querySelectorAll('#mk-body tbody tr[data-text]')].filter((r) => !r.hidden).length === 1);
  qc.value = ''; qc.dispatchEvent(new t.w.Event('input'));
  const ia = t.doc.getElementById('co-active'); ia.checked = true; ia.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('contacts: hide inactive', !/Old Printing Co/.test(text(t.doc, '#mk-body')) && JSON.parse(said(t).display).x === 'active');
  await view(t, 'balances');
  ok('contacts: balances view — customers who owe you, largest first', /Customers who owe you \(5\)/.test(text(t.doc, '#mk-body')) && text(t.doc, '#mk-body').indexOf('Coastal Freight Co') < text(t.doc, '#mk-body').indexOf('Redwood Dental') && text(t.doc, 'header .ti') === 'Contact Balances');
  const n1 = t.calls.length, ty = t.doc.getElementById('mk-enum-0'); ty.value = 'Customer'; ty.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(20);
  ok('contacts: Contact type refetches with the type; the supplier tie is N/A', t.calls.slice(n1).some((x) => x.id === 'contacts' && x.params.type === 'Customer') && /– Supplier balances = open bills .*N\/A — Contact type is Customer/.test(banner(t)) && green(t), banner(t).slice(0, 400));
  t = await go('co', { contacts: (p) => { const r = L.listContacts(p); r.Items = JSON.parse(JSON.stringify(r.Items)); r.Items.find((x) => x.Type === 'Customer' && x.CurrentBalance > 0).CurrentBalance += 50; return r; } });
  ok('contacts: a customer balance that disagrees with the open invoices fails', red(t) && /✗ Customer balances = open invoices/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('co', { contacts: () => ({ Items: Array.from({ length: 1000 }, (_, i) => ({ UID: 'u' + i, CompanyName: 'Co ' + i, DisplayID: 'C' + i, Type: 'Customer', IsActive: true, CurrentBalance: 0 })), Count: 1000 }) });
  ok('contacts: 1,000 contacts → the list may be cut off (a warning, the count check N/A)', /may be cut off/.test(text(t.doc, '#mk-body')) && /– Contacts shown = the contacts MYOB returned/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('co', { contacts: () => ({ Items: [{ UID: 'x', CompanyName: 'Bare Co', Type: 'Customer', IsActive: true }] }) });
  ok('contacts: no balances returned → the ties are N/A, never red', !red(t) && /N\/A — MYOB returned no contact balances/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 300));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

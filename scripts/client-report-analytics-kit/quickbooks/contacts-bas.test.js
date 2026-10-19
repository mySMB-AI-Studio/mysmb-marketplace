// CRA-06 Contact Details for BAS Preparation (QuickBooks): Customer + Vendor entities, with the tax types each contact used in
// the period from the tax lines of the period's transactions (the shared TX block, on the QuickBooks tax ledger). No ABN to look
// up on the register and no GST evidence field: both must read "N/A", never a guessed value.
const U = require('./qb-test-util.js');
const { run, suite, F, text, banner, red } = U;
const TL = require('./qb-tax-ledger.js');
const manifest = require('../build.js').manifest('quickbooks/contacts-bas');
const REF = 'quickbooks/contacts-bas';
const fx = Object.assign({}, TL.fx(), { customers: F.customers, vendors: F.vendors, company_info: () => F.companyInfo, prefs: () => F.prefs });
const { ok, done } = suite('quickbooks/contacts-bas');
const rowOf = (t, name) => [...t.doc.querySelectorAll('#cb-grid tbody tr')].find((tr) => tr.children[0] && tr.children[0].textContent === name);
(async () => {
  const t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with customers and vendors listed', text(t.doc, '#cb-grid').includes('Customer') && text(t.doc, '#cb-grid').includes('Vendor'), text(t.doc, '#cb-grid').slice(0, 500));
  ok('the transaction lists are read for the period (txn_where from the From / To dates)', t.calls.some((x) => x.id === 'invoices' && /TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'/.test(x.params.where)) && t.calls.some((x) => x.id === 'bills') && t.calls.some((x) => x.id === 'tax_codes'), t.calls.map((x) => x.id));
  const civ = rowOf(t, 'Civica Pty Ltd');
  ok('a customer with invoices shows the tax types it used, with the number of lines', civ && /GST \(sales\) 10% \(\d+\)/.test(civ.textContent), civ && civ.textContent);
  ok('the tax types column names the period', /Tax types used 1 Apr 2026 – 30 Jun 2026|Tax types used .*2026/.test(text(t.doc, '#cb-grid thead')), text(t.doc, '#cb-grid thead'));
  const idle = [...t.doc.querySelectorAll('#cb-grid tbody tr')].find((tr) => /None this period/.test(tr.textContent));
  ok('a contact with no GST-coded transactions in the period reads "None this period", never a guessed type', !!idle, text(t.doc, '#cb-grid').slice(0, 600));
  ok('every row shows "N/A — no ABN in QuickBooks contacts" for the register match, never a guessed status', text(t.doc, '#cb-grid').includes('N/A — no ABN in QuickBooks contacts') && !/Registered|Not registered|Matched|Verified/i.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 500));
  ok('GST evidence reads "N/A — not in source", never invented', /N\/A — not in source/.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 500));
  ok('the gaps are explained up front, not hidden', text(t.doc, 'body').includes('No register (ABR) match on QuickBooks'), text(t.doc, 'body').slice(0, 300));
  ok('green: contacts and transactions loaded', !red(t) && /✓ Transactions loaded for the tax types used/.test(banner(t)), banner(t).slice(0, 600));
  ok('the KPI strip counts the contacts with GST-coded transactions', /With GST-coded transactions/.test(text(t.doc, 'body')), text(t.doc, 'body').slice(0, 300));
  // a transaction list that fails: tax types read N/A with the reason, and the check fails — never "None this period"
  const f2 = await run(REF, manifest, fx, { fail: { bills: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed transaction list fails the check and every tax types cell says why', red(f2) && /✗ Transactions loaded for the tax types used — Could not load: bills/.test(banner(f2)) && !/None this period/.test(text(f2.doc, '#cb-grid')) && /N\/A — the transactions could not be loaded/.test(text(f2.doc, '#cb-grid')), banner(f2).slice(0, 400));
  const f = await run(REF, manifest, fx, { fail: { customers: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed customers load is never silent', text(f.doc, '#qb-body').includes('QuickBooks API error'), text(f.doc, '#qb-body').slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

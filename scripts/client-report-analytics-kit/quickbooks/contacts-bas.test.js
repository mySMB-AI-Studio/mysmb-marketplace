// CRA-06 Contact Details for BAS Preparation (QuickBooks), base version only: Customer + Vendor entities. No ABR match, no
// per-contact tax-code source built for QuickBooks yet — both must read "N/A", never a guessed value.
const U = require('./qb-test-util.js');
const { run, suite, F, text, banner, red } = U;
const manifest = require('../build.js').manifest('quickbooks/contacts-bas');
const REF = 'quickbooks/contacts-bas';
const fx = { customers: F.customers, vendors: F.vendors, company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/contacts-bas');
(async () => {
  const t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('opens with customers and vendors listed', text(t.doc, '#cb-grid').includes('Customer') && text(t.doc, '#cb-grid').includes('Vendor'), text(t.doc, '#cb-grid').slice(0, 500));
  ok('every row shows "N/A — pending ABR" for the registry match, never a guessed status', text(t.doc, '#cb-grid').includes('N/A — pending ABR') && !/Registered|Not registered|Matched|Verified/i.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 500));
  ok('GST evidence and tax types used both read "N/A — not in source", never invented', (text(t.doc, '#cb-grid').match(/N\/A — not in source/g) || []).length >= 2, text(t.doc, '#cb-grid').slice(0, 500));
  ok('the gaps are explained up front, not hidden', text(t.doc, 'body').includes('Registry (ABR) match is not built yet'), text(t.doc, 'body').slice(0, 300));
  ok('not failing (no $ figures, no tamperable ties — a genuine all-information report)', !red(t), banner(t).slice(0, 400));
  const f = await run(REF, manifest, fx, { fail: { customers: { code: 'tool_error', message: 'QuickBooks API error' } } });
  ok('a failed customers load is never silent', text(f.doc, '#qb-body').includes('QuickBooks API error'), text(f.doc, '#qb-body').slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

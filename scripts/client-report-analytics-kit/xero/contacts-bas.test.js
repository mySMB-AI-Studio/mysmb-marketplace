// CRA-06 Contact Details for BAS Preparation (Xero), base version only: contacts from list_contacts, tax types used from
// invoices/credit notes in the period, GST evidence (ABN on file) from the contact's own tax number. No ABR registry match
// (pending credential) — every row must show "N/A — pending ABR", never a guessed status.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { run, text, wait, banner, body, green } = X;
const ID = 'contacts-bas', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(200);
  ok('opens green with a contacts table', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('every contact row shows "N/A — pending ABR" for the registry match, never a guessed status', /N\/A — pending ABR/.test(text(t.doc, '#co-grid')) && !/Registered|Not registered|Matched|Verified/i.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 500));
  ok('the no-ABR-match gap is explained up front, not hidden', /Registry \(ABR\) match is not built yet/.test(body(t)), body(t).slice(0, 300));
  ok('GST evidence reads "No ABN on file" rather than inventing a registration status (the ledger has no ABN field)', /No ABN on file/.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 400));
  ok('tax types used are listed per contact from their invoices/credit notes in the period', /GST on Income|GST on Expenses|GST Free/.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 600));
  const f1 = await run(REF, m, X.fixtures(m), { fail: { contacts: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('a failed contacts load is never silent', /Xero API 500/.test(body(f1)), body(f1).slice(0, 200));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

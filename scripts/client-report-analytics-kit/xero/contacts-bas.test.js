// CRA-06 Contact Details for BAS Preparation (Xero): contacts from list_contacts, tax types used from invoices/credit notes
// in the period, GST evidence (ABN on file) from the contact's own tax number, and the Australian Business Register's record
// for each ABN (ABR Lookup's abr_lookup_abns, called after the contacts load, ABNs as comma-separated strings).
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { run, text, wait, banner, body, green } = X;
const ID = 'contacts-bas', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
// The ledger's contacts with ABNs on three of them: active (ATO), cancelled, and one the register doesn't have.
const ABNS = ['51 824 753 556', '13092013324', '53004085616'];
const withAbns = (p) => { const r = X.contactsFromLedger(p); (r.Contacts || []).forEach((c, i) => { if (i < ABNS.length) c.TaxNumber = ABNS[i]; }); return r; };
const regCalls = (t) => t.calls.filter((x) => x.id === 'registry' && x.requery);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(200);
  ok('opens green with a contacts table', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('contacts with no ABN read "N/A — no ABN on file" in the register column, never a guessed status', /N\/A — no ABN on file/.test(text(t.doc, '#co-grid')) && !/Active|Cancelled|GST registered/.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 500));
  ok('no register lookup when no contact has an ABN', regCalls(t).length === 0, regCalls(t));
  ok('… and the checks say there is nothing to look up, not "Looking up 0 ABN(s)…" (seen on QA)', /nothing to look up on the register/.test(banner(t)) && !/Looking up 0/.test(banner(t)), banner(t).slice(0, 600));
  ok('GST evidence reads "No ABN on file" rather than inventing a registration status', /No ABN on file/.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 400));
  ok('tax types used are listed per contact from their invoices/credit notes in the period', /GST on Income|GST on Expenses|GST Free/.test(text(t.doc, '#co-grid')), text(t.doc, '#co-grid').slice(0, 600));

  const r = await run(REF, m, X.fixtures(m, { contacts: withAbns })); await wait(300);
  const grid = text(r.doc, '#co-grid');
  ok('the register column shows each ABN\'s record: active and GST registered', /Active · GST registered since 1 Jul 2000 · AUSTRALIAN TAXATION OFFICE/.test(grid), grid.slice(0, 800));
  ok('… cancelled, with the date and the GST end', /Cancelled 15 Mar 2024 · Not registered for GST \(ended 15 Mar 2024\)/.test(grid), grid.slice(0, 800));
  ok('… and "Not on the register" for an ABN the register doesn\'t have', /Not on the register/.test(grid), grid.slice(0, 800));
  ok('the ABNs go to abr_lookup_abns as one comma-separated string (reports can\'t pass arrays)', regCalls(r).length === 1 && regCalls(r)[0].params.abns === '13092013324,51824753556,53004085616', regCalls(r).map((x) => x.params));
  ok('a KPI counts cancelled and not-GST-registered businesses', /1 · 1/.test(body(r)), body(r).slice(0, 400));
  ok('the report stays green with the register column filled', green(r), banner(r).slice(0, 300));

  const many = (p) => { const res = X.contactsFromLedger(p); const base = res.Contacts[0];
    res.Contacts = res.Contacts.concat(Array.from({ length: 85 }, (_, i) => Object.assign({}, base, { ContactID: 'extra-' + i, Name: 'Extra ' + i, TaxNumber: String(10000000000 + i * 7) })));
    return res; };
  const b = await run(REF, m, X.fixtures(m, { contacts: many })); await wait(400);
  const batches = regCalls(b).map((x) => x.params.abns);
  ok('85 ABNs go in batches of up to 40, each under the 500-character input limit', batches.length === 3 && batches.every((s) => s.length <= 500) && batches.join(',').split(',').length === 85, batches.map((s) => s.length));

  const n = await run(REF, m, X.fixtures(m, { contacts: withAbns }), { fail: { registry: { code: 'needs_connection', message: 'Connect abr to see this data' } } }); await wait(300);
  ok('without ABR Lookup connected, the column says so and explains, and the rest still works', /N\/A — connect ABR Lookup/.test(text(n.doc, '#co-grid')) && /needs ABR Lookup/.test(body(n)) && /GST on Income|GST on Expenses|GST Free/.test(text(n.doc, '#co-grid')), body(n).slice(0, 400));

  const s = await run(REF, m, X.fixtures(m, { contacts: withAbns }), { mode: 'snapshot' }); await wait(300);
  ok('a snapshot says the register column isn\'t included rather than showing stale or missing data', /not in this snapshot/.test(text(s.doc, '#co-grid')) && regCalls(s).length === 0, text(s.doc, '#co-grid').slice(0, 300));

  const f1 = await run(REF, m, X.fixtures(m), { fail: { contacts: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(100);
  ok('a failed contacts load is never silent', /Xero API 500/.test(body(f1)), body(f1).slice(0, 200));
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

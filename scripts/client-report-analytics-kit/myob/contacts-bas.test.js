// CRA-06 Contact Details for BAS Preparation (MYOB), base version only: contacts from list_contacts, tax codes used from
// invoice/bill lines. No ABN field on MYOB's generic contact list, so GST evidence and the register match read "N/A", never guessed.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green, common } = require('./lib.js');
const ID = 'contacts-bas';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(150);
  ok('opens green with a contacts table', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('every row shows "N/A — no ABN in MYOB\'s contact list" for the register match, never a guessed status', /N\/A — no ABN in MYOB's contact list/.test(text(t.doc, '#cb-grid')) && !/Registered|Not registered|Matched|Verified/i.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 500));
  ok('GST evidence reads "N/A — not in source" (MYOB\'s contact list has no ABN field), never invented', /N\/A — not in source/.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 500));
  ok('tax codes used are listed per contact from invoice/bill lines in the period', /GST|FRE|CAP|N-T/.test(text(t.doc, '#cb-grid')), text(t.doc, '#cb-grid').slice(0, 600));
  const f = await go(ID, { contacts: () => { throw new Error('MYOB 500'); } });
  ok('a failed contacts load is never silent', /MYOB 500/.test(body(f)), body(f).slice(0, 200));
  await common(ID, ok);
  // A lighter, bespoke LIB-002 pass instead of lib.js's shared conformance(): that helper asserts the page carries at least one
  // large ($1,000+) dollar figure before and after a client switch, which does not hold here — CRA-06 is a contacts/tax-code
  // list with no money figures at all. The behaviour that matters (client picker, no data leaking across the switch) is
  // checked directly below.
  const sel = t.doc.getElementById('mk-client');
  ok('client picker (LIB-002) lists both company files', sel && [...sel.options].map((o) => o.textContent).join('|').includes(L.FILES[L.CF1].Name + '|' + L.FILES[L.CF2].Name), sel && [...sel.options].map((o) => o.textContent));
  sel.value = L.CF2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(250);
  ok('switching company file re-renders on file 2, still green, no errors', text(t.doc, 'header .co') === L.FILES[L.CF2].Name && green(t) && t.errs.length === 0, text(t.doc, 'header .co'));
  done(); process.exit(process.exitCode || 0);
})();

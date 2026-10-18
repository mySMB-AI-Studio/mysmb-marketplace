// CRA-02 / 08 / 09 / 10 live checks (Xero): the four views on the Xero kit's ledger, plus a handful of planted problems so
// each rule has something to find (a duplicate bill, GST on bank fees, a suspense-coded and unexplained spend, an unsent
// invoice, an unreconciled line, duplicate contacts). A check the data can't answer must read N/A, never Clear; register
// checks always read "Runs overnight".
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, wait, banner, body, green, red, xlsxOf } = X;
const { ok, done } = suite('xero/live-checks');
const IDS = ['data-quality', 'client-queries', 'gst-check', 'health-check'];
const metro = { ContactID: 'sup-metro-wholesale', Name: 'Metro Wholesale' }, bankC = { ContactID: 'sup-westpac', Name: 'Westpac' };
const line = (code, tax, net, gst) => ({ Description: 'Planted', Quantity: 1, UnitAmount: net, AccountCode: code, TaxType: tax, TaxAmount: gst, LineAmount: net });
const bill = (id, no, date, total) => ({ Type: 'ACCPAY', InvoiceID: id, InvoiceNumber: no, Contact: metro, DateString: date + 'T00:00:00', DueDateString: date + 'T00:00:00', Status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: [line('310', 'INPUT', total / 1.1, total / 11)], SubTotal: total / 1.1, TotalTax: total / 11, Total: total, AmountDue: total, HasAttachments: true });
const EXTRA_INV = [bill('dup-1', 'DUP-1', '2026-08-03', 1100), bill('dup-2', 'DUP-2', '2026-08-06', 1100),
  { Type: 'ACCREC', InvoiceID: 'uns-1', InvoiceNumber: 'INV-UNSENT', Contact: { ContactID: 'cus-harbour-cafe-group', Name: 'Harbour Cafe Group' }, DateString: '2026-08-12T00:00:00', DueDateString: '2026-09-12T00:00:00', Status: 'AUTHORISED', SentToContact: false, LineAmountTypes: 'Exclusive', LineItems: [line('200', 'OUTPUT', 1000, 100)], SubTotal: 1000, TotalTax: 100, Total: 1100, AmountDue: 1100 }];
const EXTRA_BANK = [
  { Type: 'SPEND', BankTransactionID: 'bt-fee', Contact: bankC, DateString: '2026-08-05T00:00:00', Status: 'AUTHORISED', LineAmountTypes: 'Exclusive', LineItems: [line('404', 'INPUT', 50, 5)], SubTotal: 50, TotalTax: 5, Total: 55, IsReconciled: true, HasAttachments: true, Reference: 'Monthly fee' },
  { Type: 'SPEND', BankTransactionID: 'bt-susp', Contact: {}, DateString: '2026-08-10T00:00:00', Status: 'AUTHORISED', LineAmountTypes: 'NoTax', LineItems: [Object.assign(line('850', 'BASEXCLUDED', 300, 0), { Description: '' })], SubTotal: 300, TotalTax: 0, Total: 300, IsReconciled: false, HasAttachments: true, Reference: '' }];
const inP = (p, r) => { const m = /DateTime\((\d+),(\d+),(\d+)\).*DateTime\((\d+),(\d+),(\d+)\)/.exec(p.where || ''); if (!m) return true; const d = r.DateString.slice(0, 10), f = m[1] + '-' + m[2] + '-' + m[3], t = m[4] + '-' + m[5] + '-' + m[6]; return d >= f && d <= t; };
const withExtra = (base, key, extra, keep) => (p) => { const r = base(p); if ((p.page || 1) === 1 && (!p.xero_tenant_id || p.xero_tenant_id === L.T1)) r[key] = r[key].concat(extra.filter((x) => keep(p, x))); return r; };
const contacts = (p) => ((p.page || 1) > 1 ? { Contacts: [] } : { Contacts: [metro, { ContactID: 'sup-metro-2', Name: 'Metro Wholesale Pty Ltd' }, bankC, { ContactID: 'cus-harbour-cafe-group', Name: 'Harbour Cafe Group', TaxNumber: '51 824 753 556' }].map((c) => Object.assign({ ContactStatus: 'ACTIVE', Addresses: [{ AddressType: 'STREET', AddressLine1: c.ContactID === 'sup-metro-wholesale' ? '' : '1 Main St' }] }, c)) });
const planted = (m, org) => X.fixtures(m, {
  invoices: withExtra(L.listInvoices, 'Invoices', EXTRA_INV, inP), open_inv: withExtra(L.listInvoices, 'Invoices', EXTRA_INV.filter((d) => d.Status === 'AUTHORISED'), () => true),
  bank_tx: withExtra(L.listBankTransactions, 'BankTransactions', EXTRA_BANK, inP), contacts,
  org: (p) => { const r = L.organisation(p); Object.assign(r.Organisations[0], org || {}); return r; }
});
const open = async (id, org, over) => { const m = X.man(id), t = await run('xero/' + id, m, Object.assign(planted(m, org), over || {})); await wait(250); return t; };

(async () => {
  const dq = await open('data-quality');
  ok('Data Quality opens green, no script errors (findings are not report failures)', green(dq) && dq.errs.length === 0, banner(dq).slice(0, 500));
  ok('a duplicate bill is found (same supplier, same amount, 3 days apart)', /CHK-055.*Bills DUP-1 \(3 Aug 2026\) and DUP-2 \(6 Aug 2026\) from Metro Wholesale have the same amount 3 day\(s\) apart/.test(body(dq)), body(dq).slice(0, 800));
  ok('GST on bank fees is found (CHK-058)', /CHK-058.*\$5\.00 GST claimed on 1 line\(s\) coded to 404 Bank Fees/.test(body(dq)));
  ok('duplicate contacts are found (CHK-006, "Pty Ltd" ignored)', /CHK-006.*2 active contacts have the same name: Metro Wholesale, Metro Wholesale Pty Ltd/.test(body(dq)));
  ok('an unreconciled line up to the end of last month is found (CHK-022)', /CHK-022.*1 bank transaction\(s\) dated up to 31 Aug 2026 aren't reconciled/.test(body(dq)));
  ok('an approved invoice never sent is found (CHK-024)', /CHK-024.*INV-UNSENT/.test(body(dq)));
  ok('GST from a supplier with no ABN is found (CHK-008)', /CHK-008.*supplier\(s\) with no ABN on file: Metro Wholesale/.test(body(dq)));
  ok('the suspense account balance is found (CHK-125)', /CHK-125.*Account 850 Suspense has a balance/.test(body(dq)));
  ok('register checks read "Runs overnight", never Clear', /CHK-071Bill Raised With A Cancelled Supplier.*?Runs overnight: checks the Australian Business Register/.test(body(dq)) && !/CHK-071Bill Raised With A Cancelled Supplier[^]*?ContactsHigh[^R]*Clear/.test(body(dq)));
  ok('engine-only checks say what only the engine can do', /CHK-017Contact Bank Account Changed.*?Runs overnight: the overnight engine compares each contact's bank details with the last run/.test(body(dq)));
  ok('no GST registration in the organisation = CHK-031 and CHK-136 read N/A with the reason, not Clear', /CHK-031GST on Invoice and\/or Credit Note When Not Registered.*?N\/A: the business's GST registration is not in source/.test(body(dq)) && /CHK-136GST Registration Required.*?N\/A:/.test(body(dq)));
  const x1 = await xlsxOf(dq);
  ok('Data Quality Excel has the findings and what was checked', /DUP-1/.test(x1) && /What was checked/.test(x1) && /CHK-071/.test(x1), x1.length);

  const cq = await open('client-queries');
  ok('Client Queries opens green', green(cq) && cq.errs.length === 0, banner(cq).slice(0, 400));
  ok('the suspense-coded spend asks what it was for (CQ-01)', /Transaction Coded to a Suspense or Uncoded Account \(1\).*?Spend money.*?\$300\.00What was this for\?/.test(body(cq)), body(cq).slice(0, 600));
  ok('the spend with no contact and no description asks who and what (CQ-02)', /Bank Transaction With No Contact or Description \(1\)/.test(body(cq)) && /Who was this with, and what was it for\?/.test(body(cq)));
  ok('missing receipts are listed per transaction', /Bills Raised Without Attachments Over \$75 \(\d+\)/.test(body(cq)) && /Receipt or tax invoice/.test(body(cq)));
  ok('suppliers with no ABN are listed with what we need', /TPAR Information Missing/.test(body(cq)) && /ABN and address/.test(body(cq)));
  ok('a ready-to-send message is drafted for the period', /Ready to send.*Hi, we need a few things to finish your books for 1 Jul 2026 to 25 Sep 2026/.test(body(cq)));
  ok('findings outside Client Queries are not listed (no duplicate-bill card)', !/Possible Duplicate Bill \(/.test(body(cq)));
  const x2 = await xlsxOf(cq);
  ok('Client Queries Excel lists every item with what we need', /What was this for\?/.test(x2) && /Receipt or tax invoice/.test(x2));

  const gst = await open('gst-check');
  ok('GST Check opens green', green(gst) && gst.errs.length === 0, banner(gst).slice(0, 400));
  ok('GST on bank fees is unresolved GST risk', /Unresolved GST risk.*CHK-058/.test(body(gst)));
  ok('scope and method lists every GST check with what it looks for', ['CHK-003', 'CHK-008', 'CHK-031', 'CHK-058', 'CHK-059', 'CHK-068', 'CHK-069', 'CHK-076', 'CHK-077', 'CHK-085', 'CHK-129', 'CHK-136'].every((k) => body(gst).includes(k)) && /What it looks for/.test(body(gst)));
  const gst2 = await open('gst-check', { PaysTax: false });
  ok('not registered for GST + GST on sales = CHK-031 finding', /CHK-031.*sales invoice\(s\) or credit note\(s\) charge GST, but the business isn't registered for GST/.test(body(gst2)), body(gst2).slice(0, 600));
  ok('not registered and income over $75,000 in 12 months = CHK-136', /CHK-136.*at or over the \$75,000\.00 GST registration threshold/.test(body(gst2)));
  const gst3 = await open('gst-check', { PaysTax: true });
  ok('registered for GST = CHK-031 runs and is Clear', /CHK-031GST on Invoice and\/or Credit Note When Not Registered.*?Clear/.test(body(gst3)));

  const hc = await open('health-check');
  ok('Health Check opens green, net profit ties to income − expenses', green(hc) && /✓ Net profit = income − expenses/.test(banner(hc)), banner(hc).slice(0, 600));
  ok('Health Check shows financial activity, data quality and top findings', /Financial activity.*Income.*Expenses.*Bank balance \(end of period\).*Receivables overdue/.test(body(hc)) && /Data quality by category/.test(body(hc)) && /Top findings/.test(body(hc)));
  ok('the health status follows the most severe finding (Medium = Review)', /Health: Review/.test(body(hc)));

  const broken = await open('data-quality', null, { invoices: () => { throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/Invoices 500: {"Title":"Server error"}'); } });
  ok('a ledger source that fails = red banner naming it, never an empty "all clear"', red(broken) && /Ledger sources loaded/.test(banner(broken)) && !/Data quality: Good/.test(body(broken)), banner(broken).slice(0, 300));

  // The agent never writes these documents (Use this report, or artifact_from_template), so they get 40,000 tokens: see conformance().
  for (const id of IDS) await X.conformance(id, ok, 40000);
  done(); process.exit(process.exitCode || 0);
})();

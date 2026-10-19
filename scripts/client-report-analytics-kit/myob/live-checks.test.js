// CRA-02 / 08 / 09 / 10 live checks (MYOB): the four views on the MYOB kit's ledger, plus planted problems so each rule that
// MYOB's data can answer has something to find (a duplicate bill, GST on wages, GST that isn't the rate's share, a
// suspense-coded spend with no card or memo, a supplier with no ABN, duplicate supplier cards, an unsent open invoice). The
// ledger's own journals leave bank lines unreconciled (CHK-022). A check MYOB can't answer (attachments, drafts, lock period,
// GST registration) must read N/A with the reason, never Clear; register and engine-only checks read "Not run on MYOB" (the overnight engine covers Xero only), never Clear or "Runs overnight".
// list_suppliers is not in lib.js's tool map, so this test answers every binding itself (same ledger answers as lib.js).
const path = require('path');
const { suite } = require('../harness.js');
const build = require('../build.js');
const { L, run, man, text, wait, banner, body, green, red, withDefaults, xlsxText, spendMoney, N1, N2 } = require('./lib.js');
const { ok, done } = suite('myob/live-checks');
const IDS = ['data-quality', 'client-queries', 'gst-check', 'health-check'];
const U = L.U, CF = L.CF1;
const TOOL = { get_profit_and_loss_3m: L.profitAndLoss, list_accounts: L.listAccounts, list_company_files: L.companyFiles, list_invoices: L.listInvoices, list_bills: L.listBills, list_journal_transactions: L.listJournalTransactions,
  list_tax_codes: L.listTaxCodes, list_invoice_lines: L.listInvoiceLines, list_bill_lines: L.listBillLines, list_spend_money: spendMoney, list_contacts: L.listContacts, list_suppliers: L.listSuppliers };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { if (!TOOL[b.tool.name]) throw new Error('no ledger answer for ' + b.tool.name); f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const inP = (p, d) => (!p.from_date || d.slice(0, 10) >= p.from_date) && (!p.to_date || d.slice(0, 10) <= p.to_date);
const mine = (p) => !p.myob_company_file_id || p.myob_company_file_id === CF;
// planted records (company file 1 only)
const metro = { UID: U(CF, 2000), Name: 'Metro Wholesale', DisplayID: 'SUP000001' }, power = { UID: U(CF, 2003), Name: 'PowerDirect', DisplayID: 'SUP000004' };
const ACC = { purchases: { UID: U(CF, 36), DisplayID: '5-1000', Name: 'Purchases' }, wages: { UID: U(CF, 47), DisplayID: '6-5130', Name: 'Wages & Salaries' }, susp: { UID: U(CF, 99), DisplayID: '2-9990', Name: 'Suspense' }, bank: { UID: U(CF, 2), DisplayID: '1-1110', Name: 'Business Bank Account #1' } };
const GST = { UID: U(CF, 901), Code: 'GST' }, NT = { UID: U(CF, 904), Code: 'N-T' };
const billLine = (uid, no, date, who, total) => ({ DocumentUID: uid, Number: no, Date: date + 'T00:00:00', Layout: 'Service', Status: 'Open', IsTaxInclusive: false, Supplier: who, RowID: 1, Type: 'Transaction', Description: 'Planted', Total: total, TaxCode: GST, Account: ACC.purchases, Job: null, Item: null });
const billHead = (uid, no, date, who, net, tax) => ({ UID: uid, Number: no, Date: date + 'T00:00:00', SupplierInvoiceNumber: no, Supplier: Object.assign({ URI: 'x' }, who), Status: 'Open', Subtotal: net, TotalTax: tax, TotalAmount: net + tax, BalanceDueAmount: net + tax, IsTaxInclusive: false, Terms: { DueDate: date + 'T00:00:00' } });
const BILL_LINES = [billLine('dup-1', 'DUP-1', '2026-08-03', metro, 1000), billLine('dup-2', 'DUP-2', '2026-08-06', metro, 1000), billLine('gst-1', 'GST-1', '2026-08-15', power, 1000)];
const BILL_HEADS = [billHead('dup-1', 'DUP-1', '2026-08-03', metro, 1000, 100), billHead('dup-2', 'DUP-2', '2026-08-06', metro, 1000, 100), billHead('gst-1', 'GST-1', '2026-08-15', power, 1000, 150)];
const SPEND = [
  { UID: 'sp-wages', PaymentNumber: 'CS9001', Date: '2026-08-07T00:00:00', PayFrom: 'Account', Account: ACC.bank, Contact: Object.assign({ Type: 'Supplier' }, power), AmountPaid: 550, IsTaxInclusive: false, TotalTax: 50, Memo: 'Casual staff', IsReportable: null, Lines: [{ RowID: 1, Account: ACC.wages, Job: null, TaxCode: GST, Amount: 500, Memo: 'Casual staff' }] },
  { UID: 'sp-susp', PaymentNumber: 'CS9002', Date: '2026-08-10T00:00:00', PayFrom: 'Account', Account: ACC.bank, Contact: null, AmountPaid: 300, IsTaxInclusive: false, TotalTax: 0, Memo: '', IsReportable: null, Lines: [{ RowID: 1, Account: ACC.susp, Job: null, TaxCode: NT, Amount: 300, Memo: '' }] }];
const add = (base, extra, keep) => (p) => { const r = base(p); if (mine(p)) r.Items = r.Items.concat(extra.filter((x) => keep(p, x))); r.Count = r.Items.length; return r; };
const contacts = (p) => { const r = L.listContacts(p); if (mine(p)) r.Items = r.Items.concat([
  { UID: 'dup-card', CompanyName: 'Metro Wholesale Pty Ltd', FirstName: null, LastName: null, IsIndividual: false, DisplayID: 'SUP000200', IsActive: true, Type: 'Supplier', CurrentBalance: 0 },
  { UID: 'cus-metro', CompanyName: 'Metro Wholesale', FirstName: null, LastName: null, IsIndividual: false, DisplayID: 'CUS000200', IsActive: true, Type: 'Customer', CurrentBalance: 0 }]); return r; };
const suppliers = (p) => { const r = L.listSuppliers(p); if (mine(p)) r.Items.forEach((s) => { if (s.UID === metro.UID) s.ABN = null; }); return r; };
const accounts = (p) => { const r = L.listAccounts(p); if (mine(p)) r.Items = r.Items.concat([Object.assign({ Classification: 'Liability', Type: 'OtherCurrentLiability', IsHeader: false, IsActive: true, CurrentBalance: 300, TaxCode: null }, ACC.susp)]); return r; };
const planted = (m, over) => FX(m, Object.assign({
  bill_lines: add(L.listBillLines, BILL_LINES, (p, x) => inP(p, x.Date)), open_bills: add(L.listBills, BILL_HEADS, (p) => !p.status || p.status === 'Open' || p.status === 'All'),
  spend: add(spendMoney, SPEND, (p, x) => inP(p, x.Date)), contacts, suppliers, accounts }, over || {}));
const open = async (id, over, opts, set) => { const m = withDefaults(man(id), Object.assign({ company_file: CF }, set || {})); const t = await run('myob/' + id, m, planted(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(250); t.m = m; return t; };
const xlsxOf = async (t) => { t.doc.getElementById('mk-xlsx').click(); await t.settle(); await wait(30); return xlsxText(t); };

(async () => {
  const dq = await open('data-quality');
  ok('Data Quality opens green, no script errors (findings are not report failures)', green(dq) && dq.errs.length === 0, banner(dq).slice(0, 500));
  ok('a duplicate bill is found (same supplier, same amount, 3 days apart)', /CHK-055.*Bills DUP-1 \(3 Aug 2026\) and DUP-2 \(6 Aug 2026\) from Metro Wholesale have the same amount 3 day\(s\) apart/.test(body(dq)), body(dq).slice(0, 900));
  ok('GST on wages is found (CHK-058)', /CHK-058.*\$50\.00 GST claimed on 1 line\(s\) coded to 6-5130 Wages & Salaries/.test(body(dq)));
  ok('a bill whose GST isn\'t the tax code\'s share is found (CHK-059, header TotalTax vs the lines)', /CHK-059.*1 purchase\(s\) have GST that isn't the tax rate's share of the line \(PowerDirect\)/.test(body(dq)));
  ok('duplicate supplier cards are found (CHK-006, "Pty Ltd" ignored)', /CHK-006.*2 active contacts have the same name: Metro Wholesale, Metro Wholesale Pty Ltd/.test(body(dq)));
  ok('a customer card with a supplier card\'s name is not a duplicate (MYOB needs one card per role)', !/3 active contacts have the same name/.test(body(dq)));
  ok('unreconciled bank lines up to the end of last month are found from the journals (CHK-022)', /CHK-022.*bank transaction\(s\) dated up to 31 Aug 2026 aren't reconciled/.test(body(dq)));
  ok('GST from a supplier with no ABN is found (CHK-008)', /CHK-008.*supplier\(s\) with no ABN on file: Metro Wholesale/.test(body(dq)));
  ok('the suspense account balance is found (CHK-125)', /CHK-125.*Account 2-9990 Suspense has a balance of \$300\.00/.test(body(dq)));
  ok('register checks read "Not run on MYOB" (Xero only), never Clear or "Runs overnight"', /CHK-071Bill Raised With A Cancelled Supplier.*?Not run on MYOB: it needs the Australian Business Register lookups, and those run for Xero clients only/.test(body(dq)) && !/Runs overnight/.test(body(dq)));
  ok('engine-only checks say only the Xero engine can do it', /CHK-017Contact Bank Account Changed.*?Not run on MYOB: only the overnight engine compares each contact's bank details with the last run, and those run for Xero clients only/.test(body(dq)));
  ok('the scope check counts them as not run (Xero only)', /not run \(Xero only\)/.test(banner(dq)), banner(dq).slice(0, 600));
  const NA = [['CHK-021', /N\/A: MYOB's API doesn't say whether a spend money transaction has an attachment/], ['CHK-086', /N\/A: MYOB's API doesn't say whether a bill has an attachment/], ['CHK-033', /N\/A: MYOB has no draft or awaiting-approval sales invoices/],
    ['CHK-031', /N\/A: MYOB's API doesn't say whether the business is registered for GST/], ['CHK-136', /N\/A: MYOB's API doesn't say whether the business is registered for GST/], ['CHK-134', /N\/A: MYOB's API doesn't return the company file's lock period/],
    ['CHK-024', /N\/A: MYOB didn't return the open invoices' delivery status/]];
  const row = (t, id) => { const m = new RegExp(id + '[A-Z][^]*?(Clear|\\d+ findings?|N\\/A: [^]*?|Runs overnight: [^]*?|Not run on [^]*?)(?=CHK-\\d{3}[A-Z]|CQ-\\d\\d[A-Z]|$)').exec(body(t)); return m ? m[0] : ''; };
  NA.forEach(([id, re]) => ok(id + ' reads N/A with the reason, never Clear', re.test(row(dq, id)) && !/Clear$/.test(row(dq, id)), row(dq, id).slice(0, 300)));
  const x1 = await xlsxOf(dq);
  ok('Data Quality Excel has the findings and what was checked', /DUP-1/.test(x1) && /What was checked/.test(x1) && /CHK-071/.test(x1), x1.length);

  const sent = await open('data-quality', { open_inv: (p) => { const r = L.listInvoices(p); r.Items.forEach((i, k) => { i.InvoiceDeliveryStatus = k === 0 ? 'Email' : 'Nothing'; }); return r; } });
  const first = L.listInvoices({ myob_company_file_id: CF, status: 'Open' }).Items[0];
  ok('with the delivery status returned, an open invoice still "to be emailed" is found (CHK-024)', first.Date.slice(0, 10) >= '2026-07-01' ? new RegExp('CHK-024.*1 approved sales invoice\\(s\\) were never sent \\(' + first.Number + '\\)').test(body(sent)) : /CHK-024Invoice Not Sent to ContactSalesLow.*?Clear/.test(body(sent)), [first.Number, first.Date, row(sent, 'CHK-024').slice(0, 200)]);

  const cq = await open('client-queries');
  ok('Client Queries opens green', green(cq) && cq.errs.length === 0, banner(cq).slice(0, 400));
  ok('the suspense-coded spend asks what it was for (CQ-01)', /Transaction Coded to a Suspense or Uncoded Account \(1\).*?Spend money.*?\$300\.00What was this for\?/.test(body(cq)), body(cq).slice(0, 700));
  ok('the spend with no card and no memo asks who and what (CQ-02)', /Bank Transaction With No Contact or Description \(1\)/.test(body(cq)) && /Who was this with, and what was it for\?/.test(body(cq)));
  ok('the supplier with no ABN is listed with what we need', /TPAR Information Missing/.test(body(cq)) && /Metro Wholesale.*?ABN/.test(body(cq)));
  ok('missing receipts read N/A on MYOB, not "nothing missing"', /CHK-021[^]*?N\/A: MYOB's API doesn't say/.test(body(cq)) && !/Receipts missing[1-9]/.test(body(cq)));
  ok('a ready-to-send message is drafted for the period', /Ready to send.*Hi, we need a few things to finish your books for 1 Jul 2026 to 28 Sep 2026/.test(body(cq)), body(cq).slice(-900));
  const x2 = await xlsxOf(cq);
  ok('Client Queries Excel lists every item with what we need', /What was this for\?/.test(x2) && /Who was this with/.test(x2));

  const gst = await open('gst-check');
  ok('GST Check opens green', green(gst) && gst.errs.length === 0, banner(gst).slice(0, 400));
  ok('GST on wages and the GST amount mismatch are unresolved GST risk', /Unresolved GST risk.*CHK-058.*CHK-059|Unresolved GST risk.*CHK-059.*CHK-058/.test(body(gst)), body(gst).slice(0, 600));
  ok('scope and method lists every GST check', ['CHK-003', 'CHK-008', 'CHK-031', 'CHK-058', 'CHK-059', 'CHK-068', 'CHK-069', 'CHK-076', 'CHK-077', 'CHK-085', 'CHK-129', 'CHK-136'].every((k) => body(gst).includes(k)));

  const hc = await open('health-check');
  const pl = L.expect.plByAccount('2026-07-01', '2026-09-28', false, CF);
  ok('Health Check opens green, net profit ties to income − expenses', green(hc) && /✓ Net profit = income − expenses/.test(banner(hc)), banner(hc).slice(0, 600));
  ok('Health Check net profit is MYOB\'s own net profit for the period', new RegExp('Net profit\\$' + Math.abs(L.expect.netProfit('2026-07-01', '2026-09-28', false, CF)).toLocaleString('en-AU', { minimumFractionDigits: 2 }).replace(/\./g, '\\.')).test(body(hc)), [L.expect.netProfit('2026-07-01', '2026-09-28', false, CF), body(hc).slice(0, 200), Object.keys(pl).length]);
  const ar = L.listInvoices({ myob_company_file_id: CF, status: 'Open' }).Items.filter((i) => i.Date.slice(0, 10) <= '2026-09-28').reduce((s, i) => s + i.BalanceDueAmount, 0);
  ok('receivables outstanding = the open invoices\' balance due', new RegExp('Receivables outstanding\\$' + ar.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.')).test(body(hc)), [ar, body(hc).slice(0, 400)]);
  ok('Health Check shows financial activity, data quality and top findings', /Financial activity.*Income.*Expenses.*Bank balance \(end of period\).*Receivables overdue/.test(body(hc)) && /Data quality by category/.test(body(hc)) && /Top findings/.test(body(hc)));
  const past = await open('health-check', null, null, { display: JSON.stringify(Object.assign(JSON.parse(man('health-check').inputs.find((i) => i.name === 'display').default), { p: 'custom' })), from_date: '2026-07-01', to_date: '2026-08-31' });
  ok('a period ending before today: the bank balance reads N/A (MYOB returns today\'s balance only), never today\'s figure', /Bank balance \(end of period\)N\/A — not in source/.test(body(past)) && /N\/A for a period ending before today/.test(banner(past)), body(past).slice(0, 300));

  const broken = await open('data-quality', { inv_lines: () => { throw new Error('MYOB 500: Server error'); } });
  ok('a ledger source that fails = red banner naming it, never an empty "all clear"', red(broken) && /Ledger sources loaded/.test(banner(broken)) && !/Data quality: Good/.test(body(broken)), banner(broken).slice(0, 300));
  const noJ = await open('data-quality', { journals: () => { throw new Error('MYOB 500: journals'); } });
  ok('journals that fail: CHK-022 reads N/A with the reason, the report still opens', !red(noJ) && /CHK-022[^]*?N\/A: the journal transactions \(reconciliation dates\) could not be loaded/.test(body(noJ)), banner(noJ).slice(0, 300));
  const noS = await open('data-quality', { suppliers: () => { throw new Error('MYOB 500: suppliers'); } });
  ok('supplier cards that fail: the ABN checks read N/A, not a finding against every supplier', /CHK-008[^]*?N\/A: the supplier cards \(ABNs\) could not be loaded/.test(body(noS)) && !/CHK-008Banking|CHK-008Contacts[^]*?with no ABN on file/.test(body(noS)));

  const dk = await open('data-quality', null, { theme: 'dark' });
  ok('dark theme renders without errors', dk.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && dk.errs.length === 0 && green(dk), banner(dk).slice(0, 200));
  const sn = await open('health-check', null, { mode: 'snapshot' });
  ok('snapshot mode disables the data controls and still validates', sn.doc.getElementById('mk-from').disabled && sn.doc.getElementById('mk-client').disabled && !/✗/.test(banner(sn)) && sn.errs.length === 0, banner(sn).slice(0, 300));

  // LIB-002 in brief (lib.js's conformance helper reads its own tool map, which has no list_suppliers): the company file picker,
  // a switch that refetches every binding for file 2 only, and file 2's name in the Excel download. Plus the size cap: 47,000 tokens
  // for these four, because the agent never writes them (Use this report, or artifact_from_template), the only reason for the
  // 35,000 limit, and the MYOB kit goes in whole (not pruned like the Xero kit's): its Activity Count alone is about 32,500.
  for (const id of IDS) {
    const m = man(id);
    ok(id + ': every MYOB binding is scoped to the chosen company file', m.bindings.every((b) => b.tool.name === 'list_company_files' || ((b.params || {}).myob_company_file_id || {}).input === 'company_file'));
    ok(id + ': 12 bindings at most, 8 inputs at most', m.bindings.length <= 12 && m.inputs.length <= 8, [m.bindings.length, m.inputs.length]);
    const t = await open(id);
    const sel = t.doc.getElementById('mk-client');
    ok(id + ': opens on company file 1 by name; the picker lists both files', text(t.doc, 'header .co') === N1 && sel && [...sel.options].map((o) => o.textContent).join('|').includes(N1 + '|' + N2));
    const before = t.calls.length; sel.value = L.CF2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(300);
    const re = t.calls.slice(before).filter((x) => x.params), scoped = m.bindings.filter((b) => b.tool.name !== 'list_company_files').map((b) => b.id);
    ok(id + ': switching refetches every MYOB binding for file 2 only, and shows file 2', scoped.every((b) => re.some((x) => x.id === b && x.params.myob_company_file_id === L.CF2)) && !re.some((x) => x.params.myob_company_file_id && x.params.myob_company_file_id !== L.CF2) && text(t.doc, 'header .co') === N2 && green(t), banner(t).slice(0, 200));
    t.doc.getElementById('mk-xlsx').click(); await t.settle(); await wait(30);
    const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '';
    ok(id + ': the Excel download after the switch is file 2\'s', name.startsWith(N2 + ' - ') && /\.xlsx$/.test(name), name);
    const html = build('myob/' + id), mf = JSON.stringify(m, null, 2);
    let tokens = null; try { tokens = require(path.join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer')).countTokens(html + mf); } catch (e) { tokens = null; }
    const longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
    ok(id + ': size limits — document + dataBindings ≤ 47,000 tokens (the MYOB live-checks cap), no line over 1,500 characters', tokens != null && tokens <= 47000 && longest <= 1500, { tokens, longest, bytes: html.length });
  }
  done(); process.exit(process.exitCode || 0);
})();

// CRA-02 / 08 / 09 / 10 live checks (QuickBooks): the four views on the QuickBooks tax ledger (qb-tax-ledger.js: Invoice, Bill,
// Purchase with tax lines and tax codes), plus planted problems so each rule has something to find: a duplicate bill, GST on
// bank fees, a spend coded to Uncategorised Expense with no contact or note, an invoice never sent, duplicate suppliers, a
// suspense balance, and bills and spend money with nothing attached. What QuickBooks can't answer (ABNs, reconciliation,
// drafts) must read N/A with the reason, never Clear; register and engine-only checks read "Not run on QuickBooks" (the overnight engine covers Xero only), never Clear or "Runs overnight".
const U = require('./qb-test-util.js'), { run, suite, F, xlsxText, text, banner, red } = U;
const TL = require('./qb-tax-ledger.js');
const build = require('../build.js');
const { ok, done } = suite('quickbooks/live-checks');
const IDS = ['data-quality', 'client-queries', 'gst-check', 'health-check'];
const Q = TL.Q, clone = (o) => JSON.parse(JSON.stringify(o)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const body = (t) => text(t.doc, '#qb-body').replace(/\s+/g, ' '), ban = (t) => banner(t).replace(/\s+/g, ' ');
const green = (t) => t.doc.querySelector('#qb-banner').className.includes('pass');
// A planted document: lines [accountId, accountName, taxCodeId, net]; GST 10% on code 10 (purchase rate 21 / sales rate 20), 0 on 11.
function planted(entity, id, date, ref, lines, extra) {
  const sale = entity === 'Invoice', byRate = {};
  const L = lines.map(([acc, name, code, net], i) => { const dt = sale ? 'SalesItemLineDetail' : 'AccountBasedExpenseLineDetail'; const r = sale ? { 10: '20', 11: '22' }[code] : { 10: '21', 11: '23' }[code]; byRate[r] = (byRate[r] || 0) + net;
    return { Id: String(i + 1), Amount: net, DetailType: dt, [dt]: Object.assign({ TaxCodeRef: { value: code } }, acc ? { AccountRef: { value: acc, name } } : {}) }; });
  const TaxLine = Object.keys(byRate).map((r) => { const p = r === '21' || r === '20' ? 10 : 0; return { Amount: Math.round(byRate[r] * p) / 100, DetailType: 'TaxLineDetail', TaxLineDetail: { TaxRateRef: { value: r }, PercentBased: true, TaxPercent: p, NetAmountTaxable: byRate[r] } }; });
  const tax = TaxLine.reduce((s, x) => s + x.Amount, 0), net = lines.reduce((s, l) => s + l[3], 0);
  return Object.assign({ Id: id, DocNumber: id, TxnDate: date, GlobalTaxCalculation: 'TaxExcluded', Line: L, TxnTaxDetail: { TotalTax: tax, TaxLine }, TotalAmt: Math.round((net + tax) * 100) / 100, Balance: 0 }, ref, extra || {});
}
const METRO = { VendorRef: { value: '91', name: 'Metro Wholesale' } };
const EXTRA = {
  Bill: [planted('Bill', 'DUP-1', '2026-08-03', METRO, [['80', 'Office supplies', '10', 1000]], { Balance: 1100, DueDate: '2026-09-03' }), planted('Bill', 'DUP-2', '2026-08-06', METRO, [['80', 'Office supplies', '10', 1000]], { Balance: 1100, DueDate: '2026-10-06' })],
  Purchase: [planted('Purchase', 'FEE-1', '2026-08-05', { EntityRef: { value: '92', name: 'Westpac', type: 'Vendor' } }, [['98', 'Bank fees', '10', 50]], { PaymentType: 'Cash', PrivateNote: 'Monthly fee' }),
    planted('Purchase', 'SUSP-1', '2026-08-10', {}, [['99', 'Uncategorised Expense', '11', 300]], { PaymentType: 'Cash' })],
  Invoice: [planted('Invoice', 'INV-UNSENT', '2026-08-12', { CustomerRef: { value: '5', name: 'Civica Pty Ltd' } }, [[null, null, '10', 1000]], { EmailStatus: 'NotSet', DueDate: '2026-09-12', Balance: 1100 })]
};
const inWhere = (p, t) => { const m = /TxnDate >= '([\d-]+)' AND TxnDate <= '([\d-]+)'/.exec(p.where || ''); return !m || (t.TxnDate >= m[1] && t.TxnDate <= m[2]); };
const all = (entity) => clone((TL.BOOKS[entity] || []).concat(EXTRA[entity] || []));
const list = (entity) => (p) => { if (!/TxnDate >= /.test(p.where || '')) throw new Error('QBO query: bad where ' + p.where); return Q(entity, all(entity).filter((t) => inWhere(p, t)).slice(0, p.maxResults || 100)); };
const openList = (entity) => (p) => { if (p.where !== "Balance > '0'") throw new Error('QBO query: bad where ' + p.where); return Q(entity, all(entity).filter((t) => t.Balance > 0)); };
const vendors = () => Q('Vendor', [['7', 'Office Supplies Co'], ['91', 'Metro Wholesale'], ['93', 'Metro Wholesale Pty Ltd'], ['92', 'Westpac']].map(([Id, DisplayName]) => ({ Id, DisplayName, Active: true, Balance: 0 })));
const ACC = [['35', 'Cheque account', 'Bank', 'Asset', 100000], ['60', 'Office expenses', 'Expense', 'Expense', 0, '10'], ['61', 'Computer equipment', 'Fixed Asset', 'Asset', 0], ['80', 'Office supplies', 'Expense', 'Expense', 0, '10'],
  ['98', 'Bank fees', 'Expense', 'Expense', 0, '11'], ['99', 'Uncategorised Expense', 'Expense', 'Expense', 0], ['850', 'Suspense', 'Other Current Liability', 'Liability', -120]];
const accounts = () => Q('Account', ACC.map(([Id, Name, AccountType, Classification, CurrentBalance, tc]) => Object.assign({ Id, Name, AccountType, Classification, CurrentBalance, Active: true }, tc ? { TaxCodeRef: { value: tc } } : {})));
const attachables = () => Q('Attachable', ['DUP-1', 'DUP-2'].map((id, i) => ({ Id: 'A' + i, FileName: id + '.pdf', AttachableRef: [{ EntityRef: { type: 'Bill', value: id } }] }))
  .concat([{ Id: 'A9', FileName: 'fee.pdf', AttachableRef: [{ EntityRef: { type: 'Purchase', value: 'FEE-1' } }] }]));
const prefs = (tax, acct) => () => { const p = clone(F.prefs); if (tax) p.Preferences.TaxPrefs = tax; if (acct) Object.assign(p.Preferences.AccountingInfoPrefs, acct); return p; };
const fx = (over) => Object.assign({ invoices: list('Invoice'), bills: list('Bill'), purchases: list('Purchase'), open_invoices: openList('Invoice'), open_bills: openList('Bill'), vendors, accounts,
  tax_codes: TL.fx().tax_codes, attachables, pnl: F.pnl, company_info: () => F.companyInfo, prefs: prefs() }, over || {});
const man = (id) => build.manifest('quickbooks/' + id);
const open = async (id, over) => { const t = await run('quickbooks/' + id, man(id), fx(over)); await wait(200); return t; };

(async () => {
  for (const id of IDS) {
    const m = man(id);
    ok(id + ': at most 12 bindings and 8 inputs', m.bindings.length <= 12 && m.inputs.length <= 8, [m.bindings.length, m.inputs.length]);
    ok(id + ': every list asks for the period or a fixed filter, with MAXRESULTS 1000', m.bindings.filter((b) => /^list_/.test(b.tool.name)).every((b) => b.params.maxResults && b.params.maxResults.value === 1000));
  }
  const dq = await open('data-quality');
  ok('Data Quality opens green, no script errors (findings are not report failures)', green(dq) && dq.errs.length === 0, [dq.errs, ban(dq).slice(0, 600)]);
  ok('a duplicate bill is found (same supplier, same amount, 3 days apart)', /CHK-055.*Bills DUP-1 \(3 Aug 2026\) and DUP-2 \(6 Aug 2026\) from Metro Wholesale have the same amount 3 day\(s\) apart/.test(body(dq)), body(dq).slice(0, 900));
  ok('GST on bank fees is found (CHK-058), from the document\'s tax line', /CHK-058.*\$5\.00 GST claimed on 1 line\(s\) coded to Bank fees/.test(body(dq)));
  ok('duplicate suppliers are found (CHK-006, "Pty Ltd" ignored)', /CHK-006.*2 active contacts have the same name: Metro Wholesale, Metro Wholesale Pty Ltd/.test(body(dq)));
  ok('the suspense account balance is found (CHK-125)', /CHK-125.*Account Suspense has a balance of \$120\.00/.test(body(dq)));
  ok('an invoice never sent is found (CHK-024)', /CHK-024.*INV-UNSENT/.test(body(dq)));
  ok('bills with nothing attached are found; the ones with an attachment are not (CHK-086)', /CHK-086.*bill\(s\) over \$82\.50 have nothing attached/.test(body(dq)) && !/CHK-086[^.]*Metro Wholesale/.test(body(dq)));
  ok('spend money with nothing attached is found (CHK-021)', /CHK-021.*spend money transaction\(s\) over \$82\.50 have nothing attached \(AWS/.test(body(dq)));
  ok('no lock date in the preferences = CHK-134', /CHK-134.*No lock date is set/.test(body(dq)));
  ok('ABN checks read N/A with the reason, never Clear', /CHK-008Large GST Activity for Contact Without ABN.*?N\/A: QuickBooks contacts carry no ABN field/.test(body(dq)) && /CHK-007TPAR Information Missing.*?N\/A: QuickBooks contacts carry no ABN field/.test(body(dq)));
  ok('reconciliation reads N/A with the reason (CHK-022)', /CHK-022Unreconciled Transactions.*?N\/A: QuickBooks doesn't say through its API whether a transaction is reconciled/.test(body(dq)));
  ok('drafts read N/A with the reason (CHK-033)', /CHK-033Invoices in Draft or Awaiting Approval.*?N\/A: QuickBooks has no draft or awaiting-approval invoices/.test(body(dq)));
  ok('register checks read "Not run on QuickBooks" (Xero only), never Clear or "Runs overnight"', /CHK-071Bill Raised With A Cancelled Supplier.*?Not run on QuickBooks: it needs the Australian Business Register lookups, and those run for Xero clients only/.test(body(dq)) && !/Runs overnight/.test(body(dq)));
  ok('engine-only checks say only the Xero engine can do it', /CHK-017Contact Bank Account Changed.*?Not run on QuickBooks: only the overnight engine compares each contact's bank details with the last run, and those run for Xero clients only/.test(body(dq)));
  ok('the scope check counts them as not run (Xero only)', /not run \(Xero only\)/.test(banner(dq)), banner(dq).slice(0, 600));
  ok('no GST setting in the preferences = CHK-031 reads N/A with the reason', /CHK-031GST on Invoice and\/or Credit Note When Not Registered.*?N\/A: the business's GST registration is not in source/.test(body(dq)));
  ok('the duplicate-bill amounts carry GST from the tax line (no GST mismatch on clean books)', !/CHK-059.*isn't the tax rate's share/.test(body(dq)));
  const x1 = await xlsxText(dq);
  ok('Data Quality Excel has the findings and what was checked', /DUP-1/.test(x1) && /What was checked/.test(x1) && /CHK-071/.test(x1), x1.length);

  const cq = await open('client-queries');
  ok('Client Queries opens green', green(cq) && cq.errs.length === 0, ban(cq).slice(0, 400));
  ok('the spend coded to Uncategorised Expense asks what it was for (CQ-01)', /Transaction Coded to a Suspense or Uncoded Account \(1\).*?Spend money.*?\$300\.00What was this for\?/.test(body(cq)), body(cq).slice(0, 700));
  ok('the spend with no contact and no note asks who and what (CQ-02)', /Bank Transaction With No Contact or Description \(1\)/.test(body(cq)) && /Who was this with, and what was it for\?/.test(body(cq)));
  ok('missing receipts are listed per transaction', /Bills Raised Without Attachments Over \$75 \(\d+\)/.test(body(cq)) && /Receipt or tax invoice/.test(body(cq)));
  ok('the ABN query reads N/A in what was checked (no ABN in QuickBooks)', /CHK-007.*?N\/A: QuickBooks contacts carry no ABN field/.test(body(cq)));
  ok('a ready-to-send message is drafted for the period', /Ready to send.*Hi, we need a few things to finish your books for 1 Jul 2026 to 30 Sep 2026/.test(body(cq)));
  const x2 = await xlsxText(cq);
  ok('Client Queries Excel lists every item with what we need', /What was this for\?/.test(x2) && /Receipt or tax invoice/.test(x2));

  const gst = await open('gst-check');
  ok('GST Check opens green', green(gst) && gst.errs.length === 0, ban(gst).slice(0, 400));
  ok('GST on bank fees is unresolved GST risk', /Unresolved GST risk.*CHK-058/.test(body(gst)));
  ok('scope and method lists every GST check', ['CHK-003', 'CHK-008', 'CHK-031', 'CHK-058', 'CHK-059', 'CHK-068', 'CHK-069', 'CHK-076', 'CHK-077', 'CHK-085', 'CHK-129', 'CHK-136'].every((k) => body(gst).includes(k)));
  const gst2 = await open('gst-check', { prefs: prefs({ UsingSalesTax: false }) });
  ok('GST not set up + GST on sales = CHK-031 finding', /CHK-031.*sales invoice\(s\) or credit note\(s\) charge GST, but the business isn't registered for GST/.test(body(gst2)), body(gst2).slice(0, 600));
  const gst3 = await open('gst-check', { prefs: prefs({ UsingSalesTax: true }) });
  ok('GST set up = CHK-031 runs and is Clear', /CHK-031GST on Invoice and\/or Credit Note When Not Registered.*?Clear/.test(body(gst3)));
  const gst4 = await open('gst-check', { purchases: (p) => { const r = list('Purchase')(p); r.QueryResponse.Purchase.forEach((t) => { if (t.Id === 'FEE-1') t.TxnTaxDetail.TaxLine[0].Amount = 9; }); return r; } });
  ok('a tax line that isn\'t the rate\'s share of the line = CHK-059', /CHK-059.*1 purchase\(s\) have GST that isn't the tax rate's share of the line \(Westpac\)/.test(body(gst4)), body(gst4).slice(0, 600));

  const hc = await open('health-check');
  ok('Health Check opens green, net profit ties to income − expenses', green(hc) && /✓ Net profit = income − expenses/.test(ban(hc)), ban(hc).slice(0, 700));
  ok('Health Check shows the bank balance and money owed from QuickBooks', /Bank balance \(end of period\)A?\$100,000\.00Receivables outstandingA?\$1,102\.00Receivables overdueA?\$1,100\.00Payables outstandingA?\$2,200\.00Payables overdueA?\$1,100\.00/.test(body(hc)), body(hc).slice(0, 900));
  ok('Health Check says the balances are current (as of today)', /bank balances and money owed are the current balances \(as of today\)/.test(text(hc.doc, 'body')));
  const hcLock = await open('health-check', { prefs: prefs({ UsingSalesTax: true }, { BookCloseDate: '2026-06-30' }) });
  ok('a recent lock date (books closed) = no CHK-134 finding', !/CHK-134/.test(text(hcLock.doc, '#qb-body').split('Top findings')[1] || ''));

  const noAtt = await open('data-quality', { attachables: () => Q('Attachable', Array.from({ length: 1000 }, (_, i) => ({ Id: 'X' + i, AttachableRef: [{ EntityRef: { type: 'Bill', value: 'zz' + i } }] }))) });
  ok('over 1,000 attachments = the attachment checks read N/A (never a false "nothing attached"), banner still green', green(noAtt) && /CHK-086Bills Raised Without Attachments Over \$75.*?N\/A: over 1,000 attachments/.test(body(noAtt)) && !/CHK-086.*have nothing attached/.test(body(noAtt)), body(noAtt).slice(0, 300));
  const capped = await open('data-quality', { bills: (p) => { const b = list('Bill')(p).QueryResponse.Bill[0]; return Q('Bill', Array.from({ length: 1000 }, (_, i) => Object.assign(clone(b), { Id: 'C' + i, DocNumber: 'C-' + i, TotalAmt: 100 + i, TxnDate: '2026-07-' + String(1 + (i % 28)).padStart(2, '0') }))); } });
  ok('a list at the 1,000-row cap is a failed check, never a silent undercount', red(capped) && /Possibly truncated at 1000 rows: bills/.test(ban(capped)), ban(capped).slice(0, 400));
  const broken = await run('quickbooks/data-quality', man('data-quality'), fx(), { fail: { invoices: { code: 'tool_error', message: 'QuickBooks API error' } } }); await wait(200);
  ok('a ledger source that fails = red banner naming it, never an empty "all clear"', red(broken) && /Ledger sources loaded/.test(ban(broken)) && !/Data quality: Good/.test(body(broken)), ban(broken).slice(0, 300));

  // Template copy (artifact_from_template / "Use this report" after a change): the copy's period is adopted, never the template's.
  for (const id of IDS) await U.conformance((n, p, d) => ok(id + ': ' + n, p, d), 'quickbooks/' + id, man(id), fx(), { start_date: '2026-04-01', end_date: '2026-06-30', txn_where: "TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'" }, 'April - June, 2026');
  // Size limits: document + dataBindings ≤ 46,000 tokens for the four live-checks templates (never written by the agent: opened
  // from the template or copied with artifact_from_template), no line over 1,500 characters — measured as the Xero kit does.
  // The QuickBooks kit goes in whole (not pruned like the Xero kit: qb-kit.js alone is about 26,000 tokens), hence 46,000.
  const tk = require('path').join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer');
  for (const id of IDS) {
    const html = build('quickbooks/' + id), mf = JSON.stringify(man(id), null, 2), tokens = require(tk).countTokens(html + mf), longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
    ok(id + ': size limits — document + dataBindings ≤ 46,000 tokens (the QuickBooks live-checks cap), no line over 1,500 characters', tokens <= 46000 && longest <= 1500, { tokens, longest });
  }
  done(); process.exit(process.exitCode || 0);
})();

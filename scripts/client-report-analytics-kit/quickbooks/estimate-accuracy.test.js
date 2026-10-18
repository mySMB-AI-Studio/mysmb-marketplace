// CRA-13 Estimate Accuracy (QuickBooks): estimates dated in the period against the invoices raised from them, matched from
// either side of LinkedTxn. Planted: an estimate invoiced in two parts (+10%), one linked only from the invoice (−10%), a
// pending and a rejected one, one linked to an invoice that isn't in the list, one outside the period, and an invoice shared
// by two estimates. The fixtures apply the report's `where` like QuickBooks does.
const U = require('./qb-test-util.js'), { run, suite, F, xlsxText, text, banner, red } = U;
const build = require('../build.js');
const REF = 'quickbooks/estimate-accuracy', manifest = build.manifest(REF);
const { ok, done } = suite(REF);
const Q = (e, l) => ({ QueryResponse: { [e]: l, startPosition: 1, maxResults: l.length } });
const E = (Id, date, who, amt, status, inv) => ({ Id, DocNumber: 'Q-' + Id.slice(1), TxnDate: date, TotalAmt: amt, TxnStatus: status, CustomerRef: { value: Id, name: who }, LinkedTxn: (inv || []).map((i) => ({ TxnId: i, TxnType: 'Invoice' })) });
const I = (Id, date, amt, est) => ({ Id, DocNumber: Id, TxnDate: date, TotalAmt: amt, Balance: 0, LinkedTxn: (est || []).map((e) => ({ TxnId: e, TxnType: 'Estimate' })) });
const ESTS = [E('E0', '2026-06-20', 'Old Co', 4000, 'Closed'), E('E1', '2026-07-10', 'Civica Pty Ltd', 10000, 'Closed', ['I1', 'I2']), E('E2', '2026-08-01', 'Northwind Traders', 8000, 'Accepted'),
  E('E3', '2026-09-01', 'Bluegum Architects', 5000, 'Pending'), E('E4', '2026-09-10', 'Redwood Dental', 2000, 'Rejected'), E('E5', '2026-09-15', 'Summit Legal', 1000, 'Closed', ['I9'])];
const INVS = [I('I1', '2026-07-20', 6000), I('I2', '2026-08-20', 5000), I('I3', '2026-08-15', 7200, ['E2']), I('I4', '2026-08-30', 3000)];
const where = (p, re) => { const m = re.exec((p && p.where) || ''); if (!m) throw new Error('QBO query: bad where ' + (p && p.where)); return m; };
const fx = (ests, invs) => ({
  estimates: (p) => { const m = where(p, /TxnDate >= '([\d-]+)' AND TxnDate <= '([\d-]+)'/); return Q('Estimate', JSON.parse(JSON.stringify(ests.filter((e) => e.TxnDate >= m[1] && e.TxnDate <= m[2])))); },
  invoices: (p) => { const m = where(p, /^TxnDate >= '([\d-]+)'$/); return Q('Invoice', JSON.parse(JSON.stringify(invs.filter((i) => i.TxnDate >= m[1])))); },
  company_info: () => F.companyInfo, prefs: () => F.prefs });
const body = (t) => text(t.doc, '#qb-body').replace(/\s+/g, ' '), ban = (t) => banner(t).replace(/\s+/g, ' ');
const row = (t, no) => [...t.doc.querySelectorAll('#qb-body tbody tr')].map((r) => [...r.cells].map((c) => c.textContent)).find((c) => c[1] === no);
(async () => {
  const t = await run(REF, manifest, fx(ESTS, INVS)); await t.settle(20);
  ok('no script errors, banner not failing', t.errs.length === 0 && !red(t), [t.errs, ban(t).slice(0, 500)]);
  ok('estimates are asked for the period, invoices from the period start on', (t.calls.find((c) => c.id === 'estimates') || {}).params.where === "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'" && (t.calls.find((c) => c.id === 'invoices') || {}).params.where === "TxnDate >= '2026-07-01'");
  ok('the estimate outside the period is not listed', !row(t, 'Q-0'));
  ok('invoiced in two parts: 10,000 estimated, 11,000 invoiced, +1,000 (+10.0%)', JSON.stringify(row(t, 'Q-1').slice(3)) === JSON.stringify(['Closed', 'A$10,000.00', 'A$11,000.00', 'A$1,000.00', '+10.0%']), row(t, 'Q-1'));
  ok('linked only from the invoice side: 8,000 estimated, 7,200 invoiced, −800 (−10.0%)', JSON.stringify(row(t, 'Q-2').slice(3)) === JSON.stringify(['Accepted', 'A$8,000.00', 'A$7,200.00', '(A$800.00)', '−10.0%']), row(t, 'Q-2'));
  ok('pending and rejected estimates read "Not invoiced", with no variance', row(t, 'Q-3')[5] === 'Not invoiced' && row(t, 'Q-3')[6] === '' && row(t, 'Q-4')[5] === 'Not invoiced');
  ok('totals of the invoiced estimates: 18,000 → 18,200, +200 (+1.1%)', /Total of the invoiced estimatesA\$18,000\.00A\$18,200\.00A\$200\.00\+1\.1%/.test(body(t)), body(t).slice(body(t).indexOf('Total of'), body(t).indexOf('Total of') + 120));
  ok('average absolute variance 10.0%, both within 10%', /Average variance10\.0%/.test(body(t)) && /2 of 2 invoiced estimate\(s\) came within 10% of the estimate/.test(body(t)));
  ok('by status: Pending 1, Accepted 1, Closed 2, Rejected 1, $26,000 estimated', /Pending1A\$5,000\.00Accepted1A\$8,000\.00Closed2A\$11,000\.00Rejected1A\$2,000\.00Total5A\$26,000\.00/.test(body(t)), body(t).slice(body(t).indexOf('By status'), body(t).indexOf('By status') + 200));
  ok('variance maths and status totals are checked', ['✓ Variance = invoiced − estimated, on every invoiced estimate and in total', '✓ Estimated by status adds up to the total estimated', '✓ Statuses add up to the number of estimates'].every((s) => ban(t).includes(s)), ban(t).slice(0, 700));
  ok('a linked invoice that isn\'t in the list is named, for information', /ℹ Every linked invoice found — Not in the invoices read \(dated before 2026-07-01\?\): Q-5 → invoice I9/.test(ban(t)), ban(t));
  ok('says plainly this is dollars, not time', /Estimated vs actual in dollars, from this company's estimates and the invoices raised from them\. QuickBooks has no time estimates, so this is not time accuracy\./.test(body(t)));
  const x = await xlsxText(t);
  ok('Excel lists every estimate with its variance', /Q-1/.test(x) && /Not invoiced/.test(x) && /Variance %/.test(x));
  // one invoice raised from two estimates is shared in proportion to their totals (5,000 : 2,000 of 7,000)
  const shared = await run(REF, manifest, fx(ESTS.slice(0, 5), INVS.concat([I('I6', '2026-09-20', 7000, ['E3', 'E4'])]))); await shared.settle(20);
  ok('an invoice shared by two estimates is split in proportion: 5,000 and 2,000, no variance', row(shared, 'Q-3')[5] === 'A$5,000.00' && row(shared, 'Q-3')[6] === 'A$0.00' && row(shared, 'Q-4')[5] === 'A$2,000.00', [row(shared, 'Q-3'), row(shared, 'Q-4')]);
  const none = await run(REF, manifest, fx([], [])); await none.settle(20);
  ok('no estimates in the period: says so, average reads N/A', /No estimates dated in the period/.test(body(none)) && /Average variance N\/A — none invoiced yet|Average varianceN\/A — none invoiced yet/.test(body(none)) && !red(none));
  const f = await run(REF, manifest, fx(ESTS, INVS), { fail: { invoices: { code: 'tool_error', message: 'QuickBooks API error' } } }); await f.settle(20);
  ok('a failed invoice list is a failed check, never "not invoiced"', red(f) && /QuickBooks API error/.test(body(f)) && !/Not invoiced/.test(body(f)));
  await U.conformance(ok, REF, manifest, fx(ESTS, INVS), { start_date: '2026-08-01', end_date: '2026-08-31', txn_where: "TxnDate >= '2026-08-01' AND TxnDate <= '2026-08-31'", inv_where: "TxnDate >= '2026-08-01'" }, 'August 2026');
  const tk = require('path').join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer'), html = build(REF), mf = JSON.stringify(manifest, null, 2), tokens = require(tk).countTokens(html + mf), longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
  ok('size limits — document + dataBindings ≤ 35,000 tokens, no line over 1,500 characters', tokens <= 35000 && longest <= 1500, { tokens, longest });
  done(); process.exit(process.exitCode || 0);
})();

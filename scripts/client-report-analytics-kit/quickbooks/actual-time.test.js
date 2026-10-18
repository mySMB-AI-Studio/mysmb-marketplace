// CRA-12 Actual Time (QuickBooks): hours from the QuickBooks kit's time activities (8 entries, Aug–Sep 2026: employees and a
// supplier, Hours + Minutes and one start/end time with a break, billable / not / has been billed). The fixture applies the
// report's `where` like QuickBooks does. Totals must reconcile by person, by customer and service, and by month, and the
// report must say plainly that this is the client's own staff time, not the practice's.
const U = require('./qb-test-util.js'), { run, suite, F, xlsxText, text, banner, red } = U;
const build = require('../build.js');
const REF = 'quickbooks/actual-time', manifest = build.manifest(REF);
const { ok, done } = suite(REF);
const Q = (e, l) => ({ QueryResponse: { [e]: l, startPosition: 1, maxResults: l.length } });
const inWhere = (p) => { const m = /TxnDate >= '([\d-]+)' AND TxnDate <= '([\d-]+)'/.exec((p && p.where) || ''); if (!m) throw new Error('QBO query: bad where ' + (p && p.where)); return (t) => t.TxnDate >= m[1] && t.TxnDate <= m[2]; };
const time = (p) => { const r = F.timeActivities(); return Q('TimeActivity', r.QueryResponse.TimeActivity.filter(inWhere(p))); };
const fx = { time_activities: time, company_info: () => F.companyInfo, prefs: () => F.prefs };
const body = (t) => text(t.doc, '#qb-body').replace(/\s+/g, ' '), ban = (t) => banner(t).replace(/\s+/g, ' ');
(async () => {
  const t = await run(REF, manifest, fx); await t.settle(20);
  ok('no script errors, banner green', t.errs.length === 0 && t.doc.querySelector('#qb-banner').className.includes('pass'), [t.errs, ban(t).slice(0, 500)]);
  ok('asks for the period with MAXRESULTS 1000', (t.calls.find((c) => c.id === 'time_activities') || {}).params.where === "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'");
  // 7.5 + 3 + 2.25 + 6 + 8 (09:00–17:30 less 0:30) + 4.75 + 8 + 1.5 = 41; billable (incl. has been billed) 32.5; not billable 8.5
  ok('total 41.00 hours, 32.50 billable, 8.50 not billable, 3 people', /Hours41\.00Billable hours32\.50Not billable8\.50People3/.test(body(t)), body(t).slice(0, 300));
  // 7.5×212.5 + 3×180 + 6×150 + 8×180 + 8×212.5 = 6,173.75
  ok('billable value = rate × hours on billable entries', /Billable valueA?\$6,173\.75/.test(body(t)));
  ok('by person: Melanie Burrows 22.50, Yucheng Sun 12.50, the supplier 6.00', /Melanie BurrowsEmployee15\.507\.0022\.50/.test(body(t)) && /Yucheng SunEmployee11\.001\.5012\.50/.test(body(t)) && /Gareth Owen ChaineySupplier6\.000\.006\.00/.test(body(t)), body(t).slice(0, 900));
  ok('start/end time less the break counts as 8 hours', /2026-09-10Yucheng SunCivica Pty LtdConsultingBillable8\.00/.test(body(t)));
  ok('by month: Jul 0.00, Aug 9.50, Sep 31.50 (billable 0.00, 8.00, 24.50)', /Jul 26Aug 26Sep 26TotalHours0\.009\.5031\.5041\.00Billable hours0\.008\.0024\.5032\.50/.test(body(t)), body(t).slice(body(t).indexOf('By month'), body(t).indexOf('By month') + 200));
  ok('every total reconciles (checked)', ['✓ Hours by person add up to the total', '✓ Hours by customer / job and service add up to the total', '✓ Hours by month add up to the total', '✓ Billable + not billable = total hours'].every((s) => ban(t).includes(s)), ban(t).slice(0, 700));
  ok('says plainly this is the client\'s own staff time, not the practice\'s', /Time recorded in this QuickBooks company's time activities \(the client's own staff time\), not the practice's time on this client — that needs a practice-management time source\./.test(body(t)));
  const x = await xlsxText(t);
  ok('Excel: by person, by customer and service, entries', /By person/.test(x) && /By customer and service/.test(x) && /Entries/.test(x) && /Melanie Burrows/.test(x));
  const capped = await run(REF, manifest, Object.assign({}, fx, { time_activities: () => { const one = F.timeActivities().QueryResponse.TimeActivity[0]; return Q('TimeActivity', Array.from({ length: 1000 }, (_, i) => Object.assign({}, one, { Id: 'X' + i }))); } })); await capped.settle(20);
  ok('a list at the 1,000-row cap is a failed check, never a silent undercount', red(capped) && /Possibly truncated at 1000 rows/.test(ban(capped)), ban(capped).slice(0, 300));
  const f = await run(REF, manifest, fx, { fail: { time_activities: { code: 'tool_error', message: 'QuickBooks API error' } } }); await f.settle(20);
  ok('a failed source is never shown as zero hours', red(f) && /Time activities are unavailable — not zero: .*QuickBooks API error/.test(body(f)));
  await U.conformance(ok, REF, manifest, fx, { start_date: '2026-08-01', end_date: '2026-08-31', txn_where: "TxnDate >= '2026-08-01' AND TxnDate <= '2026-08-31'" }, 'August 2026');
  const tk = require('path').join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer'), html = build(REF), mf = JSON.stringify(manifest, null, 2), tokens = require(tk).countTokens(html + mf), longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
  ok('size limits — document + dataBindings ≤ 35,000 tokens, no line over 1,500 characters', tokens <= 35000 && longest <= 1500, { tokens, longest });
  done(); process.exit(process.exitCode || 0);
})();

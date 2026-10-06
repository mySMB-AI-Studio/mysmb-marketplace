// CRA-05 Summary of Tax Amounts by Type (MYOB) on the MYOB kit's ledger: the month calls are fetched after opening and add up to the
// period call code by code, the net GST ties to the GST accounts' movement, tampering fails a check, LIB-002 isolation holds.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green, red, fmt, xlsxText, conformance, common } = require('./lib.js');
const { ok, done } = suite('myob/tax-by-type');
const ID = 'tax-by-type', CF = L.CF1, r2 = L.r2;
const sum = (a, b, cash) => L.taxCodeSummary({ myob_company_file_id: CF, from_date: a, to_date: b, reporting_basis: cash ? 'Cash' : 'Accrual' }).TaxCodeBreakdown;
const code = (rows, c) => rows.find((r) => r.TaxCode.Code === c) || { TaxCollected: 0, TaxPaid: 0, SalesTotal: 0, PurchasesTotal: 0 };
const W = { wait: 300 };
(async () => {
  const t = await go(ID, null, W), Q = sum('2026-04-01', '2026-06-30'), A = sum('2026-04-01', '2026-04-30'), Ma = sum('2026-05-01', '2026-05-31');
  ok('opens on the last complete quarter (Apr–Jun 2026) and is green: months = period, rates, net GST = the GST accounts', green(t) && /✓ Validation: 4\/4 checks passed/.test(banner(t)) && /April - June, 2026/.test(text(t.doc, 'header')) && t.errs.length === 0, banner(t).slice(0, 700));
  const fan = t.calls.filter((c) => c.id === 'gst_month');
  ok('month 1 comes with the bundle; May and June are fetched after opening on the same company file and basis', fan.length === 3 && fan[0].params.from_date === '2026-04-01' && fan[1].requery && fan.slice(1).map((c) => c.params.from_date + '..' + c.params.to_date).join() === '2026-05-01..2026-05-31,2026-06-01..2026-06-30' && fan.every((c) => c.params.myob_company_file_id === CF && c.params.reporting_basis === 'Accrual'), fan.map((c) => c.params));
  const row = (label) => [...t.doc.querySelectorAll('#mk-body tbody tr')].map((r) => r.textContent).find((x) => x.startsWith(label)) || '';
  ok('grid: GST collected on the GST code per month and for the period are MYOB\'s', new RegExp(fmt(code(A, 'GST').TaxCollected) + fmt(code(Ma, 'GST').TaxCollected) + '.*' + fmt(code(Q, 'GST').TaxCollected) + '$').test(row('GST — Goods & Services Tax · sales')), row('GST — Goods & Services Tax · sales'));
  ok('grid: GST paid per month and net GST payable for the period', new RegExp(fmt(code(A, 'GST').TaxPaid)).test(row('GST — Goods & Services Tax · purchases')) && new RegExp('Net GST payable.*' + fmt(r2(code(Q, 'GST').TaxCollected - code(Q, 'GST').TaxPaid))).test(text(t.doc, '#mk-body tfoot')), text(t.doc, '#mk-body tfoot'));
  ok('bars: GST collected vs paid for each of the 3 months', t.doc.querySelectorAll('#cra-bars rect').length === 6);
  ok('reconciliation: the BAS payment in the quarter is left out and the difference is nil', /BAS payments \/ refunds left out \(journals with only GST and bank lines: 1\)/.test(text(t.doc, '#cra-rec')) && /Difference\$0\.00/.test(text(t.doc, '#cra-rec')), text(t.doc, '#cra-rec'));
  // tax-type filter (view only) and the net view
  const sel = t.doc.getElementById('cra-code'); sel.value = 'ITS'; sel.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('tax-type filter shows only ITS rows; totals still cover every code; no refetch', [...t.doc.querySelectorAll('#mk-body .mk-card:first-of-type tbody tr, #mk-body table')[0].querySelectorAll('tbody tr')].every((r) => /^ITS/.test(r.textContent)) && new RegExp('Total GST collected.*' + fmt(code(Q, 'GST').TaxCollected)).test(text(t.doc, '#mk-body tfoot')) && t.calls.length === 6 + 2);
  t.doc.getElementById('cra-code').value = ''; t.doc.getElementById('cra-code').dispatchEvent(new t.w.Event('change')); await wait(20);
  const v = t.doc.getElementById('mk-view'); v.value = 'net'; v.dispatchEvent(new t.w.Event('change')); await wait(40);
  ok('net view: amounts without GST (MYOB\'s GST-inclusive totals less the GST)', new RegExp(fmt(r2(code(Q, 'GST').SalesTotal - code(Q, 'GST').TaxCollected)) + '$').test(row('GST — Goods & Services Tax · sales')) && green(t), row('GST — Goods & Services Tax · sales'));
  // basis: refetch the summaries (and the months again) on Cash; the GST accounts' tie is N/A on cash
  const n0 = t.calls.length, cash = t.doc.querySelector('input[name="mk-basis"][value="Cash"]'); cash.checked = true; cash.dispatchEvent(new t.w.Event('change')); await wait(300);
  const re = t.calls.slice(n0), QC = sum('2026-04-01', '2026-06-30', true);
  ok('cash basis: only the period and month summaries refetch (3 months, Cash); the months still add up; GST accounts tie N/A', re.every((c) => /^gst/.test(c.id) && c.params.reporting_basis === 'Cash') && re.filter((c) => c.id === 'gst_month').length === 3 && /✓ Each tax type: the 3 monthly/.test(banner(t)) && /– Net GST = the GST accounts’ movement \(accrual\) — N\/A on the cash basis/.test(banner(t)) && !/✗/.test(banner(t)), banner(t).slice(0, 600));
  ok('cash basis: totals are the cash tax code summary', new RegExp(fmt(r2(code(QC, 'GST').SalesTotal - code(QC, 'GST').TaxCollected))).test(body(t)));
  // presets: this financial year → 12 months
  const p = t.doc.getElementById('mk-preset'); ok('presets: this/last month, this/last quarter, this/last financial year, custom', [...p.options].map((o) => o.value).join() === 'this_month,last_month,this_quarter,last_quarter,this_fy,last_fy,custom');
  const f = await go(ID, null, W, { from_date: '2025-07-01', to_date: '2026-06-30', display: '{"cents":1,"style":"mysmb","p":"last_fy","v":"gst"}' });
  ok('a financial year: 12 month columns, the months add up to the year', f.doc.querySelectorAll('#mk-body table')[0].querySelectorAll('thead th').length === 15 && /✓ Each tax type: the 12 monthly/.test(banner(f)) && green(f), banner(f).slice(0, 400));
  // tampering and failures
  const tm = await go(ID, { gst_month: (q) => { const r = L.taxCodeSummary(q); if (q.from_date === '2026-05-01') code(r.TaxCodeBreakdown, 'GST').TaxCollected += 5; return r; } }, W);
  ok('a month $5 off the period → the months-add-up check fails and names the code, red', /✗ Each tax type: the 3 monthly.*GST GST collected/.test(banner(tm)) && red(tm), banner(tm).slice(0, 500));
  const tr = await go(ID, { gst: (q) => { const r = L.taxCodeSummary(q); code(r.TaxCodeBreakdown, 'GST').TaxPaid += 30; return r; } }, W);
  ok('period GST paid $30 off → months, rate and GST accounts checks fail', /✗ Each tax type/.test(banner(tr)) && /✗ Each tax code’s GST = its rate/.test(banner(tr)) && /✗ Net GST/.test(banner(tr)) && red(tr), banner(tr).slice(0, 600));
  const tj = await go(ID, { journals: (q) => { const r = L.listJournalTransactions(q), acc = L.listAccounts(q).Items, a = (id) => { const x = acc.find((y) => y.DisplayID === id); return { UID: x.UID, Name: x.Name, DisplayID: id }; };
    r.Items.push({ UID: 'x', DisplayID: 'GJ999999', JournalType: 'General', SourceTransaction: { TransactionType: 'GeneralJournal' }, DateOccurred: '2026-05-15T00:00:00', Description: 'GST correction', Lines: [{ Account: a('2-1310'), Amount: 12, IsCredit: true }, { Account: a('6-1100'), Amount: 12, IsCredit: false }] }); return r; } }, W);
  ok('a general journal on GST Collected → the GST accounts check fails and names the journal as the likely cause', /✗ Net GST.*differs by \(\$12\.00\): 1 general journal/.test(banner(tj)) && /GST correction/.test(text(tj.doc, '#cra-rec')) && red(tj), banner(tj).slice(0, 600));
  let n429 = 0; const tl = await go(ID, { gst_month: (q) => { if (q.from_date === '2026-06-01' && !n429++) throw new Error('MYOB HTTP 429 Too Many Requests'); return L.taxCodeSummary(q); } }, { wait: 1200 });
  ok('a month call rate-limited (429) once is retried and the report is green', n429 === 2 && green(tl), { n429, b: banner(tl).slice(0, 300) });
  const te = await go(ID, { gst_month: (q) => { if (q.from_date === '2026-06-01') return { __error: 'MYOB 500' }; return L.taxCodeSummary(q); } }, W);
  ok('a month that fails is a failed check, never a silent gap', /✗ Monthly tax code summaries loaded — 2026-06: MYOB 500/.test(banner(te)) && red(te) && /N\/A/.test(body(te)), banner(te).slice(0, 300));
  const sn = await go(ID, null, { mode: 'snapshot', wait: 200 });
  ok('snapshot: the period column and month 1 only, said plainly; the months check is N/A, not failed', /Snapshot: the monthly columns are fetched after opening/.test(body(sn)) && /– Each tax type: the months add up/.test(banner(sn)) && !/✗/.test(banner(sn)) && sn.calls.filter((c) => c.requery).length === 0, banner(sn).slice(0, 400));
  t.doc.getElementById('mk-xlsx').click(); await wait(40); const xs = await xlsxText(t);
  ok('Excel: By month, Period by tax code; header block with period, basis and currency', xs.includes('By month') && xs.includes('Period by tax code') && xs.includes('Basis: Cash') && xs.includes('Currency: AUD'));
  await common(ID, ok);
  await conformance(ID, ok);
  done();
})();

// CRA-01 Financial Overview (Xero) against the Xero kit's ledger: figures = the books, every check green, each source tampered
// in turn fails the right check, failures / 429 / paging, controls (period, basis, snapshot, branding, dark), Excel, LIB-002.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, E, run, text, wait, banner, body, green, red, fmt, set, tamper, cellOf } = X;
const ID = 'financial-overview', REF = 'xero/' + ID, m = X.man(ID), FX = (o) => X.fixtures(m, o);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const FROM = '2026-07-01', TO = '2026-09-25', pl = E.plByAccount(FROM, TO, false), rev = L.r2(pl['200'] + pl['260']), np = E.netProfit(FROM, TO, false);
  const t = await run(REF, m, FX()); await wait(200);
  ok('opens on this financial year to date (1 Jul – 25 Sep 2026), accrual, mySMB branding, Xero named in the header', /Xero · Financial Overview/.test(text(t.doc, '#xk-head')) && /For the period 1 July 2026 to 25 September 2026 · Accrual basis/.test(text(t.doc, '#xk-head')) && /data from Xero/.test(text(t.doc, '#xk-head')) && t.doc.documentElement.classList.contains('style-mysmb'), text(t.doc, '#xk-head'));
  ok('KPIs: revenue and net profit = the books', new RegExp('Revenue' + fmt(rev)).test(body(t)) && new RegExp('Net profit' + fmt(np)).test(body(t)), [rev, np, body(t).slice(0, 300)]);
  const plLy = E.plByAccount('2025-07-01', '2025-09-25', false), revLy = L.r2(plLy['200'] + plLy['260']);
  ok('last year = the same dates a year earlier (separate P&L), shown with the change', new RegExp('Last year: ' + fmt(revLy) + ' · change ' + fmt(L.r2(rev - revLy))).test(body(t)) && t.calls.some((c) => c.id === 'pnl_ly' && c.params.fromDate === '2025-07-01' && c.params.toDate === '2025-09-25'), body(t).slice(0, 300));
  ok('every check passes, green (9/9)', green(t) && /9\/9 checks passed/.test(banner(t)) && t.errs.length === 0, banner(t).slice(0, 600));
  const bank = L.r2(E.bankBalance('090', TO) + E.bankBalance('091', TO)), b = E.balances(TO);
  ok('bank balances = the books at the period end', new RegExp('Total' + fmt(bank)).test(text(t.doc, '#fo-bank')), text(t.doc, '#fo-bank'));
  ok('ageing totals = Accounts Receivable / Payable in the books today; 90+ bucket', new RegExp('Receivables.*' + fmt(b['610'])).test(text(t.doc, '#fo-age')) && new RegExp('Payables.*' + fmt(b['800'])).test(text(t.doc, '#fo-age')) && /90\+ days/.test(text(t.doc, '#fo-age')), text(t.doc, '#fo-age'));
  ok('monthly trend: one P&L per month of the period (Jul, Aug, Sep 1–25), Σ ties', t.calls.filter((c) => c.requery && c.id === 'pnl').map((c) => c.params.fromDate + '..' + c.params.toDate).join(',') === '2026-07-01..2026-07-31,2026-08-01..2026-08-31,2026-09-01..2026-09-25' && /✓ Σ monthly revenue and net profit/.test(banner(t)) && t.doc.querySelectorAll('#fo-trend rect').length === 6);
  ok('top 5 customers and suppliers listed', t.doc.querySelectorAll('#fo-tar tbody tr').length === 5 && t.doc.querySelectorAll('#fo-tap tbody tr').length >= 1);
  // tampering
  const tp = await run(REF, m, FX({ pnl: tamper(L.pnl, (rows, r, q) => { if (q.fromDate === FROM && q.toDate === TO) cellOf(rows, 'Net Profit')[1].Value = '1.00'; }) })); await wait(200);
  ok('tampered Net Profit on the P&L → the P&L ties fail, red', /✗ Profit and Loss: section totals/.test(banner(tp)) && red(tp), banner(tp).slice(0, 300));
  const tl = await run(REF, m, FX({ pnl_ly: tamper(L.pnl, (rows, r) => { r.Reports[0].ReportTitles[2] = '1 July 2025 to 30 September 2025'; }) })); await wait(200);
  ok('last-year P&L for other dates → the last-year check fails', /✗ Last year = a Profit and Loss for exactly 2025-07-01 to 2025-09-25/.test(banner(tl)), banner(tl).slice(0, 300));
  const ta = await run(REF, m, FX({ tb_now: tamper(L.trialBalance, (rows) => { const c = cellOf(rows, 'Accounts Receivable'); c[3].Value = (+c[3].Value + 10).toFixed(2); }) })); await wait(200);
  ok('Accounts Receivable on the Trial Balance $10 out → the receivables ageing check fails', /✗ Receivables ageing total = Accounts Receivable/.test(banner(ta)) && /✓ Payables ageing/.test(banner(ta)), banner(ta).slice(0, 600));
  const tb = await run(REF, m, FX({ bank: tamper(L.bankSummary, (rows) => { rows[1].Rows[0].Cells[4].Value = '1.00'; }) })); await wait(200);
  ok('a bank balance that differs → the bank check fails', /✗ Bank balances/.test(banner(tb)), banner(tb).slice(0, 300));
  const tn = await run(REF, m, FX({ tb: tamper(L.trialBalance, (rows) => { const c = rows.find((x) => x.Title === 'Revenue').Rows[0].Cells; c[4].Value = (+c[4].Value + 5).toFixed(2); }) })); await wait(200);
  ok('Trial Balance revenue changed → net profit vs the Trial Balance fails', /✗ Net profit = income − expenses for the financial year/.test(banner(tn)), banner(tn).slice(0, 400));
  // failures, 429, paging
  const f1 = await run(REF, m, FX(), { fail: { pnl_ly: { code: 'tool_error', message: 'Xero API 500' } } }); await wait(200);
  ok('last-year P&L failed → red, "Last year: N/A" with the reason, figures never invented', red(f1) && /Last year: N\/A — Xero returned an error/.test(body(f1)), body(f1).slice(0, 300));
  const f2 = await run(REF, m, FX(), { fail: { pnl: { code: 'needs_connection', message: 'Connect Xero' } } }); await wait(100);
  ok('not connected → says Connect Xero, red, no $0 figures', red(f2) && /Connect Xero/.test(body(f2)) && !/\$0\.00/.test(body(f2)), body(f2).slice(0, 200));
  const f3 = await run(REF, m, FX({ tb: X.busy(L.trialBalance, 1), invoices: X.busy(L.listInvoices, 1) }), { htmlPatch: X.retryFast }); await wait(300);
  ok('HTTP 429 on open → retried one at a time, ends green', green(f3) && f3.calls.some((c) => c.requery && c.id === 'tb'), banner(f3).slice(0, 300));
  const many = (q) => { const r = L.listInvoices(Object.assign({}, q, { page: 1 })), base = r.Invoices.find((x) => x.Type === 'ACCREC'), all = []; for (let i = 0; i < 130; i++) all.push(Object.assign({}, base, { InvoiceID: 'm-' + i, AmountDue: 10, Total: 10 })); r.Invoices = all.slice(((q.page || 1) - 1) * 100, (q.page || 1) * 100); return r; };
  const pg = await run(REF, m, FX({ invoices: many })); await wait(200);
  ok('130 open invoices → page 2 loaded, all counted', pg.calls.some((c) => c.id === 'invoices' && c.params.page === 2) && /130 invoice\(s\)/.test(banner(pg)), banner(pg).slice(-300));
  const en = await run(REF, m, FX({ invoices: X.endless(L.listInvoices, 'Invoices') })); await wait(300);
  ok('endless list → stops at 20 pages and fails "All open documents loaded"', en.calls.filter((c) => c.id === 'invoices').length === 20 && /✗ All open documents loaded — May be truncated/.test(banner(en)), banner(en).slice(-300));
  // controls
  const before = t.calls.length;
  t.doc.querySelector('input[name="xk-basis"][value="Cash"]').checked = true; t.doc.querySelector('input[name="xk-basis"][value="Cash"]').dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(300);
  const npc = E.netProfit(FROM, TO, true);
  ok('cash basis → figures from the cash P&L, trend from cash P&Ls, header says Cash, still green', new RegExp('Net profit' + fmt(npc)).test(body(t)) && /Cash basis/.test(text(t.doc, '#xk-head')) && t.calls.slice(before).some((c) => c.id === 'pnl_cash' && c.requery) && green(t), [npc, banner(t).slice(0, 400)]);
  await set(t, 'xk-preset', 'last_fy'); await wait(300);
  ok('Last financial year → refetches the period, last year (Jul 2024–Jun 2025) and the 12 months; still green', t.calls.some((c) => c.id === 'pnl_ly_cash' && c.params.fromDate === '2024-07-01' && c.params.toDate === '2025-06-30') && /For the year ended 30 June 2026/.test(text(t.doc, '#xk-head')) && green(t), banner(t).slice(0, 500));
  await set(t, 'xk-branding', 'xero');
  ok('Customise → Xero branding (display only, no refetch)', !t.doc.documentElement.classList.contains('style-mysmb') && /Prepared from Xero/.test(text(t.doc, '#xk-head')));
  const xs = await X.xlsxOf(t);
  ok('Excel: one sheet per table (overview, trend, bank, ageing) + validation + parameters', ['Financial overview', 'Monthly trend', 'Bank balances', 'Ageing', 'Validation', 'Parameters'].every((s) => xs.includes('name="' + s + '"')), xs.slice(0, 200));
  t.doc.getElementById('xk-pdf').click(); ok('Download PDF prints', t.downloads.some((d) => d.print));
  const s = await run(REF, m, FX(), { mode: 'snapshot', bundle: require('../harness.js').hydrate(m, FX(), {}, [], null, '2026-09-25') }); await wait(100);
  ok('snapshot: controls disabled, figures kept, trend says N/A in a snapshot', s.doc.getElementById('xk-preset').disabled && /N\/A in a snapshot/.test(body(s)) && new RegExp('Net profit' + fmt(np)).test(body(s)) && s.errs.length === 0);
  const d = await run(REF, m, FX(), { theme: 'dark' }); await wait(200);
  ok('dark theme renders, green, no errors', d.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && green(d) && d.errs.length === 0);
  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

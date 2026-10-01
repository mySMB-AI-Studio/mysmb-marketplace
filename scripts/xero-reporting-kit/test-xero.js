// Targeted tests for the Xero kit reports (jsdom + mock SDK that resolves bindings like the host). Fixtures: fixtures.js.
const { run, hydrate } = require('./harness.js'); const F = require('./fixtures.js'); const fs = require('fs'), path = require('path');
const DIR = process.env.KIT_DIR || __dirname;
const man = (n) => JSON.parse(fs.readFileSync(path.join(DIR, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PL = () => ({ pnl: F.pnl, pnl_cash: F.pnl, pnl_compare: F.pnl, pnl_compare_cash: F.pnl, bs_end: F.bs, org: F.organisation, connections: F.connections });
const BSX = () => ({ bs: F.bs, bs_cash: F.bs, bs_compare: F.bs, bs_compare_cash: F.bs, pnl_ytd: F.pnl, org: F.organisation, connections: F.connections });
const banner = (t) => text(t.doc, '#xk-banner'), body = (t) => text(t.doc, '#xk-body');
const green = (t) => t.doc.querySelector('#xk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#xk-banner').className.includes('fail');
// edit a Xero report response: fn(rows) mutates Reports[0].Rows
const tamper = (base, fn) => (q) => { const r = base(q); fn(r.Reports[0].Rows); return r; };
const cellOf = (rows, label) => { for (const r of rows) { for (const k of r.Rows || [r]) if (k.Cells && k.Cells[0].Value === label) return k.Cells; } return null; };
// fail the first `n` calls of a binding with Xero's 429 (concurrency limit), then answer normally
const busy = (fn, n) => { let left = n; return (q) => { if (left-- > 0) throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss 429: {"Title":"Too Many Requests"}'); return fn(q); }; };
const retryFast = (h) => h.replace("XK.app({\n  title:", "XK.app({\n  retryMs: 1, title:");

(async () => {
  // ---------------- Profit and Loss ----------------
  const p = await run('pnl', man('pnl'), PL());
  const pb = body(p), pn = banner(p);
  ok('pnl: figures match the fixture', /Total Income\s*\$60,650\.00/.test(pb) && /Total Cost of Sales\s*\$19,450\.50/.test(pb) && /Gross Profit\s*\$41,199\.50/.test(pb) && /Total Other Income\s*\$212\.35/.test(pb) && /Total Operating Expenses\s*\$30,324\.35/.test(pb) && /Net Profit\s*\$11,087\.50/.test(pb), pb.slice(0, 400));
  const order = ['Income', 'Total Income', 'Cost of Sales', 'Total Cost of Sales', 'Gross Profit', 'Other Income', 'Total Other Income', 'Operating Expenses', 'Total Operating Expenses', 'Net Profit'];
  const stmt = text(p.doc, '.xk-stmt'); let at = -1;
  ok('pnl: Xero order and wording ("Less" prefixes dropped, no "Total for")', order.every((s) => { const i = stmt.indexOf(s, at + 1); if (i < 0) return false; at = i; return true; }) && !/Less (Cost|Operating)/.test(stmt) && !stmt.includes('Total for'), stmt.slice(0, 500));
  ok('pnl: zero rows hidden by default (Office Expenses 0.00)', !stmt.includes('Office Expenses'), stmt.slice(0, 300));
  ok('pnl: 4/4 checks pass, banner green, no script errors', green(p) && /4\/4 checks passed/.test(pn) && p.errs.length === 0, pn.slice(0, 500));
  ok('pnl: Net Profit = Current Year Earnings (independent tie) passes', /✓ Net Profit = Current Year Earnings on the Balance Sheet at 2026-09-25 — \$11,087\.50 vs \$11,087\.50/.test(pn), pn);
  ok('pnl: header = organisation / title / Xero period wording / Xero badge', /^Northwind Trading Pty Ltd\s*Profit and Loss\s*For the period 1 July 2026 to 25 September 2026\s*Xero\s*Prepared from Xero$/.test(text(p.doc, '#xk-head')), text(p.doc, '#xk-head'));
  ok('pnl: financial year from the Xero organisation (not assumed)', /Financial year starts July \(Xero organisation settings — year ends 30 June\)/.test(pn) && !/assumed/.test(pn), pn.slice(0, 300));
  ok('pnl: footer = basis + currency footnote', /^Accrual basis · AUD \| /.test(text(p.doc, '#xk-foot')), text(p.doc, '#xk-foot'));
  ok('pnl: column title is the period', /<th class="num" scope="col">1 Jul 2026–25 Sep 2026<\/th>/.test(p.doc.querySelector('.xk-stmt').outerHTML));
  ok('pnl: every Xero read binding sends xero_tenant_id', p.calls.filter((x) => x.id !== 'connections').every((x) => 'xero_tenant_id' in x.params), p.calls.map((x) => x.id + ':' + Object.keys(x.params)));
  ok('pnl: standard layout on every report call; cash bindings use paymentsOnly', p.calls.filter((x) => /^pnl|^bs/.test(x.id)).every((x) => x.params.standardLayout === true && x.params.paymentsOnly === /_cash$/.test(x.id)), p.calls.map((x) => x.id + ':' + x.params.paymentsOnly));
  ok('pnl: date inputs filled', p.doc.getElementById('xk-from').value === '2026-07-01' && p.doc.getElementById('xk-to').value === '2026-09-25');
  // cash basis: display switch between two loaded bindings — no refetch
  const pc0 = p.calls.length;
  p.doc.querySelector('input[name="xk-basis"][value="Cash"]').click(); p.doc.querySelector('input[name="xk-basis"][value="Cash"]').dispatchEvent(new p.w.Event('change')); await p.settle();
  ok('pnl: Cash basis shows the paymentsOnly figures without refetching', /Net Profit\s*\$8,237\.50/.test(body(p)) && /Sales\s*\$44,100\.00/.test(body(p)) && p.calls.length === pc0 && /^Cash basis · AUD/.test(text(p.doc, '#xk-foot')), body(p).slice(0, 300) + ' calls+' + (p.calls.length - pc0));
  ok('pnl: Cash basis → Balance Sheet tie is information (checked on accrual)', /Net Profit vs Balance Sheet Current Year Earnings \(information\) — The tie is checked on the accrual basis/.test(banner(p)) && green(p), banner(p));
  // errors
  const pe = await run('pnl', man('pnl'), Object.assign(PL(), { pnl: F.fail('Xero API GET …/Reports/ProfitAndLoss 401: {"Title":"Unauthorized"}') }));
  ok('pnl: a failed P&L call is an error, never $0 with a tick', /401/.test(body(pe)) && red(pe) && !/Net Profit\s*\$0/.test(body(pe)), banner(pe).slice(0, 300));
  const pbe = await run('pnl', man('pnl'), Object.assign(PL(), { bs_end: F.fail('boom') }));
  ok('pnl: failed Balance Sheet → tie N/A and banner red (never Pass)', !/✓ Net Profit = Current Year Earnings/.test(banner(pbe)) && red(pbe) && /Data loaded: get_balance_sheet/.test(banner(pbe)), banner(pbe).slice(0, 500));
  const pf = await run('pnl', man('pnl'), Object.assign(PL(), { bs_end: tamper(F.bs, (rows) => { cellOf(rows, 'Current Year Earnings')[1].Value = '9000.00'; }) }));
  ok('pnl: Net Profit ≠ Current Year Earnings → Fail', /✗ Net Profit = Current Year Earnings .* \$11,087\.50 vs \$9,000\.00/.test(banner(pf)) && red(pf), banner(pf).slice(0, 500));
  const pt = await run('pnl', man('pnl'), Object.assign(PL(), { pnl: tamper(F.pnl, (rows) => { cellOf(rows, 'Total Operating Expenses')[1].Value = '30000.00'; }) }));
  ok('pnl: Xero section total ≠ Σ rows → section check fails', /✗ Every section total = Σ its account rows — Mismatch: Total Operating Expenses/.test(banner(pt)), banner(pt).slice(0, 500));
  const pnp = await run('pnl', man('pnl'), Object.assign(PL(), { pnl: tamper(F.pnl, (rows) => { cellOf(rows, 'Net Profit')[1].Value = '11000.00'; }) }));
  ok('pnl: Net Profit ≠ GP + OI − OpEx → Fail', /✗ Net Profit = Gross Profit \+ Other Income − Operating Expenses/.test(banner(pnp)) && /✓ Gross Profit = Trading Income − Cost of Sales/.test(banner(pnp)), banner(pnp).slice(0, 500));
  // custom range → tie is information (back on accrual)
  { const a = p.doc.querySelector('input[name="xk-basis"][value="Accrual"]'); a.checked = true; a.dispatchEvent(new p.w.Event('change')); await p.settle(); }
  await set(p, 'xk-from', '2026-08-01');
  ok('pnl: custom range → requery, period line and tie information', p.calls.some((x) => x.requery && x.id === 'pnl' && x.params.fromDate === '2026-08-01') && /Ties only for a financial-year-to-date range \(from 2026-07-01\)/.test(banner(p)) && /For the period 1 August 2026 to 25 September 2026/.test(text(p.doc, '#xk-head')), banner(p).slice(0, 400));
  await set(p, 'xk-preset', 'last_month');
  ok('pnl: Last month → "For the month ended 31 August 2026"', /For the month ended 31 August 2026/.test(text(p.doc, '#xk-head')) && p.doc.getElementById('xk-from').value === '2026-08-01', text(p.doc, '#xk-head'));
  await set(p, 'xk-preset', 'last_fy');
  ok('pnl: Last financial year → "For the year ended 30 June 2026"', /For the year ended 30 June 2026/.test(text(p.doc, '#xk-head')), text(p.doc, '#xk-head'));
  // compare
  const pc = await run('pnl', man('pnl'), Object.assign(PL(), { pnl_compare: tamper(F.pnl, (rows) => { rows.find((r) => r.Title === 'Less Operating Expenses').Rows.unshift({ RowType: 'Row', Cells: [{ Value: 'Legal Fees', Attributes: [{ Id: 'account', Value: 'legal-1' }] }, { Value: '0.00', Attributes: [{ Id: 'account', Value: 'legal-1' }] }] }); cellOf(rows, 'Legal Fees')[1].Value = '0.00'; }) }));
  await set(pc, 'xk-cmp', 'prev_year');
  ok('pnl: compare to previous year → 2025-07-01..2025-09-25 and comparison columns', pc.calls.some((x) => x.id === 'pnl_compare' && x.params.fromDate === '2025-07-01' && x.params.toDate === '2025-09-25') && /Previous year/.test(body(pc)) && /% Change/.test(body(pc)) && /✓ Comparison period loaded/.test(banner(pc)), pc.calls.filter((x) => x.id === 'pnl_compare').map((x) => x.params.fromDate + '..' + x.params.toDate));
  const pcl = [...pc.doc.querySelectorAll('.xk-stmt tr')].find((tr) => tr.textContent.startsWith('Total Income'));
  ok('pnl: comparison values line up (Total Income vs last year)', pcl && /\$60,650\.00\s*\$51,552.50/.test(pcl.textContent.replace(/\s+/g, ' ')), pcl && pcl.textContent);
  // organisation picker (LIB-002)
  const opts = [...p.doc.querySelectorAll('#xk-client option')].map((o) => o.textContent);
  ok('pnl: organisation picker lists the connection\'s organisations', opts.join('|') === 'Northwind Trading Pty Ltd|Southgate Services Ltd' && p.doc.getElementById('xk-client').value === F.T1, opts);
  const po = await run('pnl', man('pnl'), PL());
  await set(po, 'xk-client', F.T2); await wait(30);
  const rq = po.calls.filter((x) => x.requery);
  ok('pnl: choosing an organisation refetches every org binding with its tenantId', ['pnl', 'pnl_cash', 'bs_end', 'org'].every((id) => rq.some((x) => x.id === id && x.params.xero_tenant_id === F.T2)) && !rq.some((x) => x.id === 'connections'), rq.map((x) => x.id + ':' + x.params.xero_tenant_id));
  ok('pnl: new organisation → its name, NZD, and FY-to-date re-rolled to 1 April', /^Southgate Services Ltd/.test(text(po.doc, '#xk-head')) && /Accrual basis · NZD/.test(text(po.doc, '#xk-foot')) && po.doc.getElementById('xk-from').value === '2026-04-01' && rq.some((x) => x.id === 'pnl' && x.params.fromDate === '2026-04-01' && x.params.xero_tenant_id === F.T2), [text(po.doc, '#xk-head'), po.doc.getElementById('xk-from').value]);
  ok('pnl: new organisation still validates (tie on its own FY)', green(po) && /✓ Net Profit = Current Year Earnings/.test(banner(po)) && /year ends 31 March/.test(banner(po)), banner(po).slice(0, 500));
  ok('pnl: the saved inputs carry the organisation', po.setInputsLog.length && po.setInputsLog[po.setInputsLog.length - 1].org === F.T2);
  const p1 = await run('pnl', man('pnl'), Object.assign(PL(), { connections: F.connectionsOne }));
  ok('pnl: one organisation → its name shown, no picker choice', p1.doc.querySelectorAll('#xk-client option').length === 1 && text(p1.doc, '#xk-client') === 'Northwind Trading Pty Ltd');
  const pno = await run('pnl', man('pnl'), Object.assign(PL(), { org: F.fail('Xero API GET …/Organisation 500: oops') }));
  ok('pnl: get_organisation fails → name from list_connections, FY assumed and said so, banner red', /^Northwind Trading Pty Ltd/.test(text(pno.doc, '#xk-head')) && /Financial year starts July \(assumed — AU default/.test(banner(pno)) && red(pno) && /Data loaded: get_organisation/.test(banner(pno)), banner(pno).slice(0, 500));
  // Xero concurrency limit (5 calls in progress): 429s are retried one at a time
  const pr = await run('pnl', man('pnl'), Object.assign(PL(), { pnl_compare: busy(F.pnl, 1), pnl_compare_cash: busy(F.pnl, 1), bs_end: busy(F.bs, 2) }), { htmlPatch: retryFast });
  await wait(150);
  ok('pnl: HTTP 429 on open → retried sequentially, report ends green', green(pr) && /4\/4 checks passed/.test(banner(pr)) && ['pnl_compare', 'pnl_compare_cash', 'bs_end'].every((id) => pr.calls.some((x) => x.requery && x.id === id)) && pr.calls.filter((x) => x.requery && x.id === 'bs_end').length === 2 && !pr.calls.some((x) => x.requery && x.id === 'pnl'), banner(pr).slice(0, 300) + ' | ' + pr.calls.filter((x) => x.requery).map((x) => x.id));
  const pr2 = await run('pnl', man('pnl'), Object.assign(PL(), { bs_end: busy(F.bs, 99) }), { htmlPatch: retryFast });
  await wait(150);
  ok('pnl: persistent 429 → stops after 3 retries and shows the failure', pr2.calls.filter((x) => x.requery && x.id === 'bs_end').length === 3 && red(pr2) && /429/.test(banner(pr2)), pr2.calls.filter((x) => x.requery).map((x) => x.id));
  // snapshot: period from Xero's report title, refetching controls disabled
  const snapIn = { from_date: '2026-08-01', to_date: '2026-08-31' };
  const ps = await run('pnl', man('pnl'), PL(), { mode: 'snapshot', bundle: hydrate(man('pnl'), PL(), snapIn, []) });
  ok('pnl snapshot: period read from the Xero report title, controls disabled', ps.doc.getElementById('xk-from').value === '2026-08-01' && ps.doc.getElementById('xk-to').value === '2026-08-31' && ps.doc.getElementById('xk-from').disabled && /For the month ended 31 August 2026/.test(text(ps.doc, '#xk-head')), [ps.doc.getElementById('xk-from').value, ps.doc.getElementById('xk-to').value]);
  // views & personas
  await set(p, 'xk-view', 'pct');
  ok('pnl: % of trading income view', /% of Trading Income/.test(body(p)) && /Profit and Loss as % of trading income/.test(text(p.doc, '#xk-head')));
  const pd = await run('pnl', man('pnl'), PL(), { theme: 'dark' });
  ok('pnl: dark theme renders without errors', pd.errs.length === 0 && green(pd));
  // Excel
  const px = await run('pnl', man('pnl'), PL()); px.doc.getElementById('xk-xlsx').click(); await px.settle();
  ok('pnl: Download Excel produces an .xlsx named after the organisation', px.downloads.some((d) => d.name && /^Northwind Trading Pty Ltd - Profit and Loss - 2026-07-01 to 2026-09-25\.xlsx$/.test(d.name)), px.downloads);

  // ---------------- Balance Sheet ----------------
  const s = await run('bs', man('bs'), BSX());
  const sb = body(s), sn = banner(s), st = text(s.doc, '.xk-stmt');
  ok('bs: totals match the fixture (column 0 only — Xero\'s comparative column ignored)', /Total Bank\s*\$39,380\.40/.test(sb) && /Total Assets\s*\$66,046\.00/.test(sb) && /Total Liabilities\s*\$24,845\.50/.test(sb) && /Net Assets\s*\$41,200\.50/.test(sb) && /Total Equity\s*\$41,200\.50/.test(sb) && !/\$56,139\.10/.test(sb), sb.slice(0, 400));
  const bo = ['Assets', 'Bank', 'Total Bank', 'Current Assets', 'Total Current Assets', 'Fixed Assets', 'Total Fixed Assets', 'Total Assets', 'Liabilities', 'Current Liabilities', 'Total Current Liabilities', 'Non-Current Liabilities', 'Total Non-Current Liabilities', 'Total Liabilities', 'Net Assets', 'Equity', 'Current Year Earnings', 'Retained Earnings', 'Total Equity'];
  at = -1;
  ok('bs: Xero layout and order (Assets → Bank … Net Assets → Equity)', bo.every((x) => { const i = st.indexOf(x, at + 1); if (i < 0) return false; at = i; return true; }), st.slice(0, 600));
  const bankRow = [...s.doc.querySelectorAll('.xk-stmt tr')].find((tr) => tr.textContent.startsWith('Bank'));
  ok('bs: sub-sections indented under their group', bankRow && /padding-left:26px/.test(bankRow.innerHTML), bankRow && bankRow.innerHTML.slice(0, 120));
  ok('bs: contra account shown negative in brackets and red', /Less Accumulated Depreciation on Office Equipment\s*\(\$1,680\.00\)/.test(sb) && !!s.doc.querySelector('.xk-stmt td.neg'), sb.slice(0, 600));
  ok('bs: 6/6 checks pass (A = L + E stated explicitly, Total Bank, CYE tie)', green(s) && /6\/6 checks passed/.test(sn) && /✓ Total Assets = Total Liabilities \+ Total Equity — \$66,046\.00 = \$24,845\.50 \+ \$41,200\.50/.test(sn) && /✓ Total Bank = Σ bank account rows — \$39,380\.40 — 2 accounts/.test(sn) && /✓ Current Year Earnings = P&L Net Profit 2026-07-01 to 2026-09-25 — \$11,087\.50 vs \$11,087\.50/.test(sn) && s.errs.length === 0, sn);
  ok('bs: header As at wording', /^Northwind Trading Pty Ltd\s*Balance Sheet\s*As at 25 September 2026/.test(text(s.doc, '#xk-head')), text(s.doc, '#xk-head'));
  ok('bs: fy_start sent to the P&L from the organisation\'s year', s.calls.some((x) => x.id === 'pnl_ytd' && x.params.fromDate === '2026-07-01' && x.params.toDate === '2026-09-25'), s.calls.filter((x) => x.id === 'pnl_ytd').map((x) => x.params));
  const sf = await run('bs', man('bs'), Object.assign(BSX(), { pnl_ytd: tamper(F.pnl, (rows) => { cellOf(rows, 'Net Profit')[1].Value = '10000.00'; }) }));
  ok('bs: Current Year Earnings ≠ P&L → Fail', /✗ Current Year Earnings = P&L Net Profit/.test(banner(sf)) && red(sf), banner(sf).slice(0, 400));
  const sa = await run('bs', man('bs'), Object.assign(BSX(), { bs: tamper(F.bs, (rows) => { cellOf(rows, 'Total Assets')[1].Value = '66000.00'; }) }));
  ok('bs: A ≠ L + E → Fail with the difference, and the group re-add fails', /✗ Total Assets = Total Liabilities \+ Total Equity — .* difference \(\$46\.00\)/.test(banner(sa)) && /✗ Total Assets and Total Liabilities = Σ their sections — Total Assets 66000 vs Σ sections 66046/.test(banner(sa)), banner(sa).slice(0, 700));
  const sk = await run('bs', man('bs'), Object.assign(BSX(), { bs: tamper(F.bs, (rows) => { cellOf(rows, 'Total Bank')[1].Value = '39000.00'; }) }));
  ok('bs: Total Bank ≠ Σ bank rows → Fail', /✗ Total Bank = Σ bank account rows/.test(banner(sk)), banner(sk).slice(0, 400));
  const sod = await run('bs', man('bs'), Object.assign(BSX(), { bs: tamper(F.bs, (rows) => { const b = rows.find((r) => r.Title === 'Bank'); b.Rows[0].Cells[1].Value = '-620.00'; b.Rows[2].Cells[1].Value = '14380.00'; cellOf(rows, 'Total Assets')[1].Value = '41045.60'; }) }));
  ok('bs: overdrawn bank noted', /Overdrawn bank account\(s\): Business Cheque Account \(\$620\.00\)/.test(text(sod.doc, '#xk-sources')), text(sod.doc, '#xk-sources').slice(0, 400));
  const se = await run('bs', man('bs'), Object.assign(BSX(), { bs: F.fail('Xero API GET …/Reports/BalanceSheet 403: {"Title":"Forbidden"}') }));
  ok('bs: failed call shown as an error, red banner', /403/.test(body(se)) && red(se), banner(se).slice(0, 300));
  await set(s, 'xk-view', 'summary');
  ok('bs: summary view shows totals only', !body(s).includes('Business Cheque Account') && /Total Bank/.test(body(s)) && /Total Assets/.test(body(s)), body(s).slice(0, 300));
  const sc = await run('bs', man('bs'), BSX());
  await set(sc, 'xk-cmp', 'prev_year');
  ok('bs: compare previous year uses 2025-09-25 and shows the column', sc.calls.some((x) => x.id === 'bs_compare' && x.params.date === '2025-09-25') && /Previous year/.test(body(sc)) && /Total Assets\s*\$66,046\.00\s*\$56,139\.10/.test(body(sc)), sc.calls.filter((x) => x.id === 'bs_compare').map((x) => x.params.date));
  const sca = await run('bs', man('bs'), BSX());
  sca.doc.querySelector('input[name="xk-basis"][value="Cash"]').dispatchEvent(new sca.w.Event('change')); sca.doc.querySelector('input[name="xk-basis"][value="Cash"]').checked = true;
  const casIn = sca.doc.querySelector('input[name="xk-basis"][value="Cash"]'); casIn.checked = true; casIn.dispatchEvent(new sca.w.Event('change')); await sca.settle();
  ok('bs: Cash basis → paymentsOnly figures, no receivables, tie information', /Total Assets\s*\$47,300\.40/.test(body(sca)) && !/Accounts Receivable/.test(body(sca)) && /The tie is checked on the accrual basis/.test(banner(sca)) && green(sca) && /receivables and payables are excluded/.test(text(sca.doc, '#xk-sources')), body(sca).slice(0, 300));
  const sn2 = await run('bs', man('bs'), BSX());
  await set(sn2, 'xk-client', F.T2); await wait(30);
  ok('bs: another organisation → its FY start (1 April) derived and sent', sn2.calls.some((x) => x.requery && x.id === 'pnl_ytd' && x.params.fromDate === '2026-04-01' && x.params.xero_tenant_id === F.T2) && green(sn2) && /^Southgate Services Ltd/.test(text(sn2.doc, '#xk-head')), sn2.calls.filter((x) => x.id === 'pnl_ytd').map((x) => x.params.fromDate + ':' + x.params.xero_tenant_id));
  const sr = await run('bs', man('bs'), Object.assign(BSX(), { bs_compare: busy(F.bs, 1), bs_compare_cash: busy(F.bs, 1), pnl_ytd: busy(F.pnl, 1) }), { htmlPatch: retryFast });
  await wait(150);
  ok('bs: HTTP 429 on open → retried, ends green', green(sr) && /6\/6 checks passed/.test(banner(sr)), banner(sr).slice(0, 300));
  const ss = await run('bs', man('bs'), BSX(), { mode: 'snapshot', bundle: hydrate(man('bs'), BSX(), { as_at: '2026-06-30' }, []) });
  ok('bs snapshot: as-at date read from the report title', ss.doc.getElementById('xk-asat').value === '2026-06-30' && /As at 30 June 2026/.test(text(ss.doc, '#xk-head')), ss.doc.getElementById('xk-asat').value);

  // ---------------- Host defaults ≠ config defaults (live finding, Irvine Jackson 29 Sep 2026) ----------------
  // The host hydrates on open with the MANIFEST defaults; the kit starts from cfg.defaults. Here the manifest says 30 Sep.
  const manAt = (n, patch) => { const m = man(n); m.inputs.forEach((i) => { if (patch[i.name]) i.default = patch[i.name]; }); return m; };
  const hb = await run('bs', manAt('bs', { as_at: '2026-09-30' }), BSX());
  const hbq = hb.calls.filter((x) => x.requery);
  ok('dates: BS hydrated at the manifest date (30 Sep) is refetched at the shown date (25 Sep)', hb.calls.some((x) => !x.requery && x.id === 'bs' && x.params.date === '2026-09-30') && ['bs', 'bs_cash', 'pnl_ytd'].every((id) => hbq.some((x) => x.id === id && (x.params.date || x.params.toDate) === '2026-09-25')) && !hbq.some((x) => x.id === 'connections' || x.id === 'org'), hbq.map((x) => x.id + ':' + (x.params.date || x.params.toDate)));
  ok('dates: after the refetch the figures, Xero title and controls agree (green)', green(hb) && /As at 25 September 2026/.test(text(hb.doc, '#xk-head')) && /<th class="num" scope="col">25 Sep 2026<\/th>/.test(hb.doc.querySelector('.xk-stmt').outerHTML) && !/Xero report dates/.test(banner(hb)), banner(hb).slice(0, 300));
  const hp = await run('pnl', manAt('pnl', { to_date: '2026-09-30' }), PL());
  ok('dates: P&L hydrated to 30 Sep is refetched to 25 Sep, Net Profit = CYE at 25 Sep', hp.calls.some((x) => x.requery && x.id === 'pnl' && x.params.toDate === '2026-09-25') && hp.calls.some((x) => x.requery && x.id === 'bs_end' && x.params.date === '2026-09-25') && /Net Profit\s*\$11,087\.50/.test(body(hp)) && green(hp), banner(hp).slice(0, 300));
  const wrongTitle = (q) => { const r = F.bs(q); r.Reports[0].ReportTitles[2] = 'As at 30 September 2026'; return r; };
  const hw = await run('bs', man('bs'), Object.assign(BSX(), { bs: wrongTitle }));
  ok('dates: Xero still reports other dates → refetched once, then a failing check (never a silent mismatch)', hw.calls.filter((x) => x.requery && x.id === 'bs').length === 1 && red(hw) && /✗ Xero report dates = the selected dates — get_balance_sheet returned "As at 30 September 2026"/.test(banner(hw)), [hw.calls.filter((x) => x.requery).map((x) => x.id), banner(hw).slice(0, 300)]);
  const hn = await run('pnl', man('pnl'), PL());
  ok('dates: matching dates on open → no extra calls', !hn.calls.some((x) => x.requery), hn.calls.filter((x) => x.requery).map((x) => x.id));

  // ---------------- Branding: Xero (default) | mySMB — display only ----------------
  const g = await run('pnl', man('pnl'), PL());
  const root = g.doc.documentElement;
  ok('branding: Xero is the default (badge, source line, no mySMB class)', !root.classList.contains('style-mysmb') && /Xero\s*Prepared from Xero/.test(text(g.doc, '#xk-head')) && g.doc.getElementById('xk-branding').value === 'xero', text(g.doc, '#xk-head'));
  ok('branding: the switch is inside Customise (not the main row)', !!g.doc.querySelector('#xk-controls details.customise #xk-branding') && !g.doc.querySelector('#xk-controls > label.ctl #xk-branding'));
  ok('branding: Xero blue is the default brand colour', g.doc.getElementById('xk-brand').value === '#13b5ea' && /Use Xero branding/.test(text(g.doc, '#xk-controls')));
  const before = g.calls.length;
  await set(g, 'xk-branding', 'mysmb');
  ok('branding: mySMB applies the template (class, badge, source line)', root.classList.contains('style-mysmb') && /mySMB\s*mySMB Reporting · data from Xero/.test(text(g.doc, '#xk-head')), text(g.doc, '#xk-head'));
  ok('branding: switching does not refetch data', g.calls.length === before, g.calls.slice(before).map((x) => x.id));
  ok('branding: mySMB footer = Business | Report | Generated', /^Northwind Trading Pty Ltd \| Profit and Loss \| Accrual basis · AUD \| /.test(text(g.doc, '#xk-foot')), text(g.doc, '#xk-foot'));
  ok('branding: choice kept in the display input', JSON.parse(g.setInputsLog[g.setInputsLog.length - 1].display).style === 'mysmb', g.setInputsLog.slice(-1));
  await set(g, 'xk-branding', 'xero');
  ok('branding: back to Xero', !root.classList.contains('style-mysmb') && /Prepared from Xero/.test(text(g.doc, '#xk-head')) && /^Accrual basis/.test(text(g.doc, '#xk-foot')), text(g.doc, '#xk-foot'));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

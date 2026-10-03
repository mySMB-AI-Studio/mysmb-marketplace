const { run, hydrate } = require('./harness.js');
const F = require('./fixtures.js');
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(__dirname + '/reports/pnl.manifest.json', 'utf8'));
const fx = { pnl: F.pnl, pnl_compare: F.pnl, company_info: () => F.companyInfo, prefs: () => F.prefs };
let fails = 0; const ok = (n, c, info) => { if (!c) { fails++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } else console.log('ok  ', n); };
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
(async () => {
  // 1. live default
  let t = await run('pnl', manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('header company', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd', text(t.doc, '#qb-head'));
  ok('header title', text(t.doc, '#qb-head .ti') === 'Profit and Loss');
  ok('banner passes', t.doc.querySelector('#qb-banner').className.includes('pass'), text(t.doc, '#qb-banner'));
  ok('Total for Income row', text(t.doc, '#qb-body').includes('Total for Income'));
  ok('Net Earnings relabel', text(t.doc, '#qb-body').includes('Net Earnings'));
  ok('money format', /A\$\d{1,3}(,\d{3})*\.\d{2}/.test(text(t.doc, '#qb-body')));
  ok('footer accrual', text(t.doc, '#qb-foot').startsWith('Accrual basis |'), text(t.doc, '#qb-foot'));
  ok('client selector shows company', text(t.doc, '#qb-client') === 'Enterprise AI Pty Ltd');
  ok('sources lists mechanism', text(t.doc, '#qb-sources').includes('quickbooks-accounting connector'));
  ok('fy source CompanyInfo', text(t.doc, '#qb-banner').includes('July (CompanyInfo)'));
  ok('negative COGS note', text(t.doc, '#qb-sources').includes('Cost of Sales is negative'));
  // 2. preset change -> requery with full declared inputs
  const n0 = t.calls.length; const sel = t.doc.getElementById('qb-preset'); sel.value = 'last_month'; sel.dispatchEvent(new t.w.Event('change')); await t.settle();
  const rq = t.calls.slice(n0).filter((c) => c.requery);
  ok('preset requeries pnl only', rq.length === 1 && rq[0].id === 'pnl', rq);
  ok('preset dates', rq[0] && rq[0].params.start_date === '2026-08-01' && rq[0].params.end_date === '2026-08-31', rq[0]);
  ok('period line August 2026', text(t.doc, '#qb-head .pe') === 'August 2026', text(t.doc, '#qb-head .pe'));
  const lastIn = t.setInputsLog[t.setInputsLog.length - 1];
  ok('setInputs carries all 8 inputs', Object.keys(lastIn).length === 8, lastIn);
  ok('display remembers preset', JSON.parse(lastIn.display).p === 'last_month');
  // 3. compare previous year
  const n1 = t.calls.length; const cmp = t.doc.getElementById('qb-cmp'); cmp.value = 'prev_year'; cmp.dispatchEvent(new t.w.Event('change')); await t.settle();
  const rq2 = t.calls.slice(n1);
  ok('compare requeries pnl_compare', rq2.length === 1 && rq2[0].id === 'pnl_compare' && rq2[0].params.start_date === '2025-08-01' && rq2[0].params.end_date === '2025-08-31', rq2);
  ok('compare columns', text(t.doc, '#qb-body thead').includes('Previous year') && text(t.doc, '#qb-body thead').includes('% Change'));
  ok('compare title', text(t.doc, '#qb-head .ti') === 'Profit and Loss Comparison');
  ok('banner still passes', t.doc.querySelector('#qb-banner').className.includes('pass'), text(t.doc, '#qb-banner'));
  // 4. basis cash -> requery both P&L bindings
  const n2 = t.calls.length; const cash = t.doc.querySelector('input[name="qb-basis"][value="Cash"]'); cash.checked = true; cash.dispatchEvent(new t.w.Event('change')); await t.settle();
  const rq3 = t.calls.slice(n2).map((c) => c.id).sort();
  ok('basis requeries pnl + pnl_compare', JSON.stringify(rq3) === '["pnl","pnl_compare"]', rq3);
  ok('footer cash', text(t.doc, '#qb-foot').startsWith('Cash basis'));
  // 5. columns by month -> monthly columns + charts
  const cmpOff = t.doc.getElementById('qb-cmp'); cmpOff.value = 'none'; cmpOff.dispatchEvent(new t.w.Event('change')); await t.settle();
  const cb = t.doc.getElementById('qb-cols'); cb.value = 'Month'; cb.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('month columns', text(t.doc, '#qb-body thead').includes('Aug 2026'), text(t.doc, '#qb-body thead'));
  ok('monthly bars svg', !!t.doc.querySelector('#ch1 svg rect'));
  // 6. % of income view
  const v = t.doc.getElementById('qb-view'); v.value = 'pct'; cb.value = 'Total';
  const cb2 = t.doc.getElementById('qb-cols'); cb2.value = 'Total'; cb2.dispatchEvent(new t.w.Event('change')); await t.settle();
  const v2 = t.doc.getElementById('qb-view'); v2.value = 'pct'; v2.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('% of income column', text(t.doc, '#qb-body thead').includes('% of Income') && /100\.0%/.test(text(t.doc, '#qb-body')));
  // 7. persona + display toggles
  const ps = t.doc.getElementById('qb-persona'); ps.value = 'Client'; ps.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('client persona summary mode', t.doc.body.classList.contains('persona-summary'));
  const st = t.doc.getElementById('qb-style'); st.value = 'mysmb'; st.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('house style toggle', t.doc.documentElement.classList.contains('style-mysmb'));
  const ng = t.doc.getElementById('qb-neg'); ng.value = 'paren'; ng.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('negatives in brackets', /\(A\$[\d,]+\.\d{2}\)/.test(text(t.doc, '#qb-body')));
  // 7b. branding: QuickBooks by default, brand colour on request, house style wins, reset
  const root = t.doc.documentElement, acc = () => root.style.getPropertyValue('--accent');
  ok('default = QuickBooks branding (no override)', acc() === '' && text(t.doc, '#qb-head').includes('Prepared from QuickBooks Online'));
  const st0 = t.doc.getElementById('qb-style'); st0.value = 'qbo'; st0.dispatchEvent(new t.w.Event('change')); await t.settle();
  const br = t.doc.getElementById('qb-brand'); br.value = '#1a4d8f'; br.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('brand colour applied', acc() === '#1a4d8f' && root.classList.contains('brand-custom'), acc());
  ok('brand kept in display input', JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).b === '#1a4d8f');
  const st1 = t.doc.getElementById('qb-style'); st1.value = 'mysmb'; st1.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('house style wins over brand', acc() === '' && root.classList.contains('style-mysmb'));
  const st2 = t.doc.getElementById('qb-style'); st2.value = 'qbo'; st2.dispatchEvent(new t.w.Event('change')); await t.settle();
  t.doc.getElementById('qb-brand-reset').click(); await t.settle();
  ok('reset to QuickBooks branding', acc() === '' && !root.classList.contains('brand-custom'));
  const st3 = t.doc.getElementById('qb-style'); st3.value = 'mysmb'; st3.dispatchEvent(new t.w.Event('change')); await t.settle();
  // 8. downloads
  t.doc.getElementById('qb-pdf').click(); t.doc.getElementById('qb-xlsx').click(); await t.settle();
  ok('print called', t.downloads.some((d) => d.print));
  const blob = t.downloads.find((d) => d.blob), nm = t.downloads.find((d) => d.name);
  ok('xlsx downloaded', !!blob && /Enterprise AI Pty Ltd - Profit and Loss - 2026-08-01 to 2026-08-31\.xlsx/.test(nm && nm.name), nm);
  if (blob) fs.writeFileSync(__dirname + '/out/pnl.xlsx', Buffer.from(await blob.blob.arrayBuffer()));
  ok('no script errors after interaction', t.errs.length === 0, t.errs);
  // 9. snapshot: data captured at Aug 2026 cash basis; page must adopt the data's own period
  const snapBundle = hydrate(manifest, fx, { start_date: '2026-08-01', end_date: '2026-08-31', basis: 'Cash' });
  let s = await run('pnl', manifest, fx, { mode: 'snapshot', bundle: snapBundle });
  ok('snapshot period from data', text(s.doc, '#qb-head .pe') === 'August 2026', text(s.doc, '#qb-head .pe'));
  ok('snapshot basis from data', s.doc.querySelector('input[name="qb-basis"][value="Cash"]').checked);
  ok('snapshot controls disabled', s.doc.getElementById('qb-from').disabled && s.doc.getElementById('qb-preset').disabled);
  ok('snapshot no requery', s.calls.filter((c) => c.requery).length === 0);
  ok('snapshot banner says frozen', text(s.doc, '#qb-banner').includes('Snapshot'));
  // 9b. brand colour set by the agent (display default) — applied on open, lighter shade in dark theme
  const mB = JSON.parse(JSON.stringify(manifest)); const di = mB.inputs.find((i) => i.name === 'display'); const dj = JSON.parse(di.default); dj.b = '#1a4d8f'; di.default = JSON.stringify(dj);
  const patch = (html) => html.replace('"v":"pl"}', '"v":"pl","b":"#1a4d8f"}'); const bl = await run('pnl', mB, fx, { theme: 'light', htmlPatch: patch }), bd = await run('pnl', mB, fx, { theme: 'dark', htmlPatch: patch });
  ok('agent brand applied on open (light)', bl.doc.documentElement.style.getPropertyValue('--accent') === '#1a4d8f', bl.doc.documentElement.style.getPropertyValue('--accent'));
  ok('agent brand lighter in dark theme', /^#[0-9a-f]{6}$/.test(bd.doc.documentElement.style.getPropertyValue('--accent')) && bd.doc.documentElement.style.getPropertyValue('--accent') !== '#1a4d8f');
  // 10. needs_connection
  let e = await run('pnl', manifest, fx, { fail: { pnl: { code: 'needs_connection', message: 'not connected' } } });
  ok('needs_connection message', text(e.doc, '#qb-body').includes('Connect QuickBooks'), text(e.doc, '#qb-body'));
  ok('banner fails', e.doc.querySelector('#qb-banner').className.includes('fail'));
  // 11. company info missing -> N/A
  let na = await run('pnl', manifest, Object.assign({}, fx, { company_info: () => ({ QueryResponse: {} }) }));
  ok('company N/A', text(na.doc, '#qb-head .co') === 'N/A — not in source');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();

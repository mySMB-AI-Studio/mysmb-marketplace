// Library tools: Reports Catalogue (M63, a kit report), the custom reports guide (M62) and the pages built from the user's MYOB
// export (M13 journal security audit, M31 workers compensation) — their pages, generated skills and the agent's skill list.
const { run } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { JSDOM } = require('jsdom');
const K = process.env.KIT_DIR || __dirname, man = (n) => JSON.parse(fs.readFileSync(path.join(K, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rowsText = (doc, sel) => [...doc.querySelectorAll(sel + ' tr')].map((r) => [...r.cells].map((c) => c.textContent.trim()).join(' ')).join(' / ');
const kpi = (doc, label) => { const k = [...doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === label); return k ? text(k, '.val') : null; };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const cards = (doc) => [...doc.querySelectorAll('.ct-card')].filter((c) => !c.hidden && !c.closest('.ct-sec').hidden);
const cardOf = (doc, name) => [...doc.querySelectorAll('.ct-card')].find((c) => text(c, '.ct-name') === name);
const PLUGIN = path.resolve(__dirname, '..', '..', 'plugins', 'myob-reporting-studio'), css = fs.readFileSync(path.join(K, 'mk.css'), 'utf8').trim();
const page = (tpl, data) => fs.readFileSync(path.join(__dirname, 'reports', tpl + '.template.html'), 'utf8').replace('{{CSS}}', () => css).replace('{{DATA}}', () => JSON.stringify(data).replace(/</g, '\\u003c'));
const open = async (html) => { const dom = new JSDOM(html, { runScripts: 'dangerously' }), w = dom.window, errs = []; w.addEventListener('error', (e) => errs.push(e.message)); w.print = () => {}; await wait(20); return { w, doc: w.document, errs, ev: (el, t) => el.dispatchEvent(new w.Event(t)) }; };
(async () => {
  // ---------------- Reports Catalogue (M63)
  const cm = onFile(man('ct')), FX = { company_files: L.companyFiles };
  let t = await run('ct', cm, FX, { bundleInputs: true }); await wait(60);
  ok('catalogue: no errors, header names the company file', t.errs.length === 0 && text(t.doc, 'header .co') === L.FILES[L.CF1].Name && text(t.doc, 'header .ti') === 'Reports Catalogue', [t.errs, text(t.doc, 'header')]);
  ok('catalogue: both checks pass (64 prompt IDs; MYOB tab counts)', t.doc.querySelector('#mk-banner').className.includes('pass') && /2\/2 checks passed/.test(text(t.doc, '#mk-banner')) && /Business 14 · Banking 5 · Payroll 12 · Sales 8 · Purchases 7 · Inventory 6 · Jobs 6/.test(text(t.doc, '#mk-banner')), text(t.doc, '#mk-banner'));
  // expected counts follow the families: every prompt ID a kit family covers (m + also) is live; the guide and export pages are 3; the rest are on request
  const liveIds = new Set(); require('./families.js').forEach((f) => { f.m.split(/,\s*/).concat(f.also || []).forEach((m) => liveIds.add(m)); });
  const nLive = liveIds.size, nStatic = require('./families-static.js').length;
  ok('catalogue: 64 reports — live templates and on request follow the families, 3 from an export or a guide', kpi(t.doc, 'Reports in the library') === '64' && kpi(t.doc, 'Live templates') === String(nLive) && kpi(t.doc, 'On request') === String(64 - nLive - nStatic) && kpi(t.doc, 'From an export or a guide') === String(nStatic),
    ['Reports in the library', 'Live templates', 'On request', 'From an export or a guide'].map((l) => kpi(t.doc, l)).concat([nLive]));
  ok('catalogue: all 64 cards in 8 groups on the All tab', cards(t.doc).length === 64 && t.doc.querySelectorAll('.ct-sec').length === 8, cards(t.doc).length);
  const st = (n) => text(cardOf(t.doc, n), '.ct-badge') + ' | ' + text(cardOf(t.doc, n), '.ct-ask');
  ok('catalogue: Profit and loss is a live template, asked for by its title', st('Profit and loss') === 'Live template | Ask for “MYOB Profit and Loss”', st('Profit and loss'));
  ok('catalogue: GST return is part of MYOB GST Summary (BAS)', st('GST return') === 'Live template | Part of “MYOB GST Summary (BAS)”', st('GST return'));
  ok('catalogue: Unpaid invoices names both templates', st('Unpaid invoices') === 'Live template | Ask for “MYOB Unpaid Invoices” or “MYOB Aged Receivables”', st('Unpaid invoices'));
  ok('catalogue: Budget management and the Taxable payments annual report are live templates; Workers compensation comes from the export', st('Budget management') === 'Live template | Ask for “MYOB Budget Management”' && st('Taxable payments annual report') === 'Live template | Ask for “MYOB Taxable Payments Annual Report”' && /^From your MYOB export/.test(st('Workers compensation — Estimation of wages')), [st('Budget management'), st('Taxable payments annual report'), st('Workers compensation — Estimation of wages')]);
  ok('catalogue: Journal entries is a live template now', st('Journal entries') === 'Live template | Ask for “MYOB Journal Entries”', st('Journal entries'));
  ok('catalogue: Journal security audit comes from the MYOB export', st('Journal security audit') === 'From your MYOB export | Attach the MYOB export, then ask for “MYOB Journal Security Audit”', st('Journal security audit'));
  ok('catalogue: Custom report is the guide', /^Guide \| Ask to save any report with your settings/.test(st('Custom report (user-defined columns and filters)')), st('Custom report (user-defined columns and filters)'));
  ok('catalogue: the catalogue lists itself as live', /^Live template/.test(st('Reports catalogue and runner (All tab)')));
  let n0 = t.calls.length;
  t.doc.querySelector('.ct-tab[data-tab="Payroll"]').click(); await t.settle();
  ok('catalogue: Payroll tab shows its 12 reports, no refetch, announced', cards(t.doc).length === 12 && t.doc.querySelectorAll('.ct-sec').length === 1 && t.calls.length === n0 && JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).v === 'Payroll', cards(t.doc).length);
  t.doc.querySelector('.ct-tab[data-tab="all"]').click(); await t.settle();
  const q = t.doc.getElementById('ct-q'); q.value = 'unpaid'; q.dispatchEvent(new t.w.Event('input'));
  ok('catalogue: search "unpaid" finds unpaid invoices and bills', cards(t.doc).length >= 2 && cards(t.doc).length < 8 && !!cardOf(t.doc, 'Unpaid bills') && !cardOf(t.doc, 'Unpaid bills').hidden, cards(t.doc).map((c) => text(c, '.ct-name')));
  q.value = 'zzz'; q.dispatchEvent(new t.w.Event('input'));
  ok('catalogue: no match → message', !t.doc.getElementById('ct-none').hidden && cards(t.doc).length === 0);
  q.value = ''; q.dispatchEvent(new t.w.Event('input'));
  cardOf(t.doc, 'Profit and loss').querySelector('.ct-star').click(); await t.settle();
  cardOf(t.doc, 'Balance sheet').querySelector('.ct-star').click(); await t.settle();
  ok('catalogue: starring keeps favourites in the display input', JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).x === 'M04,M02' && kpi(t.doc, 'Favourites') === '2' && cardOf(t.doc, 'Profit and loss').querySelector('.ct-star').getAttribute('aria-pressed') === 'true');
  t.doc.querySelector('.ct-tab[data-tab="fav"]').click(); await t.settle();
  ok('catalogue: ★ Favourites tab lists only the starred reports', cards(t.doc).map((c) => text(c, '.ct-name')).sort().join('|') === 'Balance sheet|Profit and loss', cards(t.doc).map((c) => text(c, '.ct-name')));
  cardOf(t.doc, 'Balance sheet').querySelector('.ct-star').click(); await t.settle();
  ok('catalogue: un-starring removes it', cards(t.doc).length === 1 && JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).x === 'M04');
  t.doc.getElementById('mk-xlsx').click(); await t.settle();
  const xb = t.downloads.filter((d) => d.blob).pop(), xs = xb ? Buffer.from(await xb.blob.arrayBuffer()).toString('utf8') : '';
  ok('catalogue: Excel lists every report with its status and favourite', /Journal entries/.test(xs) && /Live template/.test(xs) && /★/.test(xs) && /Validation/.test(xs), xs.length);
  ok('catalogue: notes say what each status means and how favourites are kept', /On request = the agent writes the report from its specification/.test(text(t.doc, '#mk-sources')) && /To keep favourites, ask the agent to save the catalogue with them/.test(text(t.doc, '#mk-sources')));
  // a saved copy with favourites opens on them
  const disp = JSON.parse(cm.inputs.find((i) => i.name === 'display').default); disp.v = 'fav'; disp.x = 'M32,M40';
  t = await run('ct', onFile(man('ct'), { display: JSON.stringify(disp) }), FX, { bundleInputs: true }); await wait(60);
  ok('catalogue: a copy saved with favourites opens on the ★ Favourites tab', cards(t.doc).map((c) => text(c, '.ct-name')).sort().join('|') === 'Unpaid bills|Unpaid invoices' && t.doc.querySelector('.ct-tab.on').getAttribute('data-tab') === 'fav', cards(t.doc).map((c) => text(c, '.ct-name')));
  t = await run('ct', onFile(man('ct')), FX, { fail: { company_files: { code: 'needs_connection', message: 'x' } } }); await wait(60);
  ok('catalogue: not connected → connect MYOB, the catalogue still lists every report', /Connect MYOB/.test(text(t.doc, 'main')) && cards(t.doc).length === 64 && t.errs.length === 0);

  // ---------------- Journal Security Audit (M13), from the export
  const audit = { company: 'mySMB.com', period: 'Session date: 1 September 2026 - 28 September 2026', lockDate: null, fileName: 'JournalSecurityAudit.xlsx', rows: [
    { actionDate: '2026-09-02 09:10', user: 'Administrator', action: 'Added', type: 'Sale', txnDate: '2026-09-02', memo: 'Sale; Acme Pty Ltd', ref: '00000123', debit: 1100, credit: null },
    { actionDate: '2026-09-05 14:02', user: 'Administrator', action: 'Changed', type: 'Spend money', txnDate: '2026-08-28', memo: 'Electricity <b>Aug</b>', ref: 'CH0045', debit: null, credit: 290.91 },
    { actionDate: '2026-09-07 10:30', user: 'Rica', action: 'Deleted', type: 'Receive money', txnDate: '2026-06-30', memo: 'Deposit </script><script>window.x=1</script>', ref: 'CR0012', debit: 500, credit: null },
    { actionDate: '2026-09-10 08:00', user: 'Rica', action: 'changed', type: 'Sale', txnDate: '2026-09-09', memo: 'Sale; Beta Co', ref: '00000124', debit: 220, credit: null },
    { actionDate: '2026-09-12 16:45', user: 'Bookkeeper', action: 'Added', type: 'General journal', txnDate: '2026-09-12', memo: 'Accrual', ref: 'GJ0007', debit: 75, credit: 75 }] };
  let p = await open(page('journal-audit', audit)); const rowsN = () => p.doc.querySelectorAll('#mk-body tbody tr').length;
  ok('audit: no script errors, injected script not run', p.errs.length === 0 && p.w.x === undefined, p.errs);
  ok('audit: header, 5 rows, 2/2 checks', /mySMB\.com/.test(text(p.doc, '#mk-head')) && rowsN() === 5 && /2\/2 checks passed/.test(text(p.doc, '#mk-banner')), text(p.doc, '#mk-banner'));
  ok('audit: prior-period changes = the edit of an August sale and the deletion of a June deposit', kpi(p.doc, 'Prior-period changes') === '2' && kpi(p.doc, 'Deletions') === '1' && kpi(p.doc, 'Users') === '3', [kpi(p.doc, 'Prior-period changes'), kpi(p.doc, 'Deletions')]);
  ok('audit: actions normalised (changed → Changed) and counted', [...p.doc.querySelectorAll('#mk-body .mk-kpis')][1].textContent.replace(/\s+/g, ' ').includes('Changed2'), [...p.doc.querySelectorAll('#mk-body .mk-kpis')][1].textContent);
  ok('audit: changes by user chart drawn', !!p.doc.querySelector('#mk-body svg rect'));
  ok('audit: html in the export is shown as text', !p.doc.getElementById('mk-body').innerHTML.includes('<b>Aug</b>') && /Electricity <b>Aug<\/b>/.test(text(p.doc, '#mk-body')));
  const sel = (id, v) => { const el = p.doc.getElementById(id); el.value = v; p.ev(el, 'change'); };
  sel('user', 'Rica'); ok('audit: user filter', rowsN() === 2, rowsN()); sel('user', '');
  sel('action', 'Added'); ok('audit: action filter', rowsN() === 2, rowsN()); sel('action', '');
  sel('from', '2026-09-07'); ok('audit: action-date filter', rowsN() === 3, rowsN()); sel('from', '');
  const pr = p.doc.getElementById('prior'); pr.checked = true; p.ev(pr, 'change'); ok('audit: prior-period only', rowsN() === 2 && /Prior period/.test(text(p.doc, '#mk-body tbody')), rowsN()); pr.checked = false; p.ev(pr, 'change');
  const qq = p.doc.getElementById('q'); qq.value = 'GJ0007'; p.ev(qq, 'input'); ok('audit: search by reference', rowsN() === 1, rowsN()); qq.value = ''; p.ev(qq, 'input');
  ok('audit: totals debit $1,895.00, credit $365.91', /Total \$1,895\.00 \$365\.91/.test(rowsText(p.doc, '#mk-body tfoot')), rowsText(p.doc, '#mk-body tfoot'));
  p = await open(page('journal-audit', Object.assign({}, audit, { lockDate: '2026-08-31' })));
  ok('audit: with a lock date, a change on or before it is flagged', kpi(p.doc, 'Prior-period changes') === '2' && /lock date 2026-08-31/.test(text(p.doc, '#mk-sources')));
  p = await open(page('journal-audit', Object.assign({}, audit, { rows: audit.rows.concat([{ actionDate: '2026-09-13', user: '', action: 'Added', type: 'Sale', txnDate: '2026-09-13' }]) })));
  ok('audit: a row without a user turns the banner red', p.doc.querySelector('#mk-banner').className.includes('fail') && /1 rows without one/.test(text(p.doc, '#mk-banner')), text(p.doc, '#mk-banner'));
  p = await open(page('journal-audit', { company: null, period: '', rows: [] }));
  ok('audit: empty export → says so, business N/A, no errors', p.errs.length === 0 && /The export has no rows/.test(text(p.doc, '#mk-body')) && /N\/A — not in source/.test(text(p.doc, '#mk-head')));
  p.doc.getElementById('style').value = 'mysmb'; p.ev(p.doc.getElementById('style'), 'change');
  ok('audit: mySMB branding toggles', p.doc.documentElement.classList.contains('style-mysmb'));

  // ---------------- Workers Compensation (M31), from the export
  const wc = { company: 'mySMB.com', fileName: 'WorkersComp.xlsx', estimations: [
    { period: '1 July 2026 - 30 June 2027', created: '2026-09-01', total: 182400, states: [{ state: 'NSW', remuneration: 120000, employees: 2 }, { state: 'VIC', remuneration: 62400, employees: 1 }],
      employees: [{ name: 'Alex Morgan', state: 'NSW', remuneration: 70000 }, { name: 'Sam Lee', state: 'NSW', remuneration: 50000 }, { name: 'Jo <i>Park</i>', state: 'VIC', remuneration: 62400 }] },
    { period: '1 July 2025 - 30 June 2026', created: '2025-08-15', total: 150000, states: [{ state: 'NSW', remuneration: 150000, employees: 2 }] }] };
  p = await open(page('workers-comp', wc));
  ok('workers comp: no errors, 2/2 checks (states and employees add up)', p.errs.length === 0 && /2\/2 checks passed/.test(text(p.doc, '#mk-banner')), text(p.doc, '#mk-banner'));
  ok('workers comp: total $182,400.00 over 2 states, 3 employees', kpi(p.doc, 'Total estimated remuneration') === '$182,400.00' && kpi(p.doc, 'States') === '2' && kpi(p.doc, 'Employees') === '3', [kpi(p.doc, 'Total estimated remuneration'), kpi(p.doc, 'Employees')]);
  ok('workers comp: state shares and the estimations list', /NSW 2 \$120,000\.00 65\.8%/.test(rowsText(p.doc, '#mk-body')) && /1 July 2025 - 30 June 2026 2025-08-15 NSW \$150,000\.00/.test(rowsText(p.doc, '#mk-body')), rowsText(p.doc, '#mk-body').slice(0, 400));
  ok('workers comp: chart drawn, employee names escaped', !!p.doc.querySelector('#mk-body svg rect') && !p.doc.getElementById('mk-body').innerHTML.includes('<i>Park</i>'));
  const sx = p.doc.getElementById('state'); sx.value = 'VIC'; p.ev(sx, 'change');
  ok('workers comp: state filter', /VIC 1 \$62,400\.00/.test(rowsText(p.doc, '#mk-body')) && /Total 1 \$62,400\.00/.test(rowsText(p.doc, '#mk-body')) && !/Alex Morgan/.test(text(p.doc, '#mk-body')), rowsText(p.doc, '#mk-body').slice(0, 300));
  const es = p.doc.getElementById('est'); es.value = '1'; p.ev(es, 'change');
  ok('workers comp: second estimation, state filter reset', kpi(p.doc, 'Total estimated remuneration') === '$150,000.00' && p.doc.getElementById('state').value === '' && /1 July 2025 - 30 June 2026/.test(text(p.doc, '#mk-head')));
  const bad = JSON.parse(JSON.stringify(wc)); bad.estimations[0].total = 190000; bad.estimations[0].employees[0].remuneration = 71000;
  p = await open(page('workers-comp', bad));
  ok('workers comp: a total or employees that do not add up turn it red', p.doc.querySelector('#mk-banner').className.includes('fail') && /✗ Σ states = total/.test(text(p.doc, '#mk-banner')) && /✗ Σ employees/.test(text(p.doc, '#mk-banner')), text(p.doc, '#mk-banner'));
  p = await open(page('workers-comp', { company: 'mySMB.com', estimations: [] }));
  ok('workers comp: no estimations → MYOB\'s empty state, not red', /No estimation reports created yet/.test(text(p.doc, '#mk-body')) && !p.doc.querySelector('#mk-banner').className.includes('fail') && p.errs.length === 0);

  // ---------------- generated skills and the agent (skipped on the roundtrip's extracted copy, which has no plugin)
  if (!process.env.KIT_DIR) {
    const sk = (s) => fs.readFileSync(path.join(PLUGIN, 'skills', s + '.md'), 'utf8').replace(/\r\n/g, '\n');
    for (const s of ['myob-journal-security-audit', 'myob-workers-compensation']) {
      const md = sk(s), blk = (/```html\n([\s\S]*?)\n```/.exec(md) || [])[1] || '';
      ok(s + ': skill carries the page with {{DATA}} and the stylesheet filled in', blk.includes('{{DATA}}') && !blk.includes('{{CSS}}') && blk.includes('--accent:#6F2CBA') && /Do not call MYOB tools/.test(md));
    }
    ok('myob-custom-reports: the guide maps MYOB settings to inputs and says what is N/A', /\| Compare with \(previous period, last year, year to date\) \| `display\.c` \|/.test(sk('myob-custom-reports')) && /Columns shown, hidden or reordered/.test(sk('myob-custom-reports')));
    ok('foundation: names the guide and the export pages', /`myob-custom-reports` \(M62\), `myob-journal-security-audit` \(M13\), `myob-workers-compensation` \(M31\)/.test(sk('myob-report-foundation')));
    const bpDir = path.join(PLUGIN, 'content', 'agents'), bp = JSON.parse(fs.readFileSync(path.join(bpDir, fs.readdirSync(bpDir).find((x) => x.endsWith('.json'))), 'utf8'));
    const want = ['myob-reports-catalogue', 'myob-custom-reports', 'myob-journal-security-audit', 'myob-workers-compensation'].map((s) => 'myob-reporting-studio:' + s);
    ok('agent: has the four new skills', want.every((s) => bp.skills.includes(s)), want.filter((s) => !bp.skills.includes(s)));
    const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);
    const payload = Object.assign({}, bp); delete payload.contentHash;
    ok('agent: blueprint contentHash matches its content', bp.contentHash === crypto.createHash('sha256').update(JSON.stringify(sortDeep(payload))).digest('hex'));
    const amd = fs.readFileSync(path.join(PLUGIN, 'agents', 'myob-reporting-specialist.md'), 'utf8');
    ok('agent file: skills line includes them', want.every((s) => amd.includes(s)));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();

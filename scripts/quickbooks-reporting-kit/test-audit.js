const { JSDOM } = require('jsdom'), fs = require('fs');
const css = fs.readFileSync(__dirname + '/qb.css', 'utf8').trim(), tpl = process.env.AUDIT_HTML ? fs.readFileSync(process.env.AUDIT_HTML, 'utf8') : fs.readFileSync(__dirname + '/reports/audit-log.template.html', 'utf8');
const sample = { company: 'Enterprise AI Pty Ltd', period: '1 September 2026 - 10 September 2026', fileName: 'AuditLog.xlsx', rows: [
  { date: '2026-09-10 09:24', user: 'Melanie Burrows', event: 'Added Bill Payment (Cheque) to Yucheng Sun - USD for $1000.00', name: 'Yucheng Sun - USD', amount: '1,000.00' },
  { date: '2026-09-09 16:02', user: 'Online Banking Administration', event: 'Manually updated Online Banking accounts for Wise Business', name: '' },
  { date: '2026-09-08 11:15', user: 'Melanie Burrows', event: 'Edited Invoice No. 1042 for Civica Pty Ltd', name: 'Civica Pty Ltd', amount: '39,105.00' },
  { date: '2026-09-02 08:00', user: 'Doug Smith', event: 'Signed in', name: '' },
  { date: '2026-09-01 10:30', user: 'Doug Smith', event: 'Deleted Expense <script>x</script>', name: 'AWS', amount: '12.00' }] };
const build = (data) => (process.env.AUDIT_HTML ? tpl : tpl.replace('{{CSS}}', () => css)).replace('{{DATA}}', () => JSON.stringify(data).replace(/</g, '\\u003c'));
let fails = 0; const ok = (n, c, i) => { if (!c) { fails++; console.log('FAIL', n, i || ''); } else console.log('ok  ', n); };
(async () => {
  for (const [label, data] of [['sample', sample], ['empty', { company: null, period: '', rows: [] }]]) {
    const dom = new JSDOM(build(data), { runScripts: 'dangerously' }), w = dom.window, d = w.document, errs = []; w.addEventListener('error', (e) => errs.push(e.message)); w.print = () => {};
    await new Promise((r) => setTimeout(r, 20)); const txt = (s) => d.querySelector(s).textContent, ev = (el, t) => el.dispatchEvent(new w.Event(t)), rowsN = () => d.querySelectorAll('#qb-body tbody tr').length;
    ok(label + ' no script errors', errs.length === 0, errs);
    ok(label + ' banner validation', /counts by event type sum/.test(txt('#qb-banner')), txt('#qb-banner'));
    if (label === 'empty') { ok('empty: company N/A', /N\/A — not in source/.test(txt('#qb-head'))); ok('empty: no-match row', /No events match/.test(txt('#qb-body'))); continue; }
    ok('header company', /Enterprise AI Pty Ltd/.test(txt('#qb-head'))); ok('5 rows', rowsN() === 5, rowsN());
    ok('types derived', ['Added', 'Manually updated', 'Edited', 'Signed in', 'Deleted'].every((t) => txt('#qb-body').includes(t)), txt('#qb-body').slice(0, 200));
    const u = d.getElementById('user'); u.value = 'Melanie Burrows'; ev(u, 'change'); ok('user filter', rowsN() === 2, rowsN()); u.value = ''; ev(u, 'change');
    const t = d.getElementById('type'); t.value = 'Deleted'; ev(t, 'change'); ok('type filter', rowsN() === 1, rowsN()); t.value = ''; ev(t, 'change');
    const f = d.getElementById('from'); f.value = '2026-09-08'; ev(f, 'change'); ok('date filter', rowsN() === 3, rowsN()); f.value = ''; ev(f, 'change');
    const q = d.getElementById('q'); q.value = 'invoice'; ev(q, 'input'); ok('search', rowsN() === 1, rowsN());
    ok('html escaped', !d.getElementById('qb-body').innerHTML.includes('<script>x'));
  }
  console.log(fails ? fails + ' FAILED' : 'ALL AUDIT CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();

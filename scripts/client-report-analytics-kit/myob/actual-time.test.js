// CRA-12 Actual Time (MYOB): timesheet hours by employee, by job / activity / customer and by month, on the MYOB kit's own
// timesheet fixture (ledger.js listTimesheets: two employees, weekly sheets from 29 Jun 2026, one job, unprocessed weeks after
// 20 Sep). Totals must reconcile three ways, entries outside the period must not count, and the report must say plainly whose
// time this is. list_timesheets is not in lib.js's tool map, so this test answers the bindings itself (same ledger answers).
const path = require('path');
const { suite } = require('../harness.js');
const build = require('../build.js');
const { L, run, man, text, wait, banner, body, green, red, withDefaults, xlsxText, N1, N2 } = require('./lib.js');
const ID = 'actual-time', CF = L.CF1;
const { ok, done } = suite('myob/' + ID);
const TOOL = { list_timesheets: L.listTimesheets, list_company_files: L.companyFiles };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const open = async (over, set, opts) => { const m = withDefaults(man(ID), Object.assign({ company_file: CF }, set || {})); const t = await run('myob/' + ID, m, FX(m, over), Object.assign({ bundleInputs: true }, opts || {})); await wait(250); t.m = m; return t; };
const hrs = (v) => v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.');
// the expected hours, worked out from the fixture independently of the report
function expected(from, to, cf) {
  const by = {}, task = {}; let total = 0, open = 0;
  L.listTimesheets({ myob_company_file_id: cf, from_date: from, to_date: to }).Items.forEach((s) => s.Lines.forEach((l) => l.Entries.forEach((e) => {
    const d = e.Date.slice(0, 10); if (d < from || d > to) return;
    by[s.Employee.Name] = (by[s.Employee.Name] || 0) + e.Hours; const k = l.Job ? 'Job ' + l.Job.Number + ' ' + l.Job.Name : 'No job, activity or customer'; task[k] = (task[k] || 0) + e.Hours;
    total += e.Hours; if (!e.Processed) open += e.Hours; })));
  const r = (v) => Math.round(v * 100) / 100; Object.keys(by).forEach((k) => { by[k] = r(by[k]); }); Object.keys(task).forEach((k) => { task[k] = r(task[k]); });
  return { by, task, total: r(total), open: r(open) };
}

(async () => {
  const t = await open();
  const E = expected('2026-07-01', '2026-09-28', CF);
  ok('opens green with no script errors', green(t) && t.errs.length === 0, banner(t).slice(0, 500));
  ok('says plainly whose time this is (the client\'s own staff time, not the practice\'s)', /Time recorded in this company file's timesheets \(the client's own staff time\), not the practice's time on this client — that needs a practice-management time source\./.test(body(t)));
  ok('total hours = the fixture\'s daily entries in the period', new RegExp('Hours recorded' + hrs(E.total)).test(body(t)), [E.total, body(t).slice(0, 200)]);
  ok('hours by employee match the fixture', Object.keys(E.by).every((n) => new RegExp(n + '[^A-Z]*?' + hrs(E.by[n])).test(body(t))), E.by);
  ok('hours by job / activity / customer match the fixture', Object.keys(E.task).every((n) => new RegExp(n.replace(/[()]/g, '\\$&') + '[^]*?' + hrs(E.task[n])).test(body(t))), E.task);
  ok('hours not yet processed in a pay run match the fixture', new RegExp('Not yet processed in a pay run' + hrs(E.open)).test(body(t)), E.open);
  ok('totals reconcile: by employee = by task = by month = total (checked)', /✓ Hours by employee add up to the total/.test(banner(t)) && /✓ Hours by job, activity or customer add up to the total/.test(banner(t)) && /✓ Months add up to the total/.test(banner(t)), banner(t).slice(0, 600));
  ok('entries on sheets that overlap the period but fall outside it are not counted', /entries on the same sheets fall outside it/.test(banner(t)) && !/Jun 26/.test(body(t)), banner(t).slice(0, 600));

  const aug = await open(null, { display: JSON.stringify(Object.assign(JSON.parse(man(ID).inputs.find((i) => i.name === 'display').default), { p: 'custom' })), from_date: '2026-08-01', to_date: '2026-08-31' });
  const A = expected('2026-08-01', '2026-08-31', CF);
  ok('a one-month period counts only that month\'s entries', new RegExp('Hours recorded' + hrs(A.total)).test(body(aug)) && A.total < E.total, [A.total, body(aug).slice(0, 200)]);

  const tamper = await open({ timesheets: (p) => { const r = L.listTimesheets(p); r.Items[0].Lines[0].Entries[0].Hours = 'x'; return r; } });
  ok('a non-numeric entry is skipped, and the totals still reconcile', green(tamper) && tamper.errs.length === 0, banner(tamper).slice(0, 300));
  const none = await open({ timesheets: () => ({ Count: 0, Items: [] }) });
  ok('no timesheets = an honest "No time recorded", still green, not an error', green(none) && /No time recorded/.test(body(none)) && /Hours recorded0\.00/.test(body(none)), body(none).slice(0, 300));
  const failed = await open({ timesheets: () => { throw new Error('MYOB 403: Payroll access denied'); } });
  ok('timesheets that fail = a red banner naming the error, never zero hours', red(failed) && /Timesheets loaded/.test(banner(failed)) && /Payroll access denied/.test(body(failed)), banner(failed).slice(0, 300));

  const x = await (async () => { t.doc.getElementById('mk-xlsx').click(); await t.settle(); await wait(30); return xlsxText(t); })();
  const name = (t.downloads.filter((d) => d.name).pop() || {}).name || '';
  ok('Excel: file 1\'s name, the three sheets, and the entries', name.startsWith(N1 + ' - ') && /By employee/.test(x) && /By job or activity/.test(x) && /Entries/.test(x) && /Bluegum fit-out/.test(x), name);

  // LIB-002 in brief: the picker, a switch to file 2 that refetches for file 2 only, and the size limit (35,000 tokens).
  const m = man(ID);
  ok('every MYOB binding is scoped to the chosen company file', m.bindings.every((b) => b.tool.name === 'list_company_files' || ((b.params || {}).myob_company_file_id || {}).input === 'company_file'));
  const sel = t.doc.getElementById('mk-client');
  ok('opens on company file 1 by name; the picker lists both files', text(t.doc, 'header .co') === N1 && sel && [...sel.options].map((o) => o.textContent).join('|').includes(N1 + '|' + N2));
  const before = t.calls.length; sel.value = L.CF2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(300);
  const re = t.calls.slice(before).filter((c) => c.params && c.id === 'timesheets');
  ok('switching refetches the timesheets for file 2 only, and shows file 2', re.length > 0 && re.every((c) => c.params.myob_company_file_id === L.CF2) && text(t.doc, 'header .co') === N2 && green(t), banner(t).slice(0, 200));
  const html = build('myob/' + ID), mf = JSON.stringify(m, null, 2);
  let tokens = null; try { tokens = require(path.join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer')).countTokens(html + mf); } catch (e) { tokens = null; }
  const longest = Math.max(...(html + '\n' + mf).split('\n').map((l) => l.length));
  ok('size limits — document + dataBindings ≤ 35,000 tokens, no line over 1,500 characters', tokens != null && tokens <= 35000 && longest <= 1500, { tokens, longest });
  done(); process.exit(process.exitCode || 0);
})();

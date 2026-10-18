// CRA-12 Actual Time (Xero): Xero Projects time entries in the period, one list_time_entries call per project with time
// logged (fan), by person and month and by project, with hours not yet invoiced; dates on the organisation's own day.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { run, text, wait, banner, body, green, red, set } = X;
const ID = 'actual-time', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
const fan = (t) => t.calls.filter((x) => x.id === 'entries' && x.requery && x.params.projectId);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  const b = body(t);
  ok('opens green, no script errors', green(t) && t.errs.length === 0, banner(t).slice(0, 500));
  ok('time entries are read once per project with time logged (3 of 4 projects; none for the one with no time)', fan(t).length === 3 && fan(t).map((x) => x.params.projectId).sort().join() === 'p-1,p-2,p-3', fan(t).map((x) => x.params));
  ok('… each call for the selected organisation, with the period widened a day each side', fan(t).every((x) => x.params.dateAfterUtc === '2026-06-30T00:00:00Z' && x.params.dateBeforeUtc === '2026-09-27T00:00:00Z'), fan(t).map((x) => x.params));
  ok('KPIs: 93.00 hours logged, 2 people, 3 projects, 76.00 not yet invoiced', /Hours logged\s*93\.00/.test(b) && /People\s*2/.test(b) && /Projects with time\s*3/.test(b) && /Not yet invoiced\s*76\.00/.test(b), b.slice(0, 300));
  const who = text(t.doc, '.xk-card:nth-of-type(1)') || b;
  ok('by person: Priya Shah 50.00 and Tom Reid 43.00', /Priya Shah[^A-Z]*50\.00/.test(b) && /Tom Reid[^A-Z]*43\.00/.test(b), who.slice(0, 500));
  ok('months: Jul 42.00, Aug 19.00, Sep 32.00', /Total\s*42\.00\s*19\.00\s*32\.00\s*93\.00\s*76\.00/.test(b), b.slice(0, 900));
  ok('by project: Website rebuild 49.00, Fit-out Level 2 35.00, Annual stocktake (closed) 9.00', /Website rebuild\s*In progress[^0-9]*49\.00/.test(b) && /Fit-out Level 2\s*In progress[^0-9]*35\.00/.test(b) && /Annual stocktake\s*Closed[^0-9]*9\.00/.test(b), b.slice(0, 1200));
  ok('an entry stored as local midnight in UTC (2026-06-30T14:00Z) counts on 1 July, its own date (Priya: Jul 42.00, open 33.00)', /Priya Shah\s*42\.00\s*0\.00\s*8\.00\s*50\.00\s*33\.00/.test(b), b.slice(0, 900));
  ok('says whose time this is, and that it is not the practice\'s', /client's own staff time/.test(b) && /not the practice's time/.test(b));
  ok('no contact details: project users\' emails are never shown', !/example\.com/.test(t.doc.body.textContent));

  await set(t, 'xk-to', '2026-09-24'); await wait(250);
  ok('a shorter period refetches every project for the new window and cuts entries dated after it', /Hours logged\s*88\.00/.test(body(t)) && fan(t).some((x) => x.params.dateBeforeUtc === '2026-09-26T00:00:00Z'), body(t).slice(0, 300));
  ok('… and says what it left out', /1 just outside it left out/.test(banner(t)), banner(t).slice(0, 800));

  const x = await X.xlsxOf(t);
  ok('Excel has By person, By project and Entries sheets, with no contact details', /By person/.test(x) && /By project/.test(x) && /Entries/.test(x) && !/example\.com/.test(x));

  const n = await run(REF, m, X.fixtures(m), { fail: { projects_open: { code: 'needs_connection', message: 'Connect xero-projects' }, projects_closed: { code: 'needs_connection', message: 'Connect xero-projects' } } }); await wait(150);
  ok('without Xero Projects connected, it says to connect it and why — red, never zero hours', /Xero Projects is not connected/.test(body(n)) && /Projects switched on/.test(body(n)) && !/Hours logged/.test(body(n)) && red(n), body(n).slice(0, 300));

  const e = await run(REF, m, X.fixtures(m, { entries: (q) => { if (q.projectId === 'p-2') throw new Error('Xero Projects API 500'); return X.fixtures(m).entries(q); } })); await wait(250);
  ok('a project whose time entries fail is named and turns the report red, never silently dropped', red(e) && /Website rebuild: .*500/.test(banner(e)), banner(e).slice(0, 600));

  const many = X.fixtures(m, { entries: (q) => { const r = X.fixtures(m).entries(q); if (q.projectId === 'p-1') r.pagination.itemCount = 900; return r; } });
  const c = await run(REF, m, many); await wait(250);
  ok('a project with more entries than one page holds says it was cut off, red', red(c) && /Cut off at 500 entries: Fit-out Level 2/.test(banner(c)), banner(c).slice(0, 600));

  // The Xero Projects connection defaults to the other organisation: with none chosen, the report must pin the accounting
  // connection's active one (T1) for every call, never show T1's name over T2's projects.
  const L = X.L, P = require('./projects-fixtures.js'), other = (fn) => (q) => fn(Object.assign({}, q, { xero_tenant_id: q.xero_tenant_id || L.T2 }));
  const dx = await run(REF, m, X.fixtures(m, { projects_open: other(P.listProjects), projects_closed: other(P.listProjects), users: other(P.listProjectUsers), entries: other(P.listTimeEntries) })); await wait(300);
  ok('two connections with different default organisations: pinned to the accounting one, its projects only', /Website rebuild/.test(body(dx)) && !/Harbour office move/.test(body(dx)) && fan(dx).every((x) => x.params.xero_tenant_id === L.T1) && green(dx), body(dx).slice(0, 400));

  const s = await run(REF, m, X.fixtures(m), { mode: 'snapshot' }); await wait(150);
  ok('a snapshot says time entries are read live and are not in it, never zero hours', /not in this snapshot/.test(body(s)) && !/Hours logged/.test(body(s)) && fan(s).length === 0, body(s).slice(0, 300));

  const none = await run(REF, m, X.fixtures(m, { projects_open: () => ({ pagination: { itemCount: 0 }, items: [] }), projects_closed: () => ({ pagination: { itemCount: 0 }, items: [] }) })); await wait(150);
  ok('an organisation with no projects says so, green', /has no Xero Projects/.test(body(none)) && green(none), body(none).slice(0, 300));

  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

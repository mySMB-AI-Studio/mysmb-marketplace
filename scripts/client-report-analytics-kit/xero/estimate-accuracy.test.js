// CRA-13 Estimate Accuracy (Xero): Xero Projects task time estimates vs time logged (list_tasks, one call per project), and
// project estimates vs time and expenses to date (list_projects); task time must add up to each project's time logged.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { run, text, wait, banner, body, green, red } = X;
const ID = 'estimate-accuracy', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
const fan = (t) => t.calls.filter((x) => x.id === 'tasks' && x.requery && x.params.projectId);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(250);
  const b = body(t);
  ok('opens green, no script errors', green(t) && t.errs.length === 0, banner(t).slice(0, 600));
  ok('tasks are read once per project, in progress and closed (4 calls)', fan(t).length === 4 && fan(t).map((x) => x.params.projectId).sort().join() === 'p-1,p-2,p-3,p-4', fan(t).map((x) => x.params));
  ok('KPIs: 4 projects, 4 tasks with a time estimate, 100.00 estimated vs 98.00 actual hours, 19.6% average variance', /Projects\s*4/.test(b) && /Tasks with a time estimate\s*4/.test(b) && /Estimated hours\s*100\.00/.test(b) && /Actual hours\s*98\.00/.test(b) && /Average time variance\s*19\.6%/.test(b), b.slice(0, 400));
  ok('closed projects came in 34.0% under their estimate', /Closed projects: actual vs estimate\s*−34\.0%/.test(b), b.slice(0, 400));
  ok('by project: estimate, time and expenses to date, variance and %, estimated hours and hours logged', /Fit-out Level 2\s*In progress\s*\$12,000\.00\s*\$7,950\.00\s*\(\$4,050\.00\)\s*−33\.8%\s*50\.00\s*45\.00/.test(b) && /Annual stocktake\s*Closed\s*\$2,500\.00\s*\$1,650\.00\s*\(\$850\.00\)\s*−34\.0%\s*10\.00\s*9\.00/.test(b), b.slice(300, 1400));
  ok('a project with no time yet shows its estimate untouched (variance −100%)', /Not started\s*In progress\s*\$3,000\.00\s*\$0\.00\s*\(\$3,000\.00\)\s*−100\.0%/.test(b));
  ok('by task: Design 20.00 estimated vs 25.00 actual (+25.0%), Install 30.00 vs 20.00 (−33.3%)', /Design\s*Time\s*20\.00\s*25\.00\s*5\.00\s*\+25\.0%/.test(b) && /Install\s*Time\s*30\.00\s*20\.00\s*-10\.00\s*−33\.3%/.test(b), b.slice(1000, 2200));
  ok('tasks with no time estimate are listed, never averaged or given a variance', /Permit fee\s*Fixed\s*No time estimate\s*0\.00/.test(b) && /Content\s*Non-chargeable\s*No time estimate\s*5\.00/.test(b) && /2 of 4 task\(s\) with a time estimate came within 10%/.test(b));
  ok('task total: 100.00 estimated, 98.00 actual, -2.00 hours (−2.0%)', /Total of the tasks with a time estimate\s*100\.00\s*98\.00\s*-2\.00\s*−2\.0%/.test(b));
  ok('task time ties to each project\'s time logged (two Xero sources)', /✓ Task time adds up to each project's time logged/.test(banner(t)), banner(t).slice(0, 900));
  ok('says these are the client\'s own estimates, not the practice\'s', /client's own project estimates, not the practice's/.test(b));

  const x = await X.xlsxOf(t);
  ok('Excel has By project and By task sheets', /By project/.test(x) && /By task/.test(x) && /Design/.test(x));

  const bad = X.fixtures(m, { tasks: (q) => { const r = X.fixtures(m).tasks(q); if (q.projectId === 'p-1') r.items[0].totalMinutes += 60; return r; } });
  const d = await run(REF, m, bad); await wait(250);
  ok('task time that does not add up to the project\'s time logged turns the report red and names the project', red(d) && /Fit-out Level 2: tasks 46\.00 h, project 45\.00 h/.test(banner(d)), banner(d).slice(0, 900));

  const f = await run(REF, m, X.fixtures(m, { tasks: (q) => { if (q.projectId === 'p-2') throw new Error('Xero Projects API 500'); return X.fixtures(m).tasks(q); } })); await wait(250);
  ok('a project whose tasks fail is named, red, and its hours read "Failed", never 0', red(f) && /Failed: Website rebuild/.test(banner(f)) && /Website rebuild\s*In progress[^F]*Failed/.test(body(f)), banner(f).slice(0, 700));

  const n = await run(REF, m, X.fixtures(m), { fail: { projects_open: { code: 'needs_connection', message: 'Connect xero-projects' }, projects_closed: { code: 'needs_connection', message: 'Connect xero-projects' } } }); await wait(150);
  ok('without Xero Projects connected, it says to connect it and why — red, never zero', /Xero Projects is not connected/.test(body(n)) && /Projects switched on/.test(body(n)) && !/Estimated hours/.test(body(n)) && red(n), body(n).slice(0, 300));

  const s = await run(REF, m, X.fixtures(m), { mode: 'snapshot' }); await wait(150);
  ok('a snapshot keeps the project figures and says the task estimates are read live', /\$12,000\.00/.test(body(s)) && /Task estimates are read live/.test(body(s)) && fan(s).length === 0, body(s).slice(0, 600));

  await X.conformance(ID, ok);
  done(); process.exit(process.exitCode || 0);
})();

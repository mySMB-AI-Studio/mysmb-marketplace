// Xero Projects answers for the CRA-12 / CRA-13 Xero tests (myhub-mcp-servers xero-projects: list_projects, list_tasks,
// list_time_entries, list_project_users), shaped like the Xero Projects API: { pagination, items }, amounts as
// { currency, value }, durations in minutes, dates as UTC instants. One set per organisation (T1 / T2, the same tenants as
// the ledger), so a client switch must replace every figure. Time-entry dates are local midnight stored in UTC (Xero's
// form for an entry with no start time), so a 1 July entry in Sydney is 2026-06-30T14:00:00Z.
const L = require('../../xero-reporting-kit/ledger.js');
const A = (cur, v) => ({ currency: cur, value: v });
const page = (items) => ({ pagination: { page: 1, pageSize: 500, pageCount: 1, itemCount: items.length }, items });
const DATA = {
  [L.T1]: {
    cur: 'AUD',
    users: [{ userId: 'u-1', name: 'Priya Shah', email: 'priya@example.com' }, { userId: 'u-2', name: 'Tom Reid', email: 'tom@example.com' }],
    projects: [
      { projectId: 'p-1', contactId: 'c-1', name: 'Fit-out Level 2', status: 'INPROGRESS', estimate: 12000, task: 6750, expense: 1200, invoiced: 5000, deadlineUtc: '2026-11-30T00:00:00Z' },
      { projectId: 'p-2', contactId: 'c-2', name: 'Website rebuild', status: 'INPROGRESS', estimate: 8000, task: 6600, expense: 0, invoiced: 0, deadlineUtc: null },
      { projectId: 'p-4', contactId: 'c-2', name: 'Not started', status: 'INPROGRESS', estimate: 3000, task: 0, expense: 0, invoiced: 0, deadlineUtc: null },
      { projectId: 'p-3', contactId: 'c-3', name: 'Annual stocktake', status: 'CLOSED', estimate: 2500, task: 1350, expense: 300, invoiced: 1650, deadlineUtc: '2026-07-31T00:00:00Z' }
    ],
    tasks: {
      'p-1': [{ taskId: 't-11', name: 'Design', chargeType: 'TIME', rate: 150, estimateMinutes: 1200, totalMinutes: 1500 }, { taskId: 't-12', name: 'Install', chargeType: 'TIME', rate: 120, estimateMinutes: 1800, totalMinutes: 1200 }, { taskId: 't-13', name: 'Permit fee', chargeType: 'FIXED', rate: 500, estimateMinutes: 0, totalMinutes: 0 }],
      'p-2': [{ taskId: 't-21', name: 'Build', chargeType: 'TIME', rate: 150, estimateMinutes: 2400, totalMinutes: 2640 }, { taskId: 't-22', name: 'Content', chargeType: 'NON_CHARGEABLE', rate: 0, estimateMinutes: 0, totalMinutes: 300 }],
      'p-4': [],
      'p-3': [{ taskId: 't-31', name: 'Count', chargeType: 'TIME', rate: 150, estimateMinutes: 600, totalMinutes: 540 }]
    },
    // [project, task, user, dateUtc, minutes, status]
    entries: [
      ['p-1', 't-11', 'u-1', '2026-06-29T14:00:00Z', 600, 'INVOICED'], // 30 Jun in Sydney: before the period
      ['p-1', 't-11', 'u-1', '2026-06-30T14:00:00Z', 480, 'INVOICED'], // 1 Jul in Sydney: first day of the period
      ['p-1', 't-11', 'u-2', '2026-08-11T14:00:00Z', 420, 'ACTIVE'],
      ['p-1', 't-12', 'u-2', '2026-08-20T14:00:00Z', 720, 'ACTIVE'],
      ['p-1', 't-12', 'u-1', '2026-09-01T14:00:00Z', 480, 'LOCKED'],
      ['p-2', 't-21', 'u-1', '2026-07-14T14:00:00Z', 1500, 'ACTIVE'],
      ['p-2', 't-21', 'u-2', '2026-09-23T14:00:00Z', 1140, 'ACTIVE'],
      ['p-2', 't-22', 'u-2', '2026-09-24T14:00:00Z', 300, 'ACTIVE'],
      ['p-3', 't-31', 'u-1', '2026-07-20T14:00:00Z', 540, 'INVOICED']
    ]
  },
  [L.T2]: {
    cur: 'NZD',
    users: [{ userId: 'u-9', name: 'Mere Tane', email: 'mere@example.com' }],
    projects: [{ projectId: 'p-9', contactId: 'c-9', name: 'Harbour office move', status: 'INPROGRESS', estimate: 4800, task: 2970, expense: 0, invoiced: 0, deadlineUtc: null }],
    tasks: { 'p-9': [{ taskId: 't-91', name: 'Packing', chargeType: 'TIME', rate: 90, estimateMinutes: 2400, totalMinutes: 1980 }] },
    entries: [['p-9', 't-91', 'u-9', '2026-08-04T12:00:00Z', 1980, 'ACTIVE']]
  }
};
const of = (q) => DATA[(q && q.xero_tenant_id) || L.T1] || DATA[L.T1];
const minutesLogged = (d, pid) => d.entries.filter((e) => e[0] === pid).reduce((s, e) => s + e[4], 0);
function listProjects(q) {
  const d = of(q);
  return page(d.projects.filter((p) => !q.states || p.status === q.states).map((p) => ({
    projectId: p.projectId, contactId: p.contactId, name: p.name, currencyCode: d.cur, minutesLogged: minutesLogged(d, p.projectId),
    totalTaskAmount: A(d.cur, p.task), totalExpenseAmount: A(d.cur, p.expense), estimate: A(d.cur, p.estimate), totalInvoiced: A(d.cur, p.invoiced),
    totalToBeInvoiced: A(d.cur, p.task + p.expense - p.invoiced), deadlineUtc: p.deadlineUtc, status: p.status
  })));
}
function listTasks(q) {
  const d = of(q), list = d.tasks[q.projectId];
  if (!q.projectId || !list) throw new Error('Xero Projects API GET /projects/' + (q.projectId || '') + '/tasks 404: Not Found');
  return page(list.map((t) => ({ taskId: t.taskId, projectId: q.projectId, name: t.name, chargeType: t.chargeType, rate: A(d.cur, t.rate), estimateMinutes: t.estimateMinutes, totalMinutes: t.totalMinutes, totalAmount: A(d.cur, t.rate * t.totalMinutes / 60), status: 'ACTIVE' })));
}
function listTimeEntries(q) {
  const d = of(q);
  if (!q.projectId || !d.tasks[q.projectId]) throw new Error('Xero Projects API GET /projects/' + (q.projectId || '') + '/time 404: Not Found');
  return page(d.entries.filter((e) => e[0] === q.projectId && (!q.dateAfterUtc || e[3] >= q.dateAfterUtc) && (!q.dateBeforeUtc || e[3] < q.dateBeforeUtc))
    .map((e, i) => ({ timeEntryId: e[0] + '-te-' + i, projectId: e[0], taskId: e[1], userId: e[2], dateUtc: e[3], dateEnteredUtc: e[3], duration: e[4], description: 'Work', status: e[5] })));
}
function listProjectUsers(q) { return page(of(q).users); }
module.exports = { DATA, listProjects, listTasks, listTimeEntries, listProjectUsers };

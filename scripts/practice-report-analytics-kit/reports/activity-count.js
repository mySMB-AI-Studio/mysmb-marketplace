// PRA-08 Activity Count: transaction counters across sales, purchases, banking, journals and payroll,
// per client, for a period — "how active is this client's file". Sourced from
// get_practice_activity_count on each of xero-accounting and myob-accounting (CONSOL). QuickBooks is
// one company per connection and is excluded from practice-wide consolidation (same exclusion as
// every other PRA-0X report).
//
// Layout family is "practice table + heat strip" (see the FULL PROMPT): the heat strip lives inside
// the table itself (columns.*.heat shades each cell by its relative size among the visible rows), not
// as a separate chart element — this kit's lightweight "chart" layer elsewhere is the RAG badge, same
// approach, just a different visual treatment for a volume metric that has no good/bad direction.
// "Rank" is the rankKey column (by total activity, descending, recomputed on every filter/sort).
//
// Not built in this slice, documented rather than guessed at (judgement calls — see the PR):
//  - "Trend" (period-over-period change) would need a second, prior-period fetch per client per
//    platform — double the calls this report's budget (5s typical / 45s hard ceiling) allows for.
//    Re-running the report for a different period is today's substitute.
//  - "Pricing tier suggestion" is a practice-specific business judgement, not a sourced figure from
//    any platform or this spec's data — there is nothing here to compute it from.
//  - Payroll is only sourced for MYOB. Xero's payroll (pay runs) lives in a separate connector
//    (xero-payroll-au) this agent doesn't connect — never guessed from accounting-side data; shown
//    as N/A with that reason (get_practice_activity_count sets payrollCount_na for every Xero client).
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Activity Count',
    slug: 'practice-activity-count',
    chips: [],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — ask the Client Report Analytics agent for this client’s activity instead.',
    rankKey: 'total',
    // get_practice_activity_count agrees on names across both platforms — identity aliases, kept
    // explicit so a future rename on either side is caught by the report tests, not silently wrong.
    fieldAliases: {
      xero: { sales: 'salesCount', purchases: 'purchasesCount', banking: 'bankingCount', journals: 'journalsCount', payroll: 'payrollCount', total: 'totalCount' },
      myob: { sales: 'salesCount', purchases: 'purchasesCount', banking: 'bankingCount', journals: 'journalsCount', payroll: 'payrollCount', total: 'totalCount' }
    },
    columns: [
      { key: 'sales', label: 'Sales', heat: true },
      { key: 'purchases', label: 'Purchases', heat: true },
      { key: 'banking', label: 'Banking', heat: true },
      { key: 'journals', label: 'Journals', heat: true },
      { key: 'payroll', label: 'Payroll', heat: true },
      { key: 'total', label: 'Total activity', heat: true }
    ],
    totals: ['sales', 'purchases', 'banking', 'journals', 'payroll', 'total']
  });
};

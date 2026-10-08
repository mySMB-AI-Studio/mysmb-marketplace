// PRA-05 Banking Summary Metrics: cash in, cash out, net, unreconciled statement-line counts/values,
// per client. Sourced from get_practice_banking_summary (CONSOL). QuickBooks excluded.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Banking Summary Metrics',
    slug: 'practice-banking-summary',
    chips: [],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection, and bank-feed/unreconciled data is not in the QuickBooks Accounting API — see the Client agent.',
    // get_practice_banking_summary: both platforms agree on these names, except the unreconciled $
    // amount (MYOB: unreconciledAmount, same as Xero — identity, included for clarity/regression safety).
    fieldAliases: {
      xero: { cash_in: 'cashIn', cash_out: 'cashOut', unreconciled_count: 'unreconciledCount', unreconciled_value: 'unreconciledAmount' },
      myob: { cash_in: 'cashIn', cash_out: 'cashOut', unreconciled_count: 'unreconciledCount', unreconciled_value: 'unreconciledAmount' }
    },
    columns: [
      { key: 'cash_in', label: 'Cash in', money: true },
      { key: 'cash_out', label: 'Cash out', money: true },
      { key: 'net', label: 'Net', money: true, rag: 'low' },
      { key: 'unreconciled_count', label: 'Unreconciled #' },
      { key: 'unreconciled_value', label: 'Unreconciled $', money: true }
    ],
    totals: ['cash_in', 'cash_out', 'net', 'unreconciled_count', 'unreconciled_value']
  });
};

// PRA-04 Bank Reconciliation Summary: statement vs ledger balance, unreconciled lines, last reconciled,
// across every client and bank account (rolled up to one row per client: the worst/most-recent figures
// across that client's accounts). Sourced from get_practice_bank_reconciliation_summary (CONSOL).
// Statement-line data is a real gap on some platforms (Xero Accounting API has none; see the Prompt
// Library's own blocker) — the aggregate tool is expected to mark `difference_na`/`unreconciled_na`
// per client where the platform can't supply it, which this report shows as N/A, not a fabricated $0.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Bank Reconciliation Summary',
    slug: 'practice-bank-reconciliation-summary',
    chips: ['Needs attention'],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection, and QuickBooks has no bank-feed/unreconciled data in its API — see the Client agent for what is available.',
    columns: [
      { key: 'statement_balance', label: 'Statement', money: true },
      { key: 'ledger_balance', label: 'Ledger', money: true },
      { key: 'difference', label: 'Difference', money: true, rag: true },
      { key: 'unreconciled_count', label: 'Unreconciled #' },
      { key: 'unreconciled_value', label: 'Unreconciled $', money: true },
      { key: 'last_reconciled', label: 'Last reconciled' }
    ],
    totals: ['unreconciled_count', 'unreconciled_value']
  });
};

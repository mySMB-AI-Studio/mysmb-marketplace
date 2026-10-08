// PRA-04 Bank Reconciliation Summary: unreconciled lines across every client and bank account, rolled
// up to one row per client. Sourced from get_practice_bank_reconciliation_summary (CONSOL).
//
// Revised against the real tools (both built 2026-10-08): neither Xero's nor MYOB's Accounting API
// exposes a client-level statement balance, ledger balance or last-reconciled date — only a per-
// bank-account breakdown nested under `accounts` (Xero) / `bankAccounts` (MYOB), each itself marked
// `statementBalance_na`/`lastReconciled_na` for the same reason. The original column set (statement vs
// ledger, difference, last reconciled) promised more than either platform's real API can give at the
// client-summary level, so this report shows what both tools actually and honestly provide: unreconciled
// line counts and values per client. A future version could drill into the nested per-account arrays;
// this one stays one row per client, matching the Prompt Library's own "practice table" layout family.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Bank Reconciliation Summary',
    slug: 'practice-bank-reconciliation-summary',
    chips: ['Needs attention'],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection, and QuickBooks has no bank-feed/unreconciled data in its API — see the Client agent for what is available.',
    fieldAliases: {
      xero: { unreconciled_count: 'totalUnreconciledCount', unreconciled_value: 'totalUnreconciledAmount' },
      myob: { unreconciled_count: 'unreconciledCount', unreconciled_value: 'unreconciledAmount' }
    },
    columns: [
      { key: 'unreconciled_count', label: 'Unreconciled #', rag: 'high' },
      { key: 'unreconciled_value', label: 'Unreconciled $', money: true }
    ],
    totals: ['unreconciled_count', 'unreconciled_value']
  });
};

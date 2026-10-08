// PRA-03 Purchases Summary Metrics: outstanding/overdue bills, DPO, bank payments, supplier counts,
// per client. Sourced from get_practice_purchases_summary (CONSOL). QuickBooks excluded.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Purchases Summary Metrics',
    slug: 'practice-purchases-summary',
    chips: ['Overdue only'],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — see its Purchases by Tracking Category / Financial Overview in the Client agent.',
    // get_practice_purchases_summary: both platforms agree on these names.
    fieldAliases: {
      xero: { outstanding: 'outstandingAmount', outstanding_count: 'outstandingCount', overdue: 'overdueAmount', overdue_count: 'overdueCount', payments: 'bankPayments', suppliers: 'supplierCount' },
      myob: { outstanding: 'outstandingAmount', outstanding_count: 'outstandingCount', overdue: 'overdueAmount', overdue_count: 'overdueCount', payments: 'bankPayments', suppliers: 'supplierCount' }
    },
    columns: [
      { key: 'outstanding', label: 'Outstanding', money: true },
      { key: 'outstanding_count', label: 'Outstanding #' },
      { key: 'overdue', label: 'Overdue', money: true, rag: 'high' },
      { key: 'overdue_count', label: 'Overdue #' },
      { key: 'dpo', label: 'DPO (days)' },
      { key: 'payments', label: 'Payments (bank)', money: true },
      { key: 'suppliers', label: 'Suppliers' }
    ],
    totals: ['outstanding', 'outstanding_count', 'overdue', 'overdue_count', 'payments']
  });
};

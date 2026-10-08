// PRA-02 Sales Summary Metrics: outstanding and overdue counts/values, DSO, bank receipts, average
// invoice value, per client. Sourced from get_practice_sales_summary (CONSOL). QuickBooks excluded
// (one company per connection).
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Sales Summary Metrics',
    slug: 'practice-sales-summary',
    chips: ['Overdue only'],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — see its Sales by Tracking Category / Financial Overview in the Client agent.',
    columns: [
      { key: 'outstanding', label: 'Outstanding', money: true },
      { key: 'outstanding_count', label: 'Outstanding #' },
      { key: 'overdue', label: 'Overdue', money: true, rag: true },
      { key: 'overdue_count', label: 'Overdue #' },
      { key: 'dso', label: 'DSO (days)' },
      { key: 'receipts', label: 'Receipts (bank)', money: true },
      { key: 'avg_invoice', label: 'Avg invoice', money: true }
    ],
    totals: ['outstanding', 'outstanding_count', 'overdue', 'overdue_count', 'receipts']
  });
};

// PRA-01 Client Summary Metrics: counts of contacts, accounts, invoices, bills and employees per
// client — the practice's one-page inventory. Sourced from get_practice_client_summary on each of
// xero-accounting and myob-accounting (CONSOL). QuickBooks is one company per connection and is
// excluded from practice-wide consolidation (assessment CONSOL blocker); its single company has its
// own report in the Client agent instead.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice Client Summary Metrics',
    slug: 'practice-client-summary',
    chips: [],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — see its Client Summary in the Client Report Analytics agent.',
    columns: [
      { key: 'contacts', label: 'Contacts' },
      { key: 'accounts', label: 'Accounts' },
      { key: 'invoices', label: 'Invoices' },
      { key: 'bills', label: 'Bills' },
      { key: 'employees', label: 'Employees' },
      { key: 'bank_accounts', label: 'Bank accounts' }
    ],
    totals: ['contacts', 'accounts', 'invoices', 'bills', 'employees', 'bank_accounts']
  });
};

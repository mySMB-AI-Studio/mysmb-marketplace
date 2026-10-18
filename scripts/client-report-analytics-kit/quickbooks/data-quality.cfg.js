// CRA-02 Data Quality (QuickBooks): every finding of the checks on this company's ledger, by category and severity, with $ at risk, and what was checked. The checks run on the connected company's ledger as the report opens,
// using the overnight checks engine's rules (shared/live-checks.js); the bindings and the QuickBooks mapping are shared with the
// other live-checks reports (quickbooks/live-checks.inc.js), the view is shared with Xero and MYOB (shared/views/data-quality.js).
var LCV = { view: 'data-quality', title: 'QuickBooks · Data Quality' };
/* @include shared/views/data-quality.js */
/* @include quickbooks/live-checks.inc.js */

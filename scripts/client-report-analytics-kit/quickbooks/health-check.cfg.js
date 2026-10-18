// CRA-09 Health Check (QuickBooks): the company's financial activity and data quality on one page. The checks run on the connected company's ledger as the report opens,
// using the overnight checks engine's rules (shared/live-checks.js); the bindings and the QuickBooks mapping are shared with the
// other live-checks reports (quickbooks/live-checks.inc.js), the view is shared with Xero and MYOB (shared/views/health-check.js).
var LCV = { view: 'health-check', title: 'QuickBooks · Health Check' };
/* @include shared/views/health-check.js */
/* @include quickbooks/live-checks.inc.js */

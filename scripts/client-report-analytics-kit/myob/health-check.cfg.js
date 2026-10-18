// CRA-09 Health Check (MYOB): the client's financial activity and data quality on one page. The checks run on the company file's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the MYOB mapping are shared with the other live-checks
// reports (myob/live-checks.inc.js), the view is shared with Xero and QuickBooks (shared/views/health-check.js).
var LCV = { view: 'health-check', title: 'MYOB Health Check' };
/* @include shared/views/health-check.js */
/* @include myob/live-checks.inc.js */

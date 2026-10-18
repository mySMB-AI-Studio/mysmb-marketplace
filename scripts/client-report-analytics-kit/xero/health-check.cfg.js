// CRA-09 Health Check (Xero): the client's financial activity and data quality on one page. The checks run on the organisation's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the Xero mapping are shared with the other live-checks
// reports (xero/live-checks.inc.js), the view is shared with MYOB and QuickBooks (shared/live-views.js).
var LCV = { view: 'health-check', title: 'Xero · Health Check' };
/* @include shared/views/health-check.js */
/* @include xero/live-checks.inc.js */

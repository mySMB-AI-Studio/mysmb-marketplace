// CRA-08 Client Queries (QuickBooks): the transactions the client has to explain or send something for (missing receipts, uncoded and unexplained lines), ready to send. The checks run on the connected company's ledger as the report opens,
// using the overnight checks engine's rules (shared/live-checks.js); the bindings and the QuickBooks mapping are shared with the
// other live-checks reports (quickbooks/live-checks.inc.js), the view is shared with Xero and MYOB (shared/views/client-queries.js).
var LCV = { view: 'client-queries', title: 'QuickBooks · Client Queries' };
/* @include shared/views/client-queries.js */
/* @include quickbooks/live-checks.inc.js */

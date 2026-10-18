// CRA-08 Client Queries (Xero): the transactions the client has to explain or send something for (missing receipts, missing ABNs, uncoded and unexplained lines), ready to send. The checks run on the organisation's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the Xero mapping are shared with the other live-checks
// reports (xero/live-checks.inc.js), the view is shared with MYOB and QuickBooks (shared/live-views.js).
var LCV = { view: 'client-queries', title: 'Xero · Client Queries' };
/* @include shared/views/client-queries.js */
/* @include xero/live-checks.inc.js */

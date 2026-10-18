// CRA-08 Client Queries (MYOB): the transactions the client has to explain or send something for (missing ABNs, uncoded and unexplained lines), ready to send. The checks run on the company file's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the MYOB mapping are shared with the other live-checks
// reports (myob/live-checks.inc.js), the view is shared with Xero and QuickBooks (shared/views/client-queries.js).
var LCV = { view: 'client-queries', title: 'MYOB Client Queries' };
/* @include shared/views/client-queries.js */
/* @include myob/live-checks.inc.js */

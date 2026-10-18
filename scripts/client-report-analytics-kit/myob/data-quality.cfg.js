// CRA-02 Data Quality (MYOB): every finding of the checks on this company file's ledger, by category and severity, with $ at risk, and what was checked. The checks run on the company file's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the MYOB mapping are shared with the other live-checks
// reports (myob/live-checks.inc.js), the view is shared with Xero and QuickBooks (shared/views/data-quality.js).
var LCV = { view: 'data-quality', title: 'MYOB Data Quality' };
/* @include shared/views/data-quality.js */
/* @include myob/live-checks.inc.js */

// CRA-02 Data Quality (Xero): every finding of the checks on this client's ledger, by category and severity, with $ at risk, and what was checked. The checks run on the organisation's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the Xero mapping are shared with the other live-checks
// reports (xero/live-checks.inc.js), the view is shared with MYOB and QuickBooks (shared/live-views.js).
var LCV = { view: 'data-quality', title: 'Xero · Data Quality' };
/* @include shared/views/data-quality.js */
/* @include xero/live-checks.inc.js */

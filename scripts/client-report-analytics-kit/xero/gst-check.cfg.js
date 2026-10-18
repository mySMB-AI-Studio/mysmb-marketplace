// CRA-10 GST Check (Xero): the scope and method of every GST check, which are clear and which carry GST risk. The checks run on the organisation's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the Xero mapping are shared with the other live-checks
// reports (xero/live-checks.inc.js), the view is shared with MYOB and QuickBooks (shared/live-views.js).
var LCV = { view: 'gst-check', title: 'Xero · GST Check' };
/* @include shared/views/gst-check.js */
/* @include xero/live-checks.inc.js */

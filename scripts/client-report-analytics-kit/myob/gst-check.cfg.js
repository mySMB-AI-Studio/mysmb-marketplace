// CRA-10 GST Check (MYOB): the scope and method of every GST check, which are clear and which carry GST risk. The checks run on the company file's ledger as the report opens, using the
// overnight checks engine's rules (shared/live-checks.js); the bindings and the MYOB mapping are shared with the other live-checks
// reports (myob/live-checks.inc.js), the view is shared with Xero and QuickBooks (shared/views/gst-check.js).
var LCV = { view: 'gst-check', title: 'MYOB GST Check' };
/* @include shared/views/gst-check.js */
/* @include myob/live-checks.inc.js */

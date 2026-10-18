// CRA-10 GST Check (QuickBooks): the scope and method of every GST check, which are clear and which carry GST risk. The checks run on the connected company's ledger as the report opens,
// using the overnight checks engine's rules (shared/live-checks.js); the bindings and the QuickBooks mapping are shared with the
// other live-checks reports (quickbooks/live-checks.inc.js), the view is shared with Xero and MYOB (shared/views/gst-check.js).
var LCV = { view: 'gst-check', title: 'QuickBooks · GST Check' };
/* @include shared/views/gst-check.js */
/* @include quickbooks/live-checks.inc.js */

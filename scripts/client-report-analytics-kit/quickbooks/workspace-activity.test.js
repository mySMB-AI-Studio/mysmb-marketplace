// CRA-15 Workspace User Activity (QuickBooks-flavoured chrome). Like the Xero/MYOB versions, checks in-period filtering,
// best-effort client match, and a graceful empty state rather than the full conformance() suite's monetary assumptions.
const U = require('./qb-test-util.js');
const { run, suite, F, text, banner, red } = U;
const manifest = require('../build.js').manifest('quickbooks/workspace-activity');
const REF = 'quickbooks/workspace-activity';
const CO = F.companyInfo.CompanyName || F.companyInfo.LegalName || 'Enterprise AI Pty Ltd';
function workqActivity() {
  return { items: [
    { id: 'wq-1', type: 'finding', title: 'Review unreconciled bank line — ' + CO, relatedTo: CO, user: 'Priya Shah', action: 'Resolved', occurredAt: '2026-08-12' },
    { id: 'wq-2', type: 'task', title: 'Chase overdue invoice', relatedTo: CO, user: 'Priya Shah', action: 'Created', occurredAt: '2026-09-02' },
    { id: 'wq-3', type: 'finding', title: 'Old finding for ' + CO + ' (last financial year)', relatedTo: CO, user: 'Priya Shah', action: 'Resolved', occurredAt: '2025-05-01' }
  ] };
}
const fx = { activity: workqActivity, company_info: () => F.companyInfo, prefs: () => F.prefs };
const { ok, done } = suite('quickbooks/workspace-activity');
(async () => {
  const t = await run(REF, manifest, fx);
  ok('no script errors', t.errs.length === 0, t.errs);
  ok('shows the two in-period items for this client, not the out-of-period one', text(t.doc, '#wa-grid').includes('Chase overdue invoice') && text(t.doc, '#wa-grid').includes('Review unreconciled bank line') && !text(t.doc, '#wa-grid').includes('Old finding'), text(t.doc, '#wa-grid').slice(0, 500));
  ok('not failing', !red(t), banner(t).slice(0, 400));
  const empty = await run(REF, manifest, Object.assign({}, fx, { activity: () => ({ items: [] }) }));
  ok('no activity in the period degrades gracefully: a plain message, not an error', text(empty.doc, '#qb-body').includes('No WorkQ activity recorded for this client') && empty.errs.length === 0, text(empty.doc, '#qb-body').slice(0, 400));
  const f = await run(REF, manifest, fx, { fail: { activity: { code: 'tool_error', message: 'Workspace activity service error' } } });
  ok('a failed workspace-activity load is never silent', text(f.doc, '#qb-body').includes('Workspace activity service error'), text(f.doc, '#qb-body').slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

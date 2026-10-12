// CRA-15 Workspace User Activity (MYOB-flavoured chrome). Like the Xero version, this is not run through lib.js's
// conformance()/common() monetary assumptions; it checks the behaviour that matters: in-period filtering, best-effort client
// match, and a graceful empty state.
const { suite } = require('../harness.js');
const { L, go, text, wait, banner, body, green } = require('./lib.js');
const ID = 'workspace-activity';
const { ok, done } = suite('myob/' + ID);
(async () => {
  const t = await go(ID); await wait(200);
  ok('opens green', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('shows the two in-period items for this client, not the out-of-period one', /Chase overdue invoice/.test(text(t.doc, '#wa-grid')) && /Review unreconciled bank line/.test(text(t.doc, '#wa-grid')) && !/Old finding/.test(text(t.doc, '#wa-grid')), text(t.doc, '#wa-grid').slice(0, 500));
  const empty = await go(ID, { activity: () => ({ items: [] }) });
  ok('no activity in the period degrades gracefully: a plain message, not an error', /No WorkQ activity recorded for this client/.test(body(empty)) && empty.errs.length === 0, body(empty).slice(0, 400));
  const f = await go(ID, null, { fail: { activity: { code: 'tool_error', message: 'Workspace activity service error' } } });
  ok('a failed workspace-activity load is never silent', /Workspace activity service error/.test(body(f)), body(f).slice(0, 200));
  done(); process.exit(process.exitCode || 0);
})();

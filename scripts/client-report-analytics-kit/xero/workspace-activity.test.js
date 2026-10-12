// CRA-15 Workspace User Activity (Xero-flavoured chrome). Not run through the generic X.conformance() helper: that helper
// asserts every binding carries xero_tenant_id on client switch, which does not apply to the workq_activity binding (it is
// the platform's own built-in "workspace" data server, not a Xero tool) — see the long comment in the .cfg.js. Instead this
// test checks the behaviour that actually matters here: in-period filtering, best-effort client match, graceful empty state,
// and that the client picker still re-renders the client's name when switched.
const { suite } = require('../harness.js');
const X = require('./xero-fixtures.js'), { L, run, text, wait, banner, body, green } = X;
const ID = 'workspace-activity', REF = 'xero/' + ID, m = X.man(ID);
const { ok, done } = suite('xero/' + ID);
(async () => {
  const t = await run(REF, m, X.fixtures(m)); await wait(200);
  ok('opens green', green(t) && t.errs.length === 0, banner(t).slice(0, 400));
  ok('shows the two in-period items for this client (Northwind), not the out-of-period one', /Chase overdue invoice/.test(text(t.doc, '#wa-grid')) && /Review unreconciled bank line/.test(text(t.doc, '#wa-grid')) && !/Old finding/.test(text(t.doc, '#wa-grid')), text(t.doc, '#wa-grid').slice(0, 500));
  ok('the best-effort client-match caveat is stated, not hidden', /best-effort/.test(banner(t)), banner(t).slice(0, 600));
  // graceful empty state (the expected case while the checks engine, WL-00, is not live)
  const empty = Object.assign({}, X.fixtures(m), { activity: () => ({ items: [] }) });
  const e = await run(REF, m, empty); await wait(150);
  ok('no activity in the period degrades gracefully: a plain message, not an error or a fabricated row', /No WorkQ activity recorded for this client/.test(body(e)) && !/\bfail\b/i.test((e.doc.querySelector('#xk-banner') || {}).className || '') && e.errs.length === 0, body(e).slice(0, 400));
  // a failed load is never silent
  const f = await run(REF, m, X.fixtures(m), { fail: { activity: { code: 'tool_error', message: 'Workspace activity service error' } } }); await wait(100);
  ok('a failed workspace-activity load is never silent', /Workspace activity service error/.test(body(f)), body(f).slice(0, 200));
  // client picker still works: switching organisation re-renders the client name and asks for activity again (best effort)
  const before = t.calls.length, sel = t.doc.getElementById('xk-client');
  ok('client picker (LIB-002) lists the connection\'s organisations', sel && [...sel.options].length === 2);
  sel.value = L.T2; sel.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); await wait(200);
  ok('switching client re-fetches workspace activity and shows the new client\'s name', t.calls.slice(before).some((c) => c.id === 'activity') && text(t.doc, '#xk-head .co') === L.ORG[L.T2].Name, { head: text(t.doc, '#xk-head'), calls: t.calls.slice(before).map((c) => c.id) });
  ok('no items of Northwind (organisation 1) remain once switched to organisation 2, which the fixture never mentions', !text(t.doc, '#wa-grid').includes('Northwind'), text(t.doc, '#wa-grid').slice(0, 300));
  done(); process.exit(process.exitCode || 0);
})();

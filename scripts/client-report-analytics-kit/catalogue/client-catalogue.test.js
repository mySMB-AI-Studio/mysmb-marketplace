// CRA-00 catalogue: clients from the viewer's own connections only, one box per row, live boxes name the right
// per-platform template, missing connections are named (never a blank page), snapshot mode, chips/search, downloads.
const { run, suite } = require('../harness.js');
const { manifest } = require('../build.js');
const { REPORTS } = require('../reports.js');
const LIB = require('../libraries.json');
const X = require('../../xero-reporting-kit/ledger.js');
const M = require('../../myob-reporting-kit/ledger.js');
const Q = require('../../quickbooks-reporting-kit/fixtures.js');
const { ok, done } = suite('catalogue');
const REF = 'catalogue/client-catalogue', man = manifest(REF);
const fx = { xero_connections: () => X.connections(), myob_company_files: () => M.companyFiles(), quickbooks_company: () => Q.companyInfo };
const NC = { code: 'needs_connection', message: 'Connect' };
const txt = (d, s) => (d.querySelector(s) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
const rows = (d) => [...d.querySelectorAll('[data-row]')].map((e) => e.getAttribute('data-row'));

(async () => {
  // 1. all three connected
  let t = await run(REF, man, fx);
  const opts = [...t.doc.querySelectorAll('#client option')].map((o) => o.textContent);
  ok('no script errors', !t.errs.length, t.errs);
  ok('client list = every Xero organisation, MYOB company file and the QuickBooks company', opts.length === 2 + 2 + 1 && opts.includes('Xero · Northwind Trading Pty Ltd') && opts.includes('MYOB · mySMB.com') && opts.includes('QuickBooks · Enterprise AI Pty Ltd'), opts);
  ok('one call per platform, nothing else', t.calls.map((c) => c.tool).sort().join() === 'list_company_files,list_connections,qbo_query', t.calls);
  const r1 = rows(t.doc);
  ok('one box per row: 15 client reports + the Xero library', r1.length === 15 + LIB.xero.reports.length && new Set(r1).size === r1.length, r1.length);
  ok('checks banner passes', /Checks passed/.test(txt(t.doc, '#banner')) && /One box per catalogue row/.test(txt(t.doc, '#banner')), txt(t.doc, '#banner'));
  ok('portal check is information, not a pass', /ℹ Boxes hidden from the client portal/.test(txt(t.doc, '#banner')));
  const fo = t.doc.querySelector('[data-row="CRA-01"]').textContent;
  ok('CRA-01 box is Live and names the Xero template and the client', /Live/.test(fo) && fo.includes('Xero Financial Overview') && fo.includes('Northwind Trading Pty Ltd'), fo);
  ok('CRA-12 on a Xero client says Xero has no time records', /Xero’s accounting API has no time records/.test(t.doc.querySelector('[data-row="CRA-12"]').textContent), t.doc.querySelector('[data-row="CRA-12"]').textContent);
  ok('CRA-13 on a Xero client says why it is not available', /doesn’t link a quote to the invoices raised from it/.test(t.doc.querySelector('[data-row="CRA-13"]').textContent));
  for (const [id, title] of [['CRA-02', 'Xero Data Quality'], ['CRA-08', 'Xero Client Queries'], ['CRA-09', 'Xero Health Check'], ['CRA-10', 'Xero GST Check']]) {
    const box = t.doc.querySelector('[data-row="' + id + '"]').textContent;
    ok(id + ' box is Live, names ' + title + ' and says the checks run as the report opens', /Live/.test(box) && box.includes(title) && /run on the client’s ledger as the report opens/.test(box), box);
  }
  ok('live (or export-routed, or workspace) boxes on a Xero client are every item but the two time reports', [...t.doc.querySelectorAll('.pill.live')].map((p) => p.closest('[data-row]').getAttribute('data-row')).filter((r) => /^CRA/.test(r)).join() === 'CRA-01,CRA-02,CRA-03,CRA-04,CRA-05,CRA-06,CRA-07,CRA-08,CRA-09,CRA-10,CRA-11,CRA-14,CRA-15');
  ok('CRA-15 routes to the built-in Workspace Activity report and says it is workspace-wide', /Live · Workspace/.test(t.doc.querySelector('[data-row="CRA-15"]').textContent) && /Reports → Workspace Activity/.test(t.doc.querySelector('[data-row="CRA-15"]').textContent) && /not this client only/.test(t.doc.querySelector('[data-row="CRA-15"]').textContent), t.doc.querySelector('[data-row="CRA-15"]').textContent);
  ok('no box says "Not available" without a reason', [...t.doc.querySelectorAll('.pill.na')].every((p) => p.closest('[data-row]').querySelector('.how').textContent.trim().length > 20));

  // 2. switch to the MYOB file: library + template names follow, setInputs records it, no refetch
  const sel = t.doc.getElementById('client'); sel.value = 'myob:cf-demo'; sel.dispatchEvent(new t.w.Event('change'));
  const r2 = rows(t.doc);
  ok('MYOB client: 15 + MYOB library boxes', r2.length === 15 + LIB.myob.reports.length, r2.length);
  ok('MYOB client: CRA-05 names the MYOB template', t.doc.querySelector('[data-row="CRA-05"]').textContent.includes('MYOB Summary of Tax Amounts by Type'));
  ok('nothing of the Xero client left in the boxes', !txt(t.doc, 'main').includes('Northwind'));
  ok('selection is announced with the declared input', JSON.stringify(t.setInputsLog.pop()) === '{"client":"myob:cf-demo"}');
  ok('a client switch makes no tool call (no data per client yet)', t.calls.length === 3);

  ok('MYOB client: CRA-12 is Live, names MYOB Actual Time and says it is the client’s own staff time', /Live/.test(t.doc.querySelector('[data-row="CRA-12"]').textContent) && t.doc.querySelector('[data-row="CRA-12"]').textContent.includes('MYOB Actual Time') && /not the practice’s time/.test(t.doc.querySelector('[data-row="CRA-12"]').textContent));
  ok('MYOB client: CRA-13 says why it is not available on MYOB yet', /Not available on MYOB yet/.test(t.doc.querySelector('[data-row="CRA-13"]').textContent));
  ok('MYOB client: CRA-02 names MYOB Data Quality', t.doc.querySelector('[data-row="CRA-02"]').textContent.includes('MYOB Data Quality'));

  // 3. QuickBooks: one-company notice; no "then pick" step
  sel.value = 'quickbooks:1'; sel.dispatchEvent(new t.w.Event('change'));
  ok('QuickBooks one-company limit is stated', /one company per connection/.test(txt(t.doc, '#notices')));
  ok('QuickBooks library listed', rows(t.doc).length === 15 + LIB.quickbooks.reports.length);
  ok('QuickBooks client: CRA-13 is Live and names QuickBooks Estimate Accuracy (dollars, not time)', /Live/.test(t.doc.querySelector('[data-row="CRA-13"]').textContent) && t.doc.querySelector('[data-row="CRA-13"]').textContent.includes('QuickBooks Estimate Accuracy') && /no time estimates/.test(t.doc.querySelector('[data-row="CRA-13"]').textContent), t.doc.querySelector('[data-row="CRA-13"]').textContent);
  ok('QuickBooks client: CRA-12 names QuickBooks Actual Time', t.doc.querySelector('[data-row="CRA-12"]').textContent.includes('QuickBooks Actual Time'));

  // 4. chips + search
  t.doc.querySelector('[data-chip="Tax & BAS"]').click();
  ok('Tax & BAS chip shows CRA-05, 06, 07, 10 only', rows(t.doc).join() === 'CRA-05,CRA-06,CRA-07,CRA-10', rows(t.doc));
  t.doc.querySelector('[data-chip="All"]').click();
  const q = t.doc.getElementById('q'); q.value = 'ageing'; q.dispatchEvent(new t.w.Event('input'));
  ok('search filters across both groups', rows(t.doc).length > 0 && rows(t.doc).every((r) => /ageing|aged/i.test(t.doc.querySelector('[data-row="' + r + '"]').textContent)), rows(t.doc));

  // 5. downloads
  t.doc.getElementById('xls').click(); await t.settle();
  const blob = t.downloads.find((d) => d.blob), name = t.downloads.find((d) => d.name);
  const x = blob ? Buffer.from(await blob.blob.arrayBuffer()).toString('utf8') : '';
  ok('Excel download: workbook with the client and every row', x.includes('<Workbook') && x.includes('Enterprise AI Pty Ltd') && (x.match(/<Row>/g) || []).length === 4 + 15 + LIB.quickbooks.reports.length, (x.match(/<Row>/g) || []).length);
  ok('Excel file name carries the client', name && name.name === 'client-report-catalogue-enterprise-ai-pty-ltd.xls', name);
  t.doc.getElementById('pdf').click();
  ok('Download PDF prints', t.downloads.some((d) => d.print));

  // 6. only Xero connected: the others are named, never a blank page
  t = await run(REF, man, fx, { fail: { myob_company_files: NC, quickbooks_company: NC } });
  ok('unconnected platforms are named with where to connect', /Connect MYOB \(Settings → Connections\)/.test(txt(t.doc, '#notices')) && /Connect QuickBooks/.test(txt(t.doc, '#notices')));
  ok('only Xero clients offered', [...t.doc.querySelectorAll('#client option')].every((o) => o.textContent.startsWith('Xero · ')));
  // a tool error is shown with its message
  t = await run(REF, man, fx, { fail: { xero_connections: { code: 'tool_error', message: 'Xero said 500' } } });
  ok('tool error is shown, not hidden', /Xero clients could not be listed: Xero said 500/.test(txt(t.doc, '#notices')));

  // 7. nothing connected
  t = await run(REF, man, fx, { fail: { xero_connections: NC, myob_company_files: NC, quickbooks_company: NC } });
  ok('nothing connected: says so, still lists the 15 reports', /No clients/.test(txt(t.doc, '#client')) && rows(t.doc).length === 15);
  ok('nothing connected: client check is information, not a pass', /ℹ Clients come only from your own connections/.test(txt(t.doc, '#banner')));

  // 8. a copy opened with a client preset (artifact_from_template inputs → bundle.inputs), and snapshot mode
  t = await run(REF, man, fx, { snapshotInputs: { client: 'xero:' + X.T2 }, bundleInputs: true });
  ok('preset client is selected on open', t.doc.getElementById('client').value === 'xero:' + X.T2 && txt(t.doc, '#head').includes('Southgate'));
  t = await run(REF, man, fx, { mode: 'snapshot' });
  ok('snapshot: client picker disabled', t.doc.getElementById('client').disabled);
  t = await run(REF, man, fx, { theme: 'dark' });
  ok('dark theme stamp honoured (no prefers-color-scheme)', t.doc.documentElement.getAttribute('data-myhub-theme') === 'dark' && !/prefers-color-scheme/.test(t.doc.documentElement.outerHTML));
  ok('every CRA template in reports.js is referenced by a live box', REPORTS.filter((r) => r.platform).every((r) => JSON.stringify(require('../build.js')(REF)).includes(r.title)));
  done();
})();

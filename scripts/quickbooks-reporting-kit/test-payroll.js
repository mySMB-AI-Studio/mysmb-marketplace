// Q32–Q34 payroll behaviour tests (Employment Hero Payroll): figures, checks, views, the payroll-business selector, the
// employee filter, financial-year roll, STP years, privacy and Excel — against fixtures-payroll.js (one ledger, so reports tie).
const { run, hydrate } = require('./harness.js');
const EH = require('./fixtures-payroll.js');
const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
let total = 0, fails = 0;
function ok(n, c, info) { total++; if (!c) { fails++; console.log('  FAIL', n, info === undefined ? '' : String(typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 400)); } }
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); };
const view = (t, v) => set(t, 'qb-view', v);
const banner = (t) => text(t.doc, '#qb-banner'), green = (t) => t.doc.querySelector('#qb-banner').className.includes('pass');
const kpi = (t, label) => { const k = [...t.doc.querySelectorAll('.qb-kpi')].find((x) => text(x, '.lbl') === label); return k ? text(k, '.val') : null; };
const totalRow = (t) => [...t.doc.querySelectorAll('#g1 tfoot tr td, #g1 tr.k-total:last-child td')].map((c) => c.textContent);
const PAY = { businesses: EH.listBusinesses, pay_runs: EH.listPayRuns, gross_to_net: EH.grossToNet, payg: EH.payg, pay_categories: EH.payCategories, super_employee: EH.superContributions, super_fund: EH.superContributions };
const EMPS = { businesses: EH.listBusinesses, employees: EH.employeeDetails, leave: EH.leaveBalances, gross_to_net: EH.grossToNet, pay_categories: EH.payCategories };
const ATO = { businesses: EH.listBusinesses, payment_summaries: EH.paymentSummaries, stp: EH.stpRegistration, gross_to_net: EH.grossToNet, payg: EH.payg };
const xlsxText = async (t) => { t.doc.getElementById('qb-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('latin1') : ''; };
(async () => {
  // ---------------- Q32 Payroll Reports (August 2026: pay runs 12 and 26 August)
  const pm = man('payroll');
  let t = await run('payroll', pm, PAY);
  ok('payroll: no errors', t.errs.length === 0, t.errs);
  ok('payroll: header company = the first payroll business', text(t.doc, '#qb-head .co') === 'Enterprise AI Pty Ltd', text(t.doc, '#qb-head .co'));
  ok('payroll: prepared from Employment Hero Payroll', text(t.doc, '#qb-head .qb-src') === 'Prepared from Employment Hero Payroll');
  ok('payroll: period August 2026', text(t.doc, '#qb-head .pe') === 'August 2026', text(t.doc, '#qb-head .pe'));
  ok('payroll: footer names the source, not an accounting basis', /^Employment Hero Payroll · by date paid \| /.test(text(t.doc, '#qb-foot')), text(t.doc, '#qb-foot'));
  ok('payroll: banner names the payroll year', /Financial year starts July \(Australian payroll year\)/.test(banner(t)), banner(t));
  ok('payroll: gross to net 3/3 checks pass', green(t) && /3\/3 checks passed/.test(banner(t)), banner(t));
  ok('payroll: KPIs gross A$11,728.00, withheld A$2,362.00, net A$8,926.00, super A$1,368.00, 2 paid', kpi(t, 'Gross earnings') === 'A$11,728.00' && kpi(t, 'Tax withheld (PAYG, HELP, SFSS)') === 'A$2,362.00' && kpi(t, 'Net pay') === 'A$8,926.00' && kpi(t, 'Super (SGC)') === 'A$1,368.00' && kpi(t, 'Employees paid') === '2',
    [kpi(t, 'Gross earnings'), kpi(t, 'Tax withheld (PAYG, HELP, SFSS)'), kpi(t, 'Net pay'), kpi(t, 'Super (SGC)'), kpi(t, 'Employees paid')]);
  const mel = [...t.doc.querySelectorAll('#g1 tbody tr')].map((r) => [...r.cells].map((c) => c.textContent)).find((r) => r[0] === 'Melanie Burrows');
  ok('payroll: Melanie gross A$6,940.00, pre-tax A$400.00, net A$5,192.00', mel && mel[2] === 'A$6,940.00' && mel[3] === 'A$400.00' && mel[9] === 'A$5,192.00', mel);
  ok('payroll: Bookkeeper sees HELP and SFSS columns', [...t.doc.querySelectorAll('#g1 thead th')].some((x) => x.textContent === 'HELP'));
  ok('payroll: client selector lists both payroll businesses', [...t.doc.querySelectorAll('#qb-client option')].map((o) => o.textContent).join('|') === 'Enterprise AI Pty Ltd|Enterprise AI Trust' && !t.doc.getElementById('qb-client').disabled);
  ok('payroll: sources name the connector and the privacy rule', /employment-hero-payroll connector/.test(text(t.doc, '#qb-sources')) && /removes tax file numbers, bank details, dates of birth/.test(text(t.doc, '#qb-sources')));
  ok('payroll: N/A lists the members the connector cannot give', /Costing Report, Detailed Activity Report, Ordinary Time Earnings Report and Timesheets Report/.test(text(t.doc, '#qb-sources')));
  ok('payroll: every call passes the business and the period', t.calls.filter((c) => c.tool !== 'list_businesses').every((c) => c.params.business_id === '' && c.params.from_date === '2026-08-01' && c.params.to_date === '2026-08-31'), t.calls);
  await set(t, 'qb-persona', 'Executive');
  ok('payroll: Executive gets the summary columns', [...t.doc.querySelectorAll('#g1 thead th')].map((x) => x.textContent).join('|') === 'Employee|Gross earnings|Tax withheld|Net earnings|Super (SGC)');
  await set(t, 'qb-persona', 'Bookkeeper');
  let x = await xlsxText(t);
  ok('payroll: Excel has the report sheet with SUM totals, Validation and Parameters', /Gross to Net Report/.test(x) && /SUM\(C6:C7\)/.test(x) && /Validation/.test(x) && /Parameters/.test(x));
  // Deductions
  await view(t, 'deductions');
  ok('payroll: deductions pre-tax A$400.00, post-tax A$40.00', kpi(t, 'Pre-tax deductions') === 'A$400.00' && kpi(t, 'Post-tax deductions') === 'A$40.00');
  ok('payroll: deductions list Salary Sacrifice Super and Union Fees', /Salary Sacrifice Super/.test(text(t.doc, '#g1')) && /Union Fees/.test(text(t.doc, '#g1')));
  ok('payroll: deductions tie to Gross to Net', green(t) && /✓ Σ deduction lines = pre-tax \+ post-tax deductions on Gross to Net/.test(banner(t)), banner(t));
  // Pay categories
  await view(t, 'pay_categories');
  ok('payroll: pay categories total A$11,728.00 ties to gross', kpi(t, 'Earnings') === 'A$11,728.00' && /✓ Σ pay categories = gross earnings on Gross to Net/.test(banner(t)), banner(t));
  ok('payroll: Phone Allowance category survives (privacy filter keeps category names)', /Total for Phone Allowance/.test(text(t.doc, '#g1')));
  // PAYG
  await view(t, 'payg');
  ok('payroll: PAYG W1 A$11,728.00, W2 A$2,362.00', kpi(t, 'W1 Total salary, wages and other payments') === 'A$11,728.00' && kpi(t, 'W2 Amounts withheld') === 'A$2,362.00');
  ok('payroll: W2 = PAYG + HELP + SFSS on Gross to Net', /✓ W2 = tax withheld on Gross to Net — A\$2,362\.00 = PAYG A\$2,266\.00 \+ HELP A\$96\.00/.test(banner(t)), banner(t));
  ok('payroll: PAYG says draft, check before lodging', /Draft — check before lodging/.test(text(t.doc, '#qb-body')));
  ok('payroll: PAYG has no employee picker', !t.doc.getElementById('w-emp'));
  // Pay runs
  await view(t, 'pay_runs');
  ok('payroll: pay run audit lists the two August pay runs', kpi(t, 'Pay runs') === '2' && /2026-08-12/.test(text(t.doc, '#g1')) && /2026-08-26/.test(text(t.doc, '#g1')), text(t.doc, '#g1').slice(0, 300));
  ok('payroll: pay runs tie to pay categories', green(t) && /✓ Σ pay runs = Σ pay categories \(gross\)/.test(banner(t)), banner(t));
  // Comparison
  await view(t, 'comparison');
  ok('payroll: comparison previous 12 Aug vs latest 26 Aug', kpi(t, 'Previous pay run (2026-08-12)') != null && kpi(t, 'Latest pay run (2026-08-26)') != null, [...t.doc.querySelectorAll('.qb-kpi .lbl')].map((k) => k.textContent));
  ok('payroll: comparison ties and lists employees to review', green(t) && /Employees to review/.test(banner(t)), banner(t));
  // Super
  await view(t, 'super');
  ok('payroll: super A$1,768.00, guarantee A$1,368.00 = SGC', kpi(t, 'Super contributions') === 'A$1,768.00' && kpi(t, 'Super guarantee') === 'A$1,368.00' && /✓ Super guarantee = SGC on Gross to Net/.test(banner(t)), banner(t));
  await view(t, 'super_fund');
  ok('payroll: super by fund ties to super by employee', green(t) && /✓ Σ by fund = Σ by employee/.test(banner(t)) && /AustralianSuper/.test(text(t.doc, '#g1')) && /STA0100AU/.test(text(t.doc, '#g1')), banner(t));
  // Employee filter (display only)
  await view(t, 'gross_to_net');
  let n0 = t.calls.length;
  await set(t, 'w-emp', '501');
  ok('payroll: employee filter shows Melanie only, no refetch', t.calls.length === n0 && /Melanie Burrows/.test(text(t.doc, '#g1')) && !/Daniel Kim/.test(text(t.doc, '#g1')) && text(t.doc, '#qb-head .ti') === 'Gross to Net Report — Melanie Burrows');
  ok('payroll: totals check is N/A under the filter', /– Σ employees = Employment Hero totals \(gross, net\) — Employee filter on/.test(banner(t)), banner(t));
  await set(t, 'qb-preset', 'last_quarter');
  ok('payroll: the filter survives a period change', t.doc.getElementById('w-emp').value === '501' && /Melanie Burrows/.test(text(t.doc, '#g1')));
  // Payroll business selector: refetches with the business id and clears the employee filter
  n0 = t.calls.length;
  await set(t, 'qb-client', '7002');
  const re = t.calls.slice(n0).filter((c) => c.requery);
  ok('payroll: choosing another business refetches every payroll report with its id', re.length === 6 && re.every((c) => c.params.business_id === '7002'), re);
  ok('payroll: header follows the business; its pay is empty, not an error', text(t.doc, '#qb-head .co') === 'Enterprise AI Trust' && /No pay in this period/.test(text(t.doc, '#g1')) && !t.doc.querySelector('#qb-banner').className.includes('fail'), text(t.doc, '#qb-head .co'));
  ok('payroll: business change clears the employee filter', t.doc.getElementById('w-emp').value === '' && JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).x === '');
  ok('payroll: business choice is announced as an input', t.setInputsLog[t.setInputsLog.length - 1].business_id === '7002');
  // One business only: the selector is shown but disabled
  t = await run('payroll', pm, Object.assign({}, PAY, { businesses: () => EH.listBusinesses().slice(0, 1) }));
  ok('payroll: one business → selector disabled', t.doc.getElementById('qb-client').disabled && t.doc.querySelectorAll('#qb-client option').length === 1);
  // Not connected
  const nc = { code: 'needs_connection', message: 'not connected' };
  t = await run('payroll', pm, PAY, { fail: { businesses: nc, pay_runs: nc, gross_to_net: nc, payg: nc, pay_categories: nc, super_employee: nc, super_fund: nc } });
  ok('payroll: not connected → connect Employment Hero Payroll, never QuickBooks', /Connect Employment Hero Payroll \(Settings → Connections\)/.test(text(t.doc, 'main')) && !/Connect QuickBooks/.test(text(t.doc, 'main')) && t.errs.length === 0);
  ok('payroll: not connected → header says N/A for the business', text(t.doc, '#qb-head .co') === 'N/A — not in source' && /Business name \(Employment Hero returned no business/.test(text(t.doc, '#qb-sources')));
  // A connector total that disagrees (an old connector summed the pay-category objects to 0) fails loudly
  t = await run('payroll', pm, Object.assign({}, PAY, { gross_to_net: (p) => { const r = EH.grossToNet(p); r.totals.grossEarnings = 0; return r; } }));
  ok('payroll: wrong connector gross total → red check', /✗ Σ employees = Employment Hero totals/.test(banner(t)), banner(t));
  // Snapshot reads the period from the data
  t = await run('payroll', pm, PAY, { mode: 'snapshot', bundle: hydrate(pm, PAY, { start_date: '2026-09-01', end_date: '2026-09-30' }) });
  ok('payroll: snapshot period from the data, controls disabled', text(t.doc, '#qb-head .pe') === 'September 2026' && t.doc.getElementById('qb-client').disabled && t.doc.getElementById('qb-preset').disabled);
  // Privacy: nothing sensitive reaches the page even if a connector sent it
  t = await run('payroll', pm, Object.assign({}, PAY, { gross_to_net: (p) => { const r = EH.grossToNet(p); return r; } }));
  ok('payroll: no TFN, bank, birth or address text on the page', !/tax ?file number:|bsb|date of birth|street/i.test(text(t.doc, '#qb-body')));

  // ---------------- Q33 Employee Reports
  const em = man('employees');
  t = await run('employees', em, EMPS);
  ok('employees: no errors, 2/2 checks', t.errs.length === 0 && green(t) && /2\/2 checks passed/.test(banner(t)), banner(t));
  ok('employees: details list the three active employees and their columns', ['Melanie Burrows', 'Daniel Kim', 'Priya Shah'].every((s) => text(t.doc, '#g1').includes(s)) && !/Tom Reyes/.test(text(t.doc, '#g1')) && /Employment Type/.test(text(t.doc, '#g1 thead')) && /2024-02-05/.test(text(t.doc, '#g1')));
  ok('employees: KPIs 3 active, 2 paid, 1 started in August', kpi(t, 'Active employees') === '3' && kpi(t, 'Paid in the period') === '2' && kpi(t, 'Started in the period') === '1', [kpi(t, 'Active employees'), kpi(t, 'Paid in the period'), kpi(t, 'Started in the period')]);
  ok('employees: header says active employees', text(t.doc, '#qb-head .pe') === 'Active employees');
  ok('employees: Birthdays N/A for privacy', /Birthdays \(dates of birth are removed for privacy\)/.test(text(t.doc, '#qb-sources')));
  await view(t, 'unpaid');
  ok('employees: unpaid employees = Priya Shah', kpi(t, 'Unpaid employees') === '1' && /Priya Shah/.test(text(t.doc, '#g1')) && !/Melanie/.test(text(t.doc, '#g1')) && /✓ Active employees = paid \+ unpaid — 3 = 2 \+ 1/.test(banner(t)), banner(t));
  await view(t, 'leave_liability');
  const lb = EH.leaveBalances({ as_at: '2026-08-31' });
  ok('employees: leave liability total = Employment Hero total', kpi(t, 'Leave liability (with loading)') === 'A$' + lb.totalLeavePlusLoading.toLocaleString('en-AU', { minimumFractionDigits: 2 }) && green(t), [kpi(t, 'Leave liability (with loading)'), lb.totalLeavePlusLoading, banner(t)]);
  ok('employees: leave as at the To date', text(t.doc, '#qb-head .pe') === 'As of August 31, 2026' && t.calls.find((c) => c.id === 'leave').params.as_at === '2026-08-31');
  ok('employees: leave liability chart drawn', !!t.doc.querySelector('#ch1 svg'));
  await view(t, 'leave_balances');
  ok('employees: leave balances by category with Long Service Leave', /Long Service Leave/.test(text(t.doc, '#g1')) && /Negative leave balances/.test(banner(t)) && green(t), banner(t));
  await view(t, 'payment_history');
  ok('employees: payment history ties to Gross to Net', green(t) && /✓ Σ payments = gross earnings on Gross to Net — A\$11,728\.00 vs A\$11,728\.00/.test(banner(t)) && /Total for Melanie Burrows/.test(text(t.doc, '#g1')), banner(t));
  await set(t, 'w-emp', '502');
  ok('employees: filter → Daniel only', /Daniel Kim/.test(text(t.doc, '#g1')) && !/Melanie/.test(text(t.doc, '#g1')) && green(t));
  t = await run('employees', em, Object.assign({}, EMPS, { employees: EH.employeeDetailsLabels }));
  ok('employees: display-name columns are matched too', green(t) && /Employee Id/.test(text(t.doc, '#g1 thead')) && /Melanie Burrows/.test(text(t.doc, '#g1')));
  await view(t, 'unpaid');
  ok('employees: unpaid works with display-name columns', /Priya Shah/.test(text(t.doc, '#g1')) && kpi(t, 'Unpaid employees') === '1');
  t = await run('employees', em, EMPS, { fail: { gross_to_net: { code: 'tool_error', message: 'boom' } } });
  await view(t, 'unpaid');
  ok('employees: unpaid needs Gross to Net — says so, red', /Gross to Net is unavailable/.test(text(t.doc, '#qb-body')) && t.doc.querySelector('#qb-banner').className.includes('fail'));

  // ---------------- Q34 ATO Reports
  const am = man('ato');
  t = await run('ato', am, ATO);
  ok('ato: no errors, tax withheld ties', t.errs.length === 0 && green(t) && /✓ Tax withheld = PAYG \+ HELP \+ SFSS on Gross to Net for the year/.test(banner(t)), banner(t));
  ok('ato: FY2026 period', text(t.doc, '#qb-head .pe') === 'FY2026: 1 July 2025 - 30 June 2026', text(t.doc, '#qb-head .pe'));
  ok('ato: 3 payment summaries, gross A$209,690.00, tax A$43,449.00, RESC A$5,200.00', kpi(t, 'Payment summaries') === '3' && kpi(t, 'Gross payments') === 'A$209,690.00' && kpi(t, 'Total tax withheld') === 'A$43,449.00' && kpi(t, 'Reportable employer super') === 'A$5,200.00',
    [kpi(t, 'Payment summaries'), kpi(t, 'Gross payments'), kpi(t, 'Total tax withheld')]);
  ok('ato: a leaver is on the year\'s summaries', /Tom Reyes/.test(text(t.doc, '#g1')) && /2026-03-31/.test(text(t.doc, '#g1')));
  ok('ato: N/A — TFN declarations (privacy) and JobKeeper (ended)', /Tax File Declaration Reporting \(tax file numbers are removed for privacy\)/.test(text(t.doc, '#qb-sources')) && /JobKeeper ended on 28 March 2021/.test(text(t.doc, '#qb-sources')));
  ok('ato: financial year select lists FY2027 … FY2021, FY2026 chosen', t.doc.getElementById('qb-enum-0').value === '2026' && t.doc.querySelectorAll('#qb-enum-0 option').length === 7);
  n0 = t.calls.length;
  await set(t, 'qb-enum-0', '2025');
  const ps = t.calls.slice(n0).find((c) => c.id === 'payment_summaries'), g = t.calls.slice(n0).find((c) => c.id === 'gross_to_net');
  ok('ato: FY2025 → summaries for 2025 (a number) and Gross to Net 1 Jul 2024 – 30 Jun 2025', ps && ps.params.financial_year_ending === 2025 && g && g.params.from_date === '2024-07-01' && g.params.to_date === '2025-06-30', [ps, g]);
  ok('ato: picking a year stops it rolling', JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).p === 'custom' && t.setInputsLog[t.setInputsLog.length - 1].fy_end === 2025);
  ok('ato: FY2025 has no summaries — says why, not red', /No payment summaries for FY2025/.test(text(t.doc, '#qb-body')) && !t.doc.querySelector('#qb-banner').className.includes('fail'));
  await set(t, 'qb-enum-0', '2026');
  await view(t, 'year');
  ok('ato: PAYG for the year W1 A$216,190.00, W2 A$43,449.00, both tie', kpi(t, 'Gross earnings (W1)') === 'A$216,190.00' && kpi(t, 'Amounts withheld (W2)') === 'A$43,449.00' && green(t) && /2\/2 checks passed/.test(banner(t)), banner(t));
  await view(t, 'stp');
  ok('ato: STP registration enabled → check passes', /Single Touch Payroll enabled/.test(text(t.doc, '#g1')) && /✓ Single Touch Payroll enabled for a business that pays employees/.test(banner(t)), banner(t));
  await set(t, 'qb-client', '7002');
  ok('ato: second business without STP or pay → not red', text(t.doc, '#qb-head .co') === 'Enterprise AI Trust' && !t.doc.querySelector('#qb-banner').className.includes('fail'), banner(t));
  // Roll: a copy saved as "this financial year" opens on the current year (clock 25 Sep 2026 → FY2027)
  const cp = JSON.parse(JSON.stringify(am)); cp.inputs.find((i) => i.name === 'display').default = cp.inputs.find((i) => i.name === 'display').default.replace('"p":"last_fy"', '"p":"this_fy"');
  t = await run('ato', cp, ATO, { bundleInputs: true }); // the copy's inputs arrive as bundle.inputs, as in myHubV2
  const first = t.setInputsLog[0] || {};
  ok('ato: this_fy rolls to FY2027 with matching dates', first.fy_end === 2027 && first.start_date === '2026-07-01' && first.end_date === '2027-06-30', first);
  // STP employer: no summaries
  t = await run('ato', am, Object.assign({}, ATO, { payment_summaries: EH.paymentSummariesStp }));
  ok('ato: STP year — explains income statements, banner N/A not red', /Single Touch Payroll \(STP\) get ATO income statements/.test(text(t.doc, '#qb-body')) && t.doc.querySelector('#qb-banner').className.includes('na'), banner(t));
  x = await xlsxText(t);
  ok('ato: Excel exports with the FY period line', /FY2026: 1 July 2025 - 30 June 2026/.test(x));

  console.log(fails ? `\n${fails}/${total} payroll checks FAILED` : `\nALL ${total} payroll checks passed`);
  process.exit(fails ? 1 : 0);
})();

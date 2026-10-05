QB.app({
  title: 'ATO Reports', primary: 'payment_summaries', prepared: 'Prepared from Employment Hero Payroll', footer: 'Employment Hero Payroll · financial year',
  mechanism: 'employment-hero-payroll connector — mySMB custom MCP on the Employment Hero Payroll (KeyPay) AU API. QuickBooks Online AU payroll runs in Employment Hero, outside the QuickBooks Accounting API',
  friendly: { needs_connection: 'Connect Employment Hero Payroll (Settings → Connections) to see this data.', connection_unavailable: 'Employment Hero Payroll is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This payroll report is not available on the connected Employment Hero Payroll connector.', tool_error: 'Employment Hero Payroll returned an error for this section.' },
  fy: { month: 7, source: 'Australian payroll year' }, country: 'AU',
  clients: function (d) { return (Array.isArray(d.businesses) ? d.businesses : []).map(function (b) { return [String(b.id), b.name || b.legalName || 'Business ' + b.id]; }); },
  clientTitle: 'The payroll businesses this Employment Hero Payroll API key can see', clientNote: '(one payroll business per report — choose it in Client)', noCompany: 'Business name (Employment Hero returned no business for this API key)',
  inputs: { client: 'business_id', persona: 'persona', display: 'display' },
  defaults: { fy_end: 2026, start_date: '2025-07-01', end_date: '2026-06-30', business_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"last_fy","a":"custom","c":"none","v":"summaries","x":""}' },
  // Financial year ending (Australian payroll year, 1 July – 30 June). p = last_fy / this_fy rolls forward on open; picking a year makes it custom.
  enums: [{ input: 'fy_end', label: 'Financial year', num: true, disp: { p: 'custom' }, options: function (inp) {
    var t = new Date(), y = t.getFullYear() + (t.getMonth() >= 6 ? 1 : 0), o = [], cur = Number(inp.fy_end);
    for (var i = y; i >= y - 6; i--) o.push([i, 'FY' + i + ' (1 Jul ' + (i - 1) + ' – 30 Jun ' + i + ')']);
    if (cur && !o.some(function (x) { return x[0] === cur; })) o.push([cur, 'FY' + cur]);
    return o; } }],
  roll: function (inp, m, d) { var t = new Date(), y = t.getFullYear() + (t.getMonth() >= 6 ? 1 : 0), want = d.p === 'this_fy' ? y : d.p === 'last_fy' ? y - 1 : null; return want && want !== Number(inp.fy_end) ? { fy_end: want } : {}; },
  derive: function (inp) { var fy = Number(inp.fy_end); return fy ? { start_date: (fy - 1) + '-07-01', end_date: fy + '-06-30' } : {}; },
  uses: { businesses: [], payment_summaries: ['fy_end', 'business_id'], stp: ['business_id'], gross_to_net: ['start_date', 'end_date', 'business_id'], payg: ['start_date', 'end_date', 'business_id'] },
  tools: { businesses: 'list_businesses (employment-hero-payroll)', payment_summaries: 'list_payment_summaries', stp: 'get_stp_registration', gross_to_net: 'get_report_gross_to_net (the financial year)', payg: 'get_report_payg (the financial year)' },
  views: [['summaries', 'Payment Summaries'], ['year', 'PAYG for the Financial Year'], ['stp', 'STP Registration']],
  render: function (c) {
    var body = c.body, h = QB.h, D = c.data, v = c.view || 'summaries', money = function (x) { return QB.money(x, c.currency, c.display); };
    var need = { summaries: 'payment_summaries', year: 'payg', stp: 'stp' }[v], NAMES = { payment_summaries: 'Payment summaries', payg: 'PAYG withholding', stp: 'STP registration' };
    if (c.errors[need]) { body.innerHTML = '<p class="qb-err">' + NAMES[need] + ' are unavailable: ' + h(c.err(need)) + '</p>'; return { checks: [{ name: NAMES[need] + ' loaded', pass: false, detail: c.err(need) }] }; }
    if (!D[need]) return {};
    var rowsOf = function (id) { return D[id] && Array.isArray(D[id].rows) ? D[id].rows : []; }, sumK = function (a, f) { return QB.sum(a.map(f)); }, dt = function (s) { return s ? String(s).slice(0, 10) : ''; };
    var lab = function (s) { return String(s == null ? '' : s).replace(/([a-z])([A-Z])/g, '$1 $2'); }, dict = function (o) { var s = 0, k; if (o && typeof o === 'object') for (k in o) if (typeof o[k] === 'number') s += o[k]; return s; };
    var fy = Number((!c.live && D.payment_summaries && D.payment_summaries.financialYearEnding) || c.inputs.fy_end), period = 'FY' + fy + ': 1 July ' + (fy - 1) + ' - 30 June ' + fy;
    var nm = function (r) { return ((r.firstName || '') + ' ' + (r.surname || '')).trim() || r.payeeName || 'Employee ' + r.employeeId; };
    var people = {}; rowsOf('payment_summaries').concat(rowsOf('gross_to_net')).forEach(function (r) { if (r.employeeId != null && !people[r.employeeId]) people[r.employeeId] = nm(r); });
    if (c.display.x && !people[c.display.x]) people[c.display.x] = 'Employee ' + c.display.x;
    var sel = c.display.x ? String(c.display.x) : '', mine = function (a) { return sel ? a.filter(function (r) { return String(r.employeeId) === sel; }) : a; };
    var keys = Object.keys(people).sort(function (a, b) { return people[a].localeCompare(people[b]); });
    var html = v === 'stp' ? '' : '<label class="ctl" style="display:inline-flex;margin-bottom:12px">Employee<select id="w-emp"><option value="">All employees</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(people[k]) + '</option>'; }).join('') + '</select></label>';
    var col = function (k, t, m) { return { key: k, title: t, money: m !== false && m !== 'n', num: m === 'n' }; };
    var checks = [], x = { view: v, title: (this.views.filter(function (w) { return w[0] === v; })[0] || ['', ''])[1], period: period }, chart = null;
    var G = c.errors.gross_to_net || !D.gross_to_net ? null : mine(rowsOf('gross_to_net')), gsum = function (k, flat) { return G ? sumK(G, function (r) { return typeof r[k] === 'number' ? r[k] : flat && typeof r[flat] === 'number' ? r[flat] : 0; }) : null; };
    var gGross = gsum('totalGrossEarnings', 'grossEarnings'), gTax = G ? QB.sum([gsum('payg'), gsum('help'), gsum('sfss')]) : null, stp = D.stp || null;
    if (v === 'summaries') {
      var PS = mine(rowsOf('payment_summaries')).map(function (r) { return { id: r.employeeId, name: r.payeeName || 'Employee ' + r.employeeId, type: lab(r.paymentSummaryType), status: lab(r.status) + (r.isAmended ? ' (amended)' : ''), period: dt(r.paymentPeriodStart) + ' to ' + dt(r.paymentPeriodEnd),
        gross: r.grossPayments, tax: r.totalTaxWithheld, allow: r.totalAllowances, resc: r.employerSuperContributions, lump: ['lumpSumA', 'lumpSumB', 'lumpSumD', 'lumpSumE'].reduce(function (s, k) { return s + (Number(r[k]) || 0); }, 0), rfb: r.fringeBenefits, union: dict(r.unionFeeDeductions) }; });
      var tg = sumK(PS, function (r) { return r.gross; }), tt = sumK(PS, function (r) { return r.tax; }), ta = sumK(PS, function (r) { return r.allow; }), tr = sumK(PS, function (r) { return r.resc; });
      if (!PS.length) html += '<div class="qb-banner na" style="margin-bottom:12px"><strong>No payment summaries for FY' + fy + '.</strong> ' + h(D.payment_summaries.note || '') + (stp && stp.singleTouchPayrollEnabled ? ' This business reports through Single Touch Payroll — see PAYG for the Financial Year for the year\'s totals.' : '') + '</div>';
      html += QB.kpis([{ label: 'Payment summaries', money: false, value: PS.length }, { label: 'Gross payments', value: tg }, { label: 'Total tax withheld', value: tt }, { label: 'Reportable employer super', value: tr }], c);
      x.cols = [col('name', 'Employee', false), col('type', 'Type', false), col('status', 'Status', false), col('period', 'Payment period', false), col('gross', 'Gross payments'), col('tax', 'Tax withheld'), col('allow', 'Allowances'), col('resc', 'Reportable employer super'), col('lump', 'Lump sums'), col('rfb', 'Reportable fringe benefits'), col('union', 'Union fees')];
      x.rows = PS; x.total = { name: 'TOTAL', gross: tg, tax: tt, allow: ta, resc: tr, lump: sumK(PS, function (r) { return r.lump; }), rfb: sumK(PS, function (r) { return r.rfb; }), union: sumK(PS, function (r) { return r.union; }) }; x.empty = 'No payment summaries for this financial year.';
      checks.push({ name: 'Tax withheld = PAYG + HELP + SFSS on Gross to Net for the year', pass: !PS.length || gTax == null ? null : Math.abs(tt - gTax) <= PS.length, detail: !PS.length ? 'No payment summaries' : gTax == null ? 'Gross to Net unavailable' : money(tt) + ' vs ' + money(gTax) + ' (whole dollars on payment summaries)' });
      checks.push({ name: 'Gross payments + allowances + reportable employer super vs gross earnings on Gross to Net', pass: null, info: true, detail: !PS.length || gGross == null ? 'N/A' : money(QB.sum([tg, ta, tr])) + ' vs ' + money(gGross) + ' (lump sums, exempt and foreign income are reported separately)' });
    } else if (v === 'year') {
      var P = rowsOf('payg'), W1 = sumK(P, function (r) { return r.grossEarnings; }), W2 = sumK(P, function (r) { return r.payg; });
      html += QB.kpis([{ label: 'Gross earnings (W1)', value: W1 }, { label: 'Amounts withheld (W2)', value: W2 }, { label: 'Net pay', value: gsum('netEarnings') }, { label: 'Super (SGC)', value: gsum('sgc') }], c);
      x.cols = [col('month', 'Month', false), col('location', 'Location', false), col('grossEarnings', 'Gross earnings (W1)'), col('preTaxDeductions', 'Pre-tax deductions'), col('taxableEarnings', 'Taxable earnings'), col('payg', 'Amounts withheld (W2)')];
      x.rows = P; x.total = { month: 'TOTAL', grossEarnings: W1, preTaxDeductions: sumK(P, function (r) { return r.preTaxDeductions; }), taxableEarnings: sumK(P, function (r) { return r.taxableEarnings; }), payg: W2 }; x.empty = 'No PAYG withholding in this financial year.';
      chart = { title: 'W1 and W2 by month', labels: P.map(function (r) { return String(r.month || '').slice(0, 3); }), series: [{ name: 'W1 gross', values: P.map(function (r) { return r.grossEarnings; }) }, { name: 'W2 withheld', values: P.map(function (r) { return r.payg; }) }] };
      checks.push({ name: 'W2 for the year = tax withheld on Gross to Net', pass: gTax == null || sel ? null : Math.abs(W2 - gTax) < 0.005 || Math.abs(W2 - gsum('payg')) < 0.005, detail: gTax == null ? 'Gross to Net unavailable' : money(W2) + ' vs PAYG + HELP + SFSS ' + money(gTax) });
      checks.push({ name: 'W1 for the year = gross earnings on Gross to Net', pass: gGross == null || sel ? null : Math.abs(W1 - gGross) < 0.005, detail: gGross == null ? 'Gross to Net unavailable' : money(W1) + ' vs ' + money(gGross) });
      if (sel) html = '<div class="qb-banner na" style="margin-bottom:12px">PAYG withholding has no employee breakdown — this table is the whole business.</div>' + html;
    } else {
      var F = [['Business name', stp.name], ['ABN', stp.abn], ['Branch', stp.branch], ['State', stp.state], ['Single Touch Payroll enabled', stp.singleTouchPayrollEnabled == null ? '' : stp.singleTouchPayrollEnabled ? 'Yes' : 'No'], ['SBR enabled', stp.sbrEnabled == null ? '' : stp.sbrEnabled ? 'Yes' : 'No'],
        ['Lodgement role', lab(stp.lodgementRole)], ['ATO integration', lab(stp.atoIntegrationOption)], ['Software provider', stp.sbrSoftwareProvider], ['Software ID', stp.sbrSoftwareId], ['Signatory', stp.signatoryName], ['Tax agent number', stp.taxAgentNumber], ['Intermediary ABN', stp.intermediaryAbn]];
      x.cols = [col('f', 'Field', false), col('v', 'Value', false)]; x.rows = F.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) { return { f: r[0], v: r[1] }; }); x.empty = 'Employment Hero returned no STP registration.';
      var pays = G ? G.length > 0 : null;
      checks.push({ name: 'Single Touch Payroll enabled for a business that pays employees', pass: stp.singleTouchPayrollEnabled ? true : pays ? false : null, detail: stp.singleTouchPayrollEnabled ? 'Enabled' : pays ? 'Not enabled, but employees were paid in FY' + fy : 'Not enabled; no pay in FY' + fy });
    }
    html += '<div id="g1"></div>' + (chart ? '<div class="qb-card" style="margin-top:16px"><h3>' + h(chart.title) + '</h3><div id="ch1"></div></div>' : '');
    body.innerHTML = html;
    var g1 = document.getElementById('g1');
    QB.grid(g1, { filter: true, columns: x.cols, rows: x.rows || [], total: x.rows && x.rows.length ? x.total : null, empty: x.empty }, c);
    if (chart) QB.bars(document.getElementById('ch1'), chart, c);
    var es = document.getElementById('w-emp'); if (es) es.addEventListener('change', function () { c.change({}, { x: es.value }); });
    this._x = x;
    return { checks: checks, title: x.title + (sel ? ' — ' + people[sel] : ''), period: period,
      notes: ['From Employment Hero Payroll. Australian QuickBooks Online payroll runs there, not in the QuickBooks Accounting API.', 'Payment summaries are in whole dollars, as the ATO requires. Employers on Single Touch Payroll get ATO income statements instead of payment summaries.', 'Pay figures are shown; tax file numbers, bank details, dates of birth, addresses and personal contact details are removed by the connector. A downloaded or shared copy carries these pay figures — share it only with people who may see payroll.'],
      na: ['Tax File Declaration Reporting (tax file numbers are removed for privacy)', 'JobKeeper Employee Nominations and JobKeeper Eligibility Report (JobKeeper ended on 28 March 2021)', 'STP lodgement history and ATO income statements (not in Employment Hero\'s API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x || !x.cols) return [];
    var L = function (i) { return String.fromCharCode(65 + i); }, rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: x.title, s: 'bold' }], [x.period], [], x.cols.map(function (k) { return { v: k.title, s: 'bold' }; })], first = rows.length + 1;
    (x.rows || []).forEach(function (r) { rows.push(x.cols.map(function (k) { var val = r[k.key]; return k.money ? (val == null ? null : { v: val, s: 'money' }) : (val == null ? '' : val); })); });
    var lastR = rows.length;
    if ((x.rows || []).length && x.total) rows.push(x.cols.map(function (k, i) { return i === 0 ? { v: 'TOTAL', s: 'bold' } : k.money ? { f: 'SUM(' + L(i) + first + ':' + L(i) + lastR + ')', s: 'moneyBold' } : null; }));
    return [{ name: x.title.slice(0, 31), widths: x.cols.map(function (k) { return k.money ? 16 : 24; }), rows: rows }];
  }
});

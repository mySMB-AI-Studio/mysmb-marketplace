// CRA-11 Activity Count (Xero): transaction counters across sales, purchases, banking, payroll and journals for a period, by
// month — how active the file has been. Payroll is AU-only in Xero (Payroll AU); a non-AU organisation shows N/A rather than
// a zero, since Xero itself has no payroll data to count there.
XK.app({
  title: 'Xero · Activity Count', noBasis: true, primary: 'invoices', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', org: '', page: 1,
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { invoices: ['from_date', 'to_date', 'org'], bank_tx: ['from_date', 'to_date', 'org'], journals: ['from_date', 'to_date', 'org'], payroll: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, bank_tx: { input: 'page', key: 'BankTransactions' }, journals: { input: 'page', key: 'ManualJournals' }, payroll: { input: 'page', key: 'PayRuns' } },
  sources: { payroll: { name: 'Payroll', optional: true, quiet: function () { return false; } } },
  tools: { invoices: 'list_invoices (sales and purchases, with lines, in the period)', bank_tx: 'list_bank_transactions (in the period)', journals: 'list_manual_journals (in the period)', payroll: 'list_pay_runs (AU organisations only)', org: 'get_organisation', connections: 'list_connections' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['invoices', 'bank_tx', 'journals'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Activity sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices) return {};
    var inP = function (d) { return d && d >= from && d <= to; };
    var n = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1, months = XK.monthsEnding(to, Math.max(1, n)).map(function (m) { return m.key; });
    var zero = function () { var o = {}; months.forEach(function (k) { o[k] = 0; }); return o; };
    var cats = { Sales: zero(), Purchases: zero(), Banking: zero(), Journals: zero() }, payrollOk = !c.errors.payroll;
    if (payrollOk) cats.Payroll = zero();
    var bump = function (cat, d) { if (!inP(d)) return; var m = d.slice(0, 7); if (cats[cat][m] != null) cats[cat][m]++; };
    c.rows('invoices').forEach(function (d) { bump(d.Type === 'ACCREC' ? 'Sales' : 'Purchases', XK.isoDate(d.DateString || d.Date)); });
    c.rows('bank_tx').forEach(function (d) { bump('Banking', XK.isoDate(d.DateString || d.Date)); });
    c.rows('journals').forEach(function (d) { bump('Journals', XK.isoDate(d.DateString || d.Date)); });
    if (payrollOk) (c.rows('payroll') || []).forEach(function (r) { var d = XK.isoDate(r.PaymentDate); bump('Payroll', d); });
    var totals = {}; Object.keys(cats).forEach(function (k) { totals[k] = XK.sum(months.map(function (m) { return cats[k][m]; })); });
    var grand = XK.sum(Object.keys(totals).map(function (k) { return totals[k]; }));
    var max = 1; Object.keys(cats).forEach(function (k) { months.forEach(function (m) { if (cats[k][m] > max) max = cats[k][m]; }); });
    var heat = function (v) { var p = Math.min(1, v / max); var bg = 'rgba(52,223,186,' + (v ? (0.12 + p * 0.55).toFixed(2) : 0) + ')'; return '<td class="num" style="background:' + bg + '">' + v + '</td>'; };
    var rowsHtml = Object.keys(cats).map(function (k) { return '<tr><td>' + XK.h(k) + '</td>' + months.map(function (m) { return heat(cats[k][m]); }).join('') + '<td class="num k-total">' + totals[k] + '</td></tr>'; }).join('');
    var footHtml = '<tr class="k-total"><td>Total</td>' + months.map(function (m) { return '<td class="num">' + XK.sum(Object.keys(cats).map(function (k) { return cats[k][m]; })) + '</td>'; }).join('') + '<td class="num">' + grand + '</td></tr>';
    body.innerHTML = XK.kpis(Object.keys(totals).map(function (k) { return { label: k, value: totals[k], money: false }; }).concat([{ label: 'Total transactions', value: grand, money: false }]), c) +
      (payrollOk ? '' : '<div class="xk-banner na" style="margin:12px 0">Payroll activity: N/A — ' + XK.h(c.err('payroll') || 'this organisation does not use Xero Payroll AU') + '</div>') +
      '<div class="xk-card" style="margin-top:16px"><h3>Transaction counts by month</h3><div class="xk-scroll"><table class="xk-grid"><thead><tr><th scope="col"></th>' + months.map(function (m) { return '<th scope="col" class="num">' + XK.h(XK.monthLabel(m)) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' + rowsHtml + '</tbody><tfoot>' + footHtml + '</tfoot></table></div></div>';
    // ---- checks
    var checksOk = Object.keys(cats).every(function (k) { return XK.near(XK.sum(months.map(function (m) { return cats[k][m]; })), totals[k], 0); });
    var trunc = ['invoices', 'bank_tx', 'journals'].concat(payrollOk ? ['payroll'] : []).filter(function (id) { return c.truncated(id); });
    var checks = [
      { name: 'Months add up to each category\'s total for the period', pass: checksOk, detail: Object.keys(totals).map(function (k) { return k + ' ' + totals[k]; }).join(', ') },
      { name: 'Categories add up to the grand total', pass: XK.near(XK.sum(Object.keys(totals).map(function (k) { return totals[k]; })), grand, 0), detail: grand + ' transaction(s)' },
      payrollOk ? { name: 'Payroll counted (Xero Payroll AU)', pass: true, detail: totals.Payroll + ' pay run(s)' } : { name: 'Payroll activity', pass: null, info: true, detail: 'N/A — ' + (c.err('payroll') || 'this organisation does not use Xero Payroll AU') },
      { name: 'All transactions in the period loaded (lists paged 100 at a time, up to 20 pages)', pass: !trunc.length, detail: trunc.length ? 'May be truncated (over 20 pages): ' + trunc.join(', ') : grand + ' transaction(s)' }
    ];
    this._x = { cats: cats, months: months, totals: totals, grand: grand };
    return { checks: checks, period: XK.periodLine(from, to),
      notes: ['Sales = Xero invoices of type ACCREC; Purchases = bills (ACCPAY); Banking = spend/receive money bank transactions; Journals = manual journals; Payroll = Xero Payroll AU pay runs, dated by payment date. Every count is dated in the period shown, independent of status (draft, authorised or paid/reconciled).'],
      na: payrollOk ? [] : ['Payroll activity (this organisation does not use Xero Payroll AU)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Activity Count', s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var cols = ['Category'].concat(x.months.map(XK.monthLabel), ['Total']).map(function (t) { return { v: t, s: 'bold' }; });
    var rows = head.concat([cols]).concat(Object.keys(x.cats).map(function (k) { return [k].concat(x.months.map(function (m) { return x.cats[k][m]; }), [x.totals[k]]); })).concat([[{ v: 'Total', s: 'bold' }].concat(x.months.map(function (m) { return XK.sum(Object.keys(x.cats).map(function (k) { return x.cats[k][m]; })); }), [{ v: x.grand, s: 'moneyBold' }])]);
    return [{ name: 'Activity count', rows: rows, widths: [14].concat(x.months.map(function () { return 10; }), [10]) }];
  }
});

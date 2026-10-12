// CRA-11 Activity Count (MYOB): transaction counters across sales, purchases, banking, payroll and journals for a period, by
// month — how active the file has been.
var CRA = MK.app({
  title: 'MYOB Activity Count', primary: 'invoices', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' },
  uses: { invoices: ['from_date', 'to_date', 'company_file'], bills: ['from_date', 'to_date', 'company_file'], bank_lines: ['from_date', 'to_date', 'company_file'], journals: ['from_date', 'to_date', 'company_file'], payroll: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { invoices: 'list_invoices (sales, in the period)', bills: 'list_bills (purchases, in the period)', bank_lines: 'list_bank_statement_lines (banking, in the period)', journals: 'list_journal_transactions (in the period)', payroll: 'list_payroll_advices (pay runs, in the period)', company_files: 'list_company_files' },
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['invoices', 'bills', 'bank_lines', 'journals'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Activity sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices) return {};
    var n = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1, months = [];
    for (var y = +from.slice(0, 4), mo = +from.slice(5, 7), i = 0; i < n; i++) { months.push(y + '-' + String(mo).padStart(2, '0')); mo++; if (mo > 12) { mo = 1; y++; } }
    var zero = function () { var o = {}; months.forEach(function (k) { o[k] = 0; }); return o; };
    var payrollOk = !c.errors.payroll;
    var cats = { Sales: zero(), Purchases: zero(), Banking: zero(), Journals: zero() }; if (payrollOk) cats.Payroll = zero();
    var bump = function (cat, d) { var m = (d || '').slice(0, 7); if (cats[cat] && cats[cat][m] != null) cats[cat][m]++; };
    MK.items(c.data.invoices).forEach(function (d) { bump('Sales', MK.isoDate(d.Date)); });
    MK.items(c.data.bills).forEach(function (d) { bump('Purchases', MK.isoDate(d.Date)); });
    MK.items(c.data.bank_lines).forEach(function (d) { bump('Banking', MK.isoDate(d.Date)); });
    MK.items(c.data.journals).forEach(function (d) { bump('Journals', MK.isoDate(d.DateOccurred || d.DatePosted)); });
    if (payrollOk) MK.items(c.data.payroll).forEach(function (d) { bump('Payroll', MK.isoDate(d.PaymentDate)); });
    var totals = {}; Object.keys(cats).forEach(function (k) { totals[k] = MK.sum(months.map(function (m) { return cats[k][m]; })); });
    var grand = MK.sum(Object.keys(totals).map(function (k) { return totals[k]; }));
    var max = 1; Object.keys(cats).forEach(function (k) { months.forEach(function (m) { if (cats[k][m] > max) max = cats[k][m]; }); });
    var mlabel = function (k) { var p = k.split('-'); return MK.MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0].slice(2); };
    var heat = function (v) { var pr = Math.min(1, v / max); var bg = 'rgba(52,223,186,' + (v ? (0.12 + pr * 0.55).toFixed(2) : 0) + ')'; return '<td class="num" style="background:' + bg + '">' + v + '</td>'; };
    var rowsHtml = Object.keys(cats).map(function (k) { return '<tr><td>' + h(k) + '</td>' + months.map(function (m) { return heat(cats[k][m]); }).join('') + '<td class="num k-total">' + totals[k] + '</td></tr>'; }).join('');
    var footHtml = '<tr class="k-total"><td>Total</td>' + months.map(function (m) { return '<td class="num">' + MK.sum(Object.keys(cats).map(function (k) { return cats[k][m]; })) + '</td>'; }).join('') + '<td class="num">' + grand + '</td></tr>';
    body.innerHTML = MK.kpis(Object.keys(totals).map(function (k) { return { label: k, value: totals[k], money: false }; }).concat([{ label: 'Total transactions', value: grand, money: false }]), c) +
      (payrollOk ? '' : '<div class="mk-banner na" style="margin:12px 0">Payroll activity: N/A — ' + h(c.err('payroll') || 'no pay runs in this company file') + '</div>') +
      '<div class="mk-card" style="margin-top:16px"><h3>Transaction counts by month</h3><div class="mk-scroll"><table class="mk-grid"><thead><tr><th scope="col"></th>' + months.map(function (m) { return '<th scope="col" class="num">' + h(mlabel(m)) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' + rowsHtml + '</tbody><tfoot>' + footHtml + '</tfoot></table></div></div>';
    var checksOk = Object.keys(cats).every(function (k) { return MK.near(MK.sum(months.map(function (m) { return cats[k][m]; })), totals[k], 0); });
    var checks = [
      { name: 'Months add up to each category\'s total for the period', pass: checksOk, detail: Object.keys(totals).map(function (k) { return k + ' ' + totals[k]; }).join(', ') },
      { name: 'Categories add up to the grand total', pass: MK.near(MK.sum(Object.keys(totals).map(function (k) { return totals[k]; })), grand, 0), detail: grand + ' transaction(s)' },
      payrollOk ? { name: 'Payroll counted (pay advices)', pass: true, detail: totals.Payroll + ' pay advice(s)' } : { name: 'Payroll activity', pass: null, info: true, detail: 'N/A — ' + (c.err('payroll') || 'no pay runs in this company file') }
    ];
    this._x = { cats: cats, months: months, totals: totals, grand: grand, mlabel: mlabel };
    return { checks: checks, period: MK.periodLine(from, to),
      notes: ['Sales = list_invoices; Purchases = list_bills; Banking = list_bank_statement_lines; Journals = list_journal_transactions; Payroll = list_payroll_advices, dated by payment date. Every count is dated in the period shown, independent of status.'],
      na: payrollOk ? [] : ['Payroll activity (no pay runs in this company file)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Activity Count', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: N/A (transaction counts, not $ figures)'], []];
    var cols = ['Category'].concat(x.months.map(x.mlabel), ['Total']).map(function (t) { return { v: t, s: 'bold' }; });
    var rows = head.concat([cols]).concat(Object.keys(x.cats).map(function (k) { return [k].concat(x.months.map(function (m) { return x.cats[k][m]; }), [x.totals[k]]); })).concat([[{ v: 'Total', s: 'bold' }].concat(x.months.map(function (m) { return MK.sum(Object.keys(x.cats).map(function (k) { return x.cats[k][m]; })); }), [{ v: x.grand, s: 'moneyBold' }])]);
    return [{ name: 'Activity count', rows: rows, widths: [14].concat(x.months.map(function () { return 10; }), [10]) }];
  }
});

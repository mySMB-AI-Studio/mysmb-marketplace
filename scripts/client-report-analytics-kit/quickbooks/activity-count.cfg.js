// CRA-11 Activity Count — QuickBooks Online: transaction counters across sales, purchases, banking and journals for a period,
// by month. Every list is fetched with the period's WHERE clause (txn_where, derived from the dates) and MAXRESULTS 1000, and a
// list that comes back at the cap is a failed check, never a silent undercount. Payroll reads "N/A — not in source": QuickBooks
// payroll here is the separate Employment Hero Payroll connector, out of scope for this report.
// (Corrected 2026-10-13: the first version ran an unfiltered "SELECT * FROM <entity>" with no MAXRESULTS — QuickBooks returns
// 100 rows by default, so any company with over 100 documents ever was silently undercounted — and wrongly said this connector
// has no journal-entry list; list_journal_entry exists.)
QB.app({
  title: 'QuickBooks · Activity Count', token: null, primary: 'invoices', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', txn_where: "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'", persona: 'Practitioner',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  uses: { invoices: ['txn_where'], bills: ['txn_where'], purchases: ['txn_where'], payments: ['txn_where'], bill_payments: ['txn_where'], journal_entries: ['txn_where'], company_info: [], prefs: [] },
  derive: function (inp) { return { txn_where: "TxnDate >= '" + inp.start_date + "' AND TxnDate <= '" + inp.end_date + "'" }; },
  tools: { invoices: 'list_invoice (in the period)', bills: 'list_bill (in the period)', purchases: 'list_purchase (in the period)', payments: 'list_payment (in the period)', bill_payments: 'list_bill_payment (in the period)', journal_entries: 'list_journal_entry (in the period)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body, from = c.inputs.start_date, to = c.inputs.end_date;
    var need = ['invoices', 'bills', 'purchases', 'payments', 'bill_payments', 'journal_entries'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Activity sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices) return {};
    var n = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7)) + 1, months = [];
    for (var y = +from.slice(0, 4), mo = +from.slice(5, 7), i = 0; i < n; i++) { months.push(y + '-' + String(mo).padStart(2, '0')); mo++; if (mo > 12) { mo = 1; y++; } }
    var zero = function () { var o = {}; months.forEach(function (k) { o[k] = 0; }); return o; };
    var cats = { Sales: zero(), Purchases: zero(), Banking: zero(), Journals: zero() }, CAP = 1000, trunc = [];
    var bump = function (cat, d) { var m = (d || '').slice(0, 7); if (cats[cat] && cats[cat][m] != null) cats[cat][m]++; };
    var inP = function (d) { return d && d >= from && d <= to; };
    var rowsOf = function (resp, key, id) { var r = (((resp || {}).QueryResponse || {})[key] || []); if (r.length >= CAP) trunc.push(id); return r; };
    rowsOf(c.data.invoices, 'Invoice', 'invoices').forEach(function (d) { if (inP(d.TxnDate)) bump('Sales', d.TxnDate); });
    rowsOf(c.data.bills, 'Bill', 'bills').forEach(function (d) { if (inP(d.TxnDate)) bump('Purchases', d.TxnDate); });
    rowsOf(c.data.purchases, 'Purchase', 'purchases').forEach(function (d) { if (inP(d.TxnDate)) bump('Banking', d.TxnDate); });
    rowsOf(c.data.payments, 'Payment', 'payments').forEach(function (d) { if (inP(d.TxnDate)) bump('Banking', d.TxnDate); });
    rowsOf(c.data.bill_payments, 'BillPayment', 'bill_payments').forEach(function (d) { if (inP(d.TxnDate)) bump('Banking', d.TxnDate); });
    rowsOf(c.data.journal_entries, 'JournalEntry', 'journal_entries').forEach(function (d) { if (inP(d.TxnDate)) bump('Journals', d.TxnDate); });
    var totals = {}; Object.keys(cats).forEach(function (k) { totals[k] = QB.sum(months.map(function (m) { return cats[k][m]; })); });
    var grand = QB.sum(Object.keys(totals).map(function (k) { return totals[k]; }));
    var max = 1; Object.keys(cats).forEach(function (k) { months.forEach(function (m) { if (cats[k][m] > max) max = cats[k][m]; }); });
    var mlabel = function (k) { var p = k.split('-'); return QB.MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0].slice(2); };
    var heat = function (v) { var pr = Math.min(1, v / max); var bg = 'rgba(52,223,186,' + (v ? (0.12 + pr * 0.55).toFixed(2) : 0) + ')'; return '<td class="num" style="background:' + bg + '">' + v + '</td>'; };
    var rowsHtml = Object.keys(cats).map(function (k) { return '<tr><td>' + QB.h(k) + '</td>' + months.map(function (m) { return heat(cats[k][m]); }).join('') + '<td class="num k-total">' + totals[k] + '</td></tr>'; }).join('') + '<tr><td>Payroll</td>' + months.map(function () { return '<td class="num">N/A</td>'; }).join('') + '<td class="num">N/A</td></tr>';
    var footHtml = '<tr class="k-total"><td>Total</td>' + months.map(function (m) { return '<td class="num">' + QB.sum(Object.keys(cats).map(function (k) { return cats[k][m]; })) + '</td>'; }).join('') + '<td class="num">' + grand + '</td></tr>';
    body.innerHTML = QB.kpis(Object.keys(totals).map(function (k) { return { label: k, value: totals[k], money: false }; }).concat([{ label: 'Total transactions', value: grand, money: false }]), c) +
      '<div class="qb-banner na" style="margin:12px 0">Payroll: N/A — not in source (QuickBooks payroll is the separate Employment Hero Payroll connector, out of scope here)</div>' +
      '<div class="qb-card" style="margin-top:16px"><h3>Transaction counts by month</h3><div class="qb-scroll"><table class="qb-grid"><thead><tr><th scope="col"></th>' + months.map(function (m) { return '<th scope="col" class="num">' + QB.h(mlabel(m)) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' + rowsHtml + '</tbody><tfoot>' + footHtml + '</tfoot></table></div></div>';
    var checksOk = Object.keys(cats).every(function (k) { return QB.near(QB.sum(months.map(function (m) { return cats[k][m]; })), totals[k], 0); });
    var checks = [
      { name: 'Months add up to each category\'s total for the period', pass: checksOk, detail: Object.keys(totals).map(function (k) { return k + ' ' + totals[k]; }).join(', ') },
      { name: 'Categories add up to the grand total', pass: QB.near(QB.sum(Object.keys(totals).map(function (k) { return totals[k]; })), grand, 0), detail: grand + ' transaction(s)' },
      { name: 'Every transaction loaded (no list at the ' + CAP + '-row cap)', pass: !trunc.length, detail: trunc.length ? 'Possibly truncated at ' + CAP + ' rows: ' + trunc.join(', ') + ' — shorten the period' : grand + ' transaction(s)' },
      { name: 'Payroll activity', pass: null, info: true, detail: 'N/A — not in source: QuickBooks payroll is the separate Employment Hero Payroll connector, out of scope here' }
    ];
    this._x = { cats: cats, months: months, totals: totals, grand: grand, mlabel: mlabel };
    return { checks: checks, period: QB.periodLine(from, to),
      notes: ['Sales = Invoice; Purchases = Bill; Banking = Purchase (card/cheque/cash expenses) + Payment (customer receipts) + BillPayment (supplier payments); Journals = JournalEntry. Every count is dated in the period shown by TxnDate.'],
      na: ['Payroll (QuickBooks payroll is a separate Employment Hero Payroll connector, out of scope here)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Activity Count', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []];
    var cols = ['Category'].concat(x.months.map(x.mlabel), ['Total']).map(function (t) { return { v: t, s: 'bold' }; });
    var rows = head.concat([cols]).concat(Object.keys(x.cats).map(function (k) { return [k].concat(x.months.map(function (m) { return x.cats[k][m]; }), [x.totals[k]]); })).concat([[{ v: 'Total', s: 'bold' }].concat(x.months.map(function (m) { return QB.sum(Object.keys(x.cats).map(function (k) { return x.cats[k][m]; })); }), [{ v: x.grand, s: 'moneyBold' }])]);
    return [{ name: 'Activity count', rows: rows, widths: [14].concat(x.months.map(function () { return 10; }), [10]) }];
  }
});

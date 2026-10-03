MK.app({
  title: 'Aged receivables', primary: 'bs', files: 'company_files',
  // no as-at control: MYOB's API gives today's open balances, so the report is always as at today (as_at feeds the Balance Sheet tie)
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', method: 'Due date', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"customers"}' },
  uses: { invoices: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { invoices: 'list_invoices (open sales invoices — every page)', bs: 'get_balance_sheet (the receivables account today, for the tie)', accounts: 'list_accounts (which accounts are receivables)', company_files: 'list_company_files' },
  enums: [{ input: 'method', label: 'Ageing method', options: [['Invoice date', 'Days since invoice date'], ['Due date', 'Days since due date']] }],
  roll: function () { return { as_at: MK.asAt('today') }; }, // MYOB's API gives today's open balances, so the report is always as at today
  views: [['customers', 'By customer'], ['invoices', 'Invoices']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, asAt = c.inputs.as_at, byDue = c.inputs.method === 'Due date';
    if (c.errors.invoices) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('invoices')) + '</p>'; return { checks: [{ name: 'Open invoices loaded', pass: false, detail: c.err('invoices') }] }; }
    if (!c.data.invoices) return {};
    var days = function (a) { return Math.round((MK.parse(asAt) - MK.parse(a)) / 86400000); };
    var COLS = byDue ? ['Not due', '1 - 30', '31 - 60', '61 - 90', '90+'] : ['0 - 30', '31 - 60', '61 - 90', '90+'];
    var bucket = function (d) { return byDue ? (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4) : (d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3); };
    var inv = MK.items(c.data.invoices).filter(function (i) { return i && (MK.num(i.BalanceDueAmount) || 0) !== 0; }).map(function (i) {
      var date = MK.isoDate(i.Date), due = MK.isoDate((i.Terms || {}).DueDate) || date, cu = i.Customer || {}, bal = MK.num(i.BalanceDueAmount) || 0, tot = MK.num(i.TotalAmount) || 0;
      var age = days(byDue ? due : date); return { number: i.Number || '', date: date, due: due, customer: cu.Name || '(no customer)', cid: cu.UID || cu.Name || '', cno: cu.DisplayID || '', balance: r2(bal), total: tot, tax: tot ? r2(bal * (MK.num(i.TotalTax) || 0) / tot) : 0, age: age, b: bucket(age), noDue: !(i.Terms || {}).DueDate }; });
    var byC = {}; inv.forEach(function (x) { var k = x.cid; if (!byC[k]) byC[k] = { name: x.customer, no: x.cno, b: COLS.map(function () { return 0; }), total: 0, n: 0 }; var y = byC[k]; y.b[x.b] = r2(y.b[x.b] + x.balance); y.total = r2(y.total + x.balance); y.n++; });
    var cust = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var tot = COLS.map(function (_, j) { return MK.sum(cust.map(function (x) { return x.b[j]; })); }), all = MK.sum(inv.map(function (x) { return x.balance; }));
    // the receivables account(s) on the Balance Sheet: Type AccountReceivable in the chart of accounts
    var idx = MK.accounts(c.data.accounts), bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null;
    var arRows = bsB ? bsB.rows.filter(function (r) { return !r.header && (r.type === 'AccountReceivable' || (!idx.loaded && /receivable|debtors/i.test(r.name))); }) : [], control = arRows.length ? MK.sum(arRows.map(function (r) { return r.values[0]; })) : null;
    var view = c.view || 'customers', colObjs = COLS.map(function (t, j) { return { key: 'b' + j, title: t, money: true }; });
    body.innerHTML = MK.kpis([{ label: 'Total due', value: all }, { label: 'Customers', value: cust.length, money: false }, { label: 'Invoices', value: inv.length, money: false }, { label: COLS[COLS.length - 1] + ' days', value: tot[COLS.length - 1] }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>Unpaid invoices — ' + MK.asOfLine(asAt).replace(/^As at /, '') + ' · ' + (byDue ? 'days since due date' : 'days since invoice date') + '</h3><div id="ar-grid"></div></div>' +
      '<div class="mk-card detail-block" style="margin-top:16px"><h3>Ageing</h3><div id="ar-chart"></div></div>';
    if (view === 'invoices') MK.grid(document.getElementById('ar-grid'), { rows: inv.map(function (x) { return Object.assign({}, x, { bucketT: COLS[x.b] }); }).sort(function (a, b) { return b.age - a.age; }), filter: true,
      columns: [{ key: 'customer', title: 'Customer name' }, { key: 'number', title: 'Invoice no.' }, { key: 'date', title: 'Date' }, { key: 'due', title: 'Due date' }, { key: 'age', title: 'Days', num: true }, { key: 'bucketT', title: 'Age' }, { key: 'balance', title: 'Total due ($)', money: true }],
      total: { customer: 'Total', balance: all }, empty: 'No unpaid invoices.' }, c);
    else MK.grid(document.getElementById('ar-grid'), { rows: cust.map(function (x) { var o = { name: x.name, no: x.no, total: x.total }; x.b.forEach(function (v, j) { o['b' + j] = v; }); return o; }), filter: true,
      columns: [{ key: 'name', title: 'Customer name' }, { key: 'no', title: 'Customer number' }].concat(colObjs).concat([{ key: 'total', title: 'Total due ($)', money: true }]),
      total: (function () { var o = { name: 'Total', total: all }; tot.forEach(function (v, j) { o['b' + j] = v; }); return o; })(), empty: 'No unpaid invoices.' }, c);
    MK.bars(document.getElementById('ar-chart'), { title: 'Total due by age', labels: COLS, series: [{ name: 'Total due', values: tot }] }, c);
    var rowBad = cust.filter(function (x) { return !MK.near(MK.sum(x.b), x.total); });
    var checks = [
      { name: 'Each customer\'s total due = Σ its age buckets, and the report total = Σ the invoices', pass: rowBad.length === 0 && MK.near(MK.sum(tot), all), detail: rowBad.length ? rowBad.length + ' customer(s) differ' : money(all) + ' over ' + inv.length + ' invoice(s)' },
      control == null ? { name: 'Total due = the receivables account on the Balance Sheet', pass: null, detail: c.err('bs') || 'N/A — no receivables account found in the chart of accounts' }
        : { name: 'Total due = the receivables account on the Balance Sheet (' + arRows.map(function (r) { return r.code || r.name; }).join(', ') + ')', pass: MK.near(all, control), detail: money(all) + ' vs ' + money(control) + (MK.near(all, control) ? '' : ' — out of balance ' + money(r2(all - control)) + ': see Receivables reconciliation') },
      { name: 'Every unpaid invoice has a customer' + (byDue ? ' and a due date' : ''), pass: inv.every(function (x) { return x.cid && (!byDue || !x.noDue); }), detail: inv.filter(function (x) { return !x.cid || (byDue && x.noDue); }).length + ' without' }
    ];
    this._x = { cust: cust, inv: inv, COLS: COLS, tot: tot, all: all };
    return { checks: checks, notes: ['Open sales invoices with their balance due today, aged by ' + (byDue ? 'days since the due date (not yet due in its own column)' : 'days since the invoice date (MYOB\'s default)') + '. Tax outstanding on a part-paid invoice is pro rata.'],
      na: ['Unpaid invoices as at an earlier date (MYOB\'s API gives today\'s open balances)'], period: MK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Unpaid invoices', s: 'bold' }], [MK.asOfLine(c.inputs.as_at) + ' · ' + (c.inputs.method === 'Due date' ? 'days since due date' : 'days since invoice date')], [],
      ['Customer name', 'Customer number'].concat(x.COLS).concat(['Total due ($)']).map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.cust.map(function (r) { return [r.name, r.no].concat(r.b.map(function (v) { return { v: v, s: 'money' }; })).concat([{ v: r.total, s: 'money' }]); }))
      .concat([[{ v: 'Total', s: 'bold' }, ''].concat(x.tot.map(function (v) { return { v: v, s: 'moneyBold' }; })).concat([{ v: x.all, s: 'moneyBold' }])]);
    var inv = [[{ v: 'Customer name', s: 'bold' }, { v: 'Invoice no.', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Days', s: 'bold' }, { v: 'Total due ($)', s: 'bold' }]].concat(x.inv.map(function (r) { return [r.customer, r.number, r.date, r.due, r.age, { v: r.balance, s: 'money' }]; }));
    return [{ name: 'Unpaid invoices', rows: rows, widths: [32, 16, 14, 14, 14, 14, 14, 16] }, { name: 'Invoices', rows: inv, widths: [32, 14, 12, 12, 8, 16] }];
  }
});

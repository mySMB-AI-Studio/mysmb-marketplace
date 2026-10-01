XK.app({
  title: '__TITLE__', primary: 'invoices', dated: ['bs'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { asAt: 'as_at', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-30', org: '', page: 1, persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_this_month","c":"none","v":"","o":"by=due;n=4;len=m;g=none"}' },
  uses: { invoices: ['org'], credit_notes: ['org'], overpayments: ['org'], prepayments: ['org'], bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, overpayments: { input: 'page', key: 'Overpayments' }, prepayments: { input: 'page', key: 'Prepayments' } },
  tools: { invoices: 'list_invoices (__DOCS__, awaiting payment)', credit_notes: 'list_credit_notes (unallocated)', overpayments: 'list_overpayments (unallocated)', prepayments: 'list_prepayments (unallocated)', bs: 'get_balance_sheet (__BSNAME__ at the as-at date)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_this_month', 'End of this month'], ['today', 'Today'], ['end_last_month', 'End of last month'], ['custom', 'Custom']],
  options: [{ id: 'by', label: 'Ageing by', options: [['due', 'Due date'], ['inv', 'Invoice date']], def: 'due' },
    { id: 'n', label: 'Ageing periods', options: [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], def: '4' },
    { id: 'len', label: 'Period of', options: [['m', '1 month'], ['30', '30 days'], ['14', '14 days'], ['7', '7 days']], def: 'm' },
    { id: 'g', label: 'Group by', options: [['none', 'None'], ['type', 'Document type']], def: 'none' }],
  render: function (c) {
    var K = { inv: '__INV__', cn: '__CN__', op: '__OP__', pp: '__PP__', who: '__WHO__', owing: '__OWING__', total: '__TOTAL__', bs: /^__BSNAME__$/i, bsName: '__BSNAME__', docs: '__DOCS__' };
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, asAt = c.inputs.as_at;
    if (c.errors.invoices) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('invoices')) + '</p>'; return { checks: [{ name: K.docs + ' loaded', pass: false, detail: c.err('invoices') }] }; }
    if (!c.data.invoices) return {};
    var by = c.opt('by') === 'inv' ? 'inv' : 'due', n = Math.max(1, Math.min(12, +c.opt('n') || 4)), len = c.opt('len') || 'm', grp = c.opt('g') === 'type', cur0 = by === 'due';
    // Open documents at the as-at date in base currency (credit notes, overpayments and prepayments negative, as in Xero).
    var base = c.currency, docs = XK.openDocs({ invoices: c.rows('invoices'), credit_notes: c.rows('credit_notes'), overpayments: c.rows('overpayments'), prepayments: c.rows('prepayments'),
      types: { invoices: K.inv, credit_notes: K.cn, overpayments: K.op, prepayments: K.pp } }, base, asAt);
    var ag = XK.ageingCols(asAt, by, n, len), cols = ag.cols, A = XK.parse(asAt), m = len === 'm', L = +len;
    var zero = function () { return cols.map(function () { return 0; }); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var agg = function (list) { return XK.byContact(list, ag); };
    var contacts = agg(docs), tot = zero(); contacts.forEach(function (x) { x.b.forEach(function (v, j) { tot[j] = r2(tot[j] + v); }); });
    var grand = XK.sum(contacts.map(function (x) { return x.total; })), docSum = XK.sum(docs.map(function (d) { return d.amount; }));
    var showCur = cur0 && contacts.some(function (x) { return Math.abs(x.b[0]) >= 0.005; }), vis = cols.filter(function (col, j) { return j > 0 || !cur0 || showCur; });
    var cell = function (v, r) { return r.pctRow ? (v == null ? '' : XK.pct(v, 2)) : money(v); };
    var link = function (b) { return function (v, r) { var t = cell(v, r); return r.isTotal || !v || Math.abs(v) < 0.005 ? XK.h(t) : '<a href="#" class="xk-drill" data-c="' + XK.h(r.cid) + '" data-b="' + XK.h(b) + '" title="' + XK.h(r.name + (b ? ' · ' + b : '')) + '">' + XK.h(t) + '</a>'; }; };
    var gridSpec = function (list, totalLabel) {
      var t = zero(); list.forEach(function (x) { x.b.forEach(function (v, j) { t[j] = r2(t[j] + v); }); });
      var gt = XK.sum(list.map(function (x) { return x.total; })), row = function (x) { var o = { name: x.name, cid: x.cid, total: x.total }; cols.forEach(function (col, j) { o[col.key] = x.b[j]; }); return o; };
      var totalRow = { name: totalLabel || 'Total', total: gt, isTotal: true }, pctRow = { name: 'Percentage of total', pctRow: true, isTotal: true, total: gt ? 1 : null };
      cols.forEach(function (col, j) { totalRow[col.key] = t[j]; pctRow[col.key] = gt ? t[j] / gt : null; });
      return { rows: list.map(row), foot: [totalRow, pctRow], filter: true, empty: 'No open ' + K.docs + ' at this date.',
        columns: [{ key: 'name', title: 'Contact', html: true, fmt: function (v, r) { return r.isTotal ? XK.h(v) : '<a href="#" class="xk-drill" data-c="' + XK.h(r.cid) + '">' + XK.h(v) + '</a>'; } }]
          .concat(vis.map(function (col) { return { key: col.key, title: col.title, num: true, html: true, fmt: link(col.title) }; })).concat([{ key: 'total', title: 'Total', num: true, html: true, fmt: link('') }]) };
    };
    var overdue = cur0 ? r2(grand - tot[0]) : null, owing = contacts.filter(function (x) { return x.total > 0.005; }).length;
    var groups = grp ? ['Invoice', 'Credit note', 'Overpayment', 'Prepayment'].filter(function (t) { return docs.some(function (d) { return d.kind === t; }); }) : [];
    body.innerHTML = XK.kpis([{ label: K.total, value: grand }, { label: 'Not yet due', value: cur0 ? tot[0] : null, text: cur0 ? null : '—' }, { label: 'Overdue', value: overdue, text: cur0 ? null : '—', red: overdue > 0.005 }, { label: K.owing, value: owing, money: false }], c) +
      (grp ? groups.map(function (t, gi) { return '<div class="xk-card" style="margin-top:12px"><h3>' + XK.h(t === 'Invoice' ? K.docs.charAt(0).toUpperCase() + K.docs.slice(1) : t + 's') + '</h3><div id="ag-g' + gi + '"></div></div>'; }).join('') + '<div class="xk-card" style="margin-top:12px"><h3>All documents</h3><div id="ag-all"></div></div>'
        : '<div id="ag-all" style="margin-top:12px"></div>') +
      '<div id="ag-drill" class="detail-block"></div>' +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Ageing</h3><div id="ch1"></div></div>';
    groups.forEach(function (t, gi) { XK.grid(document.getElementById('ag-g' + gi), gridSpec(agg(docs.filter(function (d) { return d.kind === t; })), 'Total ' + t.toLowerCase() + 's'), c); });
    XK.grid(document.getElementById('ag-all'), gridSpec(contacts, 'Total'), c);
    XK.bars(document.getElementById('ch1'), { title: 'Ageing', labels: vis.map(function (col) { return col.title; }), series: [{ name: XK.asOfLine(asAt), values: vis.map(function (col) { return tot[cols.indexOf(col)]; }) }] }, c);
    // Drill-down: a contact's open documents (click the name).
    var drill = function () {
      var el = document.getElementById('ag-drill'), x = contacts.filter(function (y) { return y.cid === self._sel; })[0]; if (!el) return;
      if (!x) { el.innerHTML = ''; return; }
      var bk = self._bucket || '', list = x.docs.filter(function (d) { return !bk || d.bucket === bk; });
      el.innerHTML = '<div class="xk-card" style="margin-top:12px"><h3>' + XK.h(x.name) + ' — open documents' + (bk ? ' · ' + XK.h(bk) : '') + '</h3><div id="ag-docs"></div></div>';
      XK.grid(document.getElementById('ag-docs'), { filter: true, rows: list.map(function (d) { return { type: d.kind, number: d.number, date: d.date, due: d.due, days: d.due && d.due < asAt ? Math.round((A - XK.parse(d.due)) / 86400000) : 0, bucket: d.bucket, amount: d.amount, cur: d.cur }; }),
        columns: [{ key: 'type', title: 'Type' }, { key: 'number', title: 'Number' }, { key: 'date', title: 'Date' }, { key: 'due', title: 'Due date' }, { key: 'days', title: 'Days overdue', num: true }, { key: 'bucket', title: 'Ageing' }, { key: 'amount', title: 'Amount (' + base + ')', money: true }, { key: 'cur', title: 'Currency' }] }, c);
    };
    if (!body.__agDrill) { body.__agDrill = true; body.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('.xk-drill'); if (!a) return; e.preventDefault(); var cid = a.getAttribute('data-c'), b = a.getAttribute('data-b') || ''; if (self._sel === cid && (self._bucket || '') === b) { self._sel = null; self._bucket = ''; } else { self._sel = cid; self._bucket = b; } self._drill && self._drill(); }); }
    this._drill = drill; drill();

    // Checks. Contact totals are summed from the documents and compared with their buckets; the grand total is re-summed from
    // the documents; the independent tie is Xero's Balance Sheet (a separate report) at the as-at date.
    var past = asAt < c.today, fxDocs = docs.filter(function (d) { return d.fx; }).length;
    var ids = ['invoices', 'credit_notes', 'overpayments', 'prepayments'], failed = ids.filter(function (id) { return c.errors[id]; }), cut = ids.filter(function (id) { return c.truncated(id); });
    var bsRow = c.data.bs ? XK.find(XK.walk(c.data.bs).lines, null, K.bs, 'row') : null, bsv = bsRow ? XK.val(bsRow) : null, diff = bsv == null ? null : r2(grand - bsv);
    var pctSum = grand ? vis.reduce(function (a, col) { return a + tot[cols.indexOf(col)] / grand; }, 0) : null;
    var checks = [
      { name: 'Every ' + K.who.toLowerCase() + ' total = Σ its ageing buckets', pass: contacts.length ? contacts.every(function (x) { return XK.near(x.total, XK.sum(x.b)); }) : null, detail: contacts.length + ' ' + K.who.toLowerCase() + (contacts.length === 1 ? '' : 's') },
      { name: 'Total = Σ ' + K.who.toLowerCase() + ' totals = Σ open documents', pass: XK.near(grand, docSum) && XK.near(grand, XK.sum(tot)), detail: money(grand) + ' — ' + docs.length + ' document' + (docs.length === 1 ? '' : 's') },
      { name: 'Percentage of total sums to 100%', pass: pctSum == null ? null : Math.abs(pctSum - 1) < 0.0005, detail: pctSum == null ? 'Nothing outstanding' : XK.pct(pctSum) },
      { name: 'All open documents loaded', pass: failed.length ? false : cut.length ? false : true, detail: failed.length ? 'Not loaded: ' + failed.map(function (id) { return c.err(id); }).join('; ') : cut.length ? 'May be truncated: ' + cut.join(', ') + (c.pageError(cut[0]) ? ' (' + c.pageError(cut[0]) + ')' : ' — over 20 pages') : docs.length + ' document(s)' },
      c.errors.bs ? { name: 'Total = ' + K.bsName + ' on the Balance Sheet', pass: null, detail: c.err('bs') }
        : bsv == null ? { name: 'Total = ' + K.bsName + ' on the Balance Sheet', pass: null, detail: 'No ' + K.bsName + ' line on the Balance Sheet' }
        : past ? { name: 'Total vs ' + K.bsName + ' on the Balance Sheet (information)', pass: null, info: true, detail: money(grand) + ' vs ' + money(bsv) + ' — a past as-at date uses today\'s open balances, so these can differ' }
        : XK.near(grand, bsv) ? { name: 'Total = ' + K.bsName + ' on the Balance Sheet at ' + asAt, pass: true, detail: money(grand) + ' vs ' + money(bsv) }
        : fxDocs ? { name: 'Total vs ' + K.bsName + ' on the Balance Sheet (information)', pass: null, info: true, detail: 'Difference ' + money(diff) + ' — ' + fxDocs + ' foreign-currency document(s) are converted at their own rates; Xero revalues them on the Balance Sheet' }
        : { name: 'Total = ' + K.bsName + ' on the Balance Sheet at ' + asAt, pass: false, detail: money(grand) + ' vs ' + money(bsv) + ' — difference ' + money(diff) + ' (e.g. a manual journal to ' + K.bsName + ')' }
    ];
    if (past) checks.push({ name: 'Ageing as at a past date', pass: null, detail: 'Xero lists today\'s open balances: documents paid between ' + asAt + ' and today are not included — use Today or a later date' });
    var notes = ['Includes unallocated credit notes, overpayments and prepayments as negative amounts, as Xero does.'];
    if (fxDocs) notes.push(fxDocs + ' foreign-currency document(s) converted to ' + base + ' at each document\'s own rate.');
    notes.push('Ageing ' + (cur0 ? 'by due date' : 'by invoice date') + ' in ' + n + ' periods of ' + (m ? '1 month (calendar months)' : L + ' days') + '.');
    this._x = { cols: vis.map(function (col) { return { title: col.title, j: cols.indexOf(col) }; }), contacts: contacts, tot: tot, grand: grand, docs: docs };
    return { checks: checks, notes: notes, na: [], period: XK.asOfLine(asAt) + ' · Ageing by ' + (cur0 ? 'due date' : 'invoice date') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: '__TITLE__', s: 'bold' }], [XK.asOfLine(c.inputs.as_at) + ' · Ageing by ' + (c.opt('by') === 'inv' ? 'invoice date' : 'due date')], [], [{ v: 'Contact', s: 'bold' }].concat(x.cols.map(function (col) { return { v: col.title, s: 'bold' }; })).concat([{ v: 'Total', s: 'bold' }])];
    var rows = head.concat(x.contacts.map(function (k) { return [k.name].concat(x.cols.map(function (col) { return { v: k.b[col.j], s: 'money' }; })).concat([{ v: k.total, s: 'money' }]); }));
    rows.push([{ v: 'Total', s: 'bold' }].concat(x.cols.map(function (col) { return { v: x.tot[col.j], s: 'moneyBold' }; })).concat([{ v: x.grand, s: 'moneyBold' }]));
    rows.push([{ v: 'Percentage of total', s: 'bold' }].concat(x.cols.map(function (col) { return x.grand ? { v: x.tot[col.j] / x.grand, s: 'pct' } : null; })).concat([x.grand ? { v: 1, s: 'pct' } : null]));
    rows.push([], [{ v: XK.footerStamp(null, c.fetchedAt, c.currency), s: 'muted' }]);
    var docs = [[{ v: 'Contact', s: 'bold' }, { v: 'Type', s: 'bold' }, { v: 'Number', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Ageing', s: 'bold' }, { v: 'Amount', s: 'bold' }, { v: 'Currency', s: 'bold' }]]
      .concat(x.docs.map(function (d) { return [d.contact, d.kind, d.number, d.date, d.due, d.bucket, { v: d.amount, s: 'money' }, d.cur]; }));
    return [{ name: '__TITLE__', rows: rows, widths: [36].concat(x.cols.map(function () { return 14; })).concat([16]) }, { name: 'Documents', rows: docs, widths: [32, 14, 14, 12, 12, 12, 16, 10] }];
  }
});

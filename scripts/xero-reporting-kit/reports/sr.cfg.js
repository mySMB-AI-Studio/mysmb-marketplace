XK.app({
  title: 'Sales register', basisLabel: 'Accrual (invoice)', primary: 'pnl', org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', inv_where: 'Type=="ACCREC" AND Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,25)', cn_where: 'Type=="ACCRECCREDIT" AND Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,25)', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"register"}' },
  uses: { invoices: ['inv_where', 'org'], credit_notes: ['cn_where', 'org'], pnl: ['from_date', 'to_date', 'org'], accounts: ['org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' } },
  tools: { invoices: 'list_invoices (sales invoices dated in the period, approved or paid)', credit_notes: 'list_credit_notes (sales credit notes dated in the period)', pnl: 'get_profit_and_loss (Total Income, for the tie)', accounts: 'list_accounts (which lines are income)', org: 'get_organisation', connections: 'list_connections' },
  views: [['register', 'Register'], ['customers', 'By customer']],
  derive: function (inp) { return { inv_where: XK.dateWhere('Date', inp.from_date, inp.to_date, 'Type=="ACCREC"'), cn_where: XK.dateWhere('Date', inp.from_date, inp.to_date, 'Type=="ACCRECCREDIT"') }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, base = c.currency, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.invoices) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('invoices')) + '</p>'; return { checks: [{ name: 'Sales invoices loaded', pass: false, detail: c.err('invoices') }] }; }
    if (!c.data.invoices) return {};
    var today = c.today, rate = function (d) { return d.CurrencyCode && d.CurrencyCode !== base ? (XK.num(d.CurrencyRate) || 1) : 1; };
    var inPeriod = function (d) { return d.date >= from && d.date <= to; };
    // one row per document, in the base currency; credit notes negative
    var row = function (d, kind) { var x = XK.doc(d, kind, base), f = rate(d), sg = kind === 'Invoice' ? 1 : -1;
      return { kind: kind === 'Invoice' ? 'Invoice' : 'Credit note', number: x.number, date: x.date, due: kind === 'Invoice' ? x.due : '', customer: x.contact, cid: x.cid, reference: d.Reference || '', status: x.status, fx: x.fx ? x.cur : '',
        subtotal: r2(sg * (XK.num(d.SubTotal) || 0) / f), tax: r2(sg * (XK.num(d.TotalTax) || 0) / f), total: x.total, due_amt: kind === 'Invoice' ? x.amount : 0, raw: d }; };
    var inv = c.rows('invoices').filter(function (d) { return d && d.Type === 'ACCREC' && (d.Status === 'AUTHORISED' || d.Status === 'PAID'); }).map(function (d) { return row(d, 'Invoice'); });
    var cns = c.rows('credit_notes').filter(function (d) { return d && d.Type === 'ACCRECCREDIT' && (d.Status === 'AUTHORISED' || d.Status === 'PAID'); }).map(function (d) { return row(d, 'Credit note'); });
    var all = inv.concat(cns).sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number)); });
    var tot = function (list, k) { return XK.sum(list.map(function (x) { return x[k]; })); };
    var T = { subtotal: tot(all, 'subtotal'), tax: tot(all, 'tax'), total: tot(all, 'total'), due_amt: tot(all, 'due_amt') };
    // by customer
    var byC = {}; all.forEach(function (x) { var k = x.cid || x.customer; if (!byC[k]) byC[k] = { customer: x.customer, count: 0, subtotal: 0, tax: 0, total: 0, due_amt: 0, overdue: 0 };
      var b = byC[k]; if (x.kind === 'Invoice') b.count++; b.subtotal = r2(b.subtotal + x.subtotal); b.tax = r2(b.tax + x.tax); b.total = r2(b.total + x.total); b.due_amt = r2(b.due_amt + x.due_amt); if (x.kind === 'Invoice' && x.due_amt && x.due && x.due < today) b.overdue = r2(b.overdue + x.due_amt); });
    var cust = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return b.total - a.total || a.customer.localeCompare(b.customer); });
    var CT = { subtotal: tot(cust, 'subtotal'), tax: tot(cust, 'tax'), total: tot(cust, 'total'), due_amt: tot(cust, 'due_amt'), overdue: tot(cust, 'overdue') };
    // income lines (ex tax, base currency) on trading-income accounts, for the tie to the Profit and Loss
    var acc = {}; ((c.data.accounts || {}).Accounts || []).forEach(function (a) { acc[a.Code] = a; acc[a.AccountID] = a; });
    var incomeOf = function (x) { var d = x.raw, f = rate(d), incl = d.LineAmountTypes === 'Inclusive', sg = x.kind === 'Invoice' ? 1 : -1;
      return XK.sum((d.LineItems || []).map(function (l) { var a = acc[l.AccountCode] || acc[l.AccountID]; if (!a || !/^(REVENUE|SALES)$/.test(a.Type)) return 0; var v = (XK.num(l.LineAmount) || 0) - (incl ? (XK.num(l.TaxAmount) || 0) : 0); return sg * v / f; })); };
    var linesKnown = c.data.accounts && all.every(function (x) { return (x.raw.LineItems || []).length > 0; }), invoiced = linesKnown ? XK.sum(all.map(incomeOf)) : null;
    var w = c.data.pnl ? XK.walk(c.data.pnl) : null, incSec = w ? w.sections.filter(function (s) { return /^(income|trading income|revenue)$/i.test(s.title); })[0] : null, plIncome = incSec ? XK.sectionTotal(incSec, 0) : w ? 0 : null;
    var view = c.view || 'register';
    var cards = XK.kpis([{ label: 'Invoices (' + inv.length + ')', value: tot(inv, 'total') }, { label: 'Credit notes (' + cns.length + ')', value: tot(cns, 'total') }, { label: 'Net sales incl. tax', value: T.total }, { label: 'Still owing', value: T.due_amt }], c);
    body.innerHTML = cards + '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'customers' ? 'Sales by customer' : 'Sales register') + '</h3><div id="sr-grid"></div></div>';
    if (view === 'customers') XK.grid(document.getElementById('sr-grid'), { rows: cust, filter: true, columns: [{ key: 'customer', title: 'Customer' }, { key: 'count', title: 'Invoices', num: true }, { key: 'subtotal', title: 'Subtotal', money: true }, { key: 'tax', title: 'Tax', money: true }, { key: 'total', title: 'Total', money: true }, { key: 'due_amt', title: 'Amount due', money: true }, { key: 'overdue', title: 'Overdue', money: true }],
      total: { customer: 'Total', count: inv.length, subtotal: CT.subtotal, tax: CT.tax, total: CT.total, due_amt: CT.due_amt, overdue: CT.overdue }, empty: 'No sales in this period.' }, c);
    else XK.grid(document.getElementById('sr-grid'), { rows: all.map(function (x) { return Object.assign({}, x, { sdate: XK.shortDate(x.date), sdue: x.due ? XK.shortDate(x.due) : '', who: x.customer + (x.fx ? ' (' + x.fx + ')' : '') }); }), filter: true,
      columns: [{ key: 'sdate', title: 'Date' }, { key: 'number', title: 'Number' }, { key: 'kind', title: 'Type' }, { key: 'who', title: 'Customer' }, { key: 'reference', title: 'Reference' }, { key: 'status', title: 'Status' }, { key: 'sdue', title: 'Due date' }, { key: 'subtotal', title: 'Subtotal', money: true }, { key: 'tax', title: 'Tax', money: true }, { key: 'total', title: 'Total', money: true }, { key: 'due_amt', title: 'Amount due', money: true }],
      total: { sdate: 'Total', subtotal: T.subtotal, tax: T.tax, total: T.total, due_amt: T.due_amt }, empty: 'No sales in this period.' }, c);
    // checks
    var leaks = all.filter(function (x) { return !inPeriod(x); }), arith = all.filter(function (x) { return !XK.near(r2(x.subtotal + x.tax), x.total); });
    var trunc = c.truncated('invoices') || c.truncated('credit_notes');
    var checks = [
      { name: 'By customer = the register (subtotal, tax, total, amount due)', pass: XK.near(CT.subtotal, T.subtotal) && XK.near(CT.tax, T.tax) && XK.near(CT.total, T.total) && XK.near(CT.due_amt, T.due_amt), detail: money(CT.total) + ' vs ' + money(T.total) },
      { name: 'Each document: subtotal + tax = total', pass: arith.length === 0, detail: arith.length ? arith.length + ' document(s) differ, e.g. ' + arith[0].number : all.length + ' document(s)' },
      { name: 'Every row is a sales invoice or credit note dated in the period', pass: leaks.length === 0, detail: leaks.length ? leaks.length + ' outside ' + from + ' to ' + to : XK.rangeLabel(from, to) },
      { name: 'Invoiced sales − credit notes vs Total Income on the Profit and Loss (information)', pass: null, info: true, detail: invoiced == null || plIncome == null ? (c.err('pnl') || c.err('accounts') || 'N/A — the documents carry no lines') : money(invoiced) + ' vs ' + money(plIncome) + (XK.near(invoiced, plIncome) ? ' — they match' : ' — difference ' + money(r2(plIncome - invoiced)) + ': income not invoiced (spend / receive money, manual journals) or invoice lines on other accounts') },
      { name: 'All sales invoices and credit notes in the period loaded', pass: (c.errors.credit_notes || trunc) ? false : true, detail: c.errors.credit_notes ? c.err('credit_notes') : trunc ? 'May be truncated (over 20 pages)' : inv.length + ' invoice(s), ' + cns.length + ' credit note(s)' }
    ];
    this._x = { all: all, cust: cust, T: T, CT: CT, inv: inv };
    return { checks: checks, notes: ['Approved and paid sales invoices and credit notes dated in the period (drafts and invoices awaiting approval are not sales yet). Amounts in ' + base + '; foreign-currency documents are converted at their own rate.', 'Overdue = amount due on invoices whose due date is before today.'],
      na: ['Sales by item and by tracking option (Xero\'s Sales by Item report is not in the Xero API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    var reg = head('Sales register').concat([['Date', 'Number', 'Type', 'Customer', 'Reference', 'Status', 'Due date', 'Subtotal', 'Tax', 'Total', 'Amount due'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.all.map(function (r) { return [r.date, r.number, r.kind, r.customer, r.reference, r.status, r.due, { v: r.subtotal, s: 'money' }, { v: r.tax, s: 'money' }, { v: r.total, s: 'money' }, { v: r.due_amt, s: 'money' }]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', '', '', '', '', { v: x.T.subtotal, s: 'moneyBold' }, { v: x.T.tax, s: 'moneyBold' }, { v: x.T.total, s: 'moneyBold' }, { v: x.T.due_amt, s: 'moneyBold' }]]);
    var cus = head('Sales by customer').concat([['Customer', 'Invoices', 'Subtotal', 'Tax', 'Total', 'Amount due', 'Overdue'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.cust.map(function (r) { return [r.customer, r.count, { v: r.subtotal, s: 'money' }, { v: r.tax, s: 'money' }, { v: r.total, s: 'money' }, { v: r.due_amt, s: 'money' }, { v: r.overdue, s: 'money' }]; }))
      .concat([[{ v: 'Total', s: 'bold' }, x.inv.length, { v: x.CT.subtotal, s: 'moneyBold' }, { v: x.CT.tax, s: 'moneyBold' }, { v: x.CT.total, s: 'moneyBold' }, { v: x.CT.due_amt, s: 'moneyBold' }, { v: x.CT.overdue, s: 'moneyBold' }]]);
    return [{ name: 'Sales register', rows: reg, widths: [12, 12, 12, 30, 16, 12, 12, 14, 12, 14, 14] }, { name: 'By customer', rows: cus, widths: [34, 10, 16, 14, 16, 16, 16] }];
  }
});

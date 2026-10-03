XK.app({
  title: 'GST Reconciliation', basisLabel: 'Accrual (invoice)', primary: 'bs_end', dated: ['bs_end'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', prev_end: '2026-03-31', date_where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"rates"}' },
  uses: { invoices: ['date_where', 'org'], credit_notes: ['date_where', 'org'], bank_tx: ['date_where', 'org'], tax_rates: ['org'], accounts: ['org'], bs_end: ['to_date', 'org'], bs_start: ['prev_end', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, bank_tx: { input: 'page', key: 'BankTransactions' } },
  tools: { invoices: 'list_invoices (sales invoices and bills in the period, with lines)', credit_notes: 'list_credit_notes (in the period)', bank_tx: 'list_bank_transactions (spend / receive money in the period, incl. GST paid to or refunded by the ATO)', tax_rates: 'list_tax_rates (names and rates)', accounts: 'list_accounts (the GST account)', bs_end: 'get_balance_sheet (GST at the period end)', bs_start: 'get_balance_sheet (GST the day before the period)', org: 'get_organisation (GST basis)', connections: 'list_connections' },
  presets: [['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_month', 'This month'], ['last_month', 'Last month'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['rates', 'By tax rate'], ['lines', 'Tax lines']],
  derive: function (inp) { return { prev_end: XK.addDaysIso(inp.from_date, -1), date_where: XK.dateWhere('Date', inp.from_date, inp.to_date) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['invoices', 'credit_notes', 'bank_tx', 'tax_rates'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Documents and tax rates loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices || !c.data.tax_rates) return {};
    var org = ((c.data.org || {}).Organisations || [])[0] || {}, cashBasis = /PAYMENT|CASH/i.test(org.SalesTaxBasis || '');
    var TR = {}; ((c.data.tax_rates || {}).TaxRates || []).forEach(function (t) { TR[t.TaxType] = t; });
    var inP = function (d) { return d && d >= from && d <= to; }, R = {}, lines = [], docTaxBad = 0, unknown = {}, docs = 0;
    var add = function (doc, side, sign, typeLabel) {
      var dd = XK.isoDate(doc.DateString || doc.Date); if (!inP(dd)) return; docs++;
      var lt = 0, incl = (doc.LineAmountTypes || 'Exclusive') === 'Inclusive', f = doc.CurrencyCode && doc.CurrencyCode !== c.currency ? (XK.num(doc.CurrencyRate) || 1) : 1;
      (doc.LineItems || []).forEach(function (l) {
        var tt = l.TaxType || 'NONE', t = TR[tt], tax = XK.num(l.TaxAmount) || 0, amt = XK.num(l.LineAmount) || 0, netAmt = incl ? amt - tax : amt; lt += tax;
        if (!t && tt !== 'NONE') unknown[tt] = 1;
        var k = tt; if (!R[k]) R[k] = { rate: t ? t.Name : tt, pct: t ? t.EffectiveRate : null, salesNet: 0, gstOut: 0, buyNet: 0, gstIn: 0 };
        var x = R[k], n2 = r2(sign * netAmt / f), g = r2(sign * tax / f);
        if (side === 'sales') { x.salesNet = r2(x.salesNet + n2); x.gstOut = r2(x.gstOut + g); } else { x.buyNet = r2(x.buyNet + n2); x.gstIn = r2(x.gstIn + g); }
        lines.push({ date: dd, doc: typeLabel + ' ' + (doc.InvoiceNumber || doc.CreditNoteNumber || doc.Reference || ''), contact: (doc.Contact || {}).Name || '', account: l.AccountCode || '', rate: t ? t.Name : tt, side: side === 'sales' ? 'Collected' : 'Paid', net: n2, gst: g });
      });
      if (!XK.near(r2(lt), XK.num(doc.TotalTax) || 0)) docTaxBad++;
    };
    c.rows('invoices').forEach(function (d) { if (d.Status === 'AUTHORISED' || d.Status === 'PAID') add(d, d.Type === 'ACCREC' ? 'sales' : 'purchases', 1, d.Type === 'ACCREC' ? 'Invoice' : 'Bill'); });
    c.rows('credit_notes').forEach(function (d) { if (/^(AUTHORISED|PAID)$/.test(d.Status || '')) add(d, d.Type === 'ACCRECCREDIT' ? 'sales' : 'purchases', -1, 'Credit note'); });
    // the GST account (from the Balance Sheet row), and what was paid to or refunded by the ATO through it in the period
    var gstRow = function (v) { var w = v ? XK.walk(v) : null, l = w ? w.lines.filter(function (x) { return x.kind === 'row' && /^gst$|^gst (payable|liability)|^bas liabilit/i.test(x.label); })[0] : null; return l ? { v: l.values[0], id: l.id, label: l.label } : null; };
    var g1 = gstRow(c.data.bs_end), g0 = gstRow(c.data.bs_start), acc = ((c.data.accounts || {}).Accounts || []).filter(function (a) { return g1 && a.AccountID === g1.id; })[0], code = acc ? acc.Code : null, settled = 0, settledN = 0;
    c.rows('bank_tx').forEach(function (d) {
      if (d.Status !== 'AUTHORISED' || !(d.Type === 'RECEIVE' || d.Type === 'SPEND')) return;
      var dd = XK.isoDate(d.DateString || d.Date); if (!inP(dd)) return;
      var toGst = code && (d.LineItems || []).some(function (l) { return l.AccountCode === code; });
      if (toGst) { (d.LineItems || []).forEach(function (l) { if (l.AccountCode === code) { settled = r2(settled + (d.Type === 'SPEND' ? 1 : -1) * (XK.num(l.LineAmount) || 0)); settledN++; } }); }
      else add(d, d.Type === 'RECEIVE' ? 'sales' : 'purchases', 1, d.Type === 'RECEIVE' ? 'Receive money' : 'Spend money');
    });
    var rows = Object.keys(R).map(function (k) { var x = R[k]; return Object.assign({ key: k, net: r2(x.gstOut - x.gstIn) }, x); }).filter(function (x) { return x.salesNet || x.buyNet || x.gstOut || x.gstIn; }).sort(function (a, b) { return (b.gstOut + b.gstIn) - (a.gstOut + a.gstIn) || a.rate.localeCompare(b.rate); });
    var T = { salesNet: XK.sum(rows.map(function (x) { return x.salesNet; })), gstOut: XK.sum(rows.map(function (x) { return x.gstOut; })), buyNet: XK.sum(rows.map(function (x) { return x.buyNet; })), gstIn: XK.sum(rows.map(function (x) { return x.gstIn; })) };
    T.net = r2(T.gstOut - T.gstIn);
    var open = g0 ? g0.v : null, close = g1 ? g1.v : null, expected = open == null ? null : r2(open + T.net - settled), diff = expected == null || close == null ? null : r2(close - expected);
    var recon = '<div class="xk-card" style="margin-top:16px"><h3>Reconciliation to the GST account' + (g1 ? ' (' + XK.h(g1.label) + (code ? ', ' + XK.h(code) : '') + ')' : '') + '</h3><table class="xk-grid"><tbody>' +
      [['GST account balance at ' + XK.shortDate(c.inputs.prev_end), open], ['+ GST collected', T.gstOut], ['− GST paid', -T.gstIn], ['− Paid to / + refunded by the ATO in the period (' + settledN + ' line' + (settledN === 1 ? '' : 's') + ')', -settled], ['= Expected balance at ' + XK.shortDate(to), expected], ['GST account balance at ' + XK.shortDate(to) + ' (Balance Sheet)', close], ['Difference', diff]]
        .map(function (r, i) { return '<tr' + (i >= 4 ? ' class="k-total"' : '') + '><td>' + XK.h(r[0]) + '</td><td class="num">' + (r[1] == null ? 'N/A — not in source' : money(r[1])) + '</td></tr>'; }).join('') + '</tbody></table>' +
      (diff != null && !XK.near(diff, 0) ? '<p class="muted">Possible causes (not checked): GST in manual journals, payments to the ATO not coded to the GST account, documents dated outside the period but approved later' + (cashBasis ? ', and the organisation reports GST on the cash basis, so the GST account moves when payments are made' : '') + '.</p>' : '') + '</div>';
    var view = c.view || 'rates';
    body.innerHTML = '<div class="xk-banner na" style="margin-bottom:12px"><strong>A GST reconciliation, not a lodgeable BAS</strong> — calculated from your Xero transactions. Lodge from Xero → Tax → Activity statements. Not tax advice.</div>' +
      XK.kpis([{ label: 'GST collected', value: T.gstOut }, { label: 'GST paid', value: T.gstIn }, { label: 'Net GST ' + (T.net >= 0 ? 'payable' : 'refundable'), value: T.net }, { label: 'Difference to the GST account', value: diff, text: diff == null ? 'N/A' : null, red: diff != null && !XK.near(diff, 0) }], c) +
      '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'lines' ? 'Tax lines' : 'By tax rate') + '</h3><div id="gr-grid"></div></div>' + recon;
    if (view === 'lines') XK.grid(document.getElementById('gr-grid'), { rows: lines.map(function (l) { return Object.assign({}, l, { sdate: XK.shortDate(l.date) }); }), filter: true, columns: [{ key: 'sdate', title: 'Date' }, { key: 'doc', title: 'Document' }, { key: 'contact', title: 'Contact' }, { key: 'account', title: 'Account' }, { key: 'rate', title: 'Tax rate' }, { key: 'side', title: 'GST' }, { key: 'net', title: 'Net', money: true }, { key: 'gst', title: 'GST', money: true }], empty: 'No tax lines in this period.' }, c);
    else XK.grid(document.getElementById('gr-grid'), { rows: rows.map(function (x) { return Object.assign({}, x, { pctS: x.pct == null ? '' : x.pct + '%' }); }), columns: [{ key: 'rate', title: 'Tax rate' }, { key: 'pctS', title: 'Rate', num: true }, { key: 'salesNet', title: 'Sales (net)', money: true }, { key: 'gstOut', title: 'GST collected', money: true }, { key: 'buyNet', title: 'Purchases (net)', money: true }, { key: 'gstIn', title: 'GST paid', money: true }, { key: 'net', title: 'Net GST', money: true }],
      total: { rate: 'Total', salesNet: T.salesNet, gstOut: T.gstOut, buyNet: T.buyNet, gstIn: T.gstIn, net: T.net }, empty: 'No GST in this period.' }, c);
    // checks
    var lineSum = { out: XK.sum(lines.filter(function (l) { return l.side === 'Collected'; }).map(function (l) { return l.gst; })), inn: XK.sum(lines.filter(function (l) { return l.side === 'Paid'; }).map(function (l) { return l.gst; })) };
    var trunc = ['invoices', 'credit_notes', 'bank_tx'].some(function (id) { return c.truncated(id); });
    var checks = [
      { name: 'Net GST = GST collected − GST paid, and the tax rates add up to the tax lines', pass: XK.near(T.net, r2(T.gstOut - T.gstIn)) && XK.near(lineSum.out, T.gstOut) && XK.near(lineSum.inn, T.gstIn), detail: money(T.gstOut) + ' − ' + money(T.gstIn) + ' = ' + money(T.net) },
      { name: 'GST on each document\'s lines = the document\'s total tax', pass: docTaxBad === 0, detail: docTaxBad ? docTaxBad + ' document(s) differ' : docs + ' document(s)' },
      { name: 'Every tax rate used is one of the organisation\'s tax rates', pass: Object.keys(unknown).length === 0, detail: Object.keys(unknown).length ? 'Unknown: ' + Object.keys(unknown).join(', ') : rows.length + ' rate(s) used' },
      diff == null ? { name: 'GST account at the period end = the start + net GST − GST paid to the ATO (two Balance Sheets)', pass: null, detail: c.err('bs_end') || c.err('bs_start') || 'N/A — no GST line on the Balance Sheet' }
        : cashBasis ? { name: 'GST account at the period end vs the start + net GST − GST paid to the ATO (information — cash-basis GST)', pass: null, info: true, detail: 'Difference ' + money(diff) }
        : { name: 'GST account at the period end = the start + net GST − GST paid to the ATO (two Balance Sheets — separate Xero reports)', pass: XK.near(diff, 0), detail: money(close) + ' vs ' + money(expected) + (XK.near(diff, 0) ? '' : ' — difference ' + money(diff) + '; see the possible causes under the reconciliation') },
      { name: 'All documents in the period loaded', pass: trunc ? false : true, detail: trunc ? 'May be truncated (over 20 pages)' : docs + ' document(s)' }
    ];
    this._x = { rows: rows, T: T, lines: lines, recon: [['Opening GST balance', open], ['GST collected', T.gstOut], ['GST paid', -T.gstIn], ['Paid to / refunded by the ATO', -settled], ['Expected closing balance', expected], ['Closing GST balance (Balance Sheet)', close], ['Difference', diff]] };
    return { checks: checks, notes: ['Invoice basis: the GST on invoices, bills, credit notes and spend / receive money dated in the period. Payments to or refunds from the ATO (spend / receive money coded to the GST account) reconcile the account instead.', 'Manual journals with GST are not included.'],
      na: ['A lodgeable BAS and its labels (no activity-statement endpoint in the Xero API — see the GST summary report for the BAS fields)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; };
    var a = head('GST reconciliation').concat([['Tax rate', 'Rate', 'Sales (net)', 'GST collected', 'Purchases (net)', 'GST paid', 'Net GST'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.rows.map(function (r) { return [r.rate, r.pct == null ? '' : r.pct + '%', mv(r.salesNet), mv(r.gstOut), mv(r.buyNet), mv(r.gstIn), mv(r.net)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', mv(x.T.salesNet), mv(x.T.gstOut), mv(x.T.buyNet), mv(x.T.gstIn), mv(x.T.net)], []]).concat(x.recon.map(function (r) { return [r[0], '', '', '', '', '', mv(r[1])]; }));
    var l = head('Tax lines').concat([['Date', 'Document', 'Contact', 'Account', 'Tax rate', 'GST', 'Net', 'GST amount'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.lines.map(function (r) { return [r.date, r.doc, r.contact, r.account, r.rate, r.side, mv(r.net), mv(r.gst)]; }));
    return [{ name: 'GST reconciliation', rows: a, widths: [34, 8, 16, 16, 16, 16, 16] }, { name: 'Tax lines', rows: l, widths: [12, 22, 26, 10, 22, 12, 14, 14] }];
  }
});

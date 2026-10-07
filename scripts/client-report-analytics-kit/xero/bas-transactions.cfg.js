XK.app({
  title: 'Xero · BAS Related Transactions and GST', primary: 'bs_end', dated: ['bs_end'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', prev_end: '2026-03-31', date_where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)', inv_ids: '', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"tax","o":"b=org"}' },
  uses: { payments: ['date_where', 'org'], paid_inv: ['inv_ids', 'org'], invoices: ['date_where', 'org'], credit_notes: ['date_where', 'org'], bank_tx: ['date_where', 'org'], tax_rates: ['org'], accounts: ['org'], bs_end: ['to_date', 'org'], bs_start: ['prev_end', 'org'], org: ['org'], connections: [] },
  paged: { payments: { input: 'page', key: 'Payments' }, invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, bank_tx: { input: 'page', key: 'BankTransactions' } },
  sources: { paid_inv: { name: 'Paid invoices', optional: true, quiet: function (i) { return !i.inv_ids; } } },
  // cash basis: the invoices and bills the period's payments paid, 12 ids per call
  fan: { paid_inv: function (inp, c) { var o = ((c.data.org || {}).Organisations || [])[0] || {}, b = c.opt('b'); if (!(b === 'cash' || (b !== 'accrual' && /PAYMENT|CASH/i.test(o.SalesTaxBasis || '')))) return []; var ids = {}; c.rows('payments').forEach(function (p) { var id = (p.Invoice || {}).InvoiceID; if (id && p.Status !== 'DELETED') ids[id] = 1; }); var all = Object.keys(ids), out = []; for (var i = 0; i < all.length; i += 12) out.push({ key: 'b' + i, inputs: { inv_ids: all.slice(i, i + 12).join(',') } }); return out; } },
  tools: { payments: 'list_payments (in the period — cash basis)', paid_inv: 'list_invoices (the invoices and bills those payments paid, by id)', invoices: 'list_invoices (sales invoices and bills in the period, with lines)', credit_notes: 'list_credit_notes (in the period)', bank_tx: 'list_bank_transactions (spend / receive money in the period)', tax_rates: 'list_tax_rates (names and rates)', accounts: 'list_accounts (the GST account)', bs_end: 'get_balance_sheet (GST account at the period end)', bs_start: 'get_balance_sheet (GST account the day before the period)', org: 'get_organisation (GST basis)', connections: 'list_connections' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['tax', 'Group by tax type'], ['contact', 'Group by contact'], ['account', 'Group by account']],
  options: [{ id: 'b', label: 'GST basis', options: [['org', 'Xero setting'], ['accrual', 'Accrual (invoice)'], ['cash', 'Cash (payments)']], def: 'org' }],
  derive: function (inp) { return { prev_end: XK.addDaysIso(inp.from_date, -1), date_where: XK.dateWhere('Date', inp.from_date, inp.to_date) }; },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['invoices', 'credit_notes', 'bank_tx', 'tax_rates'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Documents and tax rates loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices || !c.data.tax_rates) return {};
    // ---- tax lines (the GST Reconciliation / GST Summary data model)
    var org = ((c.data.org || {}).Organisations || [])[0] || {}, ob = c.opt('b'), cashSet = ob === 'cash' || (ob !== 'accrual' && /PAYMENT|CASH/i.test(org.SalesTaxBasis || ''));
    var TR = {}; ((c.data.tax_rates || {}).TaxRates || []).forEach(function (t) { TR[t.TaxType] = t; });
    var inP = function (d) { return d && d >= from && d <= to; }, lines = [], docTaxBad = 0, docGrossBad = 0, unknown = {}, docs = 0;
    var add = function (doc, side, sign, src, dd) {
      if (!inP(dd)) return; docs++;
      var lt = 0, lg = 0, incl = (doc.LineAmountTypes || 'Exclusive') === 'Inclusive', f = doc.CurrencyCode && doc.CurrencyCode !== c.currency ? (XK.num(doc.CurrencyRate) || 1) : 1;
      (doc.LineItems || []).forEach(function (l) {
        var tt = l.TaxType || 'NONE', t = TR[tt], tax = XK.num(l.TaxAmount) || 0, amt = XK.num(l.LineAmount) || 0, net = incl ? amt - tax : amt; lt += tax; lg += net + tax;
        if (!t && tt !== 'NONE') unknown[tt] = 1;
        var n2 = r2(sign * net / f), g = r2(sign * tax / f);
        lines.push({ date: dd, month: dd.slice(0, 7), src: src, ref: doc.InvoiceNumber || doc.CreditNoteNumber || doc.Reference || '', contact: (doc.Contact || {}).Name || '', acct: l.AccountCode || '', tt: tt, rate: t ? t.Name : tt, pct: t ? XK.num(t.EffectiveRate) : null, side: side, net: n2, gst: g, gross: r2(n2 + g) });
      });
      if (!XK.near(r2(lt), XK.num(doc.TotalTax) || 0)) docTaxBad++;
      if (!XK.near(r2(lg), XK.num(doc.Total) || 0)) docGrossBad++;
    };
    var fin = c.fan('paid_inv'), byId = {}, cashDone = cashSet && fin != null && fin.every(function (x) { return !x.error; }), nPay = 0;
    if (fin) fin.forEach(function (x) { ((x.value || {}).Invoices || []).forEach(function (d) { byId[d.InvoiceID] = d; }); });
    if (cashDone) c.rows('payments').forEach(function (p) { var d = byId[(p.Invoice || {}).InvoiceID], tot = d ? XK.num(d.Total) : 0, k = tot ? (XK.num(p.Amount) || 0) / tot : 0; if (!d || !k || p.Status === 'DELETED') return; nPay++; var sc = function (v) { return (XK.num(v) || 0) * k; };
      add(Object.assign({}, d, { TotalTax: sc(d.TotalTax), Total: sc(d.Total), LineItems: (d.LineItems || []).map(function (l) { return Object.assign({}, l, { LineAmount: sc(l.LineAmount), TaxAmount: sc(l.TaxAmount) }); }) }), d.Type === 'ACCREC' ? 'sales' : 'purchases', 1, d.Type === 'ACCREC' ? 'Invoice payment' : 'Bill payment', XK.isoDate(p.Date)); });
    else c.rows('invoices').forEach(function (d) { if (d.Status === 'AUTHORISED' || d.Status === 'PAID') add(d, d.Type === 'ACCREC' ? 'sales' : 'purchases', 1, d.Type === 'ACCREC' ? 'Invoice' : 'Bill', XK.isoDate(d.DateString || d.Date)); });
    c.rows('credit_notes').forEach(function (d) { if (/^(AUTHORISED|PAID)$/.test(d.Status || '')) add(d, d.Type === 'ACCRECCREDIT' ? 'sales' : 'purchases', -1, d.Type === 'ACCRECCREDIT' ? 'Sales credit note' : 'Bill credit note', XK.isoDate(d.DateString || d.Date)); });
    var gstRow = function (v) { var w = v ? XK.walk(v) : null, l = w ? w.lines.filter(function (x) { return x.kind === 'row' && /^gst$|^gst (payable|liability)|^bas liabilit/i.test(x.label); })[0] : null; return l ? { v: l.values[0], id: l.id, label: l.label } : null; };
    var g1 = gstRow(c.data.bs_end), g0 = gstRow(c.data.bs_start), accts = (c.data.accounts || {}).Accounts || [], acc = accts.filter(function (a) { return g1 && a.AccountID === g1.id; })[0] || accts.filter(function (a) { return a.SystemAccount === 'GST'; })[0], code = acc ? acc.Code : null, settled = 0, settledN = 0;
    c.rows('bank_tx').forEach(function (d) {
      if (d.Status !== 'AUTHORISED' || !(d.Type === 'RECEIVE' || d.Type === 'SPEND')) return; var dd = XK.isoDate(d.DateString || d.Date); if (!inP(dd)) return;
      if (code && (d.LineItems || []).some(function (l) { return l.AccountCode === code; })) { (d.LineItems || []).forEach(function (l) { if (l.AccountCode === code) { settled = r2(settled + (d.Type === 'SPEND' ? 1 : -1) * (XK.num(l.LineAmount) || 0)); settledN++; } }); }
      else add(d, d.Type === 'RECEIVE' ? 'sales' : 'purchases', 1, d.Type === 'RECEIVE' ? 'Receive money' : 'Spend money', dd);
    });
    var T = { out: XK.sum(lines.filter(function (l) { return l.side === 'sales'; }).map(function (l) { return l.gst; })), inn: XK.sum(lines.filter(function (l) { return l.side !== 'sales'; }).map(function (l) { return l.gst; })) }, net = r2(T.out - T.inn);
    // ---- the transaction table: every BAS line, signed to the GST position (sales +, purchases −), grouped by tax type / contact / account
    var AN = {}; accts.forEach(function (a) { AN[a.Code] = a.Name; });
    var all = lines.map(function (l) { var sg = l.side === 'sales' ? 1 : -1; return { date: l.date, src: l.src, ref: l.ref, contact: l.contact || '(no contact)', acct: l.acct ? l.acct + (AN[l.acct] ? ' · ' + AN[l.acct] : '') : '(no account)', tt: l.tt, rate: l.rate, net: r2(sg * l.net), gst: r2(sg * l.gst), gross: r2(sg * l.gross) }; }).sort(function (a, b) { return a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref); });
    var view = c.view === 'contact' || c.view === 'account' ? c.view : 'tax', gk = { tax: 'rate', contact: 'contact', account: 'acct' }[view], Fl = self._f || (self._f = { tt: '', ct: '', ac: '' });
    var uniq = function (k) { return all.map(function (r) { return r[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(); };
    ['tt', 'ct', 'ac'].forEach(function (k, i) { if (Fl[k] && uniq(['tt', 'contact', 'acct'][i]).indexOf(Fl[k]) < 0) Fl[k] = ''; });
    var shown = all.filter(function (r) { return (!Fl.tt || r.tt === Fl.tt) && (!Fl.ct || r.contact === Fl.ct) && (!Fl.ac || r.acct === Fl.ac); }), G = {}, order = [];
    shown.forEach(function (r) { var k = r[gk]; if (!G[k]) { G[k] = { key: k, rows: [], net: 0, gst: 0, gross: 0 }; order.push(k); } var g = G[k]; g.rows.push(r); g.net = r2(g.net + r.net); g.gst = r2(g.gst + r.gst); g.gross = r2(g.gross + r.gross); });
    order.sort(function (a, b) { return String(a).localeCompare(String(b)); });
    var tot = { net: XK.sum(shown.map(function (r) { return r.net; })), gst: XK.sum(shown.map(function (r) { return r.gst; })), gross: XK.sum(shown.map(function (r) { return r.gross; })) };
    var td = function (v) { return '<td class="num">' + money(v) + '</td>'; }, sel = function (id, label, k, list, nameOf) { return '<label class="muted">' + label + ' <select id="' + id + '"><option value="">All</option>' + list.map(function (v) { return '<option value="' + XK.h(v) + '"' + (v === Fl[k] ? ' selected' : '') + '>' + XK.h(nameOf ? nameOf(v) : v) + '</option>'; }).join('') + '</select></label> '; };
    var line = function (r) { return '<tr class="bt-line"><td>' + XK.h(XK.shortDate(r.date)) + '</td><td>' + XK.h(r.src) + '</td><td>' + XK.h(r.ref) + '</td><td>' + XK.h(r.contact) + '</td><td>' + XK.h(r.acct) + '</td><td>' + XK.h(r.rate) + '</td>' + td(r.net) + td(r.gst) + td(r.gross) + '</tr>'; };
    var grp = function (k) { var g = G[k]; return '<tr class="k-header bt-group"><td colspan="9"><strong>' + XK.h(k) + '</strong> · ' + g.rows.length + ' line' + (g.rows.length === 1 ? '' : 's') + '</td></tr>' + g.rows.map(line).join('') + '<tr class="k-total bt-sub"><td colspan="6">Total ' + XK.h(k) + '</td>' + td(g.net) + td(g.gst) + td(g.gross) + '</tr>'; };
    var tbl = '<div class="xk-scroll"><table class="xk-grid" id="bt-table"><thead><tr>' + ['Date', 'Source', 'Reference', 'Contact', 'Account', 'Tax type', 'Net', 'GST', 'Gross'].map(function (t, i) { return '<th scope="col"' + (i > 5 ? ' class="num"' : '') + '>' + t + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (order.length ? order.map(grp).join('') : '<tr><td colspan="9" class="muted">No BAS lines in this period' + (shown.length < all.length ? ' for these filters' : '') + '.</td></tr>') +
      '</tbody><tfoot><tr class="k-total bt-grand"><td colspan="6">Grand total' + (shown.length < all.length ? ' (filtered: ' + shown.length + ' of ' + all.length + ' lines)' : ' (' + all.length + ' lines)') + '</td>' + td(tot.net) + td(tot.gst) + td(tot.gross) + '</tr></tfoot></table></div>';
    body.innerHTML = '<div class="xk-banner na" style="margin-bottom:12px"><strong>BAS preparation review, not a lodgeable BAS</strong> — every BAS-relevant line from your Xero transactions on the <strong>' + (cashSet ? 'cash (payments)' : 'accrual (invoice)') + '</strong> basis' + (cashSet && !cashDone ? ' — ' + (fin == null ? 'loading the paid invoices…' : 'some paid invoices could not be loaded, so these lines are on the invoice basis') : '') + '. Sales are positive and purchases negative, so the GST column adds up to net GST. Not tax advice.</div>' +
      XK.kpis([{ label: 'GST collected', value: T.out }, { label: 'GST paid', value: T.inn }, { label: 'Net GST ' + (net >= 0 ? 'payable' : 'refundable'), value: net }, { label: 'Lines', text: String(all.length) }], c) +
      '<div class="xk-card" style="margin-top:16px"><h3>BAS transactions grouped by ' + { tax: 'tax type', contact: 'contact', account: 'account' }[view] + '</h3><div>' + sel('bt-ftt', 'Tax type', 'tt', uniq('tt'), function (v) { return (TR[v] || {}).Name || v; }) + sel('bt-fct', 'Contact', 'ct', uniq('contact')) + sel('bt-fac', 'Account', 'ac', uniq('acct')) + '</div>' + tbl + '</div>';
    [['bt-ftt', 'tt'], ['bt-fct', 'ct'], ['bt-fac', 'ac']].forEach(function (p) { var e = document.getElementById(p[0]); if (e) e.addEventListener('change', function () { Fl[p[1]] = this.value; c.change({}, {}); }); });
    // ---- checks
    var byT = {}; all.forEach(function (r) { byT[r.tt] = r2((byT[r.tt] || 0) + r.gst); });
    var sumT = {}; lines.forEach(function (l) { sumT[l.tt] = r2((sumT[l.tt] || 0) + (l.side === 'sales' ? 1 : -1) * l.gst); }); // the CRA-05 figure per tax type (collected − paid), from the summary model
    var tBad = Object.keys(sumT).filter(function (k) { return !XK.near(byT[k] || 0, sumT[k]); }).concat(Object.keys(byT).filter(function (k) { return !(k in sumT); }));
    var gAll = XK.sum(all.map(function (r) { return r.gst; })), lineBad = all.filter(function (r) { return !XK.near(r2(r.net + r.gst), r.gross); }).length;
    var open = g0 ? g0.v : null, close = g1 ? g1.v : null, expected = open == null ? null : r2(open + net - settled), diff = expected == null || close == null ? null : r2(close - expected);
    var trunc = ['invoices', 'credit_notes', 'bank_tx', 'payments'].filter(function (id) { return c.truncated(id) || (id === 'payments' && cashSet && c.errors.payments); });
    var checks = [
      { name: 'Σ GST per tax type in the table = that tax type\'s figure in the GST summary (Summary of Tax Amounts by Type)', pass: tBad.length === 0, detail: tBad.length ? 'Differs: ' + tBad.join(', ') : Object.keys(sumT).length + ' tax type(s)' },
      { name: 'Grand total GST = net GST of the period (GST collected − GST paid)', pass: XK.near(gAll, net) && XK.near(net, r2(T.out - T.inn)), detail: money(gAll) + ' vs ' + money(net) },
      { name: 'Every line: Net + GST = Gross; each document\'s lines add up to its total tax and its total (Xero\'s TotalTax and Total)', pass: lineBad === 0 && docTaxBad === 0 && docGrossBad === 0, detail: lineBad + docTaxBad + docGrossBad ? lineBad + ' line(s), ' + docTaxBad + ' document(s) on tax, ' + docGrossBad + ' on the total' : all.length + ' line(s), ' + docs + ' document(s)' },
      { name: 'Every tax type used is one of the organisation\'s tax rates', pass: Object.keys(unknown).length === 0, detail: Object.keys(unknown).length ? 'Unknown: ' + Object.keys(unknown).join(', ') : Object.keys(sumT).length + ' tax type(s)' },
      diff == null ? { name: 'Net GST = the GST account movement on the Balance Sheet (end − start) − GST paid to the ATO', pass: null, detail: c.err('bs_end') || c.err('bs_start') || 'N/A — no GST line on the Balance Sheet' }
        : cashSet ? { name: 'GST account movement vs net GST (information — on the cash basis the GST account moves on invoices)', pass: null, info: true, detail: 'Difference ' + money(diff) }
        : { name: 'Net GST = the GST account movement on the Balance Sheet (end − start) − GST paid to the ATO', pass: XK.near(diff, 0), detail: money(r2(close - open)) + ' movement = ' + money(net) + ' − ' + money(settled) + ' paid' + (XK.near(diff, 0) ? '' : ' — difference ' + money(diff) + ': GST in manual journals, ATO payments not coded to the GST account or documents approved after the period (not checked)') },
      { name: 'All lines in the period loaded (lists paged 100 at a time, up to 20 pages)', pass: !trunc.length, detail: trunc.length ? 'May be truncated (over 20 pages): ' + trunc.join(', ') : all.length + ' line(s) from ' + docs + ' document(s)' }
    ];
    if (cashSet) checks.push({ name: 'Cash basis: every payment\'s invoice loaded', pass: fin == null ? null : cashDone && nPay === c.rows('payments').filter(function (p) { return p.Status !== 'DELETED' && (p.Invoice || {}).InvoiceID; }).length, detail: fin == null ? (c.live ? 'Loading' : 'Needs the live report') : nPay + ' of ' + c.rows('payments').length + ' payment(s)' });
    this._x = { all: all, gk: gk, view: view, sumT: sumT, cash: cashSet, net: net, TR: TR };
    return { checks: checks, period: XK.periodLine(from, to) + ' · ' + (cashSet ? 'Cash' : 'Accrual') + ' GST basis',
      notes: ['Lines of invoices, bills, credit notes and spend / receive money ' + (cashSet ? 'paid in the period (each payment\'s share of its invoice; credit notes and spend / receive money by their date)' : 'dated in the period') + ', with each line\'s Xero tax rate and account. Payments to or refunds from the ATO (lines coded to the GST account) are not BAS lines; they reconcile the GST account.', 'Manual journals with GST are not included (they appear as a difference to the GST account).'],
      na: ['A lodgeable BAS and its lodgement status (no activity-statement endpoint in the Xero API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date) + ' · ' + (x.cash ? 'Cash' : 'Accrual') + ' GST basis'], []]; }, mv = function (v) { return { v: v, s: 'money' }; }, mb = function (v) { return { v: v, s: 'moneyBold' }; }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var G = {}, order = []; x.all.forEach(function (r) { var k = r[x.gk]; if (!G[k]) { G[k] = []; order.push(k); } G[k].push(r); }); order.sort(function (a, b) { return String(a).localeCompare(String(b)); });
    var rows = head('BAS transactions (all lines, by ' + { tax: 'tax type', contact: 'contact', account: 'account' }[x.view] + ')').concat([['Date', 'Source', 'Reference', 'Contact', 'Account', 'Tax type', 'Net', 'GST', 'Gross'].map(function (t) { return { v: t, s: 'bold' }; })]), sm = function (a, k) { return r2(a.reduce(function (s, r) { return s + r[k]; }, 0)); };
    order.forEach(function (k) { var g = G[k]; rows.push([{ v: k, s: 'bold' }]); g.forEach(function (r) { rows.push([r.date, r.src, r.ref, r.contact, r.acct, r.rate, mv(r.net), mv(r.gst), mv(r.gross)]); }); rows.push([{ v: 'Total ' + k, s: 'bold' }, '', '', '', '', '', mb(sm(g, 'net')), mb(sm(g, 'gst')), mb(sm(g, 'gross'))]); });
    rows.push([{ v: 'Grand total', s: 'bold' }, '', '', '', '', '', mb(sm(x.all, 'net')), mb(sm(x.all, 'gst')), mb(sm(x.all, 'gross'))]);
    var s2 = head('GST by tax type').concat([[{ v: 'Tax type', s: 'bold' }, { v: 'Code', s: 'bold' }, { v: 'GST (collected − paid)', s: 'bold' }]]).concat(Object.keys(x.sumT).sort().map(function (k) { return [(x.TR[k] || {}).Name || k, k, mv(x.sumT[k])]; })).concat([[{ v: 'Net GST', s: 'bold' }, '', mb(x.net)]]);
    return [{ name: 'BAS transactions', rows: rows, widths: [12, 16, 16, 28, 30, 18, 14, 14, 14] }, { name: 'GST by tax type', rows: s2, widths: [24, 14, 22] }];
  }
});

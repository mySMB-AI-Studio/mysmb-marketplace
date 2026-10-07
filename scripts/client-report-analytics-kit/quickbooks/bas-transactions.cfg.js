// CRA-07 BAS Related Transactions and GST — QuickBooks Online. The client is the connected QuickBooks company (one company per
// connection). Every GST-coded transaction line in the period by tax type, contact, source and account, from the transaction
// entities' tax lines, tied to QuickBooks' Tax Summary for the agency (1A / 1B / 9).
// >>> TX (shared with bas-transactions.cfg.js; a test keeps the two copies identical)
var TX = (function () {
  // [binding id, QBO entity, source label, sign, side S = sales / P = purchases]; journals are read per line
  var ENT = [['invoices', 'Invoice', 'Invoice', 1, 'S'], ['sales_receipts', 'SalesReceipt', 'Sales receipt', 1, 'S'], ['credit_memos', 'CreditMemo', 'Credit note', -1, 'S'],
    ['bills', 'Bill', 'Bill', 1, 'P'], ['purchases', 'Purchase', 'Spend money', 1, 'P'], ['vendor_credits', 'VendorCredit', 'Supplier credit', -1, 'P'], ['journal_entries', 'JournalEntry', 'Journal', 0, null]];
  var CAP = 1000, DET = { SalesItemLineDetail: 1, AccountBasedExpenseLineDetail: 1, ItemBasedExpenseLineDetail: 1 };
  function where(start, end) { return "TxnDate >= '" + start + "' AND TxnDate <= '" + end + "'"; }
  function list(data, id, ent) { return ((data[id] || {}).QueryResponse || {})[ent] || []; }
  function r2(v) { return Math.round(v * 100) / 100; }
  // TaxCode → its sales / purchase tax rates; rate → {name, code, side}
  function codes(resp) {
    var rate = {}, code = {};
    (((resp || {}).QueryResponse || {}).TaxCode || []).forEach(function (tc) {
      code[String(tc.Id)] = { name: tc.Name || 'Tax code ' + tc.Id, desc: tc.Description || '', S: [], P: [] };
      [['SalesTaxRateList', 'S'], ['PurchaseTaxRateList', 'P']].forEach(function (x) {
        ((tc[x[0]] || {}).TaxRateDetail || []).forEach(function (d) { var id = d.TaxRateRef && String(d.TaxRateRef.value); if (!id) return;
          code[String(tc.Id)][x[1]].push(id); rate[id] = { name: d.TaxRateRef.name || null, code: tc.Name || tc.Id, codeId: String(tc.Id), side: x[1] }; });
      });
    });
    return { rate: rate, code: code };
  }
  function items(resp) { var m = {}; (((resp || {}).QueryResponse || {}).Item || []).forEach(function (i) { m[String(i.Id)] = { inc: i.IncomeAccountRef && i.IncomeAccountRef.name, exp: i.ExpenseAccountRef && i.ExpenseAccountRef.name }; }); return m; }
  function lineAccount(l, it) {
    var d = l[l.DetailType] || {};
    if (d.AccountRef && d.AccountRef.name) return d.AccountRef.name;
    if (d.ItemRef) { var i = it && it[String(d.ItemRef.value)]; var a = i && (l.DetailType === 'SalesItemLineDetail' ? i.inc : i.exp); return a || null; }
    return null;
  }
  // rows: one per (document × tax rate) from TxnTaxDetail.TaxLine; one per tax-coded journal line. Amounts signed: a credit note /
  // supplier credit / refund reduces its side. docs: the document-level integrity facts for the checks.
  function build(data, opts) {
    opts = opts || {}; var cm = codes(data[opts.codes || 'tax_codes']), it = opts.items ? items(data[opts.items]) : null, rows = [], docs = [], counts = {}, trunc = [];
    var typeOf = function (rateId, side, pct) { var r = cm.rate[rateId] || {}; return { key: rateId, name: r.name || 'Tax rate ' + rateId, code: r.code || '?', side: r.side || side, pct: pct }; };
    ENT.forEach(function (e) {
      var ls = list(data, e[0], e[1]); counts[e[0]] = ls.length; if (ls.length >= CAP) trunc.push(e[1]);
      ls.forEach(function (t) {
        var who = (t.CustomerRef || t.VendorRef || t.EntityRef || {}).name || '', base = { date: t.TxnDate, ref: t.DocNumber || t.Id, contact: who, entity: e[1], id: t.Id };
        if (e[1] === 'JournalEntry') {
          (t.Line || []).forEach(function (l) { var d = l.JournalEntryLineDetail || {}; if (!d.TaxCodeRef || d.TaxAmount == null) return;
            var side = d.TaxApplicableOn === 'Sales' ? 'S' : 'P', c = cm.code[String(d.TaxCodeRef.value)], rid = c && c[side][0] ? c[side][0] : 'code ' + d.TaxCodeRef.value;
            var sg = (side === 'S') === (d.PostingType === 'Credit') ? 1 : -1, ty = typeOf(rid, side, null);
            if (!c) ty.name = 'Tax code ' + d.TaxCodeRef.value;
            rows.push(Object.assign({}, base, { source: 'Journal', contact: (d.Entity && d.Entity.EntityRef && d.Entity.EntityRef.name) || '', type: ty, side: ty.side, account: (d.AccountRef && d.AccountRef.name) || null, net: r2(sg * (Number(l.Amount) || 0)), gst: r2(sg * Number(d.TaxAmount)) })); });
          return;
        }
        var sg = e[3], src = e[2];
        if (e[1] === 'Purchase' && t.Credit === true) { sg = -1; src = 'Spend money (refund)'; }
        var tl = ((t.TxnTaxDetail || {}).TaxLine || []).filter(function (x) { return x.TaxLineDetail; }), lines = (t.Line || []);
        var lineSum = 0; lines.forEach(function (l) { if (DET[l.DetailType]) lineSum += Number(l.Amount) || 0; else if (l.DetailType === 'DiscountLineDetail') lineSum -= Number(l.Amount) || 0; });
        var totTax = t.TxnTaxDetail && t.TxnTaxDetail.TotalTax != null ? Number(t.TxnTaxDetail.TotalTax) : null, sumTl = r2(tl.reduce(function (s, x) { return s + (Number(x.Amount) || 0); }, 0));
        docs.push({ entity: e[1], source: src, ref: base.ref, total: t.TotalAmt == null ? null : Number(t.TotalAmt), lines: r2(lineSum), tax: totTax, taxLines: sumTl });
        tl.forEach(function (x) {
          var d = x.TaxLineDetail, rid = d.TaxRateRef ? String(d.TaxRateRef.value) : '?', ty = typeOf(rid, e[4], d.TaxPercent == null ? null : Number(d.TaxPercent)), accts = [];
          lines.forEach(function (l) { var ld = l[l.DetailType] || {}; if (!DET[l.DetailType] || !ld.TaxCodeRef) return; var c = cm.code[String(ld.TaxCodeRef.value)];
            if (c && c[ty.side].indexOf(rid) >= 0) { var a = it ? lineAccount(l, it) : null; if (a && accts.indexOf(a) < 0) accts.push(a); } });
          rows.push(Object.assign({}, base, { source: src, type: ty, side: ty.side, account: !it ? null : accts.length === 1 ? accts[0] : accts.length ? 'Multiple: ' + accts.join('; ') : null,
            net: r2(sg * (Number(d.NetAmountTaxable) || 0)), gst: r2(sg * (Number(x.Amount) || 0)) }));
        });
      });
    });
    var pct = {}; rows.forEach(function (r) { if (r.type.pct != null) pct[r.type.key] = r.type.pct; }); // a journal line carries no rate: take it from the same rate's tax lines
    rows.forEach(function (r) { if (r.type.pct == null && pct[r.type.key] != null) r.type.pct = pct[r.type.key]; r.gross = r2(r.net + r.gst); r.month = String(r.date || '').slice(0, 7); r.typeLabel = r.type.name + (r.type.pct != null ? ' ' + r.type.pct + '%' : '') + ' · ' + r.type.code; });
    return { rows: rows, docs: docs, counts: counts, trunc: trunc, codes: cm };
  }
  // the named document checks every report shows
  function docChecks(b, money) {
    var bad = b.docs.filter(function (d) { return d.total != null && d.tax != null && Math.abs(d.total - r2(d.lines + d.tax)) > 0.01; }), badT = b.docs.filter(function (d) { return d.tax != null && Math.abs(d.taxLines - d.tax) > 0.01; });
    var n = b.docs.length, nt = Object.keys(b.counts).reduce(function (s, k) { return s + b.counts[k]; }, 0);
    return [
      { name: 'Every document: QuickBooks TotalAmt = Σ line amounts + total tax (Net + GST = Gross)', pass: n ? !bad.length : null, detail: n ? (bad.length ? 'Mismatch: ' + bad.slice(0, 5).map(function (d) { return d.source + ' ' + d.ref + ' (' + money(d.total) + ' vs ' + money(r2(d.lines + d.tax)) + ')'; }).join(', ') : n + ' documents') : 'No documents in the period' },
      { name: 'Every document: Σ tax lines = its total tax', pass: n ? !badT.length : null, detail: n ? (badT.length ? 'Mismatch: ' + badT.slice(0, 5).map(function (d) { return d.source + ' ' + d.ref; }).join(', ') : n + ' documents') : 'No documents in the period' },
      { name: 'Every transaction loaded (no list at the ' + CAP + '-row page cap)', pass: !b.trunc.length, detail: b.trunc.length ? 'Possibly truncated at ' + CAP + ' rows: ' + b.trunc.join(', ') + ' — shorten the period' : nt + ' transactions' }];
  }
  return { where: where, build: build, docChecks: docChecks, ENT: ENT, CAP: CAP };
})();
// <<< TX
QB.app({
  title: 'QuickBooks · BAS Related Transactions and GST', token: null, primary: 'gst_period', company: 'company_info',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-04-01', end_date: '2026-06-30', txn_where: "TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'", basis: 'Accrual', agency_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"type","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter (BAS)'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['type', 'Group by tax type'], ['contact', 'Group by contact'], ['account', 'Group by account']],
  uses: { gst_period: ['start_date', 'end_date', 'basis', 'agency_id'], invoices: ['txn_where'], credit_memos: ['txn_where'], sales_receipts: ['txn_where'], bills: ['txn_where'], vendor_credits: ['txn_where'], purchases: ['txn_where'], journal_entries: ['txn_where'],
    tax_agencies: [], tax_codes: [], items: [], company_info: [] },
  tools: { gst_period: 'get_report_tax_summary (period, for the tax agency)', tax_agencies: 'list_tax_agency', tax_codes: 'list_tax_code', items: 'list_item (income / expense account of item lines)',
    invoices: 'list_invoice', credit_memos: 'list_credit_memo', sales_receipts: 'list_sales_receipt', bills: 'list_bill', vendor_credits: 'list_vendor_credit', purchases: 'list_purchase', journal_entries: 'list_journal_entry', company_info: 'qbo_query (CompanyInfo)' },
  clientNote: '(the connected QuickBooks company: one company per connection — another client needs its own QuickBooks connection)',
  derive: function (inp) { return { txn_where: TX.where(inp.start_date, inp.end_date) }; },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return v == null ? 'N/A — not in source' : QB.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var acc = c.inputs.basis === 'Accrual', per = QB.periodLine(c.inputs.start_date, c.inputs.end_date), hdrPer = per + ' · ' + c.inputs.basis + ' basis · ' + c.currency;
    var ag = QB.taxAgency(c, 'tax_agencies', 'agency_id');
    if (ag.pending) { body.innerHTML = '<p class="muted">Loading GST for ' + QB.h(ag.name) + '…</p>'; return { period: hdrPer }; }
    var usNA = QB.gstUS(c, ['gst_period']);
    if (usNA) { body.innerHTML = '<div class="qb-banner na"><strong>GST does not apply to this company.</strong> ' + QB.h(usNA) + '</div>'; this._x = null; return { checks: [{ name: 'BAS transactions', pass: null, detail: 'N/A — US company (sales tax, no GST)' }], period: hdrPer }; }
    if (!ag.id && c.data.tax_agencies) { body.innerHTML = '<div class="qb-banner na"><strong>No tax agency is set up in QuickBooks.</strong> GST figures are unavailable — not zero.</div>'; this._x = null;
      return { checks: [{ name: 'Tax agency found', pass: null, detail: 'No tax agency in QuickBooks' }], na: ['BAS transactions (no tax agency in QuickBooks)'], period: hdrPer }; }
    if (!c.data.gst_period && !c.errors.gst_period) return { period: hdrPer };
    var b = TX.build(c.data, { codes: 'tax_codes', items: 'items' }), NA = 'N/A — not in source';
    var all = b.rows.filter(function (r) { return r.date >= c.inputs.start_date && r.date <= c.inputs.end_date; }).map(function (r) { return Object.assign({}, r, { acct: r.account || NA }); });
    all.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : String(p.ref).localeCompare(String(q.ref)); });
    var F = self._f = self._f || { type: '', contact: '', account: '' }, view = c.view || 'type';
    var keyOf = { type: function (r) { return (r.side === 'S' ? '1 ' : '2 ') + r.typeLabel; }, contact: function (r) { return r.contact || '(no contact)'; }, account: function (r) { return r.acct; } };
    var labelOf = function (k) { return view === 'type' ? k.slice(2) + (k[0] === '1' ? ' — GST on sales' : ' — GST on purchases') : k; };
    var uniq = function (f) { var o = []; all.forEach(function (r) { var v = f(r); if (o.indexOf(v) < 0) o.push(v); }); return o.sort(); };
    var opts = { type: uniq(function (r) { return r.typeLabel; }), contact: uniq(function (r) { return r.contact || '(no contact)'; }), account: uniq(function (r) { return r.acct; }) };
    ['type', 'contact', 'account'].forEach(function (k) { if (F[k] && opts[k].indexOf(F[k]) < 0) F[k] = ''; });
    var sel = function (k, lbl) { return '<label class="ctl">' + lbl + '<select id="cra-f-' + k + '"><option value="">All</option>' + opts[k].map(function (v) { return '<option' + (F[k] === v ? ' selected' : '') + '>' + QB.h(v) + '</option>'; }).join('') + '</select></label>'; };
    var totSide = function (sd, f) { return r2(QB.sum(all.filter(function (r) { return r.side === sd; }).map(function (r) { return r[f]; }))); };
    var totS = totSide('S', 'gst'), totP = totSide('P', 'gst');
    body.innerHTML = QB.kpis([{ label: 'GST collected', value: totS, sub: per }, { label: 'GST paid', value: totP }, { label: totS - totP < 0 ? 'Net GST refundable' : 'Net GST payable', value: Math.abs(r2(totS - totP)) }, { label: 'Transaction lines', money: false, value: all.length }], c) +
      '<div class="qb-card"><h3>BAS transactions</h3><div class="cra-filters">' + sel('type', 'Tax type') + sel('contact', 'Contact') + sel('account', 'Account') + '</div><div id="cra-tx" class="qb-scroll"></div></div>';
    var td = function (v, num) { return '<td' + (num ? ' class="num"' : '') + '>' + (num ? (v == null ? '' : QB.h(QB.money(v, c.currency, c.display))) : QB.h(v == null ? '' : v)) + '</td>'; };
    var groups = [];
    function table() {
      var shown = all.filter(function (r) { return (!F.type || r.typeLabel === F.type) && (!F.contact || (r.contact || '(no contact)') === F.contact) && (!F.account || r.acct === F.account); });
      var gmap = {}; groups = [];
      shown.forEach(function (r) { var k = keyOf[view](r); if (!gmap[k]) { gmap[k] = { key: k, rows: [] }; groups.push(gmap[k]); } gmap[k].rows.push(r); });
      groups.sort(function (p, q) { return p.key.localeCompare(q.key); });
      var cols = ['Date', 'Source', 'Reference', 'Contact', 'Account'].concat(view === 'type' ? [] : ['Tax type']).concat(['Net', 'GST', 'Gross']), n = cols.length;
      var html = '<table class="qb-stmt"><thead><tr>' + cols.map(function (t, i) { return '<th scope="col"' + (i >= n - 3 ? ' class="num"' : '') + '>' + t + '</th>'; }).join('') + '</tr></thead><tbody>';
      groups.forEach(function (g) {
        g.net = r2(QB.sum(g.rows.map(function (r) { return r.net; }))); g.gst = r2(QB.sum(g.rows.map(function (r) { return r.gst; }))); g.gross = r2(QB.sum(g.rows.map(function (r) { return r.gross; })));
        html += '<tr class="k-header"><td colspan="' + n + '">' + QB.h(labelOf(g.key)) + ' <span class="muted">(' + g.rows.length + ')</span></td></tr>';
        g.rows.forEach(function (r) { html += '<tr class="detail-block">' + td(r.date) + td(r.source) + td(r.ref) + td(r.contact) + td(r.acct) + (view === 'type' ? '' : td(r.typeLabel + (r.side === 'S' ? ' (sales)' : ' (purchases)'))) + td(r.net, 1) + td(r.gst, 1) + td(r.gross, 1) + '</tr>'; });
        html += '<tr class="k-total"><td colspan="' + (n - 3) + '">Total ' + QB.h(labelOf(g.key)) + '</td>' + td(g.net, 1) + td(g.gst, 1) + td(g.gross, 1) + '</tr>';
      });
      if (!groups.length) html += '<tr><td colspan="' + n + '" class="muted">No GST-coded transactions' + (F.type || F.contact || F.account ? ' for these filters' : ' in this period') + '.</td></tr>';
      var fs = function (sd, f) { return r2(QB.sum(shown.filter(function (r) { return r.side === sd; }).map(function (r) { return r[f]; }))); }, filt = F.type || F.contact || F.account ? ' (filtered)' : '';
      html += '</tbody><tfoot><tr class="k-total"><td colspan="' + (n - 3) + '">Total sales side' + filt + '</td>' + td(fs('S', 'net'), 1) + td(fs('S', 'gst'), 1) + td(fs('S', 'gross'), 1) + '</tr>' +
        '<tr class="k-total"><td colspan="' + (n - 3) + '">Total purchases side' + filt + '</td>' + td(fs('P', 'net'), 1) + td(fs('P', 'gst'), 1) + td(fs('P', 'gross'), 1) + '</tr>' +
        '<tr class="k-total"><td colspan="' + (n - 3) + '">Grand total: net GST (collected − paid)' + filt + '</td><td></td>' + td(r2(fs('S', 'gst') - fs('P', 'gst')), 1) + '<td></td></tr></tfoot></table>';
      document.getElementById('cra-tx').innerHTML = html;
    }
    table();
    ['type', 'contact', 'account'].forEach(function (k) { document.getElementById('cra-f-' + k).addEventListener('change', function () { F[k] = this.value; table(); }); });
    // ---- checks
    var tsRep = c.data.gst_period, bas = tsRep && !QB.noData(tsRep) ? QB.bas(tsRep) : null, nil = tsRep && QB.noData(tsRep), tsErr = c.errors.gst_period, checks = [];
    var tie = function (name, mine, theirs) { return { name: name, pass: tsErr ? false : theirs == null ? null : acc ? QB.near(mine, theirs) : null, info: !acc && theirs != null && !tsErr ? true : undefined,
      detail: tsErr ? c.err('gst_period') : theirs == null ? 'N/A — the Tax Summary has no such label' : money(mine) + ' vs ' + money(theirs) + (acc ? '' : ' — transactions are dated by document; QuickBooks\' cash-basis Tax Summary counts payments, so on Cash this is for information') }; };
    if (nil && !all.length) checks.push({ name: 'GST activity in the period (information)', pass: null, info: true, detail: 'None — nil period for ' + (ag.name || 'the tax agency') });
    else if (nil && all.length) checks.push({ name: 'QuickBooks Tax Summary returned GST for the period', pass: false, detail: 'No rows for ' + (ag.name || 'the agency') + ', but ' + all.length + ' GST tax lines exist. ' + QB.GST_UNCONFIRMED });
    else {
      checks.push(tie('Σ GST of the sales tax types = Tax Summary 1A', totS, bas && bas.a1));
      checks.push(tie('Σ GST of the purchase tax types = Tax Summary 1B', totP, bas && bas.b1));
      checks.push(tie('Grand total GST (collected − paid) = net GST of the period (Tax Summary 9)', r2(totS - totP), bas && bas.nine));
    }
    var allG = [], gm = {}; all.forEach(function (r) { var k = keyOf[view](r); if (!gm[k]) { gm[k] = 0; allG.push(k); } gm[k] = r2(gm[k] + r.gst); });
    var sumG = r2(allG.reduce(function (s, k) { return s + (keyOf[view] === keyOf.type ? (k[0] === '1' ? gm[k] : -gm[k]) : 0); }, 0));
    var gS = r2(all.reduce(function (s, r) { return s + (r.side === 'S' ? r.gst : -r.gst); }, 0));
    checks.push({ name: 'Σ group subtotals = grand total', pass: view === 'type' ? QB.near(sumG, gS) : QB.near(r2(allG.reduce(function (s, k) { return s + gm[k]; }, 0)), r2(totS + totP)), detail: allG.length + ' groups (' + view + ')' });
    checks.push({ name: 'Every line: Net + GST = Gross', pass: all.every(function (r) { return QB.near(r.net + r.gst, r.gross); }), detail: all.length + ' lines; each document\'s gross is checked against QuickBooks\' TotalAmt below' });
    var hd = QB.header(tsRep);
    checks.push({ name: 'QuickBooks returned the requested period (Tax Summary)', pass: !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || c.inputs.basis) });
    checks = checks.concat(TX.docChecks(b, money));
    this._x = { all: all, view: view, keyOf: keyOf, labelOf: labelOf, hdrPer: hdrPer, totS: totS, totP: totP };
    var noAcct = all.filter(function (r) { return r.acct === NA; }).length;
    return { checks: checks, period: hdrPer,
      notes: ['Client: the connected QuickBooks company. QuickBooks connects one company per connection; another client needs its own QuickBooks connection.', 'GST Agency: ' + (ag.name || 'N/A') + '.',
        'One line per document and tax rate (QuickBooks keeps tax per document, by rate: TxnTaxDetail), and one per tax-coded journal line. Account = the account of the document lines carrying that tax code (an item line\'s income or expense account); "Multiple" when several accounts share the tax code.',
        'Sources read: invoices, sales receipts, credit notes, bills, spend money (purchases), supplier credits and journals. Refund receipts and deposits are not read (the 12-binding limit); their GST shows only in the Tax Summary tie.',
        'Each list is one page of up to 1,000 transactions; a full page fails the "Every transaction loaded" check rather than giving a short total.', 'Decision support for BAS preparation — not lodgement advice.'],
      na: ['Account codes (transactions carry the account name; the chart of accounts is not loaded within the 12-binding limit)'].concat(noAcct ? [noAcct + ' line(s) with no account on the transaction (e.g. an item with no income / expense account)'] : [], acc ? [] : ['Cash-basis GST by transaction (QuickBooks gives cash-basis GST only as Tax Summary totals; lines are by document date)']) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'BAS Related Transactions and GST', s: 'bold' }], [x.hdrPer], []];
    var rows = head.concat([['Group', 'Date', 'Source', 'Reference', 'Contact', 'Account', 'Tax type', 'Side', 'Net', 'GST', 'Gross'].map(function (t) { return { v: t, s: 'bold' }; })]), groups = {}, order = [];
    x.all.forEach(function (r) { var k = x.keyOf[x.view](r); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
    order.sort().forEach(function (k) { var g = groups[k], s = function (f) { return Math.round(g.reduce(function (a, r) { return a + r[f]; }, 0) * 100) / 100; };
      g.forEach(function (r) { rows.push([x.labelOf(k), r.date, r.source, r.ref, r.contact, r.acct, r.typeLabel, r.side === 'S' ? 'Sales' : 'Purchases', { v: r.net, s: 'money' }, { v: r.gst, s: 'money' }, { v: r.gross, s: 'money' }]); });
      rows.push([{ v: 'Total ' + x.labelOf(k), s: 'bold' }, '', '', '', '', '', '', '', { v: s('net'), s: 'moneyBold' }, { v: s('gst'), s: 'moneyBold' }, { v: s('gross'), s: 'moneyBold' }]); });
    rows.push([], [{ v: 'GST collected', s: 'bold' }, '', '', '', '', '', '', '', '', { v: x.totS, s: 'moneyBold' }], [{ v: 'GST paid', s: 'bold' }, '', '', '', '', '', '', '', '', { v: x.totP, s: 'moneyBold' }], [{ v: 'Net GST (collected − paid)', s: 'bold' }, '', '', '', '', '', '', '', '', { v: Math.round((x.totS - x.totP) * 100) / 100, s: 'moneyBold' }]);
    return [{ name: 'BAS transactions', widths: [36, 11, 16, 12, 26, 28, 28, 10, 14, 14, 14], rows: rows }];
  }
});

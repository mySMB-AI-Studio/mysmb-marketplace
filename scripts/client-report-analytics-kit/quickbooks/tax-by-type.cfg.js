// CRA-05 Summary of Tax Amounts by Type — QuickBooks Online. The client is the connected QuickBooks company (one company per
// connection). QuickBooks' Tax Summary gives the BAS labels (1A / 1B / 9), not tax codes, and does not summarise by month, so the
// tax-type × month grid is rebuilt from the GST-coded transactions (TxnTaxDetail tax lines) and tied back to the Tax Summary for the
// agency and to the GST account on the balance sheet.
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
  title: 'QuickBooks · Summary of Tax Amounts by Type', token: null, primary: 'gst_period', company: 'company_info',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-04-01', end_date: '2026-06-30', bs_from: '2026-03-01', txn_where: "TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'", basis: 'Accrual', agency_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter (BAS)'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['gst', 'GST amounts'], ['net', 'Net amounts']],
  uses: { gst_period: ['start_date', 'end_date', 'basis', 'agency_id'], bs_months: ['bs_from', 'end_date', 'basis'], invoices: ['txn_where'], credit_memos: ['txn_where'], sales_receipts: ['txn_where'], bills: ['txn_where'],
    vendor_credits: ['txn_where'], purchases: ['txn_where'], journal_entries: ['txn_where'], tax_agencies: [], tax_codes: [], company_info: [] },
  tools: { gst_period: 'get_report_tax_summary (period, for the tax agency)', tax_agencies: 'list_tax_agency', tax_codes: 'list_tax_code', bs_months: 'get_report_balance_sheet (by month: GST account)',
    invoices: 'list_invoice', credit_memos: 'list_credit_memo', sales_receipts: 'list_sales_receipt', bills: 'list_bill', vendor_credits: 'list_vendor_credit', purchases: 'list_purchase', journal_entries: 'list_journal_entry', company_info: 'qbo_query (CompanyInfo)' },
  clientNote: '(the connected QuickBooks company: one company per connection — another client needs its own QuickBooks connection)',
  derive: function (inp) { var s = QB.parse(inp.start_date); return { bs_from: QB.iso(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1))), txn_where: TX.where(inp.start_date, inp.end_date) }; },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return v == null ? 'N/A — not in source' : QB.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var acc = c.inputs.basis === 'Accrual', per = QB.periodLine(c.inputs.start_date, c.inputs.end_date), hdrPer = per + ' · ' + c.inputs.basis + ' basis · ' + c.currency;
    var ag = QB.taxAgency(c, 'tax_agencies', 'agency_id');
    if (ag.pending) { body.innerHTML = '<p class="muted">Loading GST for ' + QB.h(ag.name) + '…</p>'; return { period: hdrPer }; }
    var usNA = QB.gstUS(c, ['gst_period']);
    if (usNA) { body.innerHTML = '<div class="qb-banner na"><strong>GST does not apply to this company.</strong> ' + QB.h(usNA) + '</div>'; this._x = null; return { checks: [{ name: 'GST by tax type', pass: null, detail: 'N/A — US company (sales tax, no GST)' }], period: hdrPer }; }
    if (!ag.id && c.data.tax_agencies) { body.innerHTML = '<div class="qb-banner na"><strong>No tax agency is set up in QuickBooks.</strong> GST figures are unavailable — not zero. Set one up in QuickBooks › Taxes › GST.</div>'; this._x = null;
      return { checks: [{ name: 'Tax agency found', pass: null, detail: 'No tax agency in QuickBooks' }], na: ['GST by tax type (no tax agency in QuickBooks)'], period: hdrPer }; }
    if (!c.data.gst_period && !c.errors.gst_period) return { period: hdrPer };
    // ---- months of the period
    var months = [], s = QB.parse(c.inputs.start_date), e = QB.parse(c.inputs.end_date), y = s.getUTCFullYear(), m = s.getUTCMonth();
    while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) { months.push({ key: y + '-' + String(m + 1).padStart(2, '0'), label: QB.MONTHS[m].slice(0, 3) + ' ' + y }); m++; if (m > 11) { m = 0; y++; } }
    var b = TX.build(c.data, { codes: 'tax_codes' }), rows = b.rows.filter(function (r) { return r.date >= c.inputs.start_date && r.date <= c.inputs.end_date; });
    // ---- tax types: rows = tax rates (sales first), cells = Σ GST (or net) per month
    var types = {}, order = [];
    rows.forEach(function (r) { var k = r.type.key + '|' + r.side; if (!types[k]) { types[k] = { key: k, label: r.typeLabel, name: r.type.name, code: r.type.code, pct: r.type.pct, side: r.side, gst: {}, net: {}, gstTot: 0, netTot: 0 }; order.push(k); }
      var t = types[k]; t.gst[r.month] = r2((t.gst[r.month] || 0) + r.gst); t.net[r.month] = r2((t.net[r.month] || 0) + r.net); t.gstTot = r2(t.gstTot + r.gst); t.netTot = r2(t.netTot + r.net); });
    order.sort(function (p, q) { var a = types[p], z = types[q]; return a.side === z.side ? a.label.localeCompare(z.label) : a.side === 'S' ? -1 : 1; });
    var side = function (sd, f) { var o = {}; months.forEach(function (mo) { o[mo.key] = r2(order.filter(function (k) { return types[k].side === sd; }).reduce(function (s2, k) { return s2 + (types[k][f][mo.key] || 0); }, 0)); }); return o; };
    var colS = side('S', 'gst'), colP = side('P', 'gst'), totS = r2(QB.sum(rows.filter(function (r) { return r.side === 'S'; }).map(function (r) { return r.gst; }))), totP = r2(QB.sum(rows.filter(function (r) { return r.side === 'P'; }).map(function (r) { return r.gst; })));
    var tsRep = c.data.gst_period, bas = tsRep && !QB.noData(tsRep) ? QB.bas(tsRep) : null, nil = tsRep && QB.noData(tsRep);
    // ---- GST account on the balance sheet, month ends (first column = the month before the period)
    var bsr = c.data.bs_months, bcols = bsr ? QB.cols(bsr).filter(function (x) { return x.i > 0 && !/^total$/i.test(x.title); }) : [], gl = bsr ? QB.find(QB.walk(bsr), null, QB.GST_LIAB_RE, 'row') : null;
    var gAt = function (i) { return gl && bcols[i] ? gl.values[bcols[i].i - 1] : null; }, open = gAt(0), close = gAt(bcols.length - 1), move = open != null && close != null ? r2(close - open) : null;
    // ---- page
    var view = c.view === 'net' ? 'net' : 'gst', flt = self._flt || 'all';
    if (flt !== 'all' && !types[flt]) flt = self._flt = 'all';
    body.innerHTML = QB.kpis([{ label: 'GST collected', value: totS, sub: per }, { label: 'GST paid', value: totP }, { label: totS - totP < 0 ? 'Net GST refundable' : 'Net GST payable', value: Math.abs(r2(totS - totP)) }, { label: 'Tax types used', money: false, value: order.length }], c) +
      '<div class="qb-card"><h3>' + (view === 'net' ? 'Net amount' : 'GST') + ' by tax type and month</h3><label class="ctl">Tax type<select id="cra-type"><option value="all">All tax types</option>' + order.map(function (k) { return '<option value="' + QB.h(k) + '"' + (flt === k ? ' selected' : '') + '>' + QB.h(types[k].label) + '</option>'; }).join('') + '</select></label><div id="cra-grid" class="qb-scroll"></div></div>' +
      '<div class="qb-card detail-block"><h3>GST collected vs GST paid by month</h3><div id="cra-bars"></div></div>' +
      '<div class="qb-card"><h3>Reconciliation</h3><div id="cra-rec"></div></div>';
    var mny = function (v) { return '<td class="num">' + (v == null ? '' : QB.h(QB.money(v, c.currency, c.display))) + '</td>'; };
    function grid() {
      var f = view, shown = order.filter(function (k) { return flt === 'all' || k === flt; }), html = '<table class="qb-stmt"><thead><tr><th scope="col">Tax type</th><th scope="col">Code</th><th scope="col" class="num">Rate</th>' + months.map(function (mo) { return '<th scope="col" class="num">' + QB.h(mo.label) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>';
      [['S', 'GST on sales (collected)'], ['P', 'GST on purchases (paid)']].forEach(function (sd) {
        var ks = shown.filter(function (k) { return types[k].side === sd[0]; }); if (!ks.length) return;
        html += '<tr class="k-header"><td colspan="' + (months.length + 4) + '">' + QB.h(sd[1]) + '</td></tr>';
        ks.forEach(function (k) { var t = types[k]; html += '<tr><td style="padding-left:26px">' + QB.h(t.name) + '</td><td>' + QB.h(t.code) + '</td><td class="num">' + (t.pct == null ? '' : t.pct + '%') + '</td>' + months.map(function (mo) { return mny(t[f][mo.key] || 0); }).join('') + mny(t[f + 'Tot']) + '</tr>'; });
        html += '<tr class="k-total"><td colspan="3">Total ' + QB.h(sd[1]) + (flt !== 'all' ? ' (filtered)' : '') + '</td>' + months.map(function (mo) { return mny(r2(ks.reduce(function (s2, k) { return s2 + (types[k][f][mo.key] || 0); }, 0))); }).join('') + mny(r2(ks.reduce(function (s2, k) { return s2 + types[k][f + 'Tot']; }, 0))) + '</tr>';
      });
      if (f === 'gst' && flt === 'all') html += '<tr class="k-total"><td colspan="3">Net GST (collected − paid)</td>' + months.map(function (mo) { return mny(r2(colS[mo.key] - colP[mo.key])); }).join('') + mny(r2(totS - totP)) + '</tr>';
      if (!order.length) html += '<tr><td colspan="' + (months.length + 4) + '" class="muted">No GST-coded transactions in this period.</td></tr>';
      document.getElementById('cra-grid').innerHTML = html + '</tbody></table>';
    }
    grid();
    document.getElementById('cra-type').addEventListener('change', function () { self._flt = flt = this.value; grid(); });
    QB.bars(document.getElementById('cra-bars'), { title: 'GST collected vs GST paid by month', labels: months.map(function (mo) { return mo.label; }), series: [{ name: 'GST collected', values: months.map(function (mo) { return colS[mo.key]; }) }, { name: 'GST paid', values: months.map(function (mo) { return colP[mo.key]; }) }] }, c);
    var rec = [{ k: 'GST collected — transactions', v: totS }, { k: '1A GST on sales — QuickBooks Tax Summary', v: bas ? bas.a1 : nil ? 0 : null }, { k: 'GST paid — transactions', v: totP }, { k: '1B GST on purchases — QuickBooks Tax Summary', v: bas ? bas.b1 : nil ? 0 : null },
      { k: 'Net GST — transactions', v: r2(totS - totP) }, { k: '9 Payment / refund — QuickBooks Tax Summary', v: bas ? bas.nine : nil ? 0 : null }, { k: 'GST account movement (' + (gl ? gl.label : 'GST account') + ')', v: move }, { k: 'Difference (net GST − account movement)', v: move == null ? null : r2(totS - totP - move) }];
    QB.grid(document.getElementById('cra-rec'), { columns: [{ key: 'k', title: '' }, { key: 'v', title: 'Amount', fmt: function (v) { return money(v); } }], rows: rec }, c);
    // ---- checks
    var checks = [], tsErr = c.errors.gst_period;
    var tie = function (name, mine, theirs) { return { name: name, pass: tsErr ? false : theirs == null ? null : acc ? QB.near(mine, theirs) : null, info: !acc && theirs != null && !tsErr ? true : undefined,
      detail: tsErr ? c.err('gst_period') : theirs == null ? 'N/A — the Tax Summary has no such label' : money(mine) + ' vs ' + money(theirs) + (acc ? '' : ' — transactions are dated by document; QuickBooks\' cash-basis Tax Summary counts payments, so on Cash this is for information') }; };
    if (nil && !rows.length) checks.push({ name: 'GST activity in the period (information)', pass: null, info: true, detail: 'None — nil period for ' + (ag.name || 'the tax agency') });
    else if (nil && rows.length) checks.push({ name: 'QuickBooks Tax Summary returned GST for the period', pass: false, detail: 'No rows for ' + (ag.name || 'the agency') + ', but ' + rows.length + ' GST tax lines exist. ' + QB.GST_UNCONFIRMED });
    else {
      checks.push(tie('Σ GST collected (sales tax types) = Tax Summary 1A', totS, bas && bas.a1));
      checks.push(tie('Σ GST paid (purchase tax types) = Tax Summary 1B', totP, bas && bas.b1));
      checks.push(tie('Net GST = Tax Summary label 9', r2(totS - totP), bas && bas.nine));
      var named = order.map(function (k) { var t = types[k], hit = bas && bas.lines.filter(function (l) { return l.kind !== 'header' && (l.label.toLowerCase() === t.name.toLowerCase()); })[0]; return hit ? { t: t, v: QB.val(hit) } : null; }).filter(Boolean);
      checks.push({ name: 'Each tax type\'s total = its Tax Summary row', pass: !named.length || !acc ? null : named.every(function (n) { return QB.near(n.t.gstTot, n.v); }),
        detail: named.length ? named.map(function (n) { return n.t.name + ' ' + money(n.t.gstTot) + ' vs ' + money(n.v); }).join('; ') : 'N/A — QuickBooks\' Tax Summary reports BAS labels, not tax codes; the types tie in total to 1A / 1B above' });
    }
    var outside = b.rows.filter(function (r) { return r.date < c.inputs.start_date || r.date > c.inputs.end_date; }).length, monthOk = order.every(function (k) { var t = types[k]; return QB.near(r2(months.reduce(function (s2, mo) { return s2 + (t.gst[mo.key] || 0); }, 0)), t.gstTot) && QB.near(r2(months.reduce(function (s2, mo) { return s2 + (t.net[mo.key] || 0); }, 0)), t.netTot); });
    checks.push({ name: 'Σ months = period total for every tax type (GST and net)', pass: !outside && monthOk, detail: outside ? outside + ' transactions dated outside the period were returned' : order.length + ' tax types' });
    var diff = move == null ? null : r2(totS - totP - move);
    checks.push(!acc ? { name: 'Net GST = GST account movement', pass: null, detail: 'N/A on Cash basis (the account reconciles on accrual)' } :
      c.errors.bs_months ? { name: 'Net GST = GST account movement (accrual)', pass: false, detail: c.err('bs_months') } :
      move == null ? { name: 'Net GST = GST account movement (accrual)', pass: null, detail: 'N/A — no GST liabilities account on the balance sheet' } :
      !diff ? { name: 'Net GST = GST account movement (accrual)', pass: true, detail: money(move) + ' (' + money(open) + ' → ' + money(close) + ')' } :
      { name: 'Net GST vs GST account movement (accrual, information)', pass: null, info: true, detail: 'Difference ' + money(diff) + ': the account moved ' + money(move) + ' — payments to / refunds from the ATO, manual journals or opening adjustments posted to the GST account. Review the GST account in the General Ledger.' });
    var hd = QB.header(tsRep);
    checks.push({ name: 'QuickBooks returned the requested period (Tax Summary)', pass: !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || c.inputs.basis) });
    checks = checks.concat(TX.docChecks(b, money));
    this._x = { months: months, types: types, order: order, colS: colS, colP: colP, totS: totS, totP: totP, rec: rec, hdrPer: hdrPer };
    return { checks: checks, period: hdrPer,
      notes: ['Client: the connected QuickBooks company. QuickBooks connects one company per connection; another client needs its own QuickBooks connection.', 'GST Agency: ' + (ag.name || 'N/A') + '.',
        'Tax types = QuickBooks tax rates (sales and purchase rates of each tax code), rebuilt from each transaction\'s tax lines (TxnTaxDetail) and journal tax lines, by transaction date; tied in total to QuickBooks\' Tax Summary (1A, 1B, 9).',
        'Sources read: invoices, sales receipts, credit notes, bills, spend money (purchases), supplier credits and journals. Refund receipts and deposits are not read (the 12-binding limit); GST on them shows only in the Tax Summary tie.',
        'Each list is one page of up to 1,000 transactions; a full page fails the "Every transaction loaded" check rather than giving a short total.', 'Decision support for BAS preparation — not lodgement advice.'],
      na: acc ? [] : ['Cash-basis GST by tax type (QuickBooks gives cash-basis GST only as Tax Summary totals; the grid is by document date)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (n) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Summary of Tax Amounts by Type — ' + n, s: 'bold' }], [x.hdrPer], []]; };
    var mv = function (v, b) { return v == null ? 'N/A — not in source' : { v: v, s: b ? 'moneyBold' : 'money' }; };
    var table = function (f, n) { var rows = head(n).concat([[{ v: 'Tax type', s: 'bold' }, { v: 'Code', s: 'bold' }, { v: 'Rate %', s: 'bold' }].concat(x.months.map(function (mo) { return { v: mo.label, s: 'bold' }; }), [{ v: 'Total', s: 'bold' }])]);
      [['S', 'GST on sales (collected)'], ['P', 'GST on purchases (paid)']].forEach(function (sd) { var ks = x.order.filter(function (k) { return x.types[k].side === sd[0]; }); if (!ks.length) return; rows.push([{ v: sd[1], s: 'bold' }]);
        ks.forEach(function (k) { var t = x.types[k]; rows.push([t.name, t.code, t.pct == null ? '' : { v: t.pct, s: 'none' }].concat(x.months.map(function (mo) { return mv(t[f][mo.key] || 0); }), [mv(t[f + 'Tot'], true)])); });
        rows.push([{ v: 'Total ' + sd[1], s: 'bold' }, '', ''].concat(x.months.map(function (mo) { return mv(Math.round(ks.reduce(function (s2, k) { return s2 + (x.types[k][f][mo.key] || 0); }, 0) * 100) / 100, true); }), [mv(Math.round(ks.reduce(function (s2, k) { return s2 + x.types[k][f + 'Tot']; }, 0) * 100) / 100, true)])); });
      return { name: n, widths: [30, 10, 8].concat(x.months.map(function () { return 14; }), [16]), rows: rows }; };
    return [table('gst', 'GST by tax type'), table('net', 'Net by tax type'),
      { name: 'Collected vs paid', widths: [16, 16, 16, 16], rows: head('Collected vs paid').concat([[{ v: 'Month', s: 'bold' }, { v: 'GST collected', s: 'bold' }, { v: 'GST paid', s: 'bold' }, { v: 'Net GST', s: 'bold' }]], x.months.map(function (mo) { return [mo.label, mv(x.colS[mo.key]), mv(x.colP[mo.key]), mv(Math.round((x.colS[mo.key] - x.colP[mo.key]) * 100) / 100)]; }), [[{ v: 'Total', s: 'bold' }, mv(x.totS, true), mv(x.totP, true), mv(Math.round((x.totS - x.totP) * 100) / 100, true)]]) },
      { name: 'Reconciliation', widths: [56, 18], rows: head('Reconciliation').concat(x.rec.map(function (r) { return [r.k, mv(r.v)]; })) }];
  }
});

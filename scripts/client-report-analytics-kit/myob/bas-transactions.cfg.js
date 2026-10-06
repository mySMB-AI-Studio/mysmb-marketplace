// CRA-07 BAS Related Transactions and GST (MYOB) — Client Report Analytics. Every invoice, bill and spend money line of the period with
// its tax code, contact, source and GL account, grouped by tax type (or by contact / account), with totals that tie to MYOB's tax code
// summary for the same period. MYOB's API returns the tax per document, not per line: each document's GST (TotalTax) is split across its
// lines by their tax codes' rates, so a document's lines always add up to its own net, GST and gross. Receive money has no list tool on the
// connector (nor do pay runs or general journals with tax): whatever they carry shows as a reconciling difference against the summary.
// Accrual basis only: the line tools list documents by their date.
var CRA_F = { tax: '', contact: '', account: '' };
var CRA = MK.app({
  title: 'MYOB BAS Related Transactions and GST', primary: 'gst', files: 'company_files', optional: ['tax_codes'],
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"tax"}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter (BAS)'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  uses: { inv_lines: ['from_date', 'to_date', 'company_file'], bill_lines: ['from_date', 'to_date', 'company_file'], spend: ['from_date', 'to_date', 'company_file'], invoices: ['from_date', 'to_date', 'company_file'], bills: ['from_date', 'to_date', 'company_file'],
    gst: ['from_date', 'to_date', 'company_file'], tax_codes: ['company_file'], accounts: ['company_file'], company_files: [] },
  tools: { inv_lines: 'list_invoice_lines (every sales invoice line)', bill_lines: 'list_bill_lines (every bill line)', spend: 'list_spend_money (spend money and its lines)', invoices: 'list_invoices (each invoice’s GST and totals)', bills: 'list_bills (each bill’s GST and totals)',
    gst: 'get_gst_summary (tax code summary, accrual)', tax_codes: 'list_tax_codes (names and rates)', accounts: 'list_accounts', company_files: 'list_company_files' },
  views: [['tax', 'Grouped by tax type'], ['contact', 'Grouped by contact'], ['account', 'Grouped by account']],
  render: function (c) {
    var body = c.body, d = c.display, h = MK.h, money = function (v) { return MK.money(v, c.currency, d); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var I = c.inputs, from = I.from_date, to = I.to_date, self = this;
    var need = ['inv_lines', 'bill_lines', 'spend', 'gst'].filter(function (id) { return c.errors[id]; });
    if (need.length === 4) { body.innerHTML = '<p class="mk-err">' + h(c.err('gst')) + '</p>'; self._x = null; return { checks: [{ name: 'MYOB data loaded', pass: false, detail: c.err('gst') }] }; }
    if (['inv_lines', 'bill_lines', 'spend', 'gst'].some(function (id) { return !c.data[id] && !c.errors[id]; })) return {};
    // ---- tax codes: names and rates (list_tax_codes; the summary's TaxRate if the list has no rate)
    var codes = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t && t.Code) codes[String(t.Code).toUpperCase()] = { name: t.Description || '', rate: MK.num(t.Rate) }; });
    var S = {}; ((c.data.gst && c.data.gst.TaxCodeBreakdown) || []).forEach(function (r) { var k = String((r.TaxCode || {}).Code || '?').toUpperCase(), x = S[k] || (S[k] = { s: 0, p: 0, tc: 0, tp: 0, rate: null });
      x.s = r2(x.s + (MK.num(r.SalesTotal) || 0)); x.p = r2(x.p + (MK.num(r.PurchasesTotal) || 0)); x.tc = r2(x.tc + (MK.num(r.TaxCollected) || 0)); x.tp = r2(x.tp + (MK.num(r.TaxPaid) || 0)); if (r.TaxRate != null) x.rate = MK.num(r.TaxRate); });
    var rateOf = function (k) { return codes[k] && codes[k].rate != null ? codes[k].rate : S[k] && S[k].rate != null ? S[k].rate : null; };
    // ---- documents → lines with net, GST and gross
    var out = [], docIssues = [], unknownRate = {}, fromRate = 0, acct = function (a) { return a ? (a.DisplayID ? a.DisplayID + ' ' : '') + (a.Name || '') : ''; };
    function split(doc, lines) { // doc: {tax, gross, incl, src, ref, date, contact, side, header}
      var w = lines.map(function (l) { var k = l.code, rt = rateOf(k); if (rt == null) { if (k) unknownRate[k] = 1; rt = 0; } return rt > 0 ? l.amt * rt / (doc.incl ? 100 + rt : 100) : 0; }), W = w.reduce(function (a, x) { return a + x; }, 0);
      var g = lines.map(function () { return 0; });
      if (doc.tax == null) { fromRate++; g = w.map(r2); }
      else if (Math.abs(W) > 1e-9) { g = w.map(function (x) { return r2(doc.tax * x / W); }); var big = 0; w.forEach(function (x, i) { if (Math.abs(x) > Math.abs(w[big])) big = i; }); g[big] = r2(g[big] + doc.tax - MK.sum(g)); }
      else if (Math.abs(doc.tax) >= 0.005) docIssues.push(doc.src + ' ' + doc.ref + ': GST ' + money(doc.tax) + ' but no line with a GST rate');
      var nets = 0, gross = 0;
      lines.forEach(function (l, i) { var net = doc.incl ? r2(l.amt - g[i]) : r2(l.amt), gr = r2(net + g[i]); nets += net; gross += gr;
        out.push({ date: doc.date, src: doc.src, ref: doc.ref, contact: doc.contact || '', account: l.account, code: l.code || '(no tax code)', side: doc.side, net: net, gst: g[i], gross: gr, desc: l.desc }); });
      if (doc.gross != null && !MK.near(r2(gross), doc.gross)) docIssues.push(doc.src + ' ' + doc.ref + ': lines ' + money(r2(gross)) + ' vs document ' + money(doc.gross));
    }
    var headers = function (id) { var m = {}; MK.items(c.data[id]).forEach(function (x) { if (x && x.UID) m[x.UID] = x; }); return m; };
    var docsFrom = function (id, side, hid, ckey, label) {
      var H = headers(hid), by = {}, order = [], v = c.data[id]; MK.items(v).forEach(function (l) { var u = l.DocumentUID || l.Number; if (!by[u]) { by[u] = []; order.push(u); } by[u].push(l); });
      order.forEach(function (u) { var ls = by[u], f = ls[0], hd = H[u], tot = hd ? MK.num(hd.TotalAmount) : null, neg = tot != null ? tot < 0 : MK.sum(ls.map(function (l) { return MK.num(l.Total) || 0; })) < 0;
        split({ tax: hd ? MK.num(hd.TotalTax) : null, gross: tot, incl: hd ? !!hd.IsTaxInclusive : !!f.IsTaxInclusive, src: neg ? label[1] : label[0], ref: f.Number || '', date: MK.isoDate(f.Date), contact: (f[ckey] || {}).Name || '', side: side },
          ls.map(function (l) { return { amt: MK.num(l.Total) || 0, code: String((l.TaxCode || {}).Code || '').toUpperCase(), account: l.Type === 'Freight' && !l.Account ? 'Freight' : acct(l.Account), desc: l.Description || '' }; })); });
      return { docs: order.length, headers: Object.keys(H).length, missing: Object.keys(H).filter(function (u) { return !by[u]; }), trunc: !!(v && v.Truncated), errors: v && v.Errors ? v.Errors : null };
    };
    var INV = c.data.inv_lines ? docsFrom('inv_lines', 's', 'invoices', 'Customer', ['Invoice', 'Credit note']) : null, BIL = c.data.bill_lines ? docsFrom('bill_lines', 'p', 'bills', 'Supplier', ['Bill', 'Supplier credit']) : null;
    var SP = c.data.spend ? MK.items(c.data.spend) : null;
    if (SP) SP.forEach(function (t) { split({ tax: MK.num(t.TotalTax), gross: MK.num(t.AmountPaid), incl: !!t.IsTaxInclusive, src: 'Spend money', ref: t.PaymentNumber || '', date: MK.isoDate(t.Date), contact: (t.Contact || {}).Name || '', side: 'p' },
      (t.Lines || []).map(function (l) { return { amt: MK.num(l.Amount) || 0, code: String((l.TaxCode || {}).Code || '').toUpperCase(), account: acct(l.Account), desc: l.Memo || '' }; })); });
    out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.ref).localeCompare(String(b.ref)); });
    // ---- totals per tax code (listed) vs the summary
    var T = {}; out.forEach(function (r) { var x = T[r.code] || (T[r.code] = { s: 0, p: 0, tc: 0, tp: 0, n: 0 }); x.n++; if (r.side === 's') { x.s = r2(x.s + r.net); x.tc = r2(x.tc + r.gst); } else { x.p = r2(x.p + r.net); x.tp = r2(x.tp + r.gst); } });
    var allCodes = {}; Object.keys(T).concat(Object.keys(S)).forEach(function (k) { allCodes[k] = 1; }); allCodes = Object.keys(allCodes).sort();
    var rec = allCodes.map(function (k) { var t = T[k] || { s: 0, p: 0, tc: 0, tp: 0 }, s = S[k] || { s: 0, p: 0, tc: 0, tp: 0 }, rt = rateOf(k), dv = rt > 0 ? 100 + rt : 100;
      var sn = r2(s.s - s.tc), pn = r2(s.p - s.tp); // MYOB's summary totals include GST
      return { code: k, name: (codes[k] || {}).name || '', tc: t.tc, stc: s.tc, dtc: r2(s.tc - t.tc), tp: t.tp, stp: s.tp, dtp: r2(s.tp - t.tp), ns: t.s, sns: sn, np: t.p, snp: pn }; });
    var G = { tc: MK.sum(out.filter(function (r) { return r.side === 's'; }).map(function (r) { return r.gst; })), tp: MK.sum(out.filter(function (r) { return r.side === 'p'; }).map(function (r) { return r.gst; })) };
    var SG = { tc: MK.sum(Object.keys(S).map(function (k) { return S[k].tc; })), tp: MK.sum(Object.keys(S).map(function (k) { return S[k].tp; })) };
    // ---- the page: filters (client-side), the grouped table, the tie to the summary
    var view = c.view || 'tax', keyOf = function (r) { return view === 'contact' ? r.contact || '(no contact)' : view === 'account' ? r.account || '(no account)' : r.code; };
    var labelOf = function (k) { if (view !== 'tax') return k; var rt = rateOf(k); return k + (codes[k] && codes[k].name ? ' — ' + codes[k].name : '') + (rt != null ? ' (' + rt + '%)' : ''); };
    var uniq = function (f) { var o = {}; out.forEach(function (r) { o[f(r)] = 1; }); return Object.keys(o).sort(); };
    var shown = out.filter(function (r) { return (!CRA_F.tax || r.code === CRA_F.tax) && (!CRA_F.contact || r.contact === CRA_F.contact) && (!CRA_F.account || r.account === CRA_F.account); });
    var groups = {}, gOrder = []; shown.forEach(function (r) { var k = keyOf(r); if (!groups[k]) { groups[k] = []; gOrder.push(k); } groups[k].push(r); }); gOrder.sort();
    var sel = function (id, label, list, cur) { return '<label class="ctl">' + h(label) + ' <select id="' + id + '"><option value="">All</option>' + list.map(function (v) { return '<option value="' + h(v) + '"' + (v === cur ? ' selected' : '') + '>' + h(v) + '</option>'; }).join('') + '</select></label>'; };
    var mtd = function (v) { return '<td class="num">' + money(v) + '</td>'; }, tot = function (rs) { return { net: MK.sum(rs.map(function (r) { return r.net; })), gst: MK.sum(rs.map(function (r) { return r.gst; })), gross: MK.sum(rs.map(function (r) { return r.gross; })) }; };
    var subRow = function (label, rs) { var t0 = tot(rs); return '<tr class="k-total"><td colspan="5">' + h(label) + '</td>' + mtd(t0.net) + mtd(t0.gst) + mtd(t0.gross) + '</tr>'; };
    var tb = gOrder.map(function (k) { var rs = groups[k], sl = rs.filter(function (r) { return r.side === 's'; }), pu = rs.filter(function (r) { return r.side === 'p'; });
      return '<tr class="k-header"><td colspan="8">' + h(labelOf(k)) + ' · ' + rs.length + ' line' + (rs.length === 1 ? '' : 's') + '</td></tr>' +
        rs.map(function (r) { return '<tr class="detail-block"><td>' + h(r.date) + '</td><td>' + h(r.src) + '</td><td>' + h(r.ref) + '</td><td>' + h(r.contact) + '</td><td>' + h(view === 'account' ? r.code : r.account) + '</td>' + mtd(r.net) + mtd(r.gst) + mtd(r.gross) + '</tr>'; }).join('') +
        (sl.length ? subRow(k + ' — sales (GST collected)', sl) : '') + (pu.length ? subRow(k + ' — purchases (GST paid)', pu) : ''); }).join('');
    var shS = shown.filter(function (r) { return r.side === 's'; }), shP = shown.filter(function (r) { return r.side === 'p'; });
    var filtered = CRA_F.tax || CRA_F.contact || CRA_F.account;
    body.innerHTML = MK.kpis([{ label: 'GST collected (listed)', value: G.tc }, { label: 'GST paid (listed)', value: G.tp }, { label: 'Net GST (listed)', value: r2(G.tc - G.tp) }, { label: 'Lines', money: false, value: out.length }], c) +
      '<div class="mk-card"><h3>BAS related transactions — ' + h(MK.periodLine(from, to)) + '</h3><div class="mk-grid2">' + sel('cra-f-tax', 'Tax type', uniq(function (r) { return r.code; }), CRA_F.tax) + sel('cra-f-contact', 'Contact', uniq(function (r) { return r.contact; }), CRA_F.contact) + sel('cra-f-account', 'Account', uniq(function (r) { return r.account; }), CRA_F.account) + '</div>' +
      (filtered ? '<p class="muted">Filtered: ' + shown.length + ' of ' + out.length + ' lines. The checks always cover every line.</p>' : '') +
      '<div class="mk-scroll"><table class="mk-grid" id="cra-tx"><thead><tr><th scope="col">Date</th><th scope="col">Source</th><th scope="col">Reference</th><th scope="col">Contact</th><th scope="col">' + (view === 'account' ? 'Tax code' : 'Account') + '</th><th scope="col" class="num">Net</th><th scope="col" class="num">GST</th><th scope="col" class="num">Gross</th></tr></thead><tbody>' +
      (tb || '<tr><td colspan="8" class="muted">No invoice, bill or spend money lines in MYOB for this period.</td></tr>') + '</tbody><tfoot>' + subRow('Grand total — sales (GST collected)', shS) + subRow('Grand total — purchases (GST paid)', shP) +
      '<tr class="k-total"><td colspan="6">Net GST (collected − paid)</td>' + mtd(r2(tot(shS).gst - tot(shP).gst)) + '<td></td></tr></tfoot></table></div></div>' +
      '<div class="mk-card"><h3>Tie to MYOB’s tax code summary (accrual)</h3><div class="mk-scroll"><table class="mk-grid" id="cra-rec"><thead><tr><th scope="col">Tax code</th><th scope="col" class="num">GST collected (lines)</th><th scope="col" class="num">Summary</th><th scope="col" class="num">Not listed</th><th scope="col" class="num">GST paid (lines)</th><th scope="col" class="num">Summary</th><th scope="col" class="num">Not listed</th></tr></thead><tbody>' +
      rec.map(function (x) { return '<tr><td>' + h(x.code + (x.name ? ' — ' + x.name : '')) + '</td>' + mtd(x.tc) + mtd(x.stc) + mtd(x.dtc) + mtd(x.tp) + mtd(x.stp) + mtd(x.dtp) + '</tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="muted">“Not listed” = the summary less the lines: receive money (the connector has no list of receive money), pay runs and general journals carrying a tax code are in MYOB’s summary but not in these lists.</p>' +
      '<details class="detail-block"><summary>Net amounts by tax code (information)</summary><div class="mk-scroll"><table class="mk-grid"><thead><tr><th scope="col">Tax code</th><th scope="col" class="num">Sales net (lines)</th><th scope="col" class="num">Summary</th><th scope="col" class="num">Purchases net (lines)</th><th scope="col" class="num">Summary</th></tr></thead><tbody>' +
      rec.map(function (x) { return '<tr><td>' + h(x.code) + '</td>' + mtd(x.ns) + mtd(x.sns) + mtd(x.np) + mtd(x.snp) + '</tr>'; }).join('') + '</tbody></table></div></details></div>';
    ['tax', 'contact', 'account'].forEach(function (k) { var e = document.getElementById('cra-f-' + k); if (e) e.addEventListener('change', function () { CRA_F[k] = this.value; CRA.render(); }); });
    // ---- checks
    var cov = function (X, what, hid) { if (!X) return { name: what + ' lines loaded', pass: null, detail: 'N/A' }; if (c.errors[hid]) return { name: 'Every ' + what + ' in the period has its lines', pass: null, detail: c.err(hid) };
      var e = X.errors ? Object.keys(X.errors).map(function (k) { return k + ': ' + X.errors[k]; }).join('; ') : '';
      return { name: 'Every ' + what + ' in the period has its lines (' + X.headers + ' in list_' + what + 's, ' + X.docs + ' with lines; at most 5,000 lines)', pass: !X.trunc && !X.missing.length && X.docs >= X.headers, detail: X.trunc ? 'Truncated at 5,000 lines — narrow the dates' : X.missing.length ? X.missing.length + ' without lines' + (e ? ' (' + e + ')' : '') : e ? 'complete; layouts not read: ' + e : 'complete' }; };
    var badT = rec.filter(function (x) { return !MK.near(x.tc, x.stc) || !MK.near(x.tp, x.stp); });
    var g = c.data.gst, dOf = function (v) { return String(v || '').slice(0, 10); };
    var checks = [
      c.errors.gst ? { name: 'Tax code summary loaded', pass: false, detail: c.err('gst') } : { name: 'MYOB returned the requested period (tax code summary, accrual)', pass: dOf(g.StartDate) === from && dOf(g.EndDate) === to, detail: dOf(g.StartDate) + ' to ' + dOf(g.EndDate) + ', ' + (g.ReportingBasis || '?') + ' basis' },
      cov(INV, 'invoice', 'invoices'), cov(BIL, 'bill', 'bills'),
      { name: 'Every document’s lines: Net + GST = Gross, and add up to the document’s own total (list_invoices / list_bills / spend money AmountPaid)', pass: !docIssues.length && !fromRate, detail: docIssues.length ? docIssues.slice(0, 6).join('; ') + (docIssues.length > 6 ? ' … +' + (docIssues.length - 6) : '') : fromRate ? fromRate + ' document(s) without a header: GST computed from the rates' : out.length + ' line(s)' },
      { name: 'Every line’s tax code has a rate (list_tax_codes)', pass: !Object.keys(unknownRate).length, detail: Object.keys(unknownRate).length ? 'No rate for: ' + Object.keys(unknownRate).join(', ') : 'ok' },
      c.errors.gst ? { name: 'GST per tax type = the tax code summary', pass: null, detail: c.err('gst') } : { name: 'GST per tax type = MYOB’s tax code summary for the period (collected and paid, code by code)', pass: !badT.length, detail: badT.length ? 'Not listed: ' + badT.map(function (x) { return x.code + (Math.abs(x.dtc) >= 0.005 ? ' collected ' + money(x.dtc) : '') + (Math.abs(x.dtp) >= 0.005 ? ' paid ' + money(x.dtp) : ''); }).join('; ') + ' — receive money (no list tool on the connector), pay runs or general journals with a tax code' : allCodes.length + ' tax code(s)' },
      c.errors.gst ? { name: 'Grand total GST = net GST of the period', pass: null, detail: c.err('gst') } : { name: 'Grand total net GST (lines) = the period’s net GST (summary)', pass: MK.near(r2(G.tc - G.tp), r2(SG.tc - SG.tp)), detail: money(r2(G.tc - G.tp)) + ' vs ' + money(r2(SG.tc - SG.tp)) }
    ];
    if (c.errors.spend) checks.push({ name: 'Spend money loaded', pass: false, detail: c.err('spend') });
    self._x = { out: out, rec: rec, G: G, SG: SG, codeLabel: function (k) { var rt = rateOf(k); return k + (codes[k] && codes[k].name ? ' — ' + codes[k].name : '') + (rt != null ? ' (' + rt + '%)' : ''); } };
    return { checks: checks, period: MK.periodLine(from, to) + ' · Accrual basis',
      notes: ['Lines: list_invoice_lines, list_bill_lines and list_spend_money for documents dated in the period (accrual). Credit notes / supplier credits are MYOB invoices / bills with a negative total.',
        'MYOB returns the GST per document, not per line: each document’s GST is split across its lines by their tax codes’ rates (single-code documents are exact), so the lines always add up to the document.',
        'Receive money has no list tool on the myob-accounting connector, so it is not listed; its tax (with pay runs and general journals carrying a tax code) is the “Not listed” column of the tie to the summary, never a silent gap.'],
      na: ['Receive money transactions (no list tool on the connector)', 'Pay runs and general journals by line (not listed; their tax shows as Not listed)', 'Cash basis (the line tools list documents by their date)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var I = c.inputs, mv = function (v) { return { v: v, s: 'money' }; }, mb = function (v) { return { v: v, s: 'moneyBold' }; }, b = function (t) { return { v: t, s: 'bold' }; };
    var hd = function (t, cols) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [b('MYOB BAS Related Transactions and GST — ' + t)], ['Period: ' + MK.periodLine(I.from_date, I.to_date) + ' (' + I.from_date + ' to ' + I.to_date + ')'], ['Basis: Accrual · Currency: ' + c.currency], [], cols.map(b)]; };
    var rows = hd('by tax type', ['Date', 'Source', 'Reference', 'Contact', 'Account', 'Net', 'GST', 'Gross']), by = {};
    x.out.forEach(function (r) { (by[r.code] = by[r.code] || []).push(r); });
    var S = function (rs, k) { return MK.sum(rs.map(function (r) { return r[k]; })); };
    Object.keys(by).sort().forEach(function (k) { var rs = by[k]; rows.push([b(x.codeLabel(k))]); rs.forEach(function (r) { rows.push([r.date, r.src, r.ref, r.contact, r.account, mv(r.net), mv(r.gst), mv(r.gross)]); });
      [['s', 'sales'], ['p', 'purchases']].forEach(function (sd) { var q = rs.filter(function (r) { return r.side === sd[0]; }); if (q.length) rows.push([b('Subtotal ' + k + ' ' + sd[1]), '', '', '', '', mb(S(q, 'net')), mb(S(q, 'gst')), mb(S(q, 'gross'))]); }); });
    rows.push([], [b('GST collected'), '', '', '', '', '', mb(x.G.tc)], [b('GST paid'), '', '', '', '', '', mb(x.G.tp)], [b('Net GST'), '', '', '', '', '', mb(Math.round((x.G.tc - x.G.tp) * 100) / 100)]);
    var tie = hd('tie to the tax code summary', ['Tax code', 'GST collected (lines)', 'Summary', 'Not listed', 'GST paid (lines)', 'Summary', 'Not listed']).concat(x.rec.map(function (r) { return [r.code, mv(r.tc), mv(r.stc), mv(r.dtc), mv(r.tp), mv(r.stp), mv(r.dtp)]; }));
    return [{ name: 'Transactions', rows: rows, widths: [12, 14, 12, 28, 32, 14, 12, 14] }, { name: 'Tie to summary', rows: tie, widths: [16, 18, 16, 14, 18, 16, 14] }];
  }
});

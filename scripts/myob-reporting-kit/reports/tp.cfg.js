// Taxable Payments Annual Report (M14): payments MADE in the financial year to contractors — bill payments where MYOB marks the bill
// reportable, and spend money paid to a supplier card set up for taxable payments — per payee with the ABN (check digits verified),
// gross paid (incl. GST) and GST. The independent tie: the supplier payments and spend money read = MYOB's journals for them.
MK.app({
  title: 'Taxable Payments Annual Report', primary: 'payments', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2025-07-01', to_date: '2026-06-30', bills_from: '2024-07-01', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"last_fy","a":"custom","c":"none","v":"summary","x":""}' },
  uses: { payments: ['from_date', 'to_date', 'company_file'], bills: ['bills_from', 'to_date', 'company_file'], spend: ['from_date', 'to_date', 'company_file'], suppliers: ['company_file'], journals: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { payments: 'list_supplier_payments (payments made in the year, and the bills each one settles)', bills: 'list_bills (each bill\'s reportable flag — from a year before the start)', spend: 'list_spend_money (spend money in the year)', suppliers: 'list_suppliers (ABN and the taxable payments setting)', journals: 'list_journal_transactions (the payments\' journals, for the tie)', company_files: 'list_company_files' },
  views: [['summary', 'By payee'], ['detail', 'Payments']],
  derive: function (inp) { return { bills_from: (+String(inp.from_date).slice(0, 4) - 1) + String(inp.from_date).slice(4) }; },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['payments', 'bills', 'spend', 'suppliers'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Payments, bills, spend money and supplier cards loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.payments || !c.data.bills || !c.data.spend || !c.data.suppliers) return {};
    var inP = function (x) { var d = MK.isoDate(x.Date); return d >= from && d <= to; }, S = {}, BL = {}, P = {}, rows = [], z = function () { return { n: 0, amt: 0 }; }, un = z(), notRep = z(), off = z(), add = function (o, v) { o.n++; o.amt = r2(o.amt + v); };
    MK.items(c.data.suppliers).forEach(function (s) { S[s.UID] = s; }); MK.items(c.data.bills).forEach(function (b) { BL[b.UID] = b; });
    var payee = function (ref) { var s = S[ref.UID], k = ref.UID || ref.Name; return (P[k] = P[k] || { name: (s && s.Name) || ref.Name || '', abn: (s && s.ABN) || '', card: !!s, bills: 0, spend: 0, gst: 0 }); };
    var pays = MK.items(c.data.payments).filter(inP), spends = MK.items(c.data.spend).filter(inP);
    pays.forEach(function (p) { (p.Lines || []).forEach(function (l) { var amt = MK.num(l.AmountApplied) || 0, b = BL[(l.Purchase || {}).UID];
      if (!b) return add(un, amt);
      if (b.IsReportable !== true) { add(notRep, amt); if ((S[(p.Supplier || {}).UID] || {}).IsReportable) add(off, amt); return; }
      var g = MK.num(b.TotalAmount) ? r2(amt * (MK.num(b.TotalTax) || 0) / MK.num(b.TotalAmount)) : 0, x = payee(p.Supplier || b.Supplier || {}); x.bills = r2(x.bills + amt); x.gst = r2(x.gst + g);
      rows.push({ date: MK.isoDate(p.Date), payee: x.name, src: 'Bill payment', ref: (p.PaymentNumber || '') + ' → bill ' + (b.Number || ''), gross: amt, gst: g }); }); });
    var spRep = 0; spends.forEach(function (t) { var ct = t.Contact || {}, s = S[ct.UID];
      if (!(t.IsReportable === true || (t.IsReportable == null && ct.Type === 'Supplier' && s && s.IsReportable === true))) return; spRep++;
      var amt = MK.num(t.AmountPaid) || 0, g = MK.num(t.TotalTax) || 0, x = payee(ct); x.spend = r2(x.spend + amt); x.gst = r2(x.gst + g);
      rows.push({ date: MK.isoDate(t.Date), payee: x.name, src: 'Spend money', ref: t.PaymentNumber || '', gross: amt, gst: g }); });
    var abnOk = function (s) { var d = String(s || '').replace(/\D/g, '').split('').map(Number), w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19], t = 0; if (d.length !== 11) return false; d[0] -= 1; d.forEach(function (v, i) { t += v * w[i]; }); return t % 89 === 0; };
    var list = Object.keys(P).map(function (k) { var x = P[k]; return { payee: x.name, abn: x.abn || 'Missing', ok: abnOk(x.abn), card: x.card, bills: x.bills, spend: x.spend, gross: r2(x.bills + x.spend), gst: x.gst }; }).sort(function (a, b) { return a.payee.localeCompare(b.payee); });
    list.forEach(function (r) { if (!r.ok) r.abn += r.abn === 'Missing' ? '' : ' — not valid'; });
    var G = MK.sum(list.map(function (r) { return r.gross; })), GST = MK.sum(list.map(function (r) { return r.gst; })), bad = list.filter(function (r) { return !r.ok; }), noCard = list.filter(function (r) { return !r.card; }), view = c.view || 'summary';
    body.innerHTML = MK.kpis([{ label: 'Payees', value: list.length, money: false }, { label: 'Gross paid (incl. GST)', value: G }, { label: 'GST', value: GST }, { label: 'Payees without a valid ABN', value: bad.length, money: false }], c) + '<div id="tp-grid" style="margin-top:12px"></div>';
    rows.sort(function (a, b) { return a.date.localeCompare(b.date) || a.payee.localeCompare(b.payee); });
    if (view === 'detail') MK.grid(document.getElementById('tp-grid'), { rows: rows, filter: true, columns: [{ key: 'date', title: 'Date' }, { key: 'payee', title: 'Payee' }, { key: 'src', title: 'Paid by' }, { key: 'ref', title: 'Reference' }, { key: 'gross', title: 'Gross paid (incl. GST)', money: true }, { key: 'gst', title: 'GST', money: true }],
      total: { date: 'Total', gross: G, gst: GST }, empty: 'No reportable payments in this financial year.' }, c);
    else MK.grid(document.getElementById('tp-grid'), { rows: list, filter: true, columns: [{ key: 'payee', title: 'Payee' }, { key: 'abn', title: 'ABN' }, { key: 'bills', title: 'Bill payments', money: true }, { key: 'spend', title: 'Spend money', money: true }, { key: 'gross', title: 'Gross paid (incl. GST)', money: true }, { key: 'gst', title: 'GST', money: true }],
      total: { payee: 'Total', bills: MK.sum(list.map(function (r) { return r.bills; })), spend: MK.sum(list.map(function (r) { return r.spend; })), gross: G, gst: GST }, empty: 'No reportable payments in this financial year.' }, c);
    // the tie: supplier payments and spend money in the year, count and total, vs MYOB's journals for them (debits = the amount paid)
    var tie = null, trunc = MK.items(c.data.payments).length >= 1000;
    if (c.data.journals) { var J = { SupplierPayment: [0, 0, []], SpendMoney: [0, 0, []] }, L = { SupplierPayment: pays, SpendMoney: spends }, msg = [];
      MK.items(c.data.journals).forEach(function (t) { var st = t.SourceTransaction || {}, k = st.TransactionType, d = MK.isoDate(t.DateOccurred || t.DatePosted); if (!J[k] || d < from || d > to) return;
        J[k][0]++; J[k][1] = r2(J[k][1] + MK.sum((t.Lines || []).filter(function (l) { return !l.IsCredit; }).map(function (l) { return Math.abs(MK.num(l.Amount) || 0); }))); if (st.UID) J[k][2].push(st.UID); });
      Object.keys(J).forEach(function (k) { var n = L[k].length, amt = MK.sum(L[k].map(function (x) { return MK.num(x.AmountPaid) || 0; })), ids = L[k].map(function (x) { return x.UID; }), miss = J[k][2].filter(function (u) { return ids.indexOf(u) < 0; });
        if (n !== J[k][0] || !MK.near(amt, J[k][1]) || miss.length) msg.push((k === 'SpendMoney' ? 'spend money' : 'supplier payments') + ': journals ' + J[k][0] + ' (' + money(J[k][1]) + ') vs read ' + n + ' (' + money(amt) + ')'); });
      tie = { pass: msg.length === 0, detail: msg.length ? msg.join('; ') : pays.length + ' supplier payments (' + money(J.SupplierPayment[1]) + ') and ' + spends.length + ' spend money (' + money(J.SpendMoney[1]) + ') — the same in MYOB\'s journals' }; }
    this._x = { list: list, rows: rows, G: G, GST: GST };
    return { checks: [
      { name: 'The supplier payments and spend money read = MYOB\'s journals for them, count and total (two MYOB sources — nothing missing)', pass: c.errors.journals ? null : tie ? tie.pass && !trunc : null, detail: c.errors.journals ? c.err('journals') : (trunc ? 'MYOB returned 1,000 supplier payments — some may be missing; ' : '') + (tie ? tie.detail : 'N/A') },
      { name: 'Every bill payment is matched to its bill (reportable + not reportable = every bill payment)', pass: un.n === 0, detail: 'reportable ' + money(MK.sum(list.map(function (r) { return r.bills; }))) + ', not reportable ' + money(notRep.amt) + (un.n ? ', ' + un.n + ' unmatched ' + money(un.amt) + ' (bills dated before ' + c.inputs.bills_from + ' are not read)' : '') },
      { name: 'Every reportable payee has an ABN with valid check digits', pass: list.length ? bad.length === 0 : null, detail: bad.length ? bad.map(function (r) { return r.payee + ' (' + r.abn + ')'; }).join(', ') : list.length + ' payees' },
      { name: 'Every reportable payee has a supplier card', pass: list.length ? noCard.length === 0 : null, detail: noCard.length ? noCard.map(function (r) { return r.payee; }).join(', ') : list.length + ' payees' },
      { name: 'Payments to suppliers set up for taxable payments, on bills not marked reportable', pass: null, info: true, detail: off.n + ' payments, ' + money(off.amt) },
      { name: 'Spend money not reported (not paid to a supplier set up for taxable payments)', pass: null, info: true, detail: (spends.length - spRep) + ' of ' + spends.length }],
      notes: ['Payments made in the financial year (TPAR is on payments, not bill dates): bill payments where MYOB marks the bill reportable, with the GST in proportion to the bill, and spend money paid to a supplier card set up for taxable payments (MYOB\'s API has no per-transaction setting for spend money). A draft to review — lodge from MYOB, which adds each payee\'s address.'],
      na: ['Payee addresses (left out; MYOB adds them when it lodges)', 'Amounts withheld where no ABN was quoted (not in the connector)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (n) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: n, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return { v: v, s: 'money' }; }, b = function (a) { return a.map(function (t) { return { v: t, s: 'bold' }; }); };
    return [{ name: 'By payee', widths: [34, 18, 16, 16, 18, 14], rows: head('Taxable payments by payee').concat([b(['Payee', 'ABN', 'Bill payments', 'Spend money', 'Gross paid (incl. GST)', 'GST'])]).concat(x.list.map(function (r) { return [r.payee, r.abn, mv(r.bills), mv(r.spend), mv(r.gross), mv(r.gst)]; })).concat([[{ v: 'Total', s: 'bold' }, '', '', '', { v: x.G, s: 'moneyBold' }, { v: x.GST, s: 'moneyBold' }]]) },
      { name: 'Payments', widths: [12, 30, 14, 26, 18, 14], rows: head('Reportable payments').concat([b(['Date', 'Payee', 'Paid by', 'Reference', 'Gross paid (incl. GST)', 'GST'])]).concat(x.rows.map(function (r) { return [r.date, r.payee, r.src, r.ref, mv(r.gross), mv(r.gst)]; })) }];
  }
});

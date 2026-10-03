QB.app({
  title: 'Expenses & Pay Bills overview', token: null, primary: 'spend_monthly', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { q_start: '2026-04-01', q_end: '2026-09-30', m_start: '2026-09-01', m_end: '2026-09-30', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: { spend_monthly: ['q_start', 'q_end'], supplier_spend: ['m_start', 'm_end'], open_bills: [], bill_payments: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { open_bills: "list_bill (Balance > '0')", bill_payments: 'list_bill_payment (latest 1,000)', aged_payables: 'get_report_aged_payables', spend_monthly: 'get_report_profit_and_loss (last quarter + this quarter, by month)', supplier_spend: 'get_report_vendor_expenses (this month)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  roll: function (inp, fy) { var tq = QB.preset('this_quarter', fy), lq = QB.preset('last_quarter', fy), tm = QB.preset('this_month', fy); return { q_start: lq.start, q_end: tq.end, m_start: tm.start, m_end: tm.end }; },
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, today = c.today;
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    var bills = q('open_bills', 'Bill'), overdue = bills.filter(function (b) { return b.DueDate && b.DueDate < today; }), unpaid = QB.sum(bills.map(function (b) { return b.Balance; }));
    var since = QB.preset('last_30', c.fy.month).start, paid = q('bill_payments', 'BillPayment').filter(function (p) { return p.TxnDate >= since && p.TxnDate <= today; }), paidTot = QB.sum(paid.map(function (p) { return p.TotalAmt; }));
    var ap = c.data.aged_payables ? QB.find(QB.walk(c.data.aged_payables), 'GrandTotal', /^total$/i) : null, apTot = ap ? QB.val(ap) : null;
    var sm = c.data.spend_monthly, cols = sm ? QB.cols(sm).slice(1).filter(function (x) { return x.start; }) : [], ls = sm ? QB.walk(sm) : [];
    var spendAt = function (i) { var t = 0; ['COGS', 'Expenses', 'OtherExpenses'].forEach(function (g) { var l = QB.find(ls, g); if (l) t += l.values[i] || 0; }); return Math.round(t * 100) / 100; };
    var tq = QB.preset('this_quarter', c.fy.month), inQ = function (x, s, e) { return x.start >= s && x.start <= e; }, lq = QB.preset('last_quarter', c.fy.month);
    var thisQ = QB.sum(cols.filter(function (x) { return inQ(x, tq.start, tq.end); }).map(function (x) { return spendAt(x.i - 1); })), lastQ = QB.sum(cols.filter(function (x) { return inQ(x, lq.start, lq.end); }).map(function (x) { return spendAt(x.i - 1); }));
    var ve = c.data.supplier_spend, vl = ve ? QB.walk(ve) : [], sup = vl.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return { label: l.label, value: QB.val(l) }; }), veTot = QB.val(QB.find(vl, 'GrandTotal', /^total$/i));
    var days = cols.length ? Math.round((QB.parse(cols[cols.length - 1].end || today) - QB.parse(cols[0].start)) / 86400000) + 1 : null, spendAll = QB.sum(cols.map(function (x) { return spendAt(x.i - 1); }));
    var dpo = apTot != null && spendAll ? Math.round((apTot / spendAll) * days) : null;
    var d = lastQ ? (thisQ - lastQ) / Math.abs(lastQ) : null;
    body.innerHTML = '<div class="qb-card"><h3>Bills</h3>' + QB.kpis([{ label: 'For review', text: 'N/A — not in source', sub: 'Bill inbox is not in the Accounting API' }, { label: 'Unpaid', value: unpaid, sub: overdue.length + ' overdue' }, { label: 'Paid (last 30 days)', value: paidTot, sub: paid.length + ' bill payment' + (paid.length === 1 ? '' : 's') }, { label: 'DPO', text: dpo == null ? 'N/A — not in source' : dpo + ' days', sub: 'A/P ÷ spend × days' }], c) + '</div>' +
      '<div class="qb-grid2"><div class="qb-card"><h3>Spend over time</h3>' + QB.kpis([{ label: QB.periodLine(tq.start, tq.end), value: thisQ, delta: d, sub: 'vs ' + QB.periodLine(lq.start, lq.end) + ' ' + money(lastQ) }], c) + '<div id="ch1"></div></div>' +
      '<div class="qb-card"><h3>Spend insights <span class="muted">· this month</span></h3>' + (c.errors.supplier_spend ? '<p class="qb-err">' + QB.h(c.err('supplier_spend')) + '</p>' : QB.kpis([{ label: 'Spend by supplier', value: veTot }], c) + '<div id="ch2"></div>') + '</div></div>' +
      '<div class="qb-card detail-block"><h3>Unpaid bills</h3><div id="g1"></div></div>';
    if (c.errors.spend_monthly) document.getElementById('ch1').innerHTML = '<p class="qb-err">' + QB.h(c.err('spend_monthly')) + '</p>';
    else QB.bars(document.getElementById('ch1'), { title: 'Spend by month', labels: cols.map(function (x) { return x.title; }), series: [{ name: 'Spend', values: cols.map(function (x) { return spendAt(x.i - 1); }) }] }, c);
    if (document.getElementById('ch2')) QB.donut(document.getElementById('ch2'), { title: 'Supplier shares', items: sup }, c);
    QB.grid(document.getElementById('g1'), { filter: true, empty: 'No unpaid bills.', columns: [{ key: 'v', title: 'Supplier' }, { key: 'n', title: 'Num' }, { key: 'due', title: 'Due date' }, { key: 'st', title: 'Status' }, { key: 'b', title: 'Open balance', money: true }],
      rows: bills.map(function (b) { return { v: (b.VendorRef || {}).name, n: b.DocNumber, due: b.DueDate, st: b.DueDate && b.DueDate < today ? 'Overdue' : 'Due', b: b.Balance }; }), total: { v: 'TOTAL', b: unpaid } }, c);
    var checks = [
      { name: 'Unpaid bills = A/P ageing total', pass: apTot == null || c.errors.open_bills ? null : QB.near(unpaid, apTot, 1), detail: money(unpaid) + ' vs ' + money(apTot) + (apTot != null && !QB.near(unpaid, apTot, 1) ? ' — supplier credits and journals to A/P are in the ageing but not in the bill list' : '') },
      { name: 'Paid = bill payments in the last 30 days (information — the tile is built from them)', pass: c.errors.bill_payments ? false : null, detail: c.errors.bill_payments ? c.err('bill_payments') : paid.length + ' payments, ' + money(paidTot) },
      { name: 'Spend insights total = Σ suppliers', pass: veTot == null ? null : QB.near(veTot, QB.sum(sup.map(function (s) { return s.value; }))), detail: money(veTot) }];
    this._x = { bills: bills, unpaid: unpaid, paidTot: paidTot, thisQ: thisQ, lastQ: lastQ, sup: sup, dpo: dpo };
    return { checks: checks, period: QB.asOfLine(today), na: ['"For review" bill inbox, Upload / Create / Schedule / Pay actions (not in the Accounting API — use QuickBooks)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Expenses overview', widths: [36, 18, 14, 14, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Expenses & Pay Bills overview', s: 'bold' }], [QB.asOfLine(c.today)], [], ['Unpaid bills', { v: x.unpaid, s: 'money' }], ['Paid (last 30 days)', { v: x.paidTot, s: 'money' }], ['Spend this quarter', { v: x.thisQ, s: 'money' }], ['Spend last quarter', { v: x.lastQ, s: 'money' }], ['DPO (days)', x.dpo == null ? 'N/A' : { v: x.dpo, s: 'none' }], [],
      [{ v: 'Supplier', s: 'bold' }, { v: 'Num', s: 'bold' }, { v: 'Due', s: 'bold' }, { v: '', s: 'bold' }, { v: 'Open balance', s: 'bold' }]].concat(x.bills.map(function (b) { return [(b.VendorRef || {}).name, b.DocNumber, b.DueDate, '', { v: b.Balance, s: 'money' }]; })) }];
  }
});

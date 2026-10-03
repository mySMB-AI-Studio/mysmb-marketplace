QB.app({
  title: 'Sales & Get Paid overview', token: null, primary: 'income_monthly', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { inc_start: '2025-10-01', inc_end: '2026-09-30', prev_start: '2024-10-01', prev_end: '2025-09-30', persona: 'Client',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"prev_year","v":"","x":"365"}' },
  uses: { income_monthly: ['inc_start', 'inc_end'], income_prev_year: ['prev_start', 'prev_end'], open_invoices: [], payments_received: [], aged_receivables: [], company_info: [], prefs: [] },
  tools: { income_monthly: 'get_report_profit_and_loss (income by month)', income_prev_year: 'get_report_profit_and_loss (same months last year)', open_invoices: "list_invoice (Balance > '0')", payments_received: 'list_payment (latest 1,000)', aged_receivables: 'get_report_aged_receivables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  // Duration (x): 365 = last 12 complete months incl. this month; 30 = this month and last month. Previous year = same months one year earlier.
  roll: function (inp, fy, d) {
    var t = QB.preset('this_month', fy), e = t.end, E = QB.parse(e), back = d.x === '30' ? 1 : 11;
    var s = QB.iso(new Date(Date.UTC(E.getUTCFullYear(), E.getUTCMonth() - back, 1)));
    var py = function (x) { var p = QB.parse(x); return QB.iso(new Date(Date.UTC(p.getUTCFullYear() - 1, p.getUTCMonth(), p.getUTCDate()))); };
    return { inc_start: s, inc_end: e, prev_start: py(s), prev_end: QB.iso(QB.eom(E.getUTCFullYear() - 1, E.getUTCMonth() + 1)) };
  },
  render: function (c) {
    var body = c.body, d = c.display, money = function (v) { return QB.money(v, c.currency, d); }, today = c.today;
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    var ser = function (id) { var r = c.data[id]; if (!r) return { labels: [], v: [], tot: null }; var cols = QB.cols(r).slice(1).filter(function (x) { return x.start; }), ls = QB.walk(r), l = QB.find(ls, 'Income', /^total (for )?income$/i);
      return { labels: cols.map(function (x) { return x.title; }), v: cols.map(function (x) { return l ? l.values[x.i - 1] || 0 : 0; }), tot: l ? QB.val(l) : null }; };
    var cur = ser('income_monthly'), prev = ser('income_prev_year'), showPrev = d.c !== 'none';
    var inv = q('open_invoices', 'Invoice'), od = inv.filter(function (x) { return x.DueDate && x.DueDate < today; }), unpaid = QB.sum(inv.map(function (x) { return x.Balance; })), odAmt = QB.sum(od.map(function (x) { return x.Balance; }));
    var days = d.x === '30' ? 30 : 365, since = QB.iso(QB.addDays(QB.parse(today), -(days - 1)));
    var pays = q('payments_received', 'Payment').filter(function (p) { return p.TxnDate >= since && p.TxnDate <= today; });
    var isUndep = function (p) { var n = ((p.DepositToAccountRef || {}).name || ''); return /undeposited/i.test(n); };
    var paid = QB.sum(pays.map(function (p) { return p.TotalAmt; })), notDep = QB.sum(pays.filter(isUndep).map(function (p) { return p.TotalAmt; }));
    var ar = c.data.aged_receivables ? QB.find(QB.walk(c.data.aged_receivables), 'GrandTotal', /^total$/i) : null, arTot = ar ? QB.val(ar) : null;
    var dso = arTot != null && cur.tot ? Math.round((arTot / cur.tot) * (d.x === '30' ? 61 : 365)) : null;
    var delta = showPrev && prev.tot ? (cur.tot - prev.tot) / Math.abs(prev.tot) : null;
    var opt = [['365', 'Last 365 days'], ['30', 'Last 30 days']];
    body.innerHTML = '<div class="qb-card"><h3>Income over time <select id="w-dur" aria-label="Duration"' + (c.live ? '' : ' disabled') + '>' + opt.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === (d.x || '365') ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select> <label style="font-size:13px;font-weight:400"><input type="checkbox" id="w-prev"' + (showPrev ? ' checked' : '') + '> Compare to previous year</label></h3>' +
      (c.errors.income_monthly ? '<p class="qb-err">' + QB.h(c.err('income_monthly')) + '</p>' : QB.kpis([{ label: 'Income ' + QB.periodLine(c.inputs.inc_start, c.inputs.inc_end), value: cur.tot, delta: delta, sub: showPrev && prev.tot != null ? 'Previous year ' + money(prev.tot) : '' }, { label: 'DSO', text: dso == null ? 'N/A — not in source' : dso + ' days', sub: 'A/R ÷ income × days' }], c) + '<div id="ch1"></div>') + '</div>' +
      '<div class="qb-grid2"><div class="qb-card"><h3>Unpaid invoices</h3>' + QB.kpis([{ label: 'Unpaid', value: unpaid }, { label: 'Overdue', value: odAmt, sub: od.length + ' invoice' + (od.length === 1 ? '' : 's') }, { label: 'Not due yet', value: Math.round((unpaid - odAmt) * 100) / 100 }], c) + '</div>' +
      '<div class="qb-card"><h3>Paid <span class="muted">· last ' + days + ' days</span></h3>' + QB.kpis([{ label: 'Paid', value: paid }, { label: 'Not deposited', value: notDep }, { label: 'Deposited', value: Math.round((paid - notDep) * 100) / 100 }], c) + '</div></div>' +
      '<div class="qb-card detail-block"><h3>Open invoices</h3><div id="g1"></div></div>';
    if (document.getElementById('ch1')) QB.bars(document.getElementById('ch1'), { title: 'Income over time', labels: cur.labels, series: [{ name: 'Income', values: cur.v }].concat(showPrev ? [{ name: 'Previous year', values: prev.v.slice(0, cur.v.length) }] : []) }, c);
    QB.grid(document.getElementById('g1'), { filter: true, empty: 'No unpaid invoices.', columns: [{ key: 'c', title: 'Customer' }, { key: 'n', title: 'Num' }, { key: 'due', title: 'Due date' }, { key: 'st', title: 'Status' }, { key: 'b', title: 'Open balance', money: true }],
      rows: inv.map(function (x) { return { c: (x.CustomerRef || {}).name, n: x.DocNumber, due: x.DueDate, st: x.DueDate && x.DueDate < today ? 'Overdue' : 'Not due yet', b: x.Balance }; }), total: { c: 'TOTAL', b: unpaid } }, c);
    var w = document.getElementById('w-dur'); if (w) w.addEventListener('change', function () {
      var x = this.value, t = QB.preset('this_month', c.fy.month), E = QB.parse(t.end), s = QB.iso(new Date(Date.UTC(E.getUTCFullYear(), E.getUTCMonth() - (x === '30' ? 1 : 11), 1))), P = QB.parse(s);
      c.change({ inc_start: s, inc_end: t.end, prev_start: QB.iso(new Date(Date.UTC(P.getUTCFullYear() - 1, P.getUTCMonth(), 1))), prev_end: QB.iso(QB.eom(E.getUTCFullYear() - 1, E.getUTCMonth() + 1)) }, { x: x });
    });
    var cb = document.getElementById('w-prev'); if (cb) cb.addEventListener('change', function () { c.change({}, { c: this.checked ? 'prev_year' : 'none' }); });
    var checks = [
      { name: 'Unpaid = A/R ageing total', pass: arTot == null || c.errors.open_invoices ? null : QB.near(unpaid, arTot, 1), detail: money(unpaid) + ' vs ' + money(arTot) + (arTot != null && !QB.near(unpaid, arTot, 1) ? ' — credits and journals to A/R are in the ageing but not in the invoice list' : '') },
      { name: 'Paid = payments received in the period (information — the tile is built from them)', pass: c.errors.payments_received ? false : null, detail: pays.length + ' payments since ' + since },
      { name: 'Income chart months sum to the period income', pass: cur.tot == null ? null : QB.near(cur.tot, QB.sum(cur.v), 0.05), detail: money(cur.tot) }];
    this._x = { cur: cur, prev: prev, inv: inv, unpaid: unpaid, odAmt: odAmt, paid: paid, notDep: notDep, dso: dso };
    return { checks: checks, period: QB.asOfLine(today), na: ['Quick actions (create invoice, receive payment …) — use QuickBooks'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Sales overview', widths: [22, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Sales & Get Paid overview', s: 'bold' }], [QB.asOfLine(c.today)], [], ['Unpaid', { v: x.unpaid, s: 'money' }], ['Overdue', { v: x.odAmt, s: 'money' }], ['Paid', { v: x.paid, s: 'money' }], ['Not deposited', { v: x.notDep, s: 'money' }], ['DSO (days)', x.dso == null ? 'N/A' : { v: x.dso, s: 'none' }], [],
      [{ v: 'Month', s: 'bold' }, { v: 'Income', s: 'bold' }, { v: 'Previous year', s: 'bold' }]].concat(x.cur.labels.map(function (l, i) { return [l, { v: x.cur.v[i], s: 'money' }, x.prev.v[i] == null ? null : { v: x.prev.v[i], s: 'money' }]; })) }];
  }
});

// CRA-13 Estimate Accuracy (QuickBooks): each estimate dated in the period against the invoices raised from it, in dollars —
// estimated, invoiced, variance $ and %, by status (TxnStatus Pending / Accepted / Closed / Rejected). Invoices are matched
// through the estimate's LinkedTxn (TxnType Invoice) or the invoice's LinkedTxn (TxnType Estimate); an invoice raised from
// several estimates is shared between them in proportion to their totals. Invoices are read from the period start on, so a
// later invoice for an earlier estimate is found. QuickBooks has no time estimates, so this is not time accuracy.
QB.app({
  title: 'QuickBooks · Estimate Accuracy', token: null, primary: 'estimates', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', txn_where: "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'", inv_where: "TxnDate >= '2026-07-01'", persona: 'Practitioner',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  uses: { estimates: ['txn_where'], invoices: ['inv_where'], company_info: [], prefs: [] },
  derive: function (inp) { return { txn_where: "TxnDate >= '" + inp.start_date + "' AND TxnDate <= '" + inp.end_date + "'", inv_where: "TxnDate >= '" + inp.start_date + "'" }; },
  tools: { estimates: 'list_estimate (dated in the period)', invoices: 'list_invoice (from the period start on)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body, h = QB.h, from = c.inputs.start_date, to = c.inputs.end_date, CAP = 1000;
    var SCOPE = 'Estimated vs actual in dollars, from this company\'s estimates and the invoices raised from them. QuickBooks has no time estimates, so this is not time accuracy.';
    var need = ['estimates', 'invoices'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="qb-err">' + h(c.err(need[0])) + '</p>'; this._x = null; return { checks: [{ name: 'Estimates and invoices loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.estimates) return {};
    var r2 = function (v) { return Math.round(v * 100) / 100; }, money = function (v) { return QB.money(v, c.currency, c.display); };
    var est = ((c.data.estimates.QueryResponse || {}).Estimate || []), inv = (((c.data.invoices || {}).QueryResponse || {}).Invoice || []);
    var inP = est.filter(function (e) { return e.TxnDate >= from && e.TxnDate <= to; });
    var invById = {}; inv.forEach(function (i) { invById[String(i.Id)] = i; });
    // estimate id → linked invoice ids, from both sides of the link
    var links = {}, add = function (eid, iid) { var l = links[eid] = links[eid] || []; if (l.indexOf(iid) < 0) l.push(iid); };
    inP.forEach(function (e) { links[String(e.Id)] = []; (e.LinkedTxn || []).forEach(function (t) { if (t.TxnType === 'Invoice' && t.TxnId != null) add(String(e.Id), String(t.TxnId)); }); });
    inv.forEach(function (i) { (i.LinkedTxn || []).forEach(function (t) { if (t.TxnType === 'Estimate' && links[String(t.TxnId)]) add(String(t.TxnId), String(i.Id)); }); });
    // an invoice linked to several of these estimates is shared in proportion to the estimates' totals
    var share = {}; Object.keys(links).forEach(function (eid) { links[eid].forEach(function (iid) { (share[iid] = share[iid] || []).push(eid); }); });
    var totOf = {}; inP.forEach(function (e) { totOf[String(e.Id)] = Number(e.TotalAmt) || 0; });
    var missing = [];
    var rows = inP.map(function (e) {
      var eid = String(e.Id), estd = r2(Number(e.TotalAmt) || 0), got = 0, n = 0;
      links[eid].forEach(function (iid) { var i = invById[iid]; if (!i) { missing.push((e.DocNumber || eid) + ' → invoice ' + iid); return; } var with_ = share[iid], base = with_.reduce(function (s, k) { return s + totOf[k]; }, 0); got += (Number(i.TotalAmt) || 0) * (with_.length === 1 || !base ? 1 / with_.length : totOf[eid] / base); n++; });
      got = r2(got);
      return { id: eid, number: e.DocNumber || eid, date: e.TxnDate, customer: (e.CustomerRef || {}).name || '', status: e.TxnStatus || 'Pending', estimated: estd, invoices: n, invoiced: got, variance: n ? r2(got - estd) : null, pct: n && estd ? (got - estd) / estd : null };
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var done = rows.filter(function (r) { return r.invoices; }), sum = function (rs, k) { return r2(rs.reduce(function (s, r) { return s + (r[k] || 0); }, 0)); };
    var T = { estimated: sum(rows, 'estimated'), doneEst: sum(done, 'estimated'), invoiced: sum(done, 'invoiced'), variance: sum(done, 'variance') };
    var pcts = done.filter(function (r) { return r.pct != null; }), avgAbs = pcts.length ? pcts.reduce(function (s, r) { return s + Math.abs(r.pct); }, 0) / pcts.length : null, within = pcts.filter(function (r) { return Math.abs(r.pct) <= 0.1 + 1e-9; }).length;
    var by = {}; ['Pending', 'Accepted', 'Closed', 'Rejected'].forEach(function (s) { by[s] = { n: 0, v: 0 }; }); rows.forEach(function (r) { var b = by[r.status] = by[r.status] || { n: 0, v: 0 }; b.n++; b.v = r2(b.v + r.estimated); });
    var P = function (v) { return v == null ? '' : (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1) + '%'; };
    var card = function (t, inner, sub) { return '<div class="qb-card" style="margin-top:16px"><h3>' + h(t) + '</h3>' + (sub ? '<p style="margin:0 0 8px">' + h(sub) + '</p>' : '') + inner + '</div>'; };
    body.innerHTML = QB.kpis([{ label: 'Estimates', value: rows.length, money: false }, { label: 'Invoiced', value: done.length, money: false }, { label: 'Estimated (invoiced ones)', value: T.doneEst }, { label: 'Invoiced', value: T.invoiced }, { label: 'Average variance', value: avgAbs == null ? 'N/A — none invoiced yet' : (avgAbs * 100).toFixed(1) + '%', money: false }], c) +
      '<div class="qb-banner na" style="margin:12px 0">' + h(SCOPE) + '</div>' +
      card('By status', '<div class="qb-scroll"><table class="qb-grid"><thead><tr><th scope="col">Status</th><th scope="col" class="num">Estimates</th><th scope="col" class="num">Estimated</th></tr></thead><tbody>' + Object.keys(by).map(function (s) { return '<tr><td>' + h(s) + '</td><td class="num">' + by[s].n + '</td><td class="num">' + money(by[s].v) + '</td></tr>'; }).join('') + '</tbody><tfoot><tr class="k-total"><td>Total</td><td class="num">' + rows.length + '</td><td class="num">' + money(T.estimated) + '</td></tr></tfoot></table></div>') +
      card('Estimates', '<div class="qb-scroll"><table class="qb-grid"><thead><tr><th scope="col">Date</th><th scope="col">Estimate</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col" class="num">Estimated</th><th scope="col" class="num">Invoiced</th><th scope="col" class="num">Variance</th><th scope="col" class="num">Variance %</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) { return '<tr><td>' + h(r.date) + '</td><td>' + h(r.number) + '</td><td>' + h(r.customer) + '</td><td>' + h(r.status) + '</td><td class="num">' + money(r.estimated) + '</td><td class="num">' + (r.invoices ? money(r.invoiced) : 'Not invoiced') + '</td><td class="num">' + (r.variance == null ? '' : money(r.variance)) + '</td><td class="num">' + P(r.pct) + '</td></tr>'; }).join('') : '<tr><td colspan="8">No estimates dated in the period.</td></tr>') +
        '</tbody><tfoot><tr class="k-total"><td colspan="4">Total of the invoiced estimates</td><td class="num">' + money(T.doneEst) + '</td><td class="num">' + money(T.invoiced) + '</td><td class="num">' + money(T.variance) + '</td><td class="num">' + P(T.doneEst ? T.variance / T.doneEst : null) + '</td></tr></tfoot></table></div>',
        within + ' of ' + pcts.length + ' invoiced estimate(s) came within 10% of the estimate.');
    var checks = [
      { name: 'Estimated by status adds up to the total estimated', pass: QB.near(r2(Object.keys(by).reduce(function (s, k) { return s + by[k].v; }, 0)), T.estimated), detail: money(T.estimated) + ' across ' + rows.length + ' estimate(s)' },
      { name: 'Variance = invoiced − estimated, on every invoiced estimate and in total', pass: done.every(function (r) { return QB.near(r.variance, r2(r.invoiced - r.estimated)); }) && QB.near(T.variance, r2(T.invoiced - T.doneEst)), detail: money(T.invoiced) + ' − ' + money(T.doneEst) + ' = ' + money(T.variance) },
      { name: 'Statuses add up to the number of estimates', pass: Object.keys(by).reduce(function (s, k) { return s + by[k].n; }, 0) === rows.length, detail: rows.length + ' estimate(s)' },
      { name: 'Every linked invoice found', pass: missing.length ? null : true, info: !!missing.length, detail: missing.length ? 'Not in the invoices read (dated before ' + from + '?): ' + missing.slice(0, 5).join(', ') : done.reduce(function (s, r) { return s + r.invoices; }, 0) + ' linked invoice(s)' },
      { name: 'Every estimate and invoice loaded (no list at the ' + CAP + '-row cap)', pass: est.length < CAP && inv.length < CAP, detail: est.length < CAP && inv.length < CAP ? est.length + ' estimate(s), ' + inv.length + ' invoice(s)' : 'Possibly truncated at ' + CAP + ' rows — shorten the period' }
    ];
    this._x = { rows: rows, T: T, by: by };
    return { checks: checks, period: QB.periodLine(from, to), notes: [SCOPE, 'Amounts include GST on both sides (estimate and invoice totals). Variance and the average are over estimates with at least one invoice; pending, rejected and not-yet-invoiced estimates are listed but not averaged.'],
      na: ['Time estimates (QuickBooks records estimates in dollars only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Estimate Accuracy', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []], b = function (t) { return { v: t, s: 'bold' }; }, m = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    return [{ name: 'Estimates', rows: head.concat([['Date', 'Estimate', 'Customer', 'Status', 'Estimated', 'Invoiced', 'Variance', 'Variance %'].map(b)])
      .concat(x.rows.map(function (r) { return [r.date, r.number, r.customer, r.status, m(r.estimated), r.invoices ? m(r.invoiced) : 'Not invoiced', m(r.variance), r.pct == null ? '' : Math.round(r.pct * 1000) / 10]; }))
      .concat([[b('Total'), '', '', '', { v: x.T.estimated, s: 'moneyBold' }, { v: x.T.invoiced, s: 'moneyBold' }, { v: x.T.variance, s: 'moneyBold' }, '']]), widths: [12, 12, 30, 12, 14, 14, 14, 12] }];
  }
});

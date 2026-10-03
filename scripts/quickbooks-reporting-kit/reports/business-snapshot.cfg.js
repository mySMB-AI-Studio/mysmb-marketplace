QB.app({
  title: 'Business Snapshot', token: null, primary: 'pnl', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', cmpStart: 'compare_start', cmpEnd: 'compare_end', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', compare_start: '2025-08-01', compare_end: '2025-08-31', basis: 'Accrual', persona: 'Client',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"last_month","a":"custom","c":"prev_year","v":"","x":""}' },
  uses: { pnl: ['start_date', 'end_date', 'basis'], pnl_prev_year: ['compare_start', 'compare_end', 'basis'], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { pnl: 'get_report_profit_and_loss (by account)', pnl_prev_year: 'get_report_profit_and_loss (same period last year)', aged_receivables: 'get_report_aged_receivables', aged_payables: 'get_report_aged_payables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  compare: true,
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); };
    if (c.errors.pnl) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }] }; }
    if (!c.data.pnl) return {};
    function split(rep) { // income accounts (Income + Other Income) and expense accounts (Cost of Sales + Expenses + Other Expenses)
      var ls = rep ? QB.walk(rep) : [], top = {}, inc = [], exp = [];
      ls.forEach(function (l) { if (l.kind === 'header' && l.depth === 0) top[l.label] = l.group; });
      ls.forEach(function (l) { if (l.kind !== 'row') return; var g = top[l.path[0]]; var v = QB.val(l); if (v == null) return;
        if (g === 'Income' || g === 'OtherIncome') inc.push({ label: l.label, value: v }); else if (g === 'COGS' || g === 'Expenses' || g === 'OtherExpenses') exp.push({ label: l.label, value: v }); });
      var T = function (g) { return QB.val(QB.find(ls, g)) || 0; };
      return { inc: inc, exp: exp, incTot: Math.round((T('Income') + T('OtherIncome')) * 100) / 100, expTot: Math.round((T('COGS') + T('Expenses') + T('OtherExpenses')) * 100) / 100, ls: ls };
    }
    var cur = split(c.data.pnl), prev = c.data.pnl_prev_year ? split(c.data.pnl_prev_year) : null;
    function aged(id) { var rep = c.data[id]; if (!rep) return null; var cols = QB.cols(rep), bands = cols.slice(1, cols.length - 1).map(function (x) { return x.title; }), ls = QB.walk(rep), gt = QB.find(ls, 'GrandTotal', /^total$/i);
      return { bands: bands, rows: ls.filter(function (l) { return l.kind === 'row'; }).map(function (l) { var o = { name: l.label, total: l.values[l.values.length - 1] }; bands.forEach(function (b, i) { o['b' + i] = l.values[i]; }); return o; }), total: gt ? gt.values : null }; }
    var ar = aged('aged_receivables'), ap = aged('aged_payables');
    var per = QB.periodLine(c.inputs.start_date, c.inputs.end_date);
    body.innerHTML = '<div class="qb-grid2"><div class="qb-card"><h3>MY INCOME <span class="muted">· ' + QB.h(per) + '</span></h3><div class="muted">Total</div><div class="qb-kpi" style="border:0;padding:0"><div class="val">' + money(cur.incTot) + '</div></div><div id="d1"></div></div>' +
      '<div class="qb-card"><h3>MY EXPENSES <span class="muted">· ' + QB.h(per) + '</span></h3><div class="muted">Total</div><div class="qb-kpi" style="border:0;padding:0"><div class="val">' + money(cur.expTot) + '</div></div><div id="d2"></div></div></div>' +
      '<div class="qb-grid2"><div class="qb-card"><h3>PREVIOUS YEAR INCOME COMPARISON</h3><div id="b1"></div></div><div class="qb-card"><h3>PREVIOUS YEAR EXPENSE COMPARISON</h3><div id="b2"></div></div></div>' +
      '<div class="qb-card"><h3>WHO OWES ME</h3><div id="g1"></div></div><div class="qb-card"><h3>WHO I OWE</h3><div id="g2"></div></div>';
    QB.donut(document.getElementById('d1'), { title: 'My income', items: cur.inc, centre: '' }, c);
    QB.donut(document.getElementById('d2'), { title: 'My expenses', items: cur.exp, centre: '' }, c);
    QB.bars(document.getElementById('b1'), { title: 'Income vs previous year', labels: [per, 'Previous year'], series: [{ name: 'Income', values: [cur.incTot, prev ? prev.incTot : null] }] }, c);
    QB.bars(document.getElementById('b2'), { title: 'Expenses vs previous year', labels: [per, 'Previous year'], series: [{ name: 'Expenses', values: [cur.expTot, prev ? prev.expTot : null] }] }, c);
    [['g1', ar, 'aged_receivables', 'Customer'], ['g2', ap, 'aged_payables', 'Supplier']].forEach(function (x) {
      var el = document.getElementById(x[0]);
      if (c.errors[x[2]]) { el.innerHTML = '<p class="qb-err">' + QB.h(c.err(x[2])) + '</p>'; return; }
      if (!x[1]) return;
      var t = { name: 'TOTAL' }; x[1].bands.forEach(function (b, i) { t['b' + i] = x[1].total ? x[1].total[i] : null; }); t.total = x[1].total ? x[1].total[x[1].total.length - 1] : null;
      QB.grid(el, { filter: true, empty: 'Nothing new right now.', columns: [{ key: 'name', title: x[3] }].concat([{ key: 'total', title: 'TOTAL', money: true }], x[1].bands.map(function (b, i) { return { key: 'b' + i, title: b.toUpperCase(), money: true }; })), rows: x[1].rows, total: t }, c);
    });
    var incDon = QB.sum(cur.inc.filter(function (i) { return i.value > 0; }).map(function (i) { return i.value; })), expDon = QB.sum(cur.exp.filter(function (i) { return i.value > 0; }).map(function (i) { return i.value; }));
    var ageOk = function (a) { return a && a.total ? QB.near(a.total[a.total.length - 1], QB.sum(a.rows.map(function (r) { return r.total; }))) : null; };
    var negs = cur.inc.concat(cur.exp).filter(function (i) { return i.value < 0; }).length;
    var checks = [
      { name: 'My income donut total = P&L income (Income + Other Income)', pass: negs ? null : QB.near(incDon, cur.incTot), detail: money(incDon) + (negs ? ' — ' + negs + ' account(s) with negative amounts are not drawn in the donuts' : '') },
      { name: 'My expenses donut total = P&L expenses (Cost of Sales + Expenses + Other Expenses)', pass: negs ? null : QB.near(expDon, cur.expTot), detail: money(expDon) },
      { name: 'Who owes me total = A/R ageing total', pass: ageOk(ar), detail: ar && ar.total ? money(ar.total[ar.total.length - 1]) : '' },
      { name: 'Who I owe total = A/P ageing total', pass: ageOk(ap), detail: ap && ap.total ? money(ap.total[ap.total.length - 1]) : '' }];
    this._x = { cur: cur, prev: prev, ar: ar, ap: ap, per: per };
    return { checks: checks, period: per, notes: ['One period control drives both donuts (QuickBooks offers a period menu per card).'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var two = function (name, list, tot) { return { name: name, widths: [44, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [x.per], [], [{ v: 'Account', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat(list.map(function (i) { return [i.label, { v: i.value, s: 'money' }]; }), [[{ v: 'Total', s: 'bold' }, { v: tot, s: 'moneyBold' }]]) }; };
    var age = function (name, a, who) { if (!a) return null; return { name: name, widths: [40, 16, 16, 16, 16, 16, 16], rows: [[{ v: who, s: 'bold' }, { v: 'TOTAL', s: 'bold' }].concat(a.bands.map(function (b) { return { v: b, s: 'bold' }; }))].concat(a.rows.map(function (r) { return [r.name, { v: r.total, s: 'money' }].concat(a.bands.map(function (b, i) { return r['b' + i] == null ? null : { v: r['b' + i], s: 'money' }; })); })) }; };
    return [two('My income', x.cur.inc, x.cur.incTot), two('My expenses', x.cur.exp, x.cur.expTot), age('Who owes me', x.ar, 'Customer'), age('Who I owe', x.ap, 'Supplier')].filter(Boolean);
  }
});

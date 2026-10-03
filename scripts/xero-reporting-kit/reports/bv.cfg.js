XK.app({
  title: 'Budget vs Actual', basisLabel: 'Accrual', primary: 'actual', dated: ['actual'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-08-31', m_from: '2026-08-01', m_n: 1, org: '',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"fy_lm","a":"custom","c":"none","v":"accounts"}' },
  uses: { budget_fwd: ['from_date', 'org'], budget_back: ['to_date', 'org'], actual: ['from_date', 'to_date', 'org'], actual_m: ['m_from', 'to_date', 'm_n', 'org'], budgets: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  // Xero's Budget Summary takes a date, a number of periods and a period size, but says nothing about whether the date is the
  // first or the last period: ask both ways (12 months from the start, 12 months to the end) and use the columns that cover the period.
  tools: { budget_fwd: 'get_budget_summary (12 months from the period start)', budget_back: 'get_budget_summary (12 months to the period end)', actual: 'get_profit_and_loss (the period)', actual_m: 'get_profit_and_loss (month by month, for the monthly view and the tie)', budgets: 'list_budgets (which budgets exist)', org: 'get_organisation', connections: 'list_connections' },
  presets: [['fy_lm', 'Financial year to last month'], ['this_fy_td', 'This financial year to date'], ['last_month', 'Last month'], ['this_month', 'This month'], ['last_quarter', 'Last quarter'], ['this_quarter', 'This quarter'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['accounts', 'By account'], ['months', 'By month']],
  derive: function (inp, fyMonth, d) {
    var o = {};
    if (d && d.p === 'fy_lm') { // financial year to the end of last month (all of last year in the year's first month)
      var t = XK.asAt('today'), fs = XK.fyStartOf(t, fyMonth || 7), lm = XK.iso(XK.eom(+t.slice(0, 4), +t.slice(5, 7) - 1));
      if (lm < fs) { var pe = XK.addDaysIso(fs, -1); o.from_date = XK.fyStartOf(pe, fyMonth || 7); o.to_date = pe; } else { o.from_date = fs; o.to_date = lm; }
    }
    var f = o.from_date || inp.from_date, e = o.to_date || inp.to_date, n = (+e.slice(0, 4) - +f.slice(0, 4)) * 12 + (+e.slice(5, 7) - +f.slice(5, 7)) + 1;
    o.m_from = e.slice(0, 8) + '01'; o.m_n = Math.max(1, Math.min(11, n - 1)); // at least 1: Xero's periods counts the earlier months shown
    return o;
  },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.actual) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('actual')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('actual') }] }; }
    if (!c.data.actual) return {};
    // the months of the period
    var months = [], k = from.slice(0, 7); while (k <= to.slice(0, 7) && months.length < 24) { months.push(k); var y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } k = y + '-' + String(m).padStart(2, '0'); }
    // the budget: whichever Budget Summary has a column for every month of the period
    var pick = ['budget_fwd', 'budget_back'].map(function (id) { var w = c.data[id] ? XK.walk(c.data[id]) : null, keys = w ? w.columns.map(XK.monthKey) : []; return { id: id, w: w, keys: keys, hit: months.filter(function (mm) { return keys.indexOf(mm) >= 0; }).length }; })
      .sort(function (a, b) { return b.hit - a.hit; })[0], bw = pick.w, covered = pick.hit === months.length;
    var cols = bw ? pick.keys.map(function (kk, i) { return months.indexOf(kk) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; }) : [];
    var bsum = function (l) { return XK.sum(cols.map(function (i) { return l.values[i]; })); };
    var hasBudget = bw && bw.lines.some(function (l) { return l.kind === 'row' && cols.some(function (i) { return Math.abs(l.values[i] || 0) > 0.004; }); });
    // actual by account (and section) from the period P&L
    var aw = XK.walk(c.data.actual), act = {}, actSec = {}; aw.lines.filter(function (l) { return l.kind === 'row'; }).forEach(function (l) { act[l.id || l.label] = { v: l.values[0] || 0, label: l.label, group: l.group }; });
    aw.sections.forEach(function (s) { actSec[s.title] = XK.sectionTotal(s, 0); });
    var incomeRe = /^(?!less)(.*income|revenue|sales|trading)/i, fav = function (group, v) { return v == null || Math.abs(v) < 0.005 ? null : incomeRe.test(group) ? v > 0 : v < 0; };
    // rows: every account in the budget, then actual-only accounts; grouped as Xero returns them
    var rows = [], seen = {}, groups = [];
    (bw ? bw.sections : aw.sections).forEach(function (s) { groups.push(s.title); });
    aw.sections.forEach(function (s) { if (groups.indexOf(s.title) < 0) groups.push(s.title); });
    groups.forEach(function (g) {
      var bs = bw ? bw.sections.filter(function (s) { return s.title === g; })[0] : null, as = aw.sections.filter(function (s) { return s.title === g; })[0];
      var list = [];
      (bs ? bs.rows : []).forEach(function (l) { var key = l.id || l.label, a = act[key]; seen[key] = 1; list.push({ group: g, label: l.label, budget: hasBudget ? bsum(l) : null, actual: a ? a.v : 0 }); });
      (as ? as.rows : []).forEach(function (l) { var key = l.id || l.label; if (seen[key]) return; seen[key] = 1; list.push({ group: g, label: l.label, budget: null, actual: l.values[0] || 0 }); });
      if (!list.length) return;
      list.forEach(function (r) { r.variance = r.budget == null ? null : r2(r.actual - r.budget); r.pct = r.budget ? r.variance / Math.abs(r.budget) : null; r.fav = fav(g, r.variance); });
      var bt = bs ? (hasBudget ? bsum(bs.summary || { values: [] }) : null) : null, at = as ? actSec[g] : XK.sum(list.map(function (r) { return r.actual; }));
      rows.push({ kind: 'header', label: g.replace(/^Less\s+/i, '') });
      rows = rows.concat(list.map(function (r) { return Object.assign({ kind: 'row' }, r); }));
      var tv = bt == null ? null : r2(at - bt);
      rows.push({ kind: 'total', group: g, label: 'Total ' + g.replace(/^Less\s+/i, ''), budget: bt, actual: at, variance: tv, pct: bt ? tv / Math.abs(bt) : null, fav: fav(g, tv), bs: bs, list: list });
    });
    var calcOf = function (w, re, col) { var l = w ? w.lines.filter(function (x) { return x.kind === 'total' && re.test(x.label); })[0] : null; return l ? (col == null ? l : l.values[col]) : null; };
    var npB = hasBudget && bw ? (function () { var l = calcOf(bw, /^net profit$/i); return l ? bsum(l) : null; })() : null, plp = XK.plParts(aw), npA = plp.np;
    var npV = npB == null ? null : r2(npA - npB);
    rows.push({ kind: 'total', label: 'Net Profit', budget: npB, actual: npA, variance: npV, pct: npB ? npV / Math.abs(npB) : null, fav: fav('income', npV), net: true });
    // by month: budget vs actual net profit and income
    var mw = c.data.actual_m ? XK.walk(c.data.actual_m) : null, mc = mw ? XK.monthCols(mw) : null, byM = months.map(function (mm) {
      var bi = pick.keys.indexOf(mm), b = hasBudget && bi >= 0 && bw ? calcOf(bw, /^net profit$/i, bi) : null, ai = mc ? mc.idx[mm] : null, a = ai != null ? calcOf(mw, /^net profit$/i, ai) : null;
      return { month: XK.monthLabel(mm), budget: b, actual: a, variance: b == null || a == null ? null : r2(a - b) }; });
    var view = c.view || 'accounts', cls = function (r) { return r.fav === true ? 'pos' : r.fav === false ? 'neg' : ''; };
    var cell = function (v) { return v == null ? '<td class="num muted">N/A</td>' : '<td class="num">' + money(v) + '</td>'; };
    var table = '<div class="xk-scroll"><table class="xk-grid"><thead><tr><th>Account</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th class="num">Variance %</th></tr></thead><tbody>' +
      rows.map(function (r) { if (r.kind === 'header') return '<tr class="k-head"><td colspan="5"><strong>' + XK.h(r.label) + '</strong></td></tr>';
        return '<tr class="' + (r.kind === 'total' ? 'k-total' : '') + '"><td' + (r.kind === 'row' ? ' style="padding-left:18px"' : '') + '>' + XK.h(r.label) + '</td>' + cell(r.budget) + cell(r.actual) + '<td class="num ' + cls(r) + '">' + (r.variance == null ? 'N/A' : money(r.variance)) + '</td><td class="num ' + cls(r) + '">' + (r.pct == null ? '' : XK.pct(r.pct, 1)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var budgetsList = ((c.data.budgets || {}).Budgets || []), several = budgetsList.length > 1;
    body.innerHTML = XK.kpis([{ label: 'Net profit — budget', value: npB, text: npB == null ? 'N/A — no budget' : null }, { label: 'Net profit — actual', value: npA }, { label: 'Variance', value: npV, text: npV == null ? 'N/A' : null, red: npV != null && npV < 0 }, { label: 'Months', value: months.length, money: false }], c) +
      (!hasBudget ? '<p class="xk-err">' + (bw ? 'There is no budget in Xero for ' + XK.rangeLabel(from, to) + ' — set one up under Business → Budget manager.' : XK.h(c.err('budget_fwd') || c.err('budget_back') || 'Budget Summary unavailable')) + '</p>' : '') +
      (several ? '<p class="muted">Xero has ' + budgetsList.length + ' budgets (' + XK.h(budgetsList.map(function (b) { return b.Description || b.Type; }).join(', ')) + '). The Budget Summary always returns the overall budget, so that is the one shown.</p>' : '') +
      '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'months' ? 'Net profit by month — budget vs actual' : 'Budget vs actual by account') + '</h3><div id="bv-main">' + (view === 'months' ? '' : table) + '</div></div>';
    if (view === 'months') { var el = document.getElementById('bv-main'); XK.bars(el, { title: 'Net profit by month', labels: byM.map(function (x) { return x.month.slice(0, 3); }), series: [{ name: 'Budget', values: byM.map(function (x) { return x.budget; }) }, { name: 'Actual', values: byM.map(function (x) { return x.actual; }) }] }, c);
      var g = document.createElement('div'); el.appendChild(g); XK.grid(g, { rows: byM, columns: [{ key: 'month', title: 'Month' }, { key: 'budget', title: 'Budget', money: true }, { key: 'actual', title: 'Actual', money: true }, { key: 'variance', title: 'Variance', money: true }] }, c); }
    // checks
    var budTies = hasBudget && bw ? rows.filter(function (r) { return r.kind === 'total' && r.bs && r.bs.summary; }).filter(function (r) { return !XK.near(XK.sum(r.bs.rows.map(bsum)), r.budget); }) : null;
    var actTies = rows.filter(function (r) { return r.kind === 'total' && !r.net && r.list; }).filter(function (r) { return !XK.near(XK.sum(r.list.map(function (x) { return x.actual; })), r.actual); });
    var monthEnd = to === XK.iso(XK.eom(+to.slice(0, 4), +to.slice(5, 7))), mSum = byM.every(function (x) { return x.actual != null; }) ? XK.sum(byM.map(function (x) { return x.actual; })) : null;
    var checks = [
      { name: 'Budget: every section total = Σ its account rows (Xero\'s Budget Summary)', pass: budTies == null ? null : budTies.length === 0, detail: budTies == null ? (bw ? 'N/A — no budget for the period' : (c.err('budget_fwd') || 'N/A')) : budTies.length ? budTies.length + ' section(s) differ, e.g. ' + budTies[0].label : 'Every section' },
      { name: 'Budget columns cover every month of the period', pass: bw ? covered : null, detail: bw ? (covered ? months.length + ' month(s), ' + XK.monthLabel(months[0]) + ' to ' + XK.monthLabel(months[months.length - 1]) : 'The Budget Summary has ' + pick.hit + ' of the ' + months.length + ' months') : (c.err('budget_fwd') || 'N/A') },
      { name: 'Actual: every section total = Σ its account rows (Xero\'s Profit and Loss)', pass: actTies.length === 0, detail: actTies.length ? actTies.length + ' section(s) differ, e.g. ' + actTies[0].label : 'Net profit ' + money(npA) },
      !mw || mSum == null ? { name: 'Monthly actuals = the period\'s Profit and Loss', pass: null, detail: c.err('actual_m') || 'N/A — monthly columns unavailable' }
        : monthEnd ? { name: 'Monthly actuals (a separate Xero report, month by month) add up to the period\'s net profit', pass: XK.near(mSum, npA), detail: money(mSum) + ' vs ' + money(npA) }
        : { name: 'Monthly actuals vs the period\'s net profit (information — the period ends part-way through a month)', pass: null, info: true, detail: money(mSum) + ' vs ' + money(npA) },
      { name: 'A line with no budget shows N/A, never $0 (information)', pass: null, info: true, detail: rows.filter(function (r) { return r.kind === 'row' && r.budget == null; }).length + ' line(s) without a budget' }
    ];
    var notes = ['Budget = Xero\'s overall budget (Budget Summary), summed over the months of the period; actual = the Profit and Loss for the same dates (accrual). Variance = actual − budget: favourable is green (more income, less cost), unfavourable red.'];
    if (!monthEnd) notes.push('The period ends on ' + to + ', part-way through a month; budgets are whole months, so that month\'s variance is not like for like.');
    this._x = { rows: rows, byM: byM };
    return { checks: checks, notes: notes, na: ['Tracking-category budgets (Xero\'s Budget Summary returns the overall budget only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; };
    var a = head('Budget vs Actual').concat([['Account', 'Budget', 'Actual', 'Variance', 'Variance %'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.rows.map(function (r) { return r.kind === 'header' ? [{ v: r.label, s: 'bold' }] : [r.kind === 'total' ? { v: r.label, s: 'bold' } : r.label, mv(r.budget), mv(r.actual), mv(r.variance), r.pct == null ? '' : Math.round(r.pct * 1000) / 10 + '%']; }));
    var m = head('By month').concat([['Month', 'Budget', 'Actual', 'Variance'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.byM.map(function (r) { return [r.month, mv(r.budget), mv(r.actual), mv(r.variance)]; }));
    return [{ name: 'Budget vs Actual', rows: a, widths: [36, 16, 16, 16, 12] }, { name: 'By month', rows: m, widths: [16, 16, 16, 16] }];
  }
});

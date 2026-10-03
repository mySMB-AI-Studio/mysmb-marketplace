XK.app({
  title: 'Performance Overview', primary: 'pnl_12', dated: ['bs'], org: 'org', conns: 'connections',
  inputs: { asAt: 'end_date', basis: 'basis', org: 'org', display: 'display' },
  defaults: { end_date: '2026-08-31', m_start: '2026-08-01', prior_end: '2025-08-31', prior_m_start: '2025-08-01', window_start: '2025-09-01', basis: 'Accrual', org: '',
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_last_month","c":"none","v":""}' },
  uses: { bs_12: ['end_date', 'org'], bs_p12: ['prior_end', 'org'], pnl_12: ['m_start', 'end_date', 'org'], pnl_12_cash: ['m_start', 'end_date', 'org'], pnl_p12: ['prior_m_start', 'prior_end', 'org'], pnl_p12_cash: ['prior_m_start', 'prior_end', 'org'], pnl_total: ['window_start', 'end_date', 'org'], pnl_total_cash: ['window_start', 'end_date', 'org'], bs: ['end_date', 'org'], org: ['org'], connections: [] },
  tools: { bs_12: 'get_balance_sheet (12 month-ends: monthly debtors / creditors days)', bs_p12: 'get_balance_sheet (the 12 month-ends a year earlier)', pnl_12: 'get_profit_and_loss (12 monthly columns: periods 11, MONTH)', pnl_12_cash: 'get_profit_and_loss (12 monthly columns: periods 11, MONTH, cash basis)', pnl_p12: 'get_profit_and_loss (the prior 12 months)', pnl_p12_cash: 'get_profit_and_loss (the prior 12 months, cash basis)', pnl_total: 'get_profit_and_loss (the 12 months as one total — tie)', pnl_total_cash: 'get_profit_and_loss (the 12 months as one total — tie, cash basis)', bs: 'get_balance_sheet (end of the month and a year earlier)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_last_month', 'End of last month'], ['end_this_month', 'End of this month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']],
  derive: function (inp) {
    var e = inp.end_date, back = function (s, k) { var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1 - k, 1)), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, last = XK.eom(y, m).getUTCDate(), eomIn = +p[2] === XK.eom(+p[0], +p[1]).getUTCDate(); return y + '-' + String(m).padStart(2, '0') + '-' + String(eomIn ? last : Math.min(+p[2], last)).padStart(2, '0'); };
    var pe = back(e, 12); return { m_start: e.slice(0, 8) + '01', prior_end: pe, prior_m_start: pe.slice(0, 8) + '01', window_start: back(e, 11).slice(0, 8) + '01' };
  },
  render: function (c) {
    var Bk = c.inputs.basis === 'Cash' ? '_cash' : '', PL = { pnl_12: 1, pnl_p12: 1, pnl_total: 1 }, D = function (id) { return c.data[PL[id] ? id + Bk : id]; }, Er = function (id) { return c.errors[PL[id] ? id + Bk : id]; }, Em = function (id) { return c.err(PL[id] ? id + Bk : id); };
    var body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); }, pct = function (v) { return v == null || !isFinite(v) ? 'N/A' : Math.round(v * 100) + '%'; };
    var end = c.inputs.end_date, months = XK.monthsEnding(end, 12), keys = months.map(function (m) { return m.key; });
    var pkeys = XK.monthsEnding(c.inputs.prior_end, 12).map(function (m) { return m.key; });
    if (Er('pnl_12')) { body.innerHTML = '<p class="xk-err">' + XK.h(Em('pnl_12')) + '</p>'; return { checks: [{ name: 'Monthly Profit and Loss loaded', pass: false, detail: Em('pnl_12') }] }; }
    if (!D('pnl_12')) return {};
    var w = XK.walk(D('pnl_12')), wp = D('pnl_p12') ? XK.walk(D('pnl_p12')) : null, mc = XK.monthCols(w), mcp = wp ? XK.monthCols(wp) : null;
    var series = function (walked, mcols, ks, f) { return ks.map(function (k) { var i = mcols && mcols.idx[k]; return i == null ? null : f(XK.plParts(walked, i)); }); };
    var S = function (f) { return { cur: series(w, mc, keys, f), pri: wp ? series(wp, mcp, pkeys, f) : keys.map(function () { return null; }) }; };
    var tot = function (a) { return a.some(function (v) { return v == null; }) ? null : XK.sum(a); };
    var np = S(function (p) { return p.np; }), inc = S(function (p) { return p.income; }), exp = S(function (p) { return p.expenses; }), gp = S(function (p) { return p.gp == null ? p.trading - p.cos : p.gp; }), trd = S(function (p) { return p.trading; });
    var T = { np: [tot(np.cur), tot(np.pri)], inc: [tot(inc.cur), tot(inc.pri)], exp: [tot(exp.cur), tot(exp.pri)], gp: [tot(gp.cur), tot(gp.pri)], trd: [tot(trd.cur), tot(trd.pri)] };
    var margin = function (a, b) { return a == null || !b ? null : a / b; };
    var M = { npm: [margin(T.np[0], T.inc[0]), margin(T.np[1], T.inc[1])], gpm: [margin(T.gp[0], T.trd[0]), margin(T.gp[1], T.trd[1])] };
    var bsw = c.data.bs ? XK.walk(c.data.bs) : null, b0 = bsw ? XK.bsParts(bsw, 0) : null, b1 = bsw && bsw.columns.length > 1 ? XK.bsParts(bsw, 1) : null;
    var days = function (bal, flow) { return bal == null || !flow ? null : bal / flow * 365; };
    var cogs = function (i) { return exp.cur && T.exp[i] != null ? T.exp[i] : null; };
    var DD = [days(b0 && b0.ar, T.inc[0]), days(b1 && b1.ar, T.inc[1])], CD = [days(b0 && b0.ap, T.exp[0]), days(b1 && b1.ap, T.exp[1])];
    var lbl = function (ks) { return 'Total ' + XK.monthLabel(ks[0]) + ' to ' + XK.monthLabel(ks[11]); };
    var delta = function (a, b) { return a == null || b == null || !b ? null : (a - b) / Math.abs(b); };
    var up = function (dv, goodUp) { if (dv == null) return ''; var good = goodUp ? dv >= 0 : dv <= 0; return '<span class="chip ' + (good ? 'up' : 'down') + '">' + (dv >= 0 ? '▲ ' : '▼ ') + Math.abs(dv * 100).toFixed(2) + '% ' + (dv >= 0 ? 'Up' : 'Down') + '</span>'; };
    var best = function (a) { var bi = -1; a.forEach(function (v, i) { if (v != null && (bi < 0 || v > a[bi])) bi = i; }); return bi; };
    var insight = function (name, cur, pri, arr, isMoney) { var dv = delta(cur, pri), bi = best(arr); return (dv == null ? name + ': no prior-year comparison.' : name + ' is ' + (dv >= 0 ? 'up ' : 'down ') + Math.abs(dv * 100).toFixed(1) + '% on the prior 12 months') + (bi >= 0 && isMoney ? '; the highest month was ' + XK.monthLabel(keys[bi]) + ' (' + money(arr[bi]) + ').' : '.'); };
    var W = [];
    var widget = function (id, title, cur, pri, fmtv, goodUp, ins) { W.push('<div class="xk-card xk-widget"><h3>' + title + '</h3><div class="cur">' + fmtv(cur) + '</div><div class="pri">' + lbl(keys) + '</div><div class="pri">Prior: ' + fmtv(pri) + ' · ' + lbl(pkeys) + '</div>' + up(delta(cur, pri), goodUp) + '<div id="' + id + '"></div><div class="insight">Insight (computed): ' + XK.h(ins) + '</div></div>'); };
    widget('pf-np', 'Net profit or loss', T.np[0], T.np[1], money, true, insight('Net profit', T.np[0], T.np[1], np.cur, true));
    widget('pf-inc', 'Total income', T.inc[0], T.inc[1], money, true, insight('Income', T.inc[0], T.inc[1], inc.cur, true));
    widget('pf-exp', 'Total expenses', T.exp[0], T.exp[1], money, false, insight('Expenses', T.exp[0], T.exp[1], exp.cur, true));
    widget('pf-npm', 'Net profit margin', M.npm[0], M.npm[1], pct, true, 'Net profit ÷ total income: ' + pct(M.npm[0]) + ' against ' + pct(M.npm[1]) + ' a year earlier.');
    widget('pf-gpm', 'Gross profit margin', M.gpm[0], M.gpm[1], pct, true, 'Gross profit ÷ trading income: ' + pct(M.gpm[0]) + ' against ' + pct(M.gpm[1]) + ' a year earlier.');
    // operating expenses breakdown, latest month
    var li = mc ? mc.idx[keys[11]] : null, opexRows = li == null ? [] : w.lines.filter(function (l) { return l.kind === 'row' && XK.isDeduction(l.group) && !/cost of sales/i.test(l.group); }).map(function (l) { return { label: l.label, value: l.values[li] }; }).filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    W.push('<div class="xk-card xk-widget"><h3>Operating expenses breakdown</h3><div class="pri">' + XK.monthLabel(keys[11]) + '</div><div id="pf-opex"></div><div class="insight">Insight (computed): ' + XK.h(opexRows.length ? opexRows[0].label + ' is the largest operating expense in ' + XK.monthLabel(keys[11]) + ' (' + money(opexRows[0].value) + ', ' + pct(opexRows[0].value / XK.sum(opexRows.map(function (x) { return x.value; }))) + ').' : 'No operating expenses this month.') + '</div></div>');
    W.push('<div class="xk-card xk-widget"><h3>Bank accounts balance</h3><div class="cur">' + (b0 && b0.bank != null ? money(b0.bank) : 'N/A') + '</div><div class="pri">At ' + XK.asOfLine(end).replace(/^As at /, '') + '</div>' + (b1 && b1.bank != null ? '<div class="pri">Prior: ' + money(b1.bank) + ' · a year earlier</div>' + up(delta(b0 && b0.bank, b1.bank), true) : '') + '<div id="pf-bank"></div><div class="insight">Insight (computed): ' + XK.h(b0 && b1 && b0.bank != null && b1.bank != null ? 'Cash is ' + (b0.bank >= b1.bank ? 'up ' : 'down ') + money(Math.abs(b0.bank - b1.bank)) + ' on a year earlier.' : 'Bank balances from the Balance Sheet.') + '</div></div>');
    widget('pf-dd', 'Debtors days', DD[0], DD[1], function (v) { return v == null ? 'N/A' : Math.round(v) + ' days'; }, false, 'Accounts receivable ÷ income over the 12 months × 365.');
    widget('pf-cd', 'Creditors days', CD[0], CD[1], function (v) { return v == null ? 'N/A' : Math.round(v) + ' days'; }, true, 'Accounts payable ÷ expenses over the 12 months × 365.');
    body.innerHTML = '<p class="muted">Monthly · 12 months ending ' + XK.monthLabel(keys[11]) + ' · compared with the same 12 months a year earlier</p><div class="xk-grid3">' + W.join('') + '</div>';
    var labs = keys.map(function (k) { return XK.monthLabel(k).slice(0, 3); }), two = function (id, a, fmt) { XK.bars(document.getElementById(id), { title: id, labels: labs, fmt: fmt, series: [{ name: 'Current', values: a.cur }, { name: 'Prior year', values: a.pri }] }, c); };
    two('pf-np', np); two('pf-inc', inc); two('pf-exp', exp);
    var ratio = function (a, b) { return a.map(function (v, i) { return v == null || !b[i] ? null : v / b[i] * 100; }); }, pc = function (v) { return Math.round(v) + '%'; };
    XK.line(document.getElementById('pf-npm'), { title: 'Net profit margin', labels: labs, fmt: pc, series: [{ name: 'Current', values: ratio(np.cur, inc.cur) }, { name: 'Prior year', values: ratio(np.pri, inc.pri) }] }, c);
    XK.line(document.getElementById('pf-gpm'), { title: 'Gross profit margin', labels: labs, fmt: pc, series: [{ name: 'Current', values: ratio(gp.cur, trd.cur) }, { name: 'Prior year', values: ratio(gp.pri, trd.pri) }] }, c);
    XK.donut(document.getElementById('pf-opex'), { title: 'Operating expenses', items: opexRows, centre: money(XK.sum(opexRows.map(function (x) { return x.value; }))) }, c);
    if (b0) XK.donut(document.getElementById('pf-bank'), { title: 'Bank accounts', items: b0.bankRows.map(function (r) { return { label: r.label, value: r.value }; }), centre: money(b0.bank) }, c);
    // monthly days: the month-end balance ÷ that month's income (or expenses) × days in the month
    var mdays = function (id, ks, flowArr, part) { var v = c.data[id] && !c.errors[id] ? XK.walk(c.data[id]) : null, m = v ? XK.monthCols(v) : null; return ks.map(function (k, i) { var j = m && m.idx[k], f = flowArr[i]; if (j == null || !f) return null; var b = XK.bsParts(v, j)[part]; return b == null ? null : b / f * XK.eom(+k.slice(0, 4), +k.slice(5, 7)).getUTCDate(); }); };
    var dl = function (id, part, flow) { var cur = mdays('bs_12', keys, flow.cur, part), pri = mdays('bs_p12', pkeys, flow.pri, part); XK.line(document.getElementById(id), { title: id, labels: labs, fmt: function (v) { return Math.round(v) + ' days'; }, series: [{ name: 'Current', values: cur }, { name: 'Prior year', values: pri }] }, c); return cur; };
    var ddm = dl('pf-dd', 'ar', inc), cdm = dl('pf-cd', 'ap', exp);

    // Checks
    var pt = D('pnl_total') ? XK.plParts(XK.walk(D('pnl_total'))) : null, has12 = mc && keys.every(function (k) { return mc.idx[k] != null; }), hasP = mcp && pkeys.every(function (k) { return mcp.idx[k] != null; });
    var checks = [
      { name: 'Xero returned 12 monthly columns (current and prior year)', pass: has12 && (!wp || hasP), detail: (mc ? mc.keys.length : 0) + ' + ' + (mcp ? mcp.keys.length : 0) + ' month columns' + (has12 ? '' : ' — expected ' + XK.monthLabel(keys[0]) + '…' + XK.monthLabel(keys[11])) },
      { name: 'Σ monthly net profit = the 12-month Profit and Loss', pass: pt && T.np[0] != null ? XK.near(T.np[0], pt.np, 0.05) : null, detail: pt ? money(T.np[0]) + ' vs ' + money(pt.np) : Em('pnl_total') },
      { name: 'Σ monthly income and expenses = the 12-month Profit and Loss', pass: pt && T.inc[0] != null ? XK.near(T.inc[0], pt.income, 0.05) && XK.near(T.exp[0], pt.expenses, 0.05) : null, detail: pt ? money(T.inc[0]) + ' / ' + money(T.exp[0]) : 'N/A' },
      (function () { var run = XK.runningTies(w); return { name: 'Every month: Xero\'s Gross Profit and Net Profit lines = the sections above them (so the margins rest on them)', pass: run.checked ? run.failed.length === 0 : null, detail: run.failed.length ? run.failed.join(', ') : 'Net ' + pct(M.npm[0]) + ' · Gross ' + pct(M.gpm[0]) + ' over the 12 months' }; })(),
      (function () { var v = c.data.bs_12 && !c.errors.bs_12 ? XK.walk(c.data.bs_12) : null, m = v ? XK.monthCols(v) : null, j = m && m.idx[keys[11]], x = j == null ? null : XK.bsParts(v, j); return { name: 'Receivables and payables at ' + end + ' agree between Xero\'s two Balance Sheet reports (month-ends and year comparison)', pass: x && b0 && x.ar != null && b0.ar != null ? XK.near(x.ar, b0.ar) && XK.near(x.ap, b0.ap) : null, detail: x && b0 ? 'AR ' + money(x.ar) + ' vs ' + money(b0.ar) + ' · AP ' + money(x.ap) + ' vs ' + money(b0.ap) : c.err('bs_12') || c.err('bs') }; })(),
      { name: 'Debtors / creditors days formula (information)', pass: null, info: true, detail: '12 months: AR ÷ income × 365 = ' + (DD[0] == null ? 'N/A' : Math.round(DD[0]) + ' days') + '; AP ÷ expenses × 365 = ' + (CD[0] == null ? 'N/A' : Math.round(CD[0]) + ' days') + '. Monthly: month-end balance ÷ that month × days in the month' },
      { name: 'Balance Sheet balances (Total Assets = Total Liabilities + Total Equity)', pass: b0 && b0.totalAssets != null ? XK.near(b0.totalAssets, b0.totalLiabilities + b0.equity) : null, detail: b0 ? money(b0.totalAssets) : 'N/A' }
    ];
    this._x = { keys: keys, np: np, inc: inc, exp: exp, T: T, M: M, DD: DD, CD: CD };
    return { checks: checks, notes: [(c.inputs.basis === 'Cash' ? 'Cash' : 'Accrual') + ' basis, ' + c.currency + '. Each widget compares the 12 months ending ' + XK.monthLabel(keys[11]) + ' with the same months a year earlier.', 'Insights are computed from the figures shown only (Xero Analytics\' own AI insights are not in the Xero API).'],
      na: ['Xero Analytics widget settings (columns, filters) beyond the monthly view'], period: '12 months ending ' + XK.asOfLine(end).replace(/^As at /, '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Performance overview', s: 'bold' }], ['12 months ending ' + XK.monthLabel(x.keys[11])], [], [{ v: 'Month', s: 'bold' }, { v: 'Income', s: 'bold' }, { v: 'Expenses', s: 'bold' }, { v: 'Net profit', s: 'bold' }, { v: 'Prior-year net profit', s: 'bold' }]];
    var rows = head.concat(x.keys.map(function (k, i) { return [XK.monthLabel(k), { v: x.inc.cur[i], s: 'money' }, { v: x.exp.cur[i], s: 'money' }, { v: x.np.cur[i], s: 'money' }, { v: x.np.pri[i], s: 'money' }]; }));
    rows.push([{ v: 'Total', s: 'bold' }, { v: x.T.inc[0], s: 'moneyBold' }, { v: x.T.exp[0], s: 'moneyBold' }, { v: x.T.np[0], s: 'moneyBold' }, { v: x.T.np[1], s: 'moneyBold' }]);
    rows.push([], ['Net profit margin', { v: x.M.npm[0], s: 'pct' }, null, 'Prior', { v: x.M.npm[1], s: 'pct' }], ['Gross profit margin', { v: x.M.gpm[0], s: 'pct' }, null, 'Prior', { v: x.M.gpm[1], s: 'pct' }], ['Debtors days', x.DD[0] == null ? null : Math.round(x.DD[0]), null, 'Prior', x.DD[1] == null ? null : Math.round(x.DD[1])], ['Creditors days', x.CD[0] == null ? null : Math.round(x.CD[0]), null, 'Prior', x.CD[1] == null ? null : Math.round(x.CD[1])]);
    return [{ name: 'Performance overview', rows: rows, widths: [26, 16, 16, 16, 20] }];
  }
});

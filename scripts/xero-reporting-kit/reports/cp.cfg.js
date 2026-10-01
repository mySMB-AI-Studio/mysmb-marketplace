XK.app({
  title: 'Cash position', primary: 'bs_12', dated: ['bs_12'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { asAt: 'end_date', org: 'org', display: 'display' },
  defaults: { end_date: '2026-08-31', m_start: '2026-08-01', window_start: '2025-09-01', org: '', page: 1,
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_last_month","c":"none","v":""}' },
  uses: { bs_12: ['end_date', 'org'], bank: ['m_start', 'end_date', 'org'], bank_total: ['window_start', 'end_date', 'org'], receivables: ['org'], payables: ['org'], org: ['org'], connections: [] },
  paged: { receivables: { input: 'page', key: 'Invoices' }, payables: { input: 'page', key: 'Invoices' } },
  fan: { bank: function (inp) { return XK.monthsEnding(inp.end_date, 12).map(function (m) { return { key: m.key, inputs: { m_start: m.start, end_date: m.end < inp.end_date ? m.end : inp.end_date } }; }); } },
  tools: { bs_12: 'get_balance_sheet (12 month-ends: periods 11, MONTH)', bank: 'get_bank_summary (each of the 12 months)', bank_total: 'get_bank_summary (the 12 months as one — tie)', receivables: 'list_invoices (sales invoices awaiting payment)', payables: 'list_invoices (bills awaiting payment)', org: 'get_organisation', connections: 'list_connections' },
  asats: [['end_last_month', 'End of last month'], ['today', 'Today'], ['end_this_month', 'End of this month'], ['custom', 'Custom']],
  derive: function (inp) { var p = inp.end_date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 12, 1)); return { m_start: inp.end_date.slice(0, 8) + '01', window_start: d.toISOString().slice(0, 10) }; },
  render: function (c) {
    var body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var end = c.inputs.end_date, months = XK.monthsEnding(end, 12), keys = months.map(function (m) { return m.key; }), labs = keys.map(function (k) { return XK.monthLabel(k).slice(0, 3); });
    if (c.errors.bs_12) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('bs_12')) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err('bs_12') }] }; }
    if (!c.data.bs_12) return {};
    var bw = XK.walk(c.data.bs_12), mc = XK.monthCols(bw), bal = keys.map(function (k) { var i = mc && mc.idx[k]; return i == null ? null : XK.bsParts(bw, i).bank; });
    var b0 = XK.bsParts(bw, 0), prev = bal[10];
    var fan = c.fan('bank'), flows = fan ? fan.map(function (it, i) { if (it.error || !it.value) return { key: keys[i], error: it.error || 'no data' }; var t = XK.find(XK.walk(it.value).lines, null, /^total$/i, 'total') || { values: [] }; return { key: keys[i], open: t.values[0], rin: t.values[1], rout: t.values[2], close: t.values[3] }; }) : null;
    var fOk = flows && flows.every(function (m) { return !m.error; });
    var today = c.today, base = c.currency, docs = function (id, typ) { return XK.openDocs({ invoices: c.rows(id), types: { invoices: typ } }, base, null); };
    var ag = XK.ageingCols(today, 'due', 4, 'm'), agg = function (list) { var t = ag.cols.map(function () { return 0; }); list.forEach(function (d) { var j = ag.bucket(d); t[j] = r2(t[j] + d.amount); }); return t; };
    var rec = docs('receivables', 'ACCREC'), pay = docs('payables', 'ACCPAY'), ra = agg(rec), pa = agg(pay);
    var dv = bal[11] != null && prev != null && prev ? (bal[11] - prev) / Math.abs(prev) : null;
    body.innerHTML = '<p class="muted">Monthly · 12 months ending ' + XK.monthLabel(keys[11]) + '</p><div class="xk-grid2">' +
      '<div class="xk-card xk-widget"><h3>Cash balance</h3><div class="cur">' + (b0.bank != null ? money(b0.bank) : 'N/A') + '</div><div class="pri">' + XK.asOfLine(end) + '</div>' + (dv != null ? '<span class="chip ' + (dv >= 0 ? 'up' : 'down') + '">' + (dv >= 0 ? '▲ ' : '▼ ') + Math.abs(dv * 100).toFixed(1) + '% vs the previous month end</span>' : '') + '<div id="cp-bal"></div></div>' +
      '<div class="xk-card xk-widget"><h3>Cash in vs cash out</h3>' + (flows == null ? '<p class="muted">' + (c.live ? 'Loading the 12 months…' : 'N/A in a snapshot — open the live report') + '</p>' : fOk ? '<div class="pri">Cash in ' + money(XK.sum(flows.map(function (m) { return m.rin; }))) + ' · Cash out ' + money(-XK.sum(flows.map(function (m) { return m.rout; }))) + '</div><div id="cp-io"></div>' : '<p class="xk-err">Some months could not be loaded: ' + XK.h(flows.filter(function (m) { return m.error; }).map(function (m) { return XK.monthLabel(m.key); }).join(', ')) + '</p>') + '</div>' +
      '<div class="xk-card xk-widget"><h3>Net cash flow</h3>' + (fOk ? '<div class="cur">' + money(r2(XK.sum(flows.map(function (m) { return m.rin - m.rout; })))) + '</div><div class="pri">12 months</div><div id="cp-net"></div>' : '<p class="muted">Needs the monthly Bank Summary.</p>') + '</div>' +
      '<div class="xk-card xk-widget"><h3>Receivables ageing</h3><div class="pri">Invoices awaiting payment, by due date, today</div><div id="cp-rec"></div></div>' +
      '<div class="xk-card xk-widget"><h3>Payables ageing</h3><div class="pri">Bills awaiting payment, by due date, today</div><div id="cp-pay"></div></div></div>';
    XK.line(document.getElementById('cp-bal'), { title: 'Cash balance', labels: labs, area: true, series: [{ name: 'Bank balance at month end', values: bal }] }, c);
    if (fOk) {
      XK.bars(document.getElementById('cp-io'), { title: 'Cash in vs cash out', labels: labs, series: [{ name: 'Cash in', values: flows.map(function (m) { return m.rin; }), color: 'var(--pos)' }, { name: 'Cash out', values: flows.map(function (m) { return -m.rout; }), color: 'var(--neg)' }] }, c);
      XK.bars(document.getElementById('cp-net'), { title: 'Net cash flow', labels: labs, series: [{ name: 'Net cash flow', values: flows.map(function (m) { return r2(m.rin - m.rout); }), colors: flows.map(function (m) { return m.rin - m.rout < 0 ? 'var(--neg)' : 'var(--pos)'; }) }] }, c);
    }
    var dn = function (id, t) { XK.donut(document.getElementById(id), { title: id, items: ag.cols.map(function (col, j) { return { label: col.title, value: t[j] }; }), centre: money(XK.sum(t)) }, c); };
    dn('cp-rec', ra); dn('cp-pay', pa);
    // Checks
    var bt = c.data.bank_total ? (XK.find(XK.walk(c.data.bank_total).lines, null, /^total$/i, 'total') || { values: [] }).values : null;
    var has12 = mc && keys.every(function (k) { return mc.idx[k] != null; });
    var checks = [
      { name: 'Cash balance = Σ bank accounts', pass: b0.bank != null ? XK.near(b0.bank, XK.sum(b0.bankRows.map(function (r) { return r.value; }))) : null, detail: b0.bankRows.length + ' account(s) · ' + money(b0.bank) },
      { name: 'Xero returned 12 month-end balances', pass: !!has12, detail: (mc ? mc.keys.length : 0) + ' month-end columns' },
      { name: 'Ageing doughnut segments sum to the totals (receivables and payables)', pass: XK.near(XK.sum(ra), XK.sum(rec.map(function (d) { return d.amount; }))) && XK.near(XK.sum(pa), XK.sum(pay.map(function (d) { return d.amount; }))), detail: money(XK.sum(ra)) + ' · ' + money(XK.sum(pa)) },
      flows == null ? { name: 'Monthly cash in / out = the Bank Summary for the 12 months', pass: null, detail: c.live ? 'Loading' : 'N/A in a snapshot' }
        : { name: 'Monthly cash in / out = the Bank Summary for the 12 months', pass: fOk && bt ? XK.near(XK.sum(flows.map(function (m) { return m.rin; })), bt[1], 0.05) && XK.near(XK.sum(flows.map(function (m) { return m.rout; })), bt[2], 0.05) : false, detail: bt ? money(bt[1]) + ' in · ' + money(bt[2]) + ' out' : c.err('bank_total') || 'Some months failed' },
      { name: 'Month-end cash (Balance Sheet) = the Bank Summary closing balance', pass: bt && b0.bank != null ? XK.near(b0.bank, bt[3]) : null, detail: bt ? money(b0.bank) + ' vs ' + money(bt[3]) : c.err('bank_total') },
      { name: 'All invoices and bills awaiting payment loaded', pass: (c.errors.receivables || c.errors.payables || c.truncated('receivables') || c.truncated('payables')) ? false : true, detail: rec.length + ' invoice(s), ' + pay.length + ' bill(s)' }
    ];
    this._x = { keys: keys, bal: bal, flows: fOk ? flows : null, ra: ra, pa: pa, cols: ag.cols };
    return { checks: checks, notes: ['Cash in and out is Xero\'s Bank Summary for each month (includes transfers between your accounts).', 'Ageing uses today\'s balances of invoices and bills awaiting payment.'], na: ['Xero Analytics widget columns and filter settings (Xero Analytics is not in the Xero API)'], period: '12 months ending ' + XK.asOfLine(end).replace(/^As at /, '') };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash position', s: 'bold' }], ['12 months ending ' + XK.monthLabel(x.keys[11])], [], [{ v: 'Month', s: 'bold' }, { v: 'Cash balance', s: 'bold' }, { v: 'Cash in', s: 'bold' }, { v: 'Cash out', s: 'bold' }, { v: 'Net cash flow', s: 'bold' }]]
      .concat(x.keys.map(function (k, i) { var f = x.flows && x.flows[i]; return [XK.monthLabel(k), { v: x.bal[i], s: 'money' }, f ? { v: f.rin, s: 'money' } : null, f ? { v: -f.rout, s: 'money' } : null, f ? { v: Math.round((f.rin - f.rout) * 100) / 100, s: 'money' } : null]; }));
    rows.push([], [{ v: 'Ageing', s: 'bold' }, { v: 'Receivables', s: 'bold' }, { v: 'Payables', s: 'bold' }]);
    x.cols.forEach(function (col, j) { rows.push([col.title, { v: x.ra[j], s: 'money' }, { v: x.pa[j], s: 'money' }]); });
    return [{ name: 'Cash position', rows: rows, widths: [22, 16, 16, 16, 16] }];
  }
});

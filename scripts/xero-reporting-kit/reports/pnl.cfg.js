XK.app({
  title: 'Profit and Loss', primary: 'pnl', dated: ['pnl', 'pnl_cash'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', cmpStart: 'compare_from', cmpEnd: 'compare_to', org: 'org', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', basis: 'Accrual', compare_from: '2025-07-01', compare_to: '2025-09-25', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"pl"}' },
  uses: { pnl: ['from_date', 'to_date', 'org'], pnl_cash: ['from_date', 'to_date', 'org'], pnl_compare: ['compare_from', 'compare_to', 'org'], pnl_compare_cash: ['compare_from', 'compare_to', 'org'], bs_end: ['to_date', 'org'], org: ['org'], connections: [] },
  tools: { pnl: 'get_profit_and_loss', pnl_cash: 'get_profit_and_loss (cash basis)', pnl_compare: 'get_profit_and_loss (comparison period)', pnl_compare_cash: 'get_profit_and_loss (comparison period, cash basis)', bs_end: 'get_balance_sheet (Current Year Earnings at the end date)', org: 'get_organisation', connections: 'list_connections' },
  compare: true,
  views: [['pl', 'Profit and Loss'], ['pct', 'P&L as % of income']],
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash';
    var id = cash ? 'pnl_cash' : 'pnl', cid = cash ? 'pnl_compare_cash' : 'pnl_compare';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var cmpOn = c.compareMode !== 'none', w = XK.walk(c.data[id]), wc = cmpOn && c.data[cid] ? XK.walk(c.data[cid]) : null;
    // Comparison figures matched line by line (accounts by AccountID, totals by label); accounts with activity only in the
    // comparison period are added to their section with 0 for this period.
    var key = function (l) { return l.kind + '|' + (l.id || l.label) + '|' + l.group; }, cmap = {}, seen = {};
    if (wc) wc.lines.forEach(function (l) { cmap[key(l)] = l.values[0]; });
    var lines = w.lines.map(function (l) { seen[key(l)] = 1; return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? (cmap[key(l)] != null ? cmap[key(l)] : wc ? 0 : null) : null }); });
    if (wc) wc.lines.forEach(function (l) {
      if (l.kind !== 'row' || seen[key(l)]) return;
      var tot = -1, last = -1; lines.forEach(function (x, i) { if (x.group === l.group) { last = i; if (x.kind === 'total' && tot < 0) tot = i; } });
      if (last >= 0) lines.splice(tot >= 0 ? tot : last + 1, 0, Object.assign({}, l, { values: [0], cmp: l.values[0] }));
    });
    var sec = function (re) { return XK.sectionBy(w, re); }, line = function (re) { var l = XK.find(w.lines, null, re, 'total'); return l ? XK.val(l) : null; };
    var inc = sec(/^(trading )?income$|^revenue$|^sales$/i), cos = sec(/cost of sales/i), oi = sec(/^other income$/i), opex = sec(/operating expenses|^(less )?expenses$/i), oe = sec(/other expenses/i);
    var gp = line(/^gross profit$/i), np = line(/^net (profit|loss)$/i);
    var npCmp = wc ? (function () { var l = XK.find(wc.lines, null, /^net (profit|loss)$/i, 'total'); return l ? XK.val(l) : null; })() : null;
    var extra = cmpOn ? XK.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year to date' }[c.compareMode]) : [];
    if (c.view === 'pct') extra.push({ title: '% of Trading Income', fmt: 'pct', value: function (l) { return inc ? XK.val(l) / inc : null; } });
    var empty = !w.lines.some(function (l) { return l.kind === 'row'; });
    body.innerHTML = XK.kpis([{ label: 'Total Trading Income', value: inc }, { label: 'Gross Profit', value: gp }, { label: 'Total Operating Expenses', value: opex },
      { label: 'Net Profit', value: np, delta: npCmp ? (np - npCmp) / Math.abs(npCmp) : null }, { label: 'Net margin', text: inc ? XK.pct(np / inc) : '—' }], c) +
      (empty ? '<p class="muted">Xero recorded no income or expenses in this period.</p>' : '') +
      '<div class="xk-scroll">' + XK.statement(lines, ['', XK.rangeLabel(c.inputs.from_date, c.inputs.to_date)], c, extra) + '</div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:16px"><div class="xk-card"><h3>Income vs expenses</h3><div id="ch1"></div></div><div class="xk-card"><h3>Trading income to net profit</h3><div id="ch2"></div></div></div>';
    var cmpOf = function (re) { return wc ? XK.sectionBy(wc, re) : null; };
    XK.bars(document.getElementById('ch1'), { title: 'Income vs expenses', labels: ['Trading Income', 'Cost of Sales', 'Operating Expenses', 'Net Profit'], series: [{ name: 'This period', values: [inc, cos, opex, np] }].concat(wc ? [{ name: 'Comparison', values: [cmpOf(/^(trading )?income$|^revenue$|^sales$/i), cmpOf(/cost of sales/i), cmpOf(/operating expenses|^(less )?expenses$/i), npCmp] }] : []) }, c);
    XK.waterfall(document.getElementById('ch2'), { title: 'Trading income to net profit', steps: [{ label: 'Trading Income', value: inc, total: true }, { label: 'Cost of Sales', value: -(cos || 0) }, { label: 'Other Income', value: oi || 0 }, { label: 'Operating Exp.', value: -(opex || 0) }, { label: 'Other Exp.', value: -(oe || 0) }, { label: 'Net Profit', value: np, total: true }] }, c);

    // Checks. Xero sends its own section totals and computed lines, so these re-add them from the account rows; the
    // independent tie matches Net Profit against the Balance Sheet (a separate Xero report) for a financial-year-to-date range.
    var ties = XK.linesTies(w.lines), run = XK.runningTies(w), bad = function (re) { return run.failed.filter(function (f) { return re.test(f); }); };
    var fyStart = XK.fyStartOf(c.inputs.to_date, c.fy.month), ytd = c.inputs.from_date === fyStart, bsErr = c.errors.bs_end;
    var cyeLine = c.data.bs_end ? XK.currentYearEarnings(XK.walk(c.data.bs_end).lines) : null, cye = cyeLine ? XK.val(cyeLine) : null;
    var checks = [
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Gross Profit = Trading Income − Cost of Sales', pass: gp == null ? null : bad(/^Gross Profit/i).length === 0, detail: gp == null ? 'No Gross Profit line in this report' : money(gp) + ' = ' + money(inc) + ' − ' + money(cos || 0) },
      { name: 'Net Profit = Gross Profit + Other Income − Operating Expenses', pass: np == null ? null : bad(/^Net (Profit|Loss)/i).length === 0, detail: np == null ? 'No Net Profit line in this report' : money(np) + (bad(/^Net/i).length ? ' — ' + bad(/^Net/i)[0] : '') },
      ytd && !cash ? { name: 'Net Profit = Current Year Earnings on the Balance Sheet at ' + c.inputs.to_date, pass: bsErr || cye == null ? null : XK.near(np, cye), detail: bsErr ? c.err('bs_end') : cye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(np) + ' vs ' + money(cye) }
        : { name: 'Net Profit vs Balance Sheet Current Year Earnings (information)', pass: null, info: true, detail: cash ? 'The tie is checked on the accrual basis' : 'Ties only for a financial-year-to-date range (from ' + fyStart + ')' }
    ];
    if (cmpOn) checks.push({ name: 'Comparison period loaded', pass: c.errors[cid] ? false : c.data[cid] ? true : null, detail: c.errors[cid] ? c.err(cid) : XK.periodLine(c.inputs.compare_from, c.inputs.compare_to) });
    var notes = [], unknown = w.sections.filter(function (s) { return !/income|revenue|sales|cost of sales|expense/i.test(s.title); });
    if (unknown.length) notes.push('Section(s) outside the standard layout, shown as Xero returned them: ' + unknown.map(function (s) { return s.label; }).join(', ') + '.');
    if (cash) notes.push('Cash basis: Xero\'s Profit and Loss with payments only (paymentsOnly = true).');
    this._lines = lines; this._extra = extra;
    return { checks: checks, notes: notes, na: ['Tracking-category columns (not in this report yet — ask for the P&L by tracking category)'],
      title: c.view === 'pct' ? 'Profit and Loss as % of trading income' : cmpOn ? 'Profit and Loss Comparison' : 'Profit and Loss' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Total'].concat(extra.map(function (e) { return e.title; }));
    return [XK.sheetFromLines('Profit and Loss', c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});

function XK_PERIODS(inp, c) {
  var n = Math.max(1, Math.min(11, +c.opt('np') || 2)), k = { m: 1, q: 3, y: 12 }[c.opt('tf') || 'm'] || 1, a = XK.parse(inp.from_date), b = XK.parse(inp.to_date), out = [];
  var whole = a.getUTCDate() === 1 && XK.iso(b) === XK.iso(XK.eom(b.getUTCFullYear(), b.getUTCMonth() + 1));
  var shift = function (d, m, end) { var y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1 - m; while (mo < 1) { mo += 12; y--; } var last = XK.eom(y, mo).getUTCDate(); return XK.iso(new Date(Date.UTC(y, mo - 1, end ? last : Math.min(d.getUTCDate(), last)))); };
  for (var i = 1; i <= n; i++) out.push({ key: 'p' + i, inputs: { compare_from: shift(a, k * i, false), compare_to: shift(b, k * i, whole) } });
  return out;
}
XK.app({
  title: 'Profit and Loss', primary: 'pnl', dated: ['pnl', 'pnl_cash'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', cmpStart: 'compare_from', cmpEnd: 'compare_to', org: 'org', display: 'display' }, personaDisplay: true,
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', basis: 'Accrual', compare_from: '2025-07-01', compare_to: '2025-09-25', org: '', tracking: '',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"pl","pv":"Bookkeeper"}' },
  uses: { pnl: ['from_date', 'to_date', 'org'], pnl_cash: ['from_date', 'to_date', 'org'], pnl_compare: ['compare_from', 'compare_to', 'org'], pnl_compare_cash: ['compare_from', 'compare_to', 'org'], bs_end: ['to_date', 'org'], pnl_tracking: ['from_date', 'to_date', 'tracking', 'org'], pnl_tracking_cash: ['from_date', 'to_date', 'tracking', 'org'], tracking_cats: ['org'], org: ['org'], connections: [] },
  tools: { pnl: 'get_profit_and_loss', pnl_cash: 'get_profit_and_loss (cash basis)', pnl_compare: 'get_profit_and_loss (comparison period)', pnl_compare_cash: 'get_profit_and_loss (comparison period, cash basis)', bs_end: 'get_balance_sheet (Current Year Earnings at the end date)', pnl_tracking: 'get_profit_and_loss (columns by tracking category)', pnl_tracking_cash: 'get_profit_and_loss (by tracking category, cash basis)', tracking_cats: 'list_tracking_categories', org: 'get_organisation', connections: 'list_connections' },
  compare: true,
  compareModes: [['none', 'None'], ['prev_period', 'Previous period'], ['prev_year', 'Previous year'], ['ytd', 'Year-to-date'], ['periods', 'Several periods']],
  options: [{ id: 'np', label: 'Periods', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['10', '10'], ['11', '11']], def: '2', when: function (d) { return d.c === 'periods'; }, title: 'How many previous periods to compare with' },
    { id: 'tf', label: 'Period of', options: [['m', 'Month'], ['q', 'Quarter'], ['y', 'Year']], def: 'm', when: function (d) { return d.c === 'periods'; } }],
  // the tracking P&L is optional and quiet until a tracking category is chosen
  sources: { pnl_tracking: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis === 'Cash'; } }, pnl_tracking_cash: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis !== 'Cash'; } }, tracking_cats: { name: 'Tracking categories', optional: true } },
  // Several periods: the comparison P&L for each previous month / quarter / year, loaded after the report opens
  fan: { pnl_compare: function (inp, c) { return c.compareMode === 'periods' && inp.basis !== 'Cash' ? XK_PERIODS(inp, c) : []; }, pnl_compare_cash: function (inp, c) { return c.compareMode === 'periods' && inp.basis === 'Cash' ? XK_PERIODS(inp, c) : []; } },
  views: [['pl', 'Profit and Loss'], ['pct', 'P&L as % of income']],
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash';
    var id = cash ? 'pnl_cash' : 'pnl', cid = cash ? 'pnl_compare_cash' : 'pnl_compare';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var multi = c.compareMode === 'periods', fanned = multi ? c.fan(cid) : null, wins = multi ? XK_PERIODS(c.inputs, c) : [];
    var cmpOn = c.compareMode !== 'none', w = XK.walk(c.data[id]), wc = multi ? (fanned && fanned[0] && fanned[0].value ? XK.walk(fanned[0].value) : null) : cmpOn && c.data[cid] ? XK.walk(c.data[cid]) : null;
    var walks = multi && fanned ? fanned.map(function (x) { return x.value ? XK.walk(x.value) : null; }) : [];
    // Comparison figures matched line by line (accounts by AccountID, totals by label); accounts with activity only in the
    // comparison period are added to their section with 0 for this period.
    var key = function (l) { return l.kind + '|' + (l.id || l.label) + '|' + l.group; }, cmap = {}, seen = {};
    if (wc) wc.lines.forEach(function (l) { cmap[key(l)] = l.values[0]; });
    var maps = walks.map(function (wk) { var m = {}; if (wk) wk.lines.forEach(function (l) { m[key(l)] = l.values[0]; }); return m; });
    var lines = w.lines.map(function (l) { seen[key(l)] = 1; return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? (cmap[key(l)] != null ? cmap[key(l)] : wc ? 0 : null) : null, cmps: maps.map(function (m) { return l.kind === 'header' ? null : m[key(l)] != null ? m[key(l)] : 0; }) }); });
    // accounts with activity only in a comparison period join their section with 0 for this period
    (multi ? walks : wc ? [wc] : []).forEach(function (wk, wi) { if (!wk) return; wk.lines.forEach(function (l) {
      if (l.kind !== 'row' || seen[key(l)]) return; seen[key(l)] = 1;
      var tot = -1, last = -1; lines.forEach(function (x, i) { if (x.group === l.group) { last = i; if (x.kind === 'total' && tot < 0) tot = i; } });
      if (last >= 0) lines.splice(tot >= 0 ? tot : last + 1, 0, Object.assign({}, l, { values: [0], cmp: multi ? (maps[0][key(l)] || 0) : l.values[0], cmps: maps.map(function (m) { return m[key(l)] || 0; }) }));
    }); });
    var sec = function (re) { return XK.sectionBy(w, re); }, line = function (re) { var l = XK.find(w.lines, null, re, 'total'); return l ? XK.val(l) : null; };
    var inc = sec(/^(trading )?income$|^revenue$|^sales$/i), cos = sec(/cost of sales/i), oi = sec(/^other income$/i), opex = sec(/operating expenses|^(less )?expenses$/i), oe = sec(/other expenses/i);
    var gp = line(/^gross profit$/i), np = line(/^net (profit|loss)$/i);
    var none = function (v) { return v == null && np != null; }; // Xero leaves out a section with nothing in it
    var incK = none(inc) ? 0 : inc, opexK = none(opex) ? 0 : opex;
    var npCmp = wc ? (function () { var l = XK.find(wc.lines, null, /^net (profit|loss)$/i, 'total'); return l ? XK.val(l) : null; })() : null;
    var extra = multi ? wins.map(function (wn, i) { return { title: XK.rangeLabel(wn.inputs.compare_from, wn.inputs.compare_to), value: function (l) { return l.cmps ? l.cmps[i] : null; } }; })
      : cmpOn ? XK.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year to date' }[c.compareMode]) : [];
    if (c.view === 'pct') extra.push({ title: '% of Trading Income', fmt: 'pct', value: function (l) { return inc ? XK.val(l) / inc : null; } });
    var empty = !w.lines.some(function (l) { return l.kind === 'row'; });
    var cats = (((c.data.tracking_cats || {}).TrackingCategories) || []).filter(function (t) { return t.Status !== 'ARCHIVED' && t.Status !== 'DELETED'; }), tsel = c.inputs.tracking || '', tid = cash ? 'pnl_tracking_cash' : 'pnl_tracking';
    var tcat = cats.filter(function (t) { return t.TrackingCategoryID === tsel; })[0], wt = tsel && c.data[tid] && !c.errors[tid] ? XK.walk(c.data[tid]) : null, tcols = wt ? wt.columns.slice() : [];
    var TRACK = { html: '', checks: [] };
    if (cats.length) {
      TRACK.html = '<div class="xk-card" style="margin-top:16px"><h3>Columns by tracking category</h3><label class="muted no-print">Tracking <select id="pl-track"><option value="">None</option>' + cats.map(function (t) { return '<option value="' + XK.h(t.TrackingCategoryID) + '"' + (t.TrackingCategoryID === tsel ? ' selected' : '') + '>' + XK.h(t.Name) + '</option>'; }).join('') + '</select></label>' +
        (!tsel ? '' : c.errors[tid] ? '<p class="xk-err">' + XK.h(c.err(tid)) + '</p>' : !wt ? '<p class="muted">Loading…</p>' : '<h3 style="margin-top:12px">Profit and Loss by ' + XK.h(tcat ? tcat.Name : 'tracking category') + '</h3><div class="xk-scroll">' + XK.statement(wt.lines, [''].concat(tcols), c) + '</div>') + '</div>';
      if (wt) {
        var n = tcols.length, addsUp = wt.lines.filter(function (l) { return l.kind !== 'header' && (l.values || []).length === n; }).every(function (l) { return XK.near(XK.sum(l.values.slice(0, n - 1)), l.values[n - 1], 0.05); });
        var tnp = XK.find(wt.lines, null, /^net (profit|loss)$/i, 'total'), tnpv = tnp ? tnp.values[n - 1] : null;
        TRACK.checks = [{ name: 'Tracking columns add up to the Total column (every line)', pass: addsUp, detail: n - 1 + ' column(s) + Total' },
          { name: 'Tracking Total Net Profit = this Profit and Loss (separate Xero reports)', pass: tnpv == null || np == null ? null : XK.near(tnpv, np), detail: money(tnpv) + ' vs ' + money(np) }];
      }
    }
    this._track = wt ? { name: tcat ? tcat.Name : 'Tracking', cols: tcols, lines: wt.lines } : null;
    body.innerHTML = XK.kpis([{ label: 'Total Trading Income', value: incK, sub: none(inc) ? 'None in this period' : null }, { label: 'Gross Profit', value: gp }, { label: 'Total Operating Expenses', value: opexK, sub: none(opex) ? 'None in this period' : null },
      { label: 'Net Profit', value: np, delta: npCmp ? (np - npCmp) / Math.abs(npCmp) : null }, { label: 'Net margin', text: inc ? XK.pct(np / inc) : '—' }], c) +
      (empty ? '<p class="muted">Xero recorded no income or expenses in this period.</p>' : '') +
      (multi && !fanned ? '<p class="muted">Loading ' + wins.length + ' comparison period' + (wins.length === 1 ? '' : 's') + ' from Xero…</p>' : '') +
      '<div class="xk-scroll">' + XK.statement(lines, ['', XK.rangeLabel(c.inputs.from_date, c.inputs.to_date)], c, extra) + '</div>' +
      TRACK.html +
      '<div class="xk-grid2 detail-block" style="margin-top:16px"><div class="xk-card"><h3>Income vs expenses</h3><div id="ch1"></div></div><div class="xk-card"><h3>Trading income to net profit</h3><div id="ch2"></div></div></div>';
    var tp = document.getElementById('pl-track'); if (tp) tp.addEventListener('change', function () { c.change({ tracking: this.value }); });
    var cmpOf = function (re) { return wc ? XK.sectionBy(wc, re) : null; };
    XK.bars(document.getElementById('ch1'), { title: 'Income vs expenses', labels: ['Trading Income', 'Cost of Sales', 'Operating Expenses', 'Net Profit'], series: [{ name: 'This period', values: [incK, cos || 0, opexK, np] }].concat(wc ? [{ name: 'Comparison', values: [cmpOf(/^(trading )?income$|^revenue$|^sales$/i), cmpOf(/cost of sales/i), cmpOf(/operating expenses|^(less )?expenses$/i), npCmp] }] : []) }, c);
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
    if (multi) { var bad2 = fanned ? fanned.filter(function (x) { return x.error; }) : []; checks.push({ name: 'Comparison periods loaded', pass: !c.live ? null : fanned ? bad2.length === 0 : null, detail: !c.live ? 'Several periods need the live report' : !fanned ? 'Loading…' : bad2.length ? bad2.length + ' of ' + fanned.length + ' failed: ' + bad2[0].error : fanned.length + ' period(s)' }); }
    else if (cmpOn) checks.push({ name: 'Comparison period loaded', pass: c.errors[cid] ? false : c.data[cid] ? true : null, detail: c.errors[cid] ? c.err(cid) : XK.periodLine(c.inputs.compare_from, c.inputs.compare_to) });
    checks = checks.concat(TRACK.checks);
    var notes = [], unknown = w.sections.filter(function (s) { return !/income|revenue|sales|cost of sales|expense/i.test(s.title); });
    if (unknown.length) notes.push('Section(s) outside the standard layout, shown as Xero returned them: ' + unknown.map(function (s) { return s.label; }).join(', ') + '.');
    if (cash) notes.push('Cash basis: Xero\'s Profit and Loss with payments only (paymentsOnly = true).');
    this._lines = lines; this._extra = extra;
    if (!cats.length && c.data.tracking_cats) notes.push('This organisation has no active tracking categories.');
    return { checks: checks, notes: notes, na: [],
      title: c.view === 'pct' ? 'Profit and Loss as % of trading income' : cmpOn ? 'Profit and Loss Comparison' : 'Profit and Loss' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Total'].concat(extra.map(function (e) { return e.title; }));
    return [XK.sheetFromLines('Profit and Loss', c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))]
      .concat(this._track ? [XK.sheetFromLines('By ' + this._track.name, c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date), [''].concat(this._track.cols), this._track.lines, null)] : []);
  }
});

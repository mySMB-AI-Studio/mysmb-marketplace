QB.app({
  title: 'Balance Sheet', token: 'BAL_SHEET', route: 'reportv2', primary: 'bs', company: 'company_info', prefs: 'prefs',
  inputs: { asAt: 'as_at', basis: 'basis', columnsBy: 'columns_by', cmpAsAt: 'compare_as_at', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', columns_by: 'Total', compare_as_at: '2025-09-25', fy_start: '2026-07-01', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"today","c":"none","v":"bs"}' },
  uses: { bs: ['fy_start', 'as_at', 'basis', 'columns_by'], bs_compare: ['compare_as_at', 'basis'], pnl_ytd: ['fy_start', 'as_at', 'basis'], company_info: [], prefs: [] },
  tools: { bs: 'get_report_balance_sheet', bs_compare: 'get_report_balance_sheet (comparison date)', pnl_ytd: 'get_report_profit_and_loss (financial year to date, for the Net Earnings tie)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years'], ['Classes', 'Classes'], ['Departments', 'Locations']],
  compare: true,
  views: [['bs', 'Balance Sheet'], ['summary', 'Balance Sheet Summary']],
  derive: function (inp, fyMonth) { return { fy_start: QB.fyStartOf(inp.as_at, fyMonth) }; },
  render: function (c) {
    var body = c.body, rep = c.data.bs;
    if (c.errors.bs) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('bs')) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err('bs') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this date', pass: null }] }; }
    var cols = QB.cols(rep), multi = cols.length > 2, cmpOn = c.compareMode !== 'none' && !multi;
    var m = QB.mergeCompare(rep, cmpOn ? c.data.bs_compare : null), lines = m.lines;
    if (c.view === 'summary') lines = lines.filter(function (l) { return l.kind !== 'row' || l.depth <= 1; });
    var P = QB.bsParts(m.lines), A = QB.val(P.A), L = QB.val(P.L), E = QB.val(P.E), LE = QB.val(P.LE), CA = QB.val(P.CA), CL = QB.val(P.CL);
    var niRow = P.ni, niBS = niRow ? (QB.val(niRow) == null ? 0 : QB.val(niRow)) : null, niLabel = niRow ? niRow.label : 'Net Earnings';
    m.lines.forEach(function (l) { if (l === niRow && /^net income$/i.test(l.label)) l.label = 'Net Earnings'; });
    var pl = c.data.pnl_ytd, niPL = !pl ? null : QB.noData(pl) ? 0 : QB.val(QB.find(QB.walk(pl), 'NetIncome', QB.NI_RE)); // no transactions this year = A$0
    var extra = cmpOn ? QB.compareCols(c.compareMode === 'prev_year' ? 'Previous year' : 'Previous month end') : [];
    var titles = [''].concat(cols.slice(1).map(function (x) { return x.title || 'Total'; }));
    var html = QB.kpis([{ label: 'Total for Assets', value: A }, { label: 'Total for Liabilities', value: L }, { label: 'Total for Equity', value: E },
      { label: 'Working capital', value: CA != null && CL != null ? Math.round((CA - CL) * 100) / 100 : null, sub: 'Current assets − current liabilities' },
      { label: 'Current ratio', text: CA != null && CL ? (CA / CL).toFixed(2) : 'N/A — not in source' }], c);
    html += '<div class="qb-scroll">' + QB.statement(lines, titles, c, extra) + '</div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3>Assets vs liabilities + equity</h3><div id="ch1"></div></div>' + (multi ? '<div class="qb-card"><h3>Over time</h3><div id="ch2"></div></div>' : '') + '</div>';
    body.innerHTML = html;
    QB.bars(document.getElementById('ch1'), { title: 'Assets vs liabilities and equity', labels: ['Assets', 'Liabilities', 'Equity', 'Liabilities + Equity'], series: [{ name: 'As of ' + c.inputs.as_at, values: [A, L, E, LE] }] }, c);
    if (multi) {
      var mc = cols.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), idx = mc.map(function (x) { return x.i - 1; });
      var ser = function (l) { return idx.map(function (i) { return l ? l.values[i] : null; }); };
      QB.line(document.getElementById('ch2'), { title: 'Assets and liabilities over time', labels: mc.map(function (x) { return x.title; }), series: [{ name: 'Total Assets', values: ser(P.A) }, { name: 'Total Liabilities', values: ser(P.L) }] }, c);
    }
    var ties = QB.sectionTies(rep), hd = QB.header(rep);
    var checks = [
      { name: 'Total for Assets = Total for Liabilities + Equity', pass: A == null || LE == null ? null : QB.near(A, LE) && (L == null || E == null || QB.near(A, L + E)), detail: QB.money(A, c.currency, c.display) + ' vs ' + QB.money(LE, c.currency, c.display) },
      { name: "Each 'Total for' = Σ its rows", pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Net Earnings = P&L financial year to date', pass: niPL == null ? null : niBS == null ? (niPL === 0 ? true : null) : QB.near(niBS, niPL), detail: c.errors.pnl_ytd ? c.err('pnl_ytd') : niRow == null ? (niPL === 0 ? 'No activity this financial year — A$0 on both' : 'No current-year profit line in equity') : niLabel + ' ' + QB.money(niBS, c.currency, c.display) + ' vs P&L ' + QB.money(niPL, c.currency, c.display) + ' (' + c.inputs.fy_start + ' to ' + c.inputs.as_at + ')' },
      { name: 'QuickBooks returned the requested date', pass: !c.live ? null : hd.EndPeriod === c.inputs.as_at, detail: 'As of ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }
    ];
    if (cmpOn) { var ch = QB.header(c.data.bs_compare); checks.push({ name: 'Comparison deltas recomputed from the comparison date', pass: c.errors.bs_compare ? false : !c.live ? null : ch.EndPeriod === c.inputs.compare_as_at, detail: c.errors.bs_compare ? c.err('bs_compare') : 'As of ' + (ch.EndPeriod || '?') }); }
    this._x = { lines: lines, titles: titles, extra: extra };
    return { checks: checks, na: ['Balance Sheet Detail (transaction level — use the General Ledger family)', 'Statement of Changes in Equity (not exposed by the Accounting API)'],
      notes: (P.L && P.L.derived ? ['Total for Liabilities is the sum of the liabilities sections (QuickBooks shows no liabilities total for this company): Total liabilities and equity − equity.'] : []).concat(m.onlyInCompare.length ? [m.onlyInCompare.length + ' account(s) had a balance only at the comparison date: ' + m.onlyInCompare.join(', ')] : []),
      title: c.view === 'summary' ? 'Balance Sheet Summary' : cmpOn ? 'Balance Sheet Comparison' : 'Balance Sheet', period: QB.asOfLine(c.inputs.as_at) };
  },
  excel: function (c) {
    var x = this._x || { lines: [], titles: [''], extra: [] }, titles = x.titles.concat(x.extra.map(function (e) { return e.title; }));
    return [QB.sheetFromLines('Balance Sheet', c.company, QB.asOfLine(c.inputs.as_at), titles, x.lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.kind === 'total' ? QB.totalFor(l.label) : l.label, values: (l.values || []).slice(0, x.titles.length - 1).concat(x.extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), QB.footerStamp(c.inputs.basis, c.fetchedAt), x.titles.slice(1).map(function () { return 'money'; }).concat(x.extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});

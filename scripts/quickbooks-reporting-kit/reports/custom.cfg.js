QB.app({
  title: 'Sales by Class Summary', token: null, primary: 'custom_report', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', columnsBy: 'columns_by', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', columns_by: 'Total', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","x":""}' },
  uses: { custom_report: ['start_date', 'end_date', 'basis', 'columns_by'], company_info: [], prefs: [] },
  tools: { custom_report: 'get_report_class_sales', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years'], ['Customers', 'Customers'], ['Vendors', 'Suppliers'], ['Classes', 'Classes'], ['Departments', 'Locations'], ['ProductsAndServices', 'Products/Services']],
  render: function (c) {
    var body = c.body, rep = c.data.custom_report, T = this.title;
    if (c.errors.custom_report) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('custom_report')) + '</p>'; return { checks: [{ name: T + ' loaded', pass: false, detail: c.err('custom_report') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this period', pass: null }] }; }
    var cols = QB.cols(rep), lines = QB.walk(rep), sectioned = lines.some(function (l) { return l.kind === 'header'; });
    var moneyCol = cols.map(function (x) { return x.type === 'Money' || /total|amount|balance|income|expense|value|debit|credit|sales/i.test(x.title); });
    var titles = cols.map(function (x, i) { return x.title || (i ? 'Total' : ''); });
    if (sectioned) body.innerHTML = '<div class="qb-scroll">' + QB.statement(lines, titles, c) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>Top lines</h3><div id="ch1"></div></div>';
    else {
      body.innerHTML = '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3>Top lines</h3><div id="ch1"></div></div>';
      var gt = QB.find(lines, 'GrandTotal', /^total$/i), totalRow = null;
      if (gt) { totalRow = { c0: 'TOTAL' }; gt.values.forEach(function (v, i) { totalRow['c' + (i + 1)] = moneyCol[i + 1] ? v : gt.raw[i]; }); }
      QB.grid(document.getElementById('g1'), { filter: true, columns: titles.map(function (t, i) { return { key: 'c' + i, title: t || (i ? '' : 'Name'), money: i > 0 && moneyCol[i] }; }),
        rows: lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { var o = { c0: l.label }; l.raw.forEach(function (x, i) { o['c' + (i + 1)] = moneyCol[i + 1] ? QB.num(x) : x; }); return o; }), total: totalRow }, c);
    }
    var mi = -1; for (var i = cols.length - 1; i > 0; i--) if (moneyCol[i]) { mi = i - 1; break; }
    var top = lines.filter(function (l) { return l.kind === 'row' && mi >= 0 && l.values[mi] != null; }).sort(function (a, b) { return Math.abs(b.values[mi]) - Math.abs(a.values[mi]); }).slice(0, 10);
    QB.bars(document.getElementById('ch1'), { title: 'Top lines', labels: top.map(function (l) { return String(l.label).slice(0, 16); }), series: [{ name: titles[mi + 1] || 'Total', values: top.map(function (l) { return l.values[mi]; }) }] }, c);
    var ties = QB.sectionTies(rep), hd = QB.header(rep), gtl = QB.find(lines, 'GrandTotal', /^total$/i);
    var flatOk = gtl && mi >= 0 ? QB.near(gtl.values[mi], QB.sum(lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return l.values[mi]; })), 0.05) : null;
    this._x = { lines: lines, titles: titles, moneyCol: moneyCol };
    return { checks: [
      { name: sectioned ? "Each 'Total for' = Σ its rows" : 'TOTAL row = Σ rows', pass: sectioned ? (ties.checked ? ties.failed.length === 0 : null) : flatOk, detail: sectioned ? (ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections') : '' },
      { name: 'QuickBooks returned the requested period', pass: !c.live || !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') }],
      notes: ['Built with the custom report builder from the QuickBooks ' + (hd.ReportName || 'report') + ' report.'], title: T };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [QB.sheetFromLines(this.title, c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), x.titles, x.lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values.map(function (v, i) { return x.moneyCol[i + 1] ? v : null; }) }; }), QB.footerStamp(c.inputs.basis, c.fetchedAt))];
  }
});

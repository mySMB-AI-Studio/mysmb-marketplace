QB.app({
  title: 'Statement of Cash Flows', token: 'CASH_FLOW', route: 'reportv2', primary: 'cash_flow', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', columnsBy: 'columns_by', cmpStart: 'compare_start', cmpEnd: 'compare_end', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', columns_by: 'Total', compare_start: '2025-07-01', compare_end: '2026-06-30', persona: 'Executive',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { cash_flow: ['start_date', 'end_date', 'columns_by'], cash_flow_compare: ['compare_start', 'compare_end'], bs_end: ['end_date'], bank_accounts: [], company_info: [], prefs: [] },
  tools: { cash_flow: 'get_report_cash_flow', cash_flow_compare: 'get_report_cash_flow (comparison period)', bs_end: 'get_report_balance_sheet (closing cash when the cash flow has no closing-cash line)', bank_accounts: 'list_account (Bank)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  columnsBy: [['Total', 'Total only'], ['Month', 'Months'], ['Quarter', 'Quarters'], ['Year', 'Years']],
  compare: true,
  render: function (c) {
    var body = c.body, rep = c.data.cash_flow;
    if (c.errors.cash_flow) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('cash_flow')) + '</p>'; return { checks: [{ name: 'Statement of Cash Flows loaded', pass: false, detail: c.err('cash_flow') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this period', pass: null }] }; }
    var cols = QB.cols(rep), multi = cols.length > 2, cmpOn = c.compareMode !== 'none' && !multi;
    var m = QB.mergeCompare(rep, cmpOn ? c.data.cash_flow_compare : null), lines = m.lines;
    var T = function (g, re) { return QB.val(QB.find(lines, g, re)); };
    var op = T('OperatingActivities', /^net cash provided by operating activities$/i), inv = T('InvestingActivities', /^net cash provided by investing activities$/i) || 0, fin = T('FinancingActivities', /^net cash provided by financing activities$/i) || 0;
    var inc = T('CashIncrease', QB.CF_INC_RE), beg = T('BeginningCash', QB.CF_BEG_RE), end = T('EndingCash', QB.CF_END_RE), derived = false;
    if (end == null && beg == null && inc != null) { // AU / IFRS: no opening or closing lines — closing cash = bank accounts on the balance sheet at the end date
      var bc = QB.bankCash(c.data.bs_end, ((c.data.bank_accounts || {}).QueryResponse || {}).Account);
      if (bc != null) { end = bc; beg = Math.round((bc - inc) * 100) / 100; derived = true; }
    }
    var ni = QB.val(QB.find(lines, null, QB.NI_RE, 'row')), adj = T('OperatingAdjustments', /^total adjustments/i) || 0;
    lines.forEach(function (l) { if (l.kind === 'row' && /^net income$/i.test(l.label)) l.label = 'Net Earnings'; });
    var extra = cmpOn ? QB.compareCols({ prev_period: 'Previous period', prev_year: 'Previous year', ytd: 'Year-to-date' }[c.compareMode]) : [];
    var titles = [''].concat(cols.slice(1).map(function (x) { return x.title || 'Total'; }));
    body.innerHTML = QB.kpis([{ label: 'Operating activities', value: op }, { label: 'Investing activities', value: inv }, { label: 'Financing activities', value: fin }, { label: 'Net cash increase', value: inc }, { label: 'Cash at end of period', value: end }], c) +
      '<div class="qb-scroll">' + QB.statement(lines, titles, c, extra) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>Opening cash to closing cash</h3><div id="ch1"></div></div>';
    QB.waterfall(document.getElementById('ch1'), { title: 'Cash waterfall', steps: [{ label: 'Opening cash', value: beg, total: true }, { label: 'Operating', value: op }, { label: 'Investing', value: inv }, { label: 'Financing', value: fin }, { label: 'Closing cash', value: end, total: true }] }, c);
    var ties = QB.sectionTies(rep), hd = QB.header(rep);
    var checks = [
      derived ? { name: 'Opening cash worked back from the balance sheet (information)', pass: null, info: true, detail: "QuickBooks' cash flow report has no opening or closing cash lines; closing cash " + QB.money(end, c.currency, c.display) + ' = bank accounts on the balance sheet at ' + c.inputs.end_date + ', less the net increase' } :
      { name: 'Cash at end = Cash at beginning + Net cash increase', pass: end == null || beg == null || inc == null ? null : QB.near(end, beg + inc), detail: QB.money(end, c.currency, c.display) },
      { name: 'Net cash increase = Operating + Investing + Financing', pass: inc == null || op == null ? null : QB.near(inc, op + inv + fin), detail: QB.money(inc, c.currency, c.display) },
      { name: 'Operating = Net Earnings + Σ adjustments', pass: op == null || ni == null ? null : QB.near(op, ni + adj), detail: QB.money(ni, c.currency, c.display) + ' + ' + QB.money(adj, c.currency, c.display) },
      { name: "Each 'Total for' = Σ its rows", pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'QuickBooks returned the requested period', pass: !c.live ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') }
    ];
    if (cmpOn) checks.push({ name: 'Comparison deltas recomputed from the comparison period', pass: c.errors.cash_flow_compare ? false : !c.live ? null : QB.header(c.data.cash_flow_compare).StartPeriod === c.inputs.compare_start, detail: c.errors.cash_flow_compare ? c.err('cash_flow_compare') : c.inputs.compare_start + ' to ' + c.inputs.compare_end });
    this._x = { lines: lines, titles: titles, extra: extra };
    return { checks: checks, notes: ['Cash flows are presented by QuickBooks on its own method; no accounting-method control is offered because the report does not take one.'], title: cmpOn ? 'Statement of Cash Flows Comparison' : 'Statement of Cash Flows' };
  },
  excel: function (c) {
    var x = this._x || { lines: [], titles: [''], extra: [] }, titles = x.titles.concat(x.extra.map(function (e) { return e.title; }));
    return [QB.sheetFromLines('Statement of Cash Flows', c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), titles, x.lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.kind === 'total' ? QB.totalFor(l.label) : l.label, values: (l.values || []).slice(0, x.titles.length - 1).concat(x.extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), QB.footerStamp(QB.header(c.data.cash_flow).ReportBasis || 'Accrual', c.fetchedAt), x.titles.slice(1).map(function () { return 'money'; }).concat(x.extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});

QB.app({
  title: 'Trial Balance', token: 'TRIAL_BAL', route: 'report/builder', primary: 'trial_balance', company: 'company_info', prefs: 'prefs',
  inputs: { asAt: 'as_at', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', fy_start: '2026-07-01', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { trial_balance: ['fy_start', 'as_at', 'basis'], company_info: [], prefs: [] },
  tools: { trial_balance: 'get_report_trial_balance', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  derive: function (inp, fyMonth) { return { fy_start: QB.fyStartOf(inp.as_at, fyMonth) }; },
  render: function (c) {
    var body = c.body, rep = c.data.trial_balance;
    if (c.errors.trial_balance) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('trial_balance')) + '</p>'; return { checks: [{ name: 'Trial Balance loaded', pass: false, detail: c.err('trial_balance') }] }; }
    if (!rep) return {};
    if (QB.noData(rep)) { body.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return { checks: [{ name: 'QuickBooks returned data for this date', pass: null }] }; }
    var lines = QB.walk(rep), rows = lines.filter(function (l) { return l.kind === 'row'; }), tot = QB.find(lines, 'GrandTotal', /^total$/i);
    var dr = QB.sum(rows.map(function (l) { return l.values[0]; })), cr = QB.sum(rows.map(function (l) { return l.values[1]; }));
    var tDr = tot ? tot.values[0] : null, tCr = tot ? tot.values[1] : null;
    body.innerHTML = QB.kpis([{ label: 'Total debits', value: tDr }, { label: 'Total credits', value: tCr }, { label: 'Difference', value: tDr != null && tCr != null ? Math.round((tDr - tCr) * 100) / 100 : null, sub: '0.00 = balanced' }, { label: 'Accounts', money: false, value: rows.length }], c) +
      '<div class="qb-scroll">' + QB.statement(lines.map(function (l) { return l.kind === 'total' ? Object.assign({}, l, { label: 'TOTAL' }) : l; }), ['', 'Debit', 'Credit'], c) + '</div>';
    var hd = QB.header(rep);
    this._x = { lines: lines };
    return { checks: [
      { name: 'Σ debits = Σ credits', pass: tDr == null || tCr == null ? null : QB.near(tDr, tCr), detail: QB.money(tDr, c.currency, c.display) + ' / ' + QB.money(tCr, c.currency, c.display) },
      { name: 'TOTAL row = Σ account rows (debit and credit)', pass: tDr == null ? null : QB.near(tDr, dr) && QB.near(tCr, cr), detail: QB.money(dr, c.currency, c.display) + ' / ' + QB.money(cr, c.currency, c.display) },
      { name: 'QuickBooks returned the requested date', pass: !c.live ? null : hd.EndPeriod === c.inputs.as_at, detail: 'As of ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') + ' basis' }],
      na: ['Adjusted Trial Balance (adjusting-entry columns are not exposed by the Accounting API)', 'Custom Summary Report (use Profit and Loss or Balance Sheet with Display columns by)'], period: QB.asOfLine(c.inputs.as_at) };
  },
  excel: function (c) {
    var lines = (this._x || { lines: [] }).lines, n = lines.filter(function (l) { return l.kind === 'row'; }).length;
    var sh = QB.sheetFromLines('Trial Balance', c.company, QB.asOfLine(c.inputs.as_at), ['', 'Debit', 'Credit'], lines.filter(function (l) { return l.kind === 'row'; }), null);
    sh.rows.push([{ v: 'TOTAL', s: 'bold' }, { f: 'SUM(B6:B' + (5 + n) + ')', s: 'moneyBold' }, { f: 'SUM(C6:C' + (5 + n) + ')', s: 'moneyBold' }]);
    sh.rows.push([], [{ v: QB.footerStamp(c.inputs.basis, c.fetchedAt), s: 'muted' }]);
    return [sh];
  }
});

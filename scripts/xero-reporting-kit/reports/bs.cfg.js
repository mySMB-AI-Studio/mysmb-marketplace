XK.app({
  title: 'Balance Sheet', primary: 'bs', dated: ['bs', 'bs_cash', 'pnl_ytd'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', basis: 'basis', cmpAsAt: 'compare_as_at', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-30', basis: 'Accrual', compare_as_at: '2025-09-30', fy_start: '2026-07-01', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"end_this_month","c":"none","v":"bs"}' },
  uses: { bs: ['as_at', 'org'], bs_cash: ['as_at', 'org'], bs_compare: ['compare_as_at', 'org'], bs_compare_cash: ['compare_as_at', 'org'], pnl_ytd: ['fy_start', 'as_at', 'org'], org: ['org'], connections: [] },
  tools: { bs: 'get_balance_sheet', bs_cash: 'get_balance_sheet (cash basis)', bs_compare: 'get_balance_sheet (comparison date)', bs_compare_cash: 'get_balance_sheet (comparison date, cash basis)', pnl_ytd: 'get_profit_and_loss (financial year to date, for the Current Year Earnings tie)', org: 'get_organisation', connections: 'list_connections' },
  compare: true,
  views: [['bs', 'Balance Sheet'], ['summary', 'Summary (totals only)']],
  asats: [['end_this_month', 'End of this month'], ['end_last_month', 'End of last month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom (its month end)']],
  derive: function (inp, fyMonth) { var p = inp.as_at.split('-'), e = XK.iso(XK.eom(+p[0], +p[1])); return { as_at: e, fy_start: XK.fyStartOf(e, fyMonth) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash';
    var id = cash ? 'bs_cash' : 'bs', cid = cash ? 'bs_compare_cash' : 'bs_compare';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Balance Sheet loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var cmpOn = c.compareMode !== 'none', w = XK.walk(c.data[id]), wc = cmpOn && c.data[cid] ? XK.walk(c.data[cid]) : null;
    var key = function (l) { return l.kind + '|' + (l.id || l.label) + '|' + l.group; }, cmap = {}, seen = {};
    if (wc) wc.lines.forEach(function (l) { cmap[key(l)] = l.values[0]; });
    var lines = w.lines.map(function (l) { seen[key(l)] = 1; return Object.assign({}, l, { values: l.values.slice(0, 1), cmp: cmpOn && l.kind !== 'header' ? (cmap[key(l)] != null ? cmap[key(l)] : wc ? 0 : null) : null }); });
    if (wc) wc.lines.forEach(function (l) {
      if (l.kind !== 'row' || seen[key(l)]) return;
      var tot = -1, last = -1; lines.forEach(function (x, i) { if (x.group === l.group) { last = i; if (x.kind === 'total' && tot < 0) tot = i; } });
      if (last >= 0) lines.splice(tot >= 0 ? tot : last + 1, 0, Object.assign({}, l, { values: [0], cmp: l.values[0] }));
    });
    var all = lines;
    if (c.view === 'summary') lines = lines.filter(function (l) { return l.kind !== 'row'; });
    var tv = function (group, re) { var l = XK.find(w.lines, group, re, 'total'); return l ? XK.val(l) : null; };
    var A = tv('Assets', /^total assets$/i), L = tv('Liabilities', /^total liabilities$/i), E = tv('Equity', /^total equity$/i), NA = tv(null, /^net assets$/i);
    var bankSec = w.sections.filter(function (s) { return /^bank$/i.test(s.title); })[0];
    var extra = cmpOn ? XK.compareCols(c.compareMode === 'prev_year' ? 'Previous year' : 'Previous month end') : [];
    body.innerHTML = XK.kpis([{ label: 'Total Assets', value: A }, { label: 'Total Liabilities', value: L }, { label: 'Net Assets', value: NA }, { label: 'Total Equity', value: E }], c) +
      '<div class="xk-scroll">' + XK.statement(lines, ['', w.columns[0] || XK.asOfLine(c.inputs.as_at).replace(/^As at /, '')], c, extra) + '</div>' +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Assets vs liabilities + equity</h3><div id="ch1"></div></div>';
    var LE = L != null && E != null ? Math.round((L + E) * 100) / 100 : null;
    XK.bars(document.getElementById('ch1'), { title: 'Assets vs liabilities + equity', labels: ['Assets', 'Liabilities', 'Equity', 'Liabilities + Equity'], series: [{ name: XK.asOfLine(c.inputs.as_at), values: [A, L, E, LE] }] }, c);

    // Checks. Xero sends its own totals; these re-add them from the rows. The independent tie matches Current Year Earnings
    // against the Profit and Loss from the financial-year start (a separate Xero report).
    var ties = XK.linesTies(w.lines), par = XK.parentTies(w), plErr = c.errors.pnl_ytd;
    var pl = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null, npl = pl ? XK.find(pl.lines, null, /^net (profit|loss)$/i, 'total') : null, np = npl ? XK.val(npl) : null;
    var cyeLine = XK.currentYearEarnings(w.lines), cye = cyeLine ? XK.val(cyeLine) : null;
    var bankSum = bankSec ? XK.sum(bankSec.rows.map(function (l) { return l.values[0]; })) : null, bankTot = bankSec ? XK.sectionTotal(bankSec) : null;
    var checks = [
      { name: 'Total Assets = Total Liabilities + Total Equity', pass: A == null || LE == null ? null : XK.near(A, LE), detail: A == null || LE == null ? 'Xero returned no Total Assets / Total Liabilities / Total Equity line' : money(A) + ' = ' + money(L) + ' + ' + money(E) + (XK.near(A, LE) ? ' (difference ' + money(0) + ')' : ' — difference ' + money(Math.round((A - LE) * 100) / 100)) },
      { name: 'Net Assets = Total Assets − Total Liabilities = Total Equity', pass: NA == null || A == null || L == null || E == null ? null : XK.near(NA, A - L) && XK.near(NA, E), detail: NA == null ? 'No Net Assets line' : money(NA) },
      { name: 'Total Bank = Σ bank account rows', pass: bankSec && bankSec.summary ? XK.near(bankTot, bankSum) : null, detail: bankSec ? money(bankTot) + ' — ' + bankSec.rows.length + ' account' + (bankSec.rows.length === 1 ? '' : 's') : 'No Bank section' },
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections' },
      { name: 'Total Assets and Total Liabilities = Σ their sections', pass: par.checked ? par.failed.length === 0 : null, detail: par.failed.length ? par.failed.join('; ') : par.checked + ' groups' },
      !cash ? { name: 'Current Year Earnings = P&L Net Profit ' + c.inputs.fy_start + ' to ' + c.inputs.as_at, pass: plErr || np == null || cye == null ? null : XK.near(cye, np), detail: plErr ? c.err('pnl_ytd') : cye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(cye) + ' vs ' + money(np) }
        : { name: 'Current Year Earnings vs P&L Net Profit (information)', pass: null, info: true, detail: 'The tie is checked on the accrual basis' }
    ];
    if (cmpOn) checks.push({ name: 'Comparison date loaded', pass: c.errors[cid] ? false : c.data[cid] ? true : null, detail: c.errors[cid] ? c.err(cid) : c.inputs.compare_as_at });
    var notes = ['Xero\'s Balance Sheet is only available at month ends (its API answers any date with that month\'s end), so a date you pick is moved to its month end. For balances on a day within the month, use the Trial Balance.'];
    if (cash) notes.push('Cash basis: Xero\'s Balance Sheet with payments only (paymentsOnly = true) — receivables and payables are excluded.');
    var od = bankSec ? bankSec.rows.filter(function (l) { return l.values[0] < 0; }) : [];
    if (od.length) notes.push('Overdrawn bank account(s): ' + od.map(function (l) { return l.label + ' ' + money(l.values[0]); }).join(', ') + '.');
    this._lines = c.view === 'summary' ? lines : all; this._extra = extra;
    return { checks: checks, notes: notes, na: [],
      title: cmpOn ? 'Balance Sheet Comparison' : c.view === 'summary' ? 'Balance Sheet Summary' : 'Balance Sheet' };
  },
  excel: function (c) {
    var lines = this._lines || [], extra = this._extra || [], titles = ['', 'Balance'].concat(extra.map(function (e) { return e.title; }));
    return [XK.sheetFromLines('Balance Sheet', c.company, XK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) {
      return { kind: l.kind, depth: l.depth, label: l.label, values: (l.values || []).concat(extra.map(function (e) { return l.kind === 'header' ? null : e.value(l); })) };
    }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), ['money'].concat(extra.map(function (e) { return e.fmt === 'pct' ? 'pct' : 'money'; })))];
  }
});

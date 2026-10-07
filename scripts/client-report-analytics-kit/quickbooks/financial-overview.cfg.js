// CRA-01 Financial Overview — QuickBooks Online. One QuickBooks company per connection (the realm is fixed at OAuth time), so the
// client is the connected company: the header names it from CompanyInfo and another client needs its own connection.
QB.app({
  title: 'QuickBooks · Financial Overview', token: null, primary: 'pnl', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', compare_start: '2025-08-01', compare_end: '2025-08-31', trend_start: '2025-09-01', basis: 'Accrual', persona: 'Practitioner',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_month","a":"custom","c":"prev_year","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['last_fy', 'Last financial year'], ['last_12m', 'Last 12 months'], ['custom', 'Custom']],
  uses: { pnl: ['start_date', 'end_date', 'basis'], pnl_prev_year: ['compare_start', 'compare_end', 'basis'], pnl_trend: ['trend_start', 'end_date', 'basis'], bs_end: ['end_date', 'basis'],
    bs_today: [], bank_accounts: [], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { pnl: 'get_report_profit_and_loss (period, Total)', pnl_prev_year: 'get_report_profit_and_loss (same dates last year)', pnl_trend: 'get_report_profit_and_loss (summarize_column_by Month)',
    bs_end: 'get_report_balance_sheet (period end: bank balances)', bs_today: 'get_report_balance_sheet (today, accrual: receivables / payables control)', bank_accounts: 'list_account (AccountType = Bank)',
    aged_receivables: 'get_report_aged_receivables (as of today)', aged_payables: 'get_report_aged_payables (as of today)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection — another client needs its own QuickBooks connection)',
  // Last year = the same dates one year earlier; the trend covers the period's months, or the latest 12 months for a one-month period.
  derive: function (inp) {
    var s = QB.parse(inp.start_date), e = QB.parse(inp.end_date), cmp = QB.compare(inp.start_date, inp.end_date, 'prev_year');
    var span = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
    var first = function (back) { return QB.iso(new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() - back, 1))); };
    var ts = span >= 2 ? (span > 24 ? first(23) : inp.start_date) : first(11);
    return { compare_start: cmp.start, compare_end: cmp.end, trend_start: ts };
  },
  render: function (c) {
    var body = c.body, money = function (v) { return v == null ? 'N/A — not in source' : QB.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var basisLine = c.inputs.basis + ' basis · ' + c.currency, per = QB.periodLine(c.inputs.start_date, c.inputs.end_date);
    if (c.errors.pnl) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl')) + '</p>'; this._x = null; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }], period: per + ' · ' + basisLine }; }
    if (!c.data.pnl) return {};
    // ---- P&L figures, read from the P&L's own lines (QuickBooks leaves out an empty section: it counts as nil)
    function figs(rep, col) {
      if (!rep) return null; var ls = QB.walk(rep), at = function (g, re) { var l = QB.find(ls, g, re); return l ? (col == null ? QB.val(l) : l.values[col]) : null; };
      var f = { rev: at('Income', /^total (income|revenue|trading income)$/i), cogs: at('COGS', /^total (cost of (sales|goods sold))$/i), gp: at('GrossProfit', /^gross profit$/i), exp: at('Expenses', /^total expenses$/i),
        oi: at('OtherIncome', /^total other income$/i), oe: at('OtherExpenses', /^total other expenses?$/i), np: at('NetIncome', QB.NI_RE) };
      f.has = {}; Object.keys(f).forEach(function (k) { if (k !== 'has') f.has[k] = f[k] != null; });
      ['rev', 'cogs', 'exp', 'oi', 'oe'].forEach(function (k) { if (f[k] == null) f[k] = 0; });
      if (f.gp == null && !f.has.rev && !f.has.cogs) f.gp = 0;
      return f;
    }
    var cur = figs(c.data.pnl), ly = c.errors.pnl_prev_year ? null : figs(c.data.pnl_prev_year);
    var margin = function (a, b) { return a == null || !b ? null : a / b; }, chg = function (a, b) { return a == null || b == null || !b ? null : (a - b) / Math.abs(b); };
    var K = [['Revenue', 'rev'], ['Gross profit', 'gp'], ['Net profit', 'np']], kp = [];
    K.forEach(function (k) { kp.push({ label: k[0], value: cur[k[1]], delta: ly ? chg(cur[k[1]], ly[k[1]]) : null, sub: 'Last year ' + (ly ? money(ly[k[1]]) : 'N/A — ' + (c.err('pnl_prev_year') || 'not loaded')) }); });
    kp.splice(2, 0, { label: 'GP %', money: false, value: margin(cur.gp, cur.rev) == null ? 'N/A — no revenue' : QB.pct(margin(cur.gp, cur.rev)), sub: 'Last year ' + (ly && margin(ly.gp, ly.rev) != null ? QB.pct(margin(ly.gp, ly.rev)) : 'N/A') });
    kp.push({ label: 'NP %', money: false, value: margin(cur.np, cur.rev) == null ? 'N/A — no revenue' : QB.pct(margin(cur.np, cur.rev)), sub: 'Last year ' + (ly && margin(ly.np, ly.rev) != null ? QB.pct(margin(ly.np, ly.rev)) : 'N/A') });
    // ---- trend: monthly columns of the Month P&L
    var tr = c.data.pnl_trend, tcols = tr ? QB.cols(tr).filter(function (x) { return x.i > 0 && x.key !== 'total' && !/^total$/i.test(x.title); }) : [];
    var trend = tcols.map(function (x) { var f = figs(tr, x.i - 1); return { label: x.title, start: x.start, end: x.end, rev: f.rev, np: f.np }; });
    // ---- bank balances at period end: Balance Sheet rows for the bank accounts (by account Id)
    var bankIds = {}; (((c.data.bank_accounts || {}).QueryResponse || {}).Account || []).forEach(function (a) { bankIds[String(a.Id)] = a; });
    var bsl = c.data.bs_end ? QB.walk(c.data.bs_end) : [], banks = bsl.filter(function (l) { return l.kind === 'row' && l.id && bankIds[String(l.id)]; }).map(function (l) { return { name: l.label, bal: QB.val(l) }; });
    var bankTot = banks.length ? QB.sum(banks.map(function (b) { return b.bal; })) : null, bankSec = QB.find(bsl, 'BankAccounts', /^total (cash and cash equivalents|bank accounts?|bank)$/i, 'total');
    // ---- ageing (as of today: the connector has no report-date parameter)
    function aged(id) { var rep = c.data[id]; if (!rep) return null; var cl = QB.cols(rep), bands = cl.slice(1, cl.length - 1).map(function (x) { return x.title; }), ls = QB.walk(rep), gt = QB.find(ls, 'GrandTotal', /^total$/i);
      var rows = ls.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return { name: l.label, total: l.values[l.values.length - 1], b: l.values.slice(0, bands.length) }; });
      return { bands: bands, rows: rows, total: gt ? gt.values : null, gt: gt ? gt.values[gt.values.length - 1] : null }; }
    var ar = aged('aged_receivables'), ap = aged('aged_payables'), bst = c.data.bs_today ? QB.walk(c.data.bs_today) : [];
    var ctl = function (g, re, rowRe) { var t = QB.find(bst, g, re, 'total'); if (t) return QB.val(t); var rs = bst.filter(function (l) { return l.kind === 'row' && rowRe.test(l.label); }); return rs.length ? QB.sum(rs.map(function (l) { return QB.val(l); })) : null; };
    var arCtl = ctl('AR', /^total accounts receivable/i, /^accounts receivable/i), apCtl = ctl('AP', /^total accounts payable/i, /^accounts payable/i);
    // ---- page
    var ageCard = function (id, a, who, el) { return '<div class="qb-card"><h3>' + who + ' <span class="muted">· as of today</span></h3><div id="' + el + '"></div></div>'; };
    body.innerHTML = QB.kpis(kp, c) +
      '<div class="qb-card"><h3>Revenue and net profit by month <span class="muted">· ' + QB.h(trend.length ? trend[0].label + ' – ' + trend[trend.length - 1].label : '') + '</span></h3><div id="cra-trend"></div></div>' +
      '<div class="qb-card"><h3>Bank balances <span class="muted">· ' + QB.h(QB.asOfLine(c.inputs.end_date)) + '</span></h3><div id="cra-bank"></div></div>' +
      '<div class="qb-grid2">' + ageCard('aged_receivables', ar, 'Receivables ageing', 'cra-ar') + ageCard('aged_payables', ap, 'Payables ageing', 'cra-ap') + '</div>' +
      '<div class="qb-grid2 detail-block"><div class="qb-card"><h3>Top 5 customers owing</h3><div id="cra-ar5"></div></div><div class="qb-card"><h3>Top 5 suppliers owed</h3><div id="cra-ap5"></div></div></div>';
    var $ = function (id) { return document.getElementById(id); };
    if (c.errors.pnl_trend) $('cra-trend').innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl_trend')) + '</p>';
    else if (!trend.length) $('cra-trend').innerHTML = '<p class="muted">N/A — not in source: QuickBooks returned no monthly columns, so no trend is drawn.</p>';
    else QB.line($('cra-trend'), { title: 'Revenue and net profit by month', labels: trend.map(function (t) { return t.label; }), series: [{ name: 'Revenue', values: trend.map(function (t) { return t.rev; }) }, { name: 'Net profit', values: trend.map(function (t) { return t.np; }) }] }, c);
    if (c.errors.bs_end || c.errors.bank_accounts) $('cra-bank').innerHTML = '<p class="qb-err">' + QB.h(c.err('bs_end') || c.err('bank_accounts')) + '</p>';
    else QB.grid($('cra-bank'), { columns: [{ key: 'name', title: 'Bank account' }, { key: 'bal', title: 'Balance', money: true }], rows: banks, total: banks.length ? { name: 'Total bank', bal: bankTot } : null, empty: 'No bank accounts on the balance sheet at this date.' }, c);
    [['cra-ar', 'cra-ar5', ar, 'aged_receivables', 'Customer'], ['cra-ap', 'cra-ap5', ap, 'aged_payables', 'Supplier']].forEach(function (x) {
      if (c.errors[x[3]]) { $(x[0]).innerHTML = $(x[1]).innerHTML = '<p class="qb-err">' + QB.h(c.err(x[3])) + '</p>'; return; }
      var a = x[2]; if (!a) return;
      QB.grid($(x[0]), { columns: [{ key: 'band', title: 'Bucket' }, { key: 'v', title: 'Amount', money: true }], rows: a.bands.map(function (b, i) { return { band: b, v: a.total ? a.total[i] : null }; }), total: { band: 'Total', v: a.gt } }, c);
      QB.grid($(x[1]), { columns: [{ key: 'name', title: x[4] }, { key: 'total', title: 'Total', money: true }], rows: a.rows.slice().sort(function (p, q) { return (q.total || 0) - (p.total || 0); }).slice(0, 5), empty: 'Nothing owing.' }, c);
    });
    // ---- checks (recomputed on every hydration)
    var hd = QB.header(c.data.pnl), hly = QB.header(c.data.pnl_prev_year), checks = [];
    checks.push({ name: 'QuickBooks returned the requested period and basis (P&L)', pass: !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date && (!hd.ReportBasis || hd.ReportBasis === c.inputs.basis), detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || '?') });
    checks.push({ name: 'Gross profit = Revenue − Cost of sales (P&L rows)', pass: cur.gp == null ? null : QB.near(cur.gp, r2(cur.rev - cur.cogs)), detail: money(cur.rev) + ' − ' + money(cur.cogs) + ' = ' + money(cur.gp) });
    checks.push({ name: 'Net profit = Gross profit − Expenses + Other income − Other expenses (P&L rows)', pass: cur.np == null || cur.gp == null ? null : QB.near(cur.np, r2(cur.gp - cur.exp + cur.oi - cur.oe)), detail: 'Net profit ' + money(cur.np) });
    var st = QB.sectionTies(c.data.pnl);
    checks.push({ name: 'Every P&L section total = Σ its accounts', pass: st.checked ? !st.failed.length : null, detail: st.failed.length ? 'Mismatch: ' + st.failed.join(', ') : st.checked + ' sections' });
    checks.push({ name: 'Last-year figures come from a P&L for exactly the comparison dates', pass: c.errors.pnl_prev_year ? false : !hly.StartPeriod ? null : hly.StartPeriod === c.inputs.compare_start && hly.EndPeriod === c.inputs.compare_end, detail: c.errors.pnl_prev_year ? c.err('pnl_prev_year') : c.inputs.compare_start + ' to ' + c.inputs.compare_end });
    var inPer = trend.filter(function (t) { return t.start >= c.inputs.start_date && t.end <= c.inputs.end_date; }), covered = inPer.length && inPer[0].start === c.inputs.start_date && inPer[inPer.length - 1].end === c.inputs.end_date;
    var trRev = covered ? QB.sum(inPer.map(function (t) { return t.rev; })) : null, trNp = covered ? QB.sum(inPer.map(function (t) { return t.np; })) : null;
    checks.push({ name: 'Trend months in the period sum to the period P&L (revenue and net profit)', pass: c.errors.pnl_trend ? false : !covered ? null : QB.near(trRev, cur.rev) && QB.near(trNp, cur.np), detail: c.errors.pnl_trend ? c.err('pnl_trend') : covered ? 'Σ revenue ' + money(trRev) + ', Σ net profit ' + money(trNp) : 'N/A — the period does not start and end on whole months' });
    checks.push({ name: 'Bank total = the balance sheet\'s bank section at period end', pass: bankTot == null || !bankSec ? null : QB.near(bankTot, QB.val(bankSec)), detail: bankTot == null ? 'N/A — no bank account rows on the balance sheet' : !bankSec ? 'N/A — the balance sheet has no bank section total' : money(bankTot) + ' vs ' + bankSec.label + ' ' + money(QB.val(bankSec)) });
    [['Receivables', ar, arCtl, 'aged_receivables'], ['Payables', ap, apCtl, 'aged_payables']].forEach(function (x) {
      var a = x[1];
      checks.push({ name: x[0] + ' ageing total = Σ contacts', pass: c.errors[x[3]] ? false : !a || a.gt == null ? null : QB.near(a.gt, QB.sum(a.rows.map(function (r) { return r.total; }))), detail: a ? money(a.gt) : c.err(x[3]) || '' });
      checks.push({ name: x[0] + ' ageing total = balance sheet ' + x[0].toLowerCase() + ' control (today, accrual)', pass: !a || a.gt == null || x[2] == null ? null : QB.near(a.gt, x[2]), detail: x[2] == null ? 'N/A — no ' + x[0].toLowerCase() + ' control on the balance sheet' : money(a && a.gt) + ' vs ' + money(x[2]) });
    });
    this._x = { cur: cur, ly: ly, trend: trend, banks: banks, bankTot: bankTot, ar: ar, ap: ap, per: per, basisLine: basisLine };
    var na = []; if (!trend.length && !c.errors.pnl_trend) na.push('Monthly trend (QuickBooks returned no monthly columns)');
    if (cur.rev === 0) na.push('GP % and NP % (no revenue in the period)');
    return { checks: checks, period: per + ' · ' + basisLine, na: na,
      notes: ['Client: the connected QuickBooks company (CompanyInfo). QuickBooks connects one company per connection; to report on another client, connect that company (Settings → Connections) and open the report there.',
        'Last year = ' + QB.periodLine(c.inputs.compare_start, c.inputs.compare_end) + ', same basis. Trend = Profit and Loss by month from ' + c.inputs.trend_start + ' to ' + c.inputs.end_date + '.',
        'Ageing is as of today: the QuickBooks connector\'s ageing tools take no report date, so ageing ties to today\'s accrual balance sheet, not the period end.',
        'Absent P&L sections (QuickBooks leaves out an empty section) count as nil.'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Financial Overview — ' + name, s: 'bold' }], [x.per], [x.basisLine], []]; };
    var mv = function (v, b) { return v == null ? 'N/A — not in source' : { v: v, s: b ? 'moneyBold' : 'money' }; };
    var sheets = [{ name: 'KPIs', widths: [24, 18, 18, 14], rows: head('KPIs').concat([[{ v: 'Metric', s: 'bold' }, { v: 'This period', s: 'bold' }, { v: 'Last year', s: 'bold' }, { v: 'Change %', s: 'bold' }]],
      [['Revenue', 'rev'], ['Cost of sales', 'cogs'], ['Gross profit', 'gp'], ['Expenses', 'exp'], ['Other income', 'oi'], ['Other expenses', 'oe'], ['Net profit', 'np']].map(function (k) { var a = x.cur[k[1]], b = x.ly ? x.ly[k[1]] : null; return [k[0], mv(a), mv(b), a != null && b ? { v: (a - b) / Math.abs(b), s: 'pct' } : null]; }),
      [['GP %', x.cur.rev ? { v: x.cur.gp / x.cur.rev, s: 'pct' } : 'N/A', x.ly && x.ly.rev ? { v: x.ly.gp / x.ly.rev, s: 'pct' } : 'N/A'], ['NP %', x.cur.rev ? { v: x.cur.np / x.cur.rev, s: 'pct' } : 'N/A', x.ly && x.ly.rev ? { v: x.ly.np / x.ly.rev, s: 'pct' } : 'N/A']]) }];
    sheets.push({ name: 'Trend', widths: [16, 18, 18], rows: head('Trend').concat([[{ v: 'Month', s: 'bold' }, { v: 'Revenue', s: 'bold' }, { v: 'Net profit', s: 'bold' }]], x.trend.map(function (t) { return [t.label, mv(t.rev), mv(t.np)]; })) });
    sheets.push({ name: 'Bank balances', widths: [36, 18], rows: head('Bank balances').concat([[{ v: 'Bank account', s: 'bold' }, { v: 'Balance', s: 'bold' }]], x.banks.map(function (b) { return [b.name, mv(b.bal)]; }), [[{ v: 'Total', s: 'bold' }, mv(x.bankTot, true)]]) });
    [['Receivables ageing', x.ar, 'Customer'], ['Payables ageing', x.ap, 'Supplier']].forEach(function (s) {
      var a = s[1]; if (!a) return;
      sheets.push({ name: s[0], widths: [36].concat(a.bands.map(function () { return 14; }), [16]), rows: head(s[0] + ' (as of today)').concat([[{ v: s[2], s: 'bold' }].concat(a.bands.map(function (b) { return { v: b, s: 'bold' }; }), [{ v: 'Total', s: 'bold' }])],
        a.rows.map(function (r) { return [r.name].concat(r.b.map(function (v) { return mv(v); }), [mv(r.total)]); }), [[{ v: 'Total', s: 'bold' }].concat((a.total || []).map(function (v) { return mv(v, true); }))]) });
    });
    return sheets;
  }
});

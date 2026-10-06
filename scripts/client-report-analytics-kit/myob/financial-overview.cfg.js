// CRA-01 Financial Overview (MYOB) — Client Report Analytics. One MYOB company file (the client), any period, cash or accrual:
// revenue, gross and net profit with margins against the same period last year, a monthly trend, bank balances and the receivables /
// payables ageing. Every figure is MYOB's: the P&L summaries (this period and exactly the same dates last year), the Balance Sheet at the
// period end (bank) and today (the ageing's control accounts), the connector's ageing, and the journals for the trend and the ties.
var CRA = MK.app({
  title: 'MYOB Financial Overview', primary: 'pnl', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-30', basis: 'Accrual', company_file: '', persona: 'Bookkeeper', ly_from: '2025-07-01', ly_to: '2025-09-30',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' },
  uses: { pnl: ['from_date', 'to_date', 'basis', 'company_file'], pnl_ly: ['ly_from', 'ly_to', 'basis', 'company_file'], bs: ['to_date', 'basis', 'company_file'], bs_now: ['company_file'],
    aged_ar: ['company_file'], aged_ap: ['company_file'], journals: ['ly_from', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { pnl: 'get_profit_and_loss (the period)', pnl_ly: 'get_profit_and_loss (same dates last year)', bs: 'get_balance_sheet (period end: bank balances)', bs_now: 'get_balance_sheet (today: the ageing’s control accounts)',
    aged_ar: 'get_aged_receivables (today)', aged_ap: 'get_aged_payables (today)', journals: 'list_journal_transactions (last year’s start to the period end: monthly trend and ties)', accounts: 'list_accounts (classifications and bank accounts)', company_files: 'list_company_files' },
  // the comparison window is always the same dates one year earlier
  derive: function (inp) { var c = MK.compare(inp.from_date, inp.to_date, 'prev_year'); return { ly_from: c.start, ly_to: c.end }; },
  render: function (c) {
    var body = c.body, d = c.display, h = MK.h, money = function (v) { return MK.money(v, c.currency, d); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var I = c.inputs, from = I.from_date, to = I.to_date, lyFrom = I.ly_from, lyTo = I.ly_to, cash = I.basis === 'Cash', today = c.today;
    if (c.errors.pnl) { body.innerHTML = '<p class="mk-err">' + h(c.err('pnl')) + '</p>'; this._x = null; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }] }; }
    if (!c.data.pnl) return {};
    var idx = MK.accounts(c.data.accounts), na = function (id) { return '<p class="mk-err">' + h(c.err(id) || 'N/A — not in source') + '</p>'; };
    // ---- KPIs from MYOB's P&L summaries
    var kp = function (b) { if (!b) return null; var t = b.totals, rev = t.Income[0], gp = b.calc.GrossProfit[0], np = b.calc.NetProfit[0];
      return { rev: rev, cogs: t.CostOfSales[0], exp: t.Expense[0], oi: t.OtherIncome[0], oe: t.OtherExpense[0], gp: gp, np: np, gpm: rev ? gp / rev : null, npm: rev ? np / rev : null, unc: b.unclassified.length }; };
    var pl = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT), plLy = c.data.pnl_ly ? MK.breakdown([c.data.pnl_ly], idx, MK.PL_LAYOUT) : null, K = kp(pl), L = kp(plLy);
    var chg = function (a, b) { return a == null || b == null ? null : r2(a - b); }, rel = function (a, b) { return a == null || b == null || !b ? null : (a - b) / Math.abs(b); };
    var lyWhy = c.errors.pnl_ly ? c.err('pnl_ly') : 'N/A — not in source';
    var mk = function (label, key) { var v = K[key], l = L ? L[key] : null; return { label: label, value: v, delta: rel(v, l), sub: L ? 'Last year ' + money(l) + ' · change ' + money(chg(v, l)) : 'Last year: ' + lyWhy }; };
    var pk = function (label, key) { var v = K[key], l = L ? L[key] : null; return { label: label, money: false, text: v == null ? 'N/A — no revenue' : MK.pct(v), sub: L ? 'Last year ' + (l == null ? 'N/A' : MK.pct(l)) + (v != null && l != null ? ' · change ' + ((v - l) * 100 >= 0 ? '+' : '') + ((v - l) * 100).toFixed(1) + ' pts' : '') : 'Last year: ' + lyWhy }; };
    var kpis = [mk('Revenue', 'rev'), mk('Gross profit', 'gp'), pk('Gross margin', 'gpm'), mk('Net profit', 'np'), pk('Net margin', 'npm')];
    // ---- the journals: monthly trend (accrual) and the independent ties for this period and last year
    var J = c.data.journals ? MK.items(c.data.journals) : null, plCls = { Income: 1, CostOfSales: 1, Expense: 1, OtherIncome: 1, OtherExpense: 1 };
    var mStart = function (iso) { return iso.slice(0, 8) + '01'; }, addM = function (iso, n) { var x = MK.parse(iso); return MK.iso(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1))); };
    var nMonths = function (a, b) { var x = MK.parse(a), y = MK.parse(b); return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth() + 1; };
    // a period of 2+ months shows its own months (the latest 24 at most); a shorter one shows the 12 months to its end
    var span = nMonths(from, to), tStart = span >= 2 ? (span > 24 ? addM(mStart(to), -23) : from) : addM(mStart(to), -11);
    var months = []; for (var k = mStart(tStart); k <= to; k = addM(k, 1)) months.push({ key: k.slice(0, 7), label: MK.MONTHS[+k.slice(5, 7) - 1].slice(0, 3) + ' ' + k.slice(2, 4), rev: 0, np: 0 });
    var jP = { rev: 0, np: 0 }, jL = { rev: 0, np: 0 }, unk = 0;
    if (J) J.forEach(function (t) { var dt = MK.isoDate(t.DateOccurred || t.DatePosted); if (!dt) return; (t.Lines || []).forEach(function (l) {
      var cls = MK.classOf(l.Account || {}, idx).cls; if (!cls) { unk++; return; } if (!plCls[cls]) return;
      var v = (l.IsCredit ? 1 : -1) * Math.abs(MK.num(l.Amount) || 0), rev = cls === 'Income' ? v : 0;
      if (dt >= from && dt <= to) { jP.rev += rev; jP.np += v; } if (dt >= lyFrom && dt <= lyTo) { jL.rev += rev; jL.np += v; }
      if (dt >= tStart && dt <= to) { var m = months.filter(function (x) { return x.key === dt.slice(0, 7); })[0]; if (m) { m.rev += rev; m.np += v; } } }); });
    months.forEach(function (m) { m.rev = r2(m.rev); m.np = r2(m.np); }); jP.rev = r2(jP.rev); jP.np = r2(jP.np); jL.rev = r2(jL.rev); jL.np = r2(jL.np);
    // ---- Balance Sheets: bank at the period end; receivables / payables control today (the ageing's date)
    var bsAt = function (id) { return c.data[id] ? MK.breakdown([c.data[id]], idx, MK.BS_LAYOUT) : null; }, bs = bsAt('bs'), bsNow = bsAt('bs_now');
    var pick = function (b, f) { var l = b ? b.rows.filter(function (r) { return !r.header && f(r); }) : []; return { rows: l, total: l.length ? MK.sum(l.map(function (r) { return r.values[0]; })) : null }; };
    var bank = pick(bs, function (r) { return r.type === 'Bank' || (!idx.loaded && r.cls === 'Asset' && /bank|cheque|savings/i.test(r.name)); });
    var arCtl = pick(bsNow, function (r) { return r.type === 'AccountReceivable' || (!idx.loaded && /receivable|debtors/i.test(r.name)); });
    var apCtl = pick(bsNow, function (r) { return r.type === 'AccountsPayable' || (!idx.loaded && /payable|creditors/i.test(r.name)); });
    // ---- ageing (the connector's buckets; key spelling '1-30' on the connector, '1_30' accepted too)
    var BK = [['current', 'Current'], ['1-30', '1–30 days'], ['31-60', '31–60 days'], ['61-90', '61–90 days'], ['90+', '90+ days']], ALT = { '1-30': '1_30', '31-60': '31_60', '61-90': '61_90', '90+': '90_plus' };
    var bget = function (o, k) { o = o || {}; var v = o[k] != null ? o[k] : o[ALT[k]]; return MK.num(v) || 0; };
    var ageing = function (id) { var a = c.data[id]; if (!a || typeof a !== 'object') return null; var b = BK.map(function (x) { return r2(bget(a.bucket_totals, x[0])); });
      var parties = (Array.isArray(a.parties) ? a.parties : []).map(function (p) { return { name: p.name || '(no name)', total: r2(MK.num(p.total) || 0), b: BK.map(function (x) { return r2(bget(p.bucket_totals, x[0])); }) }; }).sort(function (x, y) { return y.total - x.total; });
      return { asOf: a.as_of_date || today, buckets: b, total: r2(MK.num(a.grand_total) || 0), sumB: MK.sum(b), sumP: MK.sum(parties.map(function (p) { return p.total; })), parties: parties, top: parties.slice(0, 5) }; };
    var AR = ageing('aged_ar'), AP = ageing('aged_ap');
    // ---- the page
    var ageTable = function (A, who) { return '<div class="mk-scroll"><table class="mk-grid"><thead><tr><th scope="col">' + h(who) + '</th>' + BK.map(function (x) { return '<th scope="col" class="num">' + h(x[1]) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' +
      '<tr class="k-total"><td>All ' + h(who.toLowerCase()) + 's</td>' + A.buckets.map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '<td class="num">' + money(A.total) + '</td></tr>' +
      A.top.map(function (p) { return '<tr class="detail-block"><td>' + h(p.name) + '</td>' + p.b.map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '<td class="num">' + money(p.total) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (A.parties.length > 5 ? '<p class="muted detail-block">Top 5 of ' + A.parties.length + ' ' + h(who.toLowerCase()) + 's by balance.</p>' : ''); };
    var trendOk = !cash && J;
    body.innerHTML = MK.kpis(kpis, c) +
      '<div class="mk-card"><h3>Monthly revenue and net profit — ' + h(MK.periodLine(tStart, to)) + '</h3><div id="cra-trend"></div></div>' +
      '<div class="mk-dash"><div class="mk-card"><h3>Bank balances — ' + h(MK.asOfLine(to)) + '</h3><div id="cra-bank"></div></div>' +
      '<div class="mk-card wide"><h3>Receivables ageing — ' + h(MK.asOfLine(AR ? AR.asOf : today)) + '</h3>' + (AR ? ageTable(AR, 'Customer') : na('aged_ar')) + '</div>' +
      '<div class="mk-card wide"><h3>Payables ageing — ' + h(MK.asOfLine(AP ? AP.asOf : today)) + '</h3>' + (AP ? ageTable(AP, 'Supplier') : na('aged_ap')) + '</div></div>';
    var tr = document.getElementById('cra-trend');
    if (cash) tr.innerHTML = '<p class="muted">N/A — not in source: the monthly trend is built from MYOB’s journals, which are accrual; switch to Accrual to see it.</p>';
    else if (!J) tr.innerHTML = na('journals');
    else MK.line(tr, { title: 'Monthly revenue and net profit', solid: true, labels: months.map(function (m) { return m.label; }), series: [{ name: 'Revenue', values: months.map(function (m) { return m.rev; }) }, { name: 'Net profit', values: months.map(function (m) { return m.np; }) }] }, c);
    var bk = document.getElementById('cra-bank');
    if (!bs) bk.innerHTML = na('bs'); else MK.grid(bk, { columns: [{ key: 'code', title: 'Account' }, { key: 'name', title: 'Name' }, { key: 'bal', title: 'Balance', money: true }], rows: bank.rows.map(function (r) { return { code: r.code, name: r.name, bal: r.values[0] }; }),
      total: { code: 'Total', name: '', bal: bank.total == null ? 0 : bank.total }, empty: 'No bank accounts on the Balance Sheet.' }, c);
    // ---- checks
    var P = c.data.pnl, PL = c.data.pnl_ly, dOf = function (v) { return String(v || '').slice(0, 10); };
    var byCls = function (b) { var s = {}; b.rows.forEach(function (r) { if (!r.header && r.cls) s[r.cls] = r2((s[r.cls] || 0) + r.values[0]); }); return s; }, S = byCls(pl);
    var gpR = r2((S.Income || 0) - (S.CostOfSales || 0)), npR = r2(gpR - (S.Expense || 0) + (S.OtherIncome || 0) - (S.OtherExpense || 0)), lt = MK.linesTies(pl.lines);
    var fyS = MK.fyStartOf(to, c.fy.month), cye = bs ? MK.currentYearEarnings(bs.lines) : null;
    var tieAge = function (A, ctl, id, what, acct) { return !A ? { name: what + ' ageing = the ' + acct + ' account on the Balance Sheet', pass: null, detail: c.err(id) || 'N/A' } : ctl.total == null ? { name: what + ' ageing = the ' + acct + ' account on the Balance Sheet', pass: null, detail: c.err('bs_now') || 'N/A — no ' + acct + ' account in the chart of accounts' }
      : { name: what + ' ageing (' + A.asOf + '): buckets add up to the total, and the total = ' + ctl.rows.map(function (r) { return r.code || r.name; }).join(', ') + ' on the Balance Sheet at the same date (a separate MYOB report)', pass: MK.near(A.sumB, A.total) && MK.near(A.sumP, A.total) && MK.near(A.total, ctl.total), detail: 'buckets ' + money(A.sumB) + ' · ageing ' + money(A.total) + ' · Balance Sheet ' + money(ctl.total) }; };
    var nb = bs ? r2(bs.totals.Asset[0] - bs.totals.Liability[0]) : null;
    var checks = [
      { name: 'MYOB returned the requested period and basis (Profit and Loss)', pass: dOf(P.StartDate) === from && dOf(P.EndDate) === to && (!P.ReportingBasis || P.ReportingBasis === I.basis), detail: dOf(P.StartDate) + ' to ' + dOf(P.EndDate) + ', ' + (P.ReportingBasis || '?') + ' basis' },
      !PL ? { name: 'Last-year figures come from a Profit and Loss for exactly ' + lyFrom + ' to ' + lyTo, pass: null, detail: lyWhy } : { name: 'Last-year figures come from a Profit and Loss for exactly ' + lyFrom + ' to ' + lyTo + ' (same basis)', pass: dOf(PL.StartDate) === lyFrom && dOf(PL.EndDate) === lyTo && (!PL.ReportingBasis || PL.ReportingBasis === I.basis), detail: dOf(PL.StartDate) + ' to ' + dOf(PL.EndDate) + ', ' + (PL.ReportingBasis || '?') + ' basis' },
      { name: 'KPIs = the Profit and Loss’s own rows: Gross profit = Revenue − Cost of sales; Net profit = Gross profit − Expenses + Other income − Other expenses; every account classified', pass: MK.near(gpR, K.gp) && MK.near(npR, K.np) && MK.near(S.Income || 0, K.rev) && !lt.failed.length && !K.unc, detail: 'revenue ' + money(K.rev) + ' · gross profit ' + money(gpR) + ' · net profit ' + money(npR) + (K.unc ? ' · ' + K.unc + ' unclassified account(s)' : '') },
      cash ? { name: 'Revenue and net profit = MYOB’s journals for the period', pass: null, detail: 'N/A on the cash basis (journals are accrual)' } : !J ? { name: 'Revenue and net profit = MYOB’s journals for the period', pass: null, detail: c.err('journals') || 'N/A' }
        : { name: 'Revenue and net profit = MYOB’s journals for ' + from + ' to ' + to + ' (a separate MYOB source; also the trend’s months)', pass: MK.near(jP.rev, K.rev) && MK.near(jP.np, K.np), detail: 'revenue ' + money(K.rev) + ' vs ' + money(jP.rev) + ' · net profit ' + money(K.np) + ' vs ' + money(jP.np) },
      cash || !L ? { name: 'Last year’s revenue and net profit = MYOB’s journals for the same dates', pass: null, detail: cash ? 'N/A on the cash basis (journals are accrual)' : lyWhy } : !J ? { name: 'Last year’s revenue and net profit = MYOB’s journals', pass: null, detail: c.err('journals') || 'N/A' }
        : { name: 'Last year’s revenue and net profit = MYOB’s journals for ' + lyFrom + ' to ' + lyTo, pass: MK.near(jL.rev, L.rev) && MK.near(jL.np, L.np), detail: 'revenue ' + money(L.rev) + ' vs ' + money(jL.rev) + ' · net profit ' + money(L.np) + ' vs ' + money(jL.np) },
      from !== fyS || cash ? { name: 'Net profit = Current Year Earnings on the Balance Sheet', pass: null, detail: cash ? 'N/A on the cash basis' : 'N/A — the period does not start at the financial year start (' + fyS + ')' } : !cye ? { name: 'Net profit = Current Year Earnings on the Balance Sheet', pass: null, detail: c.err('bs') || 'N/A — no Current Year Earnings account' }
        : { name: 'Net profit (financial year to ' + to + ') = Current Year Earnings on the Balance Sheet (a separate MYOB report)', pass: MK.near(K.np, cye.values[0]), detail: money(K.np) + ' vs ' + money(cye.values[0]) },
      !bs ? { name: 'Balance Sheet at ' + to + ' balances (bank balances’ source)', pass: null, detail: c.err('bs') || 'N/A' } : { name: 'Balance Sheet at ' + to + ' balances: Assets − Liabilities = Equity (bank balances’ source; ' + bank.rows.length + ' bank account(s), total ' + money(bank.total == null ? 0 : bank.total) + ')', pass: MK.near(nb, bs.totals.Equity[0]) && !bs.unclassified.length, detail: 'net assets ' + money(nb) + ' vs equity ' + money(bs.totals.Equity[0]) },
      tieAge(AR, arCtl, 'aged_ar', 'Receivables', 'receivables'), tieAge(AP, apCtl, 'aged_ap', 'Payables', 'payables')
    ];
    var notes = ['Revenue = MYOB’s Income accounts; Gross profit = Revenue − Cost of sales; Net profit also takes Expenses, Other income and Other expenses (MYOB’s Profit and Loss layout). Last year = ' + MK.periodLine(lyFrom, lyTo) + ', the same dates one year earlier, same basis.',
      'Bank balances are MYOB’s ledger balances at the period end (type Bank in the chart of accounts), not the bank feed’s.',
      'Ageing is as at today: the connector ages today’s open invoices and bills by days past due (Current, 1–30, 31–60, 61–90, 90+).'];
    var naList = []; if (cash) naList.push('Monthly trend on the cash basis (MYOB’s journals are accrual)'); if (to !== today) naList.push('Ageing at the period end ' + to + ' (the connector only ages today’s open invoices and bills; the ageing shown is as at ' + today + ')');
    if (unk) notes.push(unk + ' journal line(s) had no classification and were left out of the trend.');
    this._x = { K: K, L: L, months: trendOk ? months : null, bank: bank, AR: AR, AP: AP, tStart: tStart };
    return { checks: checks, notes: notes, na: naList, period: MK.periodLine(from, to) + ' · ' + I.basis + ' basis' };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var I = c.inputs, mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; }, pv = function (v) { return v == null ? 'N/A' : { v: Math.round(v * 10000) / 10000, s: 'pct' }; }, b = function (t) { return { v: t, s: 'bold' }; };
    var hd = function (t, cols) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [b('MYOB Financial Overview — ' + t)], ['Period: ' + MK.periodLine(I.from_date, I.to_date) + ' (' + I.from_date + ' to ' + I.to_date + ')'], ['Basis: ' + I.basis + ' · Currency: ' + c.currency + ' · Last year: ' + I.ly_from + ' to ' + I.ly_to], [], cols.map(b)]; };
    var K = x.K, L = x.L || {}, row = function (n, k, pct) { var v = K[k], l = x.L ? L[k] : null; return [n, pct ? pv(v) : mv(v), pct ? pv(l) : mv(l), pct ? (v == null || l == null ? 'N/A' : { v: Math.round((v - l) * 10000) / 10000, s: 'pct' }) : (l == null ? 'N/A' : mv(Math.round((v - l) * 100) / 100))]; };
    var sheets = [{ name: 'Overview', rows: hd('KPIs', ['Metric', 'This period', 'Last year', 'Change']).concat([row('Revenue', 'rev'), row('Cost of sales', 'cogs'), row('Gross profit', 'gp'), row('Gross margin', 'gpm', true), row('Expenses', 'exp'), row('Other income', 'oi'), row('Other expenses', 'oe'), row('Net profit', 'np'), row('Net margin', 'npm', true)]), widths: [28, 18, 18, 18] }];
    if (x.months) sheets.push({ name: 'Trend', rows: hd('Monthly trend (accrual, from the journals)', ['Month', 'Revenue', 'Net profit']).concat(x.months.map(function (m) { return [m.key, mv(m.rev), mv(m.np)]; }), [[b('Total'), { v: MK.sum(x.months.map(function (m) { return m.rev; })), s: 'moneyBold' }, { v: MK.sum(x.months.map(function (m) { return m.np; })), s: 'moneyBold' }]]), widths: [14, 18, 18] });
    sheets.push({ name: 'Bank balances', rows: hd('Bank balances at ' + I.to_date, ['Account', 'Name', 'Balance']).concat(x.bank.rows.map(function (r) { return [r.code, r.name, mv(r.values[0])]; }), [[b('Total'), '', { v: x.bank.total || 0, s: 'moneyBold' }]]), widths: [12, 36, 18] });
    [['Receivables ageing', x.AR, 'Customer'], ['Payables ageing', x.AP, 'Supplier']].forEach(function (s) { var A = s[1]; if (!A) return;
      sheets.push({ name: s[0], rows: hd(s[0] + ' as at ' + A.asOf, [s[2], 'Current', '1-30 days', '31-60 days', '61-90 days', '90+ days', 'Total']).concat(A.parties.map(function (p) { return [p.name].concat(p.b.map(mv), [mv(p.total)]); }), [[b('Total')].concat(A.buckets.map(function (v) { return { v: v, s: 'moneyBold' }; }), [{ v: A.total, s: 'moneyBold' }])]), widths: [32, 14, 14, 14, 14, 14, 16] }); });
    return sheets;
  }
});

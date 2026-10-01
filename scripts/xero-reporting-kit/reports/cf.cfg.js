XK.app({
  title: 'Cash flow manager', primary: 'bank', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', display: 'display' },
  defaults: { as_at: '2026-09-25', past_from: '2026-08-26', past_where: 'Date>=DateTime(2026,08,26) AND Date<=DateTime(2026,09,25)', org: '', page: 1,
    display: '{"cents":0,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"overview","o":"d=30;od=ex"}' },
  uses: { bank: ['as_at', 'org'], bank_past: ['past_from', 'as_at', 'org'], receivables: ['org'], payables: ['org'], bank_tx: ['past_where', 'org'], payments: ['past_where', 'org'], bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { receivables: { input: 'page', key: 'Invoices' }, payables: { input: 'page', key: 'Invoices' }, bank_tx: { input: 'page', key: 'BankTransactions' }, payments: { input: 'page', key: 'Payments' } },
  tools: { bank: 'get_bank_summary (today)', bank_past: 'get_bank_summary (the last 30 days — tie)', receivables: 'list_invoices (sales invoices awaiting payment)', payables: 'list_invoices (bills awaiting payment)', bank_tx: 'list_bank_transactions (last 30 days)', payments: 'list_payments (last 30 days)', bs: 'get_balance_sheet (today)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; },
  derive: function (inp) { var pf = XK.addDaysIso(inp.as_at, -30); return { past_from: pf, past_where: XK.dateWhere('Date', pf, inp.as_at) }; },
  views: [['overview', 'Overview'], ['in', 'Manage cash in'], ['out', 'Manage cash out']],
  options: [{ id: 'd', label: 'Graph days', options: [['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['60', '60 days'], ['90', '90 days']], def: '30' },
    { id: 'od', label: 'Overdue invoices and bills', options: [['ex', 'Not projected'], ['today', 'Expected today']], def: 'ex' }],
  render: function (c) {
    var body = c.body, d0 = Object.assign({}, c.display, { cents: 0 }), money = function (v) { return XK.money(v, c.currency, d0); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.bank) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('bank')) + '</p>'; return { checks: [{ name: 'Bank Summary loaded', pass: false, detail: c.err('bank') }] }; }
    if (!c.data.bank) return {};
    var asAt = c.inputs.as_at, N = +(c.opt('d') || 30), odToday = c.opt('od') === 'today', acct = c.opt('acct') || '', base = c.currency;
    var bw = XK.walk(c.data.bank), accts = bw.lines.filter(function (l) { return l.kind === 'row'; }), useA = function (id) { return !acct || id === acct; };
    var mine = accts.filter(function (l) { return useA(l.id); }), bal = XK.sum(mine.map(function (l) { return l.values[3]; })), todayMove = r2(XK.sum(mine.map(function (l) { return l.values[1] - l.values[2]; })));
    // actuals: the last 30 days from bank transactions (spend / receive money, overpayments, transfers) and invoice / bill payments
    var days = []; for (var i = -30; i <= N; i++) days.push({ d: XK.addDaysIso(asAt, i), off: i, ain: 0, aout: 0, pin: 0, pout: 0 });
    var at = function (iso) { var k = Math.round((XK.parse(iso) - XK.parse(asAt)) / 86400000) + 30; return days[k]; };
    c.rows('bank_tx').forEach(function (t) { if (!t || t.Status === 'DELETED' || t.Status === 'VOIDED' || !useA((t.BankAccount || {}).AccountID)) return; var d = XK.isoDate(t.DateString || t.Date), x = d && at(d); if (!x || x.off > 0) return; var v = XK.num(t.Total) || 0; if (/^RECEIVE/.test(t.Type)) x.ain = r2(x.ain + v); else if (/^SPEND/.test(t.Type)) x.aout = r2(x.aout + v); });
    c.rows('payments').forEach(function (p) { if (!p || p.Status === 'DELETED' || !useA((p.Account || {}).AccountID)) return; var d = XK.isoDate(p.Date), x = d && at(d); if (!x || x.off > 0) return; var v = XK.num(p.Amount) || 0; if (/^ACCREC|^AR/.test(p.PaymentType)) x.ain = r2(x.ain + v); else x.aout = r2(x.aout + v); });
    // projection: invoices and bills awaiting payment by due date (overdue ones optionally expected today)
    var rec = XK.openDocs({ invoices: c.rows('receivables'), types: { invoices: 'ACCREC' } }, base, null), pay = XK.openDocs({ invoices: c.rows('payables'), types: { invoices: 'ACCPAY' } }, base, null);
    var od = { in: 0, out: 0 }, later = { in: 0, out: 0 };
    var proj = function (list, k) { list.forEach(function (d) { if (d.due < asAt) { od[k] = r2(od[k] + d.amount); if (odToday) { var t0 = at(asAt); t0['p' + k] = r2(t0['p' + k] + d.amount); } return; } var x = at(d.due); if (!x || x.off > N) { later[k] = r2(later[k] + d.amount); return; } if (x.off === 0) x = at(XK.addDaysIso(asAt, 0)); x['p' + k] = r2(x['p' + k] + d.amount); }); };
    proj(rec, 'in'); proj(pay, 'out');
    var fut = days.filter(function (x) { return x.off >= 0; }), sumP = function (a, b, k) { return XK.sum(fut.filter(function (x) { return x.off >= a && x.off <= b; }).map(function (x) { return x['p' + k]; })); };
    var k17 = r2(sumP(1, 7, 'in') - sumP(1, 7, 'out')), k8N = r2(sumP(8, N, 'in') - sumP(8, N, 'out')), pin = sumP(0, N, 'in'), pout = sumP(0, N, 'out'), projBal = r2(bal + pin - pout);
    var netN = r2(pin - pout), runway = netN >= 0 ? 'Over a year' : (function () { var burn = -netN / N, dd = bal / burn; return dd > 365 ? 'Over a year' : dd <= 0 ? 'Now' : Math.round(dd) + ' days (' + (dd / 30.4).toFixed(1) + ' months)'; })();
    var view = c.view || 'overview', accSel = accts.length > 1 ? '<label class="muted">Bank accounts <select id="cf-acct"><option value="">All accounts</option>' + accts.map(function (l) { return '<option value="' + XK.h(l.id) + '"' + (l.id === acct ? ' selected' : '') + '>' + XK.h(l.label) + '</option>'; }).join('') + '</select></label>' : '';
    var kp = function (lbl, v, sub) { return '<div class="xk-kpi"><div class="lbl">' + lbl + '</div><div class="val' + (v < 0 ? ' neg' : '') + '">' + money(v) + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>'; };
    var html = '<div class="xk-kpis">' + kp('Today\'s bank balance', bal, XK.asOfLine(asAt)) + kp('Today\'s cash movement', todayMove) + kp('Next 1–7 days cash movement', k17) + kp('Next 8–' + N + ' days cash movement', k8N) + '</div>' + accSel;
    if (view === 'overview') {
      html += '<div class="xk-card"><h3>Cash in &amp; cash out — last 30 days and projected for ' + N + ' days ending ' + XK.asOfLine(XK.addDaysIso(asAt, N)).replace(/^As at /, '') + '</h3><p class="muted">Actuals left of today; projected from invoices and bills by due date right of today' + (odToday ? ' (overdue ones expected today)' : '') + '.</p><div id="cf-ch"></div></div>' +
        '<div class="xk-kpis">' + kp('Today\'s balance', bal) + kp(N + ' days projected balance', projBal) + '<div class="xk-kpi"><div class="lbl">Cash runway</div><div class="val">' + XK.h(runway) + '</div></div></div>' +
        (od.in || od.out ? '<p class="muted">Overdue, ' + (odToday ? 'expected today' : 'not in the projection') + ': invoices ' + money(od.in) + ' · bills ' + money(od.out) + '.</p>' : '');
    } else {
      var list = (view === 'in' ? rec : pay).filter(function (d) { return d.due <= XK.addDaysIso(asAt, N); }).map(function (d) { return { contact: d.contact, number: d.number, due: d.due, state: d.due < asAt ? 'Overdue' : 'Due', amount: d.amount }; });
      html += '<div class="xk-card"><h3>' + (view === 'in' ? 'Cash in — invoices due in the next ' + N + ' days (and overdue)' : 'Cash out — bills due in the next ' + N + ' days (and overdue)') + '</h3><div id="cf-list"></div><p class="muted">Planned items and changes to expected dates are managed in Xero; this report reads due dates only.</p></div>';
      c._list = list;
    }
    body.innerHTML = html;
    if (view === 'overview') XK.bars(document.getElementById('cf-ch'), { title: 'Cash in and out', every: 7, labels: days.map(function (x) { return x.off === 0 ? 'Today' : x.d.slice(8) + '/' + x.d.slice(5, 7); }), series: [{ name: 'Cash in', values: days.map(function (x) { return x.off < 0 ? x.ain : x.off === 0 ? r2(x.ain + x.pin) : x.pin; }), color: 'var(--pos)' }, { name: 'Cash out', values: days.map(function (x) { return -(x.off < 0 ? x.aout : x.off === 0 ? r2(x.aout + x.pout) : x.pout); }), color: 'var(--neg)' }] }, c);
    else XK.grid(document.getElementById('cf-list'), { filter: true, rows: c._list, columns: [{ key: 'contact', title: 'Contact' }, { key: 'number', title: 'Number' }, { key: 'due', title: 'Due date' }, { key: 'state', title: '' }, { key: 'amount', title: 'Amount', money: true }], empty: 'Nothing due.' }, c);
    var s = document.getElementById('cf-acct'); if (s) s.addEventListener('change', function () { c.setOpt('acct', this.value); });
    // Checks
    var pastIn = XK.sum(days.filter(function (x) { return x.off <= 0; }).map(function (x) { return x.ain; })), pastOut = XK.sum(days.filter(function (x) { return x.off <= 0; }).map(function (x) { return x.aout; }));
    var bp = c.data.bank_past ? XK.walk(c.data.bank_past).lines.filter(function (l) { return l.kind === 'row' && useA(l.id); }) : null, bpIn = bp ? XK.sum(bp.map(function (l) { return l.values[1]; })) : null, bpOut = bp ? XK.sum(bp.map(function (l) { return l.values[2]; })) : null;
    var bs = c.data.bs ? XK.bsParts(XK.walk(c.data.bs)) : null, lists = ['receivables', 'payables', 'bank_tx', 'payments'];
    var checks = [
      { name: 'Projected balance = today\'s balance + projected cash in − projected cash out', pass: XK.near(projBal, bal + pin - pout), detail: money(bal) + ' + ' + money(pin) + ' − ' + money(pout) + ' = ' + money(projBal) },
      { name: 'KPI strip = Σ the daily projection (days 1–7 and 8–' + N + ')', pass: XK.near(k17, sumP(1, 7, 'in') - sumP(1, 7, 'out')) && XK.near(k8N, XK.sum(fut.filter(function (x) { return x.off >= 8; }).map(function (x) { return x.pin - x.pout; }))), detail: money(k17) + ' · ' + money(k8N) },
      { name: 'Cash runway method (information)', pass: null, info: true, detail: 'Today\'s balance ÷ average daily net outflow over the ' + N + '-day projection; "Over a year" when the projection is not negative' },
      { name: 'Today\'s bank balance = Total Bank on the Balance Sheet today', pass: acct ? null : bs && bs.bank != null ? XK.near(bal, bs.bank) : null, detail: acct ? 'One account selected' : bs ? money(bal) + ' vs ' + money(bs.bank) : c.err('bs') },
      { name: 'Last 30 days: bank transactions + payments = the Bank Summary for the same days', pass: bp ? XK.near(pastIn, bpIn, 0.05) && XK.near(pastOut, bpOut, 0.05) : null, detail: bp ? 'In ' + money(pastIn) + ' vs ' + money(bpIn) + ' · out ' + money(pastOut) + ' vs ' + money(bpOut) : c.err('bank_past') },
      { name: 'All invoices, bills and transactions loaded', pass: lists.some(function (id) { return c.errors[id] || c.truncated(id); }) ? false : true, detail: rec.length + ' invoice(s), ' + pay.length + ' bill(s), ' + c.rows('bank_tx').length + ' transaction(s), ' + c.rows('payments').length + ' payment(s)' }
    ];
    this._x = { days: days, bal: bal, projBal: projBal, runway: runway, N: N };
    return { checks: checks, notes: ['Projection = invoices and bills awaiting payment by due date. Repeating invoices, planned items and bank-feed lines are not included (not in the Xero API as plans).', 'Actuals include transfers between your accounts, as the Bank Summary does.'], na: ['Xero\'s planned cash items (Manage cash in / out adjustments)'], period: XK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash flow manager', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], [], ['Today\'s balance', { v: x.bal, s: 'money' }], [x.N + ' days projected balance', { v: x.projBal, s: 'money' }], ['Cash runway', x.runway], [], [{ v: 'Date', s: 'bold' }, { v: 'Actual in', s: 'bold' }, { v: 'Actual out', s: 'bold' }, { v: 'Projected in', s: 'bold' }, { v: 'Projected out', s: 'bold' }]]
      .concat(x.days.map(function (d) { return [d.d, { v: d.ain, s: 'money' }, { v: d.aout, s: 'money' }, { v: d.pin, s: 'money' }, { v: d.pout, s: 'money' }]; }));
    return [{ name: 'Cash flow manager', rows: rows, widths: [26, 16, 16, 16, 16] }];
  }
});

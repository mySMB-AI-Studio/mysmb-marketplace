XK.app({
  title: 'Month-end task list', primary: 'bs', dated: ['bs'], org: 'org', conns: 'connections', noBasis: true,
  mechanism: 'xero-accounting, xero-payroll-au and xero-assets connectors — mySMB custom MCPs on the Xero Accounting, Payroll AU and Assets APIs (AGT-001)',
  inputs: { start: 'period_start', end: 'period_end', org: 'org', display: 'display' },
  defaults: { period_start: '2026-08-01', period_end: '2026-08-31', mj_where: 'Date>=DateTime(2026,08,01) AND Date<=DateTime(2026,08,31)', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"last_month","a":"custom","c":"none","v":"","o":"f=all"}' },
  uses: { bank: ['period_start', 'period_end', 'org'], receivables: ['org'], payables: ['org'], journals: ['mj_where', 'org'], bs: ['period_end', 'org'], pay_runs: ['org'], timesheets: ['org'], assets: ['org'], org: ['org'], connections: [] },
  paged: { receivables: { input: 'page', key: 'Invoices' }, payables: { input: 'page', key: 'Invoices' }, journals: { input: 'page', key: 'ManualJournals' }, pay_runs: { input: 'page', key: 'PayRuns' }, timesheets: { input: 'page', key: 'Timesheets' } },
  sources: { pay_runs: { name: 'Xero Payroll AU', optional: true }, timesheets: { name: 'Xero Payroll AU', optional: true }, assets: { name: 'Xero Assets', optional: true } },
  tools: { bank: 'get_bank_summary (the period)', receivables: 'list_invoices (sales invoices awaiting payment)', payables: 'list_invoices (bills awaiting payment)', journals: 'list_manual_journals (dated in the period)', bs: 'get_balance_sheet (period end)', pay_runs: 'list_pay_runs (Xero Payroll AU)', timesheets: 'list_timesheets (Xero Payroll AU)', assets: 'list_assets (Xero Assets, registered)', org: 'get_organisation', connections: 'list_connections' },
  presets: [['last_month', 'Last month'], ['this_month', 'This month'], ['last_quarter', 'Last quarter'], ['this_month_td', 'This month to date'], ['custom', 'Custom']],
  derive: function (inp) { return { mj_where: XK.dateWhere('Date', inp.period_start, inp.period_end) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var ps = c.inputs.period_start, pe = c.inputs.period_end, base = c.currency, T = [];
    var task = function (area, cat, title, figure, rule, items) { T.push({ area: area, cat: cat, title: title, figure: figure || '', rule: rule || '', items: items || [] }); };
    var day = function (s) { var p = String(s || '').split('-'); return p.length === 3 ? +p[2] + ' ' + XK.MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0] : s; };
    var plabel = ps.slice(8) === '01' && ps.slice(0, 7) === pe.slice(0, 7) && pe === XK.iso(XK.eom(+pe.slice(0, 4), +pe.slice(5, 7))) ? XK.MONTHS[+pe.slice(5, 7) - 1] + ' ' + pe.slice(0, 4) : day(ps) + ' – ' + day(pe);
    // ---- Bank and cash (Bank Summary for the period)
    var bw = c.data.bank ? XK.walk(c.data.bank) : null, banks = bw ? bw.lines.filter(function (l) { return l.kind === 'row'; }) : [];
    if (c.errors.bank) task('Bank and cash', 'Information-required', 'Bank balances — confirm directly in Xero', c.err('bank'), 'The Bank Summary could not be loaded');
    else {
      banks.filter(function (l) { return l.values[3] < 0; }).forEach(function (l) { task('Bank and cash', 'Required', 'Overdrawn bank account: ' + l.label, 'Closing balance ' + money(l.values[3]) + ' at ' + day(pe), 'A closing balance below $0 at the period end'); });
      task('Bank and cash', 'Review', 'Check unreconciled bank items', banks.length + ' bank account(s), closing ' + money(XK.sum(banks.map(function (l) { return l.values[3]; }))), 'Unreconciled statement lines are not in the Bank Summary — run Bank Reconciliation Status for the detail');
    }
    // ---- Receivables and payables (open documents dated on or before the period end; balances are Xero's current ones)
    var minus = function (s, k) { return XK.addDaysIso(s, k); };
    var rec = XK.openDocs({ invoices: c.rows('receivables'), types: { invoices: 'ACCREC' } }, base, pe), pay = XK.openDocs({ invoices: c.rows('payables'), types: { invoices: 'ACCPAY' } }, base, pe);
    var docList = function (list) { return list.map(function (d) { return d.number + ' · ' + d.contact + ' · due ' + day(d.due) + ' · ' + money(d.amount); }); };
    if (c.errors.receivables) task('Receivables', 'Information-required', 'Receivables — confirm directly in Xero', c.err('receivables'), 'Sales invoices could not be loaded');
    else { var o90 = rec.filter(function (d) { return d.due < minus(pe, -90); }); if (o90.length) task('Receivables', 'Required', 'Invoices more than 90 days overdue', o90.length + ' invoice(s) · ' + money(XK.sum(o90.map(function (d) { return d.amount; }))), 'Due more than 90 days before ' + day(pe), docList(o90)); }
    if (c.errors.payables) task('Payables', 'Information-required', 'Payables — confirm directly in Xero', c.err('payables'), 'Bills could not be loaded');
    else {
      var od = pay.filter(function (d) { return d.due < pe; }), soon = pay.filter(function (d) { return d.due >= pe && d.due <= minus(pe, 7); });
      if (od.length) task('Payables', 'Required', 'Bills overdue at the period end', od.length + ' bill(s) · ' + money(XK.sum(od.map(function (d) { return d.amount; }))), 'Due before ' + day(pe), docList(od));
      if (soon.length) task('Payables', 'Review', 'Bills due on the period end or within 7 days after', soon.length + ' bill(s) · ' + money(XK.sum(soon.map(function (d) { return d.amount; }))), 'Due ' + day(pe) + ' – ' + day(minus(pe, 7)) + ' (cash planning, not close-blocking)', docList(soon));
      var payT = XK.sum(pay.map(function (d) { return d.amount; })), bySup = {}; pay.forEach(function (d) { bySup[d.contact] = r2((bySup[d.contact] || 0) + d.amount); });
      Object.keys(bySup).filter(function (k) { return payT > 0 && bySup[k] / payT > 0.25; }).forEach(function (k) { task('Payables', 'Review', 'Supplier concentration: ' + k, XK.pct(bySup[k] / payT, 0) + ' of outstanding bills (' + money(bySup[k]) + ' of ' + money(payT) + ')', 'A supplier over 25% of bills dated on or before ' + day(pe)); });
    }
    // ---- Payroll (Xero Payroll AU — optional: an organisation without AU payroll gets an Information-required task)
    if (c.errors.pay_runs) task('Payroll', 'Information-required', 'Pay runs — confirm directly in Xero', c.err('pay_runs'), 'Xero Payroll AU is not available for this organisation');
    else {
      var runs = c.rows('pay_runs').map(function (r) { return { start: XK.isoDate(r.PayRunPeriodStartDate), end: XK.isoDate(r.PayRunPeriodEndDate), status: r.PayRunStatus || '', net: XK.num(r.NetPay) }; });
      var inP = runs.filter(function (r) { return r.end >= ps && r.end <= minus(pe, 7); }), dr = inP.filter(function (r) { return r.status !== 'POSTED'; });
      dr.forEach(function (r) { task('Payroll', 'Required', 'Pay run not posted: ' + day(r.start) + ' – ' + day(r.end), 'Status ' + r.status + ' · net pay ' + money(r.net), 'A pay run for the period still in a draft-like status'); });
      if (runs.length && !inP.length) task('Payroll', 'Review', 'No pay run for the period', '0 pay runs ending ' + day(ps) + ' – ' + day(minus(pe, 7)) + ' (' + runs.length + ' on file)', 'Pay runs exist for other periods');
    }
    if (c.errors.timesheets) { if (!c.errors.pay_runs) task('Payroll', 'Information-required', 'Timesheets — confirm directly in Xero', c.err('timesheets'), 'Timesheets could not be loaded'); }
    else {
      var ts = c.rows('timesheets').map(function (t) { return { start: XK.isoDate(t.StartDate), end: XK.isoDate(t.EndDate), status: t.Status || '', hours: XK.num(t.Hours) || 0, emp: t.EmployeeID }; }).filter(function (t) { return t.start <= pe && t.end >= ps && !/APPROVED|PROCESSED/.test(t.status); });
      if (ts.length) task('Payroll', 'Review', 'Timesheets not yet approved', ts.length + ' timesheet(s) · ' + r2(XK.sum(ts.map(function (t) { return t.hours; }))) + ' hours', 'Timesheets in the period that are not approved', ts.map(function (t) { return day(t.start) + ' – ' + day(t.end) + ' · ' + t.hours + ' h · ' + t.status; }));
    }
    // ---- Manual journals dated in the period (list_manual_journals; never list_journals — it needs a scope this connector lacks)
    if (c.errors.journals) task('Journals', 'Information-required', 'Manual journals for the period — confirm directly in Xero', c.err('journals'), 'Manual journals could not be loaded');
    else {
      var js = c.rows('journals').map(function (j) { var lines = (j.JournalLines || []).map(function (l) { return XK.num(l.LineAmount) || 0; }); return { date: XK.isoDate(j.Date), status: j.Status || '', narr: j.Narration || '(no narration)', max: lines.reduce(function (a, v) { return Math.max(a, Math.abs(v)); }, 0), debits: XK.sum(lines.filter(function (v) { return v > 0; })), lines: lines }; })
        .filter(function (j) { return j.date >= ps && j.date <= pe && !/VOIDED|DELETED/.test(j.status); });
      js.filter(function (j) { return j.status === 'DRAFT'; }).forEach(function (j) { task('Journals', 'Required', 'Draft manual journal: ' + j.narr, day(j.date) + ' · ' + money(j.debits), 'A draft journal dated in the period — post it or delete it before close'); });
      js.filter(function (j) { return j.status === 'POSTED' && j.lines.some(function (v) { var a = Math.abs(v); return a >= 10000 || (a >= 1000 && Math.abs(a % 1000) < 0.005); }); }).forEach(function (j) { task('Journals', 'Review', 'Large or round journal: ' + j.narr, day(j.date) + ' · largest line ' + money(j.max), 'A posted line of $10,000 or more, or a round-thousand amount'); });
    }
    // ---- GST and balance-sheet housekeeping (Balance Sheet at the period end)
    var bsw = c.data.bs ? XK.walk(c.data.bs) : null, bp = bsw ? XK.bsParts(bsw) : null;
    if (c.errors.bs) task('Balance sheet', 'Information-required', 'Balance sheet checks — confirm directly in Xero', c.err('bs'), 'The Balance Sheet could not be loaded');
    else if (bsw) {
      if (bp.gst != null) task('GST', 'Review', 'GST balance at the period end', money(bp.gst) + ' at ' + day(pe), 'Confirm with GST Reconciliation Detail (or the GST summary) before lodging');
      bsw.lines.filter(function (l) { return l.kind === 'row' && /suspense|uncategori[sz]ed|clearing/i.test(l.label) && Math.abs(l.values[0] || 0) >= 0.005; }).forEach(function (l) { task('Balance sheet', 'Required', 'Clear ' + l.label, 'Balance ' + money(l.values[0]) + ' at ' + day(pe), 'A non-zero suspense, uncategorised or clearing account'); });
    }
    if (c.errors.assets) task('Fixed assets', 'Information-required', 'Fixed asset register — confirm directly in Xero', c.err('assets'), 'Xero Assets is not available for this organisation');
    else if (c.data.assets) {
      var as = (c.data.assets.items || []).filter(function (a) { return /registered/i.test(a.assetStatus || ''); }), last = as.map(function (a) { return XK.isoDate(a.purchaseDate); }).sort().slice(-1)[0];
      task('Fixed assets', 'Information-required', 'Confirm ' + plabel + ' depreciation is posted', as.length + ' registered asset(s)' + (last ? ' · latest purchase ' + day(last) : ''), 'The Xero Assets API cannot run or confirm depreciation — check Fixed assets → Run depreciation in Xero');
    }
    // ---- Optional (good practice, not close-blocking)
    task('Close', 'Optional', 'Lock the period in Xero', 'Period end ' + day(pe), 'Good practice once the tasks above are done (Settings → Advanced → Financial settings → Lock dates)');
    task('Close', 'Optional', 'Save the month-end report pack', plabel, 'Ask for the Report Pack to keep the period\'s statements together');
    // ---- layout
    var CATS = ['Required', 'Review', 'Information-required', 'Optional'], f = c.opt('f') || 'all', count = function (k) { return T.filter(function (t) { return t.cat === k; }).length; };
    var cls = { Required: 'xk-bad', Review: '', 'Information-required': 'muted', Optional: 'muted' };
    var shown = T.filter(function (t) { return f === 'all' || t.cat === f; }), areas = []; shown.forEach(function (t) { if (areas.indexOf(t.area) < 0) areas.push(t.area); });
    body.innerHTML = '<div class="xk-kpis">' + CATS.map(function (k) { return '<div class="xk-kpi"><div class="lbl">' + k + '</div><div class="val ' + (k === 'Required' && count(k) ? 'neg' : '') + '">' + count(k) + '</div></div>'; }).join('') + '</div>' +
      '<div class="xk-card"><button type="button" class="xk-chip' + (f === 'all' ? ' on' : '') + '" data-f="all">All (' + T.length + ')</button>' + CATS.map(function (k) { return '<button type="button" class="xk-chip' + (f === k ? ' on' : '') + '" data-f="' + k + '">' + k + ' (' + count(k) + ')</button>'; }).join('') +
      '<p class="muted"><strong>Required</strong> = an objective check failed against live data · <strong>Review</strong> = a live figure needs your judgement · <strong>Information-required</strong> = Xero\'s API cannot answer it, check in Xero · <strong>Optional</strong> = good practice, not close-blocking. This list reviews only — it never posts, corrects or closes anything.</p></div>' +
      areas.map(function (a) { return '<div class="xk-card"><h3>' + XK.h(a) + '</h3>' + shown.filter(function (t) { return t.area === a; }).map(function (t) {
        return '<div class="xk-kpi" style="margin-bottom:8px"><div style="font-weight:600;margin:2px 0 4px"><span class="xk-chip ' + cls[t.cat] + '">' + t.cat + '</span> ' + XK.h(t.title) + '</div><div class="sub">' + XK.h(t.figure) + '</div><div class="sub muted">Rule: ' + XK.h(t.rule) + '</div>' +
          (t.items.length ? '<details><summary>' + t.items.length + ' item(s)</summary><ul>' + t.items.map(function (i) { return '<li>' + XK.h(i) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>'; }).join('') + '</div>'; }).join('');
    body.querySelectorAll('button[data-f]').forEach(function (b) { b.addEventListener('click', function () { c.setOpt('f', b.getAttribute('data-f')); }); });
    // ---- checks (data integrity — the findings above are tasks, not failures)
    var bankT = banks.length ? XK.sum(banks.map(function (l) { return l.values[3]; })) : null, apOpen = r2(XK.sum(pay.map(function (d) { return d.amount; })));
    var lists = ['receivables', 'payables', 'journals', 'pay_runs', 'timesheets'];
    var checks = [
      { name: 'Every Required and Review task cites its figure and threshold', pass: T.filter(function (t) { return t.cat === 'Required' || t.cat === 'Review'; }).every(function (t) { return t.figure && t.rule; }), detail: count('Required') + ' Required · ' + count('Review') + ' Review' },
      { name: 'Each bank account: opening + received − spent = closing', pass: banks.length ? banks.every(function (l) { return XK.near(l.values[0] + l.values[1] - l.values[2], l.values[3]); }) : null, detail: banks.length + ' account(s)' },
      { name: 'Bank closing balances = Total Bank on the Balance Sheet at ' + pe, pass: bankT == null || !bp || bp.bank == null ? null : XK.near(bankT, bp.bank), detail: bankT == null || !bp ? 'Bank Summary or Balance Sheet unavailable' : money(bankT) + ' vs ' + money(bp.bank) },
      !bp || bp.ap == null || c.errors.payables ? { name: 'Open bills vs Accounts Payable (information)', pass: null, info: true, detail: 'N/A — bills or the Balance Sheet unavailable' }
        : XK.near(apOpen, bp.ap) ? { name: 'Open bills dated on or before ' + pe + ' = Accounts Payable on the Balance Sheet', pass: true, detail: money(apOpen) + ' vs ' + money(bp.ap) }
        : { name: 'Open bills vs Accounts Payable (information)', pass: null, info: true, detail: money(apOpen) + ' vs ' + money(bp.ap) + ' — Accounts Payable also nets supplier credits and overpayments' + (pe < c.today ? ', and bills paid since ' + pe + ' are no longer open' : '') },
      { name: 'All lists loaded', pass: lists.some(function (id) { return c.truncated(id); }) ? false : true, detail: lists.filter(function (id) { return c.truncated(id); }).join(', ') || 'every page' }
    ];
    this._x = { T: T };
    return { checks: checks, notes: ['Open invoice and bill balances are Xero\'s current balances' + (pe < c.today ? ' (the period ended before today, so items paid since are not listed).' : '.'), 'Payroll and fixed assets come from the Xero Payroll AU and Xero Assets connectors; when either is not available for this organisation, its tasks become Information-required.'],
      na: ['Posting depreciation, approving pay runs or reconciling — this list reviews only'], period: XK.periodLine(ps, pe) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Month-end tasks', widths: [16, 20, 50, 40, 60, 60], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Month-end task list', s: 'bold' }], [XK.periodLine(c.inputs.period_start, c.inputs.period_end)], [],
      [{ v: 'Area', s: 'bold' }, { v: 'Category', s: 'bold' }, { v: 'Task', s: 'bold' }, { v: 'Figure', s: 'bold' }, { v: 'Rule', s: 'bold' }, { v: 'Items', s: 'bold' }]]
      .concat(x.T.map(function (t) { return [t.area, t.cat, t.title, t.figure, t.rule, t.items.join('; ')]; })) }];
  }
});

// Job Profit and Loss (M53) and its comparison (M54): the income and expense lines coded to each job in MYOB's journal transactions,
// per category, laid out as a P&L. The independent tie is MYOB's job register (GeneralLedger/JobRegister) — its own monthly net
// activity per job and category, Year = the financial year — compared for every whole month in the period.
MK.app({
  title: 'Job Profit and Loss', primary: 'journals', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', jobs: '', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"job","x":""}' },
  uses: { journals: ['from_date', 'to_date', 'company_file'], register: ['company_file'], accounts: ['company_file'], company_files: [] },
  tools: { journals: 'list_journal_transactions (every journal in the period — the lines coded to a job)', register: 'list_job_register (MYOB\'s monthly net activity per job and category, for the tie)', accounts: 'list_accounts (classifications)', company_files: 'list_company_files' },
  views: [['job', 'Profit and loss by job'], ['compare', 'Jobs side by side']],
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.journals) { body.innerHTML = '<p class="mk-err">' + h(c.err('journals')) + '</p>'; return { checks: [{ name: 'Journal transactions loaded', pass: false, detail: c.err('journals') }] }; }
    if (!c.data.journals) return {};
    var idx = MK.accounts(c.data.accounts), DRN = { Asset: 1, Expense: 1, CostOfSales: 1, OtherExpense: 1 }, PLC = /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/;
    var J = {}, per = {}, bsLines = 0, bsSum = 0, noJob = 0, noJobIn = 0, noJobEx = 0, unclass = {}, jk = function (j) { return j.Number || j.UID; };
    MK.items(c.data.journals).forEach(function (t) { var d = MK.isoDate(t.DateOccurred || t.DatePosted); if (d < from || d > to) return; (t.Lines || []).forEach(function (l) {
      var a = l.Account || {}, cls = MK.classOf(a, idx).cls || '', amt = Math.abs(MK.num(l.Amount) || 0), nat = r2((DRN[cls] ? 1 : -1) * (l.IsCredit ? -amt : amt)), j = l.Job;
      if (!j || !(j.UID || j.Number)) { if (PLC.test(cls)) { noJob++; if (/Income/.test(cls)) noJobIn = r2(noJobIn + nat); else noJobEx = r2(noJobEx + nat); } return; }
      var k = jk(j); J[k] = J[k] || { key: k, no: j.Number || '', name: j.Name || '' };
      if (!cls) unclass[a.DisplayID || a.Name] = 1;
      if (!PLC.test(cls)) { if (cls) { bsLines++; bsSum = r2(bsSum + nat); } return; }
      var p = per[k] = per[k] || {}, ak = a.UID || a.DisplayID; p[ak] = p[ak] || { Account: { UID: a.UID, DisplayID: a.DisplayID, Name: a.Name }, AccountTotal: 0 }; p[ak].AccountTotal = r2(p[ak].AccountTotal + nat); }); });
    var keys = Object.keys(J).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    var want = String(c.inputs.jobs || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return J[s]; });
    var view = c.view || 'job', sel = view === 'job' ? (c.display.x && J[c.display.x] ? [c.display.x] : keys) : (want.length ? keys.filter(function (k) { return want.indexOf(k) >= 0; }) : keys);
    var rep = function (k) { return { AccountsBreakdown: Object.keys(per[k] || {}).map(function (a) { return per[k][a]; }) }; }, label = function (k) { return (J[k].no ? J[k].no + ' ' : '') + J[k].name; };
    var all = MK.breakdown(sel.map(rep), idx, MK.PL_LAYOUT), col = function (b, g, i) { return b.totals[g] ? b.totals[g][i] : 0; }, n = sel.length;
    var tot = function (g) { var s = 0; for (var i = 0; i < n; i++) s += col(all, g, i); return r2(s); }, np = all.calc.NetProfit ? r2(MK.sum(all.calc.NetProfit)) : 0;
    var html = MK.kpis([{ label: 'Jobs', value: n, money: false }, { label: 'Income', value: r2(tot('Income') + tot('OtherIncome')) }, { label: 'Cost of sales and expenses', value: r2(tot('CostOfSales') + tot('Expense') + tot('OtherExpense')) }, { label: 'Net profit', value: np }], c);
    if (view === 'job') html += '<label class="ctl" style="display:inline-flex;margin:12px 0">Job<select id="jp-job"><option value="">All jobs with activity</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (sel.length === 1 && sel[0] === k && c.display.x ? ' selected' : '') + '>' + h(label(k)) + '</option>'; }).join('') + '</select></label>';
    else html += '<div id="jp-pick" style="margin:12px 0;display:flex;flex-wrap:wrap;gap:12px">' + keys.map(function (k) { return '<label style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" value="' + h(k) + '"' + (sel.indexOf(k) >= 0 ? ' checked' : '') + '>' + h(label(k)) + '</label>'; }).join('') + '</div>';
    if (!keys.length) html += '<p class="muted">No income or expense lines in this period are coded to a job in MYOB.</p>';
    else if (view === 'compare') html += '<div class="mk-scroll">' + MK.statement(all.lines.map(function (l) { return Object.assign({}, l, { values: l.kind === 'header' ? [] : l.values.concat([r2(MK.sum(l.values))]) }); }), [''].concat(sel.map(label)).concat(['Total']), c) + '</div>';
    else html += sel.map(function (k, i) { return '<div class="mk-card" style="margin-top:16px"><h3>' + h(label(k)) + '</h3><div class="mk-scroll">' + MK.statement(all.lines.map(function (l) { return Object.assign({}, l, { values: l.kind === 'header' ? [] : [l.values[i]] }); }), ['', 'Total'], c) + '</div></div>'; }).join('');
    body.innerHTML = html;
    var pick = document.getElementById('jp-job'); if (pick) pick.addEventListener('change', function () { c.change({}, { x: this.value }); });
    var box = document.getElementById('jp-pick'); if (box) box.addEventListener('change', function () { var on = [].slice.call(box.querySelectorAll('input:checked')).map(function (x) { return x.value; }); c.change({ jobs: on.length === keys.length ? '' : on.join(',') }, {}); });
    // the tie: MYOB's job register vs the job-coded journal lines, per job, category and whole month in the period (every job and category)
    var fm = c.fy.month, months = [], y = +from.slice(0, 4), mo = +from.slice(5, 7) + (from.slice(8) > '01' ? 1 : 0);
    for (; ; mo++) { if (mo > 12) { mo = 1; y++; } if (MK.iso(MK.eom(y, mo)) > to) break; months.push(y + '-' + (mo < 10 ? '0' : '') + mo); }
    var tie = null;
    if (c.data.register && months.length) {
      var A = {}, add = function (k, side, v) { A[k] = A[k] || [0, 0]; A[k][side] = r2(A[k][side] + v); };
      MK.items(c.data.register).forEach(function (r) { var mo = +r.Month, y = +r.Year - (fm > 1 && mo >= fm ? 1 : 0), ym = y + '-' + (mo < 10 ? '0' : '') + mo; if (months.indexOf(ym) < 0 || !r.Job) return;
        add(jk(r.Job) + ' ' + ((r.Account || {}).DisplayID || (r.Account || {}).Name) + ' ' + ym, 0, (MK.num(r.Activity) || 0) + (MK.num(r.YearEndActivity) || 0)); });
      MK.items(c.data.journals).forEach(function (t) { var d = MK.isoDate(t.DateOccurred || t.DatePosted); if (months.indexOf(d.slice(0, 7)) < 0) return; (t.Lines || []).forEach(function (l) {
        if (!l.Job || !(l.Job.UID || l.Job.Number)) return; var a = l.Account || {}, cls = MK.classOf(a, idx).cls || '', amt = Math.abs(MK.num(l.Amount) || 0);
        add(jk(l.Job) + ' ' + (a.DisplayID || a.Name) + ' ' + d.slice(0, 7), 1, (DRN[cls] ? 1 : -1) * (l.IsCredit ? -amt : amt)); }); });
      var bad = Object.keys(A).filter(function (k) { return !MK.near(A[k][0], A[k][1]); });
      tie = { pass: bad.length === 0, detail: bad.length ? bad.length + ' differ, e.g. ' + bad[0] + ': register ' + money(A[bad[0]][0]) + ' vs journals ' + money(A[bad[0]][1]) : Object.keys(A).length + ' job, category and month totals (' + months[0] + (months.length > 1 ? ' to ' + months[months.length - 1] : '') + ')' };
    }
    var ties = MK.linesTies(all.lines), npOk = !all.calc.NetProfit || all.calc.NetProfit.every(function (v, i) { return MK.near(v, col(all, 'Income', i) - col(all, 'CostOfSales', i) - col(all, 'Expense', i) + col(all, 'OtherIncome', i) - col(all, 'OtherExpense', i)); });
    this._x = { lines: all.lines, titles: [''].concat(sel.map(label)) };
    return { checks: [
      { name: 'MYOB\'s job register = the job-coded journal lines, per job, category and whole month (two MYOB sources)', pass: c.errors.register ? null : tie ? tie.pass : null, detail: c.errors.register ? c.err('register') : tie ? tie.detail : 'N/A — no whole month in the period' },
      { name: 'Every job-coded category is classified', pass: c.errors.accounts ? null : Object.keys(unclass).length === 0, detail: c.errors.accounts ? c.err('accounts') : Object.keys(unclass).length ? Object.keys(unclass).join(', ') : keys.length + ' jobs' },
      { name: 'Each job: section totals = Σ their categories; Net Profit = Income − Cost of Sales − Expenses + Other Income − Other Expenses', pass: n ? ties.failed.length === 0 && npOk : null, detail: ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : n + ' jobs' },
      { name: 'Income and expense lines with no job (see Job Exceptions)', pass: null, info: true, detail: noJob + ' lines — income ' + money(noJobIn) + ', expenses ' + money(noJobEx) },
      { name: 'Job-coded lines on balance-sheet categories (not in a P&L)', pass: null, info: true, detail: bsLines + ' lines, ' + money(bsSum) }],
      title: view === 'compare' ? 'Job Profit and Loss Comparison' : sel.length === 1 && c.display.x ? 'Job Profit and Loss — ' + label(sel[0]) : 'Job Profit and Loss',
      notes: ['Income and expense lines coded to a job in MYOB\'s journal transactions, dated in the period, in each category\'s normal balance. The tie compares them with MYOB\'s job register (monthly totals, its Year read as the financial year) for each whole month in the period.'],
      na: ['Header jobs and sub-job roll-ups (the connector has no job list)', 'Job budgets', 'Cash basis (journals are accrual)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [MK.sheetFromLines('Job profit and loss', c.company, MK.periodLine(c.inputs.from_date, c.inputs.to_date), x.titles, x.lines, MK.footerStamp('Accrual', c.fetchedAt), x.titles.slice(1).map(function () { return 'money'; }))];
  }
});

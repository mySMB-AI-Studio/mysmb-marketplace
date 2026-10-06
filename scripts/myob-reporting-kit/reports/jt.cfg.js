// Job Transactions (M55), Job Activity (M56) and Job Exceptions (M57 cash / M58 invoice): MYOB's journal transactions read by job.
// Transactions: every transaction with a line coded to the job, all its lines, the job's lines marked. Activity: only the job's lines,
// by category. Exceptions: income and expense lines with no job — cash (spend / receive money, pay runs, inventory, general journals) and
// invoice (sales, purchases). Ties: MYOB's job register (whole months) and MYOB's Profit and Loss (the journals are complete).
MK.app({
  title: 'Job Transactions', primary: 'journals', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"transactions","x":""}' },
  uses: { journals: ['from_date', 'to_date', 'company_file'], register: ['company_file'], pnl: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { journals: 'list_journal_transactions (every journal in the period)', register: 'list_job_register (MYOB\'s monthly net activity per job and category, for the tie)', pnl: 'get_profit_and_loss_3m (income and expense activity in the period, for the tie)', accounts: 'list_accounts (classifications)', company_files: 'list_company_files' },
  views: [['transactions', 'Job transactions'], ['activity', 'Job activity by category'], ['exceptions', 'Job exceptions']],
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.journals) { body.innerHTML = '<p class="mk-err">' + h(c.err('journals')) + '</p>'; return { checks: [{ name: 'Journal transactions loaded', pass: false, detail: c.err('journals') }] }; }
    if (!c.data.journals) return {};
    var idx = MK.accounts(c.data.accounts), DRN = { Asset: 1, Expense: 1, CostOfSales: 1, OtherExpense: 1 }, PLC = /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/, jk = function (j) { return j && (j.Number || j.UID); };
    var J = {}, T = [], L = [], plNat = {}, unbal = 0;
    MK.items(c.data.journals).forEach(function (t) { var d = MK.isoDate(t.DateOccurred || t.DatePosted); if (!t.Lines || d < from || d > to) return;
      var tr = { date: d, id: t.DisplayID || '', type: (t.SourceTransaction || {}).TransactionType || t.JournalType || '', jt: t.JournalType || '', desc: t.Description || '', lines: [], jobs: {} };
      t.Lines.forEach(function (l) { var a = l.Account || {}, cls = MK.classOf(a, idx).cls || '', amt = r2(Math.abs(MK.num(l.Amount) || 0)), k = jk(l.Job), ln = { tr: tr, code: a.DisplayID || '', account: a.Name || '', cls: cls, memo: l.LineDescription || '', debit: l.IsCredit ? null : amt, credit: l.IsCredit ? amt : null, job: k || '', nat: r2((DRN[cls] ? 1 : -1) * (l.IsCredit ? -amt : amt)) };
        if (k) { J[k] = J[k] || { no: l.Job.Number || '', name: l.Job.Name || '' }; tr.jobs[k] = 1; }
        if (PLC.test(cls)) { var ak = a.UID || a.DisplayID; plNat[ak] = r2((plNat[ak] || 0) + ln.nat); }
        tr.lines.push(ln); L.push(ln); });
      if (!MK.near(MK.sum(tr.lines.map(function (l) { return l.debit; })), MK.sum(tr.lines.map(function (l) { return l.credit; })))) unbal++;
      T.push(tr); });
    T.sort(function (a, b) { return a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
    var keys = Object.keys(J).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }), view = c.view || 'transactions', x = c.display.x || '';
    var sel = J[x] ? [x] : keys, label = function (k) { return (J[k].no ? J[k].no + ' ' : '') + J[k].name; }, cell = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; };
    var dc = function (ls) { return [MK.sum(ls.map(function (l) { return l.debit; })), MK.sum(ls.map(function (l) { return l.credit; }))]; };
    var row = function (l, lead) { return '<tr class="k-row detail-block' + (l.mark ? ' mk-mark' : '') + '">' + lead + '<td>' + h(l.code + ' ' + l.account) + (l.mark ? ' <span class="chip up">job</span>' : '') + '</td><td>' + h(l.memo || l.tr.desc) + '</td>' + cell(l.debit) + cell(l.credit) + '</tr>'; };
    var html, head = '<thead><tr><th>Date</th><th>ID No.</th><th>Source</th><th>Category</th><th>Memo</th><th class="num">Debit ($)</th><th class="num">Credit ($)</th></tr></thead>', X = [];
    var pickJob = '<label class="ctl" style="display:inline-flex;margin:12px 0">Job<select id="jt-x"><option value="">All jobs with activity</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === x ? ' selected' : '') + '>' + h(label(k)) + '</option>'; }).join('') + '</select></label>';
    if (view === 'exceptions') {
      var side = x === 'cash' || x === 'invoice' ? x : '', ex = L.filter(function (l) { return !l.job && PLC.test(l.cls); });
      var S = [['cash', 'Cash transactions — spend money, receive money, pay runs, inventory and general journals', ex.filter(function (l) { return !/^(Sale|Purchase)$/.test(l.tr.jt); })], ['invoice', 'Invoice transactions — sales and purchases', ex.filter(function (l) { return /^(Sale|Purchase)$/.test(l.tr.jt); })]];
      html = MK.kpis([{ label: 'Unassigned lines — cash', value: S[0][2].length, money: false }, { label: 'Unassigned lines — invoices', value: S[1][2].length, money: false }, { label: 'Income with no job', value: MK.sum(ex.filter(function (l) { return /Income/.test(l.cls); }).map(function (l) { return l.nat; })) }, { label: 'Expenses with no job', value: MK.sum(ex.filter(function (l) { return !/Income/.test(l.cls); }).map(function (l) { return l.nat; })) }], c) +
        '<label class="ctl" style="display:inline-flex;margin:12px 0">Show<select id="jt-x"><option value="">Cash and invoice transactions</option><option value="cash"' + (side === 'cash' ? ' selected' : '') + '>Cash transactions</option><option value="invoice"' + (side === 'invoice' ? ' selected' : '') + '>Invoice transactions</option></select></label>' +
        S.filter(function (s) { return !side || s[0] === side; }).map(function (s) { var t = dc(s[2]); X.push([s[1], s[2]]);
          return '<div class="mk-card" style="margin-top:12px"><h3>' + h(s[1]) + ' — ' + s[2].length + ' lines with no job</h3><div class="mk-scroll"><table class="mk-stmt">' + head + '<tbody>' + (s[2].length ? s[2].map(function (l) { return row(l, '<td>' + h(l.tr.date) + '</td><td>' + h(l.tr.id) + '</td><td>' + h(l.tr.type) + '</td>'); }).join('') : '<tr><td colspan="7" class="muted">Every line here is coded to a job.</td></tr>') +
            '</tbody><tfoot><tr class="k-total"><td colspan="5">Total</td>' + cell(t[0]) + cell(t[1]) + '</tr></tfoot></table></div></div>'; }).join('');
    } else {
      var jl = L.filter(function (l) { return l.job && sel.indexOf(l.job) >= 0; }), jt = dc(jl);
      html = MK.kpis([{ label: 'Jobs', value: sel.length, money: false }, { label: 'Transactions', value: T.filter(function (t) { return sel.some(function (k) { return t.jobs[k]; }); }).length, money: false }, { label: 'Job lines — debits', value: jt[0] }, { label: 'Job lines — credits', value: jt[1] }], c) + pickJob +
        (keys.length ? '' : '<p class="muted">No lines in this period are coded to a job in MYOB.</p>') + '<div class="mk-scroll"><table class="mk-stmt">' + head + sel.map(function (k) {
          var mine = jl.filter(function (l) { return l.job === k; }), t = dc(mine), inner;
          if (view === 'activity') { var cats = {}; mine.forEach(function (l) { (cats[l.code + ' ' + l.account] = cats[l.code + ' ' + l.account] || []).push(l); }); X.push([label(k), mine]);
            inner = Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (ck) { var ct = dc(cats[ck]), net = MK.sum(cats[ck].map(function (l) { return l.nat; }));
              return '<tr class="k-header"><td colspan="7" style="padding-left:26px">' + h(ck) + '</td></tr>' + cats[ck].map(function (l) { return row(l, '<td>' + h(l.tr.date) + '</td><td>' + h(l.tr.id) + '</td><td>' + h(l.tr.type) + '</td>'); }).join('') +
                '<tr class="k-total"><td colspan="5">Total for ' + h(ck) + ' · net activity ' + money(net) + '</td>' + cell(ct[0]) + cell(ct[1]) + '</tr>'; }).join(''); }
          else { var trs = T.filter(function (tr) { return tr.jobs[k]; }), all = []; trs.forEach(function (tr) { tr.lines.forEach(function (l) { all.push(Object.assign({}, l, { mark: l.job === k })); }); }); X.push([label(k), all]);
            inner = trs.map(function (tr) { return '<tr class="k-header"><td>' + h(tr.date) + '</td><td>' + h(tr.id) + '</td><td>' + h(tr.type) + '</td><td colspan="4">' + h(tr.desc) + '</td></tr>' + tr.lines.map(function (l) { return row(Object.assign({}, l, { mark: l.job === k }), '<td></td><td></td><td></td>'); }).join(''); }).join(''); }
          return '<tbody><tr class="k-header"><td colspan="7"><strong>' + h(label(k)) + '</strong></td></tr>' + inner + '<tr class="k-total"><td colspan="5">Total for ' + h(label(k)) + ' (the job\'s lines)</td>' + cell(t[0]) + cell(t[1]) + '</tr></tbody>'; }).join('') + '</table></div>';
    }
    body.innerHTML = html;
    document.getElementById('jt-x').addEventListener('change', function () { c.change({}, { x: this.value }); });
    // ties: MYOB's job register (per job, category and whole month in the period) and MYOB's Profit and Loss (per income or expense category)
    var fm = c.fy.month, months = [], y = +from.slice(0, 4), mo = +from.slice(5, 7) + (from.slice(8) > '01' ? 1 : 0), reg = null, pl = null;
    for (; ; mo++) { if (mo > 12) { mo = 1; y++; } if (MK.iso(MK.eom(y, mo)) > to) break; months.push(y + '-' + (mo < 10 ? '0' : '') + mo); }
    if (c.data.register && months.length) {
      var A = {}, add = function (k, s, v) { A[k] = A[k] || [0, 0]; A[k][s] = r2(A[k][s] + v); };
      MK.items(c.data.register).forEach(function (r) { var m = +r.Month, yy = +r.Year - (fm > 1 && m >= fm ? 1 : 0), ym = yy + '-' + (m < 10 ? '0' : '') + m; if (r.Job && months.indexOf(ym) >= 0) add(jk(r.Job) + ' ' + ((r.Account || {}).DisplayID || (r.Account || {}).Name) + ' ' + ym, 0, (MK.num(r.Activity) || 0) + (MK.num(r.YearEndActivity) || 0)); });
      L.forEach(function (l) { if (l.job && months.indexOf(l.tr.date.slice(0, 7)) >= 0) add(l.job + ' ' + (l.code || l.account) + ' ' + l.tr.date.slice(0, 7), 1, l.nat); });
      var bad = Object.keys(A).filter(function (k) { return !MK.near(A[k][0], A[k][1]); });
      reg = { pass: bad.length === 0, detail: bad.length ? bad.length + ' differ, e.g. ' + bad[0] + ': register ' + money(A[bad[0]][0]) + ' vs journals ' + money(A[bad[0]][1]) : Object.keys(A).length + ' job, category and month totals' };
    }
    if (c.data.pnl) { var P = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT).rows.filter(function (r) { return !r.header; }), seen = {};
      var off = P.filter(function (r) { var k = r.uid || r.code; seen[k] = 1; return !MK.near(r.values[0], plNat[k] || 0); }).concat(Object.keys(plNat).filter(function (k) { return !seen[k] && Math.abs(plNat[k]) >= 0.005; }).map(function (k) { return { code: k }; }));
      pl = { pass: off.length === 0, detail: off.length ? off.length + ' differ, e.g. ' + off[0].code : P.length + ' categories' }; }
    this._x = { X: X };
    return { checks: [
      { name: 'MYOB\'s job register = the job-coded journal lines, per job, category and whole month (two MYOB sources)', pass: c.errors.register ? null : reg ? reg.pass : null, detail: c.errors.register ? c.err('register') : reg ? reg.detail : 'N/A — no whole month in the period' },
      { name: 'Income and expense lines in the journals = MYOB\'s Profit and Loss for the period, per category (nothing missing)', pass: c.errors.pnl ? null : pl ? pl.pass : null, detail: c.errors.pnl ? c.err('pnl') : pl ? pl.detail : 'N/A' },
      { name: 'Every journal transaction balances', pass: unbal === 0, detail: unbal ? unbal + ' out of balance' : T.length + ' transactions' }],
      title: { transactions: 'Job Transactions', activity: 'Job Activity', exceptions: 'Job Exceptions' }[view] + (view !== 'exceptions' && J[x] ? ' — ' + label(x) : ''),
      notes: ['MYOB\'s journal transactions dated in the period, read by the job on each line. ' + (view === 'exceptions' ? 'Exceptions are lines on income and expense categories with no job; balancing lines (bank, receivables, payables, GST) never carry a job, so they are not listed. Pay runs are listed with the cash transactions.' : 'A transaction is listed under a job when any of its lines is coded to the job.')],
      na: ['Header jobs and sub-job roll-ups (the connector has no job list)', 'Cash basis (journals are accrual)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Job transactions', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Group', 'Date', 'ID No.', 'Source', 'Category', 'Memo', 'Job', 'Debit ($)', 'Credit ($)'].map(function (t) { return { v: t, s: 'bold' }; })];
    var mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    x.X.forEach(function (g) { g[1].forEach(function (l) { rows.push([g[0], l.tr.date, l.tr.id, l.tr.type, l.code + ' ' + l.account, l.memo || l.tr.desc, l.job, mv(l.debit), mv(l.credit)]); }); });
    return [{ name: 'Job transactions', widths: [28, 12, 12, 14, 28, 30, 10, 14, 14], rows: rows }];
  }
});

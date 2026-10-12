// CRA-03 Sales by Tracking Category (MYOB). MYOB's tracking-category equivalent is Jobs: Income lines in the period's journal
// transactions, grouped by the job coded on each line (a "No job" bucket for lines with none), with each job's share of total
// sales — tied to the period's Income on MYOB's own Profit and Loss (a separate MYOB source).
var CRA = MK.app({
  title: 'MYOB Sales by Job', primary: 'journals', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' },
  uses: { journals: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], pnl: ['from_date', 'to_date', 'company_file'], company_files: [] },
  tools: { journals: 'list_journal_transactions (Income lines coded to a job, in the period)', accounts: 'list_accounts (classifications)', pnl: 'get_profit_and_loss (the period — for the tie)', company_files: 'list_company_files' },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.journals) { body.innerHTML = '<p class="mk-err">' + h(c.err('journals')) + '</p>'; return { checks: [{ name: 'Journal transactions loaded', pass: false, detail: c.err('journals') }] }; }
    if (!c.data.journals) return {};
    var idx = MK.accounts(c.data.accounts), J = {}, noJob = 0;
    MK.items(c.data.journals).forEach(function (t) { var d = MK.isoDate(t.DateOccurred || t.DatePosted); if (d < from || d > to) return; (t.Lines || []).forEach(function (l) {
      var a = l.Account || {}, cls = MK.classOf(a, idx).cls || ''; if (cls !== 'Income') return;
      var amt = Math.abs(MK.num(l.Amount) || 0), nat = r2(l.IsCredit ? amt : -amt), j = l.Job, key = j && (j.UID || j.Number) ? (j.Number || j.UID) : null;
      if (!key) { noJob = r2(noJob + nat); return; } J[key] = J[key] || { key: key, name: (j.Number ? j.Number + ' ' : '') + (j.Name || ''), total: 0 }; J[key].total = r2(J[key].total + nat);
    }); });
    var rows = Object.keys(J).map(function (k) { return J[k]; }).sort(function (a, b) { return b.total - a.total; });
    if (noJob) rows.push({ key: '', name: 'No job', total: noJob });
    var grand = r2(MK.sum(rows.map(function (r) { return r.total; })));
    body.innerHTML = MK.kpis([{ label: 'Total sales', value: grand }, { label: 'Jobs with sales', value: rows.filter(function (r) { return r.key; }).length, money: false }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>Sales by job</h3><div id="sj-bars"></div><div id="sj-grid"></div></div>';
    if (!rows.length) { document.getElementById('sj-grid').innerHTML = '<p class="muted">No income lines in this period.</p>'; }
    else {
      MK.bars(document.getElementById('sj-bars'), { title: 'Sales by job', labels: rows.map(function (r) { return r.name; }), series: [{ name: 'Sales', values: rows.map(function (r) { return r.total; }) }] }, c);
      MK.grid(document.getElementById('sj-grid'), { rows: rows.map(function (r) { return { name: r.name, total: r.total, share: grand ? MK.pct(r.total / grand) : 'N/A' }; }), columns: [{ key: 'name', title: 'Job' }, { key: 'total', title: 'Sales', money: true }, { key: 'share', title: 'Share' }], total: { name: 'Total', total: grand }, empty: 'No income lines.' }, c);
    }
    // ---- tie to MYOB's own Profit and Loss Income total for the period
    var pIncome = null;
    if (c.data.pnl) { var b = MK.breakdown([c.data.pnl], idx, MK.PL_LAYOUT); pIncome = b.totals.Income ? b.totals.Income[0] : null; }
    var checks = [
      { name: 'Jobs + No job add up to total sales', pass: MK.near(MK.sum(rows.map(function (r) { return r.total; })), grand), detail: money(grand) },
      { name: 'Total sales = Income on MYOB\'s own Profit and Loss for the period (a separate MYOB source)', pass: pIncome == null ? null : MK.near(grand, pIncome), detail: pIncome == null ? (c.err('pnl') || 'N/A') : money(grand) + ' vs ' + money(pIncome) },
      { name: 'Every job-coded income line is classified', pass: !c.errors.accounts, detail: c.errors.accounts ? c.err('accounts') : rows.length + ' row(s)' }
    ];
    this._x = { rows: rows, grand: grand };
    return { checks: checks, period: MK.periodLine(from, to),
      notes: ['Sales = Income-classified journal lines in the period, grouped by the MYOB job coded on each line. "No job" is lines with no job. Tied to the Income total of MYOB\'s own Profit and Loss for the same period.'],
      na: ['Header jobs and sub-job roll-ups (the connector has no job list)', 'Cash basis (journals are accrual)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Sales by job', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: Accrual (journals)'], []];
    var rows = head.concat([[{ v: 'Job', s: 'bold' }, { v: 'Sales', s: 'bold' }, { v: 'Share', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, { v: r.total, s: 'money' }, x.grand ? { v: r.total / x.grand, s: 'pct' } : 'N/A']; })).concat([[{ v: 'Total', s: 'bold' }, { v: x.grand, s: 'moneyBold' }]]);
    return [{ name: 'Sales by job', rows: rows, widths: [28, 16, 12] }];
  }
});

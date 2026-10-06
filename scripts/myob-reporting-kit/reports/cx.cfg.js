MK.app({
  title: 'Categories Transactions', primary: 'pnl_period', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', prev_day: '2026-08-31', fy_start: '2026-07-01', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"category"}' },
  uses: { journals: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], pnl_period: ['from_date', 'to_date', 'company_file'], pnl_ytd: ['fy_start', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { journals: 'list_journal_transactions (every journal in the period — every page)', bs_open: 'get_balance_sheet (opening balances: the day before the period)', bs_close: 'get_balance_sheet (closing balances: the period end)', pnl_period: 'get_profit_and_loss_3m (income and expense activity in the period, for the tie)', pnl_ytd: 'get_profit_and_loss_3m (income and expense balances, financial year to the period end)', accounts: 'list_accounts (codes and classification)', company_files: 'list_company_files' },
  views: [['accounts', 'By category'], ['transactions', 'Transactions'], ['journal', 'Journal entries'], ['category', 'Category transactions']],
  derive: function (inp, fyMonth) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)), fy_start: MK.fyStartOf(inp.to_date, fyMonth) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.journals) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('journals')) + '</p>'; return { checks: [{ name: 'Journal transactions loaded', pass: false, detail: c.err('journals') }] }; }
    if (!c.data.journals) return {};
    var idx = MK.accounts(c.data.accounts), DRN = { Asset: 1, Expense: 1, CostOfSales: 1, OtherExpense: 1 }, PLC = /^(Income|CostOfSales|Expense|OtherIncome|OtherExpense)$/;
    var tx = MK.items(c.data.journals).filter(function (t) { return t && t.Lines; }), lines = [], acc = {};
    tx.forEach(function (t) { var d = MK.isoDate(t.DateOccurred || t.DatePosted); (t.Lines || []).forEach(function (l) {
      var a = l.Account || {}, k = a.UID || a.DisplayID || a.Name, amt = Math.abs(MK.num(l.Amount) || 0), cr = !!l.IsCredit, ci = MK.classOf(a, idx);
      if (!acc[k]) acc[k] = { code: a.DisplayID || '', name: a.Name || '', cls: ci.cls, uid: a.UID, dr: 0, cr: 0 };
      if (cr) acc[k].cr = r2(acc[k].cr + amt); else acc[k].dr = r2(acc[k].dr + amt);
      lines.push({ date: d, id: t.DisplayID || '', type: t.JournalType || ((t.SourceTransaction || {}).TransactionType) || '', memo: t.Description || l.LineDescription || '', key: k, code: a.DisplayID || '', account: a.Name || '', debit: cr ? null : r2(amt), credit: cr ? r2(amt) : null }); }); });
    // opening and closing balances from MYOB's own reports: balance-sheet accounts from the Balance Sheet the day before and at the end;
    // income and expense accounts from the P&L — year to date at the end, less this period (MYOB's ledger opens them at the year's start).
    var bsO = c.data.bs_open ? MK.breakdown([c.data.bs_open], idx, MK.BS_LAYOUT) : null, bsC = c.data.bs_close ? MK.breakdown([c.data.bs_close], idx, MK.BS_LAYOUT) : null;
    var plP = c.data.pnl_period ? MK.breakdown([c.data.pnl_period], idx, MK.PL_LAYOUT) : null, plY = c.data.pnl_ytd ? MK.breakdown([c.data.pnl_ytd], idx, MK.PL_LAYOUT) : null;
    var val = function (b, r) { if (!b) return null; var x = b.rows.filter(function (y) { return (r.uid && y.uid === r.uid) || (r.code && y.code === r.code); })[0]; return x ? x.values[0] : 0; };
    var fyStart = c.inputs.fy_start, crossFy = fyStart > from; // income and expense accounts reopen at zero on the financial year's start
    var cye = function (r) { return MK.CYE_RE.test(r.name); }, re = function (r) { return /retained (earnings|profits)/i.test(r.name); };
    var rows = Object.keys(acc).map(function (k) { var r = acc[k], net = DRN[r.cls] ? r2(r.dr - r.cr) : r2(r.cr - r.dr), pl = PLC.test(r.cls || '');
      var open = pl ? (crossFy ? null : (plY && plP ? r2(val(plY, r) - val(plP, r)) : null)) : val(bsO, r), close = pl ? val(plY, r) : val(bsC, r);
      return { code: r.code, name: r.name, cls: r.cls, pl: pl, open: open, dr: r.dr, cr: r.cr, net: net, bal: open == null ? null : r2(open + net), close: close, key: k }; })
      .sort(function (a, b) { return String(a.code).localeCompare(String(b.code), undefined, { numeric: true }); });
    var DR = MK.sum(rows.map(function (r) { return r.dr; })), CR = MK.sum(rows.map(function (r) { return r.cr; }));
    var unbal = tx.filter(function (t) { return !MK.near(MK.sum((t.Lines || []).map(function (l) { return (l.IsCredit ? -1 : 1) * Math.abs(MK.num(l.Amount) || 0); })), 0); });
    var view = c.view || 'accounts', h = MK.h, self = this, TITLES = { accounts: 'General Ledger', transactions: 'General Ledger', journal: 'Journal Entries', category: 'Categories Transactions' };
    body.innerHTML = MK.kpis([{ label: 'Journal transactions', value: tx.length, money: false }, { label: 'Categories with activity', value: rows.length, money: false }, { label: 'Total debits', value: DR }, { label: 'Total credits', value: CR }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + h(view === 'journal' ? 'Journal entries' : view === 'category' ? 'Category transactions' : 'General ledger') + ' — ' + h(MK.periodLine(from, to)) + '</h3><div id="gl-grid"></div></div>';
    var cell = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; }, g = document.getElementById('gl-grid');
    // Journal entries (M09): every transaction as one block — all its lines in entry order, its total, and a flag when it does not balance
    var J = tx.map(function (t) { var ls = (t.Lines || []).map(function (l) { var a = l.Account || {}, amt = r2(Math.abs(MK.num(l.Amount) || 0)); return { code: a.DisplayID || '', account: a.Name || '', memo: l.LineDescription || '', debit: l.IsCredit ? null : amt, credit: l.IsCredit ? amt : null }; });
      var d = MK.sum(ls.map(function (l) { return l.debit; })), k = MK.sum(ls.map(function (l) { return l.credit; }));
      return { date: MK.isoDate(t.DateOccurred || t.DatePosted), id: t.DisplayID || '', type: t.JournalType || ((t.SourceTransaction || {}).TransactionType) || '', desc: t.Description || '', lines: ls, dr: d, cr: k, ok: MK.near(d, k) }; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
    var search = function (id) { var q = document.getElementById(id); q.addEventListener('input', function () { self._q = q.value; var s = q.value.trim().toLowerCase(); g.querySelectorAll('tbody[data-text]').forEach(function (b) { b.hidden = !!s && b.getAttribute('data-text').indexOf(s) < 0; }); }); if (self._q) q.dispatchEvent(new Event('input')); };
    if (view === 'journal') {
      var cap = J.slice(0, 1500);
      g.innerHTML = '<input id="gl-q" type="search" class="mk-filter" placeholder="Search description, ID or category" aria-label="Search journal entries" value="' + h(self._q || '') + '">' + (J.length > cap.length ? '<p class="muted">Showing the first ' + cap.length + ' of ' + J.length + ' transactions — narrow the period to see the rest (Download Excel has them all).</p>' : '') +
        '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Date</th><th>ID No.</th><th>Source</th><th>Category</th><th>Memo</th><th class="num">Debit ($)</th><th class="num">Credit ($)</th></tr></thead>' +
        (cap.length ? cap.map(function (t) { return '<tbody data-text="' + h((t.id + ' ' + t.type + ' ' + t.desc + ' ' + t.lines.map(function (l) { return l.code + ' ' + l.account + ' ' + l.memo; }).join(' ')).toLowerCase()) + '"><tr class="k-header"><td>' + h(t.date) + '</td><td>' + h(t.id) + '</td><td>' + h(t.type) + '</td><td colspan="4">' + h(t.desc) + '</td></tr>' +
          t.lines.map(function (l) { return '<tr class="k-row detail-block"><td></td><td></td><td></td><td>' + h(l.code + ' ' + l.account) + '</td><td>' + h(l.memo) + '</td>' + cell(l.debit) + cell(l.credit) + '</tr>'; }).join('') +
          '<tr class="k-total"><td colspan="5">Total for ' + h(t.id) + (t.ok ? '' : ' <span class="mk-err">— out of balance</span>') + '</td>' + cell(t.dr) + cell(t.cr) + '</tr></tbody>'; }).join('') : '<tbody><tr><td colspan="7" class="muted">No transactions in this period.</td></tr></tbody>') +
        '<tfoot><tr class="k-total"><td colspan="5">Total</td>' + cell(DR) + cell(CR) + '</tr></tfoot></table></div>';
      search('gl-q');
    } else if (view === 'category') {
      // Category transactions (M11): only the lines on the chosen category (display.x = its UID; empty = every category), with MYOB's opening and closing balances
      var sel = c.display.x && rows.some(function (r) { return r.key === c.display.x; }) ? c.display.x : '', show = rows.filter(function (r) { return !sel || r.key === sel; });
      g.innerHTML = '<label class="ctl" style="display:inline-flex;margin-bottom:10px">Category<select id="gl-cat"><option value="">All categories with activity</option>' + rows.map(function (r) { return '<option value="' + h(r.key) + '"' + (r.key === sel ? ' selected' : '') + '>' + h(r.code + ' ' + r.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="mk-scroll"><table class="mk-stmt"><thead><tr><th>Date</th><th>ID No.</th><th>Source</th><th>Memo</th><th class="num">Debit ($)</th><th class="num">Credit ($)</th></tr></thead>' +
        (show.length ? show.map(function (r) { var ls = lines.filter(function (l) { return l.key === r.key; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
          return '<tbody><tr class="k-header"><td colspan="4">' + h(r.code + ' ' + r.name) + '</td><td colspan="2" class="num">Opening ' + (r.open == null ? 'N/A' : money(r.open)) + '</td></tr>' + ls.map(function (l) { return '<tr class="k-row detail-block"><td>' + h(l.date) + '</td><td>' + h(l.id) + '</td><td>' + h(l.type) + '</td><td>' + h(l.memo) + '</td>' + cell(l.debit) + cell(l.credit) + '</tr>'; }).join('') +
            '<tr class="k-total"><td colspan="4">Total for ' + h(r.name) + ' · net activity ' + money(r.net) + ' · closing ' + (r.bal == null ? 'N/A' : money(r.bal)) + (r.close != null && r.bal != null && !MK.near(r.bal, r.close) ? ' <span class="mk-err">(MYOB ' + money(r.close) + ')</span>' : '') + '</td>' + cell(r.dr) + cell(r.cr) + '</tr></tbody>'; }).join('') : '<tbody><tr><td colspan="6" class="muted">No transactions in this period.</td></tr></tbody>') + '</table></div>';
      document.getElementById('gl-cat').addEventListener('change', function () { c.change({}, { x: this.value }); });
    } else if (view === 'transactions') MK.grid(document.getElementById('gl-grid'), { rows: lines.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code), undefined, { numeric: true }) || a.date.localeCompare(b.date); }).slice(0, 3000), filter: true,
      columns: [{ key: 'code', title: 'Code' }, { key: 'account', title: 'Category name' }, { key: 'date', title: 'Date' }, { key: 'id', title: 'ID No.' }, { key: 'type', title: 'Source' }, { key: 'memo', title: 'Memo' }, { key: 'debit', title: 'Debit ($)', money: true }, { key: 'credit', title: 'Credit ($)', money: true }],
      total: { code: 'Total', debit: DR, credit: CR }, empty: 'No transactions in this period.' }, c);
    else MK.grid(document.getElementById('gl-grid'), { rows: rows, filter: true, columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Category name' }, { key: 'open', title: 'Open ($)', money: true }, { key: 'dr', title: 'Debit ($)', money: true }, { key: 'cr', title: 'Credit ($)', money: true }, { key: 'net', title: 'Net activity ($)', money: true }, { key: 'bal', title: 'Balance ($)', money: true }],
      total: { code: 'Total', dr: DR, cr: CR }, empty: 'No transactions in this period.' }, c);
    // ties: balance-sheet accounts — open + activity = the Balance Sheet at the end (Current Year Earnings is the P&L, and Retained
    // Earnings moves at a year-end close without a journal); income and expense accounts — activity = the P&L for the period
    var bsT = rows.filter(function (r) { return !r.pl && !cye(r) && !(crossFy && re(r)) && r.bal != null && r.close != null; }), bsBad = bsT.filter(function (r) { return !MK.near(r.bal, r.close); });
    var plT = rows.filter(function (r) { return r.pl; }), plBad = plP ? plT.filter(function (r) { return !MK.near(r.net, val(plP, r)); }) : null;
    var plMissing = plP ? plP.rows.filter(function (x) { return !x.header && Math.abs(x.values[0]) >= 0.005 && !rows.some(function (r) { return (x.uid && r.key === x.uid) || r.code === x.code; }); }) : [];
    var checks = [
      { name: 'Σ debits = Σ credits, and every journal transaction balances', pass: MK.near(DR, CR) && unbal.length === 0, detail: money(DR) + ' vs ' + money(CR) + (unbal.length ? '; ' + unbal.length + ' transaction(s) out of balance' : '') },
      { name: 'Balance-sheet categories: open + net activity = the closing balance on the Balance Sheet (two MYOB reports)', pass: c.data.bs_open && c.data.bs_close ? bsBad.length === 0 : null, detail: c.data.bs_open && c.data.bs_close ? (bsBad.length ? bsBad.length + ' differ, e.g. ' + bsBad[0].code + ' ' + money(bsBad[0].bal) + ' vs ' + money(bsBad[0].close) : bsT.length + ' categories') : (c.err('bs_open') || c.err('bs_close') || 'N/A') },
      { name: 'Income and expense categories: net activity = the Profit and Loss for the period (a separate MYOB report)', pass: plBad == null ? null : plBad.length === 0 && plMissing.length === 0, detail: plBad == null ? (c.err('pnl_period') || 'N/A') : plBad.length || plMissing.length ? (plBad.length + plMissing.length) + ' differ, e.g. ' + ((plBad[0] || plMissing[0]).code) : plT.length + ' categories' }
    ];
    this._x = { rows: rows, lines: lines, J: J, DR: DR, CR: CR };
    return { checks: checks, title: TITLES[view], notes: ['Journal transactions dated in the period (MYOB\'s general ledger), grouped by category. Open and closing balances come from MYOB\'s Balance Sheet (balance-sheet categories) and Profit and Loss (income and expense categories, from the start of the financial year).' + (crossFy ? ' The period spans a financial-year start, so income and expense categories show no opening balance.' : '')],
      na: ['Tax amount per line (not in the journal list)', 'Cash-basis ledger (journals are accrual)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (n) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: n, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; }, mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; };
    var a = head('General ledger').concat([['Code', 'Category name', 'Open ($)', 'Debit ($)', 'Credit ($)', 'Net activity ($)', 'Balance ($)'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.rows.map(function (r) { return [r.code, r.name, mv(r.open), mv(r.dr), mv(r.cr), mv(r.net), mv(r.bal)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', { v: x.DR, s: 'moneyBold' }, { v: x.CR, s: 'moneyBold' }]]);
    var t = head('Transactions').concat([['Code', 'Category name', 'Date', 'ID No.', 'Source', 'Memo', 'Debit ($)', 'Credit ($)'].map(function (h) { return { v: h, s: 'bold' }; })]).concat(x.lines.map(function (l) { return [l.code, l.account, l.date, l.id, l.type, l.memo, mv(l.debit), mv(l.credit)]; }));
    var j = head('Journal entries').concat([['Date', 'ID No.', 'Source', 'Description', 'Code', 'Category', 'Memo', 'Debit ($)', 'Credit ($)'].map(function (h) { return { v: h, s: 'bold' }; })]);
    x.J.forEach(function (tr) { tr.lines.forEach(function (l) { j.push([tr.date, tr.id, tr.type, tr.desc, l.code, l.account, l.memo, mv(l.debit), mv(l.credit)]); }); });
    return [{ name: 'General ledger', rows: a, widths: [10, 34, 16, 16, 16, 16, 16] }, { name: 'Transactions', rows: t, widths: [10, 30, 12, 12, 14, 30, 14, 14] }, { name: 'Journal entries', rows: j, widths: [12, 12, 14, 30, 10, 28, 28, 14, 14] }];
  }
});

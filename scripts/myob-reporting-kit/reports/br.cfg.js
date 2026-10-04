// Bank Reconciliation Status (M17). MYOB has no reconciliation report in its API, but it puts the last reconciled date on each
// account (LastReconciledDate) and the reconciliation date on each journal line (ReconciledDate; null = not reconciled). So per bank
// and credit card account: last reconciled, unreconciled deposits / withdrawals as at the date, the reconciled (statement) balance.
MK.app({
  title: 'Bank Reconciliation Status', primary: 'accounts', files: 'company_files', kind: 'asat',
  inputs: { asAt: 'as_at', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', since_date: '2025-07-01', prev_day: '2025-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"status"}' },
  uses: { accounts: ['company_file'], journals: ['since_date', 'as_at', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['as_at', 'company_file'], company_files: [] },
  tools: { accounts: 'list_accounts (bank and credit card accounts, last reconciled date)', journals: 'list_journal_transactions (reconciliation date on each line)', bs_open: 'get_balance_sheet (the day before the look-back)', bs_close: 'get_balance_sheet (the date)', company_files: 'list_company_files' },
  views: [['status', 'Reconciliation status'], ['items', 'Unreconciled transactions']],
  // unreconciled items are looked for from the start of last financial year
  derive: function (inp, fyMonth) { var fy = MK.fyStartOf(inp.as_at, fyMonth || 7), from = (+fy.slice(0, 4) - 1) + fy.slice(4); return { since_date: from, prev_day: MK.iso(MK.addDays(MK.parse(from), -1)) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, asAt = c.inputs.as_at, from = c.inputs.since_date;
    var need = ['accounts', 'journals', 'bs_close'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Accounts, journals and the Balance Sheet loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.accounts || !c.data.journals || !c.data.bs_close) return {};
    var days = function (a, b) { return Math.round((MK.parse(b) - MK.parse(a)) / 86400000); };
    var banks = MK.items(c.data.accounts).filter(function (a) { return a && !a.IsHeader && /^(Bank|CreditCard)$/.test(a.Type || '') && a.IsActive !== false; });
    var bsVal = function (rep, a) { var r = (rep && rep.AccountsBreakdown || []).filter(function (x) { return x.Account && (x.Account.UID === a.UID || x.Account.DisplayID === a.DisplayID); })[0]; return r ? MK.num(r.AccountTotal) || 0 : 0; };
    var rows = banks.map(function (a) {
      var card = a.Type === 'CreditCard', sign = function (l) { return (l.IsCredit ? -1 : 1) * (card ? -1 : 1) * (MK.num(l.Amount) || 0); }, move = 0, un = [];
      MK.items(c.data.journals).forEach(function (j) { var d = String(j.DateOccurred || '').slice(0, 10); if (d > asAt) return; (j.Lines || []).forEach(function (l) { if (!l.Account || l.Account.UID !== a.UID) return; move += sign(l);
        var rd = l.ReconciledDate ? String(l.ReconciledDate).slice(0, 10) : null; if (!rd || rd > asAt) un.push({ date: d, account: (a.DisplayID ? a.DisplayID + ' ' : '') + a.Name, uid: a.UID, desc: j.Description || (j.SourceTransaction || {}).TransactionType || '', type: j.JournalType || '', dr: l.IsCredit ? null : MK.num(l.Amount), cr: l.IsCredit ? MK.num(l.Amount) : null, effect: sign(l), age: days(d, asAt) }); }); });
      var last = a.LastReconciledDate ? String(a.LastReconciledDate).slice(0, 10) : null, since = last ? days(last, asAt) : null;
      var open = c.data.bs_open ? bsVal(c.data.bs_open, a) : null, close = bsVal(c.data.bs_close, a), unNet = MK.sum(un.map(function (x) { return x.effect; }));
      return { uid: a.UID, code: a.DisplayID, name: a.Name, card: card, last: last, since: since, status: !last ? 'Never reconciled' : since <= 31 ? 'Up to date' : 'Overdue', open: open, move: r2(move), close: close,
        dep: MK.sum(un.filter(function (x) { return x.dr; }).map(function (x) { return x.dr; })), wd: MK.sum(un.filter(function (x) { return x.cr; }).map(function (x) { return x.cr; })), unCount: un.length, unNet: unNet, recBal: r2(close - unNet),
        oldest: un.length ? un.map(function (x) { return x.date; }).sort()[0] : null, items: un };
    });
    var items = [].concat.apply([], rows.map(function (r) { return r.items; })).sort(function (x, y) { return x.date.localeCompare(y.date); });
    var overdue = rows.filter(function (r) { return r.status !== 'Up to date'; }), old = items.filter(function (x) { return x.age > 60; });
    var view = c.view || 'status';
    body.innerHTML = MK.kpis([{ label: 'Bank and card accounts', text: String(rows.length) }, { label: 'Unreconciled transactions', text: String(items.length) }, { label: 'Not reconciled for 31+ days', text: String(overdue.length) }, { label: 'Older than 60 days', text: String(old.length) }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'items' ? 'Unreconciled transactions' : 'Reconciliation status') + ' — ' + MK.h(MK.asOfLine(asAt).replace(/^As at /, 'as at ')) + '</h3><div id="br-grid"></div><p class="muted">Unreconciled transactions are looked for from ' + MK.h(MK.periodLine(from, from).replace(/ - .*$/, '')) + ' (the start of last financial year).</p></div>';
    var chip = function (s) { return s === 'Up to date' ? 'up' : 'down'; };
    if (view === 'items') MK.grid(document.getElementById('br-grid'), { rows: items.map(function (x) { return { date: x.date, account: x.account, desc: x.desc, type: x.type, dr: x.dr, cr: x.cr, age: x.age }; }), filter: true, empty: 'No unreconciled transactions.',
      columns: [{ key: 'date', title: 'Date' }, { key: 'account', title: 'Account' }, { key: 'desc', title: 'Description' }, { key: 'type', title: 'Journal' }, { key: 'dr', title: 'Deposit (debit)', money: true }, { key: 'cr', title: 'Withdrawal (credit)', money: true }, { key: 'age', title: 'Days old', num: true }] }, c);
    else MK.grid(document.getElementById('br-grid'), { rows: rows.map(function (r) { return { acct: (r.code ? r.code + ' ' : '') + r.name, last: r.last || 'Never', since: r.since, status: r.status, close: r.close, dep: r.dep, wd: r.wd, recBal: r.recBal, oldest: r.oldest || '' }; }), empty: 'No bank or credit card accounts in the chart of accounts.',
      columns: [{ key: 'acct', title: 'Account' }, { key: 'last', title: 'Last reconciled' }, { key: 'since', title: 'Days since', num: true }, { key: 'status', title: 'Status', fmt: function (s) { return '<span class="chip ' + chip(s) + '">' + MK.h(s) + '</span>'; }, html: true }, { key: 'close', title: 'Balance in MYOB', money: true },
        { key: 'dep', title: 'Unreconciled deposits', money: true }, { key: 'wd', title: 'Unreconciled withdrawals', money: true }, { key: 'recBal', title: 'Reconciled balance', money: true }, { key: 'oldest', title: 'Oldest unreconciled' }] }, c);
    var tieBad = rows.filter(function (r) { return r.open != null && !MK.near(r.close, r2(r.open + r.move)); });
    var checks = [
      !c.data.bs_open ? { name: 'Each account: balance = opening balance + its journal movement (information)', pass: null, info: true, detail: c.errors.bs_open ? 'Opening Balance Sheet unavailable (' + c.err('bs_open') + ')' : 'N/A' }
        : { name: 'Each account: balance at the date = balance the day before the look-back + its journal movement (two Balance Sheets vs the journals)', pass: rows.length ? !tieBad.length : null, detail: tieBad.length ? 'Differs: ' + tieBad.map(function (r) { return r.name + ' (' + money(r.open) + ' + ' + money(r.move) + ' vs ' + money(r.close) + ')'; }).join(', ') : rows.length + ' account(s)' },
      { name: 'There is at least one bank or credit card account (chart of accounts)', pass: rows.length > 0, detail: rows.length + ' account(s)' },
      { name: 'Reconciled balance = balance in MYOB − unreconciled transactions (each account)', pass: rows.length ? rows.every(function (r) { return MK.near(r.recBal, r2(r.close - r.unNet)); }) : null, detail: rows.map(function (r) { return r.name + ' ' + money(r.recBal); }).join('; ') },
      { name: 'Accounts not reconciled in the last 31 days (information)', pass: null, info: true, detail: overdue.length ? overdue.map(function (r) { return r.name + ' — ' + (r.last ? 'last ' + r.last + ', ' + r.since + ' days' : 'never reconciled'); }).join('; ') : 'none' },
      { name: 'Unreconciled transactions older than 60 days (information)', pass: null, info: true, detail: old.length ? old.length + ' item(s), ' + money(MK.sum(old.map(function (x) { return Math.abs(x.effect); }))) + ' — oldest ' + old[0].date : 'none' }
    ];
    this._x = { rows: rows, items: items };
    return { checks: checks, title: view === 'items' ? 'Unreconciled transactions' : 'Bank Reconciliation Status',
      notes: ['From MYOB’s last reconciled date on each account and the reconciliation date on each journal line; a line reconciled after the as-at date counts as unreconciled at that date.', 'Reconciled balance = MYOB’s balance less the unreconciled transactions — what the bank statement should show at the date.'],
      na: ['Bank statement balance and statement lines (the bank feed is not compared here — see Bank transactions)', 'Unreconciled transactions dated before the look-back start'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? '' : { v: v, s: 'money' }; }, head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], []]; };
    var st = head('Bank reconciliation status').concat([['Account', 'Last reconciled', 'Days since', 'Status', 'Balance in MYOB', 'Unreconciled deposits', 'Unreconciled withdrawals', 'Reconciled balance', 'Oldest unreconciled'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.rows.map(function (r) { return [(r.code ? r.code + ' ' : '') + r.name, r.last || 'Never', r.since == null ? '' : r.since, r.status, mv(r.close), mv(r.dep), mv(r.wd), mv(r.recBal), r.oldest || '']; }));
    var it = head('Unreconciled transactions').concat([['Date', 'Account', 'Description', 'Journal', 'Deposit (debit)', 'Withdrawal (credit)', 'Days old'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.items.map(function (i) { return [i.date, i.account, i.desc, i.type, mv(i.dr), mv(i.cr), i.age]; }));
    return [{ name: 'Status', rows: st, widths: [34, 14, 10, 16, 16, 18, 18, 18, 16] }, { name: 'Unreconciled', rows: it, widths: [12, 30, 34, 14, 16, 18, 10] }];
  }
});

XK.app({
  title: 'Trial Balance', primary: 'tb', dated: ['tb', 'tb_cash'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', basis: 'basis', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"tb"}' },
  uses: { tb: ['as_at', 'org'], tb_cash: ['as_at', 'org'], bs_tie: ['as_at', 'org'], org: ['org'], connections: [] },
  tools: { tb: 'get_trial_balance', tb_cash: 'get_trial_balance (cash basis)', bs_tie: 'get_balance_sheet (Current Year Earnings at the same date — tie)', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash', r2 = function (v) { return Math.round(v * 100) / 100; };
    var id = cash ? 'tb_cash' : 'tb';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Trial Balance loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var w = XK.walk(c.data[id]), cols = w.columns || [];
    // Debit / Credit column pairs, read from the Header row by label (Debit | Credit | YTD Debit | YTD Credit in Xero's layout).
    var deb = [], cre = []; cols.forEach(function (h, i) { var s = String(h || '').toLowerCase(); if (/debit/.test(s)) deb.push(i); else if (/credit/.test(s)) cre.push(i); });
    var pairs = deb.map(function (d, k) { return cre[k] == null ? null : { d: d, c: cre[k], ytd: /ytd|year/i.test(cols[d]) }; }).filter(Boolean), main = pairs.filter(function (p) { return !p.ytd; })[0] || pairs[0], ytd = pairs.filter(function (p) { return p.ytd; })[0] || main;
    var rows = w.lines.filter(function (l) { return l.kind === 'row'; }), colSum = function (i) { return XK.sum(rows.map(function (l) { return l.values[i]; })); };
    var grand = XK.find(w.lines, null, /^total$/i, 'total');
    var kp = main ? [{ label: 'Total Debits', value: colSum(main.d) }, { label: 'Total Credits', value: colSum(main.c) }] : [];
    kp.push({ label: 'Accounts', text: String(rows.length) });
    body.innerHTML = XK.kpis(kp, c) + '<div class="xk-scroll">' + XK.statement(w.lines, [''].concat(cols.length ? cols : ['Value']), c, []) + '</div>';
    // Checks: debits = credits (each pair); Xero's grand Total = Σ the accounts; section ties; and the independent tie —
    // Revenue − Expenses (year to date) = Current Year Earnings on a separate Balance Sheet call for the same date.
    var ties = XK.linesTies(w.lines), net = function (re, p) { var s = w.sections.filter(function (x) { return re.test(x.title); }); return s.length ? XK.sum([].concat.apply([], s.map(function (x) { return x.rows; })).map(function (l) { return (l.values[p.c] || 0) - (l.values[p.d] || 0); })) : null; };
    var revN = ytd ? net(/revenue|income/i, ytd) : null, expN = ytd ? net(/expense|cost/i, ytd) : null, plNet = revN == null || expN == null ? null : r2(revN + expN);
    var bsW = c.data.bs_tie ? XK.walk(c.data.bs_tie) : null, bsCye = bsW ? (function () { var l = XK.currentYearEarnings(bsW.lines); return l ? XK.val(l) : null; })() : null;
    var checks = [
      { name: 'Total Debits = Total Credits', pass: main ? pairs.every(function (p) { return XK.near(colSum(p.d), colSum(p.c)); }) : null, detail: main ? pairs.map(function (p) { return cols[p.d] + ' ' + money(colSum(p.d)) + ' = ' + cols[p.c] + ' ' + money(colSum(p.c)); }).join(' · ') : 'Xero returned column(s) ' + (cols.join(', ') || '(none)') + ' instead of separate Debit / Credit columns' },
      { name: 'Xero\'s Total row = Σ the accounts', pass: grand && main ? pairs.every(function (p) { return XK.near(grand.values[p.d], colSum(p.d)) && XK.near(grand.values[p.c], colSum(p.c)); }) : null, detail: grand ? rows.length + ' accounts' : 'No Total row in this Trial Balance' },
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.checked ? (ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections') : 'Xero sends no section totals on the Trial Balance' },
      cash ? { name: 'Revenue − Expenses vs Current Year Earnings (information)', pass: null, info: true, detail: 'The tie is checked on the accrual basis' }
        : { name: 'Revenue − Expenses (' + (ytd && ytd.ytd ? 'YTD columns' : 'Debit / Credit') + ') = Current Year Earnings on the Balance Sheet at ' + c.inputs.as_at, pass: c.errors.bs_tie || plNet == null || bsCye == null ? null : XK.near(plNet, bsCye), detail: c.errors.bs_tie ? c.err('bs_tie') : plNet == null ? 'No Revenue / Expenses sections found' : bsCye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(plNet) + ' vs ' + money(bsCye) }
    ];
    var notes = [];
    if (!main) notes.push('This call returned column(s) ' + (cols.join(', ') || '(none)') + ' rather than separate Debit / Credit columns — shown as Xero returned it; the Debit = Credit check is N/A rather than guessed.');
    if (cash) notes.push('Cash basis: Xero\'s Trial Balance with payments only (paymentsOnly = true).');
    this._lines = w.lines; this._cols = [''].concat(cols.length ? cols : ['Value']);
    return { checks: checks, notes: notes, na: ['Comparison and tracking columns (get_trial_balance has no periods or tracking parameter)'], title: 'Trial Balance' };
  },
  excel: function (c) {
    var lines = this._lines || [], titles = this._cols || ['', 'Value'];
    return [XK.sheetFromLines('Trial Balance', c.company, XK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values }; }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), titles.slice(1).map(function () { return 'money'; }))];
  }
});

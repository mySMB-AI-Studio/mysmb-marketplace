XK.app({
  title: 'General Ledger', basisLabel: 'Accrual', primary: 'pnl', dated: ['pnl'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', offset: 0, org: '',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"journals","o":"acc="}' },
  uses: { journals: ['from_date', 'org'], pnl: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  // The journal feed has no date filter: it starts at the first journal ever created. Find the period by creation date (with three
  // months' room for documents raised ahead of their date), then read every later journal — back-dated ones included.
  paged: { journals: { input: 'offset', key: 'Journals', max: 20, cursor: function (last) { var j = (last && last.Journals) || []; return j.length ? j[j.length - 1].JournalNumber : 0; },
    seek: { label: 'the period in the Xero journal feed', target: function (i) { return XK.addDaysIso(i.from_date, -92); }, dateOf: function (j) { return XK.isoDate(j.CreatedDateUTC || j.JournalDate); } } } },
  tools: { journals: 'list_journals (the journal feed — every posted transaction)', pnl: 'get_profit_and_loss (the same dates, for the tie)', org: 'get_organisation', connections: 'list_connections' },
  views: [['journals', 'Journals'], ['accounts', 'Account summary']],
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date;
    if (c.errors.journals) {
      var e = c.err('journals'), scope = /\b(401|403)\b|unauthori[sz]ed|forbidden|scope/i.test(e);
      body.innerHTML = '<p class="xk-err">' + (scope ? 'The General Ledger is not available on this Xero connection: it needs the journals permission (scope), which this connection was not granted. Reconnect Xero (Settings → Connections) to grant it, or use the Trial Balance and Profit and Loss meanwhile.' : XK.h(e)) + '</p>';
      return { checks: [{ name: 'Journal feed loaded', pass: false, detail: scope ? 'Not authorised — the journals scope is not granted (' + e + ')' : e }] };
    }
    if (!c.data.journals) return {};
    var SRC = { ACCREC: 'Receivable invoice', ACCPAY: 'Payable invoice', ACCRECCREDIT: 'Receivable credit note', ACCPAYCREDIT: 'Payable credit note', ACCRECPAYMENT: 'Receivable payment', ACCPAYPAYMENT: 'Payable payment', ARCREDITPAYMENT: 'Receivable credit note refund', APCREDITPAYMENT: 'Payable credit note refund', CASHREC: 'Receive money', CASHPAID: 'Spend money', TRANSFER: 'Bank transfer', ARPREPAYMENT: 'Receivable prepayment', APPREPAYMENT: 'Payable prepayment', AROVERPAYMENT: 'Receivable overpayment', APOVERPAYMENT: 'Payable overpayment', EXPCLAIM: 'Expense claim', EXPPAYMENT: 'Expense claim payment', MANJOURNAL: 'Manual journal', PAYSLIP: 'Payslip', WAGEPAYABLE: 'Wages payable', CONVERSION: 'Conversion balance', FIXEDASSET: 'Fixed asset' };
    var all = c.rows('journals').filter(function (j) { return j && j.JournalLines; }), jr = all.filter(function (j) { var d = XK.isoDate(j.JournalDate); return d >= from && d <= to; });
    jr.sort(function (a, b) { return XK.isoDate(a.JournalDate).localeCompare(XK.isoDate(b.JournalDate)) || a.JournalNumber - b.JournalNumber; });
    var lines = [], accs = {};
    jr.forEach(function (j) { var d = XK.isoDate(j.JournalDate); (j.JournalLines || []).forEach(function (l) { var v = XK.num(l.NetAmount) || 0, k = l.AccountCode || l.AccountID; accs[k] = accs[k] || { code: l.AccountCode || '', name: l.AccountName || '', type: l.AccountType || '', id: l.AccountID, dr: 0, cr: 0 };
      accs[k].dr = r2(accs[k].dr + (v > 0 ? v : 0)); accs[k].cr = r2(accs[k].cr + (v < 0 ? -v : 0));
      lines.push({ date: d, no: j.JournalNumber, src: SRC[j.SourceType] || j.SourceType || '', ref: j.Reference || '', acct: (l.AccountCode ? l.AccountCode + ' · ' : '') + (l.AccountName || ''), key: k, desc: l.Description || '', debit: v > 0 ? r2(v) : null, credit: v < 0 ? r2(-v) : null, net: r2(v) }); }); });
    var accList = Object.keys(accs).map(function (k) { var a = accs[k]; return { key: k, code: a.code, name: a.name, type: a.type, dr: a.dr, cr: a.cr, net: r2(a.dr - a.cr) }; }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code)) || a.name.localeCompare(b.name); });
    var accSel = c.opt('acc') || '', view = c.view || 'journals', shown = accSel ? lines.filter(function (l) { return l.key === accSel; }) : lines, run = 0;
    if (accSel) shown.forEach(function (l) { run = r2(run + l.net); l.running = run; });
    var LIMIT = 2000, cut = shown.length > LIMIT;
    var DR = XK.sum(lines.map(function (l) { return l.debit; })), CR = XK.sum(lines.map(function (l) { return l.credit; }));
    body.innerHTML = XK.kpis([{ label: 'Journals in the period', value: jr.length, money: false }, { label: 'Journal lines', value: lines.length, money: false }, { label: 'Total debits', value: DR }, { label: 'Total credits', value: CR }], c) +
      '<div class="xk-card" style="margin-top:16px"><h3>' + (view === 'accounts' ? 'Account summary — movement in the period' : accSel ? 'Journal lines for ' + XK.h((accs[accSel] || {}).code ? accs[accSel].code + ' · ' + accs[accSel].name : accSel) + ' — with running total (filtered)' : 'Journals — oldest first') + '</h3>' +
      '<label class="muted no-print">Account <select id="gl-acc"><option value="">All accounts</option>' + accList.map(function (a) { return '<option value="' + XK.h(a.key) + '"' + (a.key === accSel ? ' selected' : '') + '>' + XK.h((a.code ? a.code + ' · ' : '') + a.name) + '</option>'; }).join('') + '</select></label>' +
      (cut && view !== 'accounts' ? '<p class="muted">Showing the first ' + LIMIT + ' of ' + shown.length + ' lines — choose an account, or use Download Excel for every line.</p>' : '') + '<div id="gl-grid"></div></div>';
    if (view === 'accounts') XK.grid(document.getElementById('gl-grid'), { rows: accList, filter: true, columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Account' }, { key: 'type', title: 'Type' }, { key: 'dr', title: 'Debits', money: true }, { key: 'cr', title: 'Credits', money: true }, { key: 'net', title: 'Net movement', money: true }],
      total: { code: 'Total', dr: DR, cr: CR, net: r2(DR - CR) }, empty: 'No journals in this period.' }, c);
    else XK.grid(document.getElementById('gl-grid'), { rows: shown.slice(0, LIMIT).map(function (l) { return Object.assign({}, l, { sdate: XK.shortDate(l.date) }); }), filter: true,
      columns: [{ key: 'sdate', title: 'Date' }, { key: 'no', title: 'Journal #', num: true }, { key: 'src', title: 'Source' }, { key: 'ref', title: 'Reference' }, { key: 'acct', title: 'Account' }, { key: 'desc', title: 'Description' }, { key: 'debit', title: 'Debit', money: true }, { key: 'credit', title: 'Credit', money: true }].concat(accSel ? [{ key: 'running', title: 'Running total', money: true }] : []),
      total: { sdate: accSel ? 'Total (filtered)' : 'Total', debit: XK.sum(shown.map(function (l) { return l.debit; })), credit: XK.sum(shown.map(function (l) { return l.credit; })) }, empty: 'No journals in this period.' }, c);
    var sel = document.getElementById('gl-acc'); if (sel) sel.addEventListener('change', function () { c.setOpt('acc', this.value); });
    // checks
    var unbal = jr.filter(function (j) { return !XK.near(XK.sum((j.JournalLines || []).map(function (l) { return XK.num(l.NetAmount) || 0; })), 0); });
    var trunc = c.truncated('journals'), w = c.data.pnl ? XK.walk(c.data.pnl) : null, plOf = {}, diffs = [];
    if (w) w.lines.filter(function (l) { return l.kind === 'row' && l.id; }).forEach(function (l) { plOf[l.id] = (plOf[l.id] || 0) + (l.values[0] || 0); });
    var plTypes = /^(REVENUE|SALES|OTHERINCOME|DIRECTCOSTS|EXPENSE|OVERHEADS|DEPRECIATN)$/;
    if (w) { var seen = {}; accList.filter(function (a) { return plTypes.test(a.type); }).forEach(function (a) { var j = /^(REVENUE|SALES|OTHERINCOME)$/.test(a.type) ? -a.net : a.net, p = plOf[accs[a.key].id] || 0; seen[accs[a.key].id] = 1; if (!XK.near(j, p)) diffs.push((a.code || a.name) + ' ' + money(j) + ' vs ' + money(p)); });
      Object.keys(plOf).forEach(function (id) { if (!seen[id] && !XK.near(plOf[id], 0)) diffs.push('an account with ' + money(plOf[id]) + ' on the Profit and Loss and no journal'); }); }
    var npJ = r2(-XK.sum(accList.filter(function (a) { return plTypes.test(a.type); }).map(function (a) { return a.net; }))), plp = w ? XK.plParts(w) : null;
    var checks = [
      { name: 'Every journal balances (debits = credits)', pass: unbal.length === 0, detail: unbal.length ? unbal.length + ' journal(s) out of balance, e.g. #' + unbal[0].JournalNumber : jr.length + ' journal(s)' },
      { name: 'Total debits = total credits for the period', pass: XK.near(DR, CR), detail: money(DR) + ' vs ' + money(CR) },
      trunc || !w ? { name: 'Income and expense movement = the Profit and Loss for the same dates', pass: null, detail: trunc ? 'N/A — the journal feed was cut short (the page limit was reached), so the period may be incomplete' : (c.err('pnl') || 'N/A') }
        : { name: 'Income and expense movement = the Profit and Loss for the same dates (a separate Xero report), account by account', pass: diffs.length === 0, detail: diffs.length ? diffs.length + ' account(s) differ: ' + diffs.slice(0, 3).join('; ') : 'Net profit ' + money(npJ) + (plp ? ' vs ' + money(plp.np) : '') },
      { name: 'All journals for the period loaded', pass: trunc ? false : true, detail: trunc ? 'Cut at ' + all.length + ' journals (the page limit) — the period may be incomplete; narrow the dates' : all.length + ' journal(s) read' + (c.seekFrom('journals') ? ' from journal #' + (c.seekFrom('journals') + 1) : ' from the start of the feed') }
    ];
    this._x = { lines: lines, accList: accList, DR: DR, CR: CR };
    return { checks: checks, notes: ['Every posted transaction in Xero is a journal: invoices, bills, credit notes, payments, spend / receive money, transfers and manual journals. Journals dated in the period are shown, including ones entered later with an earlier date.', 'Debits positive, credits shown in their own column; a journal\'s lines always add to zero.'],
      na: ['Cash-basis journals (this ledger is accrual)', 'Tracking options on journal lines (not in the journal feed)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = function (name) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []]; };
    var j = head('General Ledger').concat([['Date', 'Journal #', 'Source', 'Reference', 'Account', 'Description', 'Debit', 'Credit'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.lines.map(function (l) { return [l.date, l.no, l.src, l.ref, l.acct, l.desc, l.debit == null ? '' : { v: l.debit, s: 'money' }, l.credit == null ? '' : { v: l.credit, s: 'money' }]; }))
      .concat([[{ v: 'Total', s: 'bold' }, '', '', '', '', '', { v: x.DR, s: 'moneyBold' }, { v: x.CR, s: 'moneyBold' }]]);
    var a = head('Account summary').concat([['Code', 'Account', 'Type', 'Debits', 'Credits', 'Net movement'].map(function (t) { return { v: t, s: 'bold' }; })])
      .concat(x.accList.map(function (r) { return [r.code, r.name, r.type, { v: r.dr, s: 'money' }, { v: r.cr, s: 'money' }, { v: r.net, s: 'money' }]; }));
    return [{ name: 'General Ledger', rows: j, widths: [12, 10, 22, 16, 34, 34, 14, 14] }, { name: 'Account summary', rows: a, widths: [10, 34, 14, 16, 16, 16] }];
  }
});

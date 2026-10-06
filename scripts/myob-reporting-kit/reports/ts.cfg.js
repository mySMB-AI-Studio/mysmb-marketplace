// Supplier Transactions (M37): every bill, credit note and payment in the period, per supplier, with a running net change.
// Bills − payments must equal the movement of Accounts Payable on the Balance Sheet (two dates). mk-payables.js derives
// Supplier Transactions (M45) from this config — write supplier / bill wording only where the supplier side should differ.
MK.app({
  title: 'Supplier Transactions', primary: 'bills', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-09-01', to_date: '2026-09-28', prev_day: '2026-08-31', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_month","a":"custom","c":"none","v":"suppliers","x":""}' },
  uses: { bills: ['from_date', 'to_date', 'company_file'], payments: ['from_date', 'to_date', 'company_file'], bs_open: ['prev_day', 'company_file'], bs_close: ['to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bills: 'list_bills (every status, dated in the period — every page)', payments: 'list_supplier_payments (dated in the period — one page of up to 1,000)', bs_open: 'get_balance_sheet (the day before the period)', bs_close: 'get_balance_sheet (the period end)', accounts: 'list_accounts (the Accounts Payable account)', company_files: 'list_company_files' },
  views: [['suppliers', 'By supplier'], ['list', 'All transactions']],
  derive: function (inp) { return { prev_day: MK.iso(MK.addDays(MK.parse(inp.from_date), -1)) }; },
  render: function (c) {
    var body = c.body, h = MK.h, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.bills) { body.innerHTML = '<p class="mk-err">' + h(c.err('bills')) + '</p>'; return { checks: [{ name: 'Bills loaded', pass: false, detail: c.err('bills') }] }; }
    if (!c.data.bills) return {};
    var T = [], who = {}, add = function (x) { var p = x.Supplier || {}, k = p.UID || p.Name || '?'; who[k] = who[k] || p.Name || p.DisplayID || 'N/A'; return k; };
    MK.items(c.data.bills).forEach(function (x) { var a = r2(MK.num(x.TotalAmount) || 0), k = add(x); T.push({ date: MK.isoDate(x.Date), type: a < 0 ? 'Credit note' : 'Bill', no: x.Number || '', key: k, memo: x.Status || '', charge: a >= 0 ? a : null, paid: a < 0 ? -a : null }); });
    var pays = c.errors.payments ? [] : MK.items(c.data.payments), cut = pays.length >= 1000;
    pays.forEach(function (x) { var a = r2(MK.num(x.AmountPaid != null ? x.AmountPaid : x.Amount) || 0), k = add(x); T.push({ date: MK.isoDate(x.Date), type: 'Payment', no: x.ReceiptNumber || x.PaymentNumber || x.Number || '', key: k, memo: x.Memo || '', charge: null, paid: a }); });
    T.sort(function (a, b) { return a.date.localeCompare(b.date) || String(a.no).localeCompare(String(b.no), undefined, { numeric: true }); });
    var keys = Object.keys(who).sort(function (a, b) { return who[a].localeCompare(who[b]); }), sel = c.display.x && who[c.display.x] ? c.display.x : '', shown = T.filter(function (t) { return !sel || t.key === sel; });
    var C = MK.sum(shown.map(function (t) { return t.charge; })), P = MK.sum(shown.map(function (t) { return t.paid; })), view = c.view || 'suppliers';
    var cell = function (v) { return '<td class="num">' + (v == null ? '' : money(v)) + '</td>'; }, head = '<thead><tr><th>Date</th><th>Type</th><th>No.</th><th>Memo</th><th class="num">Charges ($)</th><th class="num">Payments ($)</th><th class="num">Net ($)</th></tr></thead>';
    var html = MK.kpis([{ label: 'Bills', value: MK.sum(shown.filter(function (t) { return t.type === 'Bill'; }).map(function (t) { return t.charge; })) }, { label: 'Credit notes', value: MK.sum(shown.map(function (t) { return t.type === 'Credit note' ? t.paid : null; })) },
      { label: 'Payments', value: MK.sum(shown.map(function (t) { return t.type === 'Payment' ? t.paid : null; })) }, { label: 'Net change', value: r2(C - P) }, { label: 'Suppliers', money: false, value: Object.keys(shown.reduce(function (o, t) { o[t.key] = 1; return o; }, {})).length }], c) +
      (cut ? '<div class="mk-banner fail" style="margin-top:12px">MYOB returned 1,000 payments — one page — so some may be missing. Choose a shorter period.</div>' : '') +
      '<label class="ctl" style="display:inline-flex;margin:12px 0">Supplier<select id="tr-who"><option value="">All suppliers</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (k === sel ? ' selected' : '') + '>' + h(who[k]) + '</option>'; }).join('') + '</select></label>';
    var t = '';
    if (view === 'list') { var run = 0; t = shown.map(function (x) { run = r2(run + (x.charge || 0) - (x.paid || 0)); return '<tr class="k-row"><td>' + h(x.date) + '</td><td>' + h(x.type) + '</td><td>' + h(x.no) + '</td><td>' + h(who[x.key] + (x.memo ? ' · ' + x.memo : '')) + '</td>' + cell(x.charge) + cell(x.paid) + cell(run) + '</tr>'; }).join(''); }
    else keys.filter(function (k) { return !sel || k === sel; }).forEach(function (k) { var rows = shown.filter(function (x) { return x.key === k; }); if (!rows.length) return; var run = 0;
      t += '<tr class="k-header"><td colspan="7">' + h(who[k]) + '</td></tr>' + rows.map(function (x) { run = r2(run + (x.charge || 0) - (x.paid || 0)); return '<tr class="k-row detail-block"><td style="padding-left:26px">' + h(x.date) + '</td><td>' + h(x.type) + '</td><td>' + h(x.no) + '</td><td>' + h(x.memo) + '</td>' + cell(x.charge) + cell(x.paid) + cell(run) + '</tr>'; }).join('') +
        '<tr class="k-total"><td colspan="4">Total for ' + h(who[k]) + '</td>' + cell(MK.sum(rows.map(function (x) { return x.charge; }))) + cell(MK.sum(rows.map(function (x) { return x.paid; }))) + cell(run) + '</tr>'; });
    html += '<div class="mk-scroll"><table class="mk-stmt">' + head + '<tbody>' + (t || '<tr><td colspan="7" class="muted">No transactions in this period.</td></tr>') + '</tbody><tfoot><tr class="k-total"><td colspan="4">Total</td>' + cell(C) + cell(P) + cell(r2(C - P)) + '</tr></tfoot></table></div>';
    body.innerHTML = html;
    document.getElementById('tr-who').addEventListener('change', function () { c.change({}, { x: this.value }); });
    // independent tie: the Accounts Payable account(s) on the Balance Sheet the day before and at the end
    var idx = MK.accounts(c.data.accounts), isAr = function (a) { return a && (a.Type === 'AccountsPayable' || (!a.Type && /payable|creditors/i.test(a.Name || ''))); };
    var ar = idx.list.filter(function (a) { return !a.IsHeader && isAr(a); }), bsv = function (rep) { var v = 0; ((rep || {}).AccountsBreakdown || []).forEach(function (r) { var a = r.Account || {}; if (ar.some(function (x) { return (a.UID && x.UID === a.UID) || (a.DisplayID && x.DisplayID === a.DisplayID); })) v += MK.num(r.AccountTotal) || 0; }); return r2(v); };
    var all = MK.sum(T.map(function (x) { return x.charge; })) - MK.sum(T.map(function (x) { return x.paid; })), move = c.data.bs_open && c.data.bs_close ? r2(bsv(c.data.bs_close) - bsv(c.data.bs_open)) : null, noName = T.filter(function (x) { return x.key === '?'; }).length;
    var tie = c.errors.payments ? { pass: false, detail: c.err('payments') } : cut ? { pass: null, detail: 'N/A — payments may be cut off at 1,000' } : !ar.length ? { pass: null, detail: c.err('accounts') || 'N/A — no Accounts Payable account in the chart' } : move == null ? { pass: null, detail: c.err('bs_open') || c.err('bs_close') || 'N/A' } :
      { pass: MK.near(r2(all), move), detail: money(r2(all)) + ' vs ' + money(move) + (MK.near(r2(all), move) ? '' : ' — discounts, write-offs or journals to the account are not in these lists') };
    this._x = { T: T, who: who };
    return { checks: [
      { name: 'Bills − payments = the movement of Accounts Payable on the Balance Sheet (two MYOB reports)', pass: tie.pass, detail: tie.detail },
      { name: 'Every transaction names a supplier', pass: T.length ? noName === 0 : null, detail: noName ? noName + ' without one' : T.length + ' transactions' },
      { name: 'All payments in the period were loaded', pass: c.errors.payments ? false : cut ? null : true, detail: c.errors.payments ? c.err('payments') : cut ? 'N/A — MYOB returned 1,000 (one page)' : pays.length + ' payments' }],
      title: sel ? 'Supplier Transactions — ' + who[sel] : 'Supplier Transactions',
      notes: ['Bills, credit notes and payments dated in the period. Net is the change over the period (from zero at its start), not the outstanding balance.'],
      na: ['Credit applications, refunds and adjustments (not in the connector — credit notes show as negative bills)', 'Opening balance per supplier (the period\'s transactions only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Transactions', widths: [12, 12, 14, 34, 30, 16, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Supplier Transactions', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Date', 'Type', 'No.', 'Supplier', 'Memo', 'Charges ($)', 'Payments ($)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.T.map(function (t) { return [t.date, t.type, t.no, x.who[t.key], t.memo, t.charge == null ? '' : { v: t.charge, s: 'money' }, t.paid == null ? '' : { v: t.paid, s: 'money' }]; })) }];
  }
});

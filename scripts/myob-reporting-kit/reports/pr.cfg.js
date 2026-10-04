MK.app({
  title: 'Payables Reconciliation', primary: 'bs', files: 'company_files',
  // no as-at control: MYOB's API gives today's open balances, so the reconciliation is always as at today
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":"recon"}' },
  uses: { bills: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { bills: 'list_bills (open purchase bills — every page)', bs: 'get_balance_sheet (the payables account today)', accounts: 'list_accounts (which accounts are payables)', company_files: 'list_company_files' },
  roll: function () { return { as_at: MK.asAt('today') }; },
  views: [['recon', 'Reconciliation with tax'], ['exceptions', 'Reconciliation exceptions']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, asAt = c.inputs.as_at;
    if (c.errors.bills) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('bills')) + '</p>'; return { checks: [{ name: 'Open bills loaded', pass: false, detail: c.err('bills') }] }; }
    if (!c.data.bills) return {};
    var inv = MK.items(c.data.bills).filter(function (i) { return i && (MK.num(i.BalanceDueAmount) || 0) !== 0; }).map(function (i) {
      var cu = i.Supplier || {}, bal = MK.num(i.BalanceDueAmount) || 0, tot = MK.num(i.TotalAmount) || 0, tax = MK.num(i.TotalTax) || 0;
      return { number: i.Number || '', date: MK.isoDate(i.Date), supplier: cu.Name || '(no supplier)', cid: cu.UID || cu.Name || '', balance: r2(bal), tax: tot ? r2(bal * tax / tot) : 0, total: tot, taxFull: tax, sub: MK.num(i.Subtotal), freight: MK.num(i.Freight) || 0, incl: !!i.IsTaxInclusive }; });
    var byC = {}; inv.forEach(function (x) { if (!byC[x.cid]) byC[x.cid] = { name: x.supplier, amount: 0, tax: 0, docs: [] }; var y = byC[x.cid]; y.amount = r2(y.amount + x.balance); y.tax = r2(y.tax + x.tax); y.docs.push(x); });
    var cust = Object.keys(byC).map(function (k) { return byC[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var total = MK.sum(cust.map(function (x) { return x.amount; })), taxTot = MK.sum(cust.map(function (x) { return x.tax; }));
    var idx = MK.accounts(c.data.accounts), bsB = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null;
    var arRows = bsB ? bsB.rows.filter(function (r) { return !r.header && (r.type === 'AccountsPayable' || (!idx.loaded && /payable|creditors/i.test(r.name))); }) : [], control = arRows.length ? MK.sum(arRows.map(function (r) { return r.values[0]; })) : null;
    var oob = control == null ? null : r2(total - control), ok = oob != null && MK.near(oob, 0);
    var tie = '<table class="mk-grid" style="margin-top:12px"><tbody><tr class="k-total"><td>Total outstanding</td><td class="num">' + money(total) + '</td></tr><tr class="k-total"><td>Payables account' + (arRows.length ? ' (' + MK.h(arRows.map(function (r) { return (r.code ? r.code + ' ' : '') + r.name; }).join(', ')) + ')' : '') + '</td><td class="num">' + (control == null ? 'N/A — not in source' : money(control)) + '</td></tr>' +
      '<tr class="k-total"><td>Out of balance amount</td><td class="num' + (oob != null && !ok ? ' neg' : '') + '">' + (oob == null ? 'N/A' : money(oob)) + '</td></tr></tbody></table><p><span class="chip ' + (ok ? 'up' : 'down') + '">' + (oob == null ? 'Not checked' : ok ? 'In balance' : 'Out of balance') + '</span></p>';
    var view = c.view || 'recon';
    body.innerHTML = MK.kpis([{ label: 'Total outstanding', value: total }, { label: 'Tax outstanding', value: taxTot }, { label: 'Payables account', value: control }, { label: 'Out of balance', value: oob }], c) +
      '<div class="mk-card" style="margin-top:16px"><h3>' + (view === 'exceptions' ? 'Payables reconciliation exceptions' : 'Payables reconciliation with tax') + ' — ' + MK.asOfLine(asAt).replace(/^As at /, '') + '</h3>' + (view === 'exceptions' ? tie + (ok ? '<p class="muted">No exceptions: the suppliers\' outstanding bills equal the payables account.</p>' : oob == null ? '' : '<p class="muted">Possible causes (not checked): a general journal or bank transaction posted straight to the payables account; a supplier payment or debit not applied to a bill; a bill dated after today.</p>') : '<div id="rr-grid"></div>' + tie) + '</div>';
    if (view !== 'exceptions') MK.grid(document.getElementById('rr-grid'), { rows: cust, filter: true, columns: [{ key: 'name', title: 'Name' }, { key: 'amount', title: 'Amount outstanding ($)', money: true }, { key: 'tax', title: 'Tax outstanding ($)', money: true }], total: { name: 'Total', amount: total, tax: taxTot }, empty: 'No outstanding bills.' }, c);
    // a tax-inclusive document's Subtotal (and Freight) already include the tax: subtotal + freight = total; otherwise + tax as well.
    // Live QA, 4 Oct 2026: 9 tax-inclusive bills failed the tax-exclusive sum (Payables Reconciliation, mySMB.com)
    var expect = function (x) { return r2(x.sub + x.freight + (x.incl ? 0 : x.taxFull)); };
    var taxDocs = inv.filter(function (x) { return x.total && x.sub != null && !MK.near(expect(x), x.total); });
    var taxEg = taxDocs.length ? taxDocs[0].number + ' (' + (taxDocs[0].incl ? 'tax inclusive: ' : '') + money(taxDocs[0].sub) + (taxDocs[0].freight ? ' + freight ' + money(taxDocs[0].freight) : '') + (taxDocs[0].incl ? '' : ' + tax ' + money(taxDocs[0].taxFull)) + ' = ' + money(expect(taxDocs[0])) + ' vs total ' + money(taxDocs[0].total) + ')' : '';
    var checks = [
      control == null ? { name: 'Total outstanding − payables account = out of balance (0.00 expected)', pass: null, detail: c.err('bs') || 'N/A — no payables account found in the chart of accounts' }
        : { name: 'Total outstanding − payables account = out of balance (0.00 expected; the Balance Sheet is a separate MYOB report)', pass: ok, detail: money(total) + ' − ' + money(control) + ' = ' + money(oob) },
      { name: 'Tax outstanding = Σ the bills\' tax, pro rata to what is still owed', pass: MK.near(taxTot, MK.sum(inv.map(function (x) { return x.tax; }))), detail: money(taxTot) + ' on ' + inv.length + ' bill(s)' },
      { name: 'Each bill: subtotal + freight + tax = total (tax inclusive: subtotal + freight = total)', pass: taxDocs.length === 0, detail: taxDocs.length ? taxDocs.length + ' bill(s) differ, e.g. ' + taxEg : inv.length + ' bill(s)' }
    ];
    this._x = { cust: cust, total: total, taxTot: taxTot, control: control, oob: oob };
    return { checks: checks, notes: ['Open purchase bills with their balance due today, by supplier; tax outstanding is each bill\'s tax in proportion to what is still owed. The payables account is every account of type Accounts Payable on the Balance Sheet today.'],
      na: ['A reconciliation as at an earlier date (MYOB\'s API gives today\'s open balances)'], period: MK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; };
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Payables reconciliation with tax', s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], [], ['Name', 'Amount outstanding ($)', 'Tax outstanding ($)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.cust.map(function (r) { return [r.name, mv(r.amount), mv(r.tax)]; }))
      .concat([[{ v: 'Total', s: 'bold' }, { v: x.total, s: 'moneyBold' }, { v: x.taxTot, s: 'moneyBold' }], [{ v: 'Payables account', s: 'bold' }, mv(x.control)], [{ v: 'Out of balance amount', s: 'bold' }, mv(x.oob)]]);
    return [{ name: 'Payables reconciliation', rows: rows, widths: [36, 22, 20] }];
  }
});

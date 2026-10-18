/* @include shared/live-checks.js */
/* @include shared/live-views.js */
// Live checks on MYOB (CRA-02 / 08 / 09 / 10): one set of bindings for all four views, the company file's own records turned
// into the neutral ledger the shared rules read, and the kit wiring. Each report's config sets LCV = { view, title } and
// includes its view and this file. Every field read here is one the myob-accounting connector returns (myhub-mcp-servers
// src/integrations/myob-accounting, api/methods.ts):
// - documents dated in the period come from the line lists (list_invoice_lines / list_bill_lines: number, date, status, card,
//   tax-inclusive flag, and each line's total, tax code and account), because the invoice and bill lists carry no lines;
// - the headers of every open invoice and bill, whatever its date (list_invoices / list_bills, status Open), add the total
//   tax, the balance due, the due date and the delivery status, and feed the receivables and payables measures;
// - a line's GST is its tax code's share of the line (MYOB returns no tax per line); where the header's TotalTax differs from
//   the lines' share, the lines carry the header's tax pro rata, so CHK-059 sees the difference;
// - ABNs come from the supplier cards (list_suppliers); the generic contact list has none;
// - reconciliation comes from the journal lines on bank and credit card accounts (ReconciledDate, null = not reconciled),
//   as the MYOB Bank Reconciliation report reads it.
// Not in MYOB's API, so N/A: attachments, draft invoices, the lock period and whether the business is registered for GST.
MK.app({
  title: LCV.title, primary: 'inv_lines', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { contacts: ['company_file'], suppliers: ['company_file'], open_inv: ['company_file'], open_bills: ['company_file'], inv_lines: ['from_date', 'to_date', 'company_file'], bill_lines: ['from_date', 'to_date', 'company_file'],
    spend: ['from_date', 'to_date', 'company_file'], journals: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], tax_codes: ['company_file'], pnl: ['from_date', 'to_date', 'company_file'], company_files: [] },
  optional: ['contacts', 'suppliers', 'journals', 'pnl'],
  tools: { contacts: 'list_contacts (customer and supplier cards)', suppliers: 'list_suppliers (ABNs)', open_inv: 'list_invoices (open, any date)', open_bills: 'list_bills (open, any date)', inv_lines: 'list_invoice_lines (invoices dated in the period, every status)',
    bill_lines: 'list_bill_lines (bills dated in the period, every status)', spend: 'list_spend_money (in the period)', journals: 'list_journal_transactions (in the period: bank reconciliation)', accounts: 'list_accounts (balances, default tax codes)', tax_codes: 'list_tax_codes (rates)',
    pnl: 'get_profit_and_loss_3m (the period, accrual)', company_files: 'list_company_files' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['inv_lines', 'bill_lines', 'open_inv', 'open_bills', 'spend', 'accounts', 'tax_codes'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; this._x = null; return { checks: [{ name: 'Ledger sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.inv_lines) return {};
    var r2 = function (v) { return Math.round((+v || 0) * 100) / 100; }, digits = function (s) { return String(s || '').replace(/\D/g, ''); }, ok = function (id) { return c.data[id] && !c.errors[id]; };
    var ST = { Open: 'authorised', Closed: 'paid', Credit: 'authorised' };
    var rates = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t.Code) rates[t.Code] = MK.num(t.Rate) || 0; });
    var acct = MK.items(c.data.accounts).filter(function (a) { return a && !a.IsHeader && a.IsActive !== false; });
    var PL = { Income: 1, CostOfSales: 1, Expense: 1, OtherIncome: 1, OtherExpense: 1 };
    var accounts = acct.map(function (a) { var b = MK.num(a.CurrentBalance); return { id: a.UID, code: a.DisplayID || '', name: a.Name || '', type: a.Type || '', pl: !!PL[a.Classification], taxCode: (a.TaxCode || {}).Code || '', balance: b == null ? null : b }; });
    var accKey = function (a) { a = a || {}; return a.DisplayID || a.UID || ''; };
    // A line's GST = its tax code's share of the line total (inclusive or not); amount = the line excluding GST.
    var line = function (l, inc, amountField) {
      var code = (l.TaxCode || {}).Code || '', rate = rates[code] || 0, t = MK.num(l[amountField]) || 0, tax = inc ? t * rate / (100 + rate) : t * rate / 100;
      return { account: accKey(l.Account), taxCode: code, amount: r2(t - (inc ? tax : 0)), tax: r2(tax) };
    };
    // Where the header's TotalTax isn't the lines' share, spread the header's tax over the taxed lines pro rata.
    var useHeaderTax = function (lines, total) {
      var share = lines.reduce(function (s, x) { return s + x.tax; }, 0);
      if (total == null || share <= 0 || Math.abs(total - share) <= Math.max(0.05, share * 0.02)) return;
      lines.forEach(function (x) { x.tax = r2(x.tax * total / share); });
    };
    var heads = {}, sentKnown = false;
    var head = function (x, kind) {
      var ds = x.InvoiceDeliveryStatus, sent = ds === 'Nothing' ? true : ds === 'Print' || ds === 'Email' || ds === 'PrintAndEmail' ? false : null;
      if (kind === 'invoice' && sent !== null) sentKnown = true;
      var ct = x.Customer || x.Supplier || {};
      heads[x.UID] = { id: x.UID, kind: x.Status === 'Credit' ? kind + '_credit' : kind, number: x.Number || '', contactId: ct.UID || '', contact: ct.Name || '', date: MK.isoDate(x.Date) || '', due: MK.isoDate((x.Terms || {}).DueDate) || '',
        status: ST[x.Status] || 'authorised', total: r2(x.TotalAmount), tax: r2(x.TotalTax), dueAmount: r2(x.BalanceDueAmount), sent: kind === 'invoice' ? sent : null, attachments: null, link: '', lines: [] };
    };
    MK.items(c.data.open_inv).forEach(function (x) { head(x, 'invoice'); });
    MK.items(c.data.open_bills).forEach(function (x) { head(x, 'bill'); });
    // Documents dated in the period, from their lines; the header (when the document is still open) adds what lines don't carry.
    var byDoc = {}, order = [];
    var fromLines = function (resp, kind, who) {
      MK.items(resp).forEach(function (l) {
        var id = l.DocumentUID; if (!id) return;
        var d = byDoc[id];
        if (!d) { var ct = l[who] || {}; d = byDoc[id] = { id: id, kind: l.Status === 'Credit' ? kind + '_credit' : kind, number: l.Number || '', contactId: ct.UID || '', contact: ct.Name || '', date: MK.isoDate(l.Date) || '', due: '', status: ST[l.Status] || 'authorised', total: 0, tax: 0, dueAmount: 0, sent: null, attachments: null, link: '', lines: [], inc: !!l.IsTaxInclusive }; order.push(id); }
        d.lines.push(line(l, d.inc, 'Total'));
      });
    };
    fromLines(c.data.inv_lines, 'invoice', 'Customer');
    fromLines(c.data.bill_lines, 'bill', 'Supplier');
    var docs = order.map(function (id) {
      var d = byDoc[id], hd = heads[id]; delete d.inc;
      if (hd) { useHeaderTax(d.lines, hd.tax); d.total = hd.total; d.due = hd.due; d.dueAmount = hd.dueAmount; d.sent = hd.sent; }
      d.tax = r2(d.lines.reduce(function (s, x) { return s + x.tax; }, 0));
      if (!hd) d.total = r2(d.lines.reduce(function (s, x) { return s + x.amount + x.tax; }, 0));
      return d;
    });
    var open = Object.keys(heads).map(function (k) { return heads[k]; });
    // Spend money: the payment's own total and tax, its card and memo.
    var bank = MK.items(c.data.spend).map(function (t) {
      var ct = t.Contact || {}, inc = !!t.IsTaxInclusive, lines = (t.Lines || []).map(function (l) { return line(l, inc, 'Amount'); });
      useHeaderTax(lines, MK.num(t.TotalTax));
      return { id: t.UID, kind: 'spend', contactId: ct.UID || '', contact: ct.Name || '', date: MK.isoDate(t.Date) || '', total: r2(t.AmountPaid), tax: r2(t.TotalTax), reconciled: null, attachments: null, desc: t.Memo || '', link: '', lines: lines };
    });
    // Bank reconciliation: each journal in the period that touches a bank or credit card account, reconciled when every such line
    // carries a ReconciledDate. Only reconciliation reads these (kind "other" is never a purchase or a sale).
    var bankAcc = {}; acct.forEach(function (a) { if (a.Type === 'Bank' || a.Type === 'CreditCard') bankAcc[a.UID] = 1; });
    var recon = ok('journals') ? MK.items(c.data.journals).map(function (j) {
      var bl = (j.Lines || []).filter(function (l) { return l.Account && bankAcc[l.Account.UID]; }); if (!bl.length) return null;
      return { id: 'j-' + j.UID, kind: 'other', contactId: '', contact: '', date: MK.isoDate(j.DateOccurred || j.DatePosted) || '', total: r2(bl.reduce(function (s, l) { return s + (l.IsCredit ? -1 : 1) * Math.abs(MK.num(l.Amount) || 0); }, 0)), tax: 0,
        reconciled: bl.every(function (l) { return !!l.ReconciledDate; }), attachments: null, desc: j.Description || j.DisplayID || '', link: '', lines: [] };
    }).filter(Boolean) : [];
    // Cards: suppliers carry the ABN; a customer card with the same name as a supplier card is the same business (MYOB needs one
    // card per role), so it is left out of the duplicate-contact check.
    var abn = {}; MK.items(c.data.suppliers).forEach(function (s) { abn[s.UID] = digits(s.ABN); });
    var cards = MK.items(c.data.contacts).filter(function (x) { return (x.Type === 'Customer' || x.Type === 'Supplier') && x.IsActive !== false; }).map(function (x) {
      return { id: x.UID, type: x.Type, name: x.CompanyName || [x.FirstName, x.LastName].filter(Boolean).join(' '), abn: abn[x.UID] || '', link: '',
        address: Array.isArray(x.Addresses) ? x.Addresses.some(function (a) { return String(a.Street || a.City || '').trim(); }) : null };
    });
    var supNames = {}; cards.forEach(function (x) { if (x.type === 'Supplier') supNames[LC.norm(x.name)] = 1; });
    var contacts = cards.filter(function (x) { return x.type === 'Supplier' || !supNames[LC.norm(x.name)]; });
    var na = {
      'CHK-021': 'MYOB\'s API doesn\'t say whether a spend money transaction has an attachment',
      'CHK-086': 'MYOB\'s API doesn\'t say whether a bill has an attachment',
      'CHK-033': 'MYOB has no draft or awaiting-approval sales invoices (unfinished sales are quotes or orders)',
      'CHK-031': 'MYOB\'s API doesn\'t say whether the business is registered for GST',
      'CHK-136': 'MYOB\'s API doesn\'t say whether the business is registered for GST',
      'CHK-134': 'MYOB\'s API doesn\'t return the company file\'s lock period'
    };
    if (!sentKnown) na['CHK-024'] = 'MYOB didn\'t return the open invoices\' delivery status (to be printed or emailed), so an unsent invoice can\'t be told apart';
    if (!ok('contacts')) na['CHK-006'] = 'the contact cards could not be loaded: ' + (c.err('contacts') || 'no response');
    if (!ok('suppliers')) { na['CHK-007'] = na['CHK-008'] = 'the supplier cards (ABNs) could not be loaded: ' + (c.err('suppliers') || 'no response'); }
    if (!ok('journals')) na['CHK-022'] = 'the journal transactions (reconciliation dates) could not be loaded: ' + (c.err('journals') || 'no response');
    var L = { platform: 'MYOB', today: c.today || LC.today(), from: from, to: to, org: { name: c.company || '', gst: null, lock: null },
      // Open documents from before the period only reach CHK-087's bill match: every other rule reads the period.
      contacts: contacts, docs: docs.concat(open.filter(function (d) { return !byDoc[d.id]; })), bank: bank.concat(recon), accounts: accounts, rates: rates, income12: null, na: na };
    var r = LC.run(L);
    var P = ok('pnl') ? MK.breakdown([c.data.pnl], MK.accounts(c.data.accounts), MK.PL_LAYOUT) : null;
    var tot = function (k) { return P && P.totals[k] ? P.totals[k][0] || 0 : 0; };
    var bankBal = to >= L.today ? r2(acct.filter(function (a) { return a.Type === 'Bank'; }).reduce(function (s, a) { return s + (MK.num(a.CurrentBalance) || 0); }, 0)) : null;
    var owing = function (kind, overdue) { return r2(open.filter(function (d) { return d.kind === kind && d.dueAmount > 0 && d.date <= to && (!overdue || (d.due && d.due < to)); }).reduce(function (s, d) { return s + d.dueAmount; }, 0)); };
    var latest = ''; docs.concat(bank, recon).forEach(function (x) { if (x.date && x.date <= to && x.date > latest) latest = x.date; });
    var fin = { income: P ? r2(tot('Income') + tot('OtherIncome')) : null, expenses: P ? r2(tot('CostOfSales') + tot('Expense') + tot('OtherExpense')) : null, net: P ? r2(P.calc.NetProfit[0]) : null, bank: bankBal,
      ar: owing('invoice'), arOverdue: owing('invoice', true), ap: owing('bill'), apOverdue: owing('bill', true), docs: docs.length, bankTx: bank.length, latest: latest };
    var ui = { p: 'mk', h: h, money: function (v) { return MK.money(v, c.currency, c.display); }, kpis: function (list) { return MK.kpis(list, c); } };
    var v = LV.view(LCV.view, ui, r, fin);
    body.innerHTML = v.html;
    var trunc = [['inv_lines', 'invoice lines'], ['bill_lines', 'bill lines']].filter(function (x) { return (c.data[x[0]] || {}).Truncated; }).map(function (x) { return x[1]; });
    if (ok('contacts') && MK.items(c.data.contacts).length >= 1000) trunc.push('contact cards (first 1,000)');
    var layoutErr = [['inv_lines', 'Invoices'], ['bill_lines', 'Bills']].map(function (x) { var e = (c.data[x[0]] || {}).Errors; return e && Object.keys(e).length ? x[1] + ' — ' + Object.keys(e).map(function (k) { return k + ': ' + e[k]; }).join('; ') : ''; }).filter(Boolean);
    var opt = ['contacts', 'suppliers', 'journals', 'pnl'].filter(function (id) { return c.errors[id]; });
    this._x = v;
    return { checks: v.checks.concat([
        { name: 'All records in the period loaded', pass: !trunc.length, detail: trunc.length ? 'May be truncated: ' + trunc.join(', ') + ' — shorten the period' : docs.length + ' document(s), ' + bank.length + ' spend money, ' + recon.length + ' bank journal(s), ' + contacts.length + ' card(s)' },
        { name: 'Every invoice and bill layout read', pass: layoutErr.length ? null : true, info: !!layoutErr.length, detail: layoutErr.length ? 'Not read (the file may not use them): ' + layoutErr.join(' · ') : 'Item, service, professional, time billing and miscellaneous' },
        { name: 'Cards, reconciliation dates and profit and loss loaded', pass: opt.length ? null : true, info: !!opt.length, detail: opt.length ? 'Not loaded: ' + opt.map(function (id) { return c.err(id); }).join('; ') + ' — the checks that need them read N/A' : 'Contact and supplier cards, journal transactions and profit and loss' },
        { name: 'Bank balance', pass: null, info: true, detail: bankBal == null ? 'N/A for a period ending before today: MYOB returns each bank account\'s current balance only' : 'Current balance of the bank accounts (list_accounts)' }
      ]), period: MK.periodLine(from, to), notes: v.notes, na: v.na };
  },
  excel: function (c) {
    var v = this._x; if (!v) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: LV.NAMES[LCV.view], s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: N/A (checks on the ledger, not a $ statement)'], []];
    return v.sheets.map(function (s, i) { return { name: s.name, rows: i ? s.rows : head.concat(s.rows), widths: s.widths }; });
  }
});

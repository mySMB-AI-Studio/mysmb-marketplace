/* @include shared/live-checks.js */
/* @include shared/live-views.js */
// Live checks on Xero (CRA-02 / 08 / 09 / 10): one set of bindings for all four views, Xero's own records turned into the
// neutral ledger the shared rules read (the same mapping as the checks engine's xero.py: xero_doc, xero_bank_txn,
// xero_contact, xero_balances), and the kit wiring. Each report's config sets LCV = { view, title } and includes this file.
XK.app({
  title: LCV.title, noBasis: true, primary: 'invoices', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', date_where: 'Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,25)', from12: '2025-09-26', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { contacts: ['org'], invoices: ['date_where', 'org'], open_inv: ['org'], bank_tx: ['date_where', 'org'], accounts: ['org'], tax_rates: ['org'], tb: ['to_date', 'org'], pnl: ['from_date', 'to_date', 'org'], pnl12: ['from12', 'to_date', 'org'], bank: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  paged: { contacts: { input: 'page', key: 'Contacts' }, invoices: { input: 'page', key: 'Invoices' }, open_inv: { input: 'page', key: 'Invoices' }, bank_tx: { input: 'page', key: 'BankTransactions' } },
  derive: function (inp) { return { date_where: XK.dateWhere('Date', inp.from_date, inp.to_date), from12: LC.addDays((+inp.to_date.slice(0, 4) - 1) + inp.to_date.slice(4), 1) }; },
  tools: { contacts: 'list_contacts (active)', invoices: 'list_invoices (sales and bills dated in the period, with lines)', open_inv: 'list_invoices (approved and still owing, any date)', bank_tx: 'list_bank_transactions (in the period)', accounts: 'list_accounts', tax_rates: 'list_tax_rates', tb: 'get_trial_balance (period end)', pnl: 'get_profit_and_loss (the period)', pnl12: 'get_profit_and_loss (12 months to the period end)', bank: 'get_bank_summary (the period)', org: 'get_organisation', connections: 'list_connections' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy_td', 'This financial year to date'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['contacts', 'invoices', 'open_inv', 'bank_tx', 'accounts', 'tax_rates'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Ledger sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices) return {};
    var ST = { DRAFT: 'draft', SUBMITTED: 'submitted', AUTHORISED: 'authorised', PAID: 'paid', VOIDED: 'void', DELETED: 'void' };
    var r2 = function (v) { return Math.round((+v || 0) * 100) / 100; }, digits = function (s) { return String(s || '').replace(/\D/g, ''); };
    var lines = function (x) { var inc = x.LineAmountTypes === 'Inclusive'; return (x.LineItems || []).map(function (li) { var amt = +li.LineAmount || 0, tax = +li.TaxAmount || 0; return { account: String(li.AccountCode || ''), taxCode: String(li.TaxType || ''), amount: r2(inc ? amt - tax : amt), tax: r2(tax) }; }); };
    var doc = function (x) {
      var ct = x.Contact || {}, sale = x.Type === 'ACCREC';
      return { id: String(x.InvoiceID || ''), kind: sale ? 'invoice' : x.Type === 'ACCPAY' ? 'bill' : '', number: x.InvoiceNumber || '', contactId: String(ct.ContactID || ''), contact: ct.Name || '',
        date: XK.isoDate(x.DateString || x.Date) || '', due: XK.isoDate(x.DueDateString || x.DueDate) || '', status: ST[x.Status] || 'draft', total: r2(x.Total), tax: r2(x.TotalTax), dueAmount: r2(x.AmountDue),
        sent: x.SentToContact === true ? true : x.SentToContact === false ? false : null, attachments: !!x.HasAttachments, lines: lines(x),
        link: 'https://go.xero.com/' + (sale ? 'AccountsReceivable' : 'AccountsPayable') + '/View.aspx?InvoiceID=' + x.InvoiceID };
    };
    var docs = c.rows('invoices').map(doc), open = c.rows('open_inv').map(doc), seen = {};
    docs.forEach(function (d) { seen[d.id] = 1; });
    var bank = c.rows('bank_tx').map(function (t) {
      var ct = t.Contact || {}, li = (t.LineItems || [])[0] || {};
      return { id: String(t.BankTransactionID || ''), kind: { SPEND: 'spend', RECEIVE: 'receive' }[t.Type] || 'other', contactId: String(ct.ContactID || ''), contact: ct.Name || '',
        date: XK.isoDate(t.DateString || t.Date) || '', total: r2(t.Total), tax: r2(t.TotalTax), reconciled: !!t.IsReconciled, attachments: !!t.HasAttachments,
        desc: t.Reference || li.Description || '', lines: lines(t), link: 'https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=' + t.BankTransactionID };
    });
    var contacts = c.rows('contacts').map(function (x) {
      return { id: String(x.ContactID || ''), name: x.Name || '', abn: digits(x.TaxNumber), link: 'https://go.xero.com/Contacts/View/' + x.ContactID,
        address: Array.isArray(x.Addresses) ? x.Addresses.some(function (a) { return String(a.AddressLine1 || a.City || '').trim(); }) : null };
    });
    var bal = {};
    if (c.data.tb && !c.errors.tb) XK.walk(c.data.tb).lines.forEach(function (l) { if (l.kind === 'row' && l.id) bal[l.id] = r2((l.values[2] || 0) - (l.values[3] || 0)); });
    var accounts = ((c.data.accounts || {}).Accounts || []).filter(function (a) { return a.Status !== 'ARCHIVED'; }).map(function (a) {
      return { id: a.AccountID, code: a.Code || '', name: a.Name || '', type: a.Type || '', pl: a.Class === 'REVENUE' || a.Class === 'EXPENSE', taxCode: a.TaxType || '', balance: c.data.tb && !c.errors.tb ? (bal[a.AccountID] || 0) : null };
    });
    var rates = {}; ((c.data.tax_rates || {}).TaxRates || []).forEach(function (t) { rates[t.TaxType] = +t.EffectiveRate || 0; });
    var o = ((c.data.org || {}).Organisations || [])[0] || {};
    var lock = [XK.isoDate(o.PeriodLockDate) || '', XK.isoDate(o.EndOfYearLockDate) || ''].sort().pop();
    var income12 = c.data.pnl12 && !c.errors.pnl12 ? XK.plParts(XK.walk(c.data.pnl12)).income : null;
    var L = { platform: 'Xero', today: LC.today(), from: from, to: to,
      org: { name: o.Name || c.company || '', gst: o.PaysTax === true ? true : o.PaysTax === false ? false : null, lock: lock },
      // Open documents from before the period only reach CHK-087's bill match: every other rule reads the period.
      contacts: contacts, docs: docs.concat(open.filter(function (d) { return !seen[d.id]; })), bank: bank,
      accounts: accounts, rates: rates, income12: income12, na: {} };
    var r = LC.run(L);
    var P = c.data.pnl && !c.errors.pnl ? XK.plParts(XK.walk(c.data.pnl)) : null;
    var bw = c.data.bank && !c.errors.bank ? XK.walk(c.data.bank) : null, bTot = bw ? bw.lines.filter(function (l) { return l.kind === 'row'; }).reduce(function (s, l) { return s + (l.values[3] || 0); }, 0) : null;
    var owing = function (kind, overdue) { return r2(open.filter(function (d) { return d.kind === kind && d.dueAmount > 0 && d.date <= to && (!overdue || (d.due && d.due < to)); }).reduce(function (s, d) { return s + d.dueAmount; }, 0)); };
    var latest = ''; docs.concat(bank).forEach(function (x) { if (x.date && x.date <= to && x.date > latest) latest = x.date; });
    var fin = { income: P ? P.income : null, expenses: P ? P.expenses : null, net: P ? (P.np != null ? P.np : r2(P.income - P.expenses)) : null, bank: bTot == null ? null : r2(bTot),
      ar: owing('invoice'), arOverdue: owing('invoice', true), ap: owing('bill'), apOverdue: owing('bill', true), docs: docs.length, bankTx: bank.length, latest: latest };
    var ui = { p: 'xk', h: XK.h, money: function (v) { return XK.money(v, c.currency, c.display); }, kpis: function (list) { return XK.kpis(list, c); } };
    var v = LV.view(LCV.view, ui, r, fin);
    body.innerHTML = v.html;
    var trunc = ['contacts', 'invoices', 'open_inv', 'bank_tx'].filter(function (id) { return c.truncated(id); });
    var opt = ['tb', 'pnl', 'pnl12', 'bank'].filter(function (id) { return c.errors[id]; });
    this._x = v;
    return { checks: v.checks.concat([
        { name: 'All records in the period loaded (lists paged 100 at a time, up to 20 pages)', pass: !trunc.length, detail: trunc.length ? 'May be truncated (over 20 pages): ' + trunc.join(', ') : docs.length + ' document(s), ' + bank.length + ' bank transaction(s), ' + contacts.length + ' contact(s)' },
        { name: 'Balances, profit and loss and bank summary loaded', pass: opt.length ? null : true, info: !!opt.length, detail: opt.length ? 'Not loaded: ' + opt.map(function (id) { return c.err(id); }).join('; ') + ' — the checks that need them read N/A' : 'Trial balance, profit and loss (period and 12 months) and bank summary' }
      ]), period: XK.periodLine(from, to), notes: v.notes, na: v.na };
  },
  excel: function (c) {
    var v = this._x; if (!v) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: LV.NAMES[LCV.view], s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    return v.sheets.map(function (s, i) { return { name: s.name, rows: i ? s.rows : head.concat(s.rows), widths: s.widths }; });
  }
});

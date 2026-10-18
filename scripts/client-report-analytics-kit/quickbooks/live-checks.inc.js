/* @include shared/live-checks.js */
/* @include shared/live-views.js */
// Live checks on QuickBooks Online (CRA-02 / 08 / 09 / 10): one set of bindings for all four views, the connected company's
// own records turned into the neutral ledger the shared rules read, and the kit wiring. Each report's config sets
// LCV = { view, title }, includes its view (shared/views/<view>.js) and this file.
// What QuickBooks can't answer reads N/A with the reason, never Clear: contacts carry no ABN field (CHK-007 / CHK-008, the
// same gap as Contact Details for BAS), the API doesn't say whether a transaction is reconciled (CHK-022), and there are no
// draft or awaiting-approval invoices (CHK-033). Each line's GST is its share of the document's tax line for its tax code's
// rate (TxnTaxDetail.TaxLine: NetAmountTaxable and Amount), the same reading as BAS Related Transactions. Duplicate contacts
// are checked among suppliers: QuickBooks keeps customers and suppliers in separate lists, so one business in both is normal.
QB.app({
  title: LCV.title, token: null, primary: 'invoices', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', txn_where: "TxnDate >= '2026-07-01' AND TxnDate <= '2026-09-30'", persona: 'Practitioner',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  uses: { invoices: ['txn_where'], bills: ['txn_where'], purchases: ['txn_where'], open_invoices: [], open_bills: [], vendors: [], accounts: [], tax_codes: [], attachables: [], pnl: ['start_date', 'end_date'], company_info: [], prefs: [] },
  derive: function (inp) { return { txn_where: "TxnDate >= '" + inp.start_date + "' AND TxnDate <= '" + inp.end_date + "'" }; },
  tools: { invoices: 'list_invoice', bills: 'list_bill', purchases: 'list_purchase', open_invoices: 'list_invoice (open)', open_bills: 'list_bill (open)', vendors: 'list_vendor', accounts: 'list_account', tax_codes: 'list_tax_code', attachables: 'list_attachable', pnl: 'get_report_profit_and_loss', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body, from = c.inputs.start_date, to = c.inputs.end_date, CAP = 1000, trunc = [];
    var need = ['invoices', 'bills', 'purchases', 'open_invoices', 'open_bills', 'vendors', 'accounts', 'tax_codes'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(need[0])) + '</p>'; this._x = null; return { checks: [{ name: 'Ledger sources loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices) return {};
    var r2 = function (v) { return Math.round((+v || 0) * 100) / 100; };
    var q = function (id, ent) { var r = (((c.data[id] || {}).QueryResponse || {})[ent] || []); if (r.length >= CAP) trunc.push(id); return r; };
    // Tax codes: Id → { name, the sales (S) and purchase (P) tax rate ids }; each rate's percent from the documents' own tax lines.
    var rateIds = function (list) { return ((list || {}).TaxRateDetail || []).map(function (d) { return d.TaxRateRef ? String(d.TaxRateRef.value) : ''; }).filter(Boolean); };
    var codes = {}; q('tax_codes', 'TaxCode').forEach(function (tc) { codes[String(tc.Id)] = { name: tc.Name || 'Tax code ' + tc.Id, S: rateIds(tc.SalesTaxRateList), P: rateIds(tc.PurchaseTaxRateList) }; });
    var inv = q('invoices', 'Invoice'), bil = q('bills', 'Bill'), pur = q('purchases', 'Purchase'), oinv = q('open_invoices', 'Invoice'), obil = q('open_bills', 'Bill');
    var pct = {}; [inv, bil, pur, oinv, obil].forEach(function (ls) { ls.forEach(function (t) { ((t.TxnTaxDetail || {}).TaxLine || []).forEach(function (x) { var d = x.TaxLineDetail; if (d && d.TaxRateRef && d.TaxPercent != null) pct[String(d.TaxRateRef.value)] = +d.TaxPercent; }); }); });
    var rates = {}; Object.keys(codes).forEach(function (id) { var cd = codes[id], ids = cd.P.concat(cd.S), known = ids.filter(function (r) { return pct[r] != null; }); if (known.length) rates[cd.name] = pct[known[0]]; else if (!ids.length) rates[cd.name] = 0; });
    // Attachments: the latest 1,000 attachment records. At the cap, an older transaction's attachment may be missing from the
    // list, so "nothing attached" can't be told apart from "not in the list": the attachment checks read N/A instead.
    var attOk = !!c.data.attachables && !c.errors.attachables, attList = attOk ? (((c.data.attachables || {}).QueryResponse || {}).Attachable || []) : [], attCapped = attList.length >= CAP, att = {};
    attList.forEach(function (a) { (a.AttachableRef || []).forEach(function (ref) { var e = ref.EntityRef || {}; if (e.type && e.value != null) att[e.type + ':' + e.value] = true; }); });
    var hasAtt = function (type, id) { return attOk && !attCapped ? !!att[type + ':' + id] : null; };
    var DET = { SalesItemLineDetail: 1, AccountBasedExpenseLineDetail: 1, ItemBasedExpenseLineDetail: 1 };
    var lines = function (t, side) {
      var byRate = {};
      ((t.TxnTaxDetail || {}).TaxLine || []).forEach(function (x) { var d = x.TaxLineDetail; if (!d) return; var id = d.TaxRateRef ? String(d.TaxRateRef.value) : '?', b = byRate[id] = byRate[id] || { net: 0, tax: 0 }; b.net += +d.NetAmountTaxable || 0; b.tax += +x.Amount || 0; });
      return (t.Line || []).filter(function (l) { return DET[l.DetailType]; }).map(function (l) {
        var d = l[l.DetailType] || {}, cid = d.TaxCodeRef ? String(d.TaxCodeRef.value) : '', cd = codes[cid], amt = +l.Amount || 0, tax = 0;
        if (cd) cd[side].forEach(function (rid) { var b = byRate[rid]; if (b && b.net) tax += b.tax * amt / b.net; });
        return { account: d.AccountRef ? String(d.AccountRef.value) : '', taxCode: cd ? cd.name : cid ? 'Tax code ' + cid : '', amount: r2(amt), tax: r2(tax) };
      });
    };
    var sentOf = function (t) { return t.EmailStatus === 'EmailSent' || t.PrintStatus === 'PrintComplete' ? true : t.EmailStatus === 'NotSet' || t.EmailStatus === 'NeedToSend' ? false : null; };
    var doc = function (t, kind) {
      var sale = kind === 'invoice', who = (sale ? t.CustomerRef : t.VendorRef) || {}, total = r2(t.TotalAmt);
      return { id: kind + ':' + t.Id, kind: kind, number: t.DocNumber || '', contactId: who.value != null ? (sale ? 'C:' : 'V:') + who.value : '', contact: who.name || '', date: t.TxnDate || '', due: t.DueDate || '',
        status: !total ? 'void' : r2(t.Balance) <= 0 ? 'paid' : 'authorised', total: total, tax: r2((t.TxnTaxDetail || {}).TotalTax), dueAmount: r2(t.Balance),
        sent: sale ? sentOf(t) : null, attachments: hasAtt(sale ? 'Invoice' : 'Bill', t.Id), link: '', lines: lines(t, sale ? 'S' : 'P') };
    };
    var docs = inv.map(function (t) { return doc(t, 'invoice'); }).concat(bil.map(function (t) { return doc(t, 'bill'); }));
    var open = oinv.map(function (t) { return doc(t, 'invoice'); }).concat(obil.map(function (t) { return doc(t, 'bill'); })), seen = {};
    docs.forEach(function (d) { seen[d.id] = 1; });
    var bank = pur.map(function (t) {
      var e = t.EntityRef || {}, pre = { Vendor: 'V:', Customer: 'C:', Employee: 'E:' }[e.type] || 'X:', li = (t.Line || [])[0] || {};
      return { id: 'purchase:' + t.Id, kind: t.Credit === true ? 'other' : 'spend', number: t.DocNumber || '', contactId: e.value != null ? pre + e.value : '', contact: e.name || '', date: t.TxnDate || '',
        total: r2(t.TotalAmt), tax: r2((t.TxnTaxDetail || {}).TotalTax), reconciled: null, attachments: hasAtt('Purchase', t.Id), desc: t.PrivateNote || li.Description || '', link: '', lines: lines(t, 'P') };
    });
    var contacts = q('vendors', 'Vendor').map(function (v) { var a = v.BillAddr; return { id: 'V:' + v.Id, name: v.DisplayName || v.CompanyName || '', abn: '', address: a ? !!String(a.Line1 || a.City || '').trim() : null, link: '' }; });
    var accts = q('accounts', 'Account'), accounts = accts.map(function (a) {
      var tc = a.TaxCodeRef && codes[String(a.TaxCodeRef.value)];
      return { id: String(a.Id), code: '', name: (a.AcctNum ? a.AcctNum + ' ' : '') + (a.Name || ''), type: a.AccountSubType === 'Depreciation' ? 'DEPRECIATN' : a.AccountType || '', pl: a.Classification === 'Revenue' || a.Classification === 'Expense',
        taxCode: tc ? tc.name : '', balance: a.CurrentBalance == null ? null : r2(a.CurrentBalance) };
    });
    var prefsOk = !!c.data.prefs && !c.errors.prefs, P = (c.data.prefs || {}).Preferences || {}, tp = P.TaxPrefs || {};
    var ci = (((c.data.company_info || {}).QueryResponse || {}).CompanyInfo || [])[0] || {};
    var NO_ABN = 'QuickBooks contacts carry no ABN field (the same gap as Contact Details for BAS)', na = {
      'CHK-007': NO_ABN, 'CHK-008': NO_ABN,
      'CHK-022': 'QuickBooks doesn\'t say through its API whether a transaction is reconciled',
      'CHK-033': 'QuickBooks has no draft or awaiting-approval invoices' };
    if (!attOk || attCapped) na['CHK-021'] = na['CHK-086'] = !attOk ? 'the attachment list didn\'t load: ' + (c.err('attachables') || 'no response') : 'over 1,000 attachments in this company, so a missing one can\'t be told from one not listed';
    var L = { platform: 'QuickBooks', today: LC.today(), from: from, to: to,
      org: { name: ci.CompanyName || c.company || '', gst: tp.UsingSalesTax === true ? true : tp.UsingSalesTax === false ? false : null, lock: prefsOk ? String((P.AccountingInfoPrefs || {}).BookCloseDate || '').slice(0, 10) : null },
      // Open documents from before the period only reach CHK-087's bill match: every other rule reads the period.
      contacts: contacts, docs: docs.concat(open.filter(function (d) { return !seen[d.id]; })), bank: bank,
      accounts: accounts, rates: rates, income12: null, na: na };
    var r = LC.run(L);
    // Financial activity: the period's P&L; bank balances and money owed are QuickBooks' current balances (as of today).
    var pl = c.data.pnl && !c.errors.pnl ? QB.walk(c.data.pnl) : null;
    var at = function (g, re) { var l = pl && QB.find(pl, g, re); return l ? QB.val(l) : null; };
    var F = pl ? { rev: at('Income', /^total (income|revenue|trading income)$/i), cogs: at('COGS', /^total (cost of (sales|goods sold))$/i), exp: at('Expenses', /^total expenses$/i), oi: at('OtherIncome', /^total other income$/i), oe: at('OtherExpenses', /^total other expenses?$/i), np: at('NetIncome', QB.NI_RE) } : null;
    var income = F ? r2((F.rev || 0) + (F.oi || 0)) : null, expenses = F ? r2((F.cogs || 0) + (F.exp || 0) + (F.oe || 0)) : null;
    var banks = accts.filter(function (a) { return a.AccountType === 'Bank'; });
    var owing = function (kind, overdue) { return r2(open.filter(function (d) { return d.kind === kind && d.dueAmount > 0 && d.date <= to && (!overdue || (d.due && d.due < to)); }).reduce(function (s, d) { return s + d.dueAmount; }, 0)); };
    var latest = ''; docs.concat(bank).forEach(function (x) { if (x.date && x.date <= to && x.date > latest) latest = x.date; });
    var fin = { income: income, expenses: expenses, net: F ? (F.np != null ? F.np : r2(income - expenses)) : null, bank: banks.length ? r2(banks.reduce(function (s, a) { return s + (+a.CurrentBalance || 0); }, 0)) : null,
      ar: owing('invoice'), arOverdue: owing('invoice', true), ap: owing('bill'), apOverdue: owing('bill', true), docs: docs.length, bankTx: bank.length, latest: latest };
    var ui = { p: 'qb', h: QB.h, money: function (v) { return QB.money(v, c.currency, c.display); }, kpis: function (list) { return QB.kpis(list, c); } };
    var v = LV.view(LCV.view, ui, r, fin);
    body.innerHTML = v.html;
    this._x = v;
    var opt = ['pnl', 'attachables'].filter(function (id) { return c.errors[id]; });
    return { checks: v.checks.concat([
        { name: 'Every transaction loaded (no list at the ' + CAP + '-row cap)', pass: !trunc.length, detail: trunc.length ? 'Possibly truncated at ' + CAP + ' rows: ' + trunc.join(', ') + ' — shorten the period' : docs.length + ' document(s), ' + bank.length + ' spend money, ' + open.length + ' open document(s), ' + contacts.length + ' supplier(s)' },
        { name: 'Profit and loss and attachments loaded', pass: opt.length || attCapped ? null : true, info: !!(opt.length || attCapped), detail: opt.length ? 'Not loaded: ' + opt.map(function (id) { return c.err(id); }).join('; ') : attCapped ? 'Over 1,000 attachments: attachment checks N/A' : attList.length + ' attachment record(s)' }
      ]), period: QB.periodLine(from, to), notes: v.notes.concat(['QuickBooks: bank balances and money owed are the current balances (as of today); only account-coded lines are checked for their account (item lines carry the item\'s account).']), na: v.na };
  },
  excel: function (c) {
    var v = this._x; if (!v) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: LV.NAMES[LCV.view], s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []];
    return v.sheets.map(function (s, i) { return { name: s.name, rows: i ? s.rows : head.concat(s.rows), widths: s.widths }; });
  }
});

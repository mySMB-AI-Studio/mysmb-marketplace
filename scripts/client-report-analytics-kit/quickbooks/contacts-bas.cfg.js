// CRA-06 Contact Details for BAS Preparation — QuickBooks Online. Customers and Vendors (qbo_query) as the contact list, with
// the tax types each one used in the period, read from the tax lines of the period's transactions (the TX block below, the same
// one BAS Related Transactions and Summary of Tax Amounts use). QuickBooks contacts carry no ABN, so GST evidence on file and the
// register (ABR) match read "N/A — not in source" / "N/A — no ABN in QuickBooks contacts", never a guessed value.
// >>> TX (shared by bas-transactions, tax-by-type and contacts-bas; a test keeps the three copies identical)
var TX = (function () {
  // [binding id, QBO entity, source label, sign, side S = sales / P = purchases]; journals are read per line
  var ENT = [['invoices', 'Invoice', 'Invoice', 1, 'S'], ['sales_receipts', 'SalesReceipt', 'Sales receipt', 1, 'S'], ['credit_memos', 'CreditMemo', 'Credit note', -1, 'S'],
    ['bills', 'Bill', 'Bill', 1, 'P'], ['purchases', 'Purchase', 'Spend money', 1, 'P'], ['vendor_credits', 'VendorCredit', 'Supplier credit', -1, 'P'], ['journal_entries', 'JournalEntry', 'Journal', 0, null]];
  var CAP = 1000, DET = { SalesItemLineDetail: 1, AccountBasedExpenseLineDetail: 1, ItemBasedExpenseLineDetail: 1 };
  function where(start, end) { return "TxnDate >= '" + start + "' AND TxnDate <= '" + end + "'"; }
  function list(data, id, ent) { return ((data[id] || {}).QueryResponse || {})[ent] || []; }
  function r2(v) { return Math.round(v * 100) / 100; }
  // TaxCode → its sales / purchase tax rates; rate → {name, code, side}
  function codes(resp) {
    var rate = {}, code = {};
    (((resp || {}).QueryResponse || {}).TaxCode || []).forEach(function (tc) {
      code[String(tc.Id)] = { name: tc.Name || 'Tax code ' + tc.Id, desc: tc.Description || '', S: [], P: [] };
      [['SalesTaxRateList', 'S'], ['PurchaseTaxRateList', 'P']].forEach(function (x) {
        ((tc[x[0]] || {}).TaxRateDetail || []).forEach(function (d) { var id = d.TaxRateRef && String(d.TaxRateRef.value); if (!id) return;
          code[String(tc.Id)][x[1]].push(id); rate[id] = { name: d.TaxRateRef.name || null, code: tc.Name || tc.Id, codeId: String(tc.Id), side: x[1] }; });
      });
    });
    return { rate: rate, code: code };
  }
  function items(resp) { var m = {}; (((resp || {}).QueryResponse || {}).Item || []).forEach(function (i) { m[String(i.Id)] = { inc: i.IncomeAccountRef && i.IncomeAccountRef.name, exp: i.ExpenseAccountRef && i.ExpenseAccountRef.name }; }); return m; }
  function lineAccount(l, it) {
    var d = l[l.DetailType] || {};
    if (d.AccountRef && d.AccountRef.name) return d.AccountRef.name;
    if (d.ItemRef) { var i = it && it[String(d.ItemRef.value)]; var a = i && (l.DetailType === 'SalesItemLineDetail' ? i.inc : i.exp); return a || null; }
    return null;
  }
  // rows: one per (document × tax rate) from TxnTaxDetail.TaxLine; one per tax-coded journal line. Amounts signed: a credit note /
  // supplier credit / refund reduces its side. docs: the document-level integrity facts for the checks.
  function build(data, opts) {
    opts = opts || {}; var cm = codes(data[opts.codes || 'tax_codes']), it = opts.items ? items(data[opts.items]) : null, rows = [], docs = [], counts = {}, trunc = [];
    var typeOf = function (rateId, side, pct) { var r = cm.rate[rateId] || {}; return { key: rateId, name: r.name || 'Tax rate ' + rateId, code: r.code || '?', side: r.side || side, pct: pct }; };
    ENT.forEach(function (e) {
      var ls = list(data, e[0], e[1]); counts[e[0]] = ls.length; if (ls.length >= CAP) trunc.push(e[1]);
      ls.forEach(function (t) {
        var who = (t.CustomerRef || t.VendorRef || t.EntityRef || {}).name || '', base = { date: t.TxnDate, ref: t.DocNumber || t.Id, contact: who, entity: e[1], id: t.Id };
        if (e[1] === 'JournalEntry') {
          (t.Line || []).forEach(function (l) { var d = l.JournalEntryLineDetail || {}; if (!d.TaxCodeRef || d.TaxAmount == null) return;
            var side = d.TaxApplicableOn === 'Sales' ? 'S' : 'P', c = cm.code[String(d.TaxCodeRef.value)], rid = c && c[side][0] ? c[side][0] : 'code ' + d.TaxCodeRef.value;
            var sg = (side === 'S') === (d.PostingType === 'Credit') ? 1 : -1, ty = typeOf(rid, side, null);
            if (!c) ty.name = 'Tax code ' + d.TaxCodeRef.value;
            rows.push(Object.assign({}, base, { source: 'Journal', contact: (d.Entity && d.Entity.EntityRef && d.Entity.EntityRef.name) || '', type: ty, side: ty.side, account: (d.AccountRef && d.AccountRef.name) || null, net: r2(sg * (Number(l.Amount) || 0)), gst: r2(sg * Number(d.TaxAmount)) })); });
          return;
        }
        var sg = e[3], src = e[2];
        if (e[1] === 'Purchase' && t.Credit === true) { sg = -1; src = 'Spend money (refund)'; }
        var tl = ((t.TxnTaxDetail || {}).TaxLine || []).filter(function (x) { return x.TaxLineDetail; }), lines = (t.Line || []);
        var lineSum = 0; lines.forEach(function (l) { if (DET[l.DetailType]) lineSum += Number(l.Amount) || 0; else if (l.DetailType === 'DiscountLineDetail') lineSum -= Number(l.Amount) || 0; });
        var totTax = t.TxnTaxDetail && t.TxnTaxDetail.TotalTax != null ? Number(t.TxnTaxDetail.TotalTax) : null, sumTl = r2(tl.reduce(function (s, x) { return s + (Number(x.Amount) || 0); }, 0));
        docs.push({ entity: e[1], source: src, ref: base.ref, total: t.TotalAmt == null ? null : Number(t.TotalAmt), lines: r2(lineSum), tax: totTax, taxLines: sumTl });
        tl.forEach(function (x) {
          var d = x.TaxLineDetail, rid = d.TaxRateRef ? String(d.TaxRateRef.value) : '?', ty = typeOf(rid, e[4], d.TaxPercent == null ? null : Number(d.TaxPercent)), accts = [];
          lines.forEach(function (l) { var ld = l[l.DetailType] || {}; if (!DET[l.DetailType] || !ld.TaxCodeRef) return; var c = cm.code[String(ld.TaxCodeRef.value)];
            if (c && c[ty.side].indexOf(rid) >= 0) { var a = it ? lineAccount(l, it) : null; if (a && accts.indexOf(a) < 0) accts.push(a); } });
          rows.push(Object.assign({}, base, { source: src, type: ty, side: ty.side, account: !it ? null : accts.length === 1 ? accts[0] : accts.length ? 'Multiple: ' + accts.join('; ') : null,
            net: r2(sg * (Number(d.NetAmountTaxable) || 0)), gst: r2(sg * (Number(x.Amount) || 0)) }));
        });
      });
    });
    var pct = {}; rows.forEach(function (r) { if (r.type.pct != null) pct[r.type.key] = r.type.pct; }); // a journal line carries no rate: take it from the same rate's tax lines
    rows.forEach(function (r) { if (r.type.pct == null && pct[r.type.key] != null) r.type.pct = pct[r.type.key]; r.gross = r2(r.net + r.gst); r.month = String(r.date || '').slice(0, 7); r.typeLabel = r.type.name + (r.type.pct != null ? ' ' + r.type.pct + '%' : '') + ' · ' + r.type.code; });
    return { rows: rows, docs: docs, counts: counts, trunc: trunc, codes: cm };
  }
  // the named document checks every report shows
  function docChecks(b, money) {
    var bad = b.docs.filter(function (d) { return d.total != null && d.tax != null && Math.abs(d.total - r2(d.lines + d.tax)) > 0.01; }), badT = b.docs.filter(function (d) { return d.tax != null && Math.abs(d.taxLines - d.tax) > 0.01; });
    var n = b.docs.length, nt = Object.keys(b.counts).reduce(function (s, k) { return s + b.counts[k]; }, 0);
    return [
      { name: 'Every document: QuickBooks TotalAmt = Σ line amounts + total tax (Net + GST = Gross)', pass: n ? !bad.length : null, detail: n ? (bad.length ? 'Mismatch: ' + bad.slice(0, 5).map(function (d) { return d.source + ' ' + d.ref + ' (' + money(d.total) + ' vs ' + money(r2(d.lines + d.tax)) + ')'; }).join(', ') : n + ' documents') : 'No documents in the period' },
      { name: 'Every document: Σ tax lines = its total tax', pass: n ? !badT.length : null, detail: n ? (badT.length ? 'Mismatch: ' + badT.slice(0, 5).map(function (d) { return d.source + ' ' + d.ref; }).join(', ') : n + ' documents') : 'No documents in the period' },
      { name: 'Every transaction loaded (no list at the ' + CAP + '-row page cap)', pass: !b.trunc.length, detail: b.trunc.length ? 'Possibly truncated at ' + CAP + ' rows: ' + b.trunc.join(', ') + ' — shorten the period' : nt + ' transactions' }];
  }
  return { where: where, build: build, docChecks: docChecks, ENT: ENT, CAP: CAP };
})();
// <<< TX
QB.app({
  title: 'QuickBooks · Contact Details for BAS Preparation', token: null, primary: 'customers', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-04-01', end_date: '2026-06-30', txn_where: "TxnDate >= '2026-04-01' AND TxnDate <= '2026-06-30'", persona: 'Practitioner',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter (BAS)'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  uses: { customers: [], vendors: [], company_info: [], prefs: [], tax_codes: [], invoices: ['txn_where'], credit_memos: ['txn_where'], sales_receipts: ['txn_where'], bills: ['txn_where'], vendor_credits: ['txn_where'], purchases: ['txn_where'], journal_entries: ['txn_where'] },
  tools: { customers: 'qbo_query (SELECT * FROM Customer)', vendors: 'qbo_query (SELECT * FROM Vendor)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences', tax_codes: 'list_tax_code',
    invoices: 'list_invoice', credit_memos: 'list_credit_memo', sales_receipts: 'list_sales_receipt', bills: 'list_bill', vendor_credits: 'list_vendor_credit', purchases: 'list_purchase', journal_entries: 'list_journal_entry' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  derive: function (inp) { return { txn_where: TX.where(inp.start_date, inp.end_date) }; },
  render: function (c) {
    var body = c.body, per = QB.periodLine(c.inputs.start_date, c.inputs.end_date);
    if (c.errors.customers || c.errors.vendors) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('customers') || c.err('vendors')) + '</p>'; return { checks: [{ name: 'Contacts loaded', pass: false, detail: c.err('customers') || c.err('vendors') }] }; }
    if (!c.data.customers || !c.data.vendors) return {};
    // Tax types used per contact: every tax line of the period's transactions (the shared TX block, as BAS Related Transactions
    // reads them), matched to the contact by display name (QuickBooks keeps display names unique across customers and vendors).
    var txFail = TX.ENT.map(function (e) { return e[0]; }).concat(['tax_codes']).filter(function (id) { return c.errors[id]; });
    var b = txFail.length ? null : TX.build(c.data), used = {}, noContact = 0;
    if (b) b.rows.forEach(function (r) { var k = r.contact || ''; if (!k) { noContact++; return; } var t = r.type.name + (r.type.pct != null ? ' ' + r.type.pct + '%' : ''); (used[k] = used[k] || {})[t] = (used[k][t] || 0) + 1; });
    var typesOf = function (name) { if (!b) return 'N/A — the transactions could not be loaded'; var u = used[name]; return u ? Object.keys(u).sort().map(function (t) { return t + ' (' + u[t] + ')'; }).join(', ') : 'None this period'; };
    var cust = ((c.data.customers.QueryResponse || {}).Customer || []).map(function (x) { return { name: x.DisplayName || '(no name)', role: 'Customer', active: x.Active !== false }; });
    var vend = ((c.data.vendors.QueryResponse || {}).Vendor || []).map(function (x) { return { name: x.DisplayName || '(no name)', role: 'Vendor', active: x.Active !== false }; });
    var listed = {}, rows = cust.concat(vend).sort(function (a, b2) { return a.name.localeCompare(b2.name); }).map(function (r) { listed[r.name] = 1; return { name: r.name, role: r.role, status: r.active ? 'Active' : 'Inactive', gst: 'N/A — not in source', types: typesOf(r.name), registry: 'N/A — no ABN in QuickBooks contacts' }; });
    var withTypes = rows.filter(function (r) { return used[r.name]; }).length, unlisted = Object.keys(used).filter(function (k) { return !listed[k]; });
    body.innerHTML = QB.kpis([{ label: 'Contacts', text: String(rows.length) }, { label: 'Customers', text: String(cust.length) }, { label: 'Vendors', text: String(vend.length) }, { label: 'With GST-coded transactions', text: b ? String(withTypes) : 'N/A' }], c) +
      '<div class="qb-banner na" style="margin:12px 0"><strong>No register (ABR) match on QuickBooks</strong> — the Australian Business Register is looked up by ABN, and QuickBooks contacts carry no ABN field. GST evidence reads "N/A — not in source" for the same reason. Tax types used are read from the tax lines of the period\'s transactions.</div>' +
      '<div class="qb-card"><h3>Contacts</h3><div id="cb-grid"></div></div>';
    QB.grid(document.getElementById('cb-grid'), { columns: [{ key: 'name', title: 'Contact' }, { key: 'role', title: 'Role' }, { key: 'status', title: 'Status' }, { key: 'gst', title: 'GST evidence on file' }, { key: 'types', title: 'Tax types used ' + per }, { key: 'registry', title: 'Registry (ABR) match' }], rows: rows, empty: 'No contacts.' }, c);
    var checks = [
      { name: 'Every Customer and Vendor loaded', pass: true, detail: cust.length + ' customer(s), ' + vend.length + ' vendor(s)' },
      { name: 'Transactions loaded for the tax types used', pass: b ? !b.trunc.length : false, detail: !b ? 'Could not load: ' + txFail.join(', ') : b.trunc.length ? 'Possibly truncated at ' + TX.CAP + ' rows: ' + b.trunc.join(', ') + ' — shorten the period' : b.rows.length + ' tax line(s) in ' + per },
      { name: 'Every tax line belongs to a listed contact', pass: null, info: true, detail: !b ? 'N/A — the transactions could not be loaded' : (unlisted.length ? unlisted.length + ' contact name(s) on transactions but not in the lists: ' + unlisted.slice(0, 5).join(', ') + '; ' : '') + noContact + ' tax line(s) with no contact (journals or spend money without a payee)' },
      { name: 'GST evidence on file', pass: null, info: true, detail: 'N/A — not in source: no ABN-equivalent field on the QuickBooks Customer/Vendor entity' },
      { name: 'Registry (ABR) match', pass: null, info: true, detail: 'N/A — no ABN to look up: QuickBooks contacts carry no ABN field (the Xero version shows the register, with ABR Lookup connected)' }
    ];
    this._x = { rows: rows, per: per };
    return { checks: checks, period: per,
      notes: ['Contacts are QuickBooks Customers and Vendors (qbo_query). Tax types used come from the tax lines of the period\'s invoices, credit notes, sales receipts, bills, supplier credits, spend money and journals, with the number of lines per tax type. GST evidence and the register match are N/A — not in source: QuickBooks contacts carry no ABN.'],
      na: ['GST evidence on file (no ABN field on QuickBooks contacts)', 'Register (ABR) match — needs an ABN, which QuickBooks contacts don\'t carry'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contact Details for BAS Preparation', s: 'bold' }], [x.per], []];
    var rows = head.concat([[{ v: 'Contact', s: 'bold' }, { v: 'Role', s: 'bold' }, { v: 'Status', s: 'bold' }, { v: 'GST evidence on file', s: 'bold' }, { v: 'Tax types used', s: 'bold' }, { v: 'Registry (ABR) match', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, r.role, r.status, r.gst, r.types, r.registry]; }));
    return [{ name: 'Contacts', rows: rows, widths: [28, 12, 12, 24, 40, 20] }];
  }
});

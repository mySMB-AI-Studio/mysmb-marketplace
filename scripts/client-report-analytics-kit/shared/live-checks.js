// Live checks: the checks engine's rules (scripts/bookkeeping-kit/src/lib/checks.py, the Ledger checks automation of
// Bookkeeping for Xero) ported to run inside a report as it opens. They make Data Quality (CRA-02), Client Queries (CRA-08),
// Health Check (CRA-09) and GST Check (CRA-10) live reports on Xero, MYOB and QuickBooks, not only the weekly Xero artifact.
// Each platform's include (<platform>/live-checks.inc.js) turns its own tool responses into the neutral ledger below; this
// file never sees a platform payload. Check ids, names, severities, thresholds and wording follow checks.py, so a finding
// here and the overnight engine's agree. Checks that need what only the engine keeps between runs (bank-detail changes, when
// a supplier first appeared, the last lock date, 12 months of movement) or the Australian Business Register are listed as
// "runs overnight", never as passed.
//
// Neutral ledger (a null field = the platform doesn't expose it, so the check reads N/A instead of passing):
//   { platform, today, from, to,
//     org: { name, gst: true|false|null, lock: 'YYYY-MM-DD' | '' (none set) | null },
//     contacts: [{ id, name, abn (digits, '' when none), address: true|false|null, link }],
//     docs: [{ id, kind: 'invoice'|'bill'|'invoice_credit'|'bill_credit', number, contactId, contact, date, due,
//              status: 'draft'|'submitted'|'authorised'|'paid'|'void', total, tax, sent: true|false|null,
//              attachments: true|false|null, link, lines: [{ account, taxCode, amount (excl. GST), tax }] }],
//     bank: [{ id, kind: 'spend'|'receive'|'other', contactId, contact, date, total, tax, reconciled: true|false|null,
//              attachments: true|false|null, desc, link, lines }],
//     accounts: [{ id, code, name, type, pl, balance: number|null, taxCode }]   (lines[].account = an account's key: code, else id)
//     rates: { <taxCode>: rate % }, income12: number|null,
//     na: { <check id>: 'why this platform can't answer it' } }
var LC = (function () {
  var CAT = {
    'CHK-006': ['Contacts', 'Duplicate Contact', 'Medium'],
    'CHK-007': ['Contacts', 'TPAR Information Missing', 'Medium'],
    'CHK-008': ['Contacts', 'Large GST Activity for Contact Without ABN', 'Medium'],
    'CHK-017': ['Banking', 'Contact Bank Account Changed', 'High'],
    'CHK-018': ['Banking', 'Contact Bank Account Same as Existing Supplier', 'Low'],
    'CHK-021': ['Banking', 'Expenses Without Attachments Over $75', 'Low'],
    'CHK-022': ['Banking', 'Unreconciled Transactions', 'Low'],
    'CHK-024': ['Sales', 'Invoice Not Sent to Contact', 'Low'],
    'CHK-028': ['Sales', 'Possible Duplicate Customer Invoice', 'Medium'],
    'CHK-031': ['Sales', 'GST on Invoice and/or Credit Note When Not Registered', 'Medium'],
    'CHK-033': ['Sales', 'Invoices in Draft or Awaiting Approval', 'Low'],
    'CHK-035': ['Sales', 'Duplicate Invoice Paid', 'Medium'],
    'CHK-055': ['Purchases', 'Possible Duplicate Bill', 'Medium'],
    'CHK-056': ['Purchases', 'Unusual New-Supplier Payment Pattern', 'Low'],
    'CHK-057': ['Purchases', 'Supplier Bank Details Changed Before A Payment', 'High'],
    'CHK-058': ['Purchases', 'GST Claimed on a Non-Claimable Item', 'Medium'],
    'CHK-059': ['Purchases', 'Transaction With a GST Inconsistency', 'Medium'],
    'CHK-079': ['Purchases', 'Duplicate Bill Raised', 'Medium'],
    'CHK-080': ['Purchases', 'Duplicate Bill Paid', 'Medium'],
    'CHK-086': ['Purchases', 'Bills Raised Without Attachments Over $75', 'Low'],
    'CHK-087': ['Purchases', 'Spend Money Transaction with Like or Similar Bill', 'Low'],
    'CHK-125': ['Bookkeeping', 'Suspense or Uncoded Account With a Balance', 'Medium'],
    'CHK-129': ['Bookkeeping', 'GST Account Has No GST Against It', 'Medium'],
    'CHK-132': ['Bookkeeping', 'Accounting System Getting Lonely', 'Low'],
    'CHK-133': ['Bookkeeping', 'Month-End Journals Missing', 'Medium'],
    'CHK-134': ['Bookkeeping', 'Lock Date Not Set', 'Medium'],
    'CHK-135': ['Bookkeeping', 'Lock Date Change', 'Medium'],
    'CHK-136': ['Bookkeeping', 'GST Registration Required', 'Medium'],
    'CHK-138': ['Bookkeeping', 'Inactive Account', 'Low'],
    // Register checks (Australian Business Register): the overnight engine's Register lookups automation only.
    'CHK-002': ['Contacts', 'Bill Attachment With a Cancelled ABN', 'High'],
    'CHK-003': ['Contacts', 'Business Has Incorrect GST Status', 'Medium'],
    'CHK-004': ['Contacts', 'Incorrect ABN for Business', 'Medium'],
    'CHK-005': ['Contacts', 'Matched ABN for Business', 'Medium'],
    'CHK-009': ['Contacts', 'Donation Against Non-DGR Entity', 'Low'],
    'CHK-030': ['Sales', 'Invoice Raised With a Cancelled Customer', 'High'],
    'CHK-039': ['Sales', 'Unpaid Income With A Cancelled Business', 'High'],
    'CHK-068': ['Purchases', 'GST Claimed on Multiple Bills While Not Registered for GST', 'Medium'],
    'CHK-069': ['Purchases', 'GST on Multiple Bank Transactions While Not Registered for GST', 'Medium'],
    'CHK-071': ['Purchases', 'Bill Raised With A Cancelled Supplier', 'High'],
    'CHK-072': ['Purchases', 'Payment to a Cancelled Supplier', 'High'],
    'CHK-076': ['Purchases', 'Payment to Supplier Not Registered for GST', 'Medium'],
    'CHK-077': ['Purchases', 'Bank Payment With GST to a Supplier Not Registered for GST', 'Medium'],
    'CHK-085': ['Purchases', 'Bill Raised with Supplier Not Registered for GST', 'Medium'],
    'CHK-088': ['Purchases', 'Expenses With a Cancelled Business', 'High'],
    // Client Queries only: what the client has to explain (CRA-08: "uncoded, missing attachment, unexplained").
    'CQ-01': ['Bookkeeping', 'Transaction Coded to a Suspense or Uncoded Account', 'Medium'],
    'CQ-02': ['Banking', 'Bank Transaction With No Contact or Description', 'Low']
  };
  var CATEGORIES = ['Contacts', 'Banking', 'Sales', 'Purchases', 'Bookkeeping'];
  var RANK = { High: 0, Medium: 1, Low: 2 };
  var HEURISTIC = ['CHK-003', 'CHK-005', 'CHK-009', 'CHK-056', 'CHK-129', 'CHK-133'];
  var REGISTER = ['CHK-002', 'CHK-003', 'CHK-004', 'CHK-005', 'CHK-009', 'CHK-030', 'CHK-039', 'CHK-068', 'CHK-069', 'CHK-071', 'CHK-072', 'CHK-076', 'CHK-077', 'CHK-085', 'CHK-088'];
  var GST = ['CHK-003', 'CHK-008', 'CHK-031', 'CHK-058', 'CHK-059', 'CHK-068', 'CHK-069', 'CHK-076', 'CHK-077', 'CHK-085', 'CHK-129', 'CHK-136'];
  var QUERY = ['CQ-01', 'CQ-02', 'CHK-007', 'CHK-008', 'CHK-021', 'CHK-086'];
  // What only the overnight engine can do, and why (shown in the scope table instead of a pass).
  var ENGINE = {
    'CHK-017': 'compares each contact\'s bank details with the last run',
    'CHK-018': 'reads contacts\' bank details, which it keeps only as a keyed hash',
    'CHK-056': 'remembers when each supplier first appeared',
    'CHK-057': 'compares each contact\'s bank details with the last run',
    'CHK-133': 'compares four months of journals',
    'CHK-135': 'remembers the lock date from the last run',
    'CHK-138': 'reads 12 months of movement for every account'
  };
  var LIMIT = 82.5, DUP_DAYS = 7, LONELY_DAYS = 30, GST_TURNOVER = 75000, LOCK_MONTHS = 6, MAX_PAIRS = 100;
  var NON_CLAIMABLE = /\b(wages?|salar(y|ies)|superannuation|super|payg|bank (fees?|charges?)|interest|depreciation|amortis\w*|asic|stamp duty|fines?|penalt\w*|donations?|land tax|income tax|fbt|drawings|dividends?)\b/i;
  var SUSPENSE = /\b(suspense|clearing|uncoded|unallocated|holding|uncategori[sz]ed|ask my accountant)\b/i;

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(pty|ltd|limited|the|inc|co)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function gap(a, b) { var x = day(a), y = day(b); return x == null || y == null ? null : Math.round((y - x) / 864e5); }
  function addDays(s, k) { var d = day(s); return d == null ? '' : new Date(d + k * 864e5).toISOString().slice(0, 10); }
  function lastMonthEnd(today) { var d = day(today); if (d == null) return ''; var t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)).toISOString().slice(0, 10); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateText(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : 'no date'; }
  function money(v) { var n = Math.round((+v || 0) * 100) / 100; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function r2(v) { return Math.round((+v || 0) * 100) / 100; }
  function sum(rows, f) { var s = 0; rows.forEach(function (r) { s += +(typeof f === 'function' ? f(r) : r[f]) || 0; }); return r2(s); }
  function names(rows, field, limit) { limit = limit || 5; var n = []; rows.forEach(function (r) { if (r[field || 'name']) n.push(String(r[field || 'name'])); }); return n.slice(0, limit).join(', ') + (n.length > limit ? ' and ' + (n.length - limit) + ' more' : ''); }
  function live(d) { return d.status === 'submitted' || d.status === 'authorised' || d.status === 'paid'; }
  function kindLabel(x) { return { invoice: 'Sales invoice', bill: 'Bill', invoice_credit: 'Credit note', bill_credit: 'Supplier credit', spend: 'Spend money', receive: 'Receive money' }[x.kind] || 'Transaction'; }
  function row(x, need, amount) { return { date: x.date || '', kind: kindLabel(x), number: x.number || x.desc || '', contact: x.contact || '', amount: amount == null ? x.total : amount, need: need || '', link: x.link || '' }; }

  function finding(check, text, o) {
    o = o || {}; var c = CAT[check];
    return { check: check, category: c[0], name: c[1], severity: c[2], text: text, amount: o.amount == null ? null : r2(o.amount), link: o.link || '',
      rows: o.rows || [], heuristic: HEURISTIC.indexOf(check) >= 0, gst: GST.indexOf(check) >= 0, query: QUERY.indexOf(check) >= 0 };
  }

  function run(L) {
    var out = [], na = L.na || {}, ran = {};
    var inP = function (d) { return d && d >= L.from && d <= L.to; };
    var docs = (L.docs || []).filter(function (d) { return inP(d.date); });
    var bank = (L.bank || []).filter(function (s) { return inP(s.date); });
    var contacts = {}; (L.contacts || []).forEach(function (c) { contacts[c.id] = c; });
    var accounts = {}; (L.accounts || []).forEach(function (a) { accounts[a.code || a.id] = a; });
    var rates = L.rates || {};
    var spend = bank.filter(function (s) { return s.kind === 'spend'; });
    var purchases = docs.filter(function (d) { return d.kind === 'bill' && live(d); }).concat(spend);
    var sales = docs.filter(function (d) { return d.kind === 'invoice'; });
    var allow = function (check) { if (na[check]) return false; ran[check] = true; return true; };

    // CHK-006: active contacts with the same ABN or the same name.
    if (allow('CHK-006')) {
      var groups = { abn: {}, name: {} };
      (L.contacts || []).forEach(function (c) {
        if (String(c.abn || '').length === 11) (groups.abn[c.abn] = groups.abn[c.abn] || []).push(c);
        var k = norm(c.name); if (k.length > 2) (groups.name[k] = groups.name[k] || []).push(c);
      });
      [['abn', 'the same ABN'], ['name', 'the same name']].forEach(function (g) {
        Object.keys(groups[g[0]]).sort().forEach(function (k) {
          var rows = groups[g[0]][k]; if (rows.length < 2) return;
          out.push(finding('CHK-006', rows.length + ' active contacts have ' + g[1] + ': ' + names(rows) + '. Merge them, or archive the one not used.',
            { link: rows[0].link, rows: rows.map(function (c) { return { date: '', kind: 'Contact', number: c.abn || '', contact: c.name, amount: null, need: '', link: c.link || '' }; }) }));
        });
      });
    }

    // CHK-055 / CHK-079 / CHK-080 and CHK-028 / CHK-035: the same number, or the same amount within 7 days, from one contact.
    var pairs = function (kind) {
      var by = {}, res = [];
      docs.filter(function (d) { return d.kind === kind && live(d) && d.total > 0; }).forEach(function (d) { var k = d.contactId || norm(d.contact); (by[k] = by[k] || []).push(d); });
      Object.keys(by).forEach(function (k) {
        var rows = by[k].sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id) < String(b.id) ? -1 : 1; });
        for (var i = 0; i < rows.length; i++) for (var j = i + 1; j < rows.length; j++) {
          var a = rows[i], b = rows[j], same = !!a.number && norm(a.number) === norm(b.number), g = gap(a.date, b.date);
          if (same || (g != null && Math.abs(g) <= DUP_DAYS && Math.abs(a.total - b.total) < 0.01)) { res.push([a, b, same, g == null ? null : Math.abs(g)]); if (res.length > MAX_PAIRS) return; }
        }
      });
      return res;
    };
    // More pairs than MAX_PAIRS (a file with hundreds of look-alike documents) are counted in one line, not listed one by one.
    var overflow = function (check, list, what) { if (list.length > MAX_PAIRS) { list.length = MAX_PAIRS; out.push(finding(check, 'More than ' + MAX_PAIRS + ' possible duplicate ' + what + ' pairs: only the first ' + MAX_PAIRS + ' are listed. Review the rest in the platform.')); } return list; };
    if (allow('CHK-055') && allow('CHK-079') && allow('CHK-080')) overflow('CHK-055', pairs('bill'), 'bill').forEach(function (p) {
      var a = p[0], b = p[1], paid = a.status === 'paid' && b.status === 'paid', check = paid ? 'CHK-080' : p[2] ? 'CHK-079' : 'CHK-055';
      out.push(finding(check, 'Bills ' + (a.number || '(no number)') + ' (' + dateText(a.date) + ') and ' + (b.number || '(no number)') + ' (' + dateText(b.date) + ') from ' + b.contact + ' have ' +
        (p[2] ? 'the same invoice number' : 'the same amount ' + p[3] + ' day(s) apart') + (paid ? '. Both are paid: ask the supplier for a refund or credit.' : '. Void one if it\'s the same bill.'),
        { amount: b.total, link: b.link, rows: [row(a), row(b)] }));
    });
    if (allow('CHK-028') && allow('CHK-035')) overflow('CHK-028', pairs('invoice'), 'sales invoice').forEach(function (p) {
      var a = p[0], b = p[1], paid = a.status === 'paid' && b.status === 'paid';
      out.push(finding(paid ? 'CHK-035' : 'CHK-028', 'Sales invoices ' + (a.number || '(no number)') + ' and ' + (b.number || '(no number)') + ' to ' + b.contact +
        (p[2] ? ' have the same number' : ' are for the same amount ' + p[3] + ' day(s) apart') + (paid ? '. Both are paid: check the customer wasn\'t charged twice.' : '. Void one if it\'s the same sale.'),
        { amount: b.total, link: b.link, rows: [row(a), row(b)] }));
    });
    // CHK-087: spend money to a supplier that matches one of their bills (amount within 1%, within 14 days of its date or due date).
    if (allow('CHK-087')) {
      var bills = (L.docs || []).filter(function (d) { return d.kind === 'bill' && (d.status === 'authorised' || d.status === 'paid') && d.contactId; });
      spend.forEach(function (s) {
        if (!s.contactId) return;
        for (var i = 0; i < bills.length; i++) {
          var b = bills[i]; if (b.contactId !== s.contactId || Math.abs(b.total - s.total) > Math.max(1, b.total * 0.01)) continue;
          var near = [b.date, b.due].some(function (x) { var g = gap(x, s.date); return g != null && Math.abs(g) <= 14; });
          if (near) { out.push(finding('CHK-087', 'Spend money of ' + money(s.total) + ' to ' + s.contact + ' on ' + dateText(s.date) + ' looks like bill ' + (b.number || '(no number)') + ' (' + money(b.total) + ', ' + b.status + '). If it paid that bill, apply the payment to the bill instead so it isn\'t paid twice.', { amount: s.total, link: s.link, rows: [row(s), row(b)] })); break; }
        }
      });
    }

    // CHK-008: GST claimed on purchases over $82.50 from a contact with no ABN.
    if (allow('CHK-008')) {
      var noAbn = {};
      purchases.forEach(function (p) { var c = contacts[p.contactId]; if (c && String(c.abn || '').length !== 11 && p.tax > 0 && p.total > LIMIT) (noAbn[c.id] = noAbn[c.id] || []).push(p); });
      var ids = Object.keys(noAbn);
      if (ids.length) {
        var gstOf = {}; ids.forEach(function (id) { gstOf[id] = sum(noAbn[id], 'tax'); });
        ids.sort(function (a, b) { return gstOf[b] - gstOf[a] || (contacts[a].name < contacts[b].name ? -1 : 1); });
        var total = sum(ids, function (id) { return gstOf[id]; });
        out.push(finding('CHK-008', money(total) + ' GST claimed on purchases over ' + money(LIMIT) + ' from ' + ids.length + ' supplier(s) with no ABN on file: ' + ids.slice(0, 8).map(function (id) { return contacts[id].name + ' ' + money(gstOf[id]); }).join(', ') + (ids.length > 8 ? ' and ' + (ids.length - 8) + ' more' : '') + '. Get their ABNs or tax invoices, or the GST can\'t be claimed.',
          { amount: total, link: contacts[ids[0]].link, rows: ids.map(function (id) { return { date: '', kind: 'Supplier', number: '', contact: contacts[id].name, amount: gstOf[id], need: 'ABN, or a tax invoice showing it', link: contacts[id].link || '' }; }) }));
      }
    }
    // CHK-007: suppliers paid in the period without the ABN (or address, where the platform has it) a TPAR needs.
    if (allow('CHK-007')) {
      var paid = {};
      purchases.forEach(function (p) { var c = contacts[p.contactId]; if (c && (String(c.abn || '').length !== 11 || c.address === false)) paid[c.id] = (paid[c.id] || 0) + p.total; });
      var pids = Object.keys(paid).sort(function (a, b) { return contacts[a].name < contacts[b].name ? -1 : 1; });
      if (pids.length) out.push(finding('CHK-007', pids.length + ' supplier(s) paid in the period are missing the ABN or address a TPAR needs: ' + names(pids.map(function (id) { return contacts[id]; })) + '. Only matters if the business lodges a TPAR.',
        { amount: sum(pids, function (id) { return paid[id]; }), rows: pids.map(function (id) { var c = contacts[id]; return { date: '', kind: 'Supplier', number: '', contact: c.name, amount: r2(paid[id]), need: String(c.abn || '').length !== 11 ? (c.address === false ? 'ABN and address' : 'ABN') : 'Address', link: c.link || '' }; }) }));
    }
    // CHK-021 / CHK-086: spend money and bills over $82.50 in the period with nothing attached.
    [['CHK-021', spend, 'spend money transaction(s)'], ['CHK-086', docs.filter(function (d) { return d.kind === 'bill' && live(d); }), 'bill(s)']].forEach(function (x) {
      if (!allow(x[0])) return;
      var bare = x[1].filter(function (r) { return r.attachments === false && r.total > LIMIT; });
      if (bare.length) out.push(finding(x[0], bare.length + ' ' + x[2] + ' over ' + money(LIMIT) + ' have nothing attached (' + names(bare, 'contact') + '). Attach the receipts or ask the client for them.',
        { amount: sum(bare, 'total'), link: bare[0].link, rows: bare.map(function (r) { return row(r, 'Receipt or tax invoice'); }) }));
    });
    // CHK-022: bank transactions in the period, up to the end of last month, that aren't reconciled.
    if (allow('CHK-022')) {
      var cut = lastMonthEnd(L.today); if (L.to < cut) cut = L.to;
      var loose = bank.filter(function (s) { return s.reconciled === false && s.date <= cut; });
      if (loose.length) out.push(finding('CHK-022', loose.length + ' bank transaction(s) dated up to ' + dateText(cut) + ' aren\'t reconciled.', { amount: sum(loose, function (s) { return Math.abs(s.total); }), link: loose[0].link, rows: loose.map(function (s) { return row(s, 'Reconcile to the bank statement'); }) }));
    }
    // CHK-024 / CHK-033: approved sales invoices never sent, and ones still in draft or awaiting approval.
    if (allow('CHK-024')) {
      var unsent = sales.filter(function (d) { return (d.status === 'authorised' || d.status === 'paid') && d.sent === false; });
      if (unsent.length) out.push(finding('CHK-024', unsent.length + ' approved sales invoice(s) were never sent (' + names(unsent, 'number') + '). Send them, or mark them sent if they went another way.', { amount: sum(unsent, 'total'), link: unsent[0].link, rows: unsent.map(function (d) { return row(d); }) }));
    }
    if (allow('CHK-033')) {
      var waiting = sales.filter(function (d) { return d.status === 'draft' || d.status === 'submitted'; });
      if (waiting.length) out.push(finding('CHK-033', waiting.length + ' sales invoice(s) are in draft or awaiting approval (' + names(waiting, 'number') + ').', { amount: sum(waiting, 'total'), link: waiting[0].link, rows: waiting.map(function (d) { return row(d); }) }));
    }
    // CHK-031: GST on sales or credit notes when the business isn't registered for GST.
    if (allow('CHK-031') && L.org && L.org.gst === false) {
      var taxed = docs.filter(function (d) { return (d.kind === 'invoice' || d.kind === 'invoice_credit') && live(d) && d.tax > 0; });
      if (taxed.length) out.push(finding('CHK-031', taxed.length + ' sales invoice(s) or credit note(s) charge GST, but the business isn\'t registered for GST (' + names(taxed, 'number') + ').', { amount: sum(taxed, 'tax'), link: taxed[0].link, rows: taxed.map(function (d) { return row(d, '', d.tax); }) }));
    }
    // CHK-058: GST claimed on accounts that normally carry none (wages, super, bank fees, interest, ASIC fees ...).
    if (allow('CHK-058')) {
      var byAcc = {};
      purchases.forEach(function (p) { (p.lines || []).forEach(function (ln) { var a = accounts[ln.account]; if (a && ln.tax > 0 && (NON_CLAIMABLE.test(a.name) || a.type === 'DEPRECIATN')) (byAcc[ln.account] = byAcc[ln.account] || []).push([p, ln]); }); });
      Object.keys(byAcc).sort().forEach(function (k) {
        var a = accounts[k], rows = byAcc[k], gst = sum(rows, function (x) { return x[1].tax; });
        out.push(finding('CHK-058', money(gst) + ' GST claimed on ' + rows.length + ' line(s) coded to ' + (a.code ? a.code + ' ' : '') + a.name + ', which normally has no GST. Check the tax code.', { amount: gst, link: rows[0][0].link, rows: rows.map(function (x) { return row(x[0], '', x[1].tax); }) }));
      });
    }
    // CHK-059: GST that isn't the rate's share of the line, and one supplier's account coded with GST and without.
    if (allow('CHK-059')) {
      var wrong = [], mixes = {};
      purchases.forEach(function (p) {
        var bad = (p.lines || []).some(function (ln) { var rate = rates[ln.taxCode]; return rate && ln.amount && Math.abs(ln.tax - ln.amount * rate / 100) > Math.max(0.05, Math.abs(ln.amount * rate / 100) * 0.02); });
        if (bad) wrong.push(p);
        (p.lines || []).forEach(function (ln) { if (ln.taxCode && ln.account && p.contactId && rates[ln.taxCode] != null) { var k = p.contactId + '\u0001' + ln.account; (mixes[k] = mixes[k] || []).push(ln.taxCode); } });
      });
      if (wrong.length) out.push(finding('CHK-059', wrong.length + ' purchase(s) have GST that isn\'t the tax rate\'s share of the line (' + names(wrong, 'contact') + '). Check the GST amounts.', { amount: sum(wrong, 'tax'), link: wrong[0].link, rows: wrong.map(function (p) { return row(p, '', p.tax); }) }));
      Object.keys(mixes).sort().forEach(function (k) {
        var types = mixes[k], parts = k.split('\u0001'), c = contacts[parts[0]], a = accounts[parts[1]];
        var withG = {}, without = {}; types.forEach(function (t) { if ((rates[t] || 0) > 0) withG[t] = 1; else without[t] = 1; });
        if (types.length >= 3 && Object.keys(withG).length && Object.keys(without).length && c)
          out.push(finding('CHK-059', 'Purchases from ' + c.name + ' coded to ' + (a ? (a.code ? a.code + ' ' : '') + a.name : parts[1]) + ' use tax codes with GST (' + Object.keys(withG).sort().join(', ') + ') and without (' + Object.keys(without).sort().join(', ') + '). Check which is right.', { link: c.link }));
      });
    }
    // CHK-125: a suspense, clearing or uncoded account carrying a balance.
    if (allow('CHK-125')) (L.accounts || []).forEach(function (a) {
      if (!SUSPENSE.test(a.name) || a.balance == null || Math.abs(a.balance) < 0.005) return;
      out.push(finding('CHK-125', 'Account ' + (a.code ? a.code + ' ' : '') + a.name + ' has a balance of ' + money(Math.abs(a.balance)) + '. Clear it to the right accounts.', { amount: Math.abs(a.balance) }));
    });
    // CHK-129 (heuristic): an account that defaults to GST whose lines in the period mostly have none.
    if (allow('CHK-129')) {
      var usage = {};
      purchases.concat(sales.filter(live)).forEach(function (d) { (d.lines || []).forEach(function (ln) { (usage[ln.account] = usage[ln.account] || []).push(rates[ln.taxCode] || 0); }); });
      Object.keys(usage).sort().forEach(function (k) {
        var a = accounts[k], used = usage[k], zero = used.filter(function (r) { return !r; }).length;
        if (a && (rates[a.taxCode] || 0) > 0 && used.length >= 5 && zero >= 0.8 * used.length)
          out.push(finding('CHK-129', 'Account ' + (a.code ? a.code + ' ' : '') + a.name + ' defaults to GST, but ' + zero + ' of its ' + used.length + ' lines in the period have none. Check the account\'s default tax code, or the coding.'));
      });
    }
    // CHK-132: nothing entered for a month before the end of the period.
    if (allow('CHK-132')) {
      var latest = ''; (L.docs || []).concat(L.bank || []).forEach(function (x) { if (x.date && x.date <= L.to && x.date > latest) latest = x.date; });
      if (!latest || latest < addDays(L.to, -LONELY_DAYS)) out.push(finding('CHK-132', (latest ? 'Nothing has been entered since ' + dateText(latest) : 'Nothing has been entered in the period') + '. Is the bookkeeping up to date, and is the bank feed working?'));
    }
    // CHK-134: no lock date, or one more than 6 months old.
    if (allow('CHK-134') && L.org && L.org.lock != null) {
      if (!L.org.lock) out.push(finding('CHK-134', 'No lock date is set, so past periods can still be changed.'));
      else if (L.org.lock < addDays(L.today, -LOCK_MONTHS * 30)) out.push(finding('CHK-134', 'The lock date is ' + dateText(L.org.lock) + ', more than ' + LOCK_MONTHS + ' months ago. Move it forward to the last period lodged.'));
    } else if (L.org && L.org.lock == null) { delete ran['CHK-134']; na['CHK-134'] = na['CHK-134'] || 'the lock date is not in source'; }
    // CHK-136: income over the GST registration threshold without being registered.
    // A business registered for GST can't be over the threshold without registering: that answers it without the income.
    if (allow('CHK-136') && !(L.org && L.org.gst === true)) {
      if (L.income12 == null || !L.org || L.org.gst == null) { delete ran['CHK-136']; na['CHK-136'] = na['CHK-136'] || 'needs the last 12 months\' income and the GST registration, and one is not in source'; }
      else if (L.org.gst === false && L.income12 >= GST_TURNOVER) out.push(finding('CHK-136', 'Income for the last 12 months is ' + money(L.income12) + ', at or over the ' + money(GST_TURNOVER) + ' GST registration threshold, and the business isn\'t registered for GST.', { amount: L.income12 }));
    }
    if (L.org && L.org.gst == null && !na['CHK-031']) { delete ran['CHK-031']; na['CHK-031'] = 'the business\'s GST registration is not in source'; }

    // CQ-01: lines coded to a suspense, clearing or uncoded account: the client has to say what they were.
    if (allow('CQ-01')) {
      var unc = [];
      docs.filter(live).concat(bank).forEach(function (x) { (x.lines || []).forEach(function (ln) { var a = accounts[ln.account]; if (a && SUSPENSE.test(a.name)) unc.push([x, ln, a]); }); });
      if (unc.length) out.push(finding('CQ-01', unc.length + ' line(s) in the period are coded to a suspense or uncoded account (' + names(unc.map(function (u) { return { name: (u[2].code ? u[2].code + ' ' : '') + u[2].name }; }).filter(function (v, i, s) { return s.map(function (z) { return z.name; }).indexOf(v.name) === i; })) + '). Ask the client what they were for.',
        { amount: sum(unc, function (u) { return Math.abs(u[1].amount + u[1].tax); }), link: unc[0][0].link, rows: unc.map(function (u) { return row(u[0], 'What was this for?', r2(Math.abs(u[1].amount + u[1].tax))); }) }));
    }
    // CQ-02: bank transactions with neither a contact nor a description.
    if (allow('CQ-02')) {
      var bare2 = bank.filter(function (s) { return (s.kind === 'spend' || s.kind === 'receive') && !s.contactId && !String(s.contact || '').trim() && !String(s.desc || '').trim(); });
      if (bare2.length) out.push(finding('CQ-02', bare2.length + ' bank transaction(s) have no contact and no description. Ask the client who they were with and what they were for.', { amount: sum(bare2, function (s) { return Math.abs(s.total); }), link: bare2[0].link, rows: bare2.map(function (s) { return row(s, 'Who was this with, and what was it for?'); }) }));
    }

    out.sort(function (a, b) { return RANK[a.severity] - RANK[b.severity] || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || (a.check < b.check ? -1 : a.check > b.check ? 1 : 0); });
    return { findings: out, ran: ran, na: na, period: { from: L.from, to: L.to }, platform: L.platform };
  }

  // One row per check in a set: ran (clear, or N findings), N/A on this platform (why), or runs overnight (why, where).
  function scope(r, ids) {
    return ids.map(function (id) {
      var c = CAT[id], f = r.findings.filter(function (x) { return x.check === id; });
      var st = r.ran[id] ? (f.length ? 'findings' : 'clear') : REGISTER.indexOf(id) >= 0 || ENGINE[id] ? 'overnight' : 'na';
      var why = st === 'na' ? r.na[id] || 'not in source' : st === 'overnight' ? (REGISTER.indexOf(id) >= 0 ? 'checks the Australian Business Register (Register lookups, nightly)' : 'the overnight engine ' + ENGINE[id]) : '';
      return { check: id, category: c[0], name: c[1], severity: c[2], status: st, count: f.length, amount: sum(f, 'amount'), why: why, heuristic: HEURISTIC.indexOf(id) >= 0 };
    });
  }
  function totals(fs) {
    var t = { count: fs.length, High: 0, Medium: 0, Low: 0, amount: sum(fs, 'amount'), byCat: {} };
    fs.forEach(function (f) { t[f.severity]++; var b = t.byCat[f.category] = t.byCat[f.category] || { count: 0, amount: 0, High: 0, Medium: 0, Low: 0 }; b.count++; b[f.severity]++; b.amount = r2(b.amount + (f.amount || 0)); });
    t.status = t.High ? 'Needs attention' : t.Medium ? 'Review' : 'Good';
    return t;
  }
  var DQ = Object.keys(CAT).filter(function (k) { return k.indexOf('CHK-') === 0; }).sort();

  return { CAT: CAT, CATEGORIES: CATEGORIES, REGISTER: REGISTER, GST: GST, QUERY: QUERY, ENGINE: ENGINE, DQ: DQ, LIMIT: LIMIT, SUSPENSE: SUSPENSE,
    today: function () { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); },
    run: run, scope: scope, totals: totals, money: money, dateText: dateText, addDays: addDays, norm: norm };
})();

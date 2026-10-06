// Contacts (M12): MYOB's contact list (list_contacts — one page of up to 1,000) grouped by type, with each customer's and supplier's
// balance tied to MYOB's open invoices and bills (separate lists). Email and phone show for customers and suppliers only, when MYOB
// returns them (its contact list usually has no addresses); an employee's or personal contact's details never show.
MK.app({
  title: 'Contacts', primary: 'contacts', files: 'company_files',
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { type: 'All', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"custom","c":"none","v":"directory","x":""}' },
  enums: [{ input: 'type', label: 'Contact type', options: [['All', 'All'], ['Customer', 'Customers'], ['Supplier', 'Suppliers']] }],
  uses: { contacts: ['type', 'company_file'], invoices: ['company_file'], bills: ['company_file'], company_files: [] },
  tools: { contacts: 'list_contacts (one page of up to 1,000)', invoices: 'list_invoices (open — customer balances)', bills: 'list_bills (open — supplier balances)', company_files: 'list_company_files' },
  views: [['directory', 'Contacts'], ['balances', 'Balances']],
  render: function (c) {
    var body = c.body, h = MK.h, self = this, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.contacts) { body.innerHTML = '<p class="mk-err">' + h(c.err('contacts')) + '</p>'; return { checks: [{ name: 'Contacts loaded', pass: false, detail: c.err('contacts') }] }; }
    if (!c.data.contacts) return {};
    var raw = MK.items(c.data.contacts), cut = raw.length >= 1000, type = c.inputs.type || 'All', TRADE = { Customer: 1, Supplier: 1 };
    var C = raw.map(function (x) {
      var ad = (x.Addresses || []).filter(function (a) { return a && (a.Email || a.Phone1); })[0] || {}, trade = !!TRADE[x.Type];
      return { name: x.CompanyName || [x.FirstName, x.LastName].filter(Boolean).join(' ') || x.DisplayID || 'N/A', id: x.DisplayID || '', type: x.Type || 'Other', active: x.IsActive !== false,
        email: trade ? ad.Email || '' : '', phone: trade ? ad.Phone1 || '' : '', bal: x.CurrentBalance == null ? null : r2(MK.num(x.CurrentBalance) || 0) };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var hide = c.display.x === 'active', shown = hide ? C.filter(function (r) { return r.active; }) : C;
    var TYPES = ['Customer', 'Supplier', 'Employee', 'Personal'], types = TYPES.concat(Object.keys(C.reduce(function (o, r) { if (TYPES.indexOf(r.type) < 0) o[r.type] = 1; return o; }, {})));
    var PL = { Customer: 'Customers', Supplier: 'Suppliers', Employee: 'Employees', Personal: 'Personal contacts' }, n = function (t) { return C.filter(function (r) { return r.type === t; }).length; };
    var sumT = function (t) { return MK.sum(C.filter(function (r) { return r.type === t; }).map(function (r) { return r.bal; })); }, view = c.view || 'directory';
    var html = MK.kpis([{ label: 'Contacts', money: false, value: C.length }, { label: 'Customers', money: false, value: n('Customer') }, { label: 'Suppliers', money: false, value: n('Supplier') }, { label: 'Inactive', money: false, value: C.filter(function (r) { return !r.active; }).length },
      { label: 'Customers owe you', value: type !== 'Supplier' ? sumT('Customer') : null }, { label: 'You owe suppliers', value: type !== 'Customer' ? sumT('Supplier') : null }], c) +
      (cut ? '<div class="mk-banner fail" style="margin-top:12px">MYOB returned 1,000 contacts — one page — so the list may be cut off. Narrow it with Contact type.</div>' : '') +
      '<div style="display:flex;gap:16px;align-items:center;margin:14px 0 6px"><input id="co-q" type="search" class="mk-filter" style="flex:1;margin:0" placeholder="Search name, ID or email" aria-label="Search contacts" value="' + h(self._q || '') + '">' +
      '<label><input type="checkbox" id="co-active"' + (hide ? ' checked' : '') + '> Hide inactive</label></div>';
    var table = function (rows, withBal) { var em = rows.some(function (r) { return r.email || r.phone; });
      return '<div class="mk-scroll"><table class="mk-grid"><thead><tr><th>Name</th><th>ID</th><th>Status</th>' + (em ? '<th>Email</th><th>Phone</th>' : '') + (withBal ? '<th class="num">Balance ($)</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr data-text="' + h((r.name + ' ' + r.id + ' ' + r.email).toLowerCase()) + '"><td>' + h(r.name) + '</td><td>' + h(r.id) + '</td><td>' + (r.active ? 'Active' : '<span class="muted">Inactive</span>') + '</td>' + (em ? '<td>' + h(r.email) + '</td><td>' + h(r.phone) + '</td>' : '') + (withBal ? '<td class="num">' + (r.bal == null ? '' : money(r.bal)) + '</td>' : '') + '</tr>'; }).join('') +
        '</tbody>' + (withBal ? '<tfoot><tr class="k-total"><td colspan="' + (em ? 5 : 3) + '">Total</td><td class="num">' + money(MK.sum(rows.map(function (r) { return r.bal; }))) + '</td></tr></tfoot>' : '') + '</table></div>'; };
    if (view === 'balances') {
      ['Customer', 'Supplier'].forEach(function (t) { var rows = shown.filter(function (r) { return r.type === t && Math.abs(r.bal || 0) >= 0.005; }).sort(function (a, b) { return (b.bal || 0) - (a.bal || 0); });
        html += '<h3>' + (t === 'Customer' ? 'Customers who owe you' : 'Suppliers you owe') + ' (' + rows.length + ')</h3>' + (rows.length ? table(rows, true) : '<p class="muted">No balances.</p>'); });
    } else types.forEach(function (t) { var rows = shown.filter(function (r) { return r.type === t; }); if (!rows.length) return; html += '<h3>' + h(PL[t] || t) + ' (' + rows.length + ')</h3>' + table(rows, TRADE[t]); });
    body.innerHTML = html + (shown.length ? '' : '<p class="muted">No contacts.</p>');
    var q = document.getElementById('co-q'), filter = function () { var s = (self._q || '').trim().toLowerCase(); body.querySelectorAll('tbody tr[data-text]').forEach(function (tr) { tr.hidden = !!s && tr.getAttribute('data-text').indexOf(s) < 0; }); };
    q.addEventListener('input', function () { self._q = q.value; filter(); }); filter();
    document.getElementById('co-active').addEventListener('change', function () { c.change({}, { x: this.checked ? 'active' : '' }); });
    // ties: the contact list's balances against MYOB's open invoices and bills — separate endpoints
    var tie = function (t, id, field) { if (type !== 'All' && type !== t) return { pass: null, detail: 'N/A — Contact type is ' + type }; if (c.errors[id] || !c.data[id]) return { pass: null, detail: c.err(id) || 'N/A' };
      if (!C.some(function (r) { return r.type === t && r.bal != null; })) return { pass: null, detail: 'N/A — MYOB returned no contact balances' };
      var open = MK.sum(MK.items(c.data[id]).map(function (d) { return MK.num(d[field]); })), bal = sumT(t); return { pass: MK.near(open, bal), detail: money(bal) + ' vs ' + money(open) + (MK.near(open, bal) ? '' : ' — unapplied payments or credits can explain a difference') }; };
    var ti = tie('Customer', 'invoices', 'BalanceDueAmount'), tb = tie('Supplier', 'bills', 'BalanceDueAmount');
    this._x = { C: C };
    return { checks: [
      { name: 'Contacts shown = the contacts MYOB returned', pass: cut ? null : C.length === raw.length, detail: cut ? 'N/A — MYOB returned 1,000 (one page); the list may be cut off' : C.length + ' contacts' },
      { name: 'Customer balances = open invoices (a separate MYOB list)', pass: ti.pass, detail: ti.detail },
      { name: 'Supplier balances = open bills (a separate MYOB list)', pass: tb.pass, detail: tb.detail }],
      title: view === 'balances' ? 'Contact Balances' : 'Contacts', period: 'Contacts' + (type === 'All' ? '' : ' — ' + PL[type]) + ' · today',
      notes: ['MYOB\'s contact list, one page of up to 1,000 contacts. Balances are MYOB\'s current balance for each contact today.', 'Email and phone show for customers and suppliers only, when MYOB returns them; employee and personal contacts never show contact details.'],
      na: ['Addresses (not shown)', 'Contact balances at a past date (MYOB gives today\'s)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Contacts', widths: [34, 14, 12, 10, 32, 18, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contacts', s: 'bold' }], [], ['Name', 'ID', 'Type', 'Status', 'Email', 'Phone', 'Balance ($)'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.C.map(function (r) { return [r.name, r.id, r.type, r.active ? 'Active' : 'Inactive', r.email, r.phone, r.bal == null ? '' : { v: r.bal, s: 'money' }]; })) }];
  }
});

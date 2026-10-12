// CRA-06 Contact Details for BAS Preparation (Xero) — BASE VERSION ONLY. Contacts (list_contacts) with the tax types used on
// their invoices, bills and credit notes in the period, and whether Xero holds a tax number (ABN) for them — evidence only,
// never a verified GST-registration status. Registry (ABR) match is not built: that needs an ABR API credential that has not
// arrived, so it is shown as "N/A — pending ABR" on every row rather than invented. This is a deliberate partial build.
XK.app({
  title: 'Xero · Contact Details for BAS Preparation', noBasis: true, primary: 'contacts', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":""}' },
  uses: { contacts: ['org'], invoices: ['from_date', 'to_date', 'org'], credit_notes: ['from_date', 'to_date', 'org'], tax_rates: ['org'], org: ['org'], connections: [] },
  paged: { contacts: { input: 'page', key: 'Contacts' }, invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' } },
  tools: { contacts: 'list_contacts', invoices: 'list_invoices (sales and bills, with lines, in the period)', credit_notes: 'list_credit_notes (in the period)', tax_rates: 'list_tax_rates (names)', org: 'get_organisation', connections: 'list_connections' },
  presets: [['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  render: function (c) {
    var body = c.body, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['contacts', 'invoices', 'credit_notes', 'tax_rates'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Contacts and transactions loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.contacts || !c.data.tax_rates) return {};
    var TR = {}; ((c.data.tax_rates || {}).TaxRates || []).forEach(function (t) { TR[t.TaxType] = t; });
    var inP = function (d) { return d && d >= from && d <= to; }, used = {}; // ContactID -> Set of tax type names
    var add = function (doc, dd) { if (!inP(dd) || !doc.Contact) return; var id = doc.Contact.ContactID, set = used[id] || (used[id] = {}); (doc.LineItems || []).forEach(function (l) { var tt = l.TaxType || 'NONE'; set[tt] = (TR[tt] || {}).Name || tt; }); };
    c.rows('invoices').forEach(function (d) { add(d, XK.isoDate(d.DateString || d.Date)); });
    c.rows('credit_notes').forEach(function (d) { add(d, XK.isoDate(d.DateString || d.Date)); });
    var contacts = ((c.data.contacts || {}).Contacts || []).slice().sort(function (a, b) { return (a.Name || '').localeCompare(b.Name || ''); });
    var rows = contacts.map(function (ct) {
      var types = Object.keys(used[ct.ContactID] || {}).map(function (k) { return used[ct.ContactID][k]; }).sort();
      return { name: ct.Name || '(no name)', role: [ct.IsCustomer ? 'Customer' : null, ct.IsSupplier ? 'Supplier' : null].filter(Boolean).join(' / ') || 'N/A — not in source',
        gst: ct.TaxNumber ? 'ABN on file (' + ct.TaxNumber + ')' : 'No ABN on file', types: types.length ? types.join(', ') : 'None this period', registry: 'N/A — pending ABR' };
    });
    var withTypes = rows.filter(function (r) { return r.types !== 'None this period'; }).length, withAbn = rows.filter(function (r) { return /^ABN on file/.test(r.gst); }).length;
    body.innerHTML = XK.kpis([{ label: 'Contacts', text: String(rows.length) }, { label: 'With an ABN on file', text: withAbn + ' of ' + rows.length }, { label: 'With tax types this period', text: withTypes + ' of ' + rows.length }], c) +
      '<div class="xk-banner na" style="margin:12px 0"><strong>Registry (ABR) match is not built yet</strong> — it needs an ABR API credential that has not arrived. Every row shows "N/A — pending ABR" rather than a guessed status.</div>' +
      '<div class="xk-card"><h3>Contacts</h3><div id="co-grid"></div></div>';
    XK.grid(document.getElementById('co-grid'), { rows: rows, columns: [{ key: 'name', title: 'Contact' }, { key: 'role', title: 'Role' }, { key: 'gst', title: 'GST evidence on file' }, { key: 'types', title: 'Tax types used ' + XK.periodLine(from, to) }, { key: 'registry', title: 'Registry (ABR) match' }], empty: 'No contacts.' }, c);
    // ---- checks
    var trunc = ['contacts', 'invoices', 'credit_notes'].filter(function (id) { return c.truncated(id); });
    var checks = [
      { name: 'Every contact on an invoice or credit note in the period appears in the list', pass: Object.keys(used).every(function (id) { return contacts.some(function (ct) { return ct.ContactID === id; }); }), detail: rows.length + ' contact(s) from list_contacts' },
      { name: 'GST evidence = whether Xero holds a tax number for the contact (never a verified registration status)', pass: true, detail: withAbn + ' of ' + rows.length + ' contact(s) have a tax number on file' },
      { name: 'Registry (ABR) match', pass: null, info: true, detail: 'N/A — pending ABR: this release has no ABR API credential, so no registry status is shown or guessed' },
      { name: 'All contacts and transactions in the period loaded', pass: !trunc.length, detail: trunc.length ? 'May be truncated (over 20 pages): ' + trunc.join(', ') : rows.length + ' contact(s)' }
    ];
    this._x = { rows: rows };
    return { checks: checks, period: XK.periodLine(from, to),
      notes: ['"GST evidence on file" is whether the contact has a tax number (ABN) recorded in Xero — it is not a verified GST-registration status.', 'Tax types used are read from the contact\'s invoices, bills and credit notes dated in the period.'],
      na: ['Registry (ABR) match — needs an ABR API credential (not yet available); shown as "N/A — pending ABR" rather than guessed'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contact Details for BAS Preparation', s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var rows = head.concat([[{ v: 'Contact', s: 'bold' }, { v: 'Role', s: 'bold' }, { v: 'GST evidence on file', s: 'bold' }, { v: 'Tax types used', s: 'bold' }, { v: 'Registry (ABR) match', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, r.role, r.gst, r.types, r.registry]; }));
    return [{ name: 'Contacts', rows: rows, widths: [30, 18, 28, 36, 20] }];
  }
});

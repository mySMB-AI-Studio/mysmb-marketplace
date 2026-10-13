// CRA-06 Contact Details for BAS Preparation — QuickBooks Online, BASE VERSION ONLY. Customers and Vendors (qbo_query) as the
// contact list. Unlike Xero (Contact.TaxNumber) and MYOB's transaction-level tax codes, this kit has no reliable per-contact
// tax-type-used source for QuickBooks (no per-line TaxCodeRef aggregation built here) and no ABN-equivalent field on the base
// Customer/Vendor entity, so both GST evidence and tax types used read "N/A — not in source" rather than guessed. No ABR
// registry-match column: that needs an ABR API credential that has not arrived, shown as "N/A — pending ABR" on every row.
QB.app({
  title: 'QuickBooks · Contact Details for BAS Preparation', token: null, primary: 'customers', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Practitioner', display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: { customers: [], vendors: [], company_info: [], prefs: [] },
  tools: { customers: 'qbo_query (SELECT * FROM Customer)', vendors: 'qbo_query (SELECT * FROM Vendor)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body;
    if (c.errors.customers || c.errors.vendors) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('customers') || c.err('vendors')) + '</p>'; return { checks: [{ name: 'Contacts loaded', pass: false, detail: c.err('customers') || c.err('vendors') }] }; }
    if (!c.data.customers || !c.data.vendors) return {};
    var cust = ((c.data.customers.QueryResponse || {}).Customer || []).map(function (x) { return { name: x.DisplayName || '(no name)', role: 'Customer', active: x.Active !== false }; });
    var vend = ((c.data.vendors.QueryResponse || {}).Vendor || []).map(function (x) { return { name: x.DisplayName || '(no name)', role: 'Vendor', active: x.Active !== false }; });
    var rows = cust.concat(vend).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (r) { return { name: r.name, role: r.role, status: r.active ? 'Active' : 'Inactive', gst: 'N/A — not in source', types: 'N/A — not built for QuickBooks yet', registry: 'N/A — pending ABR' }; });
    body.innerHTML = QB.kpis([{ label: 'Contacts', text: String(rows.length) }, { label: 'Customers', text: String(cust.length) }, { label: 'Vendors', text: String(vend.length) }], c) +
      '<div class="qb-banner na" style="margin:12px 0"><strong>Registry (ABR) match is not built yet</strong> — it needs an ABR API credential that has not arrived. GST evidence reads "N/A — not in source" (QuickBooks contacts carry no ABN field); tax types used read "N/A — not built for QuickBooks yet" (the codes are on each transaction line, not aggregated per contact yet).</div>' +
      '<div class="qb-card"><h3>Contacts</h3><div id="cb-grid"></div></div>';
    QB.grid(document.getElementById('cb-grid'), { columns: [{ key: 'name', title: 'Contact' }, { key: 'role', title: 'Role' }, { key: 'status', title: 'Status' }, { key: 'gst', title: 'GST evidence on file' }, { key: 'types', title: 'Tax types used' }, { key: 'registry', title: 'Registry (ABR) match' }], rows: rows, empty: 'No contacts.' }, c);
    var checks = [
      { name: 'Every Customer and Vendor loaded', pass: true, detail: cust.length + ' customer(s), ' + vend.length + ' vendor(s)' },
      { name: 'GST evidence on file', pass: null, info: true, detail: 'N/A — not in source: no ABN-equivalent field on the base QuickBooks Customer/Vendor entity in this kit' },
      { name: 'Tax types used', pass: null, info: true, detail: 'N/A — not built for QuickBooks yet: the tax codes are on each invoice and bill line, but this report does not aggregate them per contact yet' },
      { name: 'Registry (ABR) match', pass: null, info: true, detail: 'N/A — pending ABR: this release has no ABR API credential, so no registry status is shown or guessed' }
    ];
    this._x = { rows: rows };
    return { checks: checks,
      notes: ['Contacts are QuickBooks Customers and Vendors (qbo_query). GST evidence and tax types used are N/A — not in source: QuickBooks has no simple per-contact tax-registration field, and this kit does not yet aggregate tax codes per contact from transaction lines the way the Xero and MYOB versions do.'],
      na: ['GST evidence on file (no ABN-equivalent field modelled here)', 'Tax types used (no per-contact tax-code aggregation built yet)', 'Registry (ABR) match — needs an ABR API credential (not yet available); shown as "N/A — pending ABR" rather than guessed'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contact Details for BAS Preparation', s: 'bold' }], []];
    var rows = head.concat([[{ v: 'Contact', s: 'bold' }, { v: 'Role', s: 'bold' }, { v: 'Status', s: 'bold' }, { v: 'GST evidence on file', s: 'bold' }, { v: 'Tax types used', s: 'bold' }, { v: 'Registry (ABR) match', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, r.role, r.status, r.gst, r.types, r.registry]; }));
    return [{ name: 'Contacts', rows: rows, widths: [28, 12, 12, 24, 24, 20] }];
  }
});

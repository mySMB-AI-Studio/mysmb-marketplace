// CRA-06 Contact Details for BAS Preparation (MYOB) — BASE VERSION ONLY. Contacts (list_contacts) with the tax codes used on
// their invoice and bill lines in the period. MYOB's generic contact list carries no ABN/tax-number field, so GST evidence is
// shown honestly as "N/A — not in source" rather than guessed. For the same reason there is no register (ABR) match: the
// register is looked up by ABN, so every row reads "N/A — no ABN in MYOB's contact list" (the Xero version has the column).
var CRA = MK.app({
  title: 'MYOB Contact Details for BAS Preparation', primary: 'contacts', files: 'company_files',
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":""}' },
  uses: { contacts: ['company_file'], invoice_lines: ['from_date', 'to_date', 'company_file'], bill_lines: ['from_date', 'to_date', 'company_file'], tax_codes: ['company_file'], company_files: [] },
  tools: { contacts: 'list_contacts (one page of up to 1,000)', invoice_lines: 'list_invoice_lines (tax codes used, in the period)', bill_lines: 'list_bill_lines (tax codes used, in the period)', tax_codes: 'list_tax_codes (names)', company_files: 'list_company_files' },
  render: function (c) {
    var body = c.body, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date;
    var need = ['contacts', 'invoice_lines', 'bill_lines', 'tax_codes'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Contacts and transactions loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.contacts || !c.data.tax_codes) return {};
    var TC = {}; MK.items(c.data.tax_codes).forEach(function (t) { TC[t.UID] = t.Code; });
    var used = {}; // contact UID -> set of tax code names
    var add = function (party, tc) { if (!party || !party.UID) return; var set = used[party.UID] || (used[party.UID] = {}); set[(tc || {}).Code || TC[(tc || {}).UID] || 'N/A'] = 1; };
    MK.items(c.data.invoice_lines).forEach(function (l) { add(l.Customer, l.TaxCode); });
    MK.items(c.data.bill_lines).forEach(function (l) { add(l.Supplier, l.TaxCode); });
    var contacts = MK.items(c.data.contacts).slice().sort(function (a, b) { return (a.CompanyName || (a.LastName || '')).localeCompare(b.CompanyName || (b.LastName || '')); });
    var rows = contacts.map(function (ct) {
      var name = ct.CompanyName || [ct.FirstName, ct.LastName].filter(Boolean).join(' ') || '(no name)';
      var types = Object.keys(used[ct.UID] || {}).sort();
      return { name: name, role: ct.Type || 'N/A — not in source', gst: 'N/A — not in source', types: types.length ? types.join(', ') : 'None this period', registry: 'N/A — no ABN in MYOB\'s contact list' };
    });
    var withTypes = rows.filter(function (r) { return r.types !== 'None this period'; }).length;
    body.innerHTML = MK.kpis([{ label: 'Contacts', value: rows.length, money: false }, { label: 'With tax codes this period', value: withTypes, money: false }], c) +
      '<div class="mk-banner na" style="margin:12px 0"><strong>No register (ABR) match on MYOB</strong> — the Australian Business Register is looked up by ABN, and MYOB\'s contact list carries no ABN/tax-number field here, so GST evidence and the register column read N/A rather than a guess.</div>' +
      '<div class="mk-card"><h3>Contacts</h3><div id="cb-grid"></div></div>';
    MK.grid(document.getElementById('cb-grid'), { rows: rows, columns: [{ key: 'name', title: 'Contact' }, { key: 'role', title: 'Type' }, { key: 'gst', title: 'GST evidence on file' }, { key: 'types', title: 'Tax codes used ' + MK.periodLine(from, to) }, { key: 'registry', title: 'Registry (ABR) match' }], empty: 'No contacts.' }, c);
    var checks = [
      { name: 'Every contact on an invoice or bill line in the period appears in the list', pass: Object.keys(used).every(function (id) { return contacts.some(function (ct) { return ct.UID === id; }); }), detail: rows.length + ' contact(s) from list_contacts' },
      { name: 'GST evidence on file', pass: null, info: true, detail: 'N/A — not in source: MYOB\'s generic contact list carries no ABN/tax-number field' },
      { name: 'Registry (ABR) match', pass: null, info: true, detail: 'N/A — no ABN to look up: MYOB\'s contact list carries no ABN field (the Xero version shows the register, with ABR Lookup connected)' },
      { name: 'Every page of contacts loaded (up to 1,000)', pass: !(MK.items(c.data.contacts).length >= 1000), detail: rows.length + ' contact(s)' }
    ];
    this._x = { rows: rows };
    return { checks: checks, period: MK.periodLine(from, to),
      notes: ['Tax codes used are read from the contact\'s invoice and bill lines dated in the period (list_invoice_lines / list_bill_lines).', 'GST evidence on file is N/A — not in source: MYOB\'s generic contact list (list_contacts) has no ABN/tax-number field to read here.'],
      na: ['GST evidence on file (no ABN/tax-number field on the MYOB contact)', 'Register (ABR) match — needs an ABN, which MYOB\'s contact list doesn\'t carry'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contact Details for BAS Preparation', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], ['Basis: N/A (contacts and tax codes, not $ figures)'], []];
    var rows = head.concat([[{ v: 'Contact', s: 'bold' }, { v: 'Type', s: 'bold' }, { v: 'GST evidence on file', s: 'bold' }, { v: 'Tax codes used', s: 'bold' }, { v: 'Registry (ABR) match', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, r.role, r.gst, r.types, r.registry]; }));
    return [{ name: 'Contacts', rows: rows, widths: [30, 14, 24, 30, 20] }];
  }
});

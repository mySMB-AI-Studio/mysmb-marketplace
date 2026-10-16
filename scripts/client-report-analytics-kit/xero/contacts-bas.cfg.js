// CRA-06 Contact Details for BAS Preparation (Xero). Contacts (list_contacts) with the tax types used on their invoices,
// bills and credit notes in the period, whether Xero holds a tax number (ABN) for them, and the Australian Business
// Register's record for that ABN (ABR Lookup's abr_lookup_abns): status, GST registration and DGR. The register column
// needs the ABR Lookup extension connected; without it the column says so, and every other column still works.
// Reports can only pass text to a tool, so the ABNs go to abr_lookup_abns as comma-separated strings of up to 40, one
// call each (cfg.fan, after the contacts have loaded). Live only: a snapshot shows the column as not included.
var REG_BATCH = 40;
function regAbn(v) { var d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d : ''; }
function regDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? +m[3] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + m[1] : String(v || ''); }
XK.app({
  title: 'Xero · Contact Details for BAS Preparation', noBasis: true, primary: 'contacts', org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', org: '', page: 1, abn_list: '',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":""}' },
  uses: { contacts: ['org'], invoices: ['from_date', 'to_date', 'org'], credit_notes: ['from_date', 'to_date', 'org'], tax_rates: ['org'], org: ['org'], connections: [], registry: ['abn_list'] },
  paged: { contacts: { input: 'page', key: 'Contacts' }, invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' } },
  tools: { contacts: 'list_contacts', invoices: 'list_invoices (sales and bills, with lines, in the period)', credit_notes: 'list_credit_notes (in the period)', tax_rates: 'list_tax_rates (names)', org: 'get_organisation', connections: 'list_connections', registry: 'abr_lookup_abns (ABR Lookup: the Australian Business Register)' },
  presets: [['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  fan: {
    // Every distinct ABN on the organisation's contacts, in batches of REG_BATCH (each a string under the input's 500 limit).
    registry: function (inputs, c) {
      var seen = {}, abns = [];
      c.rows('contacts').forEach(function (ct) { var a = regAbn(ct.TaxNumber); if (a && !seen[a]) { seen[a] = 1; abns.push(a); } });
      abns.sort(); var out = [];
      for (var i = 0; i < abns.length; i += REG_BATCH) out.push({ key: 'b' + i, inputs: { abn_list: abns.slice(i, i + REG_BATCH).join(',') } });
      return out;
    }
  },
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
    var contacts = c.rows('contacts').slice().sort(function (a, b) { return (a.Name || '').localeCompare(b.Name || ''); });
    // ---- the register (ABR Lookup)
    var regErr = c.errors.registry, noConn = regErr && /needs_connection|connection_unavailable/.test(regErr.code || ''), items = c.fan('registry');
    var reg = {}, regFailed = 0, live = c.live;
    (items || []).forEach(function (it) { if (it.error) { regFailed++; return; } ((it.value || {}).results || []).forEach(function (r) { var a = regAbn(r.abn); if (a) reg[a] = r; }); });
    var dt = regDate;
    var regText = function (abn) {
      if (!abn) return 'N/A — no ABN on file';
      if (!live) return 'N/A — not in this snapshot (open the live report)';
      if (noConn) return 'N/A — connect ABR Lookup';
      if (!items) return 'Checking the register…';
      var r = reg[abn];
      if (!r) return regFailed ? 'N/A — the register lookup failed' : 'N/A — not checked';
      if (r.valid_checksum === false) return 'Invalid ABN (fails the checksum)';
      if (!r.found) return r.error === 'No records found' ? 'Not on the register' : 'N/A — ' + String(r.error || 'lookup failed');
      var st = /cancel/i.test(r.status || '') ? 'Cancelled' + (r.status_from ? ' ' + dt(r.status_from) : '') : 'Active';
      var gst = r.gst_registered ? 'GST registered' + (r.gst_from ? ' since ' + dt(r.gst_from) : '') : 'Not registered for GST' + (r.gst_to ? ' (ended ' + dt(r.gst_to) + ')' : '');
      return st + ' · ' + gst + (r.dgr_endorsed ? ' · DGR' : '') + (r.entity_name ? ' · ' + r.entity_name : '');
    };
    var rows = contacts.map(function (ct) {
      var types = Object.keys(used[ct.ContactID] || {}).map(function (k) { return used[ct.ContactID][k]; }).sort(), abn = regAbn(ct.TaxNumber);
      return { name: ct.Name || '(no name)', role: [ct.IsCustomer ? 'Customer' : null, ct.IsSupplier ? 'Supplier' : null].filter(Boolean).join(' / ') || 'N/A — not in source',
        gst: ct.TaxNumber ? 'ABN on file (' + ct.TaxNumber + ')' : 'No ABN on file', types: types.length ? types.join(', ') : 'None this period', registry: regText(abn), abn: abn };
    });
    var withTypes = rows.filter(function (r) { return r.types !== 'None this period'; }).length, withAbn = rows.filter(function (r) { return /^ABN on file/.test(r.gst); }).length;
    var checked = rows.filter(function (r) { return r.abn && reg[r.abn] && reg[r.abn].found; }), cancelled = checked.filter(function (r) { return /cancel/i.test(reg[r.abn].status || ''); }).length;
    var noGst = checked.filter(function (r) { return !reg[r.abn].gst_registered; }).length;
    var kpis = [{ label: 'Contacts', text: String(rows.length) }, { label: 'With an ABN on file', text: withAbn + ' of ' + rows.length }, { label: 'With tax types this period', text: withTypes + ' of ' + rows.length }];
    if (live && items && !noConn) kpis.push({ label: 'On the register: cancelled · not GST registered', text: cancelled + ' · ' + noGst });
    var banner = noConn ? '<div class="xk-banner na" style="margin:12px 0"><strong>Register (ABR) column needs ABR Lookup</strong> — install the ABR Lookup extension and connect it to see each ABN\'s status, GST registration and DGR status from the Australian Business Register.</div>'
      : !live ? '<div class="xk-banner na" style="margin:12px 0"><strong>The register (ABR) column isn\'t in snapshots</strong> — open the live report to see it.</div>' : '';
    body.innerHTML = XK.kpis(kpis, c) + banner + '<div class="xk-card"><h3>Contacts</h3><div id="co-grid"></div></div>';
    XK.grid(document.getElementById('co-grid'), { rows: rows, columns: [{ key: 'name', title: 'Contact' }, { key: 'role', title: 'Role' }, { key: 'gst', title: 'GST evidence on file' }, { key: 'types', title: 'Tax types used ' + XK.periodLine(from, to) }, { key: 'registry', title: 'Australian Business Register' }], empty: 'No contacts.' }, c);
    // ---- checks
    var trunc = ['contacts', 'invoices', 'credit_notes'].filter(function (id) { return c.truncated(id); });
    var lookedUp = rows.filter(function (r) { return r.abn; }), missing = lookedUp.filter(function (r) { return !reg[r.abn]; }).length;
    var checks = [
      { name: 'Every contact on an invoice or credit note in the period appears in the list', pass: Object.keys(used).every(function (id) { return contacts.some(function (ct) { return ct.ContactID === id; }); }), detail: rows.length + ' contact(s) from list_contacts' },
      { name: 'GST evidence = whether Xero holds a tax number for the contact; the register column is the Australian Business Register\'s own record', pass: true, detail: withAbn + ' of ' + rows.length + ' contact(s) have a tax number on file' },
      // Nothing to look up finishes without a redraw, so it can't wait for the lookups to say so.
      !lookedUp.length ? { name: 'Register (ABR) lookups', pass: null, info: true, detail: 'No contact has an ABN on file, so there is nothing to look up on the register' }
        : noConn ? { name: 'Register (ABR) lookups', pass: null, info: true, detail: 'ABR Lookup is not connected, so the register column reads "N/A — connect ABR Lookup"' }
        : !live ? { name: 'Register (ABR) lookups', pass: null, info: true, detail: 'Not in snapshots: the register column is looked up when the live report opens' }
        : { name: 'Every ABN on file was looked up on the register', pass: items ? missing === 0 : null, info: !items, detail: items ? (lookedUp.length - missing) + ' of ' + lookedUp.length + ' ABN(s) looked up' + (regFailed ? '; ' + regFailed + ' batch(es) failed' : '') : 'Looking up ' + lookedUp.length + ' ABN(s)…' },
      { name: 'All contacts and transactions in the period loaded', pass: !trunc.length, detail: trunc.length ? 'May be truncated (over 20 pages): ' + trunc.join(', ') : rows.length + ' contact(s)' }
    ];
    this._x = { rows: rows };
    return { checks: checks, period: XK.periodLine(from, to),
      notes: ['"GST evidence on file" is whether the contact has a tax number (ABN) recorded in Xero.', 'The Australian Business Register column is the register\'s own record for that ABN today: active or cancelled, GST registration and deductible gift recipient (DGR) status.', 'Tax types used are read from the contact\'s invoices, bills and credit notes dated in the period.'],
      na: noConn ? ['Australian Business Register — needs the ABR Lookup extension, connected'] : [] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Contact Details for BAS Preparation', s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var rows = head.concat([[{ v: 'Contact', s: 'bold' }, { v: 'Role', s: 'bold' }, { v: 'GST evidence on file', s: 'bold' }, { v: 'Tax types used', s: 'bold' }, { v: 'Australian Business Register', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, r.role, r.gst, r.types, r.registry]; }));
    return [{ name: 'Contacts', rows: rows, widths: [30, 18, 28, 36, 48] }];
  }
});

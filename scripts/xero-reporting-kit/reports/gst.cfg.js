XK.app({
  title: 'GST summary', basisLabel: 'Accrual (invoice)', primary: 'bs_end', dated: ['bs_end'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { inv_ids: '', from_date: '2026-04-01', to_date: '2026-06-30', prev_end: '2026-03-31', date_where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"statement"}' },
  uses: { payments: ['date_where', 'org'], paid_inv: ['inv_ids', 'org'], pay_runs: ['org'], invoices: ['date_where', 'org'], credit_notes: ['date_where', 'org'], bank_tx: ['date_where', 'org'], tax_rates: ['org'], accounts: ['org'], bs_end: ['to_date', 'org'], bs_start: ['prev_end', 'org'], org: ['org'], connections: [] },
  paged: { payments: { input: 'page', key: 'Payments' }, invoices: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, bank_tx: { input: 'page', key: 'BankTransactions' }, pay_runs: { input: 'page', key: 'PayRuns' } },
  sources: { pay_runs: { name: 'Xero Payroll (Australia)', optional: true }, paid_inv: { name: 'Paid invoices', optional: true, quiet: function (i) { return !i.inv_ids; } } },
  fan: { paid_inv: function (inp, c) { var o = ((c.data.org || {}).Organisations || [])[0] || {}; if (!/PAYMENT|CASH/i.test(o.SalesTaxBasis || '')) return []; var ids = {}; c.rows('payments').forEach(function (p) { var id = (p.Invoice || {}).InvoiceID; if (id && p.Status !== 'DELETED') ids[id] = 1; }); var all = Object.keys(ids), out = []; for (var i = 0; i < all.length; i += 12) out.push({ key: 'b' + i, inputs: { inv_ids: all.slice(i, i + 12).join(',') } }); return out; } },
  mechanism: 'xero-accounting and xero-payroll-au connectors — mySMB custom MCPs on the Xero Accounting and Payroll AU APIs (AGT-001)',
  tools: { payments: 'list_payments (in the period — cash-basis GST)', paid_inv: 'list_invoices (the invoices and bills those payments paid, by id)', pay_runs: 'list_pay_runs (xero-payroll-au — W1 / W2)', invoices: 'list_invoices (sales invoices and bills in the period, with lines)', credit_notes: 'list_credit_notes (in the period)', bank_tx: 'list_bank_transactions (spend / receive money in the period)', tax_rates: 'list_tax_rates (BAS reporting type of each tax rate)', accounts: 'list_accounts (the GST account)', bs_end: 'get_balance_sheet (GST at the period end)', bs_start: 'get_balance_sheet (GST the day before the period)', org: 'get_organisation (GST basis and period)', connections: 'list_connections' },
  presets: [['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_month', 'This month'], ['last_month', 'Last month'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  views: [['statement', 'Statement'], ['list', 'Statements list'], ['lines', 'Tax lines']],
  derive: function (inp) { return { prev_end: XK.addDaysIso(inp.from_date, -1), date_where: XK.dateWhere('Date', inp.from_date, inp.to_date) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var need = ['invoices', 'credit_notes', 'bank_tx', 'tax_rates'].filter(function (id) { return c.errors[id]; });
    if (need.length) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'Documents and tax rates loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (!c.data.invoices || !c.data.tax_rates) return {};
    var from = c.inputs.from_date, to = c.inputs.to_date, org = ((c.data.org || {}).Organisations || [])[0] || {}, cashBasis = /PAYMENT|CASH/i.test(org.SalesTaxBasis || '');
    var RTT = {}; ((c.data.tax_rates || {}).TaxRates || []).forEach(function (t) { RTT[t.TaxType] = t.ReportTaxType || t.TaxType; });
    var F = { G1: 0, G2: 0, G3: 0, G4: 0, G10: 0, G11: 0, '1A': 0, '1B': 0 }, lines = [], unmapped = {}, docTaxOk = true, docs = 0;
    var inP = function (d) { return d && d >= from && d <= to; };
    var add = function (doc, side, sign, typeLabel) {
      var dd = XK.isoDate(doc.DateString || doc.Date); if (!inP(dd)) return; docs++;
      var lt = 0, amtT = doc.LineAmountTypes || 'Exclusive';
      (doc.LineItems || []).forEach(function (l) {
        var rt = RTT[l.TaxType] || l.TaxType || 'NONE', tax = XK.num(l.TaxAmount) || 0, amt = XK.num(l.LineAmount) || 0, gross = amtT === 'Inclusive' ? amt : amt + tax;
        lt += tax; gross = r2(sign * gross); tax = r2(sign * tax);
        var f = [];
        if (side === 'sales') { if (/^(OUTPUT|EXEMPTOUTPUT|EXEMPTEXPORT|INPUTTAXED)$/.test(rt)) { F.G1 = r2(F.G1 + gross); f.push('G1'); } if (rt === 'EXEMPTEXPORT') { F.G2 = r2(F.G2 + gross); f.push('G2'); } if (rt === 'EXEMPTOUTPUT') { F.G3 = r2(F.G3 + gross); f.push('G3'); } if (rt === 'INPUTTAXED') { F.G4 = r2(F.G4 + gross); f.push('G4'); } if (rt === 'OUTPUT') { F['1A'] = r2(F['1A'] + tax); f.push('1A'); } }
        else { if (/^(CAPEXINPUT|EXEMPTCAPITAL|GSTONCAPIMPORTS)$/.test(rt)) { F.G10 = r2(F.G10 + gross); f.push('G10'); } if (/^(INPUT|EXEMPTEXPENSES|INPUTTAXED|GSTONIMPORTS)$/.test(rt)) { F.G11 = r2(F.G11 + gross); f.push('G11'); } if (/^(INPUT|CAPEXINPUT|GSTONIMPORTS|GSTONCAPIMPORTS)$/.test(rt)) { F['1B'] = r2(F['1B'] + tax); f.push('1B'); } }
        if (!f.length && rt !== 'BASEXCLUDED' && rt !== 'NONE') unmapped[rt] = (unmapped[rt] || 0) + 1;
        lines.push({ date: dd, doc: typeLabel + ' ' + (doc.InvoiceNumber || doc.CreditNoteNumber || doc.Reference || ''), contact: (doc.Contact || {}).Name || '', account: l.AccountCode || '', tax: rt, gross: gross, gst: tax, fields: f.join(', ') || (rt === 'BASEXCLUDED' ? 'BAS excluded' : '—') });
      });
      if (!XK.near(r2(lt), XK.num(doc.TotalTax) || 0)) docTaxOk = false;
    };
    // invoice basis: invoices and bills dated in the period. Cash basis: the GST on each payment in the period, in proportion to
    // the share of its invoice it paid (Xero's cash-basis GST); spend / receive money is cash either way.
    var fin = c.fan('paid_inv'), byId = {}, cashDone = cashBasis && fin != null && fin.every(function (x) { return !x.error; }), nPay = 0;
    if (fin) fin.forEach(function (x) { ((x.value || {}).Invoices || []).forEach(function (d) { byId[d.InvoiceID] = d; }); });
    if (cashDone) c.rows('payments').forEach(function (p) { var d = byId[(p.Invoice || {}).InvoiceID], tot = d ? XK.num(d.Total) : 0, k = tot ? (XK.num(p.Amount) || 0) / tot : 0; if (!d || !k || p.Status === 'DELETED') return; nPay++;
      add(Object.assign({}, d, { DateString: XK.isoDate(p.Date), TotalTax: (XK.num(d.TotalTax) || 0) * k, LineItems: (d.LineItems || []).map(function (l) { return Object.assign({}, l, { LineAmount: (XK.num(l.LineAmount) || 0) * k, TaxAmount: (XK.num(l.TaxAmount) || 0) * k }); }) }), d.Type === 'ACCREC' ? 'sales' : 'purchases', 1, (d.Type === 'ACCREC' ? 'Invoice' : 'Bill') + ' payment'); });
    else c.rows('invoices').forEach(function (d) { if (d.Status === 'AUTHORISED' || d.Status === 'PAID') add(d, d.Type === 'ACCREC' ? 'sales' : 'purchases', 1, d.Type === 'ACCREC' ? 'Invoice' : 'Bill'); });
    c.rows('credit_notes').forEach(function (d) { if (/^(AUTHORISED|PAID)$/.test(d.Status || '')) add(d, d.Type === 'ACCRECCREDIT' ? 'sales' : 'purchases', -1, 'Credit note'); });
    c.rows('bank_tx').forEach(function (d) { if (d.Status === 'AUTHORISED' && (d.Type === 'RECEIVE' || d.Type === 'SPEND')) add(d, d.Type === 'RECEIVE' ? 'sales' : 'purchases', 1, d.Type === 'RECEIVE' ? 'Receive money' : 'Spend money'); });
    var net = r2(F['1A'] - F['1B']);
    // PAYG withholding: W1 = gross wages and W2 = tax withheld on pay runs posted with a payment date in the period
    var prOk = !c.errors.pay_runs && !!c.data.pay_runs, runs = prOk ? c.rows('pay_runs').map(function (r) { return { pay: XK.isoDate(r.PaymentDate), status: r.PayRunStatus || '', wages: XK.num(r.Wages) || 0, tax: XK.num(r.Tax) || 0 }; }).filter(function (r) { return inP(r.pay); }) : [];
    var posted = runs.filter(function (r) { return r.status === 'POSTED'; }), drafts = runs.length - posted.length;
    var W1 = prOk ? XK.sum(posted.map(function (r) { return r.wages; })) : null, W2 = prOk ? XK.sum(posted.map(function (r) { return r.tax; })) : null;
    // due date: ATO standard lodgement dates (quarterly 28th of the month after, Oct–Dec 28 Feb; monthly 21st)
    var pe = XK.parse(to), monthly = /MONTH/i.test(org.SalesTaxPeriod || '') && !/TWO/i.test(org.SalesTaxPeriod || ''), dueDate = (function () { var y = pe.getUTCFullYear(), m = pe.getUTCMonth() + 1; if (monthly) return XK.iso(new Date(Date.UTC(y, m, 21))); if (m === 12) return (y + 1) + '-02-28'; return XK.iso(new Date(Date.UTC(y, m, 28))); })();
    // GST account movement on the Balance Sheet vs net GST − payments / refunds coded to the GST account in the period
    var gstRow = function (v) { var w = v ? XK.walk(v) : null, l = w ? w.lines.filter(function (x) { return x.kind === 'row' && /^gst$|^gst (payable|liability)/i.test(x.label); })[0] : null; return l ? { v: l.values[0], id: l.id } : null; };
    var g1 = gstRow(c.data.bs_end), g0 = gstRow(c.data.bs_start), acc = ((c.data.accounts || {}).Accounts || []).filter(function (a) { return g1 && a.AccountID === g1.id; })[0], code = acc ? acc.Code : null;
    var settled = 0; if (code) c.rows('bank_tx').forEach(function (d) { var dd = XK.isoDate(d.DateString || d.Date); if (!inP(dd) || d.Status !== 'AUTHORISED') return; (d.LineItems || []).forEach(function (l) { if (l.AccountCode === code) settled = r2(settled + (d.Type === 'SPEND' ? 1 : -1) * (XK.num(l.LineAmount) || 0)); }); });
    var move = g1 && g0 ? r2(g1.v - g0.v) : null;
    var view = c.view || 'statement', fld = function (code2, label, v) { return '<tr><td class="num" style="width:60px"><strong>' + code2 + '</strong></td><td>' + label + '</td><td class="num">' + (v == null ? 'N/A — not in source' : money(v)) + '</td></tr>'; };
    var html = '<div class="xk-banner na" style="margin-bottom:12px"><strong>This is not your Activity Statement</strong> — a GST summary calculated from your Xero transactions. Lodge from Xero → Tax → Activity statements.' + (cashBasis ? (cashDone ? ' Your GST is reported on the <strong>cash</strong> basis: these figures are the GST on payments received and made in the period.' : ' Your GST is reported on the <strong>cash</strong> basis: ' + (fin == null ? 'loading the payments\' invoices…' : 'some paid invoices could not be loaded, so these figures are on the invoice basis.') ) : '') + '</div>';
    if (view === 'statement') {
      html += '<div class="xk-grid2"><div class="xk-card"><h3>GST — ' + XK.h(XK.periodLine(from, to).replace(/^For the /, '')) + '</h3><table class="xk-grid"><tbody>' + fld('G1', 'Total sales (including any GST)', F.G1) + fld('G2', 'Export sales', F.G2) + fld('G3', 'Other GST-free sales', F.G3) + fld('G4', 'Input taxed sales', F.G4) + fld('G10', 'Capital purchases (including any GST)', F.G10) + fld('G11', 'Non-capital purchases (including any GST)', F.G11) + fld('1A', 'GST on sales', F['1A']) + fld('1B', 'GST on purchases', F['1B']) + '</tbody></table></div>' +
        '<div class="xk-card"><h3>PAYG and summary</h3><table class="xk-grid"><tbody>' + fld('W1', 'Total salary, wages and other payments', W1) + fld('W2', 'Amounts withheld from payments at W1', W2) + fld('W4', 'Amounts withheld where no ABN is quoted', null) + fld('W3', 'Other amounts withheld', null) +
        fld('T1', 'PAYG instalment income', null) + fld('T2', 'New varied rate / instalment rate', null) + fld('5A', 'PAYG instalment amount', null) + '</tbody></table>' +
        '<p class="muted">' + (prOk ? 'W1 / W2: ' + posted.length + ' pay run' + (posted.length === 1 ? '' : 's') + ' posted with a payment date in the period (Xero Payroll AU)' + (drafts ? '; ' + drafts + ' draft pay run' + (drafts === 1 ? ' is' : 's are') + ' not included' : '') + '.' : 'W1 / W2: ' + XK.h(c.err('pay_runs') || 'Xero Payroll (Australia) is not available') + '') + ' W3, W4 and PAYG instalments (T1, T2, 5A) are not in the Xero APIs.</p>' +
        '<div class="xk-kpi" style="margin-top:12px"><div class="lbl">' + (net >= 0 ? 'Net GST payable' : 'Net GST refundable') + ' (1A − 1B)</div><div class="val">' + money(Math.abs(net)) + '</div><div class="sub">Due ' + XK.asOfLine(dueDate).replace(/^As at /, '') + ' (ATO standard date; lodgement programs can differ)</div></div></div></div>';
    } else if (view === 'list') {
      var step = monthly ? 1 : 3, q0 = XK.parse(XK.preset(monthly ? 'this_month' : 'this_quarter', c.fy.month).start), qs = []; for (var i = 1; i <= (monthly ? 6 : 4); i++) { var qa = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() - step * i, 1)), qb = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() - step * i + step, 0)); qs.push({ start: XK.iso(qa), end: XK.iso(qb) }); }
      html += '<div class="xk-card"><h3>Statements' + (monthly ? ' (monthly GST)' : ' (quarterly GST)') + '</h3><table class="xk-grid"><thead><tr><th>Period</th><th>Types</th><th>Status</th><th></th></tr></thead><tbody>' + qs.map(function (q) { return '<tr><td>' + XK.h(XK.periodLine(q.start, q.end).replace(/^For the /, '')) + '</td><td>GST</td><td class="muted">N/A — statement status is not in the Xero API</td><td><button type="button" class="xk-link" data-q="' + q.start + '|' + q.end + '">Show GST summary</button></td></tr>'; }).join('') + '</tbody></table><p class="muted">ATO connection and filed / draft status: open Xero → Tax → Activity statements.</p></div>';
    } else html += '<div class="xk-card"><h3>Tax lines</h3><div id="gst-lines"></div></div>';
    body.innerHTML = html;
    if (view === 'lines') XK.grid(document.getElementById('gst-lines'), { filter: true, rows: lines, columns: [{ key: 'date', title: 'Date' }, { key: 'doc', title: 'Document' }, { key: 'contact', title: 'Contact' }, { key: 'account', title: 'Account' }, { key: 'tax', title: 'Tax type' }, { key: 'gross', title: 'Amount incl. GST', money: true }, { key: 'gst', title: 'GST', money: true }, { key: 'fields', title: 'BAS fields' }], empty: 'No GST lines in this period.' }, c);
    body.querySelectorAll('button[data-q]').forEach(function (b) { b.addEventListener('click', function () { var p = b.getAttribute('data-q').split('|'); c.change({ from_date: p[0], to_date: p[1] }, { p: 'custom', v: 'statement' }); }); });
    var ids = ['invoices', 'credit_notes', 'bank_tx'];
    var checks = [
      { name: '1A − 1B = net GST ' + (net >= 0 ? 'payable' : 'refundable'), pass: XK.near(net, F['1A'] - F['1B']), detail: money(F['1A']) + ' − ' + money(F['1B']) + ' = ' + money(net) },
      { name: 'GST on each document\'s lines = the document\'s total tax', pass: docs ? docTaxOk : null, detail: docs + ' document(s)' },
      { name: 'G1 ≥ G2 + G3 + G4 (exports, GST-free and input-taxed sales are part of total sales)', pass: F.G1 + 0.005 >= F.G2 + F.G3 + F.G4, detail: money(F.G1) + ' ≥ ' + money(r2(F.G2 + F.G3 + F.G4)) },
      { name: 'Every tax rate used maps to a BAS field', pass: Object.keys(unmapped).length === 0, detail: Object.keys(unmapped).length ? 'Not mapped: ' + Object.keys(unmapped).join(', ') : lines.length + ' line(s)' },
      move == null ? { name: 'GST account movement on the Balance Sheet = net GST − GST paid to the ATO', pass: null, detail: c.err('bs_end') || c.err('bs_start') || 'No GST line on the Balance Sheet' }
        : cashDone ? { name: 'GST account movement on the Balance Sheet vs net GST (information — cash basis)', pass: null, info: true, detail: money(move) + ' movement · ' + money(net) + ' net GST on payments · ' + nPay + ' payment(s)' }
        : { name: 'GST account movement on the Balance Sheet = net GST − GST paid to the ATO', pass: code ? XK.near(move, r2(net - settled)) : null, detail: code ? money(move) + ' = ' + money(net) + ' − ' + money(settled) + ' paid' : 'GST account code unknown' },
      { name: 'All documents in the period loaded', pass: ids.some(function (id) { return c.errors[id] || c.truncated(id); }) ? false : true, detail: docs + ' document(s)' }
    ];
    if (cashBasis) checks.push({ name: 'Cash basis: every payment\'s invoice loaded', pass: fin == null ? null : cashDone && nPay === c.rows('payments').filter(function (p) { return p.Status !== 'DELETED' && (p.Invoice || {}).InvoiceID; }).length, detail: fin == null ? (c.live ? 'Loading' : 'Needs the live report') : nPay + ' of ' + c.rows('payments').length + ' payment(s)' });
    if (prOk) checks.push({ name: 'W2 consistent with W1 (tax withheld between 0% and 47% of wages — the top marginal rate with the Medicare levy)', pass: W1 > 0 ? W2 >= 0 && W2 <= W1 * 0.47 + 0.005 : XK.near(W2, 0), detail: W1 > 0 ? money(W2) + ' = ' + XK.pct(W2 / W1) + ' of ' + money(W1) : 'No wages paid in the period' },
      { name: 'All pay runs loaded', pass: c.truncated('pay_runs') ? false : true, detail: runs.length + ' pay run(s) paid in the period' });
    this._x = { F: F, net: net, lines: lines, dueDate: dueDate, W1: W1, W2: W2 };
    return { checks: checks, notes: ['Calculated from the GST on invoice, bill, credit-note and spend / receive money lines dated in the period (invoice basis), mapped through each tax rate\'s BAS reporting type.', 'Manual journals with GST are not included.'],
      na: ['BAS lodgement status, ATO connection, W3 / W4 and PAYG instalments (T1, T2, 5A) — not in the Xero APIs'].concat(prOk ? [] : ['W1 / W2 (Xero Payroll (Australia) not available for this organisation)']), period: XK.periodLine(from, to) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'GST summary (not your Activity Statement)', s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], [{ v: 'Field', s: 'bold' }, { v: 'Amount', s: 'bold' }]]
      .concat(['G1', 'G2', 'G3', 'G4', 'G10', 'G11', '1A', '1B'].map(function (k) { return [k, { v: x.F[k], s: 'money' }]; })).concat([[{ v: '1A − 1B', s: 'bold' }, { v: x.net, s: 'moneyBold' }], ['Due', x.dueDate], [], ['W1', x.W1 == null ? 'N/A — not in source' : { v: x.W1, s: 'money' }], ['W2', x.W2 == null ? 'N/A — not in source' : { v: x.W2, s: 'money' }]]);
    var ln = [[{ v: 'Date', s: 'bold' }, { v: 'Document', s: 'bold' }, { v: 'Contact', s: 'bold' }, { v: 'Account', s: 'bold' }, { v: 'Tax type', s: 'bold' }, { v: 'Amount incl. GST', s: 'bold' }, { v: 'GST', s: 'bold' }, { v: 'BAS fields', s: 'bold' }]].concat(x.lines.map(function (l) { return [l.date, l.doc, l.contact, l.account, l.tax, { v: l.gross, s: 'money' }, { v: l.gst, s: 'money' }, l.fields]; }));
    return [{ name: 'GST summary', rows: rows, widths: [20, 18] }, { name: 'Tax lines', rows: ln, widths: [12, 20, 28, 10, 14, 16, 12, 14] }];
  }
});

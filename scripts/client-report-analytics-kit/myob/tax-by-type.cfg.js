// CRA-05 Summary of Tax Amounts by Type (MYOB) — Client Report Analytics. GST per tax code for each month of the period (BAS preparation
// review). MYOB's tax code summary (get_gst_summary = Report/TaxCodeSummary) is called once for the period and once per month: the month
// calls must add up to the period call, code by code; the period's net GST is reconciled to the GST accounts' movement in the journals.
// The month calls: the kit has no fan-out, so the report asks for each month after opening through MyHubReport.getData on one binding
// (gst_month, its dates are inputs), two at a time with a retry on HTTP 429 — the 8-input / 12-binding caps leave no room for a binding
// per month. Month 1 comes with the bundle (m_from / m_to follow the period's first month); a snapshot shows the period column only.
var CRA_FAN = { sig: null, res: {}, err: {}, left: 0 };
var CRA_VIEW = { code: '' };
var CRA = MK.app({
  title: 'MYOB Summary of Tax Amounts by Type', primary: 'gst', files: 'company_files', optional: ['tax_codes'],
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-04-01', to_date: '2026-06-30', basis: 'Accrual', company_file: '', persona: 'Bookkeeper', m_from: '2026-04-01', m_to: '2026-04-30',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst"}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter (BAS)'], ['this_fy', 'This financial year'], ['last_fy', 'Last financial year'], ['custom', 'Custom']],
  uses: { gst: ['from_date', 'to_date', 'basis', 'company_file'], gst_month: ['m_from', 'm_to', 'basis', 'company_file'], tax_codes: ['company_file'], journals: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { gst: 'get_gst_summary (the period)', gst_month: 'get_gst_summary (each month of the period)', tax_codes: 'list_tax_codes (names, rates and GST accounts)', journals: 'list_journal_transactions (the GST accounts’ movement)', accounts: 'list_accounts (GST and bank accounts)', company_files: 'list_company_files' },
  views: [['gst', 'GST amounts'], ['net', 'Net amounts (excl. GST)'], ['gross', 'Amounts as MYOB reports them']],
  derive: function (inp) { var f = inp.from_date, x = MK.parse(f), e = MK.iso(MK.eom(x.getUTCFullYear(), x.getUTCMonth() + 1)); return { m_from: f, m_to: e < inp.to_date ? e : inp.to_date }; },
  render: function (c) {
    var body = c.body, d = c.display, h = MK.h, money = function (v) { return MK.money(v, c.currency, d); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    var I = c.inputs, from = I.from_date, to = I.to_date, cash = I.basis === 'Cash', self = this, MH = window.MyHubReport;
    if (c.errors.gst) { body.innerHTML = '<p class="mk-err">' + h(c.err('gst')) + '</p>'; self._x = null; return { checks: [{ name: 'GST figures loaded (MYOB tax code summary for the period)', pass: false, detail: c.err('gst') }] }; }
    if (!c.data.gst) return {};
    // ---- the months of the period (a part month at either end keeps the period's own dates)
    var months = [], cur = MK.parse(from);
    while (MK.iso(cur) <= to && months.length <= 24) { var s = MK.iso(cur), e = MK.iso(MK.eom(cur.getUTCFullYear(), cur.getUTCMonth() + 1)); s = s < from ? from : s; e = e > to ? to : e;
      months.push({ key: s.slice(0, 7), label: MK.MONTHS[cur.getUTCMonth()].slice(0, 3) + ' ' + String(cur.getUTCFullYear()).slice(2), from: s, to: e }); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); }
    var tooLong = months.length > 24; if (tooLong) months = [];
    // ---- month figures: month 1 from the bundle when it ran at month 1's dates, the rest fetched after opening (live only)
    var dOf = function (v) { return String(v || '').slice(0, 10); }, gm = c.data.gst_month, sig = [I.company_file, from, to, I.basis].join('|');
    var m1ok = gm && months.length && dOf(gm.StartDate) === months[0].from && dOf(gm.EndDate) === months[0].to;
    if (c.live && MH && CRA_FAN.sig !== sig && months.length) {
      var F = CRA_FAN = { sig: sig, res: {}, err: {}, left: 0 }, jobs = months.filter(function (m, i) { return !(i === 0 && m1ok); });
      F.left = jobs.length; var next = 0, RATE = /\b429\b|rate.?limit|too many requests/i, wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var one = function (m, tries) { return MH.getData('gst_month', Object.assign({}, I, { m_from: m.from, m_to: m.to })).then(function (v) { if (CRA_FAN !== F) return; var er = MK.errorOf(v); if (er) F.err[m.key] = er; else F.res[m.key] = v; },
        function (e) { var msg = (e && e.message) || String(e); if (RATE.test(msg) && tries < 3) return wait((tries + 1) * 700).then(function () { return one(m, tries + 1); }); if (CRA_FAN === F) F.err[m.key] = msg; }); };
      var worker = function () { if (next >= jobs.length || CRA_FAN !== F) return Promise.resolve(); var m = jobs[next++]; return one(m, 0).then(function () { F.left--; return worker(); }); };
      if (jobs.length) Promise.all([worker(), worker()]).then(function () { if (CRA_FAN === F) CRA.render(); });
    }
    var monthData = function (m, i) { if (i === 0 && m1ok) return gm; return CRA_FAN.sig === sig ? CRA_FAN.res[m.key] || null : null; };
    var pending = c.live && CRA_FAN.sig === sig && CRA_FAN.left > 0;
    // ---- tax codes: names, types and rates (list_tax_codes); the summary's rows per code
    var codes = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t && t.Code) codes[String(t.Code).toUpperCase()] = { name: t.Description || '', type: t.Type || '', rate: MK.num(t.Rate) }; });
    var rowsOf = function (g) { var o = {}; ((g && g.TaxCodeBreakdown) || []).forEach(function (r) { var k = String((r.TaxCode || {}).Code || '?').toUpperCase(), x = o[k] || (o[k] = { s: 0, p: 0, tc: 0, tp: 0, rate: null });
      x.s = r2(x.s + (MK.num(r.SalesTotal) || 0)); x.p = r2(x.p + (MK.num(r.PurchasesTotal) || 0)); x.tc = r2(x.tc + (MK.num(r.TaxCollected) || 0)); x.tp = r2(x.tp + (MK.num(r.TaxPaid) || 0)); if (r.TaxRate != null) x.rate = MK.num(r.TaxRate); }); return o; };
    var P = rowsOf(c.data.gst), M = months.map(function (m, i) { var g = monthData(m, i); return g ? rowsOf(g) : null; }), allM = months.length && M.every(Boolean);
    var keys = {}; Object.keys(P).forEach(function (k) { keys[k] = 1; }); M.forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
    keys = Object.keys(keys).sort();
    var rateOf = function (k) { var t = codes[k]; return t && t.rate != null ? t.rate : P[k] && P[k].rate != null ? P[k].rate : null; };
    // MYOB's sales / purchases totals include GST (its sample: total / 11 = tax); detect a file whose don't, as the GST Summary report does
    var big = keys.map(function (k) { return Object.assign({ k: k, rate: rateOf(k) }, P[k]); }).filter(function (r) { return r.rate > 0 && (r.s || r.p); }).sort(function (a, b) { return (b.s + b.p) - (a.s + a.p); })[0];
    var excl = !!big && (big.s ? MK.near(big.tc, big.s * big.rate / 100, Math.max(1, big.tc * 0.002)) && !MK.near(big.tc, big.s * big.rate / (100 + big.rate), Math.max(1, big.tc * 0.002)) : MK.near(big.tp, big.p * big.rate / 100, Math.max(1, big.tp * 0.002)) && !MK.near(big.tp, big.p * big.rate / (100 + big.rate), Math.max(1, big.tp * 0.002)));
    var view = c.view || 'gst', cell = function (x, side) { if (!x) return 0; var g = side === 's' ? x.s : x.p, t = side === 's' ? x.tc : x.tp; return view === 'gst' ? t : view === 'net' ? (excl ? g : r2(g - t)) : g; };
    // grid rows: each code's sales side and purchases side (when either has figures)
    var lines = []; keys.forEach(function (k) { ['s', 'p'].forEach(function (side) { var any = [P[k]].concat(M).some(function (o) { var x = o && o[k]; return x && (Math.abs(side === 's' ? x.s : x.p) >= 0.005 || Math.abs(side === 's' ? x.tc : x.tp) >= 0.005); }); if (!any) return;
      lines.push({ code: k, side: side, label: k + (codes[k] && codes[k].name ? ' — ' + codes[k].name : '') + ' · ' + (side === 's' ? 'sales (GST collected)' : 'purchases (GST paid)'), rate: rateOf(k), months: M.map(function (o) { return o ? r2(cell(o[k], side)) : null; }), total: r2(cell(P[k], side)) }); }); });
    var shown = lines.filter(function (l) { return !CRA_VIEW.code || l.code === CRA_VIEW.code; });
    var colTot = function (side) { return { months: M.map(function (o, i) { return o ? MK.sum(lines.filter(function (l) { return !side || l.side === side; }).map(function (l) { return l.months[i]; })) : null; }), total: MK.sum(lines.filter(function (l) { return !side || l.side === side; }).map(function (l) { return l.total; })) }; };
    var TS = colTot('s'), TP = colTot('p'), NET = { months: M.map(function (o, i) { return o ? r2(TS.months[i] - TP.months[i]) : null; }), total: r2(TS.total - TP.total) };
    // ---- the page
    var vt = { gst: 'GST', net: 'Net amount (excl. GST)', gross: 'Amount as MYOB reports it' }[view], mc = function (v) { return v == null ? '<td class="num muted">' + (pending ? '…' : 'N/A') + '</td>' : '<td class="num">' + money(v) + '</td>'; };
    var head = '<tr><th scope="col">Tax type</th><th scope="col" class="num">Rate</th>' + months.map(function (m) { return '<th scope="col" class="num">' + h(m.label) + '</th>'; }).join('') + '<th scope="col" class="num">Total (period)</th></tr>';
    var tr = function (l) { return '<tr><td>' + h(l.label) + '</td><td class="num">' + (l.rate == null ? '' : h(l.rate + '%')) + '</td>' + l.months.map(mc).join('') + '<td class="num">' + money(l.total) + '</td></tr>'; };
    var totRow = function (label, T) { return '<tr class="k-total"><td>' + h(label) + '</td><td></td>' + T.months.map(mc).join('') + '<td class="num">' + money(T.total) + '</td></tr>'; };
    var filt = '<label class="ctl">Tax type <select id="cra-code"><option value="">All tax types</option>' + keys.map(function (k) { return '<option value="' + h(k) + '"' + (CRA_VIEW.code === k ? ' selected' : '') + '>' + h(k + (codes[k] && codes[k].name ? ' — ' + codes[k].name : '')) + '</option>'; }).join('') + '</select></label>';
    var monthNote = tooLong ? '<p class="muted">Monthly columns: N/A for periods over 24 months — choose a shorter period.</p>' : !c.live && !allM ? '<p class="muted">Snapshot: the monthly columns are fetched after opening, so a snapshot holds the period column' + (m1ok ? ' and the first month' : '') + ' only.</p>' : pending ? '<p class="muted">Loading the months from MYOB…</p>' : '';
    var kp = MK.kpis([{ label: 'GST collected', value: TS.total }, { label: 'GST paid', value: TP.total }, { label: NET.total >= 0 ? 'Net GST payable' : 'Net GST refundable', value: Math.abs(NET.total) }], c);
    if (view !== 'gst') kp = MK.kpis([{ label: 'GST collected', value: MK.sum(lines.filter(function (l) { return l.side === 's'; }).map(function (l) { return P[l.code].tc; })) }, { label: 'GST paid', value: MK.sum(lines.filter(function (l) { return l.side === 'p'; }).map(function (l) { return P[l.code].tp; })) }], c);
    body.innerHTML = kp + '<div class="mk-card"><h3>' + h(vt) + ' by tax type and month — ' + h(MK.periodLine(from, to)) + ' (' + h(I.basis) + ')</h3>' + filt + monthNote +
      '<div class="mk-scroll"><table class="mk-grid"><thead>' + head + '</thead><tbody>' + (shown.length ? shown.map(tr).join('') : '<tr><td colspan="' + (months.length + 3) + '" class="muted">No tax amounts in MYOB for this period.</td></tr>') + '</tbody><tfoot>' +
      totRow('Total ' + (view === 'gst' ? 'GST collected' : 'sales'), TS) + totRow('Total ' + (view === 'gst' ? 'GST paid' : 'purchases'), TP) + (view === 'gst' ? totRow(NET.total >= 0 ? 'Net GST payable' : 'Net GST (negative: refundable)', NET) : '') + '</tfoot></table></div></div>' +
      '<div class="mk-card"><h3>GST collected vs GST paid by month</h3><div id="cra-bars"></div></div><div class="mk-card detail-block"><h3>Reconciliation to the GST accounts</h3><div id="cra-rec"></div></div>';
    var sel = document.getElementById('cra-code'); if (sel) sel.addEventListener('change', function () { CRA_VIEW.code = this.value; CRA.render(); });
    var gcol = M.map(function (o) { return o ? MK.sum(keys.map(function (k) { return (o[k] || {}).tc || 0; })) : null; }), gpaid = M.map(function (o) { return o ? MK.sum(keys.map(function (k) { return (o[k] || {}).tp || 0; })) : null; });
    var bx = document.getElementById('cra-bars'); if (months.length && M.some(Boolean)) MK.bars(bx, { title: 'GST collected vs GST paid by month', labels: months.map(function (m) { return m.label; }), series: [{ name: 'GST collected', values: gcol }, { name: 'GST paid', values: gpaid }] }, c); else bx.innerHTML = '<p class="muted">' + (pending ? 'Loading the months…' : 'N/A — the monthly figures are not available (' + (tooLong ? 'period over 24 months' : c.live ? 'MYOB did not return them' : 'snapshot') + ').') + '</p>';
    // ---- reconciliation: the GST accounts' movement in the period's journals (accrual)
    var idx = MK.accounts(c.data.accounts), gstAcc = {}, viaCodes = false;
    MK.items(c.data.tax_codes).forEach(function (t) { if (!t || !/^(GST_VAT|InputTaxed)$/i.test(t.Type || '')) return; ['TaxCollectedAccount', 'TaxPaidAccount'].forEach(function (k) { var a = t[k]; if (a && a.UID && idx.byUid[a.UID]) { gstAcc[a.UID] = 1; viaCodes = true; } }); });
    if (!viaCodes) idx.list.forEach(function (a) { if (!a.IsHeader && /^(Asset|Liability)$/.test(a.Classification || '') && /\bGST\b/i.test(a.Name || '')) gstAcc[a.UID] = 1; });
    var isBank = function (a) { var x = idx.byUid[a.UID]; return x ? /^(Bank|CreditCard)$/.test(x.Type || '') : false; };
    var J = c.data.journals ? MK.items(c.data.journals) : null, rec = null;
    if (J && !cash && Object.keys(gstAcc).length) {
      var all = 0, settle = [], manual = [];
      J.forEach(function (j) { var ls = j.Lines || [], gl = ls.filter(function (l) { return l.Account && gstAcc[l.Account.UID]; }); if (!gl.length) return;
        var mv = r2(gl.reduce(function (a, l) { return a + (l.IsCredit ? 1 : -1) * Math.abs(MK.num(l.Amount) || 0); }, 0)); all = r2(all + mv);
        var src = (j.SourceTransaction || {}).TransactionType || j.JournalType || '';
        if (ls.every(function (l) { return l.Account && (gstAcc[l.Account.UID] || isBank(l.Account)); })) settle.push({ date: MK.isoDate(j.DateOccurred), ref: j.DisplayID || '', what: j.Description || src, amt: mv });
        else if (/GeneralJournal|^General$/i.test(src)) manual.push({ date: MK.isoDate(j.DateOccurred), ref: j.DisplayID || '', what: j.Description || src, amt: mv }); });
      var st = MK.sum(settle.map(function (x) { return x.amt; })), ex = r2(all - st), net0 = MK.sum(keys.map(function (k) { return P[k].tc - P[k].tp; })), diff = r2(net0 - ex);
      rec = { all: all, settle: settle, st: st, ex: ex, manual: manual, diff: diff, net: net0 };
    }
    var rc = document.getElementById('cra-rec');
    rc.innerHTML = cash ? '<p class="muted">N/A on the cash basis — the GST accounts move on the accrual basis (journals).</p>' : !rec ? '<p class="mk-err">' + h(c.err('journals') || c.err('accounts') || 'N/A — no GST account found in the chart of accounts') + '</p>'
      : '<div class="mk-scroll"><table class="mk-grid"><tbody><tr><td>Net GST for the period (MYOB tax code summary: collected − paid)</td><td class="num">' + money(rec.net) + '</td></tr><tr><td>GST accounts’ movement in the period’s journals (credit = owed to the ATO)</td><td class="num">' + money(rec.all) + '</td></tr>' +
        '<tr><td>BAS payments / refunds left out (journals with only GST and bank lines: ' + rec.settle.length + ')</td><td class="num">' + money(-rec.st) + '</td></tr><tr class="k-total"><td>GST accounts’ movement from transactions</td><td class="num">' + money(rec.ex) + '</td></tr><tr class="k-total"><td>Difference</td><td class="num">' + money(rec.diff) + '</td></tr></tbody></table></div>' +
        (rec.manual.length ? '<p class="muted">General journals on the GST accounts (a likely cause of a difference): ' + rec.manual.map(function (m) { return h(m.date + ' ' + m.ref + ' ' + m.what + ' ' + money(m.amt)); }).join('; ') + '</p>' : '');
    // ---- checks
    var g = c.data.gst, cmp = function (a, b) { return MK.near(a, b); }, bad = [], monthDates = [];
    if (allM) keys.forEach(function (k) { [['s', 'sales'], ['p', 'purchases'], ['tc', 'GST collected'], ['tp', 'GST paid']].forEach(function (f) { var sm = MK.sum(M.map(function (o) { return (o[k] || {})[f[0]] || 0; })), pv = (P[k] || {})[f[0]] || 0; if (!cmp(sm, pv)) bad.push(k + ' ' + f[1] + ' ' + money(sm) + ' vs ' + money(pv)); }); });
    if (allM) months.forEach(function (m, i) { var gg = monthData(m, i); if (gg && (dOf(gg.StartDate) !== m.from || dOf(gg.EndDate) !== m.to)) monthDates.push(m.label + ': ' + dOf(gg.StartDate) + ' to ' + dOf(gg.EndDate)); });
    var mErr = Object.keys(CRA_FAN.sig === sig ? CRA_FAN.err : {});
    var badRate = keys.filter(function (k) { var r = P[k], rt = rateOf(k); if (rt == null) return false; if (rt > 0) { var dv = excl ? 100 : 100 + rt; return !MK.near(r.tc, r.s * rt / dv, Math.max(1, r.s * 0.0002)) || !MK.near(r.tp, r.p * rt / dv, Math.max(1, r.p * 0.0002)); } return Math.abs(r.tc) > 0.005 || Math.abs(r.tp) > 0.005; });
    var checks = [
      { name: 'MYOB returned the requested period and basis (tax code summary)', pass: dOf(g.StartDate) === from && dOf(g.EndDate) === to && (!g.ReportingBasis || g.ReportingBasis === I.basis), detail: dOf(g.StartDate) + ' to ' + dOf(g.EndDate) + ', ' + (g.ReportingBasis || '?') + ' basis' },
      mErr.length ? { name: 'Monthly tax code summaries loaded', pass: false, detail: mErr.map(function (k) { return k + ': ' + CRA_FAN.err[k]; }).join('; ') }
        : !allM ? { name: 'Each tax type: the months add up to the period (get_gst_summary per month = the period call)', pass: null, detail: tooLong ? 'N/A — period over 24 months' : pending ? 'loading the months' : 'N/A — the monthly figures are fetched after opening (snapshot)' }
        : { name: 'Each tax type: the ' + months.length + ' monthly tax code summaries add up to the period’s (sales, purchases, GST collected and paid, code by code)', pass: !bad.length && !monthDates.length, detail: bad.length ? 'Differs: ' + bad.join('; ') : monthDates.length ? 'Months returned for other dates: ' + monthDates.join('; ') : keys.length + ' tax code(s), ' + months.length + ' month(s)' },
      { name: 'Each tax code’s GST = its rate on its amounts (list_tax_codes rates)', pass: keys.length ? !badRate.length : null, detail: badRate.length ? 'Differs: ' + badRate.join(', ') : keys.length + ' code(s)' + (c.errors.tax_codes ? ' (tax codes unavailable: rates from the summary)' : '') },
      cash ? { name: 'Net GST = the GST accounts’ movement (accrual)', pass: null, detail: 'N/A on the cash basis (the GST accounts move on the accrual basis)' } : !rec ? { name: 'Net GST = the GST accounts’ movement in the journals', pass: null, detail: c.err('journals') || c.err('accounts') || 'N/A — no GST account found' }
        : { name: 'Net GST (' + money(rec.net) + ') = the GST accounts’ movement in the period’s journals less BAS payments / refunds (a separate MYOB source; GST accounts ' + (viaCodes ? 'from the tax codes' : 'found by name') + ')', pass: MK.near(rec.net, rec.ex, 0.05), detail: money(rec.net) + ' vs ' + money(rec.ex) + (MK.near(rec.net, rec.ex, 0.05) ? '' : ' — differs by ' + money(rec.diff) + (rec.manual.length ? ': ' + rec.manual.length + ' general journal(s) on the GST accounts' : ': GST adjustments, or a BAS payment through an account other than a bank account')) + (rec.settle.length ? '; ' + rec.settle.length + ' BAS payment(s) / refund(s) left out (' + money(rec.st) + ')' : '') }
    ];
    self._x = { months: months, lines: lines, P: P, TS: TS, TP: TP, NET: NET, rec: rec, view: view, vt: vt };
    return { checks: checks, period: MK.periodLine(from, to) + ' · ' + I.basis + ' basis',
      notes: ['Amounts are MYOB’s tax code summary (Report/TaxCodeSummary) for the period and for each month, ' + I.basis.toLowerCase() + ' basis. MYOB’s sales and purchases totals ' + (excl ? 'exclude GST in this file' : 'include GST') + '; the net view shows them without GST.',
        'This is not a BAS: MYOB’s API has no link from tax codes to BAS labels (see the GST Summary (BAS) report for a draft with a mapping).', 'The tax type filter hides rows only: the totals, chart and checks always cover every tax code.'],
      na: ['BAS labels (G1, 1A, 1B …) — MYOB’s API does not map tax codes to them'].concat(cash ? ['The GST accounts’ reconciliation on the cash basis'] : []) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var I = c.inputs, mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; }, b = function (t) { return { v: t, s: 'bold' }; }, mb = function (v) { return v == null ? 'N/A' : { v: v, s: 'moneyBold' }; };
    var hd = function (t, cols) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [b('MYOB Summary of Tax Amounts by Type — ' + t)], ['Period: ' + MK.periodLine(I.from_date, I.to_date) + ' (' + I.from_date + ' to ' + I.to_date + ')'], ['Basis: ' + I.basis + ' · Currency: ' + c.currency], [], cols.map(b)]; };
    var cols = ['Tax type', 'Rate %'].concat(x.months.map(function (m) { return m.label; }), ['Total (period)']);
    var grid = hd(x.vt + ' by tax type and month', cols).concat(x.lines.map(function (l) { return [l.label, l.rate == null ? '' : l.rate].concat(l.months.map(mv), [mv(l.total)]); }),
      [[b('Total ' + (x.view === 'gst' ? 'GST collected' : 'sales')), ''].concat(x.TS.months.map(mb), [mb(x.TS.total)]), [b('Total ' + (x.view === 'gst' ? 'GST paid' : 'purchases')), ''].concat(x.TP.months.map(mb), [mb(x.TP.total)])]);
    var codes = hd('Period by tax code (MYOB tax code summary)', ['Tax code', 'Sales', 'Purchases', 'GST collected', 'GST paid', 'Net GST']).concat(Object.keys(x.P).sort().map(function (k) { var r = x.P[k]; return [k, mv(r.s), mv(r.p), mv(r.tc), mv(r.tp), mv(Math.round((r.tc - r.tp) * 100) / 100)]; }));
    var sheets = [{ name: 'By month', rows: grid, widths: [52, 8].concat(x.months.map(function () { return 14; }), [16]) }, { name: 'Period by tax code', rows: codes, widths: [14, 16, 16, 16, 16, 16] }];
    if (x.rec) sheets.push({ name: 'Reconciliation', rows: hd('Reconciliation to the GST accounts', ['Line', 'Amount']).concat([['Net GST (tax code summary)', mv(x.rec.net)], ['GST accounts movement (journals)', mv(x.rec.all)], ['BAS payments / refunds left out', mv(-x.rec.st)], [b('Movement from transactions'), mb(x.rec.ex)], [b('Difference'), mb(x.rec.diff)]]), widths: [44, 18] });
    return sheets;
  }
});

XK.app({
  title: 'Report pack', basisLabel: 'Accrual', primary: 'pnl', dated: ['pnl'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', display: 'display' },
  defaults: { from_date: '2026-08-01', to_date: '2026-08-31', fy_start: '2026-07-01', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"last_month","a":"custom","c":"none","v":"","o":"s=pl,bs,ar,ap"}' },
  uses: { pnl: ['from_date', 'to_date', 'org'], pnl_ytd: ['fy_start', 'to_date', 'org'], bs: ['to_date', 'org'], invoices: ['org'], bills: ['org'], credit_notes: ['org'], overpayments: ['org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, bills: { input: 'page', key: 'Invoices' }, credit_notes: { input: 'page', key: 'CreditNotes' }, overpayments: { input: 'page', key: 'Overpayments' } },
  tools: { pnl: 'get_profit_and_loss (the period)', pnl_ytd: 'get_profit_and_loss (financial year to the period end — for the tie)', bs: 'get_balance_sheet (at the period end)', invoices: 'list_invoices (sales invoices awaiting payment)', bills: 'list_invoices (bills awaiting payment)', credit_notes: 'list_credit_notes (unallocated)', overpayments: 'list_overpayments (unallocated)', org: 'get_organisation', connections: 'list_connections' },
  derive: function (inp, fyMonth) { return { fy_start: XK.fyStartOf(inp.to_date, fyMonth || 7) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date, today = c.today, base = c.currency;
    var on = String(c.opt('s') == null ? 'pl,bs,ar,ap' : c.opt('s')).split(',').filter(Boolean), SECTIONS = [['pl', 'Profit and Loss'], ['bs', 'Balance Sheet'], ['ar', 'Aged Receivables'], ['ap', 'Aged Payables']];
    var shown = SECTIONS.filter(function (s) { return on.indexOf(s[0]) >= 0; });
    var checks = [], parts = {}, out = [];
    // 1. Profit and Loss
    var w = c.data.pnl ? XK.walk(c.data.pnl) : null, pl = w ? XK.plParts(w) : null;
    if (on.indexOf('pl') >= 0) {
      out.push(['pl', 'Profit and Loss', XK.rangeLabel(from, to), c.errors.pnl ? '<p class="xk-err">' + XK.h(c.err('pnl')) + '</p>' : w ? XK.statement(w.lines, ['', XK.rangeLabel(from, to)], c) : '<p class="muted">Loading…</p>']);
      var lt = w ? XK.linesTies(w.lines) : null;
      checks.push({ name: 'Profit and Loss: every section total = Σ its account rows, and Net Profit = income − expenses', pass: w ? lt.failed.length === 0 && XK.near(pl.np, r2(pl.income - pl.expenses)) : null, detail: w ? 'Net profit ' + money(pl.np) : c.err('pnl') });
    }
    // 2. Balance Sheet
    var bw = c.data.bs ? XK.walk(c.data.bs) : null, bp = bw ? XK.bsParts(bw) : null, wy = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null, ytd = wy ? XK.plParts(wy).np : null;
    if (on.indexOf('bs') >= 0) {
      out.push(['bs', 'Balance Sheet', XK.asOfLine(to), c.errors.bs ? '<p class="xk-err">' + XK.h(c.err('bs')) + '</p>' : bw ? XK.statement(bw.lines, ['', XK.asOfLine(to).replace('As at ', '')], c) : '<p class="muted">Loading…</p>']);
      checks.push({ name: 'Balance Sheet: Total Assets = Total Liabilities + Equity', pass: bp && bp.totalAssets != null && bp.totalLiabilities != null && bp.equity != null ? XK.near(bp.totalAssets, r2(bp.totalLiabilities + bp.equity)) : null, detail: bp ? money(bp.totalAssets) + ' = ' + money(bp.totalLiabilities) + ' + ' + money(bp.equity) : c.err('bs') });
      checks.push({ name: 'Current Year Earnings on the Balance Sheet = Net Profit from the financial-year start to ' + to + ' (a separate Profit and Loss)', pass: bp && bp.cye != null && ytd != null ? XK.near(bp.cye, ytd) : null, detail: bp && ytd != null ? money(bp.cye) + ' vs ' + money(ytd) : (c.err('pnl_ytd') || c.err('bs') || 'N/A') });
    }
    // 3–4. Ageing — open documents as at today, by due date (Current, 1–30, 31–60, 61–90, 90+ days)
    var ag = XK.ageingCols(today, 'due', 3, '30'), aged = function (kind) {
      var T = kind === 'ar' ? { inv: 'ACCREC', cn: 'ACCRECCREDIT', op: 'RECEIVE-OVERPAYMENT', id: 'invoices', bsv: bp && bp.ar } : { inv: 'ACCPAY', cn: 'ACCPAYCREDIT', op: 'SPEND-OVERPAYMENT', id: 'bills', bsv: bp && bp.ap };
      var docs = XK.openDocs({ invoices: c.rows(T.id).filter(function (d) { return d && d.Type === T.inv; }), credit_notes: c.rows('credit_notes'), overpayments: c.rows('overpayments'), types: { credit_notes: T.cn, overpayments: T.op } }, base, today);
      var rows = XK.byContact(docs, ag), tot = ag.cols.map(function (_, i) { return XK.sum(rows.map(function (r) { return r.b[i]; })); }), all = XK.sum(rows.map(function (r) { return r.total; }));
      var html = '<div class="xk-scroll"><table class="xk-grid"><thead><tr><th>Contact</th>' + ag.cols.map(function (k) { return '<th class="num">' + XK.h(k.title) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + XK.h(r.name) + '</td>' + r.b.map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '<td class="num">' + money(r.total) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr class="k-total"><td>Total</td>' + tot.map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '<td class="num">' + money(all) + '</td></tr></tfoot></table></div>';
      return { rows: rows, tot: tot, all: all, html: c.errors[T.id] ? '<p class="xk-err">' + XK.h(c.err(T.id)) + '</p>' : html, bsv: T.bsv, id: T.id };
    };
    ['ar', 'ap'].forEach(function (k) {
      if (on.indexOf(k) < 0) return; var A = parts[k] = aged(k), name = k === 'ar' ? 'Aged Receivables' : 'Aged Payables', acct = k === 'ar' ? 'Accounts Receivable' : 'Accounts Payable';
      out.push([k, name, XK.asOfLine(today) + ' · by due date', A.html]);
      checks.push(to === today ? { name: name + ' total = ' + acct + ' on the Balance Sheet', pass: A.bsv == null ? null : XK.near(A.all, A.bsv), detail: A.bsv == null ? 'N/A — no ' + acct + ' line' : money(A.all) + ' vs ' + money(A.bsv) }
        : { name: name + ' (today) vs ' + acct + ' on the Balance Sheet at ' + to + ' (information — different dates)', pass: null, info: true, detail: money(A.all) + ' vs ' + (A.bsv == null ? 'N/A' : money(A.bsv)) });
    });
    var trunc = ['invoices', 'bills', 'credit_notes', 'overpayments'].some(function (id) { return c.truncated(id); });
    if (on.indexOf('ar') >= 0 || on.indexOf('ap') >= 0) checks.push({ name: 'All open invoices, bills and credits loaded', pass: trunc ? false : true, detail: trunc ? 'May be truncated (over 20 pages)' : c.rows('invoices').length + ' invoice(s), ' + c.rows('bills').length + ' bill(s)' });
    // cover, contents and the sections; section switches are display only
    body.innerHTML = '<div class="xk-card"><h2 style="margin:0">' + XK.h(c.company || 'Report pack') + '</h2><p class="muted">Report pack · ' + XK.h(XK.rangeLabel(from, to)) + ' · prepared ' + XK.h(XK.shortDate(today)) + '</p>' +
      '<p class="no-print">' + SECTIONS.map(function (s) { return '<label class="muted" style="margin-right:12px"><input type="checkbox" class="rp-sec" value="' + s[0] + '"' + (on.indexOf(s[0]) >= 0 ? ' checked' : '') + '> ' + s[1] + '</label>'; }).join('') + '</p>' +
      '<ol>' + shown.map(function (s) { return '<li>' + XK.h(s[1]) + '</li>'; }).join('') + '</ol></div>' +
      out.map(function (s, i) { return '<div class="xk-card" style="margin-top:16px;page-break-before:' + (i ? 'always' : 'auto') + '"><h3>' + (i + 1) + '. ' + XK.h(s[1]) + '</h3><p class="muted">' + XK.h(s[2]) + '</p>' + s[3] + '</div>'; }).join('');
    body.querySelectorAll('.rp-sec').forEach(function (cb) { cb.addEventListener('change', function () { var v = [].slice.call(body.querySelectorAll('.rp-sec')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }).join(','); c.setOpt('s', v); }); });
    this._x = { w: w, bw: bw, parts: parts, on: on, ag: ag };
    return { checks: checks.length ? checks : [{ name: 'Sections', pass: null, detail: 'No section chosen' }], notes: ['Each section comes from its own Xero report: the Profit and Loss for the period, the Balance Sheet at its end, and the open invoices and bills (with unallocated credit notes and overpayments) aged by due date as at today.', 'Prepayments are not included in the ageing.'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var sheets = [], period = XK.periodLine(c.inputs.from_date, c.inputs.to_date), foot = XK.footerStamp('Accrual', c.fetchedAt, c.currency), lineRows = function (w) { return w.lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values }; }); };
    if (x.w && x.on.indexOf('pl') >= 0) sheets.push(XK.sheetFromLines('Profit and Loss', c.company, period, ['', 'Amount'], lineRows(x.w), foot, ['money']));
    if (x.bw && x.on.indexOf('bs') >= 0) sheets.push(XK.sheetFromLines('Balance Sheet', c.company, XK.asOfLine(c.inputs.to_date), ['', 'Amount'], lineRows(x.bw), foot, ['money']));
    ['ar', 'ap'].forEach(function (k) { var A = x.parts[k]; if (!A) return; var name = k === 'ar' ? 'Aged Receivables' : 'Aged Payables';
      sheets.push({ name: name, rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: name, s: 'bold' }], [XK.asOfLine(c.today) + ' · by due date'], [], [{ v: 'Contact', s: 'bold' }].concat(x.ag.cols.map(function (k2) { return { v: k2.title, s: 'bold' }; })).concat([{ v: 'Total', s: 'bold' }])]
        .concat(A.rows.map(function (r) { return [r.name].concat(r.b.map(function (v) { return { v: v, s: 'money' }; })).concat([{ v: r.total, s: 'money' }]); }))
        .concat([[{ v: 'Total', s: 'bold' }].concat(A.tot.map(function (v) { return { v: v, s: 'moneyBold' }; })).concat([{ v: A.all, s: 'moneyBold' }])]), widths: [34, 14, 14, 14, 14, 14, 14] }); });
    return sheets;
  }
});

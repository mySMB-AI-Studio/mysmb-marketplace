QB.app({
  title: 'GST Overview', token: null, primary: 'gst_current', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', cmpStart: 'compare_start', cmpEnd: 'compare_end', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', compare_start: '2026-04-01', compare_end: '2026-06-30', basis: 'Accrual', agency_id: '', persona: 'Bookkeeper',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_quarter","a":"custom","c":"prev_period","v":"","x":""}' },
  uses: { gst_current: ['start_date', 'end_date', 'basis', 'agency_id'], gst_probe: ['basis', 'agency_id'], gst_previous: ['compare_start', 'compare_end', 'basis', 'agency_id'], bs_end: ['end_date', 'basis'], tax_agencies: [], company_info: [], prefs: [] },
  tools: { tax_agencies: 'list_tax_agency', gst_probe: 'get_report_tax_summary (all history — confirms a nil period)', gst_current: 'get_report_tax_summary (this period, for the tax agency)', gst_previous: 'get_report_tax_summary (previous period)', bs_end: 'get_report_balance_sheet (GST Liabilities)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  compare: true,
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); };
    var ag = QB.taxAgency(c, 'tax_agencies', 'agency_id');
    if (ag.pending) { body.innerHTML = '<p class="muted">Loading GST for ' + QB.h(ag.name) + '…</p>'; return {}; }
    if (c.errors.gst_current) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('gst_current')) + '</p>'; return { checks: [{ name: 'GST position loaded', pass: false, detail: c.err('gst_current') }] }; }
    if (!c.data.gst_current) return {};
    var NIL = { a1: 0, b1: 0, nine: 0, found: true, nil: true }, bas = function (id) { var r = c.data[id]; return !r ? null : QB.noData(r) ? NIL : QB.bas(r); }; // agency known + no rows = nil period
    if (!ag.id) { body.innerHTML = '<div class="qb-banner na"><strong>No tax agency is set up in QuickBooks.</strong> The GST position is unavailable — not zero. Set one up in QuickBooks › Taxes › GST.</div>'; this._x = null; return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null, detail: 'No tax agency in QuickBooks' }] }; }
    if (QB.noData(c.data.gst_current) && !QB.gstConfirmed(c, 'gst_probe')) { body.innerHTML = '<div class="qb-banner na"><strong>No GST figures from QuickBooks for ' + QB.h(ag.name) + '.</strong> ' + QB.h(QB.GST_UNCONFIRMED) + '</div>'; this._x = null; return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null, detail: 'None for ' + ag.name + ' in this or any earlier period' }] }; }
    var cur = bas('gst_current'), prev = c.errors.gst_previous ? null : bas('gst_previous');
    var net = function (b) { return b && b.a1 != null && b.b1 != null ? Math.round((b.a1 - b.b1) * 100) / 100 : null; }, n = net(cur), refund = n != null && n < 0;
    var bsl = c.data.bs_end ? QB.walk(c.data.bs_end) : [], liab = QB.val(QB.find(bsl, null, QB.GST_LIAB_RE, 'row'));
    body.innerHTML = QB.kpis([{ label: refund ? 'GST refund' : 'GST payable', value: n == null ? null : Math.abs(n), sub: cur.nil ? 'Nil period — no GST transactions' : QB.periodLine(c.inputs.start_date, c.inputs.end_date) },
      { label: 'GST collected', value: cur.a1 }, { label: 'GST paid', value: cur.b1 }, { label: 'GST liabilities (balance sheet)', value: liab }], c) +
      '<div class="qb-grid2"><div class="qb-card"><h3>Collected vs paid</h3><div id="ch1"></div></div><div class="qb-card"><h3>History</h3><div id="hist"></div></div></div>' +
      '<div class="qb-card detail-block"><h3>Run reports</h3><p>GST Summary (this period) — open the GST Summary report for the full BAS label layout. GST Details, GST Liability and PAYG run from QuickBooks (see Sources &amp; limitations).</p></div>';
    QB.bars(document.getElementById('ch1'), { title: 'GST collected vs paid', labels: ['This period', 'Previous period'], series: [{ name: 'Collected (1A)', values: [cur.a1, prev && prev.a1] }, { name: 'Paid (1B)', values: [cur.b1, prev && prev.b1] }] }, c);
    QB.grid(document.getElementById('hist'), { columns: [{ key: 'p', title: 'Period' }, { key: 'a', title: 'Collected', money: true }, { key: 'b', title: 'Paid', money: true }, { key: 'n', title: 'Net (1A − 1B)', money: true }],
      rows: [{ p: QB.periodLine(c.inputs.start_date, c.inputs.end_date), a: cur.a1, b: cur.b1, n: n }].concat(prev ? [{ p: QB.periodLine(c.inputs.compare_start, c.inputs.compare_end), a: prev.a1, b: prev.b1, n: net(prev) }] : []) }, c);
    var checks = cur.nil ? [{ name: 'GST activity this period (information)', pass: null, info: true, detail: 'None — nil period for ' + ag.name + ' (' + QB.periodLine(c.inputs.start_date, c.inputs.end_date) + ')' }] : [
      { name: 'Refund / payable = GST collected − GST paid', pass: n == null ? null : (cur.nine == null ? true : QB.near(n, cur.nine)), detail: money(cur.a1) + ' − ' + money(cur.b1) + ' = ' + money(n) },
      { name: 'Ties to GST Summary 1A / 1B (same Tax Summary source)', pass: cur.found ? true : null, detail: cur.found ? '1A ' + money(cur.a1) + ', 1B ' + money(cur.b1) : 'BAS labels not present — verify on first run' }];
    checks.push(
      { name: 'Previous period loaded', pass: c.errors.gst_previous ? false : prev ? true : null, detail: c.errors.gst_previous ? c.err('gst_previous') : QB.periodLine(c.inputs.compare_start, c.inputs.compare_end) + (prev && prev.nil ? ' — nil period' : '') });
    this._x = { cur: cur, prev: prev, n: n };
    return { checks: checks, period: QB.periodLine(c.inputs.start_date, c.inputs.end_date),
      na: ['To do / Payments tabs, Export workpapers and "Prepare BAS or IAS for lodgment" (BAS centre actions are not exposed by the Accounting API)', 'Monthly collected-vs-paid split (Tax Summary does not summarise by month)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'GST overview', widths: [36, 18, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'GST overview', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [],
      [{ v: 'Period', s: 'bold' }, { v: 'GST collected (1A)', s: 'bold' }, { v: 'GST paid (1B)', s: 'bold' }, { v: 'Net', s: 'bold' }],
      [QB.periodLine(c.inputs.start_date, c.inputs.end_date), { v: x.cur.a1, s: 'money' }, { v: x.cur.b1, s: 'money' }, { f: 'B6-C6', v: x.n, s: 'moneyBold' }]].concat(x.prev ? [[QB.periodLine(c.inputs.compare_start, c.inputs.compare_end), { v: x.prev.a1, s: 'money' }, { v: x.prev.b1, s: 'money' }, { f: 'B7-C7', s: 'moneyBold' }]] : []) }];
  }
});

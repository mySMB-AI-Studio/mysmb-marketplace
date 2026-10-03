QB.app({
  title: 'GST Summary Report', token: 'GTM_SUM', route: 'reportv2', primary: 'gst_summary', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-30', basis: 'Accrual', agency_id: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_quarter","a":"custom","c":"none","v":"summary","x":""}' },
  uses: { gst_summary: ['start_date', 'end_date', 'basis', 'agency_id'], gst_probe: ['basis', 'agency_id'], bs_end: ['end_date', 'basis'], tax_agencies: [], company_info: [], prefs: [] },
  tools: { gst_summary: 'get_report_tax_summary (GST Summary, for the tax agency)', gst_probe: 'get_report_tax_summary (all history — confirms a nil period)', tax_agencies: 'list_tax_agency', bs_end: 'get_report_balance_sheet (GST Liabilities at period end)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['summary', 'GST Summary'], ['payg', 'PAYG Withholding Summary']],
  render: function (c) {
    var body = c.body, rep = c.data.gst_summary, money = function (v) { return QB.money(v, c.currency, c.display); };
    if (c.view === 'payg') {
      body.innerHTML = '<div class="qb-banner na"><strong>PAYG withholding is not available from the connected QuickBooks tools.</strong> Payroll runs in Employment Hero (outside the QuickBooks Accounting API). Export QuickBooks › Reports › Manage Taxes › PAYG Withholding Summary to Excel and attach it to have it reproduced.</div>';
      return { checks: [{ name: 'PAYG Withholding data available', pass: null, detail: 'N/A — not in source (Employment Hero payroll)' }], na: ['PAYG Withholding Summary / Details / Amendment (payroll data lives in Employment Hero)'], title: 'PAYG Withholding Summary' };
    }
    var ag = QB.taxAgency(c, 'tax_agencies', 'agency_id');
    if (ag.pending) { body.innerHTML = '<p class="muted">Loading GST for ' + QB.h(ag.name) + '…</p>'; return {}; }
    if (c.errors.gst_summary) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('gst_summary')) + '</p>'; return { checks: [{ name: 'GST Summary loaded', pass: false, detail: c.err('gst_summary') }] }; }
    if (!rep) return {};
    var bsl = c.data.bs_end ? QB.walk(c.data.bs_end) : [], gstRow = QB.find(bsl, null, QB.GST_LIAB_RE, 'row'), gstLiab = QB.val(gstRow), hd = QB.header(rep);
    var liabCheck = { name: 'GST Liabilities on the balance sheet at period end (information)', pass: null, info: true, detail: gstLiab == null ? (c.errors.bs_end ? c.err('bs_end') : 'N/A — not in source') : gstRow.label + ' ' + money(gstLiab) + ' — includes unpaid prior periods, so it need not equal label 9' };
    var periodCheck = { name: 'QuickBooks returned the requested period', pass: !c.live || !hd.StartPeriod ? null : hd.StartPeriod === c.inputs.start_date && hd.EndPeriod === c.inputs.end_date, detail: (hd.StartPeriod || '?') + ' to ' + (hd.EndPeriod || '?') + ', ' + (hd.ReportBasis || c.inputs.basis) + ' basis' };
    if (QB.noData(rep) && !ag.id) {
      body.innerHTML = '<div class="qb-banner na"><strong>No tax agency is set up in QuickBooks.</strong> The GST Summary needs one (QuickBooks › Taxes › GST). GST figures are unavailable — not zero.</div>';
      this._x = null; return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null, detail: 'No tax agency in QuickBooks' }], na: ['All BAS labels for this period (no tax agency in QuickBooks)'] };
    }
    if (QB.noData(rep) && !QB.gstConfirmed(c, 'gst_probe')) { // no GST ever for this agency: could be a connector without agency_id
      body.innerHTML = '<div class="qb-banner na"><strong>No GST figures from QuickBooks for ' + QB.h(ag.name) + '.</strong> ' + QB.h(QB.GST_UNCONFIRMED) + '</div>';
      this._x = null; return { checks: [{ name: 'QuickBooks returned GST rows for the period', pass: null, detail: 'None for ' + ag.name + ' in this or any earlier period' }], na: ['All BAS labels for this period (no GST figures from QuickBooks)'] };
    }
    if (QB.noData(rep)) { // agency known and honoured: QuickBooks has no GST transactions for it in the period, i.e. a nil period
      var pl = QB.periodLine(c.inputs.start_date, c.inputs.end_date);
      body.innerHTML = QB.kpis([{ label: 'G1 Total sales', value: 0 }, { label: '1A GST on sales', value: 0 }, { label: '1B GST on purchases', value: 0 }, { label: '9 Payment due to the ATO', value: 0 }], c) +
        '<div class="qb-card detail-block" style="margin-top:16px"><h3>Nil period</h3><p>QuickBooks has no GST transactions for <strong>' + QB.h(ag.name) + '</strong> in <strong>' + QB.h(pl) + '</strong>, so every BAS label is ' + QB.h(money(0)) + '. Choose another period to see GST activity.</p></div>';
      this._x = null;
      return { checks: [{ name: 'GST activity in the period (information)', pass: null, info: true, detail: 'None — nil period for ' + ag.name }, liabCheck, periodCheck], notes: ['GST Agency: ' + ag.name + '. Decision support for BAS preparation — not lodgement advice.'],
        na: ['PAYG withholding labels W1/W2/4 (payroll data lives in Employment Hero)'] };
    }
    var b = QB.bas(rep), refund = b.nine != null && b.nine < 0;
    body.innerHTML = QB.kpis([{ label: 'G1 Total sales', value: b.g1 }, { label: '1A GST on sales', value: b.a1 }, { label: '1B GST on purchases', value: b.b1 },
      { label: refund ? '9 Refund due from the ATO' : '9 Payment due to the ATO', value: b.nine == null ? null : Math.abs(b.nine) }], c) +
      (b.found ? '' : '<p class="qb-err">The Tax Summary rows do not carry BAS labels (G1, 1A, 1B, 9); they are shown as returned — verify on first run.</p>') +
      '<div class="qb-scroll">' + QB.statement(b.lines, ['', 'TOTAL'], c) + '</div><div class="qb-card detail-block" style="margin-top:16px"><h3>GST collected vs paid</h3><div id="ch1"></div></div>';
    QB.bars(document.getElementById('ch1'), { title: 'GST collected vs paid', labels: ['1A GST on sales', '1B GST on purchases', '9 Net'], series: [{ name: 'This period', values: [b.a1, b.b1, b.nine] }] }, c);
    var checks = [
      { name: '1A − 1B = 9', pass: b.a1 == null || b.b1 == null || b.nine == null ? null : QB.near(b.a1 - b.b1, b.nine), detail: money(b.a1) + ' − ' + money(b.b1) + ' = ' + money(b.nine) },
      { name: 'G1 = net amount + tax amount + GST-free sales', pass: b.g1 == null || b.net == null || b.tax == null ? null : QB.near(b.g1, b.net + b.tax + (b.free || 0)), detail: money(b.g1) },
      liabCheck, periodCheck];
    this._x = b;
    return { checks: checks, notes: ['GST Agency: Australian Tax Office. Decision support for BAS preparation — not lodgement advice.'],
      na: ['PAYG withholding labels W1/W2/4 (payroll data lives in Employment Hero)', 'GST Details, GST Liability, GST Amendment, TPAR, Transactions without GST and Transaction Detail by Tax Code (Wave 2 members)'] };
  },
  excel: function (c) {
    var b = this._x; if (!b) return [];
    return [QB.sheetFromLines('GST Summary Report', c.company, QB.periodLine(c.inputs.start_date, c.inputs.end_date), ['', 'TOTAL'], b.lines, QB.footerStamp(c.inputs.basis, c.fetchedAt).replace('Accrual basis', 'Accruals basis'))];
  }
});

// CRA-04 Purchases by Tracking Category — QuickBooks Online. Cost of Sales and Expenses sections of
// get_report_profit_and_loss with summarize_column_by "Classes", split by class, tied to Cost of Sales + Expenses on the
// plain (no-class) Profit and Loss for the same period.
QB.app({
  title: 'QuickBooks · Purchases by Tracking Category', token: null, primary: 'by_class', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-08-01', end_date: '2026-08-31', persona: 'Practitioner',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_month","a":"custom","c":"none","v":"","x":""}' },
  presets: [['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  uses: { by_class: ['start_date', 'end_date'], pnl: ['start_date', 'end_date'], company_info: [], prefs: [] },
  tools: { by_class: 'get_report_profit_and_loss (summarize_column_by Classes)', pnl: 'get_report_profit_and_loss (no class split — for the tie)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  clientNote: '(the connected QuickBooks company: one company per connection)',
  render: function (c) {
    var body = c.body, money = function (v) { return v == null ? 'N/A — not in source' : QB.money(v, c.currency, c.display); };
    if (c.errors.by_class) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('by_class')) + '</p>'; return { checks: [{ name: 'Purchases by class loaded', pass: false, detail: c.err('by_class') }] }; }
    if (!c.data.by_class) return {};
    var cl = QB.walk(c.data.by_class), cols = QB.cols(c.data.by_class), classCols = cols.filter(function (x) { return x.i > 0 && x.key !== 'total'; });
    if (!classCols.length) { body.innerHTML = '<p class="muted">No class columns returned — this company may have no QuickBooks classes set up.</p>'; return { checks: [{ name: 'Class columns present', pass: null, detail: 'N/A — not in source' }] }; }
    // QB.walk does not carry a section's `group` down to its leaf rows, only the section's own label in each leaf's `path` —
    // so find the Cost of Sales / Expenses sections' headers (which do carry both) and match leaves by their labels.
    var hdrs = cl.filter(function (l) { return l.kind === 'header' && (l.group === 'COGS' || l.group === 'Expenses'); }), labels = hdrs.map(function (l) { return l.label; });
    var leaves = cl.filter(function (l) { return l.kind === 'row' && labels.some(function (lbl) { return l.path.indexOf(lbl) >= 0; }); });
    var totals = classCols.map(function (x) { return QB.sum(leaves.map(function (l) { return l.values[x.i - 1]; })); });
    var totalCol = cols.filter(function (x) { return x.key === 'total'; })[0];
    var grand = totalCol ? QB.sum(leaves.map(function (l) { return l.values[totalCol.i - 1]; })) : QB.sum(totals);
    var rows = classCols.map(function (x, i) { return { name: x.title, value: totals[i], share: grand ? QB.pct(totals[i] / grand) : 'N/A' }; }).sort(function (a, b) { return b.value - a.value; });
    body.innerHTML = QB.kpis([{ label: 'Total purchases', value: grand }, { label: 'Classes with purchases', text: String(rows.filter(function (r) { return r.value; }).length) + ' of ' + rows.length }], c) +
      '<div class="qb-card" style="margin-top:16px"><h3>Purchases by class</h3><div id="pt-bars"></div><div id="pt-grid"></div></div>';
    QB.bars(document.getElementById('pt-bars'), { title: 'Purchases by class', labels: rows.map(function (r) { return r.name; }), series: [{ name: 'Purchases', values: rows.map(function (r) { return r.value; }) }] }, c);
    QB.grid(document.getElementById('pt-grid'), { columns: [{ key: 'name', title: 'Class' }, { key: 'value', title: 'Purchases', money: true }, { key: 'share', title: 'Share' }], rows: rows, total: { name: 'Total', value: grand }, empty: 'No purchases in this period.' }, c);
    var addsUp = QB.near(QB.sum(totals), grand);
    var pw = c.data.pnl ? QB.walk(c.data.pnl) : null, pCogs = pw ? QB.find(pw, 'COGS', /^total cost of (sales|goods sold)$/i, 'total') : null, pExp = pw ? QB.find(pw, 'Expenses', /^total expenses$/i, 'total') : null;
    var pTotal = pCogs || pExp ? (pCogs ? QB.val(pCogs) : 0) + (pExp ? QB.val(pExp) : 0) : null;
    var checks = [
      { name: 'Classes (incl. Unclassified) add up to the total', pass: addsUp, detail: money(QB.sum(totals)) + ' vs ' + money(grand) },
      { name: 'Total purchases = Cost of Sales + Expenses on the Profit and Loss without a class split (a separate QuickBooks call)', pass: pTotal == null ? null : QB.near(grand, pTotal), detail: pTotal == null ? (c.err('pnl') || 'N/A') : money(grand) + ' vs ' + money(pTotal) }
    ];
    this._x = { rows: rows, grand: grand };
    return { checks: checks, period: QB.periodLine(c.inputs.start_date, c.inputs.end_date),
      notes: ['Purchases = the Cost of Sales and Expenses sections of QuickBooks\' Profit and Loss, with a column per QuickBooks class and an Unclassified column for purchases with no class.'],
      na: [] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Purchases by Tracking Category', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], []];
    var rows = head.concat([[{ v: 'Class', s: 'bold' }, { v: 'Purchases', s: 'bold' }, { v: 'Share', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, { v: r.value, s: 'money' }, r.share]; })).concat([[{ v: 'Total', s: 'bold' }, { v: x.grand, s: 'moneyBold' }]]);
    return [{ name: 'Purchases by class', rows: rows, widths: [20, 16, 12] }];
  }
});

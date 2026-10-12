// CRA-03 Sales by Tracking Category (Xero). One tracking category at a time (Xero's own constraint, avoids double counting):
// the Income section of a Profit and Loss run with that category's columns, so sales split by option, their share of total
// sales and a bar chart — ties to the same Income total as the organisation's own Profit and Loss (no tracking).
XK.app({
  title: 'Xero · Sales by Tracking Category', primary: 'pnl', dated: ['pnl'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', basis: 'Accrual', tracking: '', org: '',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","o":"opt="}' },
  uses: { by_cat: ['from_date', 'to_date', 'tracking', 'org'], by_cat_cash: ['from_date', 'to_date', 'tracking', 'org'], pnl: ['from_date', 'to_date', 'org'], pnl_cash: ['from_date', 'to_date', 'org'], cats: ['org'], org: ['org'], connections: [] },
  tools: { by_cat: 'get_profit_and_loss (columns by the tracking category)', by_cat_cash: 'get_profit_and_loss (columns by the tracking category, cash basis)', pnl: 'get_profit_and_loss (no tracking — for the tie)', pnl_cash: 'get_profit_and_loss (no tracking, cash basis)', cats: 'list_tracking_categories', org: 'get_organisation', connections: 'list_connections' },
  sources: { by_cat: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis === 'Cash'; } }, by_cat_cash: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis !== 'Cash'; } },
    pnl: { name: 'Profit and Loss', optional: true, quiet: function (i) { return i.basis === 'Cash'; } }, pnl_cash: { name: 'Profit and Loss', optional: true, quiet: function (i) { return i.basis !== 'Cash'; } } },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash', tsel = c.inputs.tracking || '';
    var cats = (((c.data.cats || {}).TrackingCategories) || []).filter(function (t) { return t.Status !== 'ARCHIVED' && t.Status !== 'DELETED'; });
    if (c.errors.cats) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('cats')) + '</p>'; return { checks: [{ name: 'Tracking categories loaded', pass: false, detail: c.err('cats') }] }; }
    if (!c.data.cats) return {};
    if (!cats.length) { body.innerHTML = '<p class="muted">This organisation has no active tracking categories (Xero → Accounting → Advanced → Tracking categories), so sales cannot be split by category. See CRA-16 for Sales Overview without tracking.</p>'; return { checks: [{ name: 'Tracking categories', pass: null, detail: 'N/A — none set up in Xero' }] }; }
    var tcat = cats.filter(function (t) { return t.TrackingCategoryID === tsel; })[0];
    if (!tcat) { if (c.live && !self._picking) { self._picking = true; setTimeout(function () { self._picking = false; c.change({ tracking: cats[0].TrackingCategoryID }); }, 0); } body.innerHTML = '<p class="muted">Loading ' + XK.h(cats[0].Name) + '…</p>'; return {}; }
    var tid = cash ? 'by_cat_cash' : 'by_cat', pid = cash ? 'pnl_cash' : 'pnl';
    if (c.errors[tid]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(tid)) + '</p>'; return { checks: [{ name: 'Sales by ' + tcat.Name + ' loaded', pass: false, detail: c.err(tid) }] }; }
    if (!c.data[tid]) { body.innerHTML = '<p class="muted">Loading…</p>'; return {}; }
    var w = XK.walk(c.data[tid]), cols = w.columns.slice(), n = cols.length, totalI = n - 1, opts = (tcat.Options || []).filter(function (o) { return o.Status !== 'ARCHIVED' && o.Status !== 'DELETED'; });
    var inc = w.sections.filter(function (s) { return /^income$/i.test(s.title); })[0];
    if (!inc) { body.innerHTML = '<p class="muted">No Income section on this organisation\'s Profit and Loss.</p>'; return { checks: [{ name: 'Income section present', pass: null, detail: 'N/A — not in source' }] }; }
    var optTotals = cols.map(function (_, i) { return XK.sum(inc.rows.map(function (r) { return r.values[i]; })); }), grand = optTotals[totalI];
    var labels = cols.slice(0, totalI), rows = labels.map(function (name, i) { return { name: name, value: optTotals[i], share: grand ? optTotals[i] / grand : null }; }).sort(function (a, b) { return b.value - a.value; });
    body.innerHTML = '<div class="xk-card no-print" style="margin-bottom:12px"><label class="muted">Tracking category <select id="tc-cat">' + cats.map(function (t) { return '<option value="' + XK.h(t.TrackingCategoryID) + '"' + (t.TrackingCategoryID === tsel ? ' selected' : '') + '>' + XK.h(t.Name) + '</option>'; }).join('') + '</select></label></div>' +
      XK.kpis([{ label: 'Total sales', value: grand }, { label: 'Options with sales', text: String(rows.filter(function (r) { return r.value; }).length) + ' of ' + rows.length }], c) +
      '<div class="xk-card" style="margin-top:16px"><h3>Sales by ' + XK.h(tcat.Name) + '</h3><div id="st-bars"></div><div id="st-grid"></div></div>';
    var cs = document.getElementById('tc-cat'); if (cs) cs.addEventListener('change', function () { c.change({ tracking: this.value }); });
    XK.bars(document.getElementById('st-bars'), { title: 'Sales by ' + tcat.Name, labels: rows.map(function (r) { return r.name; }), series: [{ name: 'Sales', values: rows.map(function (r) { return r.value; }) }] }, c);
    XK.grid(document.getElementById('st-grid'), { rows: rows.map(function (r) { return { name: r.name, value: r.value, share: r.share == null ? 'N/A' : XK.pct(r.share) }; }), columns: [{ key: 'name', title: tcat.Name }, { key: 'value', title: 'Sales', money: true }, { key: 'share', title: 'Share' }], total: { name: 'Total', value: grand }, empty: 'No sales in this period.' }, c);
    // ---- checks
    var addsUp = XK.near(XK.sum(optTotals.slice(0, totalI)), grand);
    var pw = c.data[pid] ? XK.walk(c.data[pid]) : null, pInc = pw ? pw.sections.filter(function (s) { return /^income$/i.test(s.title); })[0] : null, pTotal = pInc ? XK.sectionTotal(pInc, 0) : null;
    var checks = [
      { name: 'Options (incl. Unassigned) add up to the Total column', pass: addsUp, detail: money(XK.sum(optTotals.slice(0, totalI))) + ' vs ' + money(grand) },
      { name: 'Total sales = the Income section of the Profit and Loss without tracking (a separate Xero report)', pass: pTotal == null ? null : XK.near(grand, pTotal), detail: pTotal == null ? (c.err(pid) || 'N/A') : money(grand) + ' vs ' + money(pTotal) }
    ];
    this._x = { rows: rows, grand: grand, cat: tcat.Name };
    return { checks: checks, notes: ['Sales = the Income section of Xero\'s Profit and Loss, with a column for every option of ' + tcat.Name + ' and an Unassigned column for sales with no option. One category at a time avoids double counting.'],
      na: ['Two tracking categories at once (Xero reports one category\'s columns at a time)'], title: 'Sales by ' + tcat.Name };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Sales by ' + x.cat, s: 'bold' }], [XK.periodLine(c.inputs.from_date, c.inputs.to_date)], []];
    var rows = head.concat([[{ v: x.cat, s: 'bold' }, { v: 'Sales', s: 'bold' }, { v: 'Share', s: 'bold' }]]).concat(x.rows.map(function (r) { return [r.name, { v: r.value, s: 'money' }, r.share == null ? 'N/A' : { v: r.share, s: 'pct' }]; })).concat([[{ v: 'Total', s: 'bold' }, { v: x.grand, s: 'moneyBold' }]]);
    return [{ name: 'Sales by tracking', rows: rows, widths: [28, 16, 12] }];
  }
});

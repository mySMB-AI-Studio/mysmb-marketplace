XK.app({
  title: 'Profit and Loss by tracking category', primary: 'pnl', dated: ['pnl'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', org: 'org', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', basis: 'Accrual', tracking: '', org: '',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","o":"opt="}' },
  uses: { by_cat: ['from_date', 'to_date', 'tracking', 'org'], by_cat_cash: ['from_date', 'to_date', 'tracking', 'org'], pnl: ['from_date', 'to_date', 'org'], pnl_cash: ['from_date', 'to_date', 'org'], cats: ['org'], org: ['org'], connections: [] },
  tools: { by_cat: 'get_profit_and_loss (columns by the tracking category)', by_cat_cash: 'get_profit_and_loss (columns by the tracking category, cash basis)', pnl: 'get_profit_and_loss (no tracking — for the tie)', pnl_cash: 'get_profit_and_loss (no tracking, cash basis)', cats: 'list_tracking_categories', org: 'get_organisation', connections: 'list_connections' },
  // until a category is chosen (a template copy opens without one, and picks the first) the tracking calls are expected to fail quietly;
  // the basis not shown is never needed
  sources: { by_cat: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis === 'Cash'; } }, by_cat_cash: { name: 'Tracking', optional: true, quiet: function (i) { return !i.tracking || i.basis !== 'Cash'; } },
    pnl: { name: 'Profit and Loss', optional: true, quiet: function (i) { return i.basis === 'Cash'; } }, pnl_cash: { name: 'Profit and Loss', optional: true, quiet: function (i) { return i.basis !== 'Cash'; } } },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash', tsel = c.inputs.tracking || '';
    var cats = (((c.data.cats || {}).TrackingCategories) || []).filter(function (t) { return t.Status !== 'ARCHIVED' && t.Status !== 'DELETED'; });
    if (c.errors.cats) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('cats')) + '</p>'; return { checks: [{ name: 'Tracking categories loaded', pass: false, detail: c.err('cats') }] }; }
    if (!c.data.cats) return {};
    if (!cats.length) { body.innerHTML = '<p class="muted">This organisation has no active tracking categories (Xero → Accounting → Advanced → Tracking categories). The Profit and Loss report shows it without tracking.</p>'; return { checks: [{ name: 'Tracking categories', pass: null, detail: 'N/A — none set up in Xero' }] }; }
    var tcat = cats.filter(function (t) { return t.TrackingCategoryID === tsel; })[0];
    if (!tcat) { if (c.live && !self._picking) { self._picking = true; setTimeout(function () { self._picking = false; c.change({ tracking: cats[0].TrackingCategoryID }); }, 0); } body.innerHTML = '<p class="muted">Loading ' + XK.h(cats[0].Name) + '…</p>'; return {}; }
    var tid = cash ? 'by_cat_cash' : 'by_cat', pid = cash ? 'pnl_cash' : 'pnl';
    if (c.errors[tid]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(tid)) + '</p>'; return { checks: [{ name: 'Profit and Loss by ' + tcat.Name + ' loaded', pass: false, detail: c.err(tid) }] }; }
    if (!c.data[tid]) { body.innerHTML = '<p class="muted">Loading…</p>'; return {}; }
    var w = XK.walk(c.data[tid]), cols = w.columns.slice(), n = cols.length, totalI = n - 1, opts = (tcat.Options || []).filter(function (o) { return o.Status !== 'ARCHIVED' && o.Status !== 'DELETED'; });
    var osel = c.opt('opt') || '', oi = osel ? cols.indexOf((opts.filter(function (o) { return o.TrackingOptionID === osel; })[0] || {}).Name) : -1;
    var shownCols = oi >= 0 ? [oi, totalI] : cols.map(function (_, i) { return i; });
    var lines = w.lines.map(function (l) { return Object.assign({}, l, { values: shownCols.map(function (i) { return (l.values || [])[i]; }) }); });
    body.innerHTML = '<div class="xk-card no-print" style="margin-bottom:12px"><label class="muted">Tracking category <select id="tc-cat">' + cats.map(function (t) { return '<option value="' + XK.h(t.TrackingCategoryID) + '"' + (t.TrackingCategoryID === tsel ? ' selected' : '') + '>' + XK.h(t.Name) + '</option>'; }).join('') + '</select></label> ' +
      '<label class="muted">Option <select id="tc-opt"><option value="">All options, side by side</option>' + opts.map(function (o) { return '<option value="' + XK.h(o.TrackingOptionID) + '"' + (o.TrackingOptionID === osel ? ' selected' : '') + '>' + XK.h(o.Name) + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="muted">' + XK.h(tcat.Name) + ': ' + XK.h(oi >= 0 ? cols[oi] + ' (with the organisation total)' : 'every option, Unassigned and the total') + '</p><div class="xk-scroll">' + XK.statement(lines, [''].concat(shownCols.map(function (i) { return cols[i]; })), c) + '</div>';
    var cs = document.getElementById('tc-cat'); if (cs) cs.addEventListener('change', function () { c.change({ tracking: this.value }, { o: 'opt=' }); });
    var os = document.getElementById('tc-opt'); if (os) os.addEventListener('change', function () { c.setOpt('opt', this.value); });
    // checks (every column)
    var badSec = []; w.sections.forEach(function (s) { if (!s.summary) return; for (var i = 0; i < n; i++) if (!XK.near(XK.sum(s.rows.map(function (l) { return l.values[i]; })), s.summary.values[i], 0.05)) { badSec.push(s.label + ' · ' + cols[i]); break; } });
    var parts = cols.map(function (_, i) { return XK.plParts(w, i); }), badNp = parts.filter(function (p) { return p.np != null && p.gp != null && p.income != null && !XK.near(p.np, Math.round((p.income - p.expenses) * 100) / 100, 0.05); });
    var addsUp = w.lines.filter(function (l) { return l.kind !== 'header' && (l.values || []).length === n; }).filter(function (l) { return !XK.near(XK.sum(l.values.slice(0, n - 1)), l.values[n - 1], 0.05); });
    var pw = c.data[pid] ? XK.walk(c.data[pid]) : null, npAll = pw ? XK.plParts(pw).np : null, npTot = parts[totalI] ? parts[totalI].np : null;
    var checks = [
      { name: 'Every section total = Σ its account rows (each column)', pass: badSec.length === 0, detail: badSec.length ? badSec.length + ' differ, e.g. ' + badSec[0] : w.sections.length + ' section(s) × ' + n + ' column(s)' },
      { name: 'Net Profit = income − expenses (each column)', pass: badNp.length === 0, detail: badNp.length ? badNp.length + ' column(s) differ' : n + ' column(s)' },
      { name: 'Options + Unassigned = the Total column (every line)', pass: addsUp.length === 0, detail: addsUp.length ? addsUp.length + ' line(s) differ, e.g. ' + addsUp[0].label : 'Every line' },
      { name: 'The Total column\'s Net Profit = the Profit and Loss without tracking (a separate Xero report)', pass: npAll == null || npTot == null ? null : XK.near(npAll, npTot), detail: npAll == null ? (c.err(pid) || 'N/A') : money(npTot) + ' vs ' + money(npAll) }
    ];
    this._x = { lines: lines, titles: [''].concat(shownCols.map(function (i) { return cols[i]; })), cat: tcat.Name };
    return { checks: checks, notes: ['Xero\'s Profit and Loss with a column for every option of ' + tcat.Name + ', an Unassigned column for amounts with no option, and the total. Choosing one option shows its column beside the total (no refetch).'],
      na: ['Two tracking categories at once (choose one category; Xero\'s second-category columns are not shown here)'], title: 'Profit and Loss by ' + tcat.Name };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [XK.sheetFromLines('By ' + x.cat, c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date), x.titles, x.lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values }; }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), x.titles.slice(1).map(function () { return 'money'; }))];
  }
});

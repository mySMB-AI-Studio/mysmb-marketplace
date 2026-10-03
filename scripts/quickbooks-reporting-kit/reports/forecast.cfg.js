QB.app({
  title: 'Forecast', token: null, primary: 'pnl_monthly', company: 'company_info', prefs: 'prefs', headerEnd: false,
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  presets: [['last_12m', 'Last 12 months'], ['last_24m', 'Last 24 months'], ['last_fy', 'Last financial year'], ['this_fy_td', 'This financial year to date'], ['custom', 'Custom']],
  defaults: { start_date: '2025-09-01', end_date: '2026-08-31', basis: 'Accrual', horizon: '12', method: 'trend', adjust: '{}', persona: 'Executive',
    display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"last_12m","a":"custom","c":"none","v":"grid","x":""}' },
  uses: { pnl_monthly: ['start_date', 'basis'], company_info: [], prefs: [] },
  tools: { pnl_monthly: 'get_report_profit_and_loss (base period to today, by month)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  enums: [{ input: 'horizon', label: 'Forecast months', options: [['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['18', '18 months'], ['24', '24 months']] },
    { input: 'method', label: 'Method', options: [['trend', 'Linear trend'], ['average', 'Average of base period'], ['seasonal', 'Same month last year']] }],
  views: [['grid', 'Forecast'], ['scenarios', 'Forecast scenarios'], ['fva', 'Forecast vs actual']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'grid', h = QB.h, self = this;
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    if (c.errors.pnl_monthly) { body.innerHTML = '<p class="qb-err">Actuals are unavailable — not zero: ' + h(c.err('pnl_monthly')) + '</p>'; return { checks: [{ name: 'Base period equals actuals', pass: false, detail: c.err('pnl_monthly') }] }; }
    var rep = c.data.pnl_monthly; if (!rep) return {};
    var GROUPS = ['Income', 'COGS', 'Expenses', 'OtherIncome', 'OtherExpenses'], SIGN = { Income: 1, COGS: -1, Expenses: -1, OtherIncome: 1, OtherExpenses: -1 };
    var NAME = { Income: 'Income', COGS: 'Cost of Sales', Expenses: 'Expenses', OtherIncome: 'Other Income', OtherExpenses: 'Other Expenses' };
    var mon = function (ym) { return QB.MONTHS[+ym.slice(5, 7) - 1].slice(0, 3) + ' ' + ym.slice(0, 4); };
    var cols = QB.cols(rep), mcols = cols.slice(1).filter(function (x) { return x.start && x.end; }), tcol = cols.filter(function (x) { return x.i > 0 && !x.start; })[0];
    var full = function (x) { return x.start.slice(8) === '01' && x.end === QB.iso(QB.eom(+x.start.slice(0, 4), +x.start.slice(5, 7))); };
    var sIso = c.inputs.start_date, eIso = c.inputs.end_date;
    if (eIso < sIso) { body.innerHTML = '<p class="qb-err">The base period ends before it starts. Change From or To.</p>'; return { checks: [{ name: 'Base period equals actuals', pass: null, detail: 'Base period is empty' }] }; }
    var base = mcols.filter(function (x) { return x.start >= sIso.slice(0, 7) + '-01' && x.end <= eIso && full(x); }), n = base.length;
    var after = mcols.filter(function (x) { return x.start > (base.length ? base[n - 1].end : eIso); });
    // Accounts: every Data row (and any parent header that carries its own amounts) under the five P&L sections
    var ls = QB.walk(rep), top = {};
    ls.forEach(function (l) { if (l.kind === 'header' && l.depth === 0) top[l.label] = l.group; });
    var accts = ls.filter(function (l) { return (l.kind === 'row' || (l.kind === 'header' && l.depth > 0 && l.values.some(function (x) { return x != null; }))) && l.path.length; })
      .map(function (l) { return { l: l, g: top[l.path[0]], key: 'a:' + (l.id || l.label), name: l.label, depth: l.depth }; }).filter(function (a) { return GROUPS.indexOf(a.g) >= 0; });
    var adj = {}; try { adj = JSON.parse(c.inputs.adjust || '{}') || {}; } catch (e) { adj = {}; }
    var H = Math.max(1, parseInt(c.inputs.horizon, 10) || 12), method = c.inputs.method || 'trend', useM = method === 'seasonal' && n < 12 ? 'average' : method;
    var fit = function (s) {
      var k = s.length, mean = k ? s.reduce(function (a, b) { return a + b; }, 0) / k : 0;
      if (useM === 'trend' && k >= 2) { var xm = (k - 1) / 2, sxy = 0, sxx = 0; s.forEach(function (y, i) { sxy += (i - xm) * (y - mean); sxx += (i - xm) * (i - xm); }); var b = sxx ? sxy / sxx : 0, a = mean - b * xm; return function (t) { return a + b * t; }; }
      if (useM === 'seasonal') return function (t) { return t < k ? s[t] : s[t - 12 * Math.ceil((t - (k - 1)) / 12)]; };
      return function () { return mean; };
    };
    var fm = []; if (n) { var y0 = +base[n - 1].start.slice(0, 4), m0 = +base[n - 1].start.slice(5, 7); for (var k = 1; k <= H; k++) fm.push(QB.iso(new Date(Date.UTC(y0, m0 - 1 + k, 1))).slice(0, 7)); }
    var fIdx = {}; fm.forEach(function (m, i) { fIdx[m] = i; });
    accts.forEach(function (a) {
      var s = base.map(function (x) { return a.l.values[x.i - 1] || 0; }), f = fit(s), own = adj[a.key] != null && adj[a.key] !== '', p = Number(own ? adj[a.key] : adj[a.g]) || 0;
      a.base = s; a.baseTot = QB.sum(s); a.pct = p; a.own = own;
      var pos = s.every(function (x) { return x >= 0; }), neg = s.every(function (x) { return x <= 0; }), hit = false; // never cross zero if the base never did
      a.raw = fm.map(function (_, i) { var x = n ? r2(f(n + i)) : 0; if (pos && x < 0 || neg && x > 0) { hit = true; x = 0; } return x; }); a.fc = a.raw.map(function (x) { return r2(x * (1 + p / 100)); }); a.floored = hit;
      a.act = after.map(function (x) { return a.l.values[x.i - 1] || 0; });
      a.rawTot = QB.sum(a.raw); a.fcTot = QB.sum(a.fc);
    });
    var sec = function (g, key, i) { return QB.sum(accts.filter(function (a) { return a.g === g; }).map(function (a) { return i == null ? QB.sum(a[key]) : a[key][i]; })); };
    var net = function (key, i) { return r2(GROUPS.reduce(function (s, g) { return s + SIGN[g] * sec(g, key, i); }, 0)); };
    var gp = function (key, i) { return r2(sec('Income', key, i) - sec('COGS', key, i)); };
    var present = GROUPS.filter(function (g) { return accts.some(function (a) { return a.g === g; }); });
    if (!accts.length || !n) {
      body.innerHTML = '<p class="muted">Data appears once it\'s available. ' + (n ? 'QuickBooks returned no Profit and Loss accounts for the base period.' : 'The base period has no complete months — choose Last 12 months or a period that ends on a month end.') + '</p>';
      return { checks: [{ name: 'Base period equals actuals', pass: null, detail: n ? 'No accounts' : 'No complete months' }], na: ['Forecast (no base-period actuals)'] };
    }
    // Net profit series, fit and range (80% band from the base-period residuals, widening with distance)
    var baseNet = base.map(function (_, i) { return net('base', i); }), fcNet = fm.map(function (_, i) { return net('fc', i); }), rawNet = fm.map(function (_, i) { return net('raw', i); });
    var nf = (function () { var keep = useM; if (useM === 'seasonal') useM = 'average'; var f = fit(baseNet); useM = keep; return f; })();
    var sd = n > 2 ? Math.sqrt(baseNet.reduce(function (s, y, i) { var e = y - nf(i); return s + e * e; }, 0) / (n - 1)) : 0;
    var band = fcNet.map(function (y, i) { var w = 1.28 * sd * Math.sqrt(1 + (i + 1) / n); return [r2(y - w), r2(y + w)]; });
    var actNet = after.map(function (_, i) { return net('act', i); });
    var adjText = Object.keys(adj).filter(function (k) { return Number(adj[k]); }).map(function (k) { var a = accts.filter(function (x) { return x.key === k; })[0]; return (NAME[k] || (a ? a.name : k.replace(/^a:/, ''))) + ' ' + (adj[k] > 0 ? '+' : '') + adj[k] + '%'; });
    var mLabel = { trend: 'Linear trend', average: 'Average of base period', seasonal: 'Same month last year' };
    var html = QB.kpis([{ label: 'Forecast income (' + H + ' months)', value: QB.sum(fm.map(function (_, i) { return sec('Income', 'fc', i); })) }, { label: 'Forecast net profit (' + H + ' months)', value: QB.sum(fcNet) },
      { label: 'Base period net profit (' + n + ' months)', value: QB.sum(baseNet) }, { label: 'Adjustments', text: adjText.length ? adjText.slice(0, 3).join(' · ') + (adjText.length > 3 ? ' +' + (adjText.length - 3) : '') : 'None' }], c);
    html += '<div class="qb-card" id="w-assump" style="margin:12px 0"><h3>Growth assumptions</h3><p class="muted">Change a section by a fixed percentage' + (c.persona === 'Client' || c.persona === 'Executive' ? '' : ', or an account in the Adjust % column') + '. Nothing is written to QuickBooks.</p><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
      present.map(function (g) { return '<label class="ctl">' + h(NAME[g]) + ' %<input type="number" step="0.5" class="w-adj" style="width:90px" data-k="' + g + '" value="' + h(adj[g] != null ? adj[g] : '') + '" placeholder="0"></label>'; }).join('') +
      '<label class="ctl">&nbsp;<button type="button" id="w-adj-reset" style="width:auto"' + (Object.keys(adj).length ? '' : ' disabled') + '>Clear adjustments</button></label></div>' + (self._msg ? '<p class="qb-err">' + h(self._msg) + '</p>' : '') + '</div>';
    html += '<div id="g1"></div><div class="qb-card" style="margin-top:16px"><h3>Net profit — actual to forecast</h3><div id="ch1"></div></div>';
    body.innerHTML = html;
    var g1 = document.getElementById('g1'), detail = !(c.persona === 'Client' || c.persona === 'Executive');
    var td = function (x) { return '<td class="num' + (c.display.red && x < 0 ? ' neg' : '') + '">' + money(x) + '</td>'; };
    if (v === 'scenarios') {
      var srow = function (label, fn, cls) { var b = fn('base'), r = fn('raw'), f = fn('fc'); return '<tr class="' + (cls || '') + '"><td>' + h(label) + '</td>' + td(b) + td(r) + td(f) + td(r2(f - r)) + '<td class="num">' + (r ? QB.pct((f - r) / Math.abs(r)) : '') + '</td></tr>'; };
      var t = '<div class="qb-scroll"><table class="qb-stmt"><thead><tr><th>Scenario</th><th class="num">Base period actual (' + n + ' mo)</th><th class="num">Forecast — no adjustments (' + H + ' mo)</th><th class="num">Forecast — with adjustments</th><th class="num">$ Change</th><th class="num">% Change</th></tr></thead><tbody>';
      present.forEach(function (g) { t += srow('Total for ' + NAME[g], function (key) { return sec(g, key); }, 'k-total'); if (g === 'COGS' || (g === 'Income' && present.indexOf('COGS') < 0)) t += srow('Gross Profit', function (key) { return r2(sec('Income', key) - sec('COGS', key)); }, 'k-total'); });
      t += srow('Net Profit', function (key) { return r2(GROUPS.reduce(function (s, g) { return s + SIGN[g] * sec(g, key); }, 0)); }, 'k-total');
      t += '</tbody></table></div>';
      t += '<div class="qb-scroll detail-block" style="margin-top:12px"><table class="qb-stmt"><thead><tr><th>Account</th><th class="num">Base period actual</th><th class="num">Forecast — no adjustments</th><th class="num">Adjust %</th><th class="num">Forecast — with adjustments</th></tr></thead><tbody>' +
        accts.map(function (a) { return '<tr class="k-row detail-block"><td style="padding-left:' + (8 + a.depth * 18) + 'px">' + h(a.name) + '</td>' + td(a.baseTot) + td(a.rawTot) + '<td class="num">' + (a.pct ? (a.pct > 0 ? '+' : '') + a.pct + '%' : '') + '</td>' + td(a.fcTot) + '</tr>'; }).join('') + '</tbody></table></div>';
      g1.innerHTML = t;
    } else if (v === 'fva') {
      if (!after.length) g1.innerHTML = '<p class="muted">No months have passed since the base period, so there are no actuals to compare yet. Choose an earlier base period (for example Last financial year) to see the forecast against actuals.</p>';
      else {
        var mtd = after.map(function (x) { return !full(x) || x.end > c.today; });
        var t2 = '<div class="qb-scroll"><table class="qb-stmt"><thead><tr><th>Month</th><th class="num">Forecast income</th><th class="num">Actual income</th><th class="num">Forecast net profit</th><th class="num">Actual net profit</th><th class="num">Variance</th></tr></thead><tbody>';
        after.forEach(function (x, i) { var m = x.start.slice(0, 7), k = fIdx[m]; t2 += '<tr class="k-row"><td>' + h(mon(m) + (mtd[i] ? ' (month to date)' : '')) + '</td>' + (k == null ? '<td></td>' : td(sec('Income', 'fc', k))) + td(sec('Income', 'act', i)) + (k == null ? '<td></td>' : td(fcNet[k])) + td(actNet[i]) + (k == null ? '<td></td>' : td(r2(actNet[i] - fcNet[k]))) + '</tr>'; });
        t2 += '</tbody></table></div><div class="qb-scroll detail-block" style="margin-top:12px"><table class="qb-stmt"><thead><tr><th>Account</th><th class="num">Forecast</th><th class="num">Actual</th><th class="num">Variance</th></tr></thead><tbody>' +
          accts.map(function (a) { var fsum = QB.sum(after.map(function (x) { var k = fIdx[x.start.slice(0, 7)]; return k == null ? 0 : a.fc[k]; })), asum = QB.sum(a.act); return '<tr class="k-row detail-block"><td style="padding-left:' + (8 + a.depth * 18) + 'px">' + h(a.name) + '</td>' + td(fsum) + td(asum) + td(r2(asum - fsum)) + '</tr>'; }).join('') + '</tbody></table></div>';
        g1.innerHTML = t2;
      }
    } else {
      var head = '<tr><th>Account</th>' + (detail ? '<th class="num">Adjust %</th>' : '') + fm.map(function (m) { return '<th class="num">' + h(mon(m)) + '</th>'; }).join('') + '<th class="num">Total</th></tr>';
      var line = function (label, vals, cls, depth, extra) { return '<tr class="' + cls + '"><td style="padding-left:' + (8 + (depth || 0) * 18) + 'px;white-space:nowrap">' + h(label) + '</td>' + (detail ? '<td class="num">' + (extra || '') + '</td>' : '') + vals.map(td).join('') + td(QB.sum(vals)) + '</tr>'; };
      var t3 = '<div class="qb-scroll"><table class="qb-stmt"><thead>' + head + '</thead><tbody>';
      present.forEach(function (g) {
        t3 += '<tr class="k-header"><td style="white-space:nowrap">' + h(NAME[g]) + '</td>' + (detail ? '<td></td>' : '') + fm.map(function () { return '<td></td>'; }).join('') + '<td></td></tr>';
        accts.filter(function (a) { return a.g === g; }).forEach(function (a) { if (!c.display.zeros && !a.fc.some(function (x) { return Math.abs(x) >= 0.005; })) return; t3 += line(a.name, a.fc, 'k-row detail-block', a.depth, '<input type="number" step="0.5" class="w-adj" data-k="' + h(a.key) + '" value="' + h(a.own ? adj[a.key] : '') + '" placeholder="' + h(adj[g] || 0) + '" aria-label="Adjust ' + h(a.name) + ' %" style="width:64px">'); });
        t3 += line('Total for ' + NAME[g], fm.map(function (_, i) { return sec(g, 'fc', i); }), 'k-total', 0);
        if (g === 'COGS' || (g === 'Income' && present.indexOf('COGS') < 0)) t3 += line('Gross Profit', fm.map(function (_, i) { return gp('fc', i); }), 'k-total', 0);
      });
      t3 += line('Net Profit', fcNet, 'k-total', 0) + '</tbody></table></div>';
      g1.innerHTML = t3;
    }
    // Chart: actual (base + months since) -> forecast with the 80% range
    var labs = base.map(function (x) { return mon(x.start.slice(0, 7)); }).concat(fm.map(mon));
    var actSeries = baseNet.concat(fm.map(function (m) { for (var i = 0; i < after.length; i++) if (after[i].start.slice(0, 7) === m) return actNet[i]; return null; }));
    var fcSeries = base.map(function (_, i) { return i === n - 1 ? baseNet[i] : null; }).concat(fcNet);
    QB.line(document.getElementById('ch1'), { title: 'Net profit — actual to forecast', labels: labs, series: [{ name: 'Actual', values: actSeries }, { name: 'Forecast (estimate)', values: fcSeries }],
      band: { name: '80% range (estimate)', low: base.map(function () { return null; }).concat(band.map(function (b) { return b[0]; })), high: base.map(function () { return null; }).concat(band.map(function (b) { return b[1]; })) } }, c);
    // Growth assumptions: section and account percentages (display-only; never refetches)
    var setAdj = function (k, val) {
      var nx = Object.assign({}, adj); if (val === '' || !isFinite(Number(val)) || Number(val) === 0) delete nx[k]; else nx[k] = Math.round(Number(val) * 100) / 100;
      var s = JSON.stringify(nx); if (s.length > 400) { self._msg = 'Too many account adjustments to save — clear some, or adjust whole sections instead.'; c.change({}); return; }
      self._msg = ''; c.change({ adjust: s });
    };
    body.querySelectorAll('input.w-adj').forEach(function (el) { el.addEventListener('change', function () { setAdj(el.getAttribute('data-k'), el.value); }); });
    var rs = document.getElementById('w-adj-reset'); if (rs) rs.addEventListener('click', function () { self._msg = ''; c.change({ adjust: '{}' }); });
    // STEP 4 checks
    var niL = QB.find(ls, 'NetIncome'), allM = base.concat(after);
    var rebuilt = function (x) { return r2(GROUPS.reduce(function (s, g) { return s + SIGN[g] * QB.sum(accts.filter(function (a) { return a.g === g; }).map(function (a) { return a.l.values[x.i - 1] || 0; })); }, 0)); };
    var bad = niL ? allM.filter(function (x) { return !QB.near(rebuilt(x), niL.values[x.i - 1] || 0, 0.05); }) : [];
    var colsOk = tcol ? accts.every(function (a) { return QB.near(QB.sum(mcols.map(function (x) { return a.l.values[x.i - 1] || 0; })), a.l.values[tcol.i - 1] || 0, 0.05); }) : null;
    var identOk = fm.every(function (_, i) { return QB.near(fcNet[i], r2(sec('Income', 'fc', i) - sec('COGS', 'fc', i) - sec('Expenses', 'fc', i) + sec('OtherIncome', 'fc', i) - sec('OtherExpenses', 'fc', i)), 0.05); });
    var need = method === 'seasonal' ? 12 : 3;
    var checks = [
      { name: 'Base period equals actuals: net profit rebuilt from the accounts = QuickBooks Net Income (every month)', pass: niL ? !bad.length : null, detail: niL ? (bad.length ? 'Differs in ' + bad.map(function (x) { return mon(x.start.slice(0, 7)); }).join(', ') : n + ' base months' + (after.length ? ' + ' + after.length + ' since' : '') + ', ' + money(QB.sum(baseNet)) + ' base net profit') : 'QuickBooks returned no Net Income line' },
      { name: 'Monthly columns = QuickBooks total (every account)', pass: colsOk, detail: accts.length + ' accounts' },
      { name: 'Forecast net profit = income − cost of sales − expenses + other income − other expenses (every month)', pass: identOk, detail: money(QB.sum(fcNet)) + ' over ' + H + ' months' },
      { name: 'Base period has enough history for the method', pass: n >= need ? true : null, detail: n + ' complete months (' + mLabel[method] + ' needs ' + need + ')' + (useM !== method ? ' — using Average of base period instead' : '') }];
    this._x = { accts: accts, fm: fm, base: base, after: after, fcNet: fcNet, actNet: actNet, band: band, n: n, H: H, method: method, useM: useM, adjText: adjText, present: present, NAME: NAME, SIGN: SIGN, mon: mon, fIdx: fIdx };
    var vt = (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1];
    return { checks: checks, title: vt === 'Forecast' ? 'Forecast — ' + mLabel[useM] : vt,
      period: 'Base period ' + QB.periodLine(base[0].start, base[n - 1].end) + ' · forecast ' + mon(fm[0]) + ' - ' + mon(fm[H - 1]),
      notes: ['This is an estimate projected from past results (' + mLabel[useM] + ' of each account over the ' + n + ' base months), not a figure from QuickBooks. The shaded range is where 80% of outcomes would fall if the base-period variation continued.',
        'Adjustments change the forecast only; nothing is written to QuickBooks.'].concat(accts.some(function (a) { return a.floored; }) ? [accts.filter(function (a) { return a.floored; }).length + ' account(s) trend past zero within the forecast (' + accts.filter(function (a) { return a.floored; }).slice(0, 4).map(function (a) { return a.name; }).join(', ') + (accts.filter(function (a) { return a.floored; }).length > 4 ? ', …' : '') + ') and are held at zero — an account that never changed sign in the base period is not forecast to. Consider Average of base period when the history is uneven.'] : []).concat(useM !== method ? ['Same month last year needs 12 complete base months; this base period has ' + n + ', so the average is used.'] : [])
        .concat(mcols.some(function (x) { return x.start >= sIso && x.end <= eIso && !full(x); }) ? ['Partial months in the base period are left out of the forecast (the base period uses complete months only).'] : []),
      na: ['Saved forecasts inside QuickBooks (Reports › Financial planning › Forecasts are not in the Accounting API) — this report is recomputed on every open', 'Balance Sheet and cash forecasts'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var L = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    var nC = x.fm.length, last = L(nC), tot = L(nC + 1);
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Forecast (estimate)', s: 'bold' }], ['Base period ' + QB.periodLine(x.base[0].start, x.base[x.n - 1].end)], [], [{ v: 'Account', s: 'bold' }].concat(x.fm.map(function (m) { return { v: x.mon(m), s: 'bold' }; }), [{ v: 'Total', s: 'bold' }])];
    var secRow = {};
    x.present.forEach(function (g) {
      rows.push([{ v: x.NAME[g], s: 'bold' }]); var first = rows.length + 1;
      x.accts.filter(function (a) { return a.g === g; }).forEach(function (a) { var R = rows.length + 1; rows.push([{ v: a.name, indent: 1 }].concat(a.fc.map(function (v) { return { v: v, s: 'money' }; }), [{ f: 'SUM(B' + R + ':' + last + R + ')', v: a.fcTot, s: 'money' }])); });
      var R2 = rows.length + 1, lastA = R2 - 1; secRow[g] = R2;
      rows.push([{ v: 'Total for ' + x.NAME[g], s: 'bold' }].concat(x.fm.map(function (_, i) { var col = L(i + 1); return { f: lastA >= first ? 'SUM(' + col + first + ':' + col + lastA + ')' : '0', s: 'moneyBold' }; }), [{ f: 'SUM(B' + R2 + ':' + last + R2 + ')', s: 'moneyBold' }]));
    });
    var RN = rows.length + 1;
    rows.push([{ v: 'Net Profit', s: 'bold' }].concat(x.fm.map(function (_, i) { var col = L(i + 1); return { f: x.present.map(function (g) { return (x.SIGN[g] < 0 ? '-' : '+') + col + secRow[g]; }).join('').replace(/^\+/, ''), v: x.fcNet[i], s: 'moneyBold' }; }), [{ f: 'SUM(B' + RN + ':' + last + RN + ')', s: 'moneyBold' }]));
    var mLabel = { trend: 'Linear trend', average: 'Average of base period', seasonal: 'Same month last year' };
    var sheets = [{ name: 'Forecast', widths: [40].concat(x.fm.map(function () { return 13; }), [15]), rows: rows },
      { name: 'Assumptions', widths: [34, 60], rows: [[{ v: 'Assumption', s: 'bold' }, { v: 'Value', s: 'bold' }], ['Method', mLabel[x.useM]], ['Base period', QB.periodLine(x.base[0].start, x.base[x.n - 1].end) + ' (' + x.n + ' complete months)'], ['Forecast months', x.H + ' (' + x.mon(x.fm[0]) + ' - ' + x.mon(x.fm[x.H - 1]) + ')'], ['Accounting method', c.inputs.basis], ['Adjustments', x.adjText.join('; ') || 'None'], ['Range', '80% range from base-period variation (estimate)'], ['Note', 'Estimate projected from QuickBooks actuals — not a QuickBooks figure']] }];
    if (x.after.length) sheets.push({ name: 'Forecast vs actual', widths: [22, 16, 16, 16], rows: [[{ v: 'Month', s: 'bold' }, { v: 'Forecast net profit', s: 'bold' }, { v: 'Actual net profit', s: 'bold' }, { v: 'Variance', s: 'bold' }]].concat(x.after.map(function (col, i) { var k = x.fIdx[col.start.slice(0, 7)], R = i + 2; return [x.mon(col.start.slice(0, 7)), k == null ? null : { v: x.fcNet[k], s: 'money' }, { v: x.actNet[i], s: 'money' }, k == null ? null : { f: 'C' + R + '-B' + R, s: 'money' }]; })) });
    return sheets;
  }
});

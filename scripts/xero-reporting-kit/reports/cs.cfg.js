XK.app({
  title: 'Cash Summary', primary: 'pnl_cash', dated: ['pnl_cash'], org: 'org', conns: 'connections', noBasis: true,
  inputs: { start: 'from_date', end: 'to_date', org: 'org', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-25', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"months"}' },
  uses: { pnl_cash: ['from_date', 'to_date', 'org'], bank: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  views: [['months', 'Month columns'], ['total', 'Total only']],
  fan: (function () {
    var months = function (inp, c) { if (c.view === 'total') return []; var ms = XK.monthsEnding(inp.to_date, 13).filter(function (m) { return m.end >= inp.from_date; }); if (ms.length < 2 || ms.length > 12) return [];
      return ms.map(function (m) { return { key: m.key, inputs: { from_date: m.start < inp.from_date ? inp.from_date : m.start, to_date: m.end > inp.to_date ? inp.to_date : m.end } }; }); };
    return { pnl_cash: months, bank: months };
  })(),
  tools: { pnl_cash: 'get_profit_and_loss (cash basis: paymentsOnly)', bank: 'get_bank_summary (opening and closing bank balances)', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; };
    if (c.errors.pnl_cash) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('pnl_cash')) + '</p>'; return { checks: [{ name: 'Profit and Loss (cash basis) loaded', pass: false, detail: c.err('pnl_cash') }] }; }
    if (!c.data.pnl_cash) return {};
    var bank = function (v) { var t = v ? XK.find(XK.walk(v).lines, null, /^total$/i, 'total') : null; return t ? { open: t.values[0], rin: t.values[1], rout: t.values[2], close: t.values[3], accts: XK.walk(v).lines.filter(function (l) { return l.kind === 'row'; }) } : null; };
    var cols = [{ title: 'Total', w: XK.walk(c.data.pnl_cash), b: bank(c.data.bank) }];
    var fp = c.fan('pnl_cash'), fb = c.fan('bank'), monthsOn = c.view !== 'total' && fp && fb && fp.length > 1;
    var mErr = monthsOn ? fp.concat(fb).filter(function (it) { return it.error; }) : [];
    if (monthsOn && !mErr.length) cols = fp.map(function (it, i) { return { title: XK.monthLabel(it.key), w: XK.walk(it.value), b: bank(fb[i].value) }; }).concat(cols);
    // accounts: income (cash received) and expense (cash spent) rows from every column, by account
    var acc = { rec: [], spent: [] }, seen = {};
    cols.forEach(function (col) { col.w.lines.forEach(function (l) { if (l.kind !== 'row') return; var k = (XK.isDeduction(l.group) ? 'spent' : 'rec') + '|' + (l.id || l.label); if (!seen[k]) { seen[k] = 1; acc[XK.isDeduction(l.group) ? 'spent' : 'rec'].push({ key: l.id || l.label, label: l.label }); } }); });
    var cell = function (col, key, spent) { var l = col.w.lines.filter(function (x) { return x.kind === 'row' && (x.id || x.label) === key && XK.isDeduction(x.group) === spent; })[0]; return l ? l.values[0] : 0; };
    var lines = [], per = function (f) { return cols.map(f); };
    var recT = per(function (col) { return XK.sum(acc.rec.map(function (a) { return cell(col, a.key, false); })); }), spT = per(function (col) { return XK.sum(acc.spent.map(function (a) { return cell(col, a.key, true); })); });
    lines.push({ kind: 'header', depth: 0, label: 'Cash Received', group: 'rec', values: [] });
    acc.rec.forEach(function (a) { lines.push({ kind: 'row', depth: 1, label: a.label, group: 'rec', values: per(function (col) { return cell(col, a.key, false); }) }); });
    lines.push({ kind: 'total', depth: 0, label: 'Total Cash Received', fixed: true, group: 'rec', values: recT });
    lines.push({ kind: 'header', depth: 0, label: 'Cash Spent', group: 'sp', values: [] });
    acc.spent.forEach(function (a) { lines.push({ kind: 'row', depth: 1, label: a.label, group: 'sp', values: per(function (col) { return cell(col, a.key, true); }) }); });
    lines.push({ kind: 'total', depth: 0, label: 'Total Cash Spent', fixed: true, group: 'sp', values: spT });
    var net = per(function (col, i) { return r2(recT[i] - spT[i]); }), move = per(function (col) { return col.b ? r2(col.b.close - col.b.open) : null; });
    lines.push({ kind: 'total', depth: 0, label: 'Net Cash Flows', fixed: true, calc: true, values: net });
    lines.push({ kind: 'total', depth: 0, label: 'Other cash movements (GST, balance-sheet accounts and transfers)', fixed: true, calc: true, values: per(function (col, i) { return move[i] == null ? null : r2(move[i] - net[i]); }) });
    lines.push({ kind: 'total', depth: 0, label: 'Net Movement in Bank', fixed: true, calc: true, values: move });
    lines.push({ kind: 'row', depth: 0, label: 'Opening bank balance', values: per(function (col) { return col.b ? col.b.open : null; }) });
    lines.push({ kind: 'total', depth: 0, label: 'Closing bank balance', fixed: true, calc: true, values: per(function (col) { return col.b ? col.b.close : null; }) });
    body.innerHTML = (monthsOn || c.view === 'total' ? '' : '<p class="muted">' + (fp == null && c.live ? 'Loading month columns…' : c.live ? 'Month columns need a period of 2–12 months.' : 'Month columns: N/A in a snapshot.') + '</p>') + (mErr.length ? '<p class="xk-err">Month columns could not be loaded: ' + XK.h(mErr[0].error) + '</p>' : '') +
      '<div class="xk-scroll">' + XK.statement(lines, [''].concat(cols.map(function (col) { return col.title; })), c) + '</div>' +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Cash received vs spent</h3><div id="cs-ch"></div></div>';
    XK.bars(document.getElementById('cs-ch'), { title: 'Cash received vs spent', labels: cols.map(function (col) { return col.title; }), series: [{ name: 'Cash received', values: recT, color: 'var(--pos)' }, { name: 'Cash spent', values: spT.map(function (v) { return -v; }), color: 'var(--neg)' }] }, c);
    // Checks
    var T = cols[cols.length - 1], npT = XK.plParts(T.w).np, months = cols.slice(0, -1);
    var checks = [
      { name: 'Net Cash Flows = Cash Received − Cash Spent (every column)', pass: net.every(function (v, i) { return XK.near(v, recT[i] - spT[i]); }), detail: money(net[net.length - 1]) },
      { name: 'Xero\'s cash-basis Net Profit = Cash Received − Cash Spent', pass: npT == null ? null : XK.near(npT, net[net.length - 1]), detail: npT == null ? 'No Net Profit line' : money(npT) },
      { name: 'Closing bank balance = opening + net movement (each account)', pass: T.b ? T.b.accts.every(function (a) { return XK.near(a.values[0] + a.values[1] - a.values[2], a.values[3]); }) : null, detail: T.b ? T.b.accts.length + ' account(s)' : c.err('bank') },
      months.length ? { name: 'Month columns add up to the period total (separate Xero reports)', pass: XK.near(XK.sum(months.map(function (m, i) { return net[i]; })), net[net.length - 1], 0.05) && XK.near(XK.sum(months.map(function (m) { return m.b ? m.b.rin : 0; })), T.b ? T.b.rin : 0, 0.05), detail: months.length + ' months' }
        : { name: 'Month columns add up to the period total', pass: null, detail: c.view === 'total' ? 'Total only' : c.live ? 'No month columns for this period' : 'N/A in a snapshot' },
      months.length ? { name: 'Each month opens where the previous one closed', pass: months.every(function (m, i) { return i === 0 || !m.b || !months[i - 1].b || XK.near(months[i - 1].b.close, m.b.open); }), detail: months.length + ' months' } : null
    ].filter(Boolean);
    this._lines = lines; this._titles = [''].concat(cols.map(function (col) { return col.title; }));
    return { checks: checks, notes: ['Cash Received and Cash Spent are Xero\'s Profit and Loss on the cash basis (GST-exclusive). "Other cash movements" is the balancing figure between that and the bank movement: GST, balance-sheet accounts (loans, assets, drawings) and transfers.'], na: ['Xero\'s own Cash Summary report (not in the Xero API) — rebuilt from the Profit and Loss and Bank Summary'], period: XK.periodLine(c.inputs.from_date, c.inputs.to_date) + ' · Cash basis' };
  },
  excel: function (c) { return [XK.sheetFromLines('Cash Summary', c.company, XK.periodLine(c.inputs.from_date, c.inputs.to_date) + ' · Cash basis', this._titles || ['', 'Total'], this._lines || [], XK.footerStamp('Cash', c.fetchedAt, c.currency))]; }
});

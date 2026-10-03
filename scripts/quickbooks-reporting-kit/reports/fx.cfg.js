QB.app({
  title: 'Realised Exchange Gains & Losses', token: 'REALISED_EXCHANGE_GAIN_LOSS', route: 'reportv2', primary: 'pnl', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-09-25', basis: 'Accrual', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":1,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"realised","x":""}' },
  uses: { pnl: ['start_date', 'end_date', 'basis'], open_bills: [], open_invoices: [], exchange_rates: [], company_info: [], prefs: [] },
  tools: { pnl: 'get_report_profit_and_loss (exchange gain/loss accounts)', open_bills: "list_bill (Balance > '0')", open_invoices: "list_invoice (Balance > '0')", exchange_rates: 'list_exchange_rate (current rates)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['realised', 'Realised Exchange Gains & Losses'], ['unrealised', 'Unrealised Exchange Gains & Losses (estimate)']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, v = c.view || 'realised', home = c.currency;
    var pr = c.data.prefs && (c.data.prefs.Preferences || c.data.prefs), multi = pr && pr.CurrencyPrefs ? pr.CurrencyPrefs.MultiCurrencyEnabled === true : null;
    if (multi === false) { body.innerHTML = '<p class="muted">Multicurrency is off in this QuickBooks company, so there are no exchange gains or losses.</p>'; return { checks: [{ name: 'Multicurrency enabled', pass: null, detail: 'Off' }] }; }
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    var rates = {}; q('exchange_rates', 'ExchangeRate').forEach(function (r) { if (!r.TargetCurrencyCode || r.TargetCurrencyCode === home) rates[r.SourceCurrencyCode] = Number(r.Rate); });
    var pl = c.data.pnl ? QB.walk(c.data.pnl) : [], fxLines = pl.filter(function (l) { return l.kind === 'row' && /exchange (gain|loss)|foreign exchange|fx (gain|loss)|currency (gain|loss)/i.test(l.label); });
    var realised = QB.sum(fxLines.map(function (l) { return QB.val(l); }));
    var docs = [], missingRate = {};
    q('open_invoices', 'Invoice').forEach(function (d) { var cur = (d.CurrencyRef || {}).value; if (!cur || cur === home) return; var now = rates[cur], bal = Number(d.Balance) || 0, bk = Number(d.ExchangeRate) || null; if (now == null || bk == null) { missingRate[cur] = 1; return; } docs.push({ type: 'Invoice', num: d.DocNumber || d.Id, name: (d.CustomerRef || {}).name, cur: cur, orig: bal, booked: bk, now: now, homeBooked: Math.round(bal * bk * 100) / 100, homeNow: Math.round(bal * now * 100) / 100, gl: Math.round(bal * (now - bk) * 100) / 100 }); });
    q('open_bills', 'Bill').forEach(function (d) { var cur = (d.CurrencyRef || {}).value; if (!cur || cur === home) return; var now = rates[cur], bal = Number(d.Balance) || 0, bk = Number(d.ExchangeRate) || null; if (now == null || bk == null) { missingRate[cur] = 1; return; } docs.push({ type: 'Bill', num: d.DocNumber || d.Id, name: (d.VendorRef || {}).name, cur: cur, orig: bal, booked: bk, now: now, homeBooked: Math.round(bal * bk * 100) / 100, homeNow: Math.round(bal * now * 100) / 100, gl: Math.round(bal * (bk - now) * 100) / 100 }); });
    var unreal = QB.sum(docs.map(function (d) { return d.gl; })), byCur = {}; docs.forEach(function (d) { byCur[d.cur] = Math.round(((byCur[d.cur] || 0) + d.gl) * 100) / 100; });
    var curs = Object.keys(byCur).sort();
    body.innerHTML = QB.kpis([{ label: 'Realised gain / (loss)', value: fxLines.length ? realised : null, sub: QB.periodLine(c.inputs.start_date, c.inputs.end_date) }, { label: 'Unrealised gain / (loss) — estimate', value: unreal, sub: 'Open foreign-currency documents at current rates' }, { label: 'Open foreign documents', money: false, value: docs.length }], c) + '<div id="g1"></div><div class="qb-card detail-block" style="margin-top:16px"><h3>Gain / (loss) by currency</h3><div id="ch1"></div></div>';
    var g = document.getElementById('g1');
    if (v === 'unrealised') QB.grid(g, { filter: true, empty: 'No open foreign-currency invoices or bills.', columns: [{ key: 'cur', title: 'Currency' }, { key: 'type', title: 'Transaction' }, { key: 'num', title: 'Num' }, { key: 'name', title: 'Name' }, { key: 'orig', title: 'Original amount (foreign)', num: true, fmt: function (x, r) { return r.cur + ' ' + Number(x).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } }, { key: 'homeBooked', title: 'Home amount (booked)', money: true }, { key: 'homeNow', title: 'Home amount (today)', money: true }, { key: 'gl', title: 'Gain / (loss)', money: true }], rows: docs, total: { cur: 'TOTAL', gl: unreal } }, c);
    else if (c.errors.pnl) g.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl')) + '</p>';
    else g.innerHTML = fxLines.length ? '<div class="qb-scroll">' + QB.statement(fxLines.map(function (l) { return Object.assign({}, l, { depth: 0 }); }).concat([{ kind: 'total', depth: 0, label: 'Total realised gain / (loss)', values: [realised] }]), ['Account', 'Total'], c) + '</div>' : '<p class="muted">No exchange gain or loss account on the Profit and Loss for this period.</p>';
    QB.bars(document.getElementById('ch1'), { title: 'Unrealised gain / (loss) by currency', labels: curs, series: [{ name: 'Unrealised (estimate)', values: curs.map(function (k) { return byCur[k]; }) }] }, c);
    var checks = [
      { name: 'Realised gains / losses = FX accounts on the Profit and Loss (information — taken from those accounts)', pass: null, info: true, detail: fxLines.length ? fxLines.map(function (l) { return l.label; }).join(', ') + ': ' + money(realised) : 'No FX account in the period' },
      { name: 'Unrealised by currency sums to the total', pass: docs.length ? QB.near(unreal, QB.sum(curs.map(function (k) { return byCur[k]; }))) : null, detail: money(unreal) },
      { name: 'Every open foreign-currency document has a current rate', pass: Object.keys(missingRate).length ? false : docs.length ? true : null, detail: Object.keys(missingRate).length ? 'Missing: ' + Object.keys(missingRate).join(', ') : '' }];
    this._x = { fxLines: fxLines, realised: realised, docs: docs, unreal: unreal };
    return { checks: checks, title: (this.views.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1],
      notes: ['Unrealised gains / losses are an estimate: open balances revalued at QuickBooks\' current exchange rates against the rate booked on each document. QuickBooks\' own Unrealised report may use a different revaluation date — verify on first run.'],
      na: ['Realised gain / loss by transaction and currency (QuickBooks\' Realised Exchange Gains & Losses report is not in the Accounting API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'FX gains and losses', widths: [10, 12, 12, 32, 16, 16, 16, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Exchange Gains & Losses', s: 'bold' }], [QB.periodLine(c.inputs.start_date, c.inputs.end_date)], [], ['Realised gain / (loss)', { v: x.realised, s: 'moneyBold' }], ['Unrealised gain / (loss) — estimate', { v: x.unreal, s: 'moneyBold' }], [],
      [{ v: 'Currency', s: 'bold' }, { v: 'Transaction', s: 'bold' }, { v: 'Num', s: 'bold' }, { v: 'Name', s: 'bold' }, { v: 'Original (foreign)', s: 'bold' }, { v: 'Home (booked)', s: 'bold' }, { v: 'Home (today)', s: 'bold' }, { v: 'Gain / (loss)', s: 'bold' }]].concat(x.docs.map(function (d) { return [d.cur, d.type, d.num, d.name, { v: d.orig, s: 'none' }, { v: d.homeBooked, s: 'money' }, { v: d.homeNow, s: 'money' }, { v: d.gl, s: 'money' }]; })) }];
  }
});

QB.app({
  title: 'Customer Hub', token: null, primary: 'aged_receivables', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Client', display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: {},
  tools: { customers: 'list_customer (active)', quotes: 'list_estimate (latest 1,000)', open_invoices: "list_invoice (Balance > '0')", aged_receivables: 'get_report_aged_receivables', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, today = c.today, since = QB.iso(QB.addDays(QB.parse(today), -364));
    var q = function (id, e) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[e]) || []; };
    if (c.errors.customers) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('customers')) + '</p>'; return { checks: [{ name: 'Customers loaded', pass: false, detail: c.err('customers') }] }; }
    var custs = q('customers', 'Customer'), flagged = custs.some(function (x) { return x.IsProject !== undefined; }), projects = custs.filter(function (x) { return flagged ? x.IsProject === true : x.Job === true; });
    var quotes = q('quotes', 'Estimate').filter(function (e) { return e.TxnDate >= since; }), openQ = quotes.filter(function (e) { return !e.TxnStatus || e.TxnStatus === 'Pending'; });
    var inv = q('open_invoices', 'Invoice'), od = inv.filter(function (x) { return x.DueDate && x.DueDate < today; }), unpaid = QB.sum(inv.map(function (x) { return x.Balance; })), odAmt = QB.sum(od.map(function (x) { return x.Balance; }));
    var soon = QB.iso(QB.addDays(QB.parse(today), 7));
    var attention = od.map(function (x) { return { task: 'Follow up overdue invoice ' + (x.DocNumber || x.Id), who: (x.CustomerRef || {}).name, due: x.DueDate, amt: x.Balance }; })
      .concat(openQ.filter(function (e) { return e.ExpirationDate && e.ExpirationDate <= soon; }).map(function (e) { return { task: (e.ExpirationDate < today ? 'Quote expired: ' : 'Quote expiring: ') + (e.DocNumber || e.Id), who: (e.CustomerRef || {}).name, due: e.ExpirationDate, amt: e.TotalAmt }; }));
    var funnel = [['Open opportunities', null], ['Open quotes', openQ.length], ['In progress projects', projects.length], ['Unpaid invoices', inv.length], ['Reviews', null]];
    body.innerHTML = '<div class="qb-card"><h3>Customers <span class="muted">· last 365 days</span></h3>' + QB.kpis(funnel.map(function (f) { return { label: f[0], money: false, value: f[1] == null ? 'N/A' : f[1], sub: f[1] == null ? 'Not in the Accounting API' : '' }; }), c) + '<div id="ch1"></div></div>' +
      '<div class="qb-grid2"><div class="qb-card"><h3>Overdue invoices</h3>' + QB.kpis([{ label: 'Overdue', value: odAmt, sub: od.length + ' invoice' + (od.length === 1 ? '' : 's') }, { label: 'All unpaid', value: unpaid }], c) + '</div>' +
      '<div class="qb-card"><h3>Open quotes</h3><div id="g1"></div></div></div><div class="qb-card"><h3>Needs attention</h3><div id="g2"></div></div>';
    QB.bars(document.getElementById('ch1'), { title: 'Customers funnel', labels: funnel.filter(function (f) { return f[1] != null; }).map(function (f) { return f[0]; }), series: [{ name: 'Count', values: funnel.filter(function (f) { return f[1] != null; }).map(function (f) { return f[1]; }) }] }, { currency: '', display: Object.assign({}, c.display, { cents: 0 }) });
    QB.grid(document.getElementById('g1'), { empty: 'No open quotes.', columns: [{ key: 'c', title: 'Customer' }, { key: 'n', title: 'Num' }, { key: 'd', title: 'Date' }, { key: 'x', title: 'Expires' }, { key: 'a', title: 'Amount', money: true }], rows: openQ.map(function (e) { return { c: (e.CustomerRef || {}).name, n: e.DocNumber, d: e.TxnDate, x: e.ExpirationDate || '', a: e.TotalAmt }; }) }, c);
    QB.grid(document.getElementById('g2'), { empty: 'Nothing needs attention.', columns: [{ key: 'task', title: 'Task' }, { key: 'who', title: 'Customer' }, { key: 'due', title: 'Due date' }, { key: 'amt', title: 'Amount', money: true }], rows: attention }, c);
    var ar = c.data.aged_receivables ? QB.find(QB.walk(c.data.aged_receivables), 'GrandTotal', /^total$/i) : null, arTot = ar ? QB.val(ar) : null;
    var checks = [
      { name: 'Unpaid invoices = A/R ageing total', pass: arTot == null || c.errors.open_invoices ? null : QB.near(unpaid, arTot, 1), detail: money(unpaid) + ' vs ' + money(arTot) + (arTot != null && !QB.near(unpaid, arTot, 1) ? ' — credits and journals to A/R are in the ageing but not in the invoice list' : '') },
      { name: 'Funnel counts equal the entity queries (information)', pass: null, info: true, detail: openQ.length + ' open quotes · ' + projects.length + ' projects · ' + inv.length + ' unpaid invoices' }];
    this._x = { funnel: funnel, openQ: openQ, attention: attention, odAmt: odAmt, unpaid: unpaid };
    return { checks: checks, period: QB.asOfLine(today), notes: ['"Needs attention" is built from overdue invoices and quotes expiring within 7 days (Customer Hub tasks are not in the Accounting API).'],
      na: ['Open opportunities, work requests, referrals and reviews (Customer Hub features outside the Accounting API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Customer Hub', widths: [40, 30, 14, 16], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Customer Hub overview', s: 'bold' }], [QB.asOfLine(c.today)], []].concat(x.funnel.map(function (f) { return [f[0], f[1] == null ? 'N/A' : { v: f[1], s: 'none' }]; }), [[], ['Overdue', { v: x.odAmt, s: 'money' }], ['All unpaid', { v: x.unpaid, s: 'money' }], [], [{ v: 'Needs attention', s: 'bold' }, { v: 'Customer', s: 'bold' }, { v: 'Due', s: 'bold' }, { v: 'Amount', s: 'bold' }]], x.attention.map(function (a) { return [a.task, a.who, a.due, { v: a.amt, s: 'money' }]; })) }];
  }
});

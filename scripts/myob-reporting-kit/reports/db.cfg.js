MK.app({
  title: 'Dashboard', primary: 'bs', files: 'company_files', optional: ['tax_codes'],
  // no date control: MYOB's dashboard periods are fixed (last 3 months, this financial year, today) and its API gives today's open balances
  inputs: { companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-28', m3_start: '2026-07-01', fy_start: '2026-07-01', chart_from: '2026-07-01', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { pnl_3m: ['m3_start', 'as_at', 'company_file'], pnl_fy: ['fy_start', 'as_at', 'company_file'], bs: ['as_at', 'company_file'], journals: ['chart_from', 'as_at', 'company_file'], invoices: ['company_file'], accounts: ['company_file'], tax_codes: ['company_file'], company_files: [] },
  tools: { pnl_3m: 'get_profit_and_loss_3m (income and expenses, last 3 months)', pnl_fy: 'get_profit_and_loss (this financial year to date)', bs: 'get_balance_sheet (today: bank, GST, receivables, payroll liabilities)', journals: 'list_journal_transactions (the months for the chart — every page)', invoices: 'list_invoices (open sales invoices — every page)', accounts: 'list_accounts (classification and account types)', tax_codes: 'list_tax_codes (the accounts GST posts to)', company_files: 'list_company_files' },
  roll: function () { return { as_at: MK.asAt('today') }; },
  // the widget periods: last 3 calendar months (this month and the two before it) to today; this financial year to today
  derive: function (inp, fyMonth) { var a = MK.parse(inp.as_at), m3 = MK.iso(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 2, 1))), fy = MK.fyStartOf(inp.as_at, fyMonth); return { m3_start: m3, fy_start: fy, chart_from: fy < m3 ? fy : m3 }; },
  render: function (c) {
    var body = c.body, d = c.display, money = function (v) { return MK.money(v, c.currency, d); }, r2 = function (v) { return Math.round(v * 100) / 100; }, h = MK.h, asAt = c.inputs.as_at, m3 = c.inputs.m3_start, fy = c.inputs.fy_start;
    var need = ['pnl_3m', 'pnl_fy', 'bs', 'invoices'].filter(function (id) { return c.errors[id]; });
    if (need.length === 4) { body.innerHTML = '<p class="mk-err">' + h(c.err(need[0])) + '</p>'; return { checks: [{ name: 'MYOB data loaded', pass: false, detail: c.err(need[0]) }] }; }
    if (['pnl_3m', 'pnl_fy', 'bs', 'invoices'].some(function (id) { return !c.data[id] && !c.errors[id]; })) return {};
    var idx = MK.accounts(c.data.accounts), na = function (id) { return '<p class="mk-err">' + h(c.err(id) || 'N/A — not in source') + '</p>'; };
    var big = function (v, neg) { if (v == null) return '<div class="mk-big">N/A</div>'; var s = money(v), m = d.cents && !d.k ? /^(.*)(\.\d\d)(\)?-?)$/.exec(s) : null; return '<div class="mk-big' + (neg && v < 0 ? ' neg' : '') + '">' + (m ? h(m[1]) + '<sup>' + h(m[2]) + '</sup>' + h(m[3]) : h(s)) + '</div>'; };
    // ---- Your business: MYOB's tiles — income (income + other income) and expenses (cost of sales + expenses + other expenses) for the
    // last 3 months; financial position = this financial year's net profit
    var p3 = c.data.pnl_3m ? MK.breakdown([c.data.pnl_3m], idx, MK.PL_LAYOUT) : null, pf = c.data.pnl_fy ? MK.breakdown([c.data.pnl_fy], idx, MK.PL_LAYOUT) : null;
    var inc = function (b) { return b ? r2(b.totals.Income[0] + b.totals.OtherIncome[0]) : null; }, exp = function (b) { return b ? r2(b.totals.CostOfSales[0] + b.totals.Expense[0] + b.totals.OtherExpense[0]) : null; };
    var inc3 = inc(p3), exp3 = exp(p3), fp = pf ? pf.calc.NetProfit[0] : null;
    // the chart: each financial-year month from the journals (income credit-positive, expenses debit-positive)
    var jl = c.data.journals ? MK.items(c.data.journals) : null, mon = {}, jInc3 = 0, jExp3 = 0;
    if (jl) jl.forEach(function (t) { var dt = MK.isoDate(t.DateOccurred || t.DatePosted); if (!dt || dt > asAt) return; (t.Lines || []).forEach(function (l) {
      var cls = MK.classOf(l.Account || {}, idx).cls, amt = Math.abs(MK.num(l.Amount) || 0), sg = l.IsCredit ? 1 : -1, k = dt.slice(0, 7), isInc = /^(Income|OtherIncome)$/.test(cls), isExp = /^(CostOfSales|Expense|OtherExpense)$/.test(cls);
      if (!isInc && !isExp) return; var v = isInc ? sg * amt : -sg * amt; if (!mon[k]) mon[k] = { inc: 0, exp: 0 }; mon[k][isInc ? 'inc' : 'exp'] += v;
      if (dt >= m3) { if (isInc) jInc3 += v; else jExp3 += v; } }); });
    jInc3 = r2(jInc3); jExp3 = r2(jExp3);
    var f0 = MK.parse(fy), months = [], lastKey = asAt.slice(0, 7);
    for (var i = 0; i < 12; i++) { var dm = new Date(Date.UTC(f0.getUTCFullYear(), f0.getUTCMonth() + i, 1)), key = MK.iso(dm).slice(0, 7), o = mon[key] || { inc: 0, exp: 0 }, past = key <= lastKey;
      months.push({ key: key, label: MK.MONTHS[dm.getUTCMonth()].slice(0, 3), inc: past ? r2(o.inc) : null, exp: past ? r2(o.exp) : null, net: past ? r2(o.inc - o.exp) : null }); }
    var chartFy = MK.sum(months.map(function (x) { return x.net; }));
    // ---- Balance Sheet today: bank, credit cards, receivables, GST, payroll liabilities
    var bsb = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null, rows = bsb ? bsb.rows.filter(function (r) { return !r.header; }) : [];
    var pick = function (f) { var l = rows.filter(f); return { rows: l, total: l.length ? MK.sum(l.map(function (r) { return r.values[0]; })) : null }; };
    var bank = pick(function (r) { return r.type === 'Bank' || (!idx.loaded && r.cls === 'Asset' && /bank|cheque|savings/i.test(r.name)); }), card = pick(function (r) { return r.type === 'CreditCard'; });
    var ar = pick(function (r) { return r.type === 'AccountReceivable' || (!idx.loaded && /receivable|debtors/i.test(r.name)); });
    var sup = pick(function (r) { return r.cls === 'Liability' && /superannuation|\bsuper\b/i.test(r.name); }), payg = pick(function (r) { return r.cls === 'Liability' && /\bPAYG\b|withholding/i.test(r.name); });
    // GST: the accounts the GST tax codes post to (TaxCollectedAccount / TaxPaidAccount, matched to this file's chart by UID); else by name
    var colU = {}, paidU = {}, viaCodes = false;
    MK.items(c.data.tax_codes).forEach(function (t) { if (!t || /wine|luxury|import|withhold|abn|tfn|sales ?tax/i.test(t.Type || '')) return; if (t.TaxCollectedAccount && t.TaxCollectedAccount.UID) colU[t.TaxCollectedAccount.UID] = 1; if (t.TaxPaidAccount && t.TaxPaidAccount.UID) paidU[t.TaxPaidAccount.UID] = 1; });
    var gstRows = rows.filter(function (r) { return r.uid && (colU[r.uid] || paidU[r.uid]); }); if (gstRows.length) viaCodes = true; else gstRows = rows.filter(function (r) { return /^(Asset|Liability)$/.test(r.cls) && /\bGST\b/i.test(r.name); });
    var owe = function (r) { return r.cls === 'Liability' ? r.values[0] : -r.values[0]; }; // + = owed to the ATO
    var isCol = function (r) { return viaCodes ? !!colU[r.uid] && !paidU[r.uid] : /collected/i.test(r.name); }, isPaid = function (r) { return viaCodes ? !!paidU[r.uid] && !colU[r.uid] : /paid/i.test(r.name); };
    var gstNet = gstRows.length ? MK.sum(gstRows.map(owe)) : null, split = gstRows.length && gstRows.every(function (r) { return isCol(r) || isPaid(r); });
    var gstCol = split ? MK.sum(gstRows.filter(isCol).map(owe)) : null, gstPaid = split ? r2(-MK.sum(gstRows.filter(isPaid).map(owe))) : null;
    // ---- Overdue invoices: open invoices past their due date today, in MYOB's three bands
    var inv = MK.items(c.data.invoices).filter(function (x) { return x && (MK.num(x.BalanceDueAmount) || 0) !== 0; }).map(function (x) { var due = MK.isoDate((x.Terms || {}).DueDate) || MK.isoDate(x.Date); return { number: x.Number || '', customer: (x.Customer || {}).Name || '(no customer)', date: MK.isoDate(x.Date), due: due, bal: r2(MK.num(x.BalanceDueAmount) || 0), days: Math.round((MK.parse(asAt) - MK.parse(due)) / 86400000) }; });
    var owedToYou = MK.sum(inv.map(function (x) { return x.bal; })), od = inv.filter(function (x) { return x.days > 0; });
    var BANDS = [['Over 30 days overdue', function (n) { return n > 30; }, '#A4161A'], ['16 to 30 days overdue', function (n) { return n >= 16 && n <= 30; }, '#E8730C'], ['1 to 15 days overdue', function (n) { return n >= 1 && n <= 15; }, '#F2C200']];
    var bands = BANDS.map(function (b) { var l = od.filter(function (x) { return b[1](x.days); }); return { label: b[0], color: b[2], n: l.length, amt: MK.sum(l.map(function (x) { return x.bal; })) }; });
    var odTot = MK.sum(od.map(function (x) { return x.bal; }));
    // ---- the page
    var hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    var acctList = function (p) { return p.rows.length ? '<ul class="mk-bul detail-block">' + p.rows.map(function (r) { return '<li><span>' + h((r.code ? r.code + ' ' : '') + r.name) + '</span><span>' + money(r.values[0]) + '</span></li>'; }).join('') + '</ul>' : ''; };
    var tile = function (label, v, sub) { return '<div><div class="lbl">' + h(label) + '</div>' + big(v, true) + '<div class="lbl">' + h(sub) + '</div></div>'; };
    var gstCard = gstNet == null ? '<p class="muted">N/A — no GST account found on the Balance Sheet</p>' : big(Math.abs(gstNet)) + '<div class="lbl">' + (gstNet >= 0 ? 'to pay' : 'to claim') + '</div>' +
      (split ? '<div class="mk-bar" title="GST paid as a share of GST collected"><i style="width:' + Math.min(100, gstCol > 0 ? Math.max(0, gstPaid) / gstCol * 100 : 0).toFixed(1) + '%;background:var(--c1)"></i></div><ul class="mk-bul"><li><span>GST collected</span><span>' + money(gstCol) + '</span></li><li><span>GST paid</span><span>' + money(gstPaid) + '</span></li></ul>' : '<p class="muted">One GST account: collected and paid are not reported separately.</p>') + acctList({ rows: gstRows });
    body.innerHTML = '<p class="mk-greet">' + h(greet) + ', ' + h(c.company || 'your business') + '</p><div class="mk-dash">' +
      '<div class="mk-card wide mk-next"><h3>Up next</h3>' + (c.errors.invoices ? na('invoices') : '<span class="mk-big">' + od.length + '</span> <span>Overdue invoice' + (od.length === 1 ? '' : 's') + '</span> <span class="muted">· see MYOB Unpaid Invoices for the list</span>') + '</div>' +
      '<div class="mk-card wide"><h3>Your business</h3><div class="mk-tiles">' + (p3 ? tile('Income', inc3, 'Last 3 months') + tile('Expenses', exp3, 'Last 3 months') : na('pnl_3m')) + (pf ? tile('Financial position', fp, 'This financial year') : na('pnl_fy')) + '</div><div id="db-chart"></div></div>' +
      '<div class="mk-card"><h3>Accounts</h3>' + (bsb ? '<div class="lbl">Bank balance</div>' + big(bank.total, true) + acctList(bank) + '<div class="lbl">Money owed (credit cards)</div>' + (card.rows.length ? big(card.total) + acctList(card) : '<p class="muted">No credit card accounts.</p>') : na('bs')) + '</div>' +
      '<div class="mk-card"><h3>GST</h3>' + (bsb ? gstCard : na('bs')) + '</div>' +
      '<div class="mk-card"><h3>Overdue invoices</h3>' + (c.errors.invoices ? na('invoices') : big(odTot) + '<div class="mk-bar" title="Overdue by age">' + bands.map(function (b) { return odTot > 0 && b.amt > 0 ? '<i style="width:' + (b.amt / odTot * 100).toFixed(1) + '%;background:' + b.color + '"></i>' : ''; }).join('') + '</div><ul class="mk-bul">' +
        bands.map(function (b) { return '<li><span><b style="background:' + b.color + '"></b>' + h(b.label) + ' (' + b.n + ')</span><span>' + money(b.amt) + '</span></li>'; }).join('') + '</ul><p class="muted">Of ' + money(owedToYou) + ' owed to you on ' + inv.length + ' open invoice' + (inv.length === 1 ? '' : 's') + '.</p>') + '</div>' +
      '<div class="mk-card"><h3>Pay runs</h3><p class="muted">N/A — the MYOB connector has no list of pay runs.</p></div>' +
      '<div class="mk-card"><h3>Superannuation payable</h3>' + (bsb ? (sup.rows.length ? big(sup.total) + acctList(sup) : '<p class="muted">No superannuation payable account.</p>') : na('bs')) + '</div>' +
      '<div class="mk-card"><h3>PAYG withholding</h3>' + (bsb ? (payg.rows.length ? big(payg.total) + '<div class="lbl">Withheld, not yet paid to the ATO</div>' + acctList(payg) : '<p class="muted">No PAYG withholding account.</p>') : na('bs')) + '</div></div>';
    var ch = document.getElementById('db-chart');
    if (c.errors.journals) ch.innerHTML = na('journals');
    else MK.line(ch, { title: 'Income, expenses and net profit by month', solid: true, labels: months.map(function (x) { return x.label; }), series: [{ name: 'Income', values: months.map(function (x) { return x.inc; }), color: '#1B7F4B' }, { name: 'Expense', values: months.map(function (x) { return x.exp; }), color: '#D52B1E' }, { name: 'Net profit', values: months.map(function (x) { return x.net; }), color: 'var(--accent)' }] }, c);
    // ---- checks: two of them tie two different MYOB sources; the third ties the P&L to the Balance Sheet
    var per3 = MK.periodLine(m3, asAt), cye = bsb ? MK.currentYearEarnings(bsb.lines) : null, bandSum = MK.sum(bands.map(function (b) { return b.amt; })), bandN = bands.reduce(function (s, b) { return s + b.n; }, 0);
    var checks = [
      !p3 || !jl ? { name: 'Last 3 months: income and expenses on the Profit and Loss = the journals', pass: null, detail: c.err(!p3 ? 'pnl_3m' : 'journals') || 'N/A' }
        : { name: 'Last 3 months (' + per3 + '): income and expenses on the Profit and Loss = the journals (two MYOB sources)', pass: MK.near(inc3, jInc3) && MK.near(exp3, jExp3), detail: 'income ' + money(inc3) + ' vs ' + money(jInc3) + ' · expenses ' + money(exp3) + ' vs ' + money(jExp3) },
      !pf || !jl ? { name: 'Financial position = the chart\'s months', pass: null, detail: c.err(!pf ? 'pnl_fy' : 'journals') || 'N/A' }
        : { name: 'Financial position (this year\'s net profit) = the chart\'s months added up', pass: MK.near(fp, chartFy), detail: money(fp) + ' vs ' + money(chartFy) },
      !pf || !cye ? { name: 'Financial position = Current Year Earnings on the Balance Sheet', pass: null, detail: !pf ? c.err('pnl_fy') : c.err('bs') || 'N/A — no Current Year Earnings account on the Balance Sheet' }
        : { name: 'Financial position = Current Year Earnings on the Balance Sheet (a separate MYOB report)', pass: MK.near(fp, cye.values[0]), detail: money(fp) + ' vs ' + money(cye.values[0]) },
      c.errors.invoices || ar.total == null ? { name: 'Money owed to you (open invoices) = the receivables account on the Balance Sheet', pass: null, detail: c.err('invoices') || c.err('bs') || 'N/A — no receivables account in the chart of accounts' }
        : { name: 'Money owed to you (open invoices) = the receivables account on the Balance Sheet (' + ar.rows.map(function (r) { return r.code || r.name; }).join(', ') + ')', pass: MK.near(owedToYou, ar.total), detail: money(owedToYou) + ' vs ' + money(ar.total) + (MK.near(owedToYou, ar.total) ? '' : ' — see MYOB Receivables Reconciliation') },
      c.errors.invoices ? null : { name: 'Overdue invoices: the three age bands add up to the overdue total, and Up next counts every overdue invoice', pass: MK.near(bandSum, odTot) && bandN === od.length, detail: money(odTot) + ' on ' + od.length + ' invoice(s)' },
      gstNet == null ? null : { name: 'GST to pay = GST collected − GST paid (' + gstRows.map(function (r) { return r.code || r.name; }).join(', ') + (viaCodes ? ', the accounts the GST tax codes post to' : ', found by name') + ')', pass: null, info: true, detail: money(gstNet) + (gstNet < 0 ? ' to claim' : ' to pay') }
    ].filter(Boolean);
    this._x = { inc3: inc3, exp3: exp3, fp: fp, months: months, bank: bank, card: card, gstNet: gstNet, gstCol: gstCol, gstPaid: gstPaid, bands: bands, odTot: odTot, od: od, owedToYou: owedToYou, sup: sup, payg: payg };
    var notes = ['Income = income + other income; Expenses = cost of sales + expenses + other expenses (so Income − Expenses = net profit). Last 3 months = ' + per3 + '; this financial year = ' + MK.periodLine(fy, asAt) + '.',
      'Balances are MYOB\'s as at today (bank, credit cards, GST, superannuation and PAYG withholding payable). The bank balance is MYOB\'s ledger balance, not the bank feed\'s.'];
    if (c.errors.tax_codes) notes.push('Tax codes did not load (' + c.err('tax_codes') + '): GST accounts were found by name.');
    return { checks: checks, notes: notes, period: MK.asOfLine(asAt), na: ['Pay runs (the MYOB connector has no list of pay runs)', 'Uploads (not part of a report)', 'The dashboard as at an earlier date (MYOB\'s API gives today\'s open balances)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; }, head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Dashboard', s: 'bold' }], [MK.asOfLine(c.inputs.as_at)], []];
    var rows = head.concat([[{ v: 'Widget', s: 'bold' }, { v: 'Figure', s: 'bold' }, { v: 'Amount ($)', s: 'bold' }], ['Your business', 'Income (last 3 months)', mv(x.inc3)], ['Your business', 'Expenses (last 3 months)', mv(x.exp3)], ['Your business', 'Financial position (this financial year)', mv(x.fp)],
      ['Accounts', 'Bank balance', mv(x.bank.total)], ['Accounts', 'Money owed (credit cards)', mv(x.card.total)], ['GST', x.gstNet != null && x.gstNet < 0 ? 'To claim' : 'To pay', mv(x.gstNet == null ? null : Math.abs(x.gstNet))], ['GST', 'GST collected', mv(x.gstCol)], ['GST', 'GST paid', mv(x.gstPaid)],
      ['Overdue invoices', 'Total overdue (' + x.od.length + ')', mv(x.odTot)]].concat(x.bands.map(function (b) { return ['Overdue invoices', b.label + ' (' + b.n + ')', mv(b.amt)]; })).concat([['Overdue invoices', 'Owed to you (all open invoices)', mv(x.owedToYou)], ['Superannuation payable', '', mv(x.sup.total)], ['PAYG withholding', '', mv(x.payg.total)]]));
    var mo = head.concat([['Month', 'Income ($)', 'Expense ($)', 'Net profit ($)'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.months.filter(function (m) { return m.inc != null; }).map(function (m) { return [m.key, mv(m.inc), mv(m.exp), mv(m.net)]; }));
    var od = head.concat([['Customer', 'Invoice no.', 'Due date', 'Days overdue', 'Balance due ($)'].map(function (t) { return { v: t, s: 'bold' }; })]).concat(x.od.slice().sort(function (a, b) { return b.days - a.days; }).map(function (r) { return [r.customer, r.number, r.due, r.days, mv(r.bal)]; }));
    return [{ name: 'Dashboard', rows: rows, widths: [24, 40, 16] }, { name: 'Monthly', rows: mo, widths: [12, 16, 16, 16] }, { name: 'Overdue invoices', rows: od, widths: [32, 14, 12, 12, 16] }];
  }
});

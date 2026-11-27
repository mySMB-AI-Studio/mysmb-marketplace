// Xero practice fan-out, run inside the report (replaces the retired xero-accounting server's get_practice_* tools).
//
// The xero-accounting MCP server computed every PRA Xero row server-side: discover the connection's organisations,
// call a few Xero endpoints per organisation, and sum. That server is being retired (Xero compliance, Nov 2026) and the
// replacement Xero API connector (`xero-api`) only runs single Xero requests. So the report now does the same work
// itself: it reads the organisation list (list_connections), then calls its own declared `xero-api` bindings once per
// organisation with MyHubReport.getData(binding, { org: tenantId, ... }), and builds the envelope the server used to
// return ({ asOf, clients, errors, totals, truncated, message }). load() in practice-table-kit.js is unchanged.
//
// Every row figure is a line-for-line port of myhub-mcp-servers src/integrations/xero-accounting/api/
// practice-aggregates.ts (origin/dev, 27 Nov 2026): same endpoints, filters, rounding, `_na` reasons and totals keys.
//
// Limits this has to live with (myHubV2 dev, 27 Nov 2026):
// - Each getData is one POST to /api/artifacts/:id/hydrate, rate-limited to 60 a minute per user. Calls are paced
//   (PACE_MS apart) and a rate-limited call waits and retries, so a big practice loads slowly rather than failing.
// - A snapshot only holds the bindings' on-open results, not per-organisation calls, so a snapshot says so.
//
// The source below is ES5 (it runs in the report's sandboxed document) and is inlined by practice-table-kit.js only
// into reports whose config sets `xeroFan`.
const XERO_FAN_JS = String.raw`
var XF = (function () {
  var CAP = 60, PAGE_MAX = 20, PACE_MS = typeof window.__XF_PACE === 'number' ? window.__XF_PACE : 1100, RETRIES = 4;
  function r2(n) { return Math.round(n * 100) / 100; }
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function firstOfMonth(d) { return d.slice(0, 7) + '-01'; }
  function daysBetween(a, b) { var ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z'); return Math.max(1, Math.round(ms / 86400000) + 1); }
  function xdt(iso) { var d = new Date(iso + 'T00:00:00Z'); return 'DateTime(' + d.getUTCFullYear() + ',' + (d.getUTCMonth() + 1) + ',' + d.getUTCDate() + ')'; }
  function dueDate(inv) {
    var raw = inv.DueDateString || inv.DueDate || inv.DateString || inv.Date;
    if (!raw) return undefined;
    var m = /\/Date\((\d+)/.exec(raw);
    if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
    return String(raw).slice(0, 10);
  }
  function ageing(list, asAt) {
    var oa = 0, oc = 0, da = 0, dc = 0, ids = {}, n = 0;
    list.forEach(function (inv) {
      if (inv.Status !== 'AUTHORISED') return;
      var amt = typeof inv.AmountDue === 'number' ? inv.AmountDue : 0;
      if (Math.abs(amt) < 0.005) return;
      oa += amt; oc += 1;
      var cid = inv.Contact && (inv.Contact.ContactID || inv.Contact.Name);
      if (cid && !ids[cid]) { ids[cid] = 1; n++; }
      var due = dueDate(inv);
      if (due && due < asAt) { da += amt; dc += 1; }
    });
    return { outstandingAmount: r2(oa), outstandingCount: oc, overdueAmount: r2(da), overdueCount: dc, contacts: n };
  }
  function invoiceArray(r) { var a = r && r.Invoices; return Array.isArray(a) ? a : []; }
  function listCount(r, key) {
    var p = r && r.pagination;
    if (p && typeof p.itemCount === 'number') return p.itemCount;
    var a = r && r[key]; return Array.isArray(a) ? a.length : 0;
  }
  function cellNumber(c) { var v = c && c.Value, n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN; return isFinite(n) ? n : 0; }
  function toLine(row) {
    var cells = row.Cells || [], first = cells[0] && cells[0].Value;
    return { kind: row.RowType === 'SummaryRow' ? 'total' : 'row', label: typeof first === 'string' ? first : String(first == null ? '' : first), values: cells.slice(1).map(cellNumber) };
  }
  function walk(raw) {
    var reps = raw && raw.Reports, rows = Array.isArray(reps) && reps.length ? reps[0] && reps[0].Rows : undefined;
    if (!Array.isArray(rows)) return null;
    var sections = [], lines = [];
    rows.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      if (row.RowType === 'Section') {
        var sec = (Array.isArray(row.Rows) ? row.Rows : []).filter(function (r) { return r.RowType === 'Row' || r.RowType === 'SummaryRow'; }).map(toLine);
        sections.push({ title: row.Title || '', lines: sec }); lines.push.apply(lines, sec);
      } else if (row.RowType === 'Row' || row.RowType === 'SummaryRow') lines.push(toLine(row));
    });
    return { sections: sections, lines: lines };
  }
  function sectionTotal(s) {
    var t = s.lines.filter(function (l) { return l.kind === 'total'; })[0];
    if (t) return t.values[0] || 0;
    return s.lines.filter(function (l) { return l.kind === 'row'; }).reduce(function (a, l) { return a + (l.values[0] || 0); }, 0);
  }
  function findLine(lines, re, kind) { return lines.filter(function (l) { return (!kind || l.kind === kind) && re.test(l.label); })[0]; }
  function parsePL(raw) {
    var w = walk(raw); if (!w) return null;
    var isDed = function (t) { return /^less |cost of sales|expense/i.test(t); };
    var totalOf = function (re) { var s = w.sections.filter(function (x) { return re.test(x.title); }); return s.length ? s.reduce(function (a, x) { return a + sectionTotal(x); }, 0) : null; };
    var income = w.sections.filter(function (s) { return !isDed(s.title); }).reduce(function (a, s) { return a + sectionTotal(s); }, 0);
    var trading = totalOf(/^(trading )?income$|^revenue$|^sales$/i);
    var gp = findLine(w.lines, /^gross profit$/i, 'total') || findLine(w.lines, /^gross profit$/i, 'row');
    var np = findLine(w.lines, /^net (profit|loss)$/i, 'total') || findLine(w.lines, /^net (profit|loss)$/i, 'row');
    var cos = totalOf(/cost of sales/i);
    return { revenue: trading != null ? trading : (w.sections.length ? income : null), costOfSales: cos == null ? 0 : cos,
      grossProfit: gp ? (gp.values[0] == null ? null : gp.values[0]) : null, netProfit: np ? (np.values[0] == null ? null : np.values[0]) : null };
  }
  function parseBank(raw) {
    var w = walk(raw); if (!w) return null;
    var accounts = w.lines.filter(function (l) { return l.kind === 'row' && l.values.length >= 4; })
      .map(function (l) { return { name: l.label, cashIn: l.values[1] || 0, cashOut: l.values[2] || 0, closing: l.values[3] || 0 }; });
    var t = w.lines.filter(function (l) { return l.kind === 'total' && /^total$/i.test(l.label); })[0];
    var sum = function (k) { return accounts.reduce(function (a, x) { return a + x[k]; }, 0); };
    return { accounts: accounts, totalCashIn: t ? t.values[1] || 0 : sum('cashIn'), totalCashOut: t ? t.values[2] || 0 : sum('cashOut'), totalClosing: t ? t.values[3] || 0 : sum('closing') };
  }

  // ---- paced calls: one getData every PACE_MS, a rate-limited call waits and retries ----
  var queue = [], timer = null, last = 0;
  function pump() {
    timer = null;
    if (!queue.length) return;
    var wait = Math.max(0, last + PACE_MS - Date.now());
    if (wait > 0 && PACE_MS > 0) { timer = setTimeout(pump, wait); return; }
    last = Date.now();
    var job = queue.shift();
    job.run();
    if (queue.length) timer = setTimeout(pump, PACE_MS);
  }
  function limited(e) { return /too many|rate.?limit|429/i.test(String((e && (e.message || e.code)) || '')); }
  function getData(id, inputs) {
    return new Promise(function (resolve, reject) {
      var attempt = 0;
      function go() {
        queue.push({ run: function () {
          MyHubReport.getData(id, inputs).then(resolve, function (e) {
            if (limited(e) && attempt < RETRIES) { attempt++; setTimeout(go, PACE_MS > 0 ? 15000 * attempt : 0); }
            else reject(e);
          });
        } });
        if (!timer) pump();
      }
      go();
    });
  }
  function soft(p) { return p.then(function (v) { return v; }, function () { return null; }); }

  // ---- per-organisation workers (one per report kind), ports of practice-aggregates.ts ----
  function unreconciledUpTo(call, upTo) {
    var where = 'IsReconciled==false&&Status!="DELETED"&&Date<=' + xdt(upTo), count = 0, amount = 0;
    function page(n) {
      return soft(call('x_unrec', { where: where, page: n })).then(function (res) {
        if (res === null) return n === 1 ? null : { count: count, amount: r2(amount), partial: true };
        var rows = (res && res.BankTransactions) || [];
        count += rows.length;
        amount += rows.reduce(function (a, r) { return a + (typeof r.Total === 'number' ? r.Total : 0); }, 0);
        if (rows.length < 100) return { count: count, amount: r2(amount), partial: false };
        return n >= PAGE_MAX ? { count: count, amount: r2(amount), partial: true } : page(n + 1);
      });
    }
    return page(1);
  }
  var NOTE = 'More than ' + (PAGE_MAX * 100) + ' unreconciled transactions: count and amount cover the first ' + (PAGE_MAX * 100) + '.';
  var W = {
    client: { totals: ['contactsCount', 'accountsCount', 'bankAccountsCount', 'invoicesCount', 'billsCount', 'employeesCount'],
      run: function (call, c) {
        return Promise.all([call('x_contacts'), call('x_accounts'), call('x_invoices'), call('x_bills'), soft(call('x_employees'))]).then(function (r) {
          var acc = (r[1] && r[1].Accounts) || [];
          var row = { contactsCount: listCount(r[0], 'Contacts'), accountsCount: acc.length, bankAccountsCount: acc.filter(function (a) { return a.Type === 'BANK'; }).length,
            invoicesCount: listCount(r[2], 'Invoices'), billsCount: listCount(r[3], 'Invoices'), connectionStatus: 'connected' };
          if (r[4]) row.employeesCount = listCount(r[4], 'Employees');
          else row.employeesCount_na = 'The Employees endpoint was unavailable (payroll not enabled for this org, or the token lacks the scope).';
          if (c.updatedDateUtc) row.lastSync = c.updatedDateUtc; else row.lastSync_na = "Xero's /connections endpoint did not return an updatedDateUtc for this tenant.";
          return row;
        });
      } },
    connections: { totals: [],
      run: function (call, c) {
        var row = { connectionStatus: 'connected' };
        if (c.updatedDateUtc) row.lastSync = c.updatedDateUtc; else row.lastSync_na = "Xero's /connections endpoint did not return an updatedDateUtc for this tenant.";
        return Promise.resolve(row);
      } },
    sales: { totals: ['outstandingAmount', 'outstandingCount', 'overdueAmount', 'overdueCount', 'receiptsViaBank'],
      run: function (call, c, cx) {
        return Promise.all([call('x_open'), soft(call('x_bank')), soft(call('x_pl'))]).then(function (r) {
          var a = ageing(invoiceArray(r[0]), cx.asAt), pl = r[2] ? parsePL(r[2]) : null, bank = r[1] ? parseBank(r[1]) : null;
          var row = { outstandingAmount: a.outstandingAmount, outstandingCount: a.outstandingCount, overdueAmount: a.overdueAmount, overdueCount: a.overdueCount };
          if (a.outstandingCount > 0) row.averageInvoiceValue = r2(a.outstandingAmount / a.outstandingCount); else row.averageInvoiceValue_na = 'No outstanding sales invoices to average.';
          if (pl && typeof pl.revenue === 'number' && pl.revenue > 0) row.dso = r2((a.outstandingAmount / pl.revenue) * cx.days);
          else row.dso_na = 'Could not source period revenue from get_profit_and_loss to compute DSO.';
          if (bank) row.receiptsViaBank = bank.totalCashIn; else row.receiptsViaBank_na = 'get_bank_summary was unavailable for this client/date range.';
          return row;
        });
      } },
    purchases: { totals: ['outstandingAmount', 'outstandingCount', 'overdueAmount', 'overdueCount', 'bankPayments', 'supplierCount'],
      run: function (call, c, cx) {
        return Promise.all([call('x_open'), soft(call('x_bank')), soft(call('x_pl'))]).then(function (r) {
          var a = ageing(invoiceArray(r[0]), cx.asAt), pl = r[2] ? parsePL(r[2]) : null, bank = r[1] ? parseBank(r[1]) : null;
          var row = { outstandingAmount: a.outstandingAmount, outstandingCount: a.outstandingCount, overdueAmount: a.overdueAmount, overdueCount: a.overdueCount, supplierCount: a.contacts };
          if (pl && typeof pl.costOfSales === 'number' && pl.costOfSales > 0) row.dpo = r2((a.outstandingAmount / pl.costOfSales) * cx.days);
          else row.dpo_na = 'Could not source period cost of sales from get_profit_and_loss to compute DPO.';
          if (bank) row.bankPayments = bank.totalCashOut; else row.bankPayments_na = 'get_bank_summary was unavailable for this client/date range.';
          return row;
        });
      } },
    bankrec: { totals: ['totalUnreconciledCount', 'totalUnreconciledAmount'],
      run: function (call, c, cx) {
        return Promise.all([call('x_bank'), unreconciledUpTo(call, cx.asAt)]).then(function (r) {
          var bank = parseBank(r[0]), u = r[1] || { count: 0, amount: 0, partial: false };
          var row = { totalUnreconciledCount: u.count, totalUnreconciledAmount: u.amount };
          if (u.partial) row.totalUnreconciledAmountNote = NOTE;
          if (bank) row.accounts = bank.accounts.map(function (a) { return { name: a.name, ledgerBalance: a.closing,
            statementBalance_na: "Xero's Accounting API has no bank-feed/statement-balance endpoint.",
            lastReconciled_na: "Xero's Accounting API does not expose a per-account reconciliation date.",
            ragStatus_na: "Requires a statement balance to compare against, which Xero's API does not expose." }; });
          else row.accounts_na = 'get_bank_summary was unavailable for this client at the requested date.';
          return row;
        });
      } },
    banking: { totals: ['cashIn', 'cashOut', 'net', 'unreconciledCount', 'unreconciledAmount'],
      run: function (call, c, cx) {
        return Promise.all([soft(call('x_bank')), unreconciledUpTo(call, cx.toDate)]).then(function (r) {
          var bank = r[0] ? parseBank(r[0]) : null, u = r[1] || { count: 0, amount: 0, partial: false };
          var row = { unreconciledCount: u.count, unreconciledAmount: u.amount };
          if (u.partial) row.unreconciledAmountNote = NOTE;
          if (bank) {
            row.accounts = bank.accounts.map(function (a) { return { name: a.name, cashIn: a.cashIn, cashOut: a.cashOut, net: r2(a.cashIn - a.cashOut), closingBalance: a.closing }; });
            row.cashIn = bank.totalCashIn; row.cashOut = bank.totalCashOut; row.net = r2(bank.totalCashIn - bank.totalCashOut);
          } else { row.cashIn_na = 'get_bank_summary was unavailable for this client/date range.'; row.cashOut_na = row.cashIn_na; row.net_na = row.cashIn_na; }
          return row;
        });
      } },
    financial: { totals: ['revenue', 'grossProfit', 'netProfit', 'bankBalance', 'arAgeingTotal', 'apAgeingTotal'],
      run: function (call, c, cx) {
        // The P&L is NOT soft: it is this report's primary figure, so its failure fails the client (lands in errors).
        return Promise.all([call(cx.cash ? 'x_pl_cash' : 'x_pl'), soft(call('x_bank')), soft(call('x_ar')), soft(call('x_ap'))]).then(function (r) {
          var pl = parsePL(r[0]), bank = r[1] ? parseBank(r[1]) : null, ar = ageing(invoiceArray(r[2]), cx.asAt), ap = ageing(invoiceArray(r[3]), cx.asAt), row = {};
          if (pl && typeof pl.revenue === 'number') {
            row.revenue = pl.revenue;
            if (pl.grossProfit != null) row.grossProfit = pl.grossProfit; else row.grossProfit_na = "Xero's Profit and Loss report did not include a Gross Profit line for this org.";
            if (pl.netProfit != null) row.netProfit = pl.netProfit; else row.netProfit_na = "Xero's Profit and Loss report did not include a Net Profit line for this org.";
            if (pl.revenue !== 0) {
              if (pl.grossProfit != null) row.grossMargin = Math.round((pl.grossProfit / pl.revenue) * 10000) / 10000;
              if (pl.netProfit != null) row.netMargin = Math.round((pl.netProfit / pl.revenue) * 10000) / 10000;
            }
          } else row.revenue_na = "Could not parse a Profit and Loss report in Xero's standard Rows/Sections shape.";
          if (bank) row.bankBalance = bank.totalClosing; else row.bankBalance_na = 'get_bank_summary was unavailable for this client at the requested date.';
          row.arAgeingTotal = ar.outstandingAmount; row.apAgeingTotal = ap.outstandingAmount;
          return row;
        });
      } },
    activity: { totals: ['salesCount', 'purchasesCount', 'bankingCount', 'journalsCount', 'payrollCount', 'totalCount'],
      run: function (call, c, cx) {
        // None of these is soft: a failure means this client's counts can't be trusted, so it fails the client.
        var period = 'Date>=' + xdt(cx.fromDate) + '&&Date<=' + xdt(cx.toDate);
        return Promise.all([call('x_inv', { where: 'Type=="ACCREC"&&' + period }), call('x_inv', { where: 'Type=="ACCPAY"&&' + period }),
          call('x_bt', { where: period }), call('x_mj', { where: period })]).then(function (r) {
          var row = { salesCount: listCount(r[0], 'Invoices'), purchasesCount: listCount(r[1], 'Invoices'), bankingCount: listCount(r[2], 'BankTransactions'),
            journalsCount: listCount(r[3], 'ManualJournals'),
            payrollCount_na: 'Payroll transaction counts require the Xero Payroll AU connector, which this agent does not connect.' };
          row.totalCount = ['salesCount', 'purchasesCount', 'bankingCount', 'journalsCount', 'payrollCount'].reduce(function (a, k) { return a + (typeof row[k] === 'number' && isFinite(row[k]) ? row[k] : 0); }, 0);
          return row;
        });
      } }
  };

  function sumKeys(rows, keys) {
    var t = {};
    keys.forEach(function (k) { var s = 0, any = false; rows.forEach(function (r) { var v = r[k]; if (typeof v === 'number' && isFinite(v)) { s += v; any = true; } }); if (any) t[k] = r2(s); });
    return t;
  }
  function errMsg(e) { return e && e.message ? e.message : String(e); }

  // kind: one of W's keys. bundle: the on-open bundle (inputs + xero_connections). progress(done, total).
  function run(kind, bundle, progress) {
    var worker = W[kind], inputs = bundle.inputs || {}, conns = (bundle.data && bundle.data.xero_connections) || [];
    if (!Array.isArray(conns)) conns = [];
    var toDate = inputs.to_date || todayIso();
    var cx = { toDate: toDate, fromDate: inputs.from_date || firstOfMonth(toDate), asAt: inputs.as_at || todayIso(), cash: inputs.basis === 'Cash' };
    cx.days = daysBetween(cx.fromDate, cx.toDate);
    var requested = inputs.clients ? String(inputs.clients).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var byId = {}; conns.forEach(function (c) { if (c && c.tenantId) byId[c.tenantId] = c; });
    var missing = [], pool;
    if (requested.length) { pool = []; requested.forEach(function (id) { if (byId[id]) pool.push(byId[id]); else missing.push(id); }); }
    else pool = conns.filter(function (c) { return c && c.tenantId; });
    var truncated = pool.length > CAP, candidates = truncated ? pool.slice(0, CAP) : pool, done = 0;
    progress && progress(0, candidates.length);
    return Promise.all(candidates.map(function (c) {
      var label = c.tenantName || c.tenantId;
      var call = function (id, extra) {
        var p = {}; Object.keys(inputs).forEach(function (k) { p[k] = inputs[k]; });
        p.org = c.tenantId; Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
        return getData(id, p);
      };
      return worker.run(call, c, cx).then(function (m) { done++; progress && progress(done, candidates.length); var row = { id: c.tenantId, name: label }; Object.keys(m).forEach(function (k) { row[k] = m[k]; }); return { ok: true, row: row }; },
        function (e) { done++; progress && progress(done, candidates.length); return { ok: false, err: { id: c.tenantId, name: label, message: errMsg(e) } }; });
    })).then(function (settled) {
      var clients = [], errors = [];
      settled.forEach(function (s) { if (s.ok) clients.push(s.row); else errors.push(s.err); });
      missing.forEach(function (id) { errors.push({ id: id, name: id, message: 'Not an authorised client of this connection.' }); });
      var env = { asOf: new Date().toISOString(), clients: clients, errors: errors, totals: sumKeys(clients, worker.totals), truncated: truncated };
      if (kind === 'financial' && typeof env.totals.revenue === 'number' && env.totals.revenue !== 0) {
        if (typeof env.totals.grossProfit === 'number') env.totals.grossMargin = Math.round((env.totals.grossProfit / env.totals.revenue) * 10000) / 10000;
        if (typeof env.totals.netProfit === 'number') env.totals.netMargin = Math.round((env.totals.netProfit / env.totals.revenue) * 10000) / 10000;
      }
      if (truncated) env.message = 'Showing the first ' + CAP + ' of ' + pool.length + ' clients this connection exposes. Pass "clients" with specific tenant ids to select a different subset.';
      return env;
    });
  }
  return { run: run, _test: { ageing: ageing, parsePL: parsePL, parseBank: parseBank, xdt: xdt } };
})();
`;

// Binding ids each fan kind calls (besides xero_connections), for the manifests and the integrity test.
const FAN_BINDINGS = {
  client: ['x_contacts', 'x_accounts', 'x_invoices', 'x_bills', 'x_employees'],
  connections: [],
  sales: ['x_open', 'x_bank', 'x_pl'],
  purchases: ['x_open', 'x_bank', 'x_pl'],
  bankrec: ['x_bank', 'x_unrec'],
  banking: ['x_bank', 'x_unrec'],
  financial: ['x_pl', 'x_pl_cash', 'x_bank', 'x_ar', 'x_ap'],
  activity: ['x_inv', 'x_bt', 'x_mj']
};

module.exports = { XERO_FAN_JS, FAN_BINDINGS };

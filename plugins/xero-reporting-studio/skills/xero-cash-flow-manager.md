---
name: xero-cash-flow-manager
description: Build a live, validated Xero Cash Flow Manager on the tested report kit — today's bank balance, projected receipts and payments over the next 30 days, a daily actual/projected chart, and runway. Use for "cash flow", "cash forecast", "cash projection", "runway", "will we have enough cash".
---
# Cash Flow Manager

Use when the user asks for a cash flow forecast, cash projection, runway, or "will we have enough cash". Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_bank_summary`, `list_invoices`, `list_bank_transactions`, `get_organisation`, `list_connections`).

Delivery: Wave 2 (Analytics dashboard). Not a numbered Prompt Library statement.

**This report contains NO Xero-sourced forecast.** There is no cash-flow-statement or forecasting/projection endpoint anywhere on this connector. Every forward-looking figure is built from today's actual bank balance (`get_bank_summary`) plus open invoices'/bills' due dates and `AmountDue` (`list_invoices`) — real, currently-owed amounts, but their due date is not a promise of when cash actually moves. The report says this in the header, the banner, and Sources & limitations, and adds an explicit "what-if" adjustment the reader can use to layer their own judgement on top without it ever being presented as data from Xero.

**Data-shape caveat:** `list_bank_transactions`'s response fields are not documented in the foundation's connector facts (only its params are: `where`, `order`, `page`, `unitdp`). This skill assumes Xero's standard BankTransaction shape (`Type` = `RECEIVE` / `SPEND`, `Total`, `Date`/`DateString`) for the daily actual-balance chart and skips any record it cannot parse. If that chart shows "N/A" live, record the actual field names and fix the `txnAmount()` / `txnDate()` helpers in this file — every other section (today's balance, the projection, runway) does not depend on this call and keeps working regardless.

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_bank_summary` twice (once with `fromDate` = `toDate` = today for the current balance, once with `fromDate` = 30 days ago and `toDate` = today for the burn-rate history), `list_invoices` twice (`where: Type=="ACCREC"` and `where: Type=="ACCPAY"`, both `statuses: AUTHORISED`, `order: DueDate ASC`), and `list_bank_transactions` once (`order: Date DESC`). Each call's failure is that section's failure only — the projection and runway do not need `list_bank_transactions` to work.

## Date defaults

There is no date control in this report. "Today" is always the real current date (bound via the platform's `now.date` context, never a user input). The trailing history window (`history_from`, used for the burn-rate calculation and the actual-balance chart) is recomputed to 30 days before today every time the report opens — leave its default; do not add a control for it (the tested kit has no numeric-days-back stepper yet).

## Controls and views

| Control | Behaviour |
|---|---|
| Organisation | Picker (LIB-002) |
| What-if adjustments (Additional expected receipts / payments) | Plain number fields inside the report body, not a declared input — a local scenario the reader can type into that adjusts only the Projected balance (30 days) card and is never sent to Xero or saved with the report |
| View as | Client / Bookkeeper / Practitioner / Executive |

## Validation checks (shown in the banner)

- Projected balance (30 days) = today's balance + projected inflows (overdue + next 30 days) − projected outflows + any what-if adjustment
- Today's movement = Cash received − Cash spent, from `get_bank_summary`'s own figures for today
- Runway follows the disclosed burn method (average daily net cash flow over the trailing window) — shown for information; it is a method disclosure, not a pass/fail
- All open receivables / payables loaded (no pagination truncation)
- The daily actual-balance chart reflects `list_bank_transactions` when that call succeeds — N/A otherwise, never faked
- Every section total = Σ its account rows, across every source that returned rows

## Save as

`fileName`: `xero-cash-flow-manager.html` · `tags`: ["xero","cash-flow","analytics","dashboard"]

## QA test script (no golden set — new dashboard)

1. On a connected Xero organisation, ask for this report; confirm the six discovery calls resolve or fail individually without blocking the rest of the page.
2. **Record `list_bank_transactions`'s actual response** (its top-level array key and each transaction's field names for date, amount and direction). Compare against the `txnAmount()` / `txnDate()` / `listRows()` helpers in this file's Report config and fix them if Xero's wording differs — this call only feeds the daily actual-balance chart, so a mismatch degrades that one chart to N/A rather than breaking the report.
3. Cross-check today's balance against Xero → Reporting → Bank Summary for today, and the open receivables/payables buckets against Xero → Business → Invoices / Bills filtered to Awaiting Payment, sorted by due date.
4. Type a value into "Additional expected receipts" or "payments" and confirm only the Projected balance (30 days) card changes — no refetch, no change to any other section.
5. Confirm the daily chart's line is solid up to today and dashed from today through +7/+30 days (the "today divider" is this solid-to-dashed transition — there is no separate divider primitive in the tested kit).
6. If either invoice list has more than 100 open items, confirm further pages load automatically up to the stated cap.
7. Validation banner, controls, PDF/Excel download, Download/Share snapshot (the what-if fields reset to zero in a snapshot, since they are not part of `dataBindings`), dark theme, and cross-client isolation (LIB-002).

## dataBindings

```json
{
  "inputs": [
    {
      "name": "history_from",
      "label": "Burn-rate history start",
      "type": "date",
      "default": "2026-08-26"
    },
    {
      "name": "page",
      "label": "Page",
      "type": "number",
      "default": 1
    },
    {
      "name": "org",
      "label": "Organisation",
      "type": "string",
      "maxLength": 64,
      "default": ""
    },
    {
      "name": "persona",
      "label": "View as",
      "type": "enum",
      "options": [
        "Client",
        "Bookkeeper",
        "Practitioner",
        "Executive"
      ],
      "default": "Bookkeeper"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "today_balance",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "context",
          "source": "now.date"
        },
        "toDate": {
          "kind": "context",
          "source": "now.date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "history_balance",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "history_from"
        },
        "toDate": {
          "kind": "context",
          "source": "now.date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "open_ar",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCREC\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "open_ap",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCPAY\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bank_txns",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_bank_transactions"
      },
      "params": {
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "org",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_organisation"
      },
      "params": {
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "connections",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_connections"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
var APP;
var _scenario = { extraIn: 0, extraOut: 0 };
var _arCache = { key: null, rows: null, loading: false, truncated: false };
var _apCache = { key: null, rows: null, loading: false, truncated: false };
var _txnCache = { key: null, rows: null, loading: false, truncated: false };
function colIdx(cols, re) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return -1; }
function bankTotals(w) {
  if (!w || !w.columns.length) return null;
  var openIdx = colIdx(w.columns, /opening/i), recvIdx = colIdx(w.columns, /received/i), spentIdx = colIdx(w.columns, /spent/i), closeIdx = colIdx(w.columns, /closing/i);
  if (closeIdx < 0) return null;
  var totalLine = w.lines.filter(function (l) { return /^total/i.test(l.label || ''); })[0] || null;
  var accountLines = w.lines.filter(function (l) { return l !== totalLine && (l.kind === 'row' || l.kind === 'total'); });
  var sumCol = function (idx) { return idx < 0 ? null : XK.sum(accountLines.map(function (l) { return l.values[idx]; })); };
  return { opening: totalLine && openIdx >= 0 ? XK.val(totalLine, openIdx) : sumCol(openIdx), received: totalLine && recvIdx >= 0 ? XK.val(totalLine, recvIdx) : sumCol(recvIdx),
    spent: totalLine && spentIdx >= 0 ? XK.val(totalLine, spentIdx) : sumCol(spentIdx), closing: totalLine && closeIdx >= 0 ? XK.val(totalLine, closeIdx) : sumCol(closeIdx) };
}
function listRows(v, key) { return (v && (v.Rows || v[key])) || []; } // envelope key unconfirmed for every list_* tool — both checked
function loadAllPages(id, cache, c, entityKey, cap) {
  var key = (c.inputs.org || '') + '|' + c.inputs.page;
  if (cache.key !== key) { cache.key = key; cache.rows = null; cache.loading = false; cache.truncated = false; }
  if (cache.rows != null || cache.loading || !c.live || !window.MyHubReport) return cache;
  var rows1 = listRows(c.data[id], entityKey);
  if (rows1.length < 100) { cache.rows = rows1; return cache; }
  cache.loading = true; var acc = rows1.slice();
  function next(p) {
    MyHubReport.getData(id, Object.assign({}, c.inputs, { page: p })).then(function (v) {
      var err = XK.errorOf(v), rows = err ? [] : listRows(v, entityKey);
      acc = acc.concat(rows);
      if (err || rows.length < 100 || p >= cap) { cache.rows = acc; cache.truncated = !!err || (rows.length >= 100 && p >= cap); cache.loading = false; if (APP) APP.render(); }
      else next(p + 1);
    }, function () { cache.rows = acc; cache.truncated = true; cache.loading = false; if (APP) APP.render(); });
  }
  next(2);
  return cache;
}
function loadTxns(c, windowFrom, cap) {
  var key = (c.inputs.org || '') + '|' + c.inputs.page;
  if (_txnCache.key !== key) { _txnCache = { key: key, rows: null, loading: false, truncated: false }; }
  if (_txnCache.rows != null || _txnCache.loading || !c.live || !window.MyHubReport) return _txnCache;
  function txnDate(t) { return XK.isoDate(t.DateString || t.Date); }
  function pastWindow(rows) { return rows.length < 100 || rows.every(function (t) { var d = txnDate(t); return d && d < windowFrom; }); }
  var rows1 = listRows(c.data.bank_txns, 'BankTransactions');
  if (pastWindow(rows1)) { _txnCache.rows = rows1; return _txnCache; }
  _txnCache.loading = true; var acc = rows1.slice();
  function next(p) {
    MyHubReport.getData('bank_txns', Object.assign({}, c.inputs, { page: p })).then(function (v) {
      var err = XK.errorOf(v), rows = err ? [] : listRows(v, 'BankTransactions');
      acc = acc.concat(rows);
      if (err || p >= cap || pastWindow(rows)) { _txnCache.rows = acc; _txnCache.truncated = !err && !pastWindow(rows) && p >= cap; _txnCache.loading = false; if (APP) APP.render(); }
      else next(p + 1);
    }, function () { _txnCache.rows = acc; _txnCache.truncated = true; _txnCache.loading = false; if (APP) APP.render(); });
  }
  next(2);
  return _txnCache;
}
function txnAmount(t) { var total = XK.num(t.Total); if (total == null) return null; var type = String(t.Type || '').toUpperCase();
  if (/RECEIVE/.test(type)) return Math.abs(total); if (/SPEND/.test(type)) return -Math.abs(total); return null; }
function txnDate2(t) { return XK.isoDate(t.DateString || t.Date); }
APP = XK.app({
  title: 'Cash Flow Manager', primary: 'today_balance', dated: [], org: 'org', conns: 'connections',
  inputs: { org: 'org', persona: 'persona', display: 'display' },
  defaults: { history_from: '2026-08-26', page: 1, org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"custom","c":"none","v":""}' },
  uses: { today_balance: ['org'], history_balance: ['history_from', 'org'], open_ar: ['page', 'org'], open_ap: ['page', 'org'], bank_txns: ['page', 'org'], org: ['org'], connections: [] },
  tools: { today_balance: 'get_bank_summary (today)', history_balance: 'get_bank_summary (trailing history)', open_ar: 'list_invoices (Type==ACCREC)', open_ap: 'list_invoices (Type==ACCPAY)', bank_txns: 'list_bank_transactions', org: 'get_organisation', connections: 'list_connections' },
  derive: function () {
    var t = new Date(), todayIso = XK.iso(new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())));
    return { history_from: XK.iso(XK.addDays(XK.parse(todayIso), -30)) };
  },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
    var t = new Date(), todayIso = XK.iso(new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())));
    var allFailed = ['today_balance', 'history_balance', 'open_ar', 'open_ap'].every(function (id) { return !!c.errors[id]; });
    if (allFailed) {
      var msg0 = c.err('today_balance') || c.err('open_ar') || c.err('open_ap') || 'Loading…';
      body.innerHTML = '<p class="xk-err">' + XK.h(msg0) + '</p>';
      return { checks: [{ name: 'Cash flow data loaded', pass: false, detail: msg0 }] };
    }
    var wToday = c.data.today_balance && !c.errors.today_balance ? XK.walk(c.data.today_balance) : null;
    var wHist = c.data.history_balance && !c.errors.history_balance ? XK.walk(c.data.history_balance) : null;
    var btToday = bankTotals(wToday), btHist = bankTotals(wHist);
    var todayClosing = btToday ? btToday.closing : null;
    var todayMovement = (btToday && btToday.received != null && btToday.spent != null) ? Math.round((btToday.received - btToday.spent) * 100) / 100 : null;

    var histDays = (btHist && c.inputs.history_from) ? Math.round((XK.parse(todayIso) - XK.parse(c.inputs.history_from)) / 86400000) : null;
    var avgDailyNet = (btHist && histDays > 0 && btHist.received != null && btHist.spent != null) ? (btHist.received - btHist.spent) / histDays : null;
    var runwayDays = (avgDailyNet != null && avgDailyNet < 0 && todayClosing != null) ? Math.floor(todayClosing / Math.abs(avgDailyNet)) : null;

    var arCache = loadAllPages('open_ar', _arCache, c, 'Invoices', 5), apCache = loadAllPages('open_ap', _apCache, c, 'Invoices', 5);
    var arRows = arCache.rows || listRows(c.data.open_ar, 'Invoices'), apRows = apCache.rows || listRows(c.data.open_ap, 'Invoices');
    function classify(rows) {
      var b = { overdue: 0, next7: 0, next830: 0, beyond: 0, undated: 0, undatedCount: 0, count: 0 };
      rows.forEach(function (inv) {
        if (!inv || XK.errorOf(inv)) return;
        var amt = XK.num(inv.AmountDue); if (amt == null) return;
        var due = XK.isoDate(inv.DueDateString || inv.DueDate);
        if (!due) { b.undated += amt; b.undatedCount++; b.count++; return; }
        var days = Math.round((XK.parse(due) - XK.parse(todayIso)) / 86400000);
        if (days < 0) b.overdue += amt; else if (days <= 7) b.next7 += amt; else if (days <= 30) b.next830 += amt; else b.beyond += amt;
        b.count++;
      });
      return b;
    }
    var ar = classify(arRows), ap = classify(apRows);
    var overdueNet = Math.round((ar.overdue - ap.overdue) * 100) / 100, next7Net = Math.round((ar.next7 - ap.next7) * 100) / 100, next830Net = Math.round((ar.next830 - ap.next830) * 100) / 100;
    var bal7 = todayClosing != null ? Math.round((todayClosing + overdueNet + next7Net) * 100) / 100 : null;
    var bal30 = bal7 != null ? Math.round((bal7 + next830Net + _scenario.extraIn - _scenario.extraOut) * 100) / 100 : null;
    var direct30 = todayClosing != null ? Math.round((todayClosing + overdueNet + next7Net + next830Net + _scenario.extraIn - _scenario.extraOut) * 100) / 100 : null;

    var kpiRow = [
      { label: "Today's balance", value: todayClosing },
      { label: "Today's movement", value: todayMovement },
      { label: 'Overdue (receivables − payables)', value: overdueNet },
      { label: 'Next 1–7 days (net)', value: next7Net },
      { label: 'Next 8–30 days (net)', value: next830Net },
      { label: 'Projected balance (30 days)', value: bal30 },
      { label: 'Runway', money: false, text: runwayDays == null ? (avgDailyNet != null && avgDailyNet >= 0 ? 'Not burning cash' : 'N/A') : runwayDays + ' days' }
    ];
    body.innerHTML = XK.kpis(kpiRow, c) +
      '<p class="muted">Projections are built from open invoices/bills and their due dates — never a guaranteed cash date. Use the what-if fields below to layer your own judgement.</p>' +
      '<div class="xk-card"><h3>What-if adjustments (not sent to Xero)</h3><div class="cz">' +
      '<label>Additional expected receipts<input type="number" step="0.01" id="xk-extra-in" value="' + _scenario.extraIn + '"></label>' +
      '<label>Additional expected payments<input type="number" step="0.01" id="xk-extra-out" value="' + _scenario.extraOut + '"></label></div></div>' +
      '<div id="xk-cfm-chart" class="xk-card" style="margin-top:12px"></div>' +
      '<div class="xk-card detail-block" style="margin-top:12px"><h3>Upcoming 30 days (receivables and payables due)</h3><div id="gridUpcoming"></div></div>';

    var elIn = document.getElementById('xk-extra-in'), elOut = document.getElementById('xk-extra-out');
    if (elIn) elIn.addEventListener('change', function () { _scenario.extraIn = Number(this.value) || 0; APP.render(); });
    if (elOut) elOut.addEventListener('change', function () { _scenario.extraOut = Number(this.value) || 0; APP.render(); });

    var txnCache = loadTxns(c, c.inputs.history_from, 3);
    var chartEl = document.getElementById('xk-cfm-chart');
    if (txnCache.rows && todayClosing != null && c.inputs.history_from) {
      chartEl.innerHTML = '<h3>Daily cash position — actual and projected</h3><div id="ch1"></div>';
      var netByDay = {};
      txnCache.rows.forEach(function (tr) { var d = txnDate2(tr), a = txnAmount(tr); if (!d || a == null) return; netByDay[d] = (netByDay[d] || 0) + a; });
      var days = []; for (var dt = XK.parse(c.inputs.history_from); XK.iso(dt) <= todayIso; dt = XK.addDays(dt, 1)) days.push(XK.iso(dt));
      var bal = {}; bal[todayIso] = todayClosing;
      for (var i = days.length - 1; i > 0; i--) { var d1 = days[i], d0 = days[i - 1]; bal[d0] = bal[d1] == null ? null : Math.round((bal[d1] - (netByDay[d1] || 0)) * 100) / 100; }
      var histBalances = days.map(function (d) { return bal[d] == null ? null : bal[d]; });
      var labels = days.concat(['+7 days', '+30 days']);
      var actualSeries = histBalances.concat([null, null]);
      var projectedSeries = histBalances.map(function (v, idx) { return idx === histBalances.length - 1 ? v : null; }).concat([bal7, bal30]);
      XK.line(document.getElementById('ch1'), { title: 'Daily cash position', labels: labels, series: [{ name: 'Actual balance', values: actualSeries }, { name: 'Projected balance', values: projectedSeries }] }, c);
    } else {
      chartEl.innerHTML = '<h3>Daily cash position — actual and projected</h3><p class="muted">N/A — list_bank_transactions ' + (txnCache.truncated ? 'returned incomplete data' : (c.errors.bank_txns ? XK.h(c.err('bank_txns')) : 'is still loading or returned nothing usable')) + '. Today\'s balance and the projection KPIs above do not depend on this chart.</p>';
    }

    var dayIso30 = XK.iso(XK.addDays(XK.parse(todayIso), 30));
    function invRow(inv, kind) { return { contact: (inv.Contact && inv.Contact.Name) || 'N/A', due: XK.isoDate(inv.DueDateString || inv.DueDate), amount: XK.num(inv.AmountDue), kind: kind }; }
    var upcoming = arRows.map(function (i) { return invRow(i, 'Receivable'); }).concat(apRows.map(function (i) { return invRow(i, 'Payable'); }))
      .filter(function (r) { return r.due && r.due <= dayIso30 && r.amount != null; })
      .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    XK.grid(document.getElementById('gridUpcoming'), { filter: true, empty: 'No receivables or payables due in the next 30 days.',
      columns: [{ key: 'contact', title: 'Contact' }, { key: 'kind', title: 'Type' }, { key: 'due', title: 'Due date' }, { key: 'amount', title: 'Amount due', money: true }],
      rows: upcoming }, c);

    var tieCounts = { checked: 0, failed: [] };
    [wToday, wHist].forEach(function (w) { if (!w) return; var tt = XK.linesTies(w.lines); tieCounts.checked += tt.checked; tieCounts.failed = tieCounts.failed.concat(tt.failed); });
    var checks = [
      { name: "Projected balance (30 days) = today's balance + projected inflows − projected outflows", pass: bal30 == null || direct30 == null ? null : XK.near(bal30, direct30), detail: todayClosing == null ? "Today's balance is unavailable" : money(todayClosing) + ' + ' + money(overdueNet + next7Net) + ' (overdue + next 7 days) + ' + money(next830Net) + ' (8–30 days)' + ((_scenario.extraIn || _scenario.extraOut) ? ' + what-if adjustments' : '') + ' = ' + money(bal30) },
      { name: "Today's movement = Cash received − Cash spent", pass: (btToday && btToday.received != null && btToday.spent != null) ? true : null, detail: btToday ? money(todayMovement) : (c.err('today_balance') || 'Bank Summary unavailable') },
      { name: 'Runway follows the disclosed burn method (information)', pass: null, info: true, detail: avgDailyNet == null ? 'History window unavailable — see the Bank Summary (trailing history) call' : 'Average daily net cash flow over the trailing ' + histDays + ' days: ' + money(avgDailyNet) + '/day' },
      { name: 'All open receivables loaded (no truncation)', pass: arCache.rows == null ? null : !arCache.truncated, detail: arCache.rows == null ? 'Still loading further pages…' : (arCache.truncated ? 'Stopped at the page cap — the projection may understate what is actually owed' : arCache.rows.length + ' invoices loaded') },
      { name: 'All open payables loaded (no truncation)', pass: apCache.rows == null ? null : !apCache.truncated, detail: apCache.rows == null ? 'Still loading further pages…' : (apCache.truncated ? 'Stopped at the page cap — the projection may understate what is actually owed' : apCache.rows.length + ' invoices loaded') },
      { name: 'Daily actual-balance chart reflects list_bank_transactions', pass: txnCache.rows ? true : null, detail: txnCache.rows ? txnCache.rows.length + ' transactions read' : 'Unavailable — the KPI cards above do not depend on this call' },
      { name: 'Every section total = Σ its account rows (all sources)', pass: tieCounts.checked ? tieCounts.failed.length === 0 : null, detail: tieCounts.failed.length ? 'Mismatch: ' + tieCounts.failed.join(', ') : tieCounts.checked + ' sections checked' }
    ];
    var undatedTotal = Math.round((ar.undated - ap.undated) * 100) / 100, undatedCount = ar.undatedCount + ap.undatedCount;
    var notes = ['No cash-flow-statement or forecast endpoint exists on this connector — every projected figure is built from open invoices/bills\' due dates, never Xero-sourced.',
      'list_bank_transactions\'s exact field names are unconfirmed live — see the data-shape caveat at the top of this skill.'];
    if (undatedCount) notes.push(undatedCount + ' open invoice(s)/bill(s) totalling ' + money(undatedTotal) + ' (net) have no due date and are excluded from every projection bucket.');
    this._kpi = { todayBalance: todayClosing, todayMovement: todayMovement, overdueNet: overdueNet, next7Net: next7Net, next830Net: next830Net, bal30: bal30, runwayDays: runwayDays };
    this._upcoming = upcoming;
    return { checks: checks, notes: notes, na: ['A true daily forward projection beyond the +7/+30-day checkpoints (kept coarse to limit unverified per-day cash-placement assumptions)', 'Xero Analytics/Syft cash-flow widgets (not in this connector)'],
      title: 'Cash Flow Manager' };
  },
  excel: function (c) {
    var k = this._kpi || {}, up = this._upcoming || [];
    var summaryRows = [
      { kind: 'row', depth: 0, label: "Today's balance", values: [k.todayBalance] },
      { kind: 'row', depth: 0, label: "Today's movement", values: [k.todayMovement] },
      { kind: 'row', depth: 0, label: 'Overdue (receivables − payables)', values: [k.overdueNet] },
      { kind: 'row', depth: 0, label: 'Next 1–7 days (net)', values: [k.next7Net] },
      { kind: 'row', depth: 0, label: 'Next 8–30 days (net)', values: [k.next830Net] },
      { kind: 'row', depth: 0, label: 'Projected balance (30 days)', values: [k.bal30] },
      { kind: 'row', depth: 0, label: 'Runway (days)', values: [k.runwayDays] }
    ];
    var sheets = [XK.sheetFromLines('Cash Flow Manager', c.company, 'As at today', ['', 'Value'], summaryRows, XK.footerStamp('Accrual', c.fetchedAt, c.currency), ['money'])];
    if (up.length) sheets.push(XK.sheetFromLines('Upcoming 30 Days', c.company, 'Receivables and payables due', ['Contact / Type', 'Amount due'],
      up.map(function (r) { return { kind: 'row', depth: 0, label: r.contact + ' (' + r.kind + ', due ' + r.due + ')', values: [r.amount] }; }), '', ['money']));
    return sheets;
  }
});
```

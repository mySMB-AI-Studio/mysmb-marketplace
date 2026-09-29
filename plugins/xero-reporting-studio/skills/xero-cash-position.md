---
name: xero-cash-position
description: Build a live, validated Xero Cash Position on the tested report kit — bank balances and monthly trend, cash in versus cash out, and receivables/payables ageing composition. Use for "cash position", "cash analytics", "cash trend", "bank balances".
---
# Analytics — Cash Position

Use when the user asks for a cash position, cash analytics, cash trend, or bank balances view. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_executive_summary`, `get_bank_summary`, `get_balance_sheet`, `list_invoices`, `get_organisation`, `list_connections`).

Delivery: Wave 2 (Analytics dashboard). Not a numbered Prompt Library statement — it composes several connector calls.

**Data-shape caveats (read before relying on this skill live):**
- `get_executive_summary`'s exact `Reports[0].Rows` wording is unconfirmed — see the same caveat in `xero-reporting-studio:xero-performance-overview`. Every match here is null-safe and falls back to `get_bank_summary` / `get_balance_sheet`.
- `get_bank_summary` is documented as "per bank account Opening balance, Cash received, Cash spent, Closing balance" but whether it returns one flat table, sections, or its own Total row has not been confirmed live. This skill finds columns by tolerant header-text matching (`opening`, `received`, `spent`, `closing`), looks for a row labelled "Total", and computes the total itself from the account rows when no such row is found — correct either way, but confirm the columns matched what you expect on the first live run.
- `list_invoices`'s exact response envelope key (`Rows` per the foundation's wording, or `Invoices` per Xero's native REST convention) is unconfirmed; this skill checks both.

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_executive_summary` once with `date` = today, `get_bank_summary` once with `fromDate` = the start of the current month and `toDate` = today, `get_balance_sheet` once with `date` = today, `periods` = 11, `timeframe` = `MONTH`, `standardLayout` = `true`, and `list_invoices` twice (`where: Type=="ACCREC"` and `where: Type=="ACCPAY"`, both `statuses: AUTHORISED`, `order: DueDate ASC`, `page` = 1). Each call's failure is that section's failure only.

## Date defaults

`as_at_date` = the date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. `period_from` (the start of the month containing `as_at_date`) and `prior_from` / `prior_to` (the previous calendar month) are derived by the kit — leave their defaults. The bank-balance trend and the ageing composition are not affected by the As-at date choice beyond re-bucketing (see the AmountDue caveat below); only the headline cash-in/out cards and the independent tie move with it.

## Controls and views

| Control | Behaviour |
|---|---|
| As at | Preset + editable date — anchors the headline cash figures, the 12-month bank-balance trend end, and the ageing bucket boundaries |
| Organisation | Picker (LIB-002) |
| Accounting basis | N/A — bank balances and invoice ageing are basis-independent in Xero |
| Bank account filter | Client-side, built into the account table (a filter box appears once there are more than 8 accounts); it does not re-query |

## Validation checks (shown in the banner)

- **Independent tie:** Cash/bank balance (Executive Summary or Bank Summary) = Total Bank on the Balance Sheet at the as-at date
- Closing balance = Opening balance + Cash received − Cash spent, for the selected period (`get_bank_summary`'s own figures)
- Receivables ageing total (from `list_invoices`) vs Accounts Receivable on the Balance Sheet — information only: `AmountDue` is always today's balance, never revalued to an earlier as-at date, so this ties exactly only when As at = today
- Payables ageing total vs Accounts Payable on the Balance Sheet — same caveat, information only
- All open receivables / payables loaded (no pagination truncation)
- Every section total = Σ its account rows, across every source that returned rows

## Save as

`fileName`: `xero-cash-position.html` · `tags`: ["xero","cash-position","analytics","dashboard"]

## QA test script (no golden set — new dashboard)

1. On a connected Xero organisation, ask for this report; confirm the seven discovery calls resolve or fail individually without blocking the rest of the page.
2. **Record `get_executive_summary`'s and `get_bank_summary`'s actual responses.** For `get_bank_summary`, note whether it returns a flat table or sectioned rows, the exact column header text, and whether it includes its own "Total" row — compare against the `bankTotals()` helper in this file's Report config and adjust if the column matching misses. For `list_invoices`, note the actual top-level array key (`Rows` or `Invoices`) — both are already checked, but confirm neither silently returns nothing.
3. Cross-check the headline cards (Cash/bank balance, Cash received, Cash spent, Net cash flow) against Xero → Reporting → Bank Summary and → Executive Summary for the same dates.
4. Confirm the 12-month cash-balance trend chart plot 12 (or however many Xero returned) points ending at the As-at date — same column-order caveat as Performance Overview (assumed most-recent-first; flip `chronological()` if wrong).
5. Confirm the receivables and payables ageing donuts sum to the KPI cards' Total receivables / Total payables figures, and that the grouped bars (Receivables vs Payables by bucket) match the donuts.
6. Set As at to a date other than today and confirm the banner explicitly states that the ageing composition still uses `AmountDue`'s current balance (only the bucketing has moved) — this must never be silently wrong.
7. If either invoice list has more than 100 open items, confirm the second (and further) pages load automatically up to the stated cap, and that a "may be truncated" note appears once the cap is hit.
8. Validation banner, controls, PDF/Excel download, Download/Share snapshot, dark theme, and cross-client isolation (LIB-002) — same as every other kit report.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "as_at_date",
      "label": "As at",
      "type": "date",
      "default": "today"
    },
    {
      "name": "period_from",
      "label": "Period start",
      "type": "date",
      "default": "2026-09-01"
    },
    {
      "name": "prior_from",
      "label": "Prior period start",
      "type": "date",
      "default": "2026-08-01"
    },
    {
      "name": "prior_to",
      "label": "Prior period end",
      "type": "date",
      "default": "2026-08-31"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "exec_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_executive_summary"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at_date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bank_summary",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "period_from"
        },
        "toDate": {
          "kind": "input",
          "input": "as_at_date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bank_summary_prior",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "prior_from"
        },
        "toDate": {
          "kind": "input",
          "input": "prior_to"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bs_trend",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at_date"
        },
        "periods": {
          "kind": "static",
          "value": 11
        },
        "timeframe": {
          "kind": "static",
          "value": "MONTH"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
        },
        "paymentsOnly": {
          "kind": "static",
          "value": false
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "ar_invoices",
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
      "id": "ap_invoices",
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
function colIdx(cols, re) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return -1; }
function bankTotals(w) {
  if (!w || !w.columns.length) return null;
  var openIdx = colIdx(w.columns, /opening/i), recvIdx = colIdx(w.columns, /received/i), spentIdx = colIdx(w.columns, /spent/i), closeIdx = colIdx(w.columns, /closing/i);
  if (closeIdx < 0) return null;
  var totalLine = w.lines.filter(function (l) { return /^total/i.test(l.label || ''); })[0] || null;
  var accountLines = w.lines.filter(function (l) { return l !== totalLine && (l.kind === 'row' || l.kind === 'total'); });
  var sumCol = function (idx) { return idx < 0 ? null : XK.sum(accountLines.map(function (l) { return l.values[idx]; })); };
  return {
    accounts: accountLines.map(function (l) { return { name: l.label, opening: openIdx >= 0 ? l.values[openIdx] : null, received: recvIdx >= 0 ? l.values[recvIdx] : null, spent: spentIdx >= 0 ? l.values[spentIdx] : null, closing: l.values[closeIdx] }; }),
    opening: totalLine && openIdx >= 0 ? XK.val(totalLine, openIdx) : sumCol(openIdx),
    received: totalLine && recvIdx >= 0 ? XK.val(totalLine, recvIdx) : sumCol(recvIdx),
    spent: totalLine && spentIdx >= 0 ? XK.val(totalLine, spentIdx) : sumCol(spentIdx),
    closing: totalLine && closeIdx >= 0 ? XK.val(totalLine, closeIdx) : sumCol(closeIdx)
  };
}
var AGE_BUCKETS = ['Current', '< 1 month overdue', '1 month overdue', '2 months overdue', '3 months overdue', 'Older'];
function bucketOf(dueIso, asAtIso) {
  if (!dueIso) return null;
  var days = Math.round((XK.parse(asAtIso) - XK.parse(dueIso)) / 86400000);
  if (days <= 0) return 0; if (days <= 29) return 1; if (days <= 59) return 2; if (days <= 89) return 3; if (days <= 119) return 4; return 5;
}
function invoiceRows(v) { return (v && (v.Rows || v.Invoices)) || []; } // envelope key unconfirmed — both checked, see the data-shape caveat
function ageingComposition(rows, asAtIso) {
  var totals = AGE_BUCKETS.map(function () { return 0; }), grand = 0, used = 0;
  rows.forEach(function (inv) {
    if (!inv || XK.errorOf(inv)) return;
    var invDateIso = XK.isoDate(inv.DateString || inv.Date);
    if (invDateIso && invDateIso > asAtIso) return; // exclude invoices raised after the as-at date
    var dueIso = XK.isoDate(inv.DueDateString || inv.DueDate) || invDateIso;
    var amt = XK.num(inv.AmountDue);
    var b = bucketOf(dueIso, asAtIso);
    if (amt == null || b == null) return;
    totals[b] += amt; grand += amt; used++;
  });
  return { totals: totals.map(function (v2) { return Math.round(v2 * 100) / 100; }), grand: Math.round(grand * 100) / 100, count: used };
}
var _pageCache = {};
function pageKey(c) { return (c.inputs.org || '') + '|' + c.inputs.page; }
function loadAllPages(id, c, cap) {
  var key = pageKey(c), cache = _pageCache[id];
  if (!cache || cache.key !== key) cache = _pageCache[id] = { key: key, rows: null, loading: false, truncated: false };
  if (cache.rows != null || cache.loading || !c.live || !window.MyHubReport) return cache;
  var rows1 = invoiceRows(c.data[id]);
  if (rows1.length < 100) { cache.rows = rows1; cache.truncated = false; return cache; }
  cache.loading = true; var acc = rows1.slice();
  function next(p) {
    MyHubReport.getData(id, Object.assign({}, c.inputs, { page: p })).then(function (v) {
      var err = XK.errorOf(v), rows = err ? [] : invoiceRows(v);
      acc = acc.concat(rows);
      if (err || rows.length < 100 || p >= cap) { cache.rows = acc; cache.truncated = !!err || (rows.length >= 100 && p >= cap); cache.loading = false; if (APP) APP.render(); }
      else next(p + 1);
    }, function () { cache.rows = acc; cache.truncated = true; cache.loading = false; if (APP) APP.render(); });
  }
  next(2);
  return cache;
}
APP = XK.app({
  title: 'Cash Position', primary: 'exec_summary', dated: ['exec_summary', 'bank_summary'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at_date', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at_date: '2026-09-25', period_from: '2026-09-01', prior_from: '2026-08-01', prior_to: '2026-08-31', page: 1, org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
  uses: { exec_summary: ['as_at_date', 'org'], bank_summary: ['period_from', 'as_at_date', 'org'], bank_summary_prior: ['prior_from', 'prior_to', 'org'], bs_trend: ['as_at_date', 'org'], ar_invoices: ['page', 'org'], ap_invoices: ['page', 'org'], org: ['org'], connections: [] },
  tools: { exec_summary: 'get_executive_summary', bank_summary: 'get_bank_summary (this period)', bank_summary_prior: 'get_bank_summary (prior period)', bs_trend: 'get_balance_sheet (12-month trend)', ar_invoices: 'list_invoices (Type==ACCREC)', ap_invoices: 'list_invoices (Type==ACCPAY)', org: 'get_organisation', connections: 'list_connections' },
  derive: function (inp) {
    var d = XK.parse(inp.as_at_date), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    var periodFrom = XK.iso(new Date(Date.UTC(y, m - 1, 1)));
    var pm = m - 1, py = y; if (pm < 1) { pm = 12; py -= 1; }
    return { period_from: periodFrom, prior_from: XK.iso(new Date(Date.UTC(py, pm - 1, 1))), prior_to: XK.iso(XK.eom(py, pm)) };
  },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
    var chronological = function (arr) { return arr.slice().reverse(); }; // assumed most-recent-first — unconfirmed live
    var allFailed = ['exec_summary', 'bank_summary', 'bs_trend', 'ar_invoices', 'ap_invoices'].every(function (id) { return !!c.errors[id]; });
    if (allFailed) {
      var msg0 = c.err('exec_summary') || c.err('bank_summary') || c.err('bs_trend') || c.err('ar_invoices') || 'Loading…';
      body.innerHTML = '<p class="xk-err">' + XK.h(msg0) + '</p>';
      return { checks: [{ name: 'Cash position data loaded', pass: false, detail: msg0 }] };
    }
    var wEx = c.data.exec_summary && !c.errors.exec_summary ? XK.walk(c.data.exec_summary) : null;
    var wBank = c.data.bank_summary && !c.errors.bank_summary ? XK.walk(c.data.bank_summary) : null;
    var wBankPrior = c.data.bank_summary_prior && !c.errors.bank_summary_prior ? XK.walk(c.data.bank_summary_prior) : null;
    var wBS = c.data.bs_trend && !c.errors.bs_trend ? XK.walk(c.data.bs_trend) : null;

    var exBank = wEx ? XK.val(XK.find(wEx.lines, null, /cash surplus|total cash|^bank$/i)) : null;
    var exReceived = wEx ? XK.val(XK.find(wEx.lines, null, /cash received/i)) : null;
    var exSpent = wEx ? XK.val(XK.find(wEx.lines, null, /cash spent/i)) : null;
    var bt = bankTotals(wBank), btPrior = bankTotals(wBankPrior);
    var bBank0 = wBS ? XK.sectionBy(wBS, /^bank$/i, 0) : null;
    var nColsB = wBS ? wBS.columns.length : 0;

    var pick = function (a, b) { return a != null ? a : b; };
    var bank = pick(exBank, bt ? bt.closing : null);
    var received = pick(exReceived, bt ? bt.received : null);
    var spent = pick(exSpent, bt ? bt.spent : null);
    var netFlow = (received != null && spent != null) ? Math.round((received - spent) * 100) / 100 : null;
    var receivedPrior = btPrior ? btPrior.received : null, spentPrior = btPrior ? btPrior.spent : null;
    var netFlowPrior = (receivedPrior != null && spentPrior != null) ? Math.round((receivedPrior - spentPrior) * 100) / 100 : null;

    var arCache = loadAllPages('ar_invoices', c, 5), apCache = loadAllPages('ap_invoices', c, 5);
    var arRows = arCache.rows || invoiceRows(c.data.ar_invoices), apRows = apCache.rows || invoiceRows(c.data.ap_invoices);
    var arAge = ageingComposition(arRows, c.inputs.as_at_date), apAge = ageingComposition(apRows, c.inputs.as_at_date);
    var arLine = wBS ? XK.find(wBS.lines, null, /^accounts receivable$/i, 'row') : null;
    var apLine = wBS ? XK.find(wBS.lines, null, /^accounts payable$/i, 'row') : null;
    var arBS0 = arLine ? XK.val(arLine, 0) : null, apBS0 = apLine ? XK.val(apLine, 0) : null;

    var kpiRow = [
      { label: 'Cash / bank balance', value: bank },
      { label: 'Cash received (period)', value: received, delta: (received != null && receivedPrior) ? (received - receivedPrior) / Math.abs(receivedPrior) : null },
      { label: 'Cash spent (period)', value: spent, delta: (spent != null && spentPrior) ? (spent - spentPrior) / Math.abs(spentPrior) : null },
      { label: 'Net cash flow (period)', value: netFlow },
      { label: 'Total receivables (open)', value: arAge.grand },
      { label: 'Total payables (open)', value: apAge.grand }
    ];
    var today = c.today, notToday = c.inputs.as_at_date !== today;
    body.innerHTML = XK.kpis(kpiRow, c) +
      (notToday ? '<p class="muted">As at ' + XK.h(c.inputs.as_at_date) + ': the receivables/payables figures below use each invoice\'s CURRENT balance (Xero does not revalue AmountDue to an earlier date) — only which ageing bucket it falls into has moved.</p>' : '') +
      '<div class="xk-card"><h3>Bank accounts</h3><div id="gridBank"></div></div>' +
      '<div class="xk-grid2" style="margin-top:12px"><div class="xk-card"><h3>Cash balance trend</h3><div id="ch1"></div></div><div class="xk-card"><h3>Cash in vs cash out — this period vs prior period</h3><div id="ch2"></div></div></div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:12px"><div class="xk-card"><h3>Receivables ageing</h3><div id="ch3"></div></div><div class="xk-card"><h3>Payables ageing</h3><div id="ch4"></div></div></div>' +
      '<div class="xk-card detail-block" style="margin-top:12px"><h3>Receivables vs payables by ageing bucket</h3><div id="ch5"></div></div>';

    var gridRows = bt ? bt.accounts.map(function (a) { return { name: a.name, opening: a.opening, received: a.received, spent: a.spent, closing: a.closing }; }) : [];
    var gridTotal = bt ? { name: 'Total', opening: bt.opening, received: bt.received, spent: bt.spent, closing: bt.closing } : null;
    XK.grid(document.getElementById('gridBank'), { filter: true, empty: bt ? 'No bank accounts returned.' : 'Bank Summary is unavailable — see the validation banner.',
      columns: [{ key: 'name', title: 'Bank account' }, { key: 'opening', title: 'Opening', money: true }, { key: 'received', title: 'Received', money: true }, { key: 'spent', title: 'Spent', money: true }, { key: 'closing', title: 'Closing', money: true }],
      rows: gridRows, total: gridTotal }, c);
    var labelsB = wBS ? wBS.columns.slice(0, nColsB) : [];
    var bankSeries = wBS ? (function () { var out = []; for (var i = 0; i < nColsB; i++) out.push(XK.sectionBy(wBS, /^bank$/i, i)); return out; })() : [];
    XK.line(document.getElementById('ch1'), { title: 'Cash balance trend', labels: chronological(labelsB), series: [{ name: 'Bank balance', values: chronological(bankSeries) }] }, c);
    XK.bars(document.getElementById('ch2'), { title: 'Cash in vs cash out', labels: ['Cash received', 'Cash spent', 'Net cash flow'], series: [{ name: 'This period', values: [received, spent, netFlow] }, { name: 'Prior period', values: [receivedPrior, spentPrior, netFlowPrior] }] }, c);
    XK.donut(document.getElementById('ch3'), { title: 'Receivables ageing', items: AGE_BUCKETS.map(function (b, i) { return { label: b, value: Math.abs(arAge.totals[i]) }; }), centre: money(arAge.grand) }, c);
    XK.donut(document.getElementById('ch4'), { title: 'Payables ageing', items: AGE_BUCKETS.map(function (b, i) { return { label: b, value: Math.abs(apAge.totals[i]) }; }), centre: money(apAge.grand) }, c);
    XK.bars(document.getElementById('ch5'), { title: 'Receivables vs payables by ageing bucket', labels: AGE_BUCKETS, series: [{ name: 'Receivables', values: arAge.totals }, { name: 'Payables', values: apAge.totals }] }, c);

    var tieCounts = { checked: 0, failed: [] };
    [wEx, wBank, wBankPrior, wBS].forEach(function (w) { if (!w) return; var t = XK.linesTies(w.lines); tieCounts.checked += t.checked; tieCounts.failed = tieCounts.failed.concat(t.failed); });
    var checks = [
      { name: 'Cash/bank balance ties to the Balance Sheet Bank total at ' + c.inputs.as_at_date, pass: (bank == null || bBank0 == null) ? null : XK.near(bank, bBank0), detail: bank == null ? 'No cash/bank figure available' : bBank0 == null ? 'Balance Sheet trend did not return a Bank section' : money(bank) + ' vs ' + money(bBank0) },
      { name: 'Closing balance = Opening + Received − Spent (this period)', pass: bt && bt.opening != null && bt.received != null && bt.spent != null && bt.closing != null ? XK.near(bt.closing, bt.opening + bt.received - bt.spent) : null, detail: bt ? (bt.closing != null ? money(bt.closing) + ' vs ' + money((bt.opening || 0) + (bt.received || 0) - (bt.spent || 0)) : 'Bank Summary did not return all four figures') : c.err('bank_summary') || 'Bank Summary unavailable' },
      { name: 'Receivables ageing total vs Balance Sheet Accounts Receivable (information)', pass: null, info: true, detail: arBS0 == null ? 'Balance Sheet did not return an Accounts Receivable line' : money(arAge.grand) + ' (recomputed, ' + arAge.count + ' invoices) vs ' + money(arBS0) + (notToday ? ' — AmountDue is always today\'s balance' : '') },
      { name: 'Payables ageing total vs Balance Sheet Accounts Payable (information)', pass: null, info: true, detail: apBS0 == null ? 'Balance Sheet did not return an Accounts Payable line' : money(apAge.grand) + ' (recomputed, ' + apAge.count + ' invoices) vs ' + money(apBS0) + (notToday ? ' — AmountDue is always today\'s balance' : '') },
      { name: 'All open receivables loaded (no truncation)', pass: arCache.rows == null ? null : !arCache.truncated, detail: arCache.rows == null ? 'Still loading further pages…' : (arCache.truncated ? 'Stopped at the page cap — totals may understate the true balance' : arCache.rows.length + ' invoices loaded') },
      { name: 'All open payables loaded (no truncation)', pass: apCache.rows == null ? null : !apCache.truncated, detail: apCache.rows == null ? 'Still loading further pages…' : (apCache.truncated ? 'Stopped at the page cap — totals may understate the true balance' : apCache.rows.length + ' invoices loaded') },
      { name: 'Every section total = Σ its account rows (all sources)', pass: tieCounts.checked ? tieCounts.failed.length === 0 : null, detail: tieCounts.failed.length ? 'Mismatch: ' + tieCounts.failed.join(', ') : tieCounts.checked + ' sections checked' }
    ];
    var notes = ['get_executive_summary and get_bank_summary\'s exact row/column wording are unconfirmed live — see the data-shape caveats at the top of this skill.',
      'Credit notes are not netted against the ageing composition in this version.'];
    this._kpi = { bank: bank, received: received, spent: spent, netFlow: netFlow, arTotal: arAge.grand, apTotal: apAge.grand };
    this._trend = { labels: chronological(labelsB), bank: chronological(bankSeries) };
    this._age = { buckets: AGE_BUCKETS, ar: arAge.totals, ap: apAge.totals };
    this._accounts = gridRows;
    return { checks: checks, notes: notes, na: ['Xero Analytics/Syft widgets and AI insights (not in this connector)', 'A bank-feed statement balance separate from Xero\'s own Closing balance (not in this connector)'],
      title: 'Cash Position' };
  },
  excel: function (c) {
    var k = this._kpi || {}, t = this._trend || { labels: [], bank: [] }, ageD = this._age || { buckets: [], ar: [], ap: [] }, acc = this._accounts || [];
    var summaryRows = [
      { kind: 'row', depth: 0, label: 'Cash / bank balance', values: [k.bank] },
      { kind: 'row', depth: 0, label: 'Cash received (period)', values: [k.received] },
      { kind: 'row', depth: 0, label: 'Cash spent (period)', values: [k.spent] },
      { kind: 'row', depth: 0, label: 'Net cash flow (period)', values: [k.netFlow] },
      { kind: 'row', depth: 0, label: 'Total receivables (open)', values: [k.arTotal] },
      { kind: 'row', depth: 0, label: 'Total payables (open)', values: [k.apTotal] }
    ];
    var sheets = [XK.sheetFromLines('Cash Position', c.company, XK.asOfLine(c.inputs.as_at_date), ['', 'Value'], summaryRows, XK.footerStamp('Accrual', c.fetchedAt, c.currency), ['money'])];
    if (acc.length) sheets.push(XK.sheetFromLines('Bank Accounts', c.company, XK.asOfLine(c.inputs.as_at_date), ['Account', 'Opening', 'Received', 'Spent', 'Closing'],
      acc.map(function (a) { return { kind: 'row', depth: 0, label: a.name, values: [a.opening, a.received, a.spent, a.closing] }; }), '', ['money', 'money', 'money', 'money']));
    if (t.labels.length) sheets.push(XK.sheetFromLines('Bank Balance Trend', c.company, 'Monthly trend to ' + c.inputs.as_at_date, [''].concat(t.labels), [{ kind: 'row', depth: 0, label: 'Bank balance', values: t.bank }], '', t.labels.map(function () { return 'money'; })));
    if (ageD.buckets.length) sheets.push(XK.sheetFromLines('Ageing', c.company, XK.asOfLine(c.inputs.as_at_date), ['Bucket', 'Receivables', 'Payables'],
      ageD.buckets.map(function (b, i) { return { kind: 'row', depth: 0, label: b, values: [ageD.ar[i], ageD.ap[i]] }; }), '', ['money', 'money']));
    return sheets;
  }
});
```

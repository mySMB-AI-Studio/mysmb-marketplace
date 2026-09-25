---
name: quickbooks-aged-payables
description: QuickBooks Online Accounts payable family (Q26) as a live, validated report in QuickBooks styling. Use when the user asks for aged payables, A/P ageing (aging), who we owe, creditors, unpaid bills, bills due, a payment schedule or supplier balances.
---

# Accounts payable family (Q26)

Use when the user asks for aged payables, A/P ageing (aging), who we owe, creditors, unpaid bills, bills due, a payment schedule or supplier balances. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_aged_payables`, `get_report_aged_payable_detail`, `list_bill`, `get_report_balance_sheet`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › What you owe. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q26. Delivery: Wave 1.

## Discovery call

`get_report_aged_payables` (no params) — expect columns Supplier | Current | 1 - 30 | 31 - 60 | 61 - 90 | 91 and over | Total, one Data row per supplier and a GrandTotal summary.

## Date defaults

No date inputs: QuickBooks ages as of today.

## Members

| Member / view | How |
|---|---|
| A/P ageing summary | Report = A/P ageing summary |
| A/P ageing detail | Report = A/P ageing detail |
| Unpaid Bills | Report = Unpaid bills |
| Supplier Balance Summary | Report = Supplier balance summary |
| Bills and Applied Payments, Bill Payment List, Supplier Balance Detail | Wave 2 members |
| As-of date and ageing options | N/A — connector change requested (as for A/R) |

## Validation checks (STEP 4 — shown in the banner)

- Row total = Σ bands for every supplier
- Grand total = Σ suppliers (each band and total)
- Grand total = A/P on the balance sheet (today)
- Ageing detail open balance = summary total

## Save as

`fileName`: `quickbooks-aged-payables.html` · `tags`: ["quickbooks","payables","ageing","finance"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): A/P as of 10 Sep 2026: Total A$265,179.79 — current A$68,299.44 · 1-30 A$17,233.37 · 31-60 A$63,062.81 · 61-90 A$48,324.50 · 91+ A$68,259.67.
3. Compare the layout with the Q26 screenshots (row order, "Total for" rows, header block, footer, number format).
4. Validation banner: every check passes, or shows N/A with a stated reason.
5. Change every control in the control row, and confirm the report refetches and still validates. Switch View as to Client, then Bookkeeper.
6. Toggle Style to the mySMB house style and back, then switch the workspace to the dark theme.
7. Download PDF and Download Excel. Confirm they match the screen (the Excel file has Validation and Parameters sheets).
8. Use Download or Share from the report window, open the snapshot and confirm the period and figures are frozen and the controls that refetch are disabled.
9. Cross-client isolation (LIB-002): confirm that the saved report and every export carry only this company's figures and name.

## dataBindings

```json
{
  "inputs": [
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"summary\"}"
    }
  ],
  "bindings": [
    {
      "id": "aged_payables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_payables"
      },
      "params": {}
    },
    {
      "id": "aged_payable_detail",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_payable_detail"
      },
      "params": {}
    },
    {
      "id": "open_bills",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_bill"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Balance > '0'"
        },
        "orderBy": {
          "kind": "static",
          "value": "DueDate"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "bs_today",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
      },
      "params": {
        "end_date": {
          "kind": "context",
          "source": "now.date"
        },
        "accounting_method": {
          "kind": "static",
          "value": "Accrual"
        }
      }
    },
    {
      "id": "company_info",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "qbo_query"
      },
      "params": {
        "query": {
          "kind": "static",
          "value": "SELECT * FROM CompanyInfo"
        }
      }
    },
    {
      "id": "prefs",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_preferences"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
var P = { kind: 'AP', title: 'A/P Ageing Summary', family: 'Accounts payable', token: 'AP_AGING', party: 'Supplier', ageing: 'aged_payables', detail: 'aged_payable_detail', docs: 'open_bills', entity: 'Bill', ref: 'VendorRef', bsGroup: 'AP', bsRe: /^total accounts payable/i, who: 'Who you owe', verb: 'you owe',
  views: [['summary', 'A/P ageing summary'], ['detail', 'A/P ageing detail'], ['open', 'Unpaid bills'], ['balance', 'Supplier balance summary']] };
QB.app({
  title: P.title, token: P.token, route: 'reportv2', primary: P.ageing, company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Bookkeeper', display: '{"cents":1,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"summary"}' },
  uses: {},
  tools: P.kind === 'AR' ? { aged_receivables: 'get_report_aged_receivables', aged_receivable_detail: 'get_report_aged_receivable_detail', open_invoices: "list_invoice (Balance > '0')", bs_today: 'get_report_balance_sheet (today, for the A/R tie)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' }
    : { aged_payables: 'get_report_aged_payables', aged_payable_detail: 'get_report_aged_payable_detail', open_bills: "list_bill (Balance > '0')", bs_today: 'get_report_balance_sheet (today, for the A/P tie)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: P.views,
  render: function (c) {
    var body = c.body, rep = c.data[P.ageing];
    if (c.errors[P.ageing]) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err(P.ageing)) + '</p>'; return { checks: [{ name: P.title + ' loaded', pass: false, detail: c.err(P.ageing) }] }; }
    if (!rep) return {};
    var cols = QB.cols(rep), bandTitles = cols.slice(1, cols.length - 1).map(function (x) { return x.title; }), lines = QB.walk(rep);
    var parties = lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { var o = { name: l.label, id: l.id, total: l.values[l.values.length - 1] }; bandTitles.forEach(function (t, i) { o['b' + i] = l.values[i]; }); o.overdue = Math.round(((o.total || 0) - (o.b0 || 0)) * 100) / 100; return o; });
    var gt = QB.find(lines, 'GrandTotal', /^total$/i), grand = gt ? gt.values[gt.values.length - 1] : null, bandTot = gt ? gt.values.slice(0, bandTitles.length) : [];
    var hd = QB.header(rep), opt = (hd.Option || []).filter(function (o) { return o.Name === 'report_date'; })[0], reportDate = (opt && opt.Value) || hd.EndPeriod || c.today;
    var money = function (v) { return QB.money(v, c.currency, c.display); };
    var bandCols = bandTitles.map(function (t, i) { return { key: 'b' + i, title: t, money: true }; });
    var html = QB.kpis([{ label: 'Total ' + P.verb, value: grand }, { label: 'Current', value: bandTot[0] }, { label: 'Overdue', value: grand != null && bandTot[0] != null ? Math.round((grand - bandTot[0]) * 100) / 100 : null },
      { label: bandTitles[bandTitles.length - 1] || '91 and over', value: bandTot[bandTot.length - 1] }, { label: P.party + 's', money: false, value: parties.length }], c);
    html += '<div id="grid"></div><div class="qb-grid2 detail-block" style="margin-top:16px"><div class="qb-card"><h3>Ageing</h3><div id="ch1"></div></div><div class="qb-card"><h3>' + (P.kind === 'AR' ? 'Chase list' : 'Payment schedule') + '</h3><div id="ch2"></div></div></div>';
    body.innerHTML = html;
    var det = c.data[P.detail], detLines = det ? QB.walk(det) : [], dcols = det ? QB.cols(det) : [];
    var docs = ((c.data[P.docs] && c.data[P.docs].QueryResponse && c.data[P.docs].QueryResponse[P.entity]) || []).map(function (d) { return { num: d.DocNumber || d.Id, party: (d[P.ref] || {}).name || '', date: d.TxnDate, due: d.DueDate, amount: d.TotalAmt, balance: d.Balance, days: d.DueDate && d.DueDate < reportDate ? Math.round((QB.parse(reportDate) - QB.parse(d.DueDate)) / 86400000) : 0 }; });
    var g = document.getElementById('grid'), v = c.view;
    if (v === 'detail') {
      if (c.errors[P.detail]) g.innerHTML = '<p class="qb-err">' + QB.h(c.err(P.detail)) + '</p>';
      else { var dl = detLines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.kind === 'row' ? [l.raw[0], l.raw[1], l.raw[2], l.raw[3]].join(' · ') : l.label, values: [l.values[l.values.length - 2], l.values[l.values.length - 1]] }; });
        g.innerHTML = '<div class="qb-scroll">' + QB.statement(dl, ['Date · Type · Num · ' + P.party, 'Amount', 'Open Balance'], c) + '</div>'; }
    } else if (v === 'open' || v === 'collections') {
      var list = v === 'collections' ? docs.filter(function (d) { return d.days > 0; }).sort(function (a, b) { return b.days - a.days; }) : docs;
      QB.grid(g, { filter: true, empty: v === 'collections' ? 'Nothing overdue.' : "Data appears once it's available.", columns: [{ key: 'party', title: P.party }, { key: 'num', title: 'Num' }, { key: 'date', title: 'Date' }, { key: 'due', title: 'Due date' }, { key: 'days', title: 'Days past due', num: true }, { key: 'amount', title: 'Amount', money: true }, { key: 'balance', title: 'Open balance', money: true }],
        rows: list, total: { party: 'TOTAL', balance: QB.sum(list.map(function (d) { return d.balance; })) } }, c);
    } else if (v === 'balance') {
      QB.grid(g, { filter: true, columns: [{ key: 'name', title: P.party }, { key: 'total', title: 'Balance', money: true }], rows: parties, total: { name: 'TOTAL', total: grand } }, c);
    } else {
      QB.grid(g, { filter: true, columns: [{ key: 'name', title: P.party }].concat(bandCols, [{ key: 'total', title: 'Total', money: true }]), rows: parties, total: (function () { var t = { name: 'TOTAL', total: grand }; bandTot.forEach(function (x, i) { t['b' + i] = x; }); return t; })() }, c);
    }
    QB.donut(document.getElementById('ch1'), { title: 'Ageing bands', centre: QB.money(grand, c.currency, Object.assign({}, c.display, { cents: 0 })), items: bandTitles.map(function (t, i) { return { label: t, value: bandTot[i] }; }) }, c);
    if (P.kind === 'AR') {
      var top = parties.filter(function (p) { return p.overdue > 0; }).sort(function (a, b) { return b.overdue - a.overdue; }).slice(0, 8);
      if (top.length) QB.bars(document.getElementById('ch2'), { title: 'Chase list', labels: top.map(function (p) { return p.name.slice(0, 14); }), series: [{ name: 'Overdue', values: top.map(function (p) { return p.overdue; }) }] }, c);
      else document.getElementById('ch2').innerHTML = '<p class="muted">Nothing overdue — no one to chase.</p>';
    } else {
      var wk = {}; docs.forEach(function (d) { var k = !d.due || d.due < reportDate ? 'Overdue' : d.due <= QB.iso(QB.addDays(QB.parse(reportDate), 7)) ? 'Next 7 days' : d.due <= QB.iso(QB.addDays(QB.parse(reportDate), 30)) ? '8–30 days' : 'Later'; wk[k] = (wk[k] || 0) + d.balance; });
      var ks = ['Overdue', 'Next 7 days', '8–30 days', 'Later']; QB.bars(document.getElementById('ch2'), { title: 'Payment schedule', labels: ks, series: [{ name: 'Due', values: ks.map(function (k) { return wk[k] ? Math.round(wk[k] * 100) / 100 : 0; }) }] }, c);
    }
    var rowOk = parties.every(function (p) { return QB.near(p.total, QB.sum(bandTitles.map(function (t, i) { return p['b' + i]; }))); });
    var colOk = bandTot.every(function (t, i) { return QB.near(t, QB.sum(parties.map(function (p) { return p['b' + i]; }))); }) && QB.near(grand, QB.sum(parties.map(function (p) { return p.total; })));
    var bsl = c.data.bs_today ? QB.walk(c.data.bs_today) : [], bsVal = QB.val(QB.find(bsl, P.bsGroup, P.bsRe));
    var detTot = det ? QB.sum(detLines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return l.values[l.values.length - 1]; })) : null;
    var checks = [
      { name: 'Row total = Σ bands for every ' + P.party.toLowerCase(), pass: parties.length ? rowOk : null, detail: parties.length + ' ' + P.party.toLowerCase() + 's' },
      { name: 'Grand total = Σ ' + P.party.toLowerCase() + 's (each band and total)', pass: grand == null ? null : colOk, detail: money(grand) },
      { name: 'Grand total = ' + (P.kind === 'AR' ? 'A/R' : 'A/P') + ' on the balance sheet (today)', pass: grand == null || bsVal == null ? null : QB.near(grand, bsVal), detail: c.errors.bs_today ? c.err('bs_today') : 'Balance sheet ' + money(bsVal) },
      { name: 'Ageing detail open balance = summary total', pass: detTot == null || grand == null ? null : QB.near(detTot, grand), detail: c.errors[P.detail] ? c.err(P.detail) : money(detTot) }
    ];
    this._x = { parties: parties, bandTitles: bandTitles, bandTot: bandTot, grand: grand, docs: docs, reportDate: reportDate };
    var notes = [];
    if (reportDate !== c.today) notes.push('QuickBooks returned ageing as of ' + reportDate + '.');
    return { checks: checks, notes: notes, period: QB.asOfLine(reportDate),
      na: ['As-of date other than today, ageing method, days per ageing period, number of periods and minimum days past due (the connector does not yet pass report_date / aging_period / num_periods / aging_method / past_due)'].concat(P.kind === 'AR' ? ['Invoice List, Invoices and Received Payments, Statement List, Terms List, Unbilled charges and Unbilled time (Wave 2 members)'] : ['Bills and Applied Payments, Bill Payment List and Supplier Balance Detail (Wave 2 members)']),
      title: (P.views.filter(function (x) { return x[0] === c.view; })[0] || P.views[0])[1].replace(/^./, function (s) { return s.toUpperCase(); }) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var head = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: P.title, s: 'bold' }], [QB.asOfLine(x.reportDate)], [], [{ v: P.party, s: 'bold' }].concat(x.bandTitles.map(function (t) { return { v: t, s: 'bold' }; }), [{ v: 'Total', s: 'bold' }])];
    var rows = head.concat(x.parties.map(function (p) { return [p.name].concat(x.bandTitles.map(function (t, i) { return p['b' + i] == null ? null : { v: p['b' + i], s: 'money' }; }), [{ v: p.total, s: 'money' }]); }));
    var n = x.parties.length, L = function (i) { return String.fromCharCode(66 + i); };
    rows.push([{ v: 'TOTAL', s: 'bold' }].concat(x.bandTitles.map(function (t, i) { return { f: 'SUM(' + L(i) + '6:' + L(i) + (5 + n) + ')', s: 'moneyBold' }; }), [{ f: 'SUM(' + L(x.bandTitles.length) + '6:' + L(x.bandTitles.length) + (5 + n) + ')', s: 'moneyBold' }]));
    var docs = [[{ v: P.party, s: 'bold' }, { v: 'Num', s: 'bold' }, { v: 'Date', s: 'bold' }, { v: 'Due date', s: 'bold' }, { v: 'Days past due', s: 'bold' }, { v: 'Amount', s: 'bold' }, { v: 'Open balance', s: 'bold' }]].concat(x.docs.map(function (d) { return [d.party, d.num, d.date, d.due, d.days, { v: d.amount, s: 'money' }, { v: d.balance, s: 'money' }]; }));
    return [{ name: P.kind === 'AR' ? 'AR Ageing Summary' : 'AP Ageing Summary', rows: rows, widths: [40].concat(x.bandTitles.map(function () { return 16; }), [16]) }, { name: P.kind === 'AR' ? 'Open invoices' : 'Unpaid bills', rows: docs, widths: [36, 12, 12, 12, 14, 16, 16] }];
  }
});
```

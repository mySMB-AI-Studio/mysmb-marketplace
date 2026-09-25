---
name: quickbooks-exchange-gains-losses
description: QuickBooks Online Exchange gains and losses (multi-currency) (Q36) as a live, validated report in QuickBooks styling. Use when the user asks for exchange gains or losses, FX gains, realised or unrealised currency gains, or foreign-currency exposure on open bills and invoices.
---

# Exchange gains and losses (multi-currency) (Q36)

Use when the user asks for exchange gains or losses, FX gains, realised or unrealised currency gains, or foreign-currency exposure on open bills and invoices. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `list_bill`, `list_invoice`, `list_exchange_rate`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports › Business overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q36. Delivery: Wave 3 (Train 06).

## Discovery call

`get_report_profit_and_loss` (look for an 'Exchange Gain or Loss' account), `list_bill` / `list_invoice` (Balance > '0') with CurrencyRef and ExchangeRate, `list_exchange_rate`; `get_preferences` CurrencyPrefs.MultiCurrencyEnabled.

## Date defaults

Preset `this_fy_td` for realised gains; unrealised is as of today.

## Members

| Member / view | How |
|---|---|
| Realised Exchange Gains & Losses | Report = Realised — from the exchange gain/loss account on the Profit and Loss |
| Unrealised Exchange Gains & Losses | Report = Unrealised (estimate) — open foreign-currency documents revalued at current rates |
| Realised by transaction and currency | N/A — QuickBooks' realised report is not in the Accounting API |

## Validation checks (STEP 4 — shown in the banner)

- Unrealised by currency sums to the total
- Every open foreign-currency document has a current rate
- Realised = FX accounts on the Profit and Loss (information)

## Save as

`fileName`: `quickbooks-exchange-gains-losses.html` · `tags`: ["quickbooks","multicurrency","fx"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): A/P in USD / EUR / GBP / PHP / PLN exists in the sample company — compare the unrealised estimate with QuickBooks' Unrealised Gains & Losses report.
3. Compare the layout with the Q36 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "start_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "end_date",
      "label": "To",
      "type": "date",
      "default": "today"
    },
    {
      "name": "basis",
      "label": "Accounting method",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"realised\",\"x\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "pnl",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_profit_and_loss"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "start_date"
        },
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        }
      }
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
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "open_invoices",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_invoice"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Balance > '0'"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "exchange_rates",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_exchange_rate"
      },
      "params": {
        "maxResults": {
          "kind": "static",
          "value": 200
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
      { name: 'Realised gains / losses = FX accounts on the Profit and Loss (information — taken from those accounts)', pass: null, detail: fxLines.length ? fxLines.map(function (l) { return l.label; }).join(', ') + ': ' + money(realised) : 'No FX account in the period' },
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
```

---
name: quickbooks-cash-flow-overview
description: QuickBooks Online Cash flow overview (Q07) as a live, validated report in QuickBooks styling. Use when the user asks for the cash flow overview, cash position today, money in and money out this month, overdue invoices and bills, or a cash projection.
---

# Cash flow overview (Q07)

Use when the user asks for the cash flow overview, cash position today, money in and money out this month, overdue invoices and bills, or a cash projection. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`list_account`, `get_report_cash_flow`, `list_invoice`, `list_bill`, `list_payment`, `list_bill_payment`, `list_purchase`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Financial planning › Cash flow overview. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q07. Delivery: Wave 1.

## Discovery call

`list_account` (Bank, Credit Card), `get_report_cash_flow` by Month, `list_invoice` / `list_bill` with Balance > '0'.

## Date defaults

No manual dates: the chart window (12 months to today) is set on every open.

## Members

| Member / view | How |
|---|---|
| Today's cash balance (all / bank / credit cards) | Built — All accounts = bank less credit card balances (stated on the tile) |
| Cash balance chart / Money in/out | Report = Cash balance | Money in/out |
| Monthly outlook — Money in / Money out, Upcoming | Paid | Built |
| 30-day projection | Cash + invoices due − bills due within 30 days |
| Bank-feed balances, Link another account | N/A — bank feeds are not in the Accounting API |

## Validation checks (STEP 4 — shown in the banner)

- All accounts = bank accounts − credit card balances
- Upcoming + paid = month totals (information)
- Cash balance chart ends at the bank balance in QuickBooks
- All data sources loaded

## Save as

`fileName`: `quickbooks-cash-flow-overview.html` · `tags`: ["quickbooks","cash","dashboard"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Today's cash balance A$145,321 · overdue bills 30 (−A$182,705) · open invoices 1 (A$39,105).
3. Compare the layout with the Q07 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "name": "cf_start",
      "label": "Chart from",
      "type": "date",
      "default": "2025-10-01"
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
      "default": "Client"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"balance\",\"x\":\"upcoming\"}"
    }
  ],
  "bindings": [
    {
      "id": "cash_accounts",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_account"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "AccountType IN ('Bank', 'Credit Card') AND Active = true"
        },
        "maxResults": {
          "kind": "static",
          "value": 200
        }
      }
    },
    {
      "id": "cash_flow_12m",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_cash_flow"
      },
      "params": {
        "start_date": {
          "kind": "input",
          "input": "cf_start"
        },
        "end_date": {
          "kind": "context",
          "source": "now.date"
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Month"
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
      "id": "payments_received",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_payment"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "bill_payments",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_bill_payment"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
        }
      }
    },
    {
      "id": "expenses_paid",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "list_purchase"
      },
      "params": {
        "orderBy": {
          "kind": "static",
          "value": "TxnDate DESC"
        },
        "maxResults": {
          "kind": "static",
          "value": 1000
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
  title: 'Cash flow overview', token: null, primary: 'cash_flow_12m', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { cf_start: '2025-10-01', persona: 'Client', display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"balance","x":"upcoming"}' },
  uses: { cash_flow_12m: ['cf_start'], cash_accounts: [], open_invoices: [], open_bills: [], payments_received: [], bill_payments: [], expenses_paid: [], company_info: [], prefs: [] },
  tools: { cash_accounts: 'list_account (Bank, Credit Card)', cash_flow_12m: 'get_report_cash_flow (12 months by month)', open_invoices: "list_invoice (Balance > '0')", open_bills: "list_bill (Balance > '0')", payments_received: 'list_payment (latest 1,000)', bill_payments: 'list_bill_payment (latest 1,000)', expenses_paid: 'list_purchase (latest 1,000)', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['balance', 'Cash balance'], ['inout', 'Money in/out']],
  roll: function () { var t = QB.preset('today', 7).end, y = +t.slice(0, 4), m = +t.slice(5, 7); return { cf_start: new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10) }; },
  render: function (c) {
    var body = c.body, d = c.display, money = function (v) { return QB.money(v, c.currency, d); }, today = c.today, mStart = today.slice(0, 8) + '01', mEnd = QB.preset('this_month', c.fy.month, today).end;
    var q = function (id, ent) { return (c.data[id] && c.data[id].QueryResponse && c.data[id].QueryResponse[ent]) || []; };
    var accts = q('cash_accounts', 'Account'), bank = accts.filter(function (a) { return a.AccountType === 'Bank'; }), cards = accts.filter(function (a) { return a.AccountType === 'Credit Card'; });
    var bankTot = QB.sum(bank.map(function (a) { return a.CurrentBalance; })), cardTot = QB.sum(cards.map(function (a) { return a.CurrentBalance; })), all = Math.round((bankTot - cardTot) * 100) / 100;
    var inv = q('open_invoices', 'Invoice'), bills = q('open_bills', 'Bill');
    var inMonth = function (t) { return t >= mStart && t <= mEnd; };
    var odInv = inv.filter(function (x) { return x.DueDate && x.DueDate < today; }), odBill = bills.filter(function (x) { return x.DueDate && x.DueDate < today; });
    var upIn = QB.sum(inv.filter(function (x) { return x.DueDate >= today && x.DueDate <= mEnd; }).map(function (x) { return x.Balance; })), paidIn = QB.sum(q('payments_received', 'Payment').filter(function (x) { return inMonth(x.TxnDate); }).map(function (x) { return x.TotalAmt; }));
    var upOut = QB.sum(bills.filter(function (x) { return x.DueDate >= today && x.DueDate <= mEnd; }).map(function (x) { return x.Balance; }));
    var paidOut = QB.sum(q('bill_payments', 'BillPayment').filter(function (x) { return inMonth(x.TxnDate); }).map(function (x) { return x.TotalAmt; })) + QB.sum(q('expenses_paid', 'Purchase').filter(function (x) { return inMonth(x.TxnDate); }).map(function (x) { return x.TotalAmt; }));
    paidOut = Math.round(paidOut * 100) / 100;
    var cf = c.data.cash_flow_12m, cfc = cf ? QB.cols(cf) : [], cfL = cf ? QB.walk(cf) : [], endL = QB.find(cfL, 'EndingCash', /^cash at end of period$/i), incL = QB.find(cfL, 'CashIncrease');
    var months = cfc.slice(1).filter(function (x) { return !/^total$/i.test(x.title); }), idx = months.map(function (x) { return x.i - 1; });
    var due30 = QB.iso(QB.addDays(QB.parse(today), 30));
    var proj = Math.round((bankTot + QB.sum(inv.filter(function (x) { return x.DueDate <= due30; }).map(function (x) { return x.Balance; })) - QB.sum(bills.filter(function (x) { return x.DueDate <= due30; }).map(function (x) { return x.Balance; }))) * 100) / 100;
    var tab = d.x === 'paid' ? 'paid' : 'upcoming';
    body.innerHTML = QB.kpis([{ label: 'All accounts', value: all, sub: 'Bank accounts less credit card balances' }, { label: 'Bank accounts', value: bankTot }, { label: 'Credit cards', value: cardTot }, { label: '30-day projection', value: proj, sub: 'Cash + invoices due − bills due (30 days)' }], c) +
      '<div class="qb-card"><h3>' + (c.view === 'inout' ? 'Money in/out' : 'Cash balance') + ' <span class="muted">· last 12 months</span></h3><div id="ch1"></div></div>' +
      '<div class="qb-card"><h3>This month <select id="w-tab" aria-label="Upcoming or paid">' + [['upcoming', 'Upcoming'], ['paid', 'Paid']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === tab ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></h3>' +
      '<div class="qb-grid2"><div>' + QB.kpis([{ label: 'Money in this month', value: Math.round((upIn + paidIn) * 100) / 100, sub: 'Upcoming ' + money(upIn) + ' / Paid ' + money(paidIn) }, { label: tab === 'paid' ? 'Paid in' : 'Upcoming in', value: tab === 'paid' ? paidIn : upIn }, { label: 'Overdue invoices', text: odInv.length + ' / ' + money(QB.sum(odInv.map(function (x) { return x.Balance; }))) }, { label: 'Open invoices', text: inv.length + ' / ' + money(QB.sum(inv.map(function (x) { return x.Balance; }))) }], c) + '</div>' +
      '<div>' + QB.kpis([{ label: 'Money out this month', value: -Math.round((upOut + paidOut) * 100) / 100, sub: 'Upcoming ' + money(-upOut) + ' / Paid ' + money(-paidOut) }, { label: tab === 'paid' ? 'Paid out' : 'Upcoming out', value: -(tab === 'paid' ? paidOut : upOut) }, { label: 'Overdue bills', text: odBill.length + ' / ' + money(-QB.sum(odBill.map(function (x) { return x.Balance; }))) }, { label: 'Open bills', text: bills.length + ' / ' + money(-QB.sum(bills.map(function (x) { return x.Balance; }))) }], c) + '</div></div></div>' +
      '<div class="qb-card detail-block"><h3>Bank and credit card accounts</h3><div id="g1"></div></div>' +
      ['cash_accounts', 'open_invoices', 'open_bills', 'payments_received', 'bill_payments', 'expenses_paid'].filter(function (id) { return c.errors[id]; }).map(function (id) { return '<p class="qb-err">' + QB.h(id.replace(/_/g, ' ') + ': ' + c.err(id)) + '</p>'; }).join('');
    if (c.errors.cash_flow_12m) document.getElementById('ch1').innerHTML = '<p class="qb-err">' + QB.h(c.err('cash_flow_12m')) + '</p>';
    else if (c.view === 'inout') QB.bars(document.getElementById('ch1'), { title: 'Net money in/out by month', labels: months.map(function (x) { return x.title; }), series: [{ name: 'Net money in/out', values: idx.map(function (i) { return incL ? incL.values[i] : null; }) }] }, c);
    else QB.line(document.getElementById('ch1'), { title: 'Cash balance', area: true, labels: months.map(function (x) { return x.title; }).concat(['+30 days']), series: [{ name: 'Cash balance', values: idx.map(function (i) { return endL ? endL.values[i] : null; }).concat([null]) }, { name: 'Projection', values: idx.map(function (i, k) { return k === idx.length - 1 && endL ? endL.values[i] : null; }).concat([proj]) }] }, c);
    var t = document.getElementById('w-tab'); if (t) t.addEventListener('change', function () { c.change({}, { x: this.value }); });
    QB.grid(document.getElementById('g1'), { columns: [{ key: 'n', title: 'Account' }, { key: 't', title: 'Type' }, { key: 'b', title: 'In QuickBooks', money: true }], rows: accts.map(function (a) { return { n: a.Name, t: a.AccountType, b: a.CurrentBalance }; }) }, c);
    var cfEnd = endL ? endL.values[endL.values.length - 1] : null, errs = ['cash_accounts', 'open_invoices', 'open_bills', 'payments_received', 'bill_payments', 'expenses_paid'].filter(function (id) { return c.errors[id]; });
    var checks = [
      { name: 'All accounts = bank accounts − credit card balances', pass: accts.length ? QB.near(all, bankTot - cardTot) : null, detail: money(bankTot) + ' − ' + money(cardTot) },
      { name: 'Upcoming + paid = month totals (information — the totals are built from the same documents)', pass: null, detail: 'In ' + money(upIn + paidIn) + ', out ' + money(-(upOut + paidOut)) },
      { name: 'Cash balance chart ends at the bank balance in QuickBooks', pass: cfEnd == null || !bank.length ? null : QB.near(cfEnd, bankTot, 1), detail: money(cfEnd) + ' vs ' + money(bankTot) },
      { name: 'All data sources loaded', pass: errs.length ? false : true, detail: errs.length ? errs.map(function (id) { return id + ': ' + c.err(id); }).join('; ') : '' }];
    this._x = { accts: accts, months: months, idx: idx, endL: endL, incL: incL, upIn: upIn, paidIn: paidIn, upOut: upOut, paidOut: paidOut, inv: inv, bills: bills };
    return { checks: checks, period: QB.asOfLine(today), notes: ['Paid this month uses the latest 1,000 payments, bill payments and expenses; older activity is not needed for this month.'],
      na: ['Bank-feed balances and "Link another account" (bank feeds are not exposed by the Accounting API)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    return [{ name: 'Cash flow overview', widths: [32, 18, 18], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Cash flow overview', s: 'bold' }], [QB.asOfLine(c.today)], [],
      [{ v: 'This month', s: 'bold' }, { v: 'Upcoming', s: 'bold' }, { v: 'Paid', s: 'bold' }], ['Money in', { v: x.upIn, s: 'money' }, { v: x.paidIn, s: 'money' }], ['Money out', { v: -x.upOut, s: 'money' }, { v: -x.paidOut, s: 'money' }], [],
      [{ v: 'Month', s: 'bold' }, { v: 'Cash balance', s: 'bold' }, { v: 'Net money in/out', s: 'bold' }]].concat(x.months.map(function (m, i) { return [m.title, x.endL ? { v: x.endL.values[x.idx[i]], s: 'money' } : null, x.incL ? { v: x.incL.values[x.idx[i]], s: 'money' } : null]; })) },
      { name: 'Open invoices and bills', widths: [12, 36, 12, 16], rows: [[{ v: 'Type', s: 'bold' }, { v: 'Name', s: 'bold' }, { v: 'Due', s: 'bold' }, { v: 'Balance', s: 'bold' }]].concat(x.inv.map(function (i) { return ['Invoice', (i.CustomerRef || {}).name, i.DueDate, { v: i.Balance, s: 'money' }]; }), x.bills.map(function (b) { return ['Bill', (b.VendorRef || {}).name, b.DueDate, { v: -b.Balance, s: 'money' }]; })) }];
  }
});
```

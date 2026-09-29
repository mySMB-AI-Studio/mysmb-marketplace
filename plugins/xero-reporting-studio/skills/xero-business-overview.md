---
name: xero-business-overview
description: Build a live Xero business overview dashboard on the tested report kit — bank balances, invoices owed, bills to pay, recent payments and YTD profit, with an organisation picker. Use for "business overview", "dashboard", "how is the business going", "snapshot of the business".
---
# Business Overview

Use when the user asks for a business overview, dashboard, snapshot of the business, or "how are we doing". Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_bank_summary`, `list_invoices`, `list_payments`, `get_profit_and_loss`, `get_organisation`, `list_connections`).

Xero location: no single Xero screen — this composes Reporting → Cash Summary, Invoices, Bills and Profit and Loss into one dashboard. Delivery: Wave 1 dashboard.

There is no single "cash position" tool, no all-contacts ageing tool, and no task-list or account-watchlist data source anywhere on this connector (`get_organisation_actions`, where it exists, is feature-flag config, not a task list) — this dashboard does not show tasks or an account watchlist. Bank-feed statement balances have no endpoint; the bank figures here are Xero's own Bank Summary report, not the live bank feed.

## Discovery call

Call `get_organisation` once, `list_connections` once, and once each with default inputs: `get_bank_summary` (`fromDate` = financial-year start, `toDate` = today), `list_invoices` with `where: Type=="ACCREC"`, `statuses: AUTHORISED` (invoices owed), `list_invoices` with `where: Type=="ACCPAY"`, `statuses: AUTHORISED` (bills to pay), `list_payments` with `where: PaymentType=="ACCRECPAYMENT"`, and `get_profit_and_loss` for the same period, `standardLayout: true`. An error on any call is a failed section: report its message, keep the others rendering.

`get_bank_summary`'s exact column layout (Opening balance / Cash received / Cash spent / Closing balance, in that order) has not been live-verified against this connector — the report reads column headings by label instead of position and shows N/A for any figure it cannot identify, per Sources & limitations.

## Date defaults

`from_date` = start of the period asked for (default: the financial-year start from `get_organisation`, e.g. `2026-07-01`); `to_date` = end of the period (default `"today"`). This period drives both the bank cash-in/cash-out figures and the YTD Profit and Loss KPIs — there is no separate comparison period on this dashboard.

## Members

| Member / view | How |
|---|---|
| Business overview | The one dashboard view (no report switcher) |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Period | From / To dates (drives bank cash in/out and the profit KPI) |
| Tasks, account watchlist | N/A in this version — no data source; say so, do not invent one |

## Validation checks (shown in the banner)

- Invoices owed total = Σ the invoices actually shown
- Bills to pay total = Σ the bills actually shown
- Overdue receivables is a subset of invoices owed (count and $ both ≤ the total)
- Overdue payables is a subset of bills to pay (count and $ both ≤ the total)
- Closing bank balance = Opening balance + Cash in − Cash out (when Xero's column headings could be identified)
- Net Profit = Income − Expenses (recomputed from the same Profit and Loss call)

## Save as

`fileName`: `xero-business-overview.html` · `tags`: ["xero","business-overview","dashboard"]

## QA test script (no live access — follow this before shipping)

This report has not been exercised against a live Xero organisation. Before treating it as done:

1. Open it against a connected sandbox or golden-set organisation and confirm the discovery call succeeds (five sections render, none stuck on the loading skeleton).
2. Inspect `get_bank_summary`'s actual `Reports[0].Rows` shape in a debugger or logged response. Confirm the column headings contain recognisable text for Opening balance / Cash received / Cash spent / Closing balance (the report matches on `/open/i`, `/received|in\b/i`, `/spent|out\b/i`, `/clos/i`). If Xero's real headings don't match, fix the regexes in the Report config below — do not guess further blind.
3. Confirm `list_invoices`, `list_payments` return the field names this report assumes (`Invoices[]` / `Payments[]` wrapper keys, `Contact.Name`, `AmountDue`, `DueDateString`, and for payments `Invoice.Contact.Name`, `Invoice.InvoiceNumber`, `Amount`, `Date`) — these are standard Xero Accounting API fields but were not called live while writing this skill.
4. Check every validation line passes (or shows a stated reason) against the same organisation's figures in Xero.
5. Change the period, switch organisation (if more than one is connected), switch View as, toggle Branding and the dark theme, then Download PDF and Download Excel and confirm they match the screen.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "from_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "2026-09-29"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "bank",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "from_date"
        },
        "toDate": {
          "kind": "input",
          "input": "to_date"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "invoices_owed",
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
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bills_to_pay",
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
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "recent_payments",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_payments"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "PaymentType==\"ACCRECPAYMENT\""
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_ytd",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "from_date"
        },
        "toDate": {
          "kind": "input",
          "input": "to_date"
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
XK.app({
  title: 'Business Overview', primary: 'pnl_ytd', dated: ['pnl_ytd', 'bank'], org: 'org', conns: 'connections',
  inputs: { start: 'from_date', end: 'to_date', org: 'org', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-29', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}' },
  uses: { bank: ['from_date', 'to_date', 'org'], invoices_owed: ['org'], bills_to_pay: ['org'], recent_payments: ['org'], pnl_ytd: ['from_date', 'to_date', 'org'], org: ['org'], connections: [] },
  tools: { bank: 'get_bank_summary', invoices_owed: 'list_invoices (Type==ACCREC, AUTHORISED)', bills_to_pay: 'list_invoices (Type==ACCPAY, AUTHORISED)', recent_payments: 'list_payments (ACCRECPAYMENT)', pnl_ytd: 'get_profit_and_loss', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, today = c.today;
    if (!c.data.pnl_ytd && !c.data.bank && !c.data.invoices_owed && !c.errors.pnl_ytd && !c.errors.bank && !c.errors.invoices_owed) return {};
    function rowsOf(v, key) { return v && !XK.errorOf(v) && Array.isArray(v[key]) ? v[key] : []; }

    // ---- Bank Summary: match columns by heading text, never by position (shape not live-verified) ----
    var bankW = c.data.bank ? XK.walk(c.data.bank) : null, bankCols = bankW ? bankW.columns : [];
    var idx = function (re) { for (var i = 0; i < bankCols.length; i++) if (re.test(bankCols[i] || '')) return i; return -1; };
    var iOpen = idx(/open/i), iIn = idx(/received|cash in/i), iOut = idx(/spent|cash out/i), iClose = idx(/clos/i);
    var bankLines = bankW ? bankW.lines.filter(function (l) { return l.label; }) : [];
    var bankTotalLine = bankLines.filter(function (l) { return /^total/i.test(l.label); })[0] || null;
    var bankAccts = bankLines.filter(function (l) { return !/^total/i.test(l.label); });
    var pick = function (i) { if (i < 0) return null; if (bankTotalLine) return bankTotalLine.values[i]; return bankAccts.length ? XK.sum(bankAccts.map(function (l) { return l.values[i]; })) : null; };
    var openTotal = pick(iOpen), cashIn = pick(iIn), cashOut = pick(iOut), closeTotal = pick(iClose);

    // ---- Invoices owed / Bills to pay / Recent payments ----
    var invRows = rowsOf(c.data.invoices_owed, 'Invoices'), billRows = rowsOf(c.data.bills_to_pay, 'Invoices'), payRows = rowsOf(c.data.recent_payments, 'Payments');
    var isOverdue = function (r) { var d = String(r.DueDateString || '').slice(0, 10); return !!d && d < today; };
    var invOverdue = invRows.filter(isOverdue), billOverdue = billRows.filter(isOverdue);
    var invTotal = XK.sum(invRows.map(function (r) { return XK.num(r.AmountDue); })), invOverdueTotal = XK.sum(invOverdue.map(function (r) { return XK.num(r.AmountDue); }));
    var billTotal = XK.sum(billRows.map(function (r) { return XK.num(r.AmountDue); })), billOverdueTotal = XK.sum(billOverdue.map(function (r) { return XK.num(r.AmountDue); }));

    // ---- Profit and Loss for the same period ----
    var plW = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null;
    var sec = function (re) { return plW ? XK.sectionBy(plW, re) : null; }, findTot = function (re) { var l = plW ? XK.find(plW.lines, null, re, 'total') : null; return l ? XK.val(l) : null; };
    var inc = sec(/^(trading )?income$|^revenue$|^sales$/i), cos = sec(/cost of sales/i), oi = sec(/^other income$/i), opex = sec(/operating expenses|^(less )?expenses$/i), oe = sec(/other expenses/i);
    var np = findTot(/^net (profit|loss)$/i);
    var netCalc = (inc == null && opex == null) ? null : Math.round(((inc || 0) + (oi || 0) - (cos || 0) - (opex || 0) - (oe || 0)) * 100) / 100;

    // ---- Body ----
    body.innerHTML =
      XK.kpis([
        { label: 'Total bank balance', value: closeTotal },
        { label: 'Invoices owed', value: invTotal, sub: invRows.length + ' invoice' + (invRows.length === 1 ? '' : 's') },
        { label: 'Overdue receivables', value: invOverdueTotal, sub: invOverdue.length + ' overdue' },
        { label: 'Bills to pay', value: billTotal, sub: billRows.length + ' bill' + (billRows.length === 1 ? '' : 's') },
        { label: 'Overdue payables', value: billOverdueTotal, sub: billOverdue.length + ' overdue' },
        { label: 'Net profit (period)', value: np }
      ], c) +
      '<div class="xk-grid2" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Bank accounts</h3><div id="xk-bank"></div></div>' +
      '<div class="xk-card"><h3>Cash in / cash out — ' + XK.h(XK.rangeLabel(c.inputs.from_date, c.inputs.to_date)) + '</h3><div id="xk-cash"></div></div>' +
      '</div>' +
      '<div class="xk-grid2 detail-block" style="margin-top:16px">' +
      '<div class="xk-card"><h3>Invoices owed</h3><div id="xk-inv"></div></div>' +
      '<div class="xk-card"><h3>Bills to pay</h3><div id="xk-bill"></div></div>' +
      '</div>' +
      '<div class="xk-card detail-block" style="margin-top:16px"><h3>Recent invoice payments</h3><div id="xk-pay"></div></div>';

    XK.grid(document.getElementById('xk-bank'), {
      columns: [{ key: 'label', title: 'Account' }].concat(bankCols.slice(1).map(function (t, i) { return { key: 'v' + i, title: t || ('Value ' + (i + 1)), num: true, money: true }; })),
      rows: bankAccts.map(function (l) { var r = { label: l.label }; (l.values || []).forEach(function (v, i) { r['v' + i] = v; }); return r; }),
      empty: c.errors.bank ? c.err('bank') : "Data appears once it's available."
    }, c);
    if (cashIn != null || cashOut != null) XK.bars(document.getElementById('xk-cash'), { title: 'Cash in vs cash out', labels: ['Cash in', 'Cash out'], series: [{ name: XK.rangeLabel(c.inputs.from_date, c.inputs.to_date), values: [cashIn, cashOut] }] }, c);
    else document.getElementById('xk-cash').innerHTML = '<p class="muted">N/A — not in source: Xero’s Bank Summary column headings for this organisation did not match the expected labels.</p>';

    function invCols(kind) { return [{ key: 'num', title: 'Invoice #' }, { key: 'contact', title: kind === 'bill' ? 'Supplier' : 'Customer' }, { key: 'due', title: 'Due date' }, { key: 'flag', title: 'Status', html: true }, { key: 'amt', title: 'Amount due', money: true }]; }
    function invRow(r) {
      var due = String(r.DueDateString || '').slice(0, 10), overdue = !!due && due < today;
      return { num: r.InvoiceNumber || '(no number)', contact: (r.Contact && r.Contact.Name) || 'N/A — not in source', due: due || 'N/A', flag: overdue ? '<span class="chip down">Overdue</span>' : '<span class="chip up">Awaiting payment</span>', amt: XK.num(r.AmountDue) };
    }
    XK.grid(document.getElementById('xk-inv'), { columns: invCols('inv'), rows: invRows.map(invRow), filter: true, total: { num: '', contact: 'Total (' + invRows.length + ')', due: '', flag: '', amt: invTotal }, empty: c.errors.invoices_owed ? c.err('invoices_owed') : 'No open sales invoices.' }, c);
    XK.grid(document.getElementById('xk-bill'), { columns: invCols('bill'), rows: billRows.map(invRow), filter: true, total: { num: '', contact: 'Total (' + billRows.length + ')', due: '', flag: '', amt: billTotal }, empty: c.errors.bills_to_pay ? c.err('bills_to_pay') : 'No open bills.' }, c);
    XK.grid(document.getElementById('xk-pay'), {
      columns: [{ key: 'date', title: 'Date' }, { key: 'contact', title: 'Customer' }, { key: 'num', title: 'Invoice #' }, { key: 'amt', title: 'Amount', money: true }],
      rows: payRows.slice(0, 25).map(function (p) { var inv = p.Invoice || {}; return { date: XK.isoDate(p.Date), contact: (inv.Contact && inv.Contact.Name) || 'N/A — not in source', num: inv.InvoiceNumber || '', amt: XK.num(p.Amount) }; }),
      filter: true, empty: c.errors.recent_payments ? c.err('recent_payments') : 'No recent payments.'
    }, c);

    // ---- Checks. KPI figures are re-summed from the same rows the grids show, so a check failing here is a rendering
    // bug, not a Xero discrepancy. The bank tie is independent of the grids: Closing = Opening + Cash in − Cash out. ----
    var checks = [
      { name: 'Invoices owed total = Σ invoices shown', pass: c.errors.invoices_owed ? false : true, detail: c.errors.invoices_owed ? c.err('invoices_owed') : money(invTotal) + ' across ' + invRows.length + ' invoice' + (invRows.length === 1 ? '' : 's') },
      { name: 'Bills to pay total = Σ bills shown', pass: c.errors.bills_to_pay ? false : true, detail: c.errors.bills_to_pay ? c.err('bills_to_pay') : money(billTotal) + ' across ' + billRows.length + ' bill' + (billRows.length === 1 ? '' : 's') },
      { name: 'Overdue receivables is a subset of invoices owed', pass: c.errors.invoices_owed ? null : invOverdue.length <= invRows.length && invOverdueTotal <= invTotal + 0.01, detail: invOverdue.length + ' of ' + invRows.length + ' invoices, ' + money(invOverdueTotal) + ' of ' + money(invTotal) },
      { name: 'Overdue payables is a subset of bills to pay', pass: c.errors.bills_to_pay ? null : billOverdue.length <= billRows.length && billOverdueTotal <= billTotal + 0.01, detail: billOverdue.length + ' of ' + billRows.length + ' bills, ' + money(billOverdueTotal) + ' of ' + money(billTotal) },
      (openTotal == null || cashIn == null || cashOut == null || closeTotal == null)
        ? { name: 'Closing balance = Opening + Cash in − Cash out (information)', pass: null, info: true, detail: 'Xero’s Bank Summary column headings could not be matched for this organisation' }
        : { name: 'Closing balance = Opening + Cash in − Cash out', pass: XK.near(closeTotal, Math.round((openTotal + cashIn - cashOut) * 100) / 100), detail: money(closeTotal) + ' = ' + money(openTotal) + ' + ' + money(cashIn) + ' − ' + money(cashOut) },
      np == null ? { name: 'Net Profit = Income − Expenses (information)', pass: null, info: true, detail: 'No Net Profit line returned for this period' } : { name: 'Net Profit = Income − Expenses', pass: XK.near(np, netCalc), detail: money(np) + ' vs ' + money(netCalc) }
    ];
    var notes = [];
    if (invRows.length === 100 || billRows.length === 100 || payRows.length === 100) notes.push('One or more lists returned exactly 100 rows (Xero’s page size) — only the first page was fetched, so totals may be incomplete for a very large ledger.');
    var na = ['Bank-feed statement balances (no endpoint on this connector — bank figures are Xero’s own Bank Summary report)', 'Tasks and an account watchlist (no task-list or watchlist data source on this connector)'];
    if (iClose < 0) na.push('Cash in / cash out / opening / closing balance — Xero’s Bank Summary column headings did not match the expected labels for this organisation');
    this._bank = { cols: bankCols, rows: bankAccts }; this._inv = invRows; this._bill = billRows; this._pay = payRows; this._pl = { inc: inc, cos: cos, oi: oi, opex: opex, oe: oe, np: np };
    return { checks: checks, notes: notes, na: na, title: 'Business Overview' };
  },
  excel: function (c) {
    var bank = this._bank || { cols: [], rows: [] }, inv = this._inv || [], bill = this._bill || [], pay = this._pay || [], pl = this._pl || {};
    var invRow = function (r) { var due = String(r.DueDateString || '').slice(0, 10); return [r.InvoiceNumber || '', (r.Contact && r.Contact.Name) || '', due, (due && due < c.today) ? 'Overdue' : 'Awaiting payment', XK.num(r.AmountDue)]; };
    return [
      { name: 'Bank accounts', rows: [['Account'].concat(bank.cols.slice(1))].concat(bank.rows.map(function (l) { return [l.label].concat(l.values || []); })), widths: [30] },
      { name: 'Invoices owed', rows: [['Invoice #', 'Customer', 'Due date', 'Status', 'Amount due']].concat(inv.map(invRow)), widths: [16, 30, 12, 16, 14] },
      { name: 'Bills to pay', rows: [['Bill #', 'Supplier', 'Due date', 'Status', 'Amount due']].concat(bill.map(invRow)), widths: [16, 30, 12, 16, 14] },
      { name: 'Recent payments', rows: [['Date', 'Customer', 'Invoice #', 'Amount']].concat(pay.map(function (p) { var inv2 = p.Invoice || {}; return [XK.isoDate(p.Date), (inv2.Contact && inv2.Contact.Name) || '', inv2.InvoiceNumber || '', XK.num(p.Amount)]; })), widths: [12, 30, 16, 14] },
      { name: 'Profit and Loss (period)', rows: [['Income', pl.inc], ['Cost of Sales', pl.cos], ['Other Income', pl.oi], ['Operating Expenses', pl.opex], ['Other Expenses', pl.oe], ['Net Profit', pl.np]], widths: [24, 16] }
    ];
  }
});
```

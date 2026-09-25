---
name: quickbooks-reports-catalogue
description: QuickBooks Online Reports catalogue (Q02) as a live, validated report in QuickBooks styling. Use when the user asks what QuickBooks reports are available, for the reports list or catalogue, which reports the agent can build, or to search for a report by name.
---

# Reports catalogue (Q02)

Use when the user asks what QuickBooks reports are available, for the reports list or catalogue, which reports the agent can build, or to search for a report by name. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`qbo_query`, `get_preferences`).

QuickBooks location: Reports › Standard reports. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q02. Delivery: Wave 2 (Train 04).

## Discovery call

`qbo_query` (`SELECT * FROM CompanyInfo`) and `get_preferences` — only the company name, country and home currency are shown; the catalogue itself is built into the config.

## Date defaults

None.

## Members

| Member / view | How |
|---|---|
| Every QuickBooks report family (Q00–Q39) as a card | Name, plain-English description, Live or Not yet implemented · Wave N, grouped by category |
| Search and category chips | Filter by name, description or Q-ID; one chip per category |
| Favourites, Create new report | Use saved reports in the Reports library; the custom report builder (Q35) builds any standard report |

## Validation checks (STEP 4 — shown in the banner)

- Every report maps to a family prompt (Q00–Q39)

## Save as

`fileName`: `quickbooks-reports-catalogue.html` · `tags`: ["quickbooks","catalogue","library"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Same layout as the Xero Reports Catalog: company header, search, category chips, cards marked Live or Not yet implemented.
3. Compare the layout with the Q02 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "Client"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":0,\"k\":0,\"zeros\":1,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":0,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\",\"x\":\"\"}"
    }
  ],
  "bindings": [
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
  title: 'Reports catalogue', token: null, noHead: true, primary: 'company_info', company: 'company_info', prefs: 'prefs',
  inputs: { persona: 'persona', display: 'display' },
  defaults: { persona: 'Client', display: '{"cents":0,"k":0,"zeros":1,"neg":"minus","red":0,"hdr":1,"ftr":0,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"","x":""}' },
  uses: {},
  tools: { company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  catalogue: {"categories":["Financial statements","Receivables and payables","Taxes","Sales and expenses","Dashboards","Planning","Accountant","Projects and inventory","Payroll","Packs and tools"],"total":40,"cards":[{"q":"Q17","cat":"Financial statements","name":"Profit and Loss","desc":"Income, cost of sales, gross profit, expenses and net earnings for any period, with comparisons, monthly columns and % of income.","live":true,"wave":1},{"q":"Q18","cat":"Financial statements","name":"Balance Sheet","desc":"Assets, liabilities and equity as of any date, with comparison dates and a check that net earnings tie to the P&L.","live":true,"wave":1},{"q":"Q19","cat":"Financial statements","name":"Statement of Cash Flows","desc":"Operating, investing and financing cash flows, opening to closing cash, with a waterfall chart.","live":true,"wave":1},{"q":"Q22","cat":"Financial statements","name":"Trial Balance","desc":"Debit and credit balance for every account as of any date, checked to balance.","live":true,"wave":2},{"q":"Q24","cat":"Receivables and payables","name":"Accounts Receivable Ageing","desc":"Who owes you, by ageing band — summary, detail, collections, open invoices and customer balances.","live":true,"wave":1},{"q":"Q26","cat":"Receivables and payables","name":"Accounts Payable Ageing","desc":"Who you owe, by ageing band — summary, detail, unpaid bills and supplier balances, with a payment schedule.","live":true,"wave":1},{"q":"Q28","cat":"Taxes","name":"GST Summary (BAS)","desc":"BAS labels G1, 1A, 1B and 9 for any period, with the refund or payment due.","live":true,"wave":1},{"q":"Q15","cat":"Taxes","name":"GST overview","desc":"GST collected, paid and the net refund or payable this period against the last, with the GST liability.","live":true,"wave":1},{"q":"Q34","cat":"Taxes","name":"ATO reports","desc":"Payment summaries and tax file declaration reporting from the payroll app.","live":false,"wave":4},{"q":"Q25","cat":"Sales and expenses","name":"Sales and customers","desc":"Sales by customer and by product or service, income by customer, customer and product lists, and quotes.","live":true,"wave":2},{"q":"Q27","cat":"Sales and expenses","name":"Expenses and suppliers","desc":"Expenses by supplier with concentration, the purchase list, cheque detail and supplier contacts.","live":true,"wave":2},{"q":"Q36","cat":"Sales and expenses","name":"Exchange gains and losses","desc":"Realised gains and losses from the P&L, and an estimate of unrealised gains on open foreign-currency bills and invoices.","live":true,"wave":3},{"q":"Q00","cat":"Dashboards","name":"Business at a glance","desc":"The QuickBooks homepage: profit and loss, spending, bank balances and 12-month cash flow.","live":true,"wave":1},{"q":"Q20","cat":"Dashboards","name":"Business Snapshot","desc":"My income and my expenses by account, the previous year, who owes me and who I owe.","live":true,"wave":1},{"q":"Q07","cat":"Dashboards","name":"Cash flow overview","desc":"Today's cash position, the 12-month cash balance, money in and money out this month, and a 30-day projection.","live":true,"wave":1},{"q":"Q06","cat":"Dashboards","name":"Performance centre","desc":"KPI charts over time — revenue, expenses, profit, cash flow, ageing, current and quick ratios.","live":true,"wave":1},{"q":"Q01","cat":"Dashboards","name":"Business feed","desc":"A 'report ready' profit and loss card for last month with insights on profit, spending, money owed and bills.","live":true,"wave":2},{"q":"Q10","cat":"Dashboards","name":"Expenses & Pay Bills overview","desc":"Unpaid and paid bills, spend over time, spend by supplier and days payable outstanding.","live":true,"wave":2},{"q":"Q11","cat":"Dashboards","name":"Sales & Get Paid overview","desc":"Income over time, unpaid and overdue invoices, payments received and days sales outstanding.","live":true,"wave":2},{"q":"Q12","cat":"Dashboards","name":"Customer Hub overview","desc":"Open quotes, projects in progress, unpaid and overdue invoices, and what needs attention.","live":true,"wave":3},{"q":"Q08","cat":"Planning","name":"Budgets","desc":"Budget vs actuals, the budget overview and profit and loss budget performance for your QuickBooks budgets.","live":true,"wave":2},{"q":"Q09","cat":"Planning","name":"Forecasts","desc":"A projection of future results from past trends — clearly labelled as an estimate.","live":false,"wave":4},{"q":"Q16","cat":"Accountant","name":"Client overview","desc":"Books health check: bank balances, undeposited funds, uncategorised items, old ageing, negative accounts and transaction volume.","live":true,"wave":2},{"q":"Q23","cat":"Accountant","name":"General Ledger","desc":"Every transaction by account with beginning and running balances, plus the journal, transaction list and account list.","live":true,"wave":2},{"q":"Q21","cat":"Accountant","name":"Audit Log","desc":"Who changed what and when — built from the Audit Log export you attach.","live":true,"wave":3},{"q":"Q13","cat":"Projects and inventory","name":"Projects overview","desc":"Income, profit and margin for each project, and estimates vs actual income.","live":true,"wave":3},{"q":"Q29","cat":"Projects and inventory","name":"Project profitability","desc":"Income, costs, profit and margin by project, and estimates vs actuals.","live":true,"wave":3},{"q":"Q14","cat":"Projects and inventory","name":"Inventory overview","desc":"Products low on stock or out of stock, with quantities on order.","live":true,"wave":3},{"q":"Q30","cat":"Projects and inventory","name":"Inventory valuation","desc":"Stock on hand and its value, inventory status, open purchase orders and a stocktake worksheet.","live":true,"wave":3},{"q":"Q31","cat":"Payroll","name":"Employees and time","desc":"Employee contacts, time activities and timesheets.","live":false,"wave":4},{"q":"Q32","cat":"Payroll","name":"Payroll reports","desc":"Gross to net, PAYG withholding, super, pay categories and pay run audits from the payroll app.","live":false,"wave":4},{"q":"Q33","cat":"Payroll","name":"Employee reports","desc":"Employee details, payment history, leave balances and leave liability.","live":false,"wave":4},{"q":"Q04","cat":"Packs and tools","name":"Management report packs","desc":"Print-ready packs — cover, contents, executive summary, statements and notes — for the board or month end.","live":true,"wave":1},{"q":"Q35","cat":"Packs and tools","name":"Custom report builder","desc":"Any QuickBooks standard report — sales by class or location, balance detail, transaction lists — in QuickBooks styling.","live":true,"wave":3},{"q":"Q37","cat":"Packs and tools","name":"Ask a question","desc":"Ask in plain English and get the figure, the period and where it came from, then the full report if you want it.","live":true,"wave":3},{"q":"Q02","cat":"Packs and tools","name":"Reports catalogue","desc":"This page — every QuickBooks report and whether it is live yet.","live":true,"wave":2},{"q":"Q03","cat":"Packs and tools","name":"Custom reports","desc":"Saved report settings — use your saved reports in the Reports library.","live":false,"wave":4},{"q":"Q05","cat":"Packs and tools","name":"Spreadsheet Sync","desc":"Reports in Excel — every report here has Download Excel.","live":false,"wave":4},{"q":"Q38","cat":"Packs and tools","name":"Open in QuickBooks","desc":"Every report can open the matching QuickBooks report, and its Excel export lists the report settings.","live":true,"wave":1},{"q":"Q39","cat":"Packs and tools","name":"Download and share","desc":"Every report downloads to PDF and Excel and can be shared from the report window.","live":true,"wave":1}]},
  render: function (c) {
    var body = c.body, K = this.catalogue, ci = QB.companyInfo(c.data.company_info) || {}, h = QB.h;
    var cats = K.categories.filter(function (cat) { return K.cards.some(function (x) { return x.cat === cat; }); });
    var live = K.cards.filter(function (x) { return x.live; }).length;
    var head = '<div class="qb-card" style="margin-bottom:16px"><h1 style="margin:0 0 6px;font-size:26px">Reports catalogue</h1><div>' + h(c.company || 'N/A — not in source') + (ci.country ? ' · ' + h(ci.country) : '') + ' · ' + h(c.currency) + '</div>' +
      '<div class="muted">Data as of ' + h(c.fetchedAt ? new Date(c.fetchedAt).toLocaleString('en-AU') : '—') + ' · ' + live + ' of ' + K.cards.length + ' reports live</div>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="muted" style="font-size:11px;font-variant:small-caps;letter-spacing:.04em">search reports</div>' +
      '<input id="cat-q" type="search" class="qb-filter" style="width:100%;margin:6px 0 10px" placeholder="Search by name or description…" aria-label="Search reports">' +
      '<div id="cat-chips" style="display:flex;flex-wrap:wrap;gap:8px">' + ['All'].concat(cats).map(function (cat, i) { return '<button type="button" class="cat-chip' + (i ? '' : ' on') + '" data-cat="' + h(cat) + '">' + h(cat) + '</button>'; }).join('') + '</div></div></div>';
    var sections = cats.map(function (cat) {
      return '<section class="cat-sec" data-cat="' + h(cat) + '"><h2 style="font-size:17px;margin:20px 0 10px">' + h(cat) + '</h2><div class="cat-grid">' + K.cards.filter(function (x) { return x.cat === cat; }).map(function (x) {
        return '<div class="cat-card' + (x.live ? '' : ' off') + '" data-text="' + h((x.name + ' ' + x.desc + ' ' + x.q).toLowerCase()) + '"><div class="cat-name">' + h(x.name) + '</div><div class="cat-desc">' + h(x.desc) + '</div>' +
          '<div class="cat-foot"><span class="cat-badge' + (x.live ? ' live' : '') + '">' + (x.live ? 'Live' : 'Not yet implemented · Wave ' + h(x.wave)) + '</span><span class="muted" style="font-size:11px">' + h(x.q) + '</span></div></div>';
      }).join('') + '</div></section>';
    }).join('');
    body.innerHTML = '<style>.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.cat-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}.cat-card.off{opacity:.55}.cat-name{font-weight:700}.cat-desc{font-size:13px;color:var(--muted);flex:1}.cat-foot{display:flex;justify-content:space-between;align-items:center}.cat-badge{font-size:11px;font-weight:700;border-radius:10px;padding:2px 8px;background:var(--line);color:var(--muted)}.cat-badge.live{background:var(--pass-bg);color:var(--pos)}.cat-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;padding:5px 14px;cursor:pointer}.cat-chip.on{background:var(--accent);border-color:var(--accent);color:var(--btn-ink)}</style>' + head + '<div id="cat-sections">' + sections + '</div><p id="cat-none" class="muted" hidden>No reports match.</p>';
    var state = { cat: 'All', q: '' };
    function apply() {
      var any = false;
      body.querySelectorAll('.cat-sec').forEach(function (sec) {
        var inCat = state.cat === 'All' || sec.getAttribute('data-cat') === state.cat, shown = 0;
        sec.querySelectorAll('.cat-card').forEach(function (card) { var ok = inCat && (!state.q || card.getAttribute('data-text').indexOf(state.q) >= 0); card.hidden = !ok; if (ok) shown++; });
        sec.hidden = !shown; if (shown) any = true;
      });
      document.getElementById('cat-none').hidden = any;
    }
    document.getElementById('cat-q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });
    body.querySelectorAll('.cat-chip').forEach(function (b) { b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); body.querySelectorAll('.cat-chip').forEach(function (x) { x.classList.toggle('on', x === b); }); apply(); }); });
    var qids = K.cards.map(function (x) { return x.q; }), uniq = qids.filter(function (q, i) { return qids.indexOf(q) === i; });
    this._x = K;
    return { checks: [
      { name: 'Every report maps to a family prompt (Q00–Q39)', pass: uniq.length === K.total && uniq.every(function (q) { return /^Q\d\d$/.test(q); }), detail: uniq.length + ' of ' + K.total + ' families · ' + live + ' live' }],
      notes: ['Live = built into the QuickBooks Reporting Specialist; ask for it by name in chat. Q-IDs refer to the QuickBooks Reports Prompt Library v1.1.'] };
  },
  excel: function (c) {
    var K = this._x; if (!K) return [];
    return [{ name: 'Reports catalogue', widths: [26, 34, 8, 26, 90], rows: [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Reports catalogue', s: 'bold' }], [], [{ v: 'Category', s: 'bold' }, { v: 'Report', s: 'bold' }, { v: 'Q-ID', s: 'bold' }, { v: 'Status', s: 'bold' }, { v: 'Description', s: 'bold' }]]
      .concat(K.cards.map(function (x) { return [x.cat, x.name, x.q, x.live ? 'Live' : 'Not yet implemented (Wave ' + x.wave + ')', x.desc]; })) }];
  }
});
```

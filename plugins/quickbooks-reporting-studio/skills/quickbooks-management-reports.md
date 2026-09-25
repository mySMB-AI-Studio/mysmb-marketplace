---
name: quickbooks-management-reports
description: QuickBooks Online Management reports (report packs) (Q04) as a live, validated report in QuickBooks styling. Use when the user asks for a management report, board pack, report pack, company financials pack, month-end pack, BAS workpapers or a PDF pack of the statements.
---

# Management reports (report packs) (Q04)

Use when the user asks for a management report, board pack, report pack, company financials pack, month-end pack, BAS workpapers or a PDF pack of the statements. Load `quickbooks-report-foundation` first and follow its *Build a report* steps with the blocks below. This skill needs the `quickbooks-accounting` connector (`get_report_profit_and_loss`, `get_report_balance_sheet`, `get_report_cash_flow`, `get_report_aged_receivables`, `get_report_aged_payables`, `get_report_tax_summary`, `qbo_query`, `get_preferences`).

QuickBooks location: Reports › Management reports. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q04. Delivery: Wave 1.

## Discovery call

`get_report_profit_and_loss`, `get_report_balance_sheet`, `get_report_cash_flow`, ageing reports and `get_report_tax_summary`.

## Date defaults

Custom period — the pack period the user asks for (default: financial year to the end of last month).

## Members

| Member / view | How |
|---|---|
| Basic Company Financials | Cover, contents, executive summary, P&L, Balance Sheet, end notes |
| Expanded Company Financials | Adds Statement of Cash Flows, A/R and A/P ageing |
| BAS workpapers | Cover, contents, GST Summary, P&L, end notes |
| SPFR Company | N/A — needs accountant-authored notes and policies |

## Validation checks (STEP 4 — shown in the banner)

- P&L identities
- Balance Sheet: Total for Assets = Total for Liabilities + Equity
- Cash Flows: Cash at end = beginning + net increase (Expanded)
- A/R and A/P ageing TOTAL = Σ rows (Expanded)
- GST Summary: 1A − 1B = 9 (BAS workpapers)
- Table of contents page numbers match the page order

## Save as

`fileName`: `quickbooks-management-report.html` · `tags`: ["quickbooks","management-report","pack"]

## QA test script (golden set)

1. On the golden-set company, ask the agent for this report at the library's example period (below). Confirm the discovery call succeeded and the report saved.
2. Compare the headline figures with the library example (illustrative, from Enterprise AI Pty Ltd — recompute on the golden set): Cover: For the period ended 31 December 2026 (This year).
3. Compare the layout with the Q04 screenshots (row order, "Total for" rows, header block, footer, number format).
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
      "default": "2026-08-31"
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
      "default": "Executive"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"minus\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"qbo\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"basic\",\"x\":\"\"}"
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
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Total"
        }
      }
    },
    {
      "id": "balance_sheet",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_balance_sheet"
      },
      "params": {
        "end_date": {
          "kind": "input",
          "input": "end_date"
        },
        "accounting_method": {
          "kind": "input",
          "input": "basis"
        },
        "summarize_column_by": {
          "kind": "static",
          "value": "Total"
        }
      }
    },
    {
      "id": "cash_flow",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_cash_flow"
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
        "summarize_column_by": {
          "kind": "static",
          "value": "Total"
        }
      }
    },
    {
      "id": "aged_receivables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_receivables"
      },
      "params": {}
    },
    {
      "id": "aged_payables",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_aged_payables"
      },
      "params": {}
    },
    {
      "id": "gst_summary",
      "tool": {
        "mcp": "quickbooks-accounting",
        "name": "get_report_tax_summary"
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
  title: 'Management Report', token: null, noHead: true, primary: 'pnl', company: 'company_info', prefs: 'prefs',
  inputs: { start: 'start_date', end: 'end_date', basis: 'basis', persona: 'persona', display: 'display' },
  defaults: { start_date: '2026-07-01', end_date: '2026-08-31', basis: 'Accrual', persona: 'Executive',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"minus","red":0,"hdr":1,"ftr":1,"style":"qbo","dens":"100","p":"custom","a":"custom","c":"none","v":"basic","x":""}' },
  uses: { pnl: ['start_date', 'end_date', 'basis'], balance_sheet: ['end_date', 'basis'], cash_flow: ['start_date', 'end_date'], gst_summary: ['start_date', 'end_date', 'basis'], aged_receivables: [], aged_payables: [], company_info: [], prefs: [] },
  tools: { pnl: 'get_report_profit_and_loss', balance_sheet: 'get_report_balance_sheet', cash_flow: 'get_report_cash_flow', aged_receivables: 'get_report_aged_receivables', aged_payables: 'get_report_aged_payables', gst_summary: 'get_report_tax_summary', company_info: 'qbo_query (CompanyInfo)', prefs: 'get_preferences' },
  views: [['basic', 'Basic Company Financials'], ['expanded', 'Expanded Company Financials'], ['bas', 'BAS workpapers']],
  render: function (c) {
    var body = c.body, money = function (v) { return QB.money(v, c.currency, c.display); }, tpl = c.view || 'basic';
    if (c.errors.pnl) { body.innerHTML = '<p class="qb-err">' + QB.h(c.err('pnl')) + '</p>'; return { checks: [{ name: 'Profit and Loss loaded', pass: false, detail: c.err('pnl') }] }; }
    if (!c.data.pnl) return {};
    var endLine = QB.parse(c.inputs.end_date), ended = endLine.getUTCDate() + ' ' + QB.MONTHS[endLine.getUTCMonth()] + ' ' + endLine.getUTCFullYear();
    var W = function (id) { return c.data[id] ? QB.walk(c.data[id]) : []; }, pl = W('pnl'), bs = W('balance_sheet'), cf = W('cash_flow');
    var T = function (ls, g) { return QB.val(QB.find(ls, g)); };
    var stmt = function (id, ls) { if (c.errors[id]) return '<p class="qb-err">' + QB.h(c.err(id)) + '</p>'; return ls.length ? '<div class="keep-detail">' + QB.statement(ls.map(function (l) { return l.group === 'NetIncome' && l.kind === 'total' ? Object.assign({}, l, { label: 'Net Earnings' }) : l; }), ['', 'Total'], c) + '</div>' : '<p class="muted">Data appears once it\'s available.</p>'; };
    function ageTable(id, who) { var rep = c.data[id]; if (c.errors[id]) return '<p class="qb-err">' + QB.h(c.err(id)) + '</p>'; if (!rep) return ''; var cols = QB.cols(rep), ls = QB.walk(rep);
      return '<table class="qb-grid"><thead><tr><th>' + who + '</th>' + cols.slice(1).map(function (x) { return '<th class="num">' + QB.h(x.title) + '</th>'; }).join('') + '</tr></thead><tbody>' + ls.map(function (l) { return '<tr class="k-' + l.kind + '"><td>' + QB.h(l.label) + '</td>' + l.values.map(function (v) { return '<td class="num">' + money(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }
    var pages = [['Executive summary', function () { var inc = T(pl, 'Income'), ni = T(pl, 'NetIncome'); return QB.kpis([{ label: 'Total for Income', value: inc }, { label: 'Gross Profit', value: T(pl, 'GrossProfit') }, { label: 'Net Earnings', value: ni }, { label: 'Net margin', text: inc ? QB.pct(ni / inc) : 'N/A — not in source' }, { label: 'Total for Assets', value: T(bs, 'TotalAssets') }, { label: 'Total for Equity', value: T(bs, 'Equity') }, { label: 'Cash at end of period', value: T(cf, 'EndingCash') }], c); }]];
    if (tpl !== 'bas') pages.push(['Profit and Loss', function () { return stmt('pnl', pl); }], ['Balance Sheet', function () { return stmt('balance_sheet', bs); }]);
    if (tpl === 'expanded') pages.push(['Statement of Cash Flows', function () { return stmt('cash_flow', cf); }], ['A/R Ageing Summary', function () { return ageTable('aged_receivables', 'Customer'); }], ['A/P Ageing Summary', function () { return ageTable('aged_payables', 'Supplier'); }]);
    var basB = c.data.gst_summary && !QB.noData(c.data.gst_summary) ? QB.bas(c.data.gst_summary) : null;
    if (tpl === 'bas') pages.push(['GST Summary', function () { return c.errors.gst_summary ? '<p class="qb-err">' + QB.h(c.err('gst_summary')) + '</p>' : basB ? QB.statement(basB.lines, ['', 'TOTAL'], c) : '<p class="qb-err">QuickBooks returned no GST rows for this period — unavailable, not zero.</p>'; }], ['Profit and Loss', function () { return stmt('pnl', pl); }]);
    pages.push(['End notes', function () { return '<p>Prepared from QuickBooks Online via the ' + QB.h('quickbooks-accounting') + ' connector on ' + QB.h(new Date(c.fetchedAt || Date.now()).toLocaleString('en-AU')) + '. ' + QB.h(c.inputs.basis) + ' basis. Amounts in ' + QB.h(c.currency) + '.</p><p>These reports are decision support. They have not been audited or reviewed.</p>'; }]);
    var cover = '<section class="page mr-cover" style="background:var(--cover);color:var(--cover-ink);border-radius:8px;padding:72px 40px;margin-bottom:16px"><div style="font-size:30px;font-weight:700">Management Report</div><div style="font-size:20px;margin-top:12px">' + QB.h(c.company || 'N/A — not in source') + '</div><div style="margin-top:8px">For the period ended ' + QB.h(ended) + '</div><div style="margin-top:24px;opacity:.8">' + QB.h({ basic: 'Basic Company Financials', expanded: 'Expanded Company Financials', bas: 'BAS workpapers' }[tpl]) + '</div></section>';
    var toc = '<section class="page qb-card"><h2>Table of contents</h2><ol>' + pages.map(function (p, i) { return '<li>' + QB.h(p[0]) + ' <span class="muted">— page ' + (i + 3) + '</span></li>'; }).join('') + '</ol></section>';
    body.innerHTML = cover + toc + pages.map(function (p, i) { return '<section class="page qb-card"><div id="qb-mr-' + i + '" style="text-align:center;margin-bottom:12px"><div style="font-weight:700">' + QB.h(c.company || 'N/A — not in source') + '</div><div>' + QB.h(p[0]) + '</div><div>' + QB.h(p[0] === 'Balance Sheet' ? QB.asOfLine(c.inputs.end_date) : QB.periodLine(c.inputs.start_date, c.inputs.end_date)) + '</div></div>' + p[1]() + '<div class="muted" style="text-align:right;font-size:12px">Page ' + (i + 3) + '</div></section>'; }).join('');
    var A = T(bs, 'TotalAssets'), LE = T(bs, 'TotalLiabilitiesAndEquity'), gp = T(pl, 'GrossProfit'), inc = T(pl, 'Income'), cogs = T(pl, 'COGS') || 0, ni = T(pl, 'NetIncome'), exp = T(pl, 'Expenses'), oi = T(pl, 'OtherIncome') || 0, oe = T(pl, 'OtherExpenses') || 0;
    var beg = T(cf, 'BeginningCash'), cinc = T(cf, 'CashIncrease'), cend = T(cf, 'EndingCash');
    var ageOk = function (id) { var ls = W(id), gt = QB.find(ls, 'GrandTotal'); return gt ? QB.near(QB.val(gt), QB.sum(ls.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return QB.val(l); }))) : null; };
    var checks = [
      { name: 'P&L: Gross Profit = Income − Cost of Sales; Net Earnings = GP + Other Income − Expenses − Other Expenses', pass: gp == null || inc == null || ni == null ? null : QB.near(gp, inc - cogs) && QB.near(ni, gp + oi - exp - oe), detail: money(ni) },
      { name: 'Balance Sheet: Total for Assets = Total for Liabilities + Equity', pass: A == null || LE == null ? null : QB.near(A, LE), detail: c.errors.balance_sheet ? c.err('balance_sheet') : money(A) }];
    if (tpl === 'expanded') checks.push({ name: 'Cash Flows: Cash at end = beginning + net increase', pass: cend == null ? null : QB.near(cend, beg + cinc), detail: money(cend) }, { name: 'A/R and A/P ageing: TOTAL = Σ rows', pass: ageOk('aged_receivables') === false || ageOk('aged_payables') === false ? false : true, detail: '' });
    if (tpl === 'bas') checks.push({ name: 'GST Summary: 1A − 1B = 9', pass: basB && basB.a1 != null && basB.nine != null ? QB.near(basB.a1 - basB.b1, basB.nine) : null, detail: basB ? money(basB.nine) : 'No GST rows' });
    checks.push({ name: 'Table of contents page numbers match the page order', pass: pages.every(function (p, i) { return !!document.getElementById('qb-mr-' + i); }), detail: pages.length + ' pages after cover and contents' });
    this._x = { pl: pl, bs: bs, cf: cf, tpl: tpl, basB: basB, ended: ended };
    return { checks: checks, title: 'Management Report', period: 'For the period ended ' + ended,
      na: ['SPFR Company template (a special-purpose financial report needs accountant-authored notes and accounting policies)', 'Edit cover page / preliminary pages text (fixed wording in this version)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var per = QB.periodLine(c.inputs.start_date, c.inputs.end_date), f = QB.footerStamp(c.inputs.basis, c.fetchedAt), out = [];
    if (x.tpl !== 'bas') out.push(QB.sheetFromLines('Profit and Loss', c.company, per, ['', 'Total'], x.pl, f), QB.sheetFromLines('Balance Sheet', c.company, QB.asOfLine(c.inputs.end_date), ['', 'Total'], x.bs, f));
    if (x.tpl === 'expanded') out.push(QB.sheetFromLines('Statement of Cash Flows', c.company, per, ['', 'Total'], x.cf, f));
    if (x.tpl === 'bas' && x.basB) out.push(QB.sheetFromLines('GST Summary', c.company, per, ['', 'TOTAL'], x.basB.lines, f));
    return out;
  }
});
```

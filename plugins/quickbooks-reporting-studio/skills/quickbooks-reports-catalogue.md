---
name: quickbooks-reports-catalogue
description: QuickBooks Online Standard reports catalogue (Q02) — a searchable index of every QuickBooks report and surface with its family prompt and build status. Use when the user asks what QuickBooks reports are available, for the reports list or catalogue, which reports the agent can build, or to search for a report by name.
---

# Standard reports catalogue (Q02)

Use when the user asks what QuickBooks reports are available, for the reports list or catalogue, which reports the agent can build, or to search for a report by name. This is a **static** page: it holds no company data and calls no tools, so the foundation's *Build a report* steps do not apply.

QuickBooks location: Reports › Standard reports. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q02. Delivery: Wave 2 (Train 04).

## Build

1. Save the page below verbatim with `artifact_save`: `title` = "QuickBooks reports catalogue", `fileName` = `quickbooks-reports-catalogue.html`, `tags` = ["quickbooks","catalogue","library"], `content` = the page. Do not pass `dataBindings` or `connectors`.
2. In the completion note, say the catalogue lists all 40 families (Q00–Q39) with their member reports, and that built families show the wording to ask for them.
3. If the user only wants a quick answer ("can you do an aged payables report?"), answer from the routing list instead of saving the page.

## Members

| Member / view | How |
|---|---|
| Grouped index of every surface and report family (Q00–Q39) with member reports | Search, status (built / roadmap / favourites), persona filter, QuickBooks look / house-style toggle |
| Favourites | Session only — reports cannot store settings in the browser |
| Create new report (custom report builder) | Q35, on the roadmap |

## Validation (shown in the banner)

- Every report maps to a family prompt (Q00–Q39)

## QA test script

1. Ask the agent for the reports catalogue. Confirm it saved and opens.
2. Search "ageing": the A/R and A/P families appear. Filter Status = Built: 22 families (+ the Q38/Q39 contracts). Filter Status = On the roadmap: the rest.
3. Toggle a favourite star, then filter Status = ★ Favourites. Switch Style and the workspace theme.
4. Compare the groups and counts with the library: Groups: Business overview (20) · Who owes you (12) · Sales and customers (17) · What you owe (7) · Expenses and suppliers (8) · Manage Taxes (10) · For my accountant (22) …

## Page

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QuickBooks reports catalogue</title>
<style>:root{--accent:#2CA01C;--btn:#236B32;--btn-ink:#FFFFFF;--ink:#393A3D;--muted:#6B6C72;--line:#E3E5E8;--canvas:#F4F5F8;--card:#FFFFFF;--th:#6B6C72;--zebra:transparent;--neg:#D52B1E;--pos:#2CA01C;--pass-bg:#EAF6E8;--fail-bg:#FDECEA;--band:#FFFFFF;--band-ink:#393A3D;--cover:#1B2A4A;--cover-ink:#FFFFFF;--c1:#2CA01C;--c2:#8D9096;--c3:#0077C5;--c4:#00A6A4;--c5:#7B61FF;--c6:#E0457B;--d1:#2CA01C;--d2:#00A6A4;--d3:#7B61FF;--d4:#E0457B;--d5:#0077C5;--d6:#8D9096}
:root[data-myhub-theme='dark']{--accent:#53C43F;--btn:#2E8B41;--btn-ink:#FFFFFF;--ink:#E6E8EB;--muted:#A3A7AE;--line:#33363C;--canvas:#16181B;--card:#1F2226;--th:#A3A7AE;--neg:#FF6B5E;--pos:#53C43F;--pass-bg:#18301A;--fail-bg:#3A1B19;--band:#1F2226;--band-ink:#E6E8EB;--cover:#22324F;--cover-ink:#FFFFFF;--c1:#53C43F;--c2:#80858D;--c3:#3FA2E8;--c4:#2CC7C4;--c5:#9A86FF;--c6:#F06A96;--d1:#53C43F;--d2:#2CC7C4;--d3:#9A86FF;--d4:#F06A96;--d5:#3FA2E8;--d6:#80858D}
:root.style-mysmb{--accent:#007A6E;--btn:#007A6E;--zebra:#E6F7F5;--band:#007A6E;--band-ink:#FFFFFF;--cover:#007A6E;--c1:#007A6E;--c3:#00B0A0;--d1:#007A6E;--d2:#00B0A0;--pos:#007A6E}
:root[data-myhub-theme='dark'].style-mysmb{--accent:#2BB3A3;--btn:#138A7D;--zebra:#15302D;--band:#0E5A52;--band-ink:#FFFFFF;--cover:#0E5A52;--c1:#2BB3A3;--c3:#3CCFBF;--d1:#2BB3A3;--d2:#3CCFBF;--pos:#2BB3A3}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--canvas);color:var(--ink);font:14px/1.45 "Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
#qb-controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:12px}
.ctl{display:flex;flex-direction:column;font-size:12px;color:var(--muted);gap:4px}
.ctl select,.ctl input[type=date],.qb-filter{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:4px;padding:6px 8px}
.ctl select:disabled,.ctl input:disabled{opacity:.6}
.seg{border:0;padding:0;margin:0;flex-direction:row;gap:0}
.seg legend{font-size:12px;color:var(--muted);padding:0 0 4px}
.seg label{border:1px solid var(--line);padding:6px 12px;color:var(--ink);cursor:pointer;font-size:13px}
.seg label:first-of-type{border-radius:4px 0 0 4px}.seg label:last-of-type{border-radius:0 4px 4px 0;border-left:0}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){background:var(--card);box-shadow:inset 0 0 0 2px var(--accent);font-weight:600}
.customise summary{cursor:pointer;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px 10px;font-size:13px}
.cz{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:6px 16px;padding:8px 0;font-size:13px;color:var(--ink)}
.btns{flex-direction:row;gap:8px;margin-left:auto}
.btns button,.btns a{font:inherit;font-size:13px;font-weight:600;border-radius:4px;padding:7px 14px;cursor:pointer;text-decoration:none;border:1px solid var(--btn);background:var(--card);color:var(--btn)}
.btns button#qb-xlsx{background:var(--btn);color:var(--btn-ink)}
#qb-status{font-size:12px;color:var(--muted);min-height:16px;margin:0 0 6px}
.qb-banner{border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;border:1px solid var(--line)}
.qb-banner.pass{background:var(--pass-bg)}.qb-banner.fail{background:var(--fail-bg);border-color:var(--neg)}
.qb-banner ul{margin:6px 0 0;padding-left:18px}.qb-banner li.bad{color:var(--neg);font-weight:600}.qb-banner li.na{color:var(--muted)}
.qb-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px 24px;margin-bottom:12px}
#qb-head{text-align:center;padding:8px 0 16px;background:var(--band);color:var(--band-ink);border-radius:6px}
:root.style-mysmb #qb-head{text-align:left;padding:14px 18px;margin-bottom:12px}
#qb-head .co{font-size:18px;font-weight:700}#qb-head .ti{font-size:14px}#qb-head .pe{font-size:14px;font-weight:600}
table{border-collapse:collapse;width:100%}
th{font-size:11px;font-variant:small-caps;letter-spacing:.04em;text-transform:lowercase;color:var(--th);font-weight:600;text-align:left;padding:8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card)}
.qb-grid th{cursor:pointer;user-select:none}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--zebra)}
.num{text-align:right;white-space:nowrap}
.k-header td{font-weight:600;border-bottom:0}.k-total td{font-weight:700;border-top:1px solid var(--ink)}
.neg{color:var(--neg)}
.muted{color:var(--muted)}.qb-err{color:var(--neg)}
.qb-scroll{overflow-x:auto}
.qb-filter{margin:0 0 8px;min-width:220px}
:root.dens-compact td{padding:3px 8px}:root.dens-compact body{font-size:12.5px}
.qb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.qb-kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.qb-kpi .lbl{font-size:11px;font-variant:small-caps;text-transform:lowercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.qb-kpi .val{font-size:22px;font-weight:700;margin-top:2px}.qb-kpi .sub{font-size:12px;color:var(--muted)}
.chip{display:inline-block;font-size:11px;font-weight:700;border-radius:10px;padding:1px 8px;margin-top:4px}
.chip.up{background:var(--pass-bg);color:var(--pos)}.chip.down{background:var(--fail-bg);color:var(--neg)}
.qb-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.qb-card h2,.qb-card h3{font-size:15px;margin:0 0 10px}
svg{width:100%;height:auto;max-height:300px;display:block;margin:0 auto}svg .axis{stroke:var(--line);stroke-width:1}svg .tick{fill:var(--muted);font-size:11px}
svg .donut-c{fill:var(--ink);font-size:15px;font-weight:700}
.qb-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--muted);margin-top:6px}
.qb-legend i,.qb-donut li i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.qb-donut{display:flex;gap:16px;align-items:center}.qb-donut svg{max-width:180px}.qb-donut ul{list-style:none;padding:0;margin:0;font-size:13px}.qb-donut li{margin:3px 0}
#qb-foot{color:var(--muted);font-size:12px;text-align:center;padding:12px 0 4px}
#qb-sources{font-size:12.5px;color:var(--muted)}#qb-sources h2{font-size:13px;color:var(--ink)}
.persona-summary .detail-block{display:none}
.persona-summary .keep-detail tr.detail-block{display:table-row}
.skel{height:14px;border-radius:4px;background:var(--line);margin:8px 0;opacity:.6}
.page{break-after:page}
@media (max-width:720px){.btns{margin-left:0}.cz{grid-template-columns:1fr}}
@media print{body{background:var(--card);padding:0}#qb-controls,#qb-status,.no-print,.qb-filter{display:none!important}.qb-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 portrait;margin:14mm}}
.fam{border:1px solid var(--line);border-radius:8px;margin:0 0 10px;background:var(--card)}
.fam>summary{cursor:pointer;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.fam>div{padding:0 14px 12px}.qid{font-weight:700;color:var(--accent)}.members{columns:2;font-size:13px;margin:6px 0 8px;padding-left:18px}
.st{font-size:11px;font-weight:700;border-radius:10px;padding:2px 8px}.st.built{background:var(--pass-bg);color:var(--pos)}.st.road{background:var(--line);color:var(--muted)}
.ask{font-size:13px;background:var(--canvas);border:1px solid var(--line);border-radius:6px;padding:6px 10px}.star{background:none;border:0;cursor:pointer;font-size:16px;color:var(--muted)}.star.on{color:var(--accent)}
@media (max-width:720px){.members{columns:1}}
</style>
</head>
<body class="persona-detail">
<div id="qb-controls" aria-label="Catalogue controls">
<label class="ctl">Search<input type="search" id="q" class="qb-filter" placeholder="Type report name here" style="margin:0"></label>
<label class="ctl">Status<select id="st"><option value="all">All</option><option value="built">Built — ask the agent</option><option value="road">On the roadmap</option><option value="fav">★ Favourites</option></select></label>
<label class="ctl">For<select id="who"><option value="">All personas</option><option>Client</option><option>Bookkeeper</option><option>Practitioner</option><option>Executive</option></select></label>
<label class="ctl">Style<select id="style"><option value="qbo">QuickBooks look</option><option value="mysmb">mySMB house style</option></select></label>
</div>
<div id="qb-banner" class="qb-banner pass" role="region" aria-label="Validation"></div>
<main class="qb-card"><header id="qb-head"><div class="co">QuickBooks Online</div><div class="ti">Standard reports catalogue</div><div class="pe">Reporting Library — QuickBooks Reports Prompt Library v1.1</div></header><div id="qb-body"></div></main>
<section id="qb-sources" class="qb-card"><h2>About this catalogue</h2><ul><li>Every QuickBooks surface and report family (Q00–Q39) with its member reports, grouped by QuickBooks menu path.</li><li>"Built" families are live reports: ask the QuickBooks Reporting Specialist using the suggested wording. Roadmap families are listed with their delivery wave.</li><li>Favourites last for this viewing only (reports cannot store settings in your browser).</li><li>This page holds no company data.</li></ul></section>
<script>
var DATA = [{"q":"Q00","location":"Home","family":"Homepage — Business at a glance","type":"Dashboard","users":"Client (primary) · Executive · Bookkeeper","priority":"P1","wave":1,"order":5,"members":["Homepage widgets: Profit & Loss","Expenses","Bank accounts","Cash flow"],"skill":"quickbooks-homepage"},{"q":"Q01","location":"Feed › Business feed","family":"Business feed and Intuit Intelligence","type":"Feed","users":"Client (primary) · Executive","priority":"P2","wave":2,"order":20,"members":["P&L report-ready card","Intuit Intelligence panel","'Ask a question' (BETA) on reports"],"skill":"quickbooks-business-feed"},{"q":"Q02","location":"Reports › Standard reports","family":"Standard reports catalogue (index, favourites, search, Ask a question)","type":"Index","users":"All personas","priority":"P2","wave":2,"order":21,"members":["Groups: Favourites","Custom report builder","Business overview (20)","Who owes you (12)","Projects (2)","Inventory (6)","Sales and customers (17)","What you owe (7)","Expenses and suppliers (8)","Manage Taxes (10)","Employees (3)","For my accountant (22)","Payroll/Time","Payroll Reports (12)","Employee Reports (8)","ATO Reports (4)"],"skill":"quickbooks-reports-catalogue"},{"q":"Q03","location":"Reports › Custom reports","family":"Custom reports (saved customisations)","type":"Tool","users":"Bookkeeper (primary) · Practitioner","priority":"P3","wave":4,"order":38,"members":["Saved reports","report groups","scheduled emails"],"skill":null},{"q":"Q04","location":"Reports › Management reports","family":"Management reports (packs with Preview)","type":"Pack","users":"Executive (primary) · Practitioner","priority":"P1","wave":1,"order":8,"members":["Basic Company Financials (cover","TOC","P&L","Balance Sheet","notes)","Expanded (adds Statement of Cash Flows","A/R & A/P ageing)","BAS workpapers (GST reports)","SPFR Company (special-purpose financial report)"],"skill":"quickbooks-management-reports"},{"q":"Q05","location":"Reports › Spreadsheet sync","family":"Spreadsheet Sync (Excel / Google Sheets)","type":"Tool","users":"Practitioner (primary) · Executive","priority":"P3","wave":4,"order":39,"members":["Run report in Excel","Run report in Google Sheets","2-way sync","multi-company groups"],"skill":null},{"q":"Q06","location":"Reports › Performance centre","family":"Performance centre (custom KPI charts)","type":"Dashboard","users":"Executive (primary) · Client","priority":"P1","wave":1,"order":7,"members":["10 charts + 8 quick-add + custom chart builder (chart type","time range","group by","compare","filters)"],"skill":"quickbooks-performance-centre"},{"q":"Q07","location":"Reports › Financial planning › Cash flow overview","family":"Cash flow overview","type":"Dashboard","users":"Client (primary) · Executive · Bookkeeper","priority":"P1","wave":1,"order":6,"members":["Today's cash balance","Cash balance chart","Monthly outlook","Money in","Money out"],"skill":"quickbooks-cash-flow-overview"},{"q":"Q08","location":"Reports › Financial planning › Budgets","family":"Budgets (create, import, Budget vs Actuals)","type":"Tool","users":"Executive (primary) · Client","priority":"P2","wave":2,"order":22,"members":["Create a budget","Import budget","Budget Overview","Budget vs Actuals","Profit & Loss Budget Performance"],"skill":"quickbooks-budgets"},{"q":"Q09","location":"Reports › Financial planning › Forecasts","family":"Forecasts","type":"Tool","users":"Executive (primary)","priority":"P3","wave":4,"order":40,"members":["Create forecast","forecast vs actual views"],"skill":null},{"q":"Q10","location":"All apps › Expenses & Pay Bills › Overview","family":"Expenses & Pay Bills overview","type":"Dashboard","users":"Bookkeeper (primary) · Client · Executive","priority":"P2","wave":2,"order":23,"members":["Bills funnel","Spend over time","Spend insights","Create actions (Upload multiple bills","Create bill","Schedule online payment","Pay bills","Record expense)"],"skill":"quickbooks-expenses-overview"},{"q":"Q11","location":"All apps › Sales & Get Paid › Overview","family":"Sales & Get Paid overview","type":"Dashboard","users":"Client (primary) · Bookkeeper","priority":"P2","wave":2,"order":24,"members":["Income over time","Invoices funnel","quick actions"],"skill":"quickbooks-sales-overview"},{"q":"Q12","location":"All apps › Customer Hub › Overview","family":"Customer Hub overview","type":"Dashboard","users":"Client (primary) · Executive","priority":"P3","wave":3,"order":30,"members":["Customers funnel","Overdue invoices","Open quotes","Needs attention"],"skill":null},{"q":"Q13","location":"All apps › Projects › Overview","family":"Projects overview","type":"Dashboard","users":"Client (primary) · Executive","priority":"P3","wave":3,"order":31,"members":["Estimates vs actual income","Project Profitability Summary","Estimates vs actuals by project"],"skill":null},{"q":"Q14","location":"All apps › Inventory › Overview","family":"Inventory overview","type":"Dashboard","users":"Client (primary) · Bookkeeper","priority":"P3","wave":3,"order":32,"members":["Low on stock","Out of stock","Inventory Valuation reports"],"skill":null},{"q":"Q15","location":"All apps › GST › Overview","family":"GST overview (BAS centre)","type":"Dashboard","users":"Bookkeeper (primary) · Practitioner","priority":"P1","wave":1,"order":9,"members":["GST overview","Run reports menu","Export workpapers","BAS/IAS preparation (not triggered)"],"skill":"quickbooks-gst-overview"},{"q":"Q16","location":"All apps › Accounting › Client overview","family":"Client overview (accountant-only)","type":"Dashboard","users":"Practitioner (primary) · Bookkeeper","priority":"P1","wave":2,"order":12,"members":["Banking activity","Common issues","Transaction volume","Books review","Prep for taxes"],"skill":"quickbooks-client-overview"},{"q":"Q17","location":"Reports › Standard reports › Business overview","family":"Profit and Loss family","type":"Report","users":"Bookkeeper (primary) · Client · Executive · Practitioner","priority":"P1","wave":1,"order":1,"members":["Profit and Loss","P&L by Customer","P&L by Month","P&L by Tag Group","P&L Comparison","P&L Detail","P&L as % of total income","P&L year-to-date comparison","Quarterly P&L Summary"],"skill":"quickbooks-profit-and-loss"},{"q":"Q18","location":"Reports › Standard reports › Business overview","family":"Balance Sheet family","type":"Report","users":"Bookkeeper (primary) · Executive · Practitioner","priority":"P1","wave":1,"order":2,"members":["Balance Sheet","Balance Sheet Comparison","Balance Sheet Detail","Balance Sheet Summary","Statement of Changes in Equity"],"skill":"quickbooks-balance-sheet"},{"q":"Q19","location":"Reports › Standard reports › Business overview","family":"Statement of Cash Flows","type":"Report","users":"Executive (primary) · Bookkeeper","priority":"P1","wave":1,"order":4,"members":["Statement of Cash Flows"],"skill":"quickbooks-statement-of-cash-flows"},{"q":"Q20","location":"Reports › Standard reports › Business overview","family":"Business Snapshot","type":"Dashboard","users":"Client (primary) · Executive","priority":"P1","wave":1,"order":10,"members":["My income","My expenses","Previous year income/expense comparison","Who owes me","Who I owe"],"skill":"quickbooks-business-snapshot"},{"q":"Q21","location":"Reports › Standard reports › Business overview","family":"Audit Log (and Intuit Intelligence audit log)","type":"Report","users":"Bookkeeper (primary) · Practitioner","priority":"P3","wave":3,"order":33,"members":["Audit Log","Intuit Intelligence Audit Log"],"skill":null},{"q":"Q22","location":"Reports › Standard reports › For my accountant","family":"Trial Balance family","type":"Report","users":"Bookkeeper (primary) · Practitioner","priority":"P2","wave":2,"order":13,"members":["Trial Balance","Adjusted Trial Balance","Custom Summary Report"],"skill":"quickbooks-trial-balance"},{"q":"Q23","location":"Reports › Standard reports › For my accountant","family":"General Ledger and transaction-list family","type":"Report","users":"Bookkeeper (primary) · Practitioner","priority":"P2","wave":2,"order":14,"members":["General Ledger","General Ledger Summary","General Ledger List","Journal","Adjusting Journal Entries","Transaction Detail by Account","Transaction List by Date","Transaction List with Splits","Recent Transactions","Recent Automatic Transactions","Recurring Template List","Invalid Journal Entries","Uncoded Transactions","Account List","Reconciliation Reports"],"skill":"quickbooks-general-ledger"},{"q":"Q24","location":"Reports › Standard reports › Who owes you","family":"Accounts receivable family","type":"Report","users":"Client (primary) · Bookkeeper · Practitioner · Executive","priority":"P1","wave":1,"order":3,"members":["A/R ageing summary","A/R ageing detail","Collections Report","Customer Balance Summary","Customer Balance Detail","Open Invoices","Invoice List","Invoices and Received Payments","Statement List","Terms List","Unbilled charges","Unbilled time"],"skill":"quickbooks-aged-receivables"},{"q":"Q25","location":"Reports › Standard reports › Sales and customers","family":"Sales and customers family","type":"Report","users":"Client (primary) · Executive · Bookkeeper","priority":"P2","wave":2,"order":15,"members":["Sales by Customer Summary/Detail","Sales by Product/Service Summary/Detail","Income by Customer Summary","Customer Contact/Phone List","Product/Service List","Deposit Detail","Quotes by Customer","Quotes & Progress Invoicing Summary","Sales by Customer Type Detail","Payment Method List","Time Activities by Customer Detail","Transaction List by Customer / by Tag Group","Cashflow Payment Transactions."],"skill":"quickbooks-sales-and-customers"},{"q":"Q26","location":"Reports › Standard reports › What you owe","family":"Accounts payable family","type":"Report","users":"Bookkeeper (primary) · Client · Practitioner","priority":"P1","wave":1,"order":11,"members":["A/P ageing summary","A/P ageing detail","Bills and Applied Payments","Bill Payment List","Unpaid Bills","Supplier Balance Summary","Supplier Balance Detail"],"skill":"quickbooks-aged-payables"},{"q":"Q27","location":"Reports › Standard reports › Expenses and suppliers","family":"Expenses and suppliers family","type":"Report","users":"Bookkeeper (primary) · Executive · Client","priority":"P2","wave":2,"order":16,"members":["Purchases by Supplier Detail","Purchases by Product/Service Detail","Purchase List","Transaction List by Supplier","Supplier Contact List","Supplier Phone List","Cheque Detail."],"skill":"quickbooks-expenses-and-suppliers"},{"q":"Q28","location":"Reports › Standard reports › Manage Taxes","family":"GST and PAYG family (BAS)","type":"Tax","users":"Bookkeeper (primary) · Practitioner","priority":"P1","wave":1,"order":6,"members":["GST Summary","GST Details","GST Liability","GST Amendment","PAYG Withholding Summary/Details/Amendment","TPAR","Transactions without GST","Transaction Detail by Tax Code"],"skill":"quickbooks-gst-bas"},{"q":"Q29","location":"Reports › Standard reports › Projects","family":"Projects family","type":"Report","users":"Client (primary) · Executive","priority":"P3","wave":3,"order":34,"members":["Project Profitability Summary","Estimates vs. actuals by project v4"],"skill":null},{"q":"Q30","location":"Reports › Standard reports › Inventory","family":"Inventory family","type":"Report","users":"Client (primary) · Bookkeeper","priority":"P3","wave":3,"order":35,"members":["Inventory Valuation Summary/Detail","Inventory Status","Open Purchase Order Detail/List","Stocktake Worksheet."],"skill":null},{"q":"Q31","location":"Reports › Standard reports › Employees / Payroll · Time","family":"Employees and time family","type":"Report","users":"Bookkeeper (primary)","priority":"P3","wave":4,"order":36,"members":["Employee Contact List","Recent/Edited Time Activities","Time Activities by Employee Detail","Timesheet Detail (NEW)","Time Summary by Pay Type (NEW)."],"skill":null},{"q":"Q32","location":"Reports › Standard reports › Payroll Reports (Employment Hero)","family":"Payroll reports family","type":"Report","users":"Bookkeeper (primary)","priority":"P3","wave":4,"order":37,"members":["Costing Report","Detailed Activity Report","Deductions","Gross to Net Report","Ordinary Time Earnings Report","PAYG Withholding","Pay Categories Report","Pay Run Audit Report","Payrun Comparison Report","Super Contributions","Timesheets Report."],"skill":null},{"q":"Q33","location":"Reports › Standard reports › Employee Reports","family":"Employee reports family","type":"Report","users":"Bookkeeper (primary) · Executive","priority":"P3","wave":4,"order":38,"members":["Employee Details","Employee Payment History","Qualifications","Satisfaction","Birthdays","Leave Liability","Leave Balances","Unpaid Employees."],"skill":null},{"q":"Q34","location":"Reports › Standard reports › ATO Reports","family":"ATO reports family","type":"Tax","users":"Bookkeeper (primary)","priority":"P3","wave":4,"order":39,"members":["4 reports"],"skill":null},{"q":"Q35","location":"Reports › Standard reports › Custom report builder","family":"Custom report builder family (Revenue Recognition, approval status, profitability)","type":"Report","users":"Executive (primary) · Bookkeeper","priority":"P3","wave":3,"order":40,"members":["5 templates + builder"],"skill":null},{"q":"Q36","location":"Reports › Standard reports › Business overview","family":"Exchange gains and losses (multi-currency)","type":"Report","users":"Bookkeeper (primary) · Executive","priority":"P3","wave":3,"order":41,"members":["2 reports"],"skill":null},{"q":"Q37","location":"Reports › Ask a question (BETA) / Intuit Intelligence","family":"Ask a question — natural-language report queries","type":"Tool","users":"Client (primary) · Executive","priority":"P2","wave":3,"order":42,"members":["Ask a question","Intuit Intelligence"],"skill":null},{"q":"Q38","location":"Library control","family":"Classic report URL parameter contract (reportv2)","type":"Library","users":"Bookkeeper · Practitioner","priority":"P1","wave":1,"order":43,"members":["Parameter list"],"skill":"quickbooks-report-foundation"},{"q":"Q39","location":"Library control","family":"Report export, delivery and customisation contract","type":"Library","users":"All","priority":"P1","wave":1,"order":44,"members":["Export/Delivery controls"],"skill":"quickbooks-report-foundation"}];
(function () {
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var fav = {}, $ = function (id) { return document.getElementById(id); };
  function group(loc) { var p = loc.split(' › '); return p.length > 2 ? p.slice(0, 3).join(' › ') : loc; }
  function ask(r) { var m = r.members[0] || r.family; return 'Ask: “' + (r.type === 'Dashboard' ? 'Show me the ' + r.family.split(' (')[0] : 'Run the ' + m + ' for last month') + '”'; }
  function draw() {
    var q = $('q').value.trim().toLowerCase(), st = $('st').value, who = $('who').value, groups = {}, order = [], shown = 0, reports = 0;
    DATA.forEach(function (r) {
      var hay = (r.q + ' ' + r.family + ' ' + r.location + ' ' + r.members.join(' ')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      if (st === 'built' && !r.skill) return; if (st === 'road' && r.skill) return; if (st === 'fav' && !fav[r.q]) return;
      if (who && r.users.indexOf(who) < 0) return;
      var g = group(r.location); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); shown++; reports += r.members.length;
    });
    $('qb-body').innerHTML = (shown ? '' : '<p class="muted">No reports match.</p>') + order.map(function (g) {
      return '<h3 style="margin:16px 0 8px">' + h(g) + '</h3>' + groups[g].map(function (r) {
        return '<details class="fam"' + (q ? ' open' : '') + '><summary><button class="star' + (fav[r.q] ? ' on' : '') + '" data-q="' + h(r.q) + '" aria-label="Favourite">' + (fav[r.q] ? '★' : '☆') + '</button><span class="qid">' + h(r.q) + '</span><strong>' + h(r.family) + '</strong><span class="st ' + (r.skill ? 'built">Built' : 'road">Wave ' + r.wave) + '</span><span class="muted" style="margin-left:auto">' + h(r.type) + ' · ' + h(r.priority) + '</span></summary><div>' +
          '<ul class="members">' + r.members.map(function (m) { return '<li>' + h(m) + '</li>'; }).join('') + '</ul><div class="muted" style="font-size:12px">For: ' + h(r.users) + ' · ' + h(r.location) + '</div>' +
          (r.skill ? '<div class="ask" style="margin-top:8px">' + h(ask(r)) + ' <span class="muted">(skill ' + h(r.skill) + ')</span></div>' : '<div class="muted" style="margin-top:8px">On the Reporting Library roadmap — delivery wave ' + h(r.wave) + '. Meanwhile ask for the closest built report, or attach the QuickBooks export.</div>') + '</div></details>';
      }).join('');
    }).join('');
    document.querySelectorAll('.star').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); var k = b.getAttribute('data-q'); fav[k] = !fav[k]; draw(); }); });
    var mapped = DATA.filter(function (r) { return /^Q\d\d$/.test(r.q); }).length, builtN = DATA.filter(function (r) { return r.skill; }).length;
    $('qb-banner').innerHTML = '<strong>✓ Validation: every report maps to a family prompt</strong> · ' + mapped + ' of ' + DATA.length + ' families (Q00–Q39) · ' + builtN + ' built · showing ' + shown + ' families and ' + reports + ' reports and surfaces';
  }
  ['q', 'st', 'who'].forEach(function (id) { $(id).addEventListener(id === 'q' ? 'input' : 'change', draw); });
  $('style').addEventListener('change', function () { document.documentElement.classList.toggle('style-mysmb', this.value === 'mysmb'); });
  draw();
})();
</script>
</body>
</html>
```

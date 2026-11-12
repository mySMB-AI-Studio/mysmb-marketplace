# QuickBooks Reporting Studio

Live QuickBooks Online reports for your Reports library, including profit and loss, balance sheet, cash flow, trial balance, general ledger, aged receivables and payables, GST and BAS, sales and supplier reports, budgets, dashboards and management report packs. Each report reads your connected QuickBooks company every time it opens, checks its own figures and shows the result. You can download it as PDF or Excel, or share it. Find the reports in Reports, under From your plugins. Read-only in QuickBooks.

Reporting Library: QuickBooks Reports Prompt Library v1.1 (Q00–Q39). This initial release delivers **30 report templates** (35 supported families and guides). Payroll, Employee and ATO reports (Q32–Q34) are deferred until their payroll connector is supported.

## What's in the box

- **No agent:** people open the reports from Reports → From your plugins, or ask mySidekick, which loads these skills. Connector: `quickbooks-accounting`.
- **Skills:** 1 foundation (build recipe, controls contract, validation rules, the tested report kit and stylesheet) + 35 family skills:
  - Q17 Profit and Loss family — `quickbooks-profit-and-loss`
  - Q18 Balance Sheet family — `quickbooks-balance-sheet`
  - Q19 Statement of Cash Flows — `quickbooks-statement-of-cash-flows`
  - Q24 Accounts receivable family — `quickbooks-aged-receivables`
  - Q26 Accounts payable family — `quickbooks-aged-payables`
  - Q22 Trial Balance family — `quickbooks-trial-balance`
  - Q28 GST and PAYG family (BAS) — `quickbooks-gst-bas`
  - Q15 GST overview (BAS centre) — `quickbooks-gst-overview`
  - Q20 Business Snapshot — `quickbooks-business-snapshot`
  - Q00 Homepage — Business at a glance — `quickbooks-homepage`
  - Q07 Cash flow overview — `quickbooks-cash-flow-overview`
  - Q06 Performance centre (KPI charts) — `quickbooks-performance-centre`
  - Q04 Management reports (report packs) — `quickbooks-management-reports`
  - Q16 Client overview (accountant-only) — `quickbooks-client-overview`
  - Q23 General Ledger and transaction-list family — `quickbooks-general-ledger`
  - Q25 Sales and customers family — `quickbooks-sales-and-customers`
  - Q27 Expenses and suppliers family — `quickbooks-expenses-and-suppliers`
  - Q01 Business feed — `quickbooks-business-feed`
  - Q08 Budgets (Budget vs Actuals) — `quickbooks-budgets`
  - Q10 Expenses & Pay Bills overview — `quickbooks-expenses-overview`
  - Q11 Sales & Get Paid overview — `quickbooks-sales-overview`
  - Q02 Reports catalogue — `quickbooks-reports-catalogue`
  - Q14 Inventory overview — `quickbooks-inventory-overview`
  - Q30 Inventory family — `quickbooks-inventory`
  - Q12 Customer Hub overview — `quickbooks-customer-hub`
  - Q13 Projects overview — `quickbooks-projects-overview`
  - Q29 Projects family — `quickbooks-projects`
  - Q36 Exchange gains and losses (multi-currency) — `quickbooks-exchange-gains-losses`
  - Q35 Custom report builder — `quickbooks-custom-report-builder`
  - Q21 Audit Log — `quickbooks-audit-log`
  - Q37 Ask a question — `quickbooks-ask-a-question`
  - Q09 Forecasts — `quickbooks-forecasts`
  - Q31 Employees and time family — `quickbooks-employees-and-time`
  - Q03 Custom reports (saved customisations) — `quickbooks-custom-reports`
  - Q05 Spreadsheet Sync (Excel / Google Sheets) — `quickbooks-spreadsheet-sync`
- **Every report:** live data, client selector (one company per connection), period presets that roll forward, Cash/Accrual, Display columns by, Compare to, Customise (cents, divide by 1000, zero rows, negatives, header/footer), persona modes, QuickBooks look with a mySMB house-style toggle, light and dark themes, a validation banner, Download PDF and Download Excel (.xlsx), and Open in QuickBooks where a deep link exists.

- **Report templates:** every family except the custom report builder also ships as a report template (`reports/<skill>/`), listed in the workspace under Reports → From your plugins (**Use this report**). mySidekick creates reports from them with `artifact_from_template`, so it never retypes the report.

Connect QuickBooks under Settings → Connections (OAuth) before asking for a report. No payroll connector is required for this release.

## Connector limits (stated in the reports)

- One QuickBooks company per connection.
- Ageing reports age as of today: `report_date`, `aging_period`, `num_periods`, `aging_method` and `past_due` are not passed by the connector yet.
- `get_report_tax_summary` returns BAS figures only when `agency_id` names the tax agency (added in myhub-mcp-servers #542). The GST reports list the agencies and use the Australian Tax Office.
- Payroll, Employee and ATO reports (Q32–Q34) are excluded from this release. Their source remains in `scripts/quickbooks-reporting-kit/` for future support. QuickBooks time activities and the employee contact list remain in Q31.
- `get_company_info` looks CompanyInfo up by realm id and returns "not found". The reports read CompanyInfo through `qbo_query` instead.

## Maintenance

The skills and report templates are generated from `scripts/quickbooks-reporting-kit/` (`npm run gen`, then `npm test` and `npm run roundtrip`): a report kit that is tested as one unit, with each family's `dataBindings` and config. Change a report there, in code. Publish it from dev in the Console. Pull it into the Developer Instance after a change on dev, and don't save it there before that Pull: a save commits the Developer Instance's older copy over dev.

## Configuration

No configuration variables are required.

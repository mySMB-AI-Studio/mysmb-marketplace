# QuickBooks Reporting Studio

Live, validated QuickBooks Online reports in QuickBooks styling — statements, ageing, GST/BAS, dashboards and management packs — with a specialist reporting agent.

Reporting Library: QuickBooks Reports Prompt Library v1.1 (Q00–Q39). This version delivers **Waves 1–4** (35 families). The payroll families (Q32–Q34) wait on an Employment Hero payroll connector.

## What's in the box

- **Agent:** QuickBooks Reporting Specialist (AGT-003), on Sonnet, with the `quickbooks-accounting` connector.
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

Connect QuickBooks under Settings → Connections (OAuth) before asking for a report.

## Connector limits (stated in the reports)

- One QuickBooks company per connection.
- Ageing reports age as of today: `report_date`, `aging_period`, `num_periods`, `aging_method` and `past_due` are not passed by the connector yet.
- `get_report_tax_summary` returns BAS figures only when `agency_id` names the tax agency (added in myhub-mcp-servers #542). The GST reports list the agencies and use the Australian Tax Office.
- PAYG, payroll, leave and ATO reports live in Employment Hero. QuickBooks time activities and the employee contact list are in Q31.
- `get_company_info` looks CompanyInfo up by realm id and returns "not found". The reports read CompanyInfo through `qbo_query` instead.

## Maintenance

The skills embed a report kit that is tested as one unit, with each family's `dataBindings` and config. Change a report by changing its skill here in code, not by hand-editing a copy in the Developer Instance.

## Configuration

No configuration variables are required.

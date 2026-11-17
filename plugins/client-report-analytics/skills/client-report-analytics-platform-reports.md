---
name: client-report-analytics-platform-reports
description: CRA-16 Platform-native reports — opens any report of the Xero (P01–P15), MYOB (M00–M63) or QuickBooks (Q00–Q39) report library for the selected client from the reporting-studio extensions. Use when the user asks for a standard platform report for a client (Profit and Loss, Balance Sheet, aged receivables, GST/BAS summary, trial balance, general ledger …) that is not one of the Client Report Analytics reports.
---

# CRA-16 Platform-native reports (pass-through)

Use when the user wants one of the platform's own library reports for a client. These templates belong to the Xero, MYOB and QuickBooks Reporting Studio extensions; this skill only routes to them. Do not rebuild them.

1. Confirm the client and the report. Find the client's platform and id with the discovery call (Xero `list_connections`, MYOB `list_company_files`, QuickBooks `qbo_query` `SELECT * FROM CompanyInfo`).
2. Pick the template from that platform's list below (match the title or code; ask if two fit).
3. Call `artifact_from_template` with `plugin` = that platform's extension, `slug` = the template slug, `title` = "<Report> — <client name>", and `inputs` = only the client input (Xero `{ "org": "<tenantId>" }`, MYOB `{ "company_file": "<Id>" }`, QuickBooks: none). Leave the period to the template's defaults and tell the user to change the period in the report's controls; if they gave a period and the tool error lists the template's declared inputs, you may retry once with the matching date inputs.
4. If the tool returns template_not_found, the platform's Reporting Studio extension is not installed in this workspace: say "Ask your admin to install <Platform> Reporting Studio" and stop. Never hand-write the report.
5. Reply with the report button. The report validates itself; point the user to its checks banner.

### Xero — extension `xero-reporting-studio` (client input `org`)

- P09 Xero Aged Payables: `xero-aged-payables`
- P08 Xero Aged Receivables: `xero-aged-receivables`
- P07 Xero Balance Sheet: `xero-balance-sheet`
- Xero Bank Reconciliation Status: `xero-bank-reconciliation-status`
- Xero Budget vs Actual: `xero-budget-vs-actual`
- P14 Xero Business Health Scorecard: `xero-business-health-scorecard`
- P01 Xero Business Overview: `xero-business-overview`
- P13 Xero Cash Flow Manager: `xero-cash-flow-manager`
- P12 Xero Cash Position: `xero-cash-position`
- P10 Xero Cash Summary: `xero-cash-summary`
- Xero Exceptions Dashboard: `xero-exceptions-dashboard`
- Xero General Ledger: `xero-general-ledger`
- Xero GST Reconciliation: `xero-gst-reconciliation-detail`
- P05 Xero GST Summary (BAS): `xero-activity-statement`
- Xero Month-End Task List: `xero-month-end-task-list`
- P11 Xero Performance Overview: `xero-performance-overview`
- P06 Xero Profit and Loss: `xero-profit-and-loss`
- Xero Profit and Loss by Tracking Category: `xero-tracking-category-pnl`
- P03 Xero Purchases Overview: `xero-purchases-overview`
- Xero Report Pack: `xero-report-pack`
- P04 Xero Reports Catalogue: `xero-reports-catalog`
- P02 Xero Sales Overview: `xero-sales-overview`
- Xero Sales Register: `xero-sales-register`
- Xero Trial Balance: `xero-trial-balance`
- P15 Xero Visualise: `xero-visualise`

### MYOB — extension `myob-reporting-studio` (client input `company_file`)

- M25 MYOB Accrual by Fund: `accrual-by-fund`
- M40 MYOB Aged Payables: `aged-payables`
- M32 MYOB Aged Receivables: `aged-receivables`
- M02 MYOB Balance Sheet: `balance-sheet`
- M15 MYOB Bank Activity: `bank-activity`
- M17 MYOB Bank Reconciliation Status: `myob-bank-reconciliation-status`
- M16 MYOB Bank Transactions: `bank-transactions`
- M01 MYOB Budget Management: `budget-management`
- M05 MYOB Cash Movement: `cash-movement`
- M10 MYOB Categories List: `categories-list`
- M11 MYOB Categories Transactions: `categories-transactions`
- M18 MYOB Coding: `coding`
- M12 MYOB Contacts: `contacts`
- M35 MYOB Customer Sales: `customer-sales`
- M36 MYOB Customer Sales (Detail): `myob-customer-sales-detail`
- M37 MYOB Customer Transactions: `customer-transactions`
- M00 MYOB Dashboard: `dashboard`
- M59 MYOB Exceptions Dashboard: `exceptions-dashboard`
- M08 MYOB General Ledger: `general-ledger`
- M06 MYOB GST Summary (BAS): `gst-summary`
- M52 MYOB Inventory Value Reconciliation: `inventory-value-reconciliation`
- M51 MYOB Item List: `item-list`
- M39 MYOB Item Sales: `item-sales`
- M49 MYOB Item Sales Analysis: `item-sales-analysis`
- M50 MYOB Items Register: `items-register`
- M56 MYOB Job Activity: `job-activity`
- M57 MYOB Job Exceptions: `job-exceptions`
- M53 MYOB Job Profit and Loss: `job-profit-and-loss`
- M54 MYOB Job Profit and Loss Comparison: `job-profit-and-loss-comparison`
- M55 MYOB Job Transactions: `job-transactions`
- M09 MYOB Journal Entries: `journal-entries`
- M28 MYOB Leave Balance: `leave-balance`
- M30 MYOB Pay Item Transactions: `pay-item-transactions`
- M23 MYOB Pay Run History: `myob-pay-run-history`
- M41 MYOB Payables Reconciliation: `payables-reconciliation`
- M21 MYOB Payroll Register: `payroll-register`
- M20 MYOB Payroll Summary: `payroll-summary`
- M04 MYOB Profit and Loss: `profit-and-loss`
- M46 MYOB Purchase Register: `purchase-register`
- M33 MYOB Receivables Reconciliation: `receivables-reconciliation`
- M47 MYOB Reorder: `reorder`
- M60 MYOB Report Pack: `myob-report-pack`
- M63 MYOB Reports Catalogue: `myob-reports-catalogue`
- M38 MYOB Sales Register: `sales-register`
- M19 MYOB Statement of Cash Flows: `myob-statement-of-cash-flows`
- M48 MYOB Stock on Hand: `stock-on-hand`
- M27 MYOB Superannuation Payments: `myob-superannuation-payments`
- M43 MYOB Supplier Purchases: `supplier-purchases`
- M44 MYOB Supplier Purchases (Detail): `myob-supplier-purchases-detail`
- M45 MYOB Supplier Transactions: `supplier-transactions`
- M14 MYOB Taxable Payments Annual Report: `taxable-payments-annual-report`
- M24 MYOB Timesheets: `timesheets`
- M03 MYOB Trial Balance: `trial-balance`
- M40 MYOB Unpaid Bills: `unpaid-bills`
- M32 MYOB Unpaid Invoices: `unpaid-invoices`

### QuickBooks — extension `quickbooks-reporting-studio` (no client input: one company per connection)

- Q26 QuickBooks Aged Payables: `quickbooks-aged-payables`
- Q24 QuickBooks Aged Receivables: `quickbooks-aged-receivables`
- Q34 QuickBooks ATO Reports: `quickbooks-ato-reports`
- Q18 QuickBooks Balance Sheet: `quickbooks-balance-sheet`
- Q08 QuickBooks Budget vs Actual: `quickbooks-budgets`
- Q01 QuickBooks Business Feed: `quickbooks-business-feed`
- Q00 QuickBooks Business Overview: `quickbooks-homepage`
- Q20 QuickBooks Business Snapshot: `quickbooks-business-snapshot`
- Q07 QuickBooks Cash Flow Overview: `quickbooks-cash-flow-overview`
- Q16 QuickBooks Client Overview: `quickbooks-client-overview`
- Q12 QuickBooks Customer Hub: `quickbooks-customer-hub`
- Q25 QuickBooks Customer Sales: `quickbooks-sales-and-customers`
- Q33 QuickBooks Employee Reports: `quickbooks-employee-reports`
- Q31 QuickBooks Employees and Time: `quickbooks-employees-and-time`
- Q36 QuickBooks Exchange Gains and Losses: `quickbooks-exchange-gains-losses`
- Q09 QuickBooks Forecasts: `quickbooks-forecasts`
- Q23 QuickBooks General Ledger: `quickbooks-general-ledger`
- Q15 QuickBooks GST Overview: `quickbooks-gst-overview`
- Q28 QuickBooks GST Summary (BAS): `quickbooks-gst-bas`
- Q14 QuickBooks Inventory Overview: `quickbooks-inventory-overview`
- Q30 QuickBooks Inventory Valuation: `quickbooks-inventory`
- Q32 QuickBooks Payroll Reports: `quickbooks-payroll-reports`
- Q06 QuickBooks Performance Overview: `quickbooks-performance-centre`
- Q17 QuickBooks Profit and Loss: `quickbooks-profit-and-loss`
- Q29 QuickBooks Project Profit and Loss: `quickbooks-projects`
- Q13 QuickBooks Projects Overview: `quickbooks-projects-overview`
- Q10 QuickBooks Purchases Overview: `quickbooks-expenses-overview`
- Q04 QuickBooks Report Pack: `quickbooks-management-reports`
- Q02 QuickBooks Reports Catalogue: `quickbooks-reports-catalogue`
- Q11 QuickBooks Sales Overview: `quickbooks-sales-overview`
- Q19 QuickBooks Statement of Cash Flows: `quickbooks-statement-of-cash-flows`
- Q27 QuickBooks Supplier Purchases: `quickbooks-expenses-and-suppliers`
- Q22 QuickBooks Trial Balance: `quickbooks-trial-balance`

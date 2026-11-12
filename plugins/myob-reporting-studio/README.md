# MYOB Reporting Studio

Live MYOB reports for the Reports library. Each report reads the connected MYOB company file every time it opens, so the figures are always current, and it checks its own figures against MYOB's other reports and shows the result in a banner at the top. Nothing is written back to MYOB.

There is no agent in this extension. People open the reports from **Reports → From your plugins** ("Use this report"), or ask mySidekick, which loads this extension's skills.

## What's included

### Connectors

- **myob-accounting** (the mySMB MYOB connector). Every live report reads from its tools.

### Report templates (56)

| Report | MYOB Reports Prompt Library | Template |
|---|---|---|
| MYOB Accrual by Fund | M25, M26 | `accrual-by-fund` |
| MYOB Aged Payables | Added | `aged-payables` |
| MYOB Aged Receivables | Added | `aged-receivables` |
| MYOB Balance Sheet | M02 | `balance-sheet` |
| MYOB Bank Activity | M15 | `bank-activity` |
| MYOB Bank Reconciliation Status | M17 | `myob-bank-reconciliation-status` |
| MYOB Bank Transactions | M16 | `bank-transactions` |
| MYOB Budget Management | M01 | `budget-management` |
| MYOB Cash Movement | M05 | `cash-movement` |
| MYOB Categories List | M10 | `categories-list` |
| MYOB Categories Transactions | M11 | `categories-transactions` |
| MYOB Coding | M18 | `coding` |
| MYOB Contacts | M12 | `contacts` |
| MYOB Customer Sales | M35 | `customer-sales` |
| MYOB Customer Sales (Detail) | M36 | `myob-customer-sales-detail` |
| MYOB Customer Transactions | M37 | `customer-transactions` |
| MYOB Dashboard | M00 | `dashboard` |
| MYOB Exceptions Dashboard | M59 | `exceptions-dashboard` |
| MYOB General Ledger | M08 | `general-ledger` |
| MYOB GST Summary (BAS) | M06, M07, M61 | `gst-summary` |
| MYOB Inventory Value Reconciliation | M52 | `inventory-value-reconciliation` |
| MYOB Item List | M51 | `item-list` |
| MYOB Item Sales | M39 | `item-sales` |
| MYOB Item Sales Analysis | M49 | `item-sales-analysis` |
| MYOB Items Register | M50 | `items-register` |
| MYOB Job Activity | M56 | `job-activity` |
| MYOB Job Exceptions | M57, M58 | `job-exceptions` |
| MYOB Job Profit and Loss | M53 | `job-profit-and-loss` |
| MYOB Job Profit and Loss Comparison | M54 | `job-profit-and-loss-comparison` |
| MYOB Job Transactions | M55 | `job-transactions` |
| MYOB Journal Entries | M09 | `journal-entries` |
| MYOB Leave Balance | M28, M29 | `leave-balance` |
| MYOB Pay Item Transactions | M30 | `pay-item-transactions` |
| MYOB Pay Run History | M23 | `myob-pay-run-history` |
| MYOB Payables Reconciliation | M41, M42 | `payables-reconciliation` |
| MYOB Payroll Register | M21 | `payroll-register` |
| MYOB Payroll Summary | M20 | `payroll-summary` |
| MYOB Profit and Loss | M04 | `profit-and-loss` |
| MYOB Purchase Register | M46 | `purchase-register` |
| MYOB Receivables Reconciliation | M33, M34 | `receivables-reconciliation` |
| MYOB Reorder | M47 | `reorder` |
| MYOB Report Pack | M60 | `myob-report-pack` |
| MYOB Reports Catalogue | M63 | `myob-reports-catalogue` |
| MYOB Sales Register | M38 | `sales-register` |
| MYOB Statement of Cash Flows | M19 | `myob-statement-of-cash-flows` |
| MYOB Stock on Hand | M48 | `stock-on-hand` |
| MYOB Superannuation Payments | M27 | `myob-superannuation-payments` |
| MYOB Supplier Purchases | M43 | `supplier-purchases` |
| MYOB Supplier Purchases (Detail) | M44 | `myob-supplier-purchases-detail` |
| MYOB Supplier Transactions | M45 | `supplier-transactions` |
| MYOB Taxable Payments Annual Report | M14 | `taxable-payments-annual-report` |
| MYOB Timesheets | M24 | `timesheets` |
| MYOB Trial Balance | M03 | `trial-balance` |
| MYOB Unpaid Bills | M40 | `unpaid-bills` |
| MYOB Unpaid Invoices | M32 | `unpaid-invoices` |
| Unpaid & Aged Accounts — MYOB | Added | `unpaid-aged-accounts-myob` |

Every report has a company-file picker (when the connection reaches several files), period and accounting-basis controls, a choice of detail level, MYOB or mySMB styling, Download PDF and Download Excel. The window's Download and Share save a frozen snapshot. At the Summary detail level, payroll reports leave each employee's pay out of the page and the Excel file.

**Unpaid & Aged Accounts — MYOB** is a hand-built template (not from the kit). The same template also ships in the `myob-accounting` extension, so a workspace with both installed lists it twice.

### Without a template

- **Journal Security Audit (M13)** and **Workers Compensation — Estimation of wages (M31)**: MYOB's API doesn't expose these, so mySidekick builds a frozen page from the MYOB export the user attaches.
- **Custom reports (M62)**: a guide. mySidekick saves any template with the user's own settings as a named live report.

### Skills (61)

- **`myob-report-foundation`**: how to make any of the reports, the controls, the validation rules and the connector facts. Load it first.
- **One skill per report** (the template's name, or `myob-…` for newer ones): its inputs, defaults, checks and tested report. mySidekick uses them to create a report from its template with `artifact_from_template`.
- **`myob-schedule-report`**: make a report again on a schedule, through mySidekick's scheduled tasks (LIB-003).
- **`myob-report-to-workq`**: turn what a report flags into WorkQ items (LIB-006).

## Configuration

No configuration variables are required. Connect MYOB under Settings → Connections.

## Maintaining it

The templates and skills are generated from `scripts/myob-reporting-kit` (see its README): change the kit, run its tests, regenerate, then open a PR. Publish from `dev` in the Console. Pull it into the Developer Instance after a change on `dev`, and don't save it there before that Pull: a save commits the Developer Instance's older copy over `dev`.

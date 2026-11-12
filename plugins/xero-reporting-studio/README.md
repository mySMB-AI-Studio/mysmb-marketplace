# Xero Reporting Studio

Live Xero reports for the Reports library. Each report reads the connected Xero organisation every time it opens, so the figures are always current, and it checks its own figures against Xero's other reports and shows the result in a banner at the top. Nothing is written back to Xero.

There is no agent in this extension. People open the reports from **Reports → From your plugins** ("Use this report"), or ask mySidekick, which loads this extension's skills.

## What's included

### Connectors

- **xero-accounting** (the mySMB Xero connector). Every report reads from its tools.
- **Xero GST Summary (BAS)** also reads Xero Payroll (AU) when that connector is installed and connected. Without it, those sections say "not connected" and the rest of the report still works.
- **Xero Month-End Task List** also reads Xero Payroll (AU) and Xero Assets when those connectors are installed and connected. Without them, those sections say "not connected" and the rest of the report still works.

### Report templates (25)

| Report | Xero Reports Prompt Library | Template |
|---|---|---|
| Xero GST Summary (BAS) | P05 | `xero-activity-statement` |
| Xero Aged Payables | P09 | `xero-aged-payables` |
| Xero Aged Receivables | P08 | `xero-aged-receivables` |
| Xero Balance Sheet | P07 | `xero-balance-sheet` |
| Xero Bank Reconciliation Status | Added | `xero-bank-reconciliation-status` |
| Xero Budget vs Actual | Added | `xero-budget-vs-actual` |
| Xero Business Health Scorecard | P14 | `xero-business-health-scorecard` |
| Xero Business Overview | P01 | `xero-business-overview` |
| Xero Cash Flow Manager | P13 | `xero-cash-flow-manager` |
| Xero Cash Position | P12 | `xero-cash-position` |
| Xero Cash Summary | P10 | `xero-cash-summary` |
| Xero Exceptions Dashboard | Added | `xero-exceptions-dashboard` |
| Xero General Ledger | Added | `xero-general-ledger` |
| Xero GST Reconciliation | Added | `xero-gst-reconciliation-detail` |
| Xero Month-End Task List | Added | `xero-month-end-task-list` |
| Xero Performance Overview | P11 | `xero-performance-overview` |
| Xero Profit and Loss | P06 | `xero-profit-and-loss` |
| Xero Purchases Overview | P03 | `xero-purchases-overview` |
| Xero Report Pack | Added | `xero-report-pack` |
| Xero Reports Catalogue | P04 | `xero-reports-catalog` |
| Xero Sales Overview | P02 | `xero-sales-overview` |
| Xero Sales Register | Added | `xero-sales-register` |
| Xero Profit and Loss by Tracking Category | Added | `xero-tracking-category-pnl` |
| Xero Trial Balance | Added | `xero-trial-balance` |
| Xero Visualise | P15 | `xero-visualise` |

Every report has an organisation picker (when the connection reaches several organisations), period and accounting-basis controls, a choice of detail level, Xero or mySMB styling, Download PDF and Download Excel. The window's Download and Share save a frozen snapshot.

What the Xero API doesn't hold is shown as "N/A — not in source": for example the lodged activity statement (the GST Summary works it out from transactions instead), Xero's Analytics widgets and industry benchmarks.

### Skills (28)

- **`xero-report-foundation`**: how to make any of the reports, the controls, the validation rules and the connector facts. Load it first.
- **One skill per report** (the template's name): its inputs, defaults, checks and tested document. mySidekick uses them to create a report from its template with `artifact_from_template`.
- **`xero-schedule-report`**: make a report again on a schedule, through mySidekick's scheduled tasks (LIB-003).
- **`xero-report-to-workq`**: turn what a report flags into WorkQ items (LIB-006).

## Configuration

No configuration variables are required.

## Maintaining it

The templates and skills are generated from `scripts/xero-reporting-kit` (see its README): change the kit, run its tests, regenerate, then open a PR. Publish from `dev` in the Console. Don't edit this extension in the Developer Instance: its copy is older than `dev`, and a save there would put the old copy back on `dev`.

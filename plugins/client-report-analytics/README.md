# Client Report Analytics

Live, validated reports for **one client at a time** from the user's own Xero, MYOB or QuickBooks connections, plus the **Client Report Analytics Agent** that builds them. This is Wave 1 of the Practice & Client Report Analytics Reporting Library (client side).

| ID | Report | Templates |
|---|---|---|
| CRA-00 | Client Report Catalogue: every client report as a box for the selected client | `client-report-catalogue` |
| CRA-01 | Financial Overview: revenue, GP, NP, margins vs last year, bank balances, AR/AP ageing | `client-{xero,myob,quickbooks}-financial-overview` |
| CRA-05 | Summary of Tax Amounts by Type: GST per tax type per month, reconciled | `client-{xero,myob,quickbooks}-tax-by-type` |
| CRA-07 | BAS Related Transactions and GST: every BAS line by tax type, contact, source, account | `client-{xero,myob,quickbooks}-bas-transactions` |
| CRA-16 | Platform-native reports: routes to the Xero, MYOB and QuickBooks Reporting Studio templates | (the studios' own templates) |

Each report fetches live data on every open, recomputes its validation checks (figures tie to the platform's own reports) and has a client picker, period and basis controls, Download PDF / Excel and the mySMB.com brand by default.

## Configuration

No configuration variables are required. Users connect Xero, MYOB and / or QuickBooks in Settings → Connections. QuickBooks gives one company per connection. MYOB per-company-file selection needs the myob-accounting connector with the company-file override (on dev / staging). CRA-16 needs the matching Reporting Studio extension installed.

## Maintaining it

The report templates, skills and agent are generated from `scripts/client-report-analytics-kit` (see its README). **Never Pull this extension into the Developer Instance and never save it there**: the Developer Instance does not keep `reports/` and would delete the templates.

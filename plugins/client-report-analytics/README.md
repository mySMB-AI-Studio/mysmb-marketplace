# Client Report Analytics

Live, validated reports for **one client at a time** from the user's own Xero, MYOB or QuickBooks connections, as report templates (Reports → From your plugins) and skills that mySidekick uses to build them. The extension has no agent: the **Client Reporting Agent** package (`client-report-analytics-agent`) uses these templates for report requests sent through WorkQ. This is Wave 1 of the Practice & Client Report Analytics Reporting Library (client side).

| ID | Report | Templates |
|---|---|---|
| CRA-00 | Client Report Catalogue: every client report as a box for the selected client | `client-report-catalogue` |
| CRA-01 | Financial Overview: revenue, GP, NP, margins vs last year, bank balances, AR/AP ageing | `client-{xero,myob,quickbooks}-financial-overview` |
| CRA-05 | Summary of Tax Amounts by Type: GST per tax type per month, reconciled | `client-{xero,myob,quickbooks}-tax-by-type` |
| CRA-07 | BAS Related Transactions and GST: every BAS line by tax type, contact, source, account | `client-{xero,myob,quickbooks}-bas-transactions` |
| CRA-16 | Platform-native reports: routes to the Xero, MYOB and QuickBooks Reporting Studio templates | (the studios' own templates) |

Each report fetches live data on every open, recomputes its validation checks (figures tie to the platform's own reports) and has a client picker, period and basis controls, Download PDF / Excel and the mySMB.com brand by default.

## Configuration

No configuration variables are required.

## Maintaining it

The report templates and skills are generated from `scripts/client-report-analytics-kit` (see its README). **Don't save this extension in the Developer Instance before you Pull it.** A save commits the Developer Instance's copy over dev; Pull keeps `reports/` (myHubV2's report component kind, since late October 2026), so Pull first and the templates survive. Better still, change it in the kit and publish from dev.

# Practice Report Analytics

Live, validated reports **across every client** the user's Xero and MYOB connections expose, one row per client, computed server-side. This is Wave 1 of the Practice & Client Report Analytics Reporting Library (practice side, step 2).

| ID | Report | Template |
|---|---|---|
| PRA-00 | Practice Report Catalogue: every practice-wide report as a box | `practice-report-catalogue` |
| PRA-01 | Client Summary Metrics: counts of contacts, accounts, invoices, bills, employees per client | `practice-client-summary` |
| PRA-02 | Sales Summary Metrics: outstanding/overdue, DSO, receipts, per client | `practice-sales-summary` |
| PRA-03 | Purchases Summary Metrics: outstanding/overdue bills, DPO, suppliers, per client | `practice-purchases-summary` |
| PRA-04 | Bank Reconciliation Summary: statement vs ledger, unreconciled lines, per client | `practice-bank-reconciliation-summary` |
| PRA-05 | Banking Summary Metrics: cash in/out, net, unreconciled, per client | `practice-banking-summary` |
| PRA-06 | Financial Overview: revenue, GP, NP, bank balances, AR/AP ageing, per client | `practice-financial-overview` |

Each report fans out server-side across every client (new `get_practice_*` tools on the existing `xero-accounting` and `myob-accounting` connectors — **not** a separate connector; same OAuth connections users already have, no extra Connect step), recomputes its validation checks on every open, and has PDF/Excel downloads with the mySMB.com brand by default.

**QuickBooks is excluded** from every practice-wide report: it is one company per connection, so there is nothing to consolidate. Its one connected company has its own report in the Client Report Analytics agent instead.

## Configuration

No configuration variables are required. Users connect Xero and/or MYOB in Settings → Connections. The MYOB per-company-file fan-out needs the `myob-accounting` connector's company-file override (dev/staging only as of this writing — see the connector's own notes); MYOB practice reports are not yet production-ready for that reason.

## Maintaining it

The report templates, skills and agent are generated from `scripts/practice-report-analytics-kit` (see its README). **Never Pull this extension into the Developer Instance and never save it there**: the Developer Instance does not keep `reports/` and would delete the templates.

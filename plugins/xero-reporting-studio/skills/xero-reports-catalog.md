---
name: xero-reports-catalog
description: Build an interactive index of the Xero report library, grouped by category, with search and links to each implemented report. Use for "reports catalog", "what reports can you build", "report library", "list of Xero reports".
---
# Reports Catalog

Use `get_organisation` for context (bound with `organisation` per the foundation, plus `list_connections` for the picker), then load the specific report skill selected by the user.

Build an interactive HTML index grouped into Financial statements, Payables and receivables, Reconciliations, Taxes and balances, Transactions, Dashboards, Planning, and Analytics. Include search/filter controls and concise descriptions. Link the implemented library entries: Business Overview, Sales Overview, Purchases Overview, Activity Statement (a GST summary — not a lodgeable BAS), Profit and Loss, Balance Sheet, Aged Receivables, Aged Payables, Cash Summary (built from the bank summary), Performance Overview, Cash Position, Cash Flow Manager, Business Health Scorecard, and Visualise.

Validate every implemented entry maps to a loaded skill and label unsupported catalog entries not yet implemented. Entries with no connector endpoint (Activity Statement lodgement, cash-flow statement, Xero Analytics widgets, benchmarks) say so rather than "coming soon".

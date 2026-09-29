---
name: xero-activity-statement
description: Build a live GST summary for a period from Xero sales invoices and bills — GST collected, GST paid and net GST — clearly marked as not a lodgeable BAS. Use for "activity statement", "BAS", "GST summary", "GST owed", "GST collected and paid".
---
# Activity Statement (BAS) — GST summary

There is no Activity Statement / BAS endpoint on the connector. Build a **GST summary, not a BAS**, and show an unmissable banner: "This is not your Activity Statement — lodge from Xero → Tax → Activity statements. Not tax advice."

Ask for the statement period. Use `list_invoices` with `where: Type=="ACCREC"` (GST collected) and `where: Type=="ACCPAY"` (GST paid), `statuses: AUTHORISED,PAID`, `order: Date DESC`, paged per the foundation and filtered to the period on `DateString`, summing `TotalTax` (and `SubTotal` for the GST-exclusive value). Use `list_tax_rates` (`ReportTaxType`, `Name`, `EffectiveRate`) to label and group line-level `TaxType` / `TaxAmount` when line items are returned. Optionally net off credit notes from `list_credit_notes` (`ACCRECCREDIT` / `ACCPAYCREDIT`, `TotalTax`). The summary is accrual (invoice date) only; cash-basis GST is N/A — not in source. G-field (G1, G2, G3, G10, G11) and PAYG fields (W1–W4, PAYG instalments) are N/A — not in source; never ask the user to type them in and never infer them.

Render period context, GST collected, GST paid, net GST, and a per-tax-rate breakdown. State that spend/receive-money bank transactions and manual journals are not included unless sourced, so the figures may differ from Xero's Activity Statement.

Validate net GST = GST collected (1A equivalent) − GST paid (1B equivalent), each total equals its rows, and the per-tax-rate breakdown sums to the invoice totals. Checks are N/A if paging was truncated. State that this is a reporting summary, not tax advice.
## Interactivity

The statement period is a client-side preset picker (month, quarter, financial year from `get_organisation`) over the loaded rows — no bound tool takes a date, so it is not a declared input. Declare `organisation` and `page` per the foundation. All tables sortable client-side.

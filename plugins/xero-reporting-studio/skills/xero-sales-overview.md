---
name: xero-sales-overview
description: Build a live Xero sales overview — invoices by status, money coming in this week and next, customers owing the most, top customers and billable expenses. Use for "sales overview", "invoices", "money coming in", "top customers", "who owes us most".
---
# Sales Overview

Sales invoices are `list_invoices` with `where: Type=="ACCREC"`, `statuses: DRAFT,SUBMITTED,AUTHORISED`, `order: DueDate ASC`, paged per the foundation. Top customers by revenue come from the same tool aggregated by `Contact` client-side (a second binding with `statuses: AUTHORISED,PAID`, filtered to the period on `DateString`, summing `SubTotal`) — there is no top-customers tool and no all-contacts aged-receivables tool. Use `get_organisation` for context and `list_linked_transactions` (`status: APPROVED`) for billable expenses not yet invoiced.

Show KPI cards for Draft, Awaiting approval (SUBMITTED), Awaiting payment (AUTHORISED), and Overdue (AUTHORISED with `DueDate` before today); money due this week and next week with ageing/time buckets on `DueDate`; customers owing the most sorted by `AmountDue` with overdue highlighted; and billable expenses when sourced.

Validate KPI amounts against available invoice detail, Due ≥ Overdue for each customer, and top-customer totals ≤ total receivables.
## Interactivity

No binding here takes a date parameter, so the top-customers period (this month, this quarter, YTD from the organisation's financial year end) is a client-side preset over the loaded rows — not a declared input. Declare `organisation` and `page` per the foundation. Customer filter box and sortable tables client-side; recompute visible totals over the filtered view, labelled as filtered.

---
name: MYOB Unpaid Invoices
description: Generate a MYOB Unpaid Invoices report — outstanding sales invoices, sorted by urgency.
---

# Unpaid Invoices

Use `list_invoices` filtered to open/unpaid status. This is a listing endpoint, not a report endpoint — no `AsOfDate`/date-range parameter mismatch risk here, but confirm the exact accepted status value by calling the tool once before assuming it's literally "Open" (the tool description says it filters by Open/Closed/All — verify the exact enum string the schema expects rather than guessing).

Present one row per invoice: invoice number, customer, invoice date, due date, amount outstanding, and days overdue (or days until due, for invoices not yet due) — computed as (today − due date). Sort by most overdue first by default. Group or visually separate into Overdue vs. Not Yet Due, and show a count and subtotal for each group plus a grand total.

Optionally scope to a single customer via `customer_uid` when the request asks for one customer's outstanding invoices specifically, rather than the whole ledger.

Verify internal consistency before finalizing: the sum of all listed invoice amounts must equal the displayed grand total — if `list_invoices` paginates and doesn't return every open invoice in one call, say so explicitly rather than silently reporting a partial total as if it were complete.

Validate:
* Sum of invoice rows = grand total shown
* Overdue subtotal + not-yet-due subtotal = grand total

Show any discrepancy prominently.

## Interactivity

* Declare a `customer` input (optional enum, mapped to `customer_uid`) when scoping to one customer.
* Declare a `min_days_overdue` input for a client-side severity filter (e.g. "90+ days only") — this is client-side filtering over already-hydrated data, not a new tool call, since the full open-invoice list is already retrieved. 
* Table is sortable by any column and filterable by customer name/invoice number, per the shared foundation skill's rules.

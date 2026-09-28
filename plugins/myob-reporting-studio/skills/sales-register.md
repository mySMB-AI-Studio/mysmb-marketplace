---
name: MYOB Sales Register
description: Generate a MYOB Sales Register — a chronological list of all sales invoices for a period.
---

# Sales Register

Use `list_invoices` with `status: "All"` (a sales register shows every invoice issued in the period, not just open/unpaid ones — don't default to the "Open" status the tool otherwise defaults to) and a `from_date`/`to_date` range.

Discover the invoice's total-value field before assuming a name. `BalanceDueAmount` is the outstanding balance, not the invoice total — a paid invoice would show $0 there even though it was a real sale. Call the tool once and confirm which field holds the full invoice value (check for something like `TotalAmount`, `Subtotal + TaxTotal`, or similar) before building the report. If no total field is present and only balance-due is available, say so plainly in Sources & limitations rather than silently using the wrong number.

Present a chronological table: invoice date, invoice number, customer, total amount, status (Open/Closed/Credit), and outstanding balance if different from the total. Sort by date by default. Show a period total and a count of invoices.

Validate:
* Sum of listed invoice totals equals the displayed period total
* If MYOB's response is paginated and the fetched count is less than the source's reported total, say so explicitly rather than presenting a partial total as complete (same check used in Unpaid Invoices).

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, last quarter, YTD). 
* Declare `customer` as an optional enum input mapped to `customer_uid`. 
* Table sortable by any column, filterable by customer name/invoice number.

# Aged Payables Summary

Use `get_aged_payables`.

Confirm as-at date, ageing basis, and optional grouping. Show supplier rows across connector-provided ageing buckets, total, grand total, and percentage shares. Highlight overdue exposure without inventing payment plans.

Validate every row total, grand total, and percentage shares.
## Interactivity

Declare `as_at_date` (date, default "today") and `ageing_basis` (enum: due_date, invoice_date) inputs that re-query the binding. Add a client-side supplier filter box and sortable bucket columns; recompute totals and percentage rows in JavaScript over the filtered view, labelled as filtered.

# Aged Payables Summary

Use `get_aged_payables`.

Confirm as-at date, ageing basis, and optional grouping. Show supplier rows across connector-provided ageing buckets, total, grand total, and percentage shares. Highlight overdue exposure without inventing payment plans.

Validate every row total, grand total, and percentage shares.
## Interactivity

Declare `as_at_date` (date, default "today") mapped 1:1 to the tool's report-date parameter. Expose an ageing-basis control only if the tool takes it as a parameter; otherwise omit it. Supplier filter box and sortable bucket columns are client-side; recompute totals and percentage rows in JavaScript over the filtered view, labelled as filtered.

# Aged Receivables Summary

Use `get_aged_receivables`.

Confirm as-at date and ageing by due date or invoice date. Show customer rows across current/<1 month, 1 month, 2 months, 3 months, older, and total buckets (adapt labels to the connector response), plus grand total and percentage-of-total rows. Highlight concentrated and overdue balances without making collection claims.

Validate every row total, grand total, and that percentage shares sum to 100% subject to rounding.
## Interactivity

Declare `as_at_date` (date, default "today") mapped 1:1 to the tool's report-date parameter. Expose an ageing-basis control only if the tool takes it as a parameter; otherwise omit it. Customer filter box and sortable bucket columns are client-side; recompute totals and percentage rows in JavaScript over the filtered view, labelled as filtered.

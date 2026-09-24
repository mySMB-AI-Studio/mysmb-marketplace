# Aged Receivables Summary

Use `list_invoices` with `where: Type=="ACCREC"` and a status filter for outstanding invoices (AUTHORISED). Xero's native `get_aged_receivables_by_contact` report requires a `contactId` per call — there is no all-customers mode in Xero's API (same limitation as Aged Payables). Do not loop that tool per customer; aggregate from invoice data directly.

Confirm as-at date and whether ageing is by due date or invoice date. Bucket each open invoice by (as-at date − chosen date) into Current/<1 month, 1 month, 2 months, 3 months, Older, using `AmountDue`. Group by `Contact.Name`, showing customer rows across buckets, per-customer total, grand total, and percentage-of-total.

Highlight concentrated and overdue balances without making collection claims.

Validate: each customer row's buckets sum to its total; all customer totals sum to the grand total; percentage shares sum to 100% subject to rounding.
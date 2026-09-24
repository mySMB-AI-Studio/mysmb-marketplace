# Aged Payables Summary

Use `list_invoices` with `where: Type=="ACCPAY"` and a status filter for outstanding bills (AUTHORISED), for a supplier scope if given. Xero's native `get_aged_payables_by_contact` report requires a `contactId` per call — there is no all-suppliers mode in Xero's API (a known, long-standing Xero API gap). Do not loop that tool per supplier; aggregate from invoice data directly.

Confirm as-at date and ageing basis. Bucket each open bill by (as-at date − DueDate) into Current / 1-30 / 31-60 / 61-90 / 90+ using the invoice's `AmountDue` and `DueDate`. Group by `Contact.Name`, showing supplier rows across buckets, per-supplier total, grand total, and percentage shares.

Validate: each supplier row's buckets sum to its total; all supplier totals sum to the grand total; bucket percentages sum to 100%. Highlight overdue exposure without inventing payment plans.
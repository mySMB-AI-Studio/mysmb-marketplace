---
name: xero-aged-payables
description: Build a live all-suppliers Aged Payables summary from open Xero bills, bucketed by due or bill date. Use for "aged payables", "aged creditors", "who do we owe", "overdue bills", "creditor ageing".
---
# Aged Payables Summary

There is no all-contacts ageing report on the connector (`get_aged_payables_by_contact` needs one `contactID` per call), and there is no separate bills tool — bills are `list_invoices` with `where: Type=="ACCPAY"`. Build the summary from `list_invoices` (`where: Type=="ACCPAY"`, `statuses: AUTHORISED`, `order: DueDate ASC`, paged per the foundation) and bucket each bill's `AmountDue` client-side. Optionally add `list_credit_notes` (`where: Type=="ACCPAYCREDIT" AND Status=="AUTHORISED"`) and show `RemainingCredit` as a negative "Unallocated credits" line per supplier. Use the per-contact report only if the user asks for Xero's own ageing for ONE supplier (with its required `contactID`).

Confirm as-at date, ageing basis (due date or bill date), and optional grouping. Show supplier rows (grouped by `Contact.ContactID`, labelled `Contact.Name`) across Current, < 1 month, 1 month, 2 months, 3 months, and Older buckets, per-supplier total, grand total, and percentage shares. Exclude bills dated after the as-at date; when the as-at date is not today, show a banner that `AmountDue` is today's balance and only the bucketing moves. Convert foreign-currency bills to `BaseCurrency` with `AmountDue ÷ CurrencyRate` and disclose it. Highlight overdue exposure without inventing payment plans.

Validate every row total, grand total, and percentage shares. When the as-at date is today, compare the grand total to Accounts Payable from `get_balance_sheet` as an informational tie (N/A otherwise). Completeness checks are N/A if paging was truncated.
## Interactivity

Declare `as_at_date` (date, default "today"), mapped to `get_balance_sheet`'s `date` for the payables tie, and used client-side as the bucketing date. Ageing basis is a client-side toggle over the same rows (no re-query). Declare `page` (number) per the foundation's paging rule, plus `organisation`. Supplier filter box and sortable bucket columns are client-side; recompute totals and percentage rows in JavaScript over the filtered view, labelled as filtered.

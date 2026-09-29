---
name: xero-aged-receivables
description: Build a live all-customers Aged Receivables summary from open Xero sales invoices, bucketed by due or invoice date. Use for "aged receivables", "aged debtors", "who owes us", "overdue invoices", "debtor ageing".
---
# Aged Receivables Summary

There is no all-contacts ageing report on the connector (`get_aged_receivables_by_contact` needs one `contactID` per call). Build the summary from `list_invoices` with `where: Type=="ACCREC"`, `statuses: AUTHORISED`, `order: DueDate ASC`, paged per the foundation, and bucket each invoice's `AmountDue` client-side. Optionally add `list_credit_notes` (`where: Type=="ACCRECCREDIT" AND Status=="AUTHORISED"`) and show `RemainingCredit` as a negative "Unallocated credits" line per customer. Do not loop the per-contact report across customers; use it only if the user asks for Xero's own ageing for ONE customer (a drill-down with its required `contactID`).

Confirm as-at date and ageing by due date or invoice date. Show customer rows (grouped by `Contact.ContactID`, labelled `Contact.Name`) across Current, < 1 month, 1 month, 2 months, 3 months, and Older buckets, plus per-customer total, grand total, and percentage-of-total rows. Exclude invoices dated after the as-at date. `AmountDue` is today's balance, so when the as-at date is not today show a banner that only the bucketing moves, not the balances. Convert foreign-currency invoices to `BaseCurrency` with `AmountDue ÷ CurrencyRate` and disclose it (Xero's own aged report revalues at current rates, so small differences are expected). State the bucket method in Sources & limitations. Highlight concentrated and overdue balances without making collection claims.

Validate every row total (buckets sum to the customer total), grand total (customer totals sum to it), and that percentage shares sum to 100% subject to rounding. When the as-at date is today, compare the grand total to Accounts Receivable from `get_balance_sheet` as an informational tie (differences expected for prepayments, overpayments and FX; N/A otherwise). Completeness checks are N/A if paging was truncated.
## Interactivity

Declare `as_at_date` (date, default "today"), mapped to `get_balance_sheet`'s `date` for the receivables tie, and used client-side as the bucketing date. Ageing by due date or invoice date is a client-side toggle over the same rows (no re-query). Declare `page` (number) per the foundation's paging rule, plus `organisation`. Customer filter box and sortable bucket columns are client-side; recompute totals and percentage rows in JavaScript over the filtered view, labelled as filtered. Clicking a customer expands their open invoices from the rows already loaded.

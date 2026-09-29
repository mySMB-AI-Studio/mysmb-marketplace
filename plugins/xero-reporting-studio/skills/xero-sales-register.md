---
name: xero-sales-register
description: Build a live Xero sales register — every sales invoice in a period, with a per-invoice Register view and a grouped By-Customer view over the same data. Use for "sales register", "customer sales report", "invoice listing", "sales by customer".
---
# Sales Register / Customer Sales

Use `list_invoices` (`where: Type=="ACCREC"`, `statuses: AUTHORISED,PAID`, `order: Date DESC`, paged per the foundation), filtered to the requested period client-side on `DateString`. Register and By-Customer are two VIEWS over the SAME loaded rows — never two separate queries; group by `Contact.ContactID` (labelled `Contact.Name`) client-side for the By-Customer view.

Register view: one row per invoice — date, invoice number, customer, status, subtotal, tax, total, amount due. By-Customer view: one row per customer — invoice count, subtotal, tax, total, amount due, and (for unpaid invoices in the period) an overdue amount; sorted by total descending by default. Show a period grand total on both views.

Validate that By-Customer totals sum to the Register grand total (both are client-side aggregations of the one binding, over the same rows, so this always ties exactly — a mismatch means a grouping bug, not a data gap) and that the row count matches the number of invoices fetched; N/A when paging was truncated.
## Interactivity

`list_invoices` has no date-range parameter, so the period is applied to the loaded rows client-side on `DateString` — not a declared input. Declare `page` (number) per the foundation's paging rule and `organisation`; `where` (static `"Type==\"ACCREC\""`) and `statuses` (static `"AUTHORISED,PAID"`) are fixed at authoring — the register shows issued and paid sales invoices, not drafts. Register ⇄ By-Customer is a client-side view toggle over the same rows; customer/invoice filter box and sortable columns are client-side, recomputing totals over the filtered view, labelled as filtered.

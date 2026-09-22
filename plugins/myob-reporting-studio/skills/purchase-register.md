# Purchase Register (Bills)

Prompt ID M46 · Reporting › Reports › Purchases › Purchase register. MYOB's own report covers "all quotes, orders and bills within the specified date range" — this connector has no confirmed tool for `Purchase/Order` or `Purchase/Quote`, only `Purchase/Bill` (via `list_bills`). Build this as a **Bills register**, an honest named subset, the same precedent `myob-sales-register` set by covering invoices only (not sales quotes/orders) rather than inventing calls to entities this connector doesn't expose.

Use `list_bills` with `status: "All"` and a `from_date`/`to_date` range. Confirm the bill total-value field the same way Supplier Purchases does — don't assume `TotalAmount` without checking.

Present a chronological table: bill date, bill number, supplier, total amount, status (Open/Closed/Debit), and outstanding balance if different from the total. Sort by date by default. Show a period total and a count of bills.

Validate:
* Sum of listed bill totals equals the displayed period total
* If MYOB's response is paginated and the fetched count is less than the source's reported total, say so explicitly rather than presenting a partial total as complete

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, last quarter, YTD).
* Declare `supplier` as an optional enum input mapped to `supplier_uid`.
* Table sortable by any column, filterable by supplier name/bill number.

## Sources & limitations

Tool used: `list_bills` (status=All, date-ranged). **Scope gap, state prominently in the report itself, not just here:** purchase quotes and purchase orders are not included — no tool exists for `Purchase/Order` or `Purchase/Quote` in this connector today. This report is bills only.

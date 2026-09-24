# Supplier Purchases

Prompt ID M43 · Reporting › Reports › Purchases › Supplier purchases. Mirrors `myob-customer-sales`' pattern for the payables side.

Use `list_bills` with `status: "All"` and a `from_date`/`to_date` range — a purchases report shows every bill issued in the period, not just open/unpaid ones. Sum `TotalAmount` per bill (confirm this field the same way Customer Sales/Sales Register confirmed `TotalAmount` over `BalanceDueAmount` for invoices — don't assume the field name carries over without checking once during generation, since `list_bills` is a distinct endpoint).

Aggregate by supplier: total purchases value, bill count, and average bill value, ranked by total purchases descending by default. Show what share of the period's total each supplier represents (top supplier's % of period total) — same concentration framing as Customer Sales.

Validate:
* Sum of all suppliers' totals equals the period grand total
* If MYOB's response is paginated and the fetched count is less than the source's reported total, say so explicitly rather than presenting a partial total as complete

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, last quarter, YTD).
* Table sortable by total, bill count, or supplier name.
* A text filter on supplier name.
* Consider a simple bar visualization of top $N$ suppliers by total — client-side, from already-hydrated data.

## Sources & limitations

Tool used: `list_bills` (status=All, date-ranged). Same total-value field-discovery caveat as the sales-side reports — confirm before relying on it, don't assume `TotalAmount` exists on `Purchase/Bill` just because it exists on `Sale/Invoice`.

---
name: MYOB Supplier Purchases
description: Purchases by supplier for a period. Declares a detail_level toggle — Summary ranks suppliers by total purchases; Detail adds per-bill line-item breakdown (account, description, quantity, price).
---

# Supplier Purchases

Prompt ID M43/M44 (merged) · Reporting › Reports › Purchases › Supplier purchases / Supplier purchases (detail). Mirrors `myob-customer-sales`' merged pattern for the payables side.

Use `list_bills` with `status: "All"` and a `from_date`/`to_date` range — a purchases report shows every bill issued in the period, not just open/unpaid ones. Sum `TotalAmount` per bill (confirm this field the same way Customer Sales/Sales Register confirmed `TotalAmount` over `BalanceDueAmount` for invoices — don't assume the field name carries over without checking once during generation, since `list_bills` is a distinct endpoint).

**Always render the Summary section**, regardless of `detail_level`: aggregate by supplier — total purchases value, bill count, average bill value, ranked by total purchases descending. Show what share of the period's total each supplier represents (top supplier's % of period total).

**When `detail_level` is "Detail", additionally render the bill-level section**: call `get_bill` once for a sample bill during generation to check for a `Lines` array — this is NOT confirmed in the current connector schema (`list_bills`/`get_bill` are raw pass-through, so whatever MYOB's `/Purchase/Bill/{uid}` actually returns is unverified until checked).
- **If `Lines` is present:** fetch it per bill (N+1 calls — one per bill in the period; say so plainly if the period contains a large number of bills, since this means one call per bill, not one call total) and render account, description, quantity, unit price, and tax code per line. Group by bill: header row (supplier, date, bill number, total) with expandable line rows beneath.
- **If `Lines` is absent or the shape differs:** disclose this honestly and fall back to bill-level summary (same fields as Summary mode) rather than guessing a line shape — say plainly this degrades to bill-level summary with no added detail.

Validate:
* Sum of all suppliers' totals equals the period grand total
* If MYOB's response is paginated and the fetched count is less than the source's reported total, say so explicitly rather than presenting a partial total as complete
* In Detail mode, when lines are available: sum of a bill's line amounts equals that bill's `TotalAmount`

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, last quarter, YTD).
* Declare `supplier` as an optional enum input mapped to `supplier_uid`.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — this is NOT the same as `persona`. `persona` controls display density of already-fetched data; `detail_level` controls whether the extra `get_bill` line-item fetch happens at all. Client/Executive personas still hide detail-blocks even when `detail_level` is Detail (persona rules always win on visibility) — `detail_level` only gates whether the data gets fetched in the first place.
* Declare `persona` per the foundation skill.
* Table sortable by total, bill count, or supplier name; a text filter on supplier name. Bill rows (Detail mode) expand/collapse client-side, no per-row data call once hydrated.

## Sources & limitations

Tools used: `list_bills` (status=All, date-ranged); in Detail mode, `get_bill` per bill for line detail. Same total-value field-discovery caveat as the sales-side reports — confirm before relying on it, don't assume `TotalAmount` exists on `Purchase/Bill` just because it exists on `Sale/Invoice`. State plainly whether this company file's bills actually returned a `Lines` array when in Detail mode.

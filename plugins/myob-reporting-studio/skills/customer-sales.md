---
name: MYOB Customer Sales
description: Sales by customer for a period. Declares a detail_level toggle — Summary ranks customers by total sales; Detail adds per-invoice line-item breakdown (account, description, quantity, price). If the user wants payments/credits included too, use MYOB Customer Transactions instead.
---

# Customer Sales

Prompt ID M35/M36 (merged) · MYOB menu: Reporting › Reports › Sales › Customer sales / Customer sales (detail).

Use `list_invoices` with `status: "All"`, `page_index: 0` (all pages) and a `from_date`/`to_date` range — same data source and total-value field discovery as Sales Register (load that skill's guidance if already run, don't rediscover independently).

**Always render the Summary section**, regardless of `detail_level`: aggregate by customer — total sales value, invoice count, average invoice value, ranked by total sales descending. Show what share of the period's total each customer represents (top customer's % of period total).

**When `detail_level` is "Detail", additionally render the invoice-level section**: during the generation turn, call `get_invoice` once for a sample invoice UID to discover whether the response includes a `Lines` array with line-item fields (account, description, units, unit price, tax code) — do not assume the shape, MYOB's line-item detail sometimes sits behind a layout-specific view.
- **If `Lines` is present:** render each invoice as a row with an expandable block showing its line items. If the `list_invoices` rows don't already carry `Lines`, fetch them with one `get_invoice` binding (`invoice_uid` mapped from a `string` input) re-called in a bounded client-side `getData` loop per the foundation's fan-out rule — say so when the period holds many invoices.
- **If `Lines` is absent:** fall back to invoice-level summary only (number, customer, date, status, `TotalAmount`) and state plainly that per-line detail isn't available from this connector — the same honest-substitution approach used for GST Summary.

Validate (0.01 tolerance): sum of all customers' totals equals the period grand total; in Detail mode, invoice count and `TotalAmount` sum must also equal `list_invoices`' own returned aggregate for the same filter.

## Interactivity

* Declare `from_date`/`to_date` inputs with the standard preset picker.
* Declare `customer` as an optional `string` UID input (maxLength 36), a presentation filter over the unfiltered `list_invoices` binding (the ranking needs every customer anyway) — fill its dropdown from the customers in the returned rows and filter client-side. The binding omits `customer_uid`; never pass `""`.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — this is NOT the same as `persona`. `persona` controls display density of already-fetched data; `detail_level` controls whether the extra `get_invoice` line-item fetch happens at all. Client/Executive personas still hide detail-blocks even when `detail_level` is Detail (persona rules always win on visibility) — `detail_level` only gates whether the data gets fetched in the first place.
* Declare `persona` and `company_file` per the foundation skill.
* Table sortable by total, invoice count, or customer name; a text filter on customer name. Invoice rows (Detail mode) expand/collapse client-side, no per-row data call.

## Sources & limitations

Tools used: `list_invoices` (status=All, date-ranged); in Detail mode, `get_invoice` sampled once per generation to determine whether line-item detail is available. State which branch (line detail vs. invoice-level summary) is running when in Detail mode.

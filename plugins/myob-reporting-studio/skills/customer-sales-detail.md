# Customer Sales (Detail)

Prompt ID M36 · MYOB menu: Reporting › Reports › Sales › Customer sales (detail). MYOB's own description: "Detailed information for all invoices within the specified date range."

Use `list_invoices` with `status: "All"` and a `from_date`/`to_date` range for the invoice list (same source as Customer Sales/Sales Register — load that skill's field discovery if already run, don't rediscover independently).

During the generation turn, call `get_invoice` once for a sample invoice UID from the list to discover whether the response includes a `Lines` array with line-item fields (account, description, units, unit price, tax code). Do not assume the shape — MYOB's line-item detail sometimes sits behind a layout-specific view, not the plain entity GET.

* **If `Lines` is present:** render each invoice as a row with an expandable `detail-block` showing its line items (account name, description, units, unit price, tax code, line amount). Hidden for Client/Executive personas per the foundation skill's persona rules; visible for Bookkeeper/Practitioner.
* **If `Lines` is absent or the sample call doesn't resolve it:** fall back to invoice-level summary only (number, customer, date, status, `TotalAmount`) and state plainly in Sources & limitations that per-line detail isn't available from this connector for this report — the same honest-substitution approach already used for GST Summary. Do not guess field names for line items you haven't confirmed exist.

Validate: invoice count and sum of `TotalAmount` shown must equal `list_invoices`' own returned count/aggregate for the same filter — this holds regardless of which fallback branch above is taken.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped 1:1 to `list_invoices`' params, with the standard preset picker.
* Declare `customer` as an optional enum input mapped to `customer_uid`.
* Declare `persona` per the foundation skill.
* Invoice rows expand/collapse client-side once line data (if available) is hydrated — no per-row data call.

## Sources & limitations

Tool used: `list_invoices` (status=All, date-ranged); `get_invoice` sampled once per generation to determine whether line-item detail is available. State which branch (line detail vs. invoice-level summary) this report is running in.

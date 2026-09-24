# Item Sales

Prompt ID M39. Menu: Reporting › Reports › Sales › Item sales.

Use `list_items` for the item master list (Number, Name, `BaseSellingPrice`, quantities on hand). `Inventory/Item` carries no sales-value or sales-quantity aggregate fields — confirmed against MYOB's docs — so sales figures must come from invoice lines: call `list_invoices` (status=All, date-ranged), then during generation call `get_invoice` once to discover whether the response includes a `Lines` array with an item reference. If it does, aggregate quantity and line revenue per item across all invoices in range and join to the `list_items` master data by item UID/Number. If `Lines` (or an item reference on each line) is not present in `get_invoice`'s response, say plainly that item-level sales cannot be built from this connector today and point to the MYOB export fallback — do not approximate by assuming an average price times quantity-on-hand movement.

Render one row per item: Number, Name, quantity sold, total revenue, current `BaseSellingPrice` for reference. Sort by revenue descending by default.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `list_invoices`.
* Declare an optional `item` filter (client-side, since the data is already fully hydrated per range) rather than a new binding.
* `persona` input per the foundation skill.

## Sources & limitations

Tools used: `list_items` (item master) + `list_invoices`/`get_invoice` (sales aggregation). This is a cross-referenced report, not a single native endpoint — MYOB's API has no item-sales report endpoint. State this plainly, and state clearly if the `Lines`-discovery check fails (see above) rather than shipping fabricated figures.

---
name: MYOB Items Register
description: Transaction-level movement history per item — sales and stock adjustments over a date range. Use MYOB Item List for master data only, or MYOB Stock on Hand for current quantities, not this report.
---

# Items Register

Prompt ID M50 · Reporting › Reports › Inventory › Items register. MYOB's description: "A detailed list of transactions for inventory items."

Unlike Item List/Stock on Hand/Reorder (which read `list_items` alone, master data only), this is a genuine transaction-level view — combine two sources:

1. **Sales movements**: `list_invoices` (status=All, date-ranged), then during generation call `get_invoice` once to discover whether the response includes a `Lines` array with an item reference — same Lines-discovery-with-honest-fallback rule as Item Sales/Item Sales Analysis. If absent, disclose plainly that sales movements can't be shown and fall back to adjustments only.
2. **Stock adjustments**: `list_inventory_adjustments` (date-ranged), which returns adjustment header (`Date`, `Memo`, `InventoryJournalNumber`) plus `Lines[]` with `Item`, `Quantity` (signed — positive/negative), `UnitCost`, `Amount`, and a line-level `Memo`.

Join both sources by item UID/Number from `list_items`. Present one section per item: a chronological transaction list mixing sales (negative quantity movement, customer, invoice number) and adjustments (signed quantity, memo/reason, adjustment number). Show a running quantity balance per item across the combined, date-sorted list.

**Do not silently drop the sales side just because it's a two-step discovery** — attempt it every time and disclose the actual outcome (found/not found) rather than defaulting to adjustments-only without saying so.

Validate: for each item, the running balance's final value should reconcile to `list_items`' own `QuantityOnHand` (as a loosely-dated reference — this report has no true as-of-date snapshot capability, same limitation as every other MYOB skill in this library, so treat exact reconciliation as directional, not exact, and say so).

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker.
* Declare an optional `item` filter (enum from `list_items`).
* Declare `persona` per the foundation skill — Client/Executive show per-item net movement totals only; Bookkeeper/Practitioner show the full transaction list.

## Sources & limitations

Tools used: `list_items` (item master, cross-reference), `list_invoices`/`get_invoice` (sales movements, Lines-discovery caveat applies), `list_inventory_adjustments` (stock adjustments). This is a cross-referenced report, not a single native endpoint — state plainly if the sales-side Lines discovery fails, and note the running-balance-to-QuantityOnHand check is directional, not an exact as-of-date tie-out.

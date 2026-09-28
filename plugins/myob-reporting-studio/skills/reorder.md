---
name: MYOB Reorder
description: Items that need reordering based on their configured minimum stock level.
---

# Reorder

Prompt ID M47 · Reporting › Reports › Inventory › Reorder. MYOB's description: "A list of your items to be reordered based upon your minimum stock levels."

Use `list_items`. Filter to items where `BuyingDetails.RestockingInformation.MinimumLevelForRestockingAlert` is set AND `QuantityOnHand <= MinimumLevelForRestockingAlert`. Items with no minimum level configured are excluded entirely — a missing configuration is not the same as "needs reorder," and treating it that way would silently invent a threshold MYOB was never told to apply.

Render one row per flagged item: `Number`, `Name`, `QuantityOnHand`, `MinimumLevelForRestockingAlert`, `DefaultOrderQuantity` (the suggested reorder quantity), and `Supplier` (name, from `RestockingInformation.Supplier`) as the suggested action. Sort by how far below the minimum each item is (largest shortfall first).

State plainly in the summary how many items were excluded for having no minimum level configured, so the reader knows this list isn't exhaustive of every low-stock item — only the ones MYOB is configured to watch.

## Interactivity

* `persona` input per the foundation skill — Client/Executive personas show the flagged-item count and total suggested reorder value; Bookkeeper/Practitioner show the full per-item table.

## Sources & limitations

Tool used: `list_items`. Reorder logic (minimum level, default order quantity, preferred supplier) all comes from `BuyingDetails.RestockingInformation` — confirmed real fields, not derived or estimated. Current-moment snapshot, no as-of-date capability.

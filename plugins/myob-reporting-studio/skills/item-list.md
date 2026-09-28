---
name: MYOB Item List
description: A list of inventory items with item master information (number, name, prices, active status).
---

# Item List

Prompt ID M51 · Reporting › Reports › Inventory › Item list. MYOB's description: "A list of your items with item information."

Use `list_items` (`is_active` optional). This is item master data only — no cross-referencing needed. Render one row per item: `Number`, `Name`, `BaseSellingPrice`, `StandardCost` (from `BuyingDetails`), `IsActive`. Include `AverageCost` and `CurrentValue` as reference columns since they're already on the item record.

If `is_active` isn't set, show all items but make the active/inactive status visually distinct (e.g. a muted row style for inactive items) rather than mixing them indistinguishably.

## Interactivity

* Declare an optional `active_only` boolean input mapped to `is_active`.
* Table sortable by name, price, or cost; filterable by name/number text (client-side, over already-hydrated data).
* `persona` input per the foundation skill.

## Sources & limitations

Tool used: `list_items`. Pure item master data — no sales, stock movement, or transaction figures are shown here (see Stock on Hand and Item Sales Analysis for those).

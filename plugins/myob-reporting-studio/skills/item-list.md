---
name: MYOB Item List
description: A list of inventory items with item master information (number, name, prices, active status).
---

# Item List

Prompt ID M51 · Reporting › Reports › Inventory › Item list. MYOB's description: "A list of your items with item information."

Use `list_items` with `is_active` omitted, so every item comes back. This is item master data only — no cross-referencing needed. Render one row per item: `Number`, `Name`, `BaseSellingPrice`, `StandardCost` (from `BuyingDetails`), `IsActive`. Include `AverageCost` and `CurrentValue` as reference columns since they're already on the item record.

When all items are shown, make the active/inactive status visually distinct (e.g. a muted row style for inactive items) rather than mixing them indistinguishably.

## Interactivity

* Declare an `active_only` boolean presentation input (default `true`) that filters client-side on `IsActive`. Don't bind it to `is_active`: when it's off the report must show ALL items, and sending `is_active: false` would return only the inactive ones.
* Table sortable by name, price, or cost; filterable by name/number text (client-side, over already-hydrated data).
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tool used: `list_items`. Pure item master data — no sales, stock movement, or transaction figures are shown here (see Stock on Hand and Item Sales Analysis for those).

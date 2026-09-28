---
name: MYOB Stock on Hand
description: Current stock level quantities per item — on hand, committed, and on order.
---

# Stock on Hand

Prompt ID M48 · Reporting › Reports › Inventory › Stock on hand. MYOB's description: "Displays current stock level quantities, and inventoried items committed and on order."

Use `list_items`. Render one row per item: `Number`, `Name`, `QuantityOnHand`, `QuantityCommitted`, `QuantityOnOrder`, `QuantityAvailable`.

During generation, check whether `QuantityAvailable` actually equals `QuantityOnHand − QuantityCommitted` across a sample of items — this relationship is a reasonable assumption, not independently confirmed by MYOB's docs. If the numbers reconcile, show it as a validated equation. If they don't reconcile for some items, don't force the formula or hide the discrepancy — state plainly that `QuantityAvailable` is MYOB's own computed figure and may account for something this report doesn't have visibility into (e.g. a different on-order/backorder rule), and show all four raw figures rather than a derived one.

## Interactivity

* Optional item-name filter (client-side).
* Highlight items where `QuantityOnHand` is zero or negative.
* `persona` input per the foundation skill.

## Sources & limitations

Tool used: `list_items`. Figures are current-moment snapshot quantities — there is no as-of-date capability, consistent with every other MYOB skill in this library that reads from live entity data rather than a dated report endpoint.

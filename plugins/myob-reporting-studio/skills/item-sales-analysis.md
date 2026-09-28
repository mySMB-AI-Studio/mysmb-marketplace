---
name: MYOB Item Sales Analysis
description: Use when the user wants MARGIN or trend analysis per item — gross margin, margin %, or a month-by-month performance view. If they just want quantity and revenue totals with no margin/cost comparison, use MYOB Item Sales instead.
---

# Item Sales Analysis

Prompt ID M49 · Reporting › Reports › Inventory › Item sales analysis. MYOB's description: "Analyse your items' sales performance over time." Extends Wave 2's Item Sales skill (`myob-item-sales.md`) with margin analysis — reuse its exact aggregation approach rather than redesigning it.

Use `list_items` for item master data (`Number`, `Name`, `AverageCost`). Use `list_invoices` (status=All, date-ranged), then during generation call `get_invoice` once to discover whether the response includes a `Lines` array with an item reference — same Lines-discovery-with-honest-fallback rule as `myob-item-sales.md`. If `Lines` is absent, say plainly that item-level sales analysis cannot be built from this connector today and point to the MYOB export fallback — do not approximate.

If `Lines` is present: aggregate quantity and revenue per item across invoices in range, join to `list_items` by item UID/Number, and compute gross margin per item as `revenue − (quantity × AverageCost)`, plus margin % (`margin / revenue`). If the date range spans multiple calendar months, group the aggregation by month for a trend view (quantity/revenue/margin per item per month); for a single-month or shorter range, show one flat table instead.

**Disclose plainly:** `AverageCost` is a snapshot at generation time, not the item's historical cost at the time each sale happened — margin shown for older sales is an approximation using today's average cost, not a true point-in-time cost figure. State this once, clearly, not buried in a footnote.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `list_invoices`.
* Declare an optional `item` filter (client-side, over already-hydrated data).
* `persona` input per the foundation skill — Client/Executive personas show top-N items by revenue/margin only; Bookkeeper/Practitioner show the full per-item (or per-item-per-month) breakdown.

## Sources & limitations

Tools used: `list_items` (cost/master data) + `list_invoices`/`get_invoice` (sales aggregation, same Lines-discovery caveat as Item Sales). Margin is approximated from current `AverageCost`, not historical cost-at-sale — disclosed above, not a silent estimate. State clearly if the `Lines`-discovery check fails.

---
name: square-manage-inventory
description: Check and adjust Square inventory counts. Use when the user asks about stock levels, wants to add or remove inventory, or needs a count for a specific item.
---

# Manage Square inventory

All Square operations use the `make_api_request` tool:
`make_api_request({ service: "<service>", method: "<method>", request?: { ...params } })`

## Check stock levels

- `make_api_request({ service: "inventory", method: "getCount", request: { catalog_object_id: "...", location_ids?: [...] } })` — stock for a specific item variant.
- `make_api_request({ service: "inventory", method: "batchGetcounts", request: { catalog_object_ids: [...], location_ids: [...] } })` — up to 1,000 item variants in one call.

## Adjust inventory

Call `make_api_request({ service: "inventory", method: "batchChange", request: { changes: [...], idempotency_key: "..." } })`.

Each change in the `changes` array needs:
- `type`: `"PHYSICAL_COUNT"` (sets an absolute count) or `"ADJUSTMENT"` (adds/removes units with a reason like `"RECEIVE"` or `"SALE"`)
- `physical_count.quantity` or `adjustment.quantity` — string representation of the quantity
- `physical_count.location_id` / `adjustment.location_id`
- `occurred_at` — ISO 8601 UTC timestamp in the format `YYYY-MM-DDTHH:MM:SSZ` (e.g. `2024-06-15T03:00:00Z`). Use the current UTC time if not specified. Square rejects local-time strings without a UTC offset.
- `idempotency_key` — unique per batch

## Location awareness

Every inventory call requires a `location_id`. If the user has not specified one, call `make_api_request({ service: "locations", method: "list" })` first and ask the user to choose the correct location before proceeding.

## Catalog lookups

Before adjusting, look up the item's variation ID:
1. `make_api_request({ service: "catalog", method: "searchItems", request: { text_filter: "item name" } })` — search by name to find the parent item.
2. `make_api_request({ service: "catalog", method: "getObject", request: { object_id: "...", include_related_objects: true } })` — get variation IDs nested under `item_data.variations`.

Other verified catalog methods: `list`, `upsertObject`, `deleteObject`, `searchObjects`, `batchGetobjects`, `batchUpsertobjects`, `batchDeleteobjects`.

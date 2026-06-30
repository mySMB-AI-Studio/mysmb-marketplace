---
name: stripe-prices
description: Create or list Stripe prices. Triggers on "create price", "add price to product", "list prices", "show pricing", "set up recurring price", "one-time price", or similar.
---

# Stripe Prices

Use the `create_price` and `list_prices` tools from the `stripe` MCP server.

## Listing prices

Call `list_prices` with optional filters:
- `product` — Stripe product ID to scope to one product
- `active` — `true` to show only active prices
- `limit` — number of results (default 10, max 100)

Present each price with: ID, product, amount (÷ 100), currency, and billing scheme (one-time vs recurring interval).

## Creating a price

Call `create_price` with:

| Field | Required | Description |
|---|---|---|
| `currency` | yes | ISO code, e.g. `"aud"` |
| `unit_amount` | yes* | Amount in smallest unit (e.g. `2900` = $29.00) |
| `product` | yes* | Existing Stripe product ID |

*`unit_amount` is required unless using `custom_unit_amount`. `product` is required unless using `product_data`.

### One-time price
No extra fields needed beyond the above.

### Recurring (subscription) price
Add a `recurring` object:
- `interval` — `day`, `week`, `month`, or `year`
- `interval_count` — how many intervals per billing period (e.g. `3` with `month` = quarterly)
- `usage_type` — `licensed` (fixed) or `metered` (usage-based)

## How to use

1. If the user mentions a product by name, resolve it via `list_products` first to get the product ID.
2. Clarify whether the price is one-time or recurring. For recurring, confirm the billing interval.
3. Call `create_price` with the collected fields.
4. Echo back the new Price ID and a summary (amount, currency, billing interval).

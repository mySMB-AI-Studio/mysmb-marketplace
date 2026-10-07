---
name: stripe-coupons
description: Create or list Stripe coupons. Triggers on "create coupon", "add discount", "list coupons", "show discount codes", "new promo", or similar.
---

# Stripe Coupons

Use the `create_coupon` and `list_coupons` tools from the `stripe` MCP server.

## Listing coupons

Call `list_coupons` with optional `limit` (default 10, max 100). Returns active and inactive coupons. Present each with:
- Coupon ID and name
- Discount type: percent-off (`percent_off`) or amount-off (`amount_off` ÷ 100)
- Duration: `once`, `repeating` (with `duration_months`), or `forever`
- Redemption count and max redemptions (if set)

## Creating a coupon

Call `create_coupon`. Exactly one of the following must be provided:

| Field | Description |
|---|---|
| `percent_off` | Percentage discount (e.g. `20` for 20%) |
| `amount_off` | Fixed discount in smallest currency unit (e.g. `1000` = $10.00 AUD) |

Required when using `amount_off`:
- `currency` — ISO currency code (e.g. `"aud"`)

Optional fields:
- `name` — human-readable label shown on invoices
- `duration` — `once`, `repeating`, or `forever` (default `once`)
- `duration_in_months` — required if `duration` is `repeating`
- `max_redemptions` — cap on how many times it can be used
- `redeem_by` — Unix timestamp after which the coupon expires
- `id` — custom coupon code (auto-generated if omitted)

## How to use

1. Extract the discount type and amount from the user's request.
2. Clarify duration and expiry if not stated.
3. Call `create_coupon` with the collected fields.
4. Echo back the new coupon ID and discount summary so the user can confirm.

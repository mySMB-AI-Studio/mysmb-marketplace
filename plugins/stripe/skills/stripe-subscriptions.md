---
name: stripe-subscriptions
description: List, update, or cancel Stripe subscriptions. Triggers on "show subscriptions", "cancel subscription", "update subscription", "pause plan", "change plan", "active subscriptions", or similar.
---

# Stripe Subscriptions

Use the `list_subscriptions`, `update_subscription`, and `cancel_subscription` tools from the `stripe` MCP server.

## Listing subscriptions

Call `list_subscriptions` with optional filters:
- `customer` — Stripe customer ID to scope to one customer
- `status` — `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `trialing`, or `all`
- `limit` — number of results (max 100)

## Updating a subscription

Call `update_subscription` with the `subscription` ID and the fields to change:
- `items` — array of `{ id, price }` to change the plan or price
- `trial_end` — Unix timestamp or `"now"` to end a trial immediately
- `metadata` — key-value pairs
- `cancel_at_period_end` — set `true` to schedule graceful cancellation without cancelling immediately

Always resolve the subscription ID before calling update. If the user refers to a customer by name, use `list_customers` → `list_subscriptions` to find it.

## Cancelling a subscription

Call `cancel_subscription` with the `subscription` ID.
- **Graceful (at period end):** use `update_subscription` with `cancel_at_period_end: true` — the subscription stays active until the billing period ends.
- **Immediate:** call `cancel_subscription` directly — the subscription ends now.

**Always confirm with the user before cancelling.** Immediate cancellation is not reversible through the MCP server.

## Working style

1. List first, then act — never update or cancel without showing the user what you found.
2. If the user provides a name or email, resolve it via `list_customers` first.
3. After any write, echo back the subscription `id` and updated `status`.

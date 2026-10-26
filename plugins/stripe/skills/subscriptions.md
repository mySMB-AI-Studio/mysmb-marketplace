---
name: stripe-subscriptions
description: Look up Stripe subscriptions. Triggers on "show subscriptions", "active subscriptions", "subscription status", "who is subscribed", "recurring revenue", "list subscriptions", or similar.
---

# Stripe Subscriptions

Use the `list_subscriptions` and `get_subscription` tools from the `stripe` MCP server. This gateway is read-only — subscriptions cannot be created, updated, or cancelled here.

## Listing subscriptions

Call `list_subscriptions` with optional filters:

- `limit` — number of results (default 10, max 100)
- `starting_after` — a subscription ID to paginate past
- `customer` — scope to a specific Stripe customer ID
- `status` — one of: `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `trialing`, `all`, `ended`

## Getting a single subscription

Call `get_subscription` with the subscription ID (`sub_...`).

## Status values

| Status | Meaning |
|---|---|
| `active` | Subscription is live and billing normally |
| `trialing` | In a free trial period |
| `past_due` | Payment failed; Stripe is retrying |
| `unpaid` | Retries exhausted; access may be revoked |
| `incomplete` | Initial payment incomplete |
| `canceled` | Subscription ended |
| `ended` | Subscription reached its `cancel_at` date |

## Common queries

### All active subscriptions
Call `list_subscriptions` with `status: "active"` and `limit: 100`.

### Subscriptions for a specific customer
Resolve the customer ID with `list_customers`, then call `list_subscriptions` with `customer: "<id>"`.

### Past-due or at-risk subscriptions
Call `list_subscriptions` with `status: "past_due"` and `limit: 50`.

## Presenting results

For each subscription show:

- ID
- Customer ID
- Status (with plain-English explanation if not `active`)
- Current period end (Unix timestamp — convert to readable date)

## Pagination

If the user wants more results, pass the last `id` from the current page as `starting_after`.

## Limitations

This gateway is read-only. For updating plans, cancelling subscriptions, or managing trials, direct the user to the Stripe Dashboard at https://dashboard.stripe.com/subscriptions.

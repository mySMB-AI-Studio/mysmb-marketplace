---
name: stripe-payment-intents
description: List Stripe payment intents. Triggers on "show payments", "list payment intents", "recent transactions", "failed payments", "succeeded payments", "payment history", or similar.
---

# Stripe Payment Intents

Use the `list_payment_intents` tool from the `stripe` MCP server.

## Parameters

- `limit` — number of results (default 10, max 100)
- `customer` — scope to a specific customer ID

## Status values

| Status | Meaning |
|---|---|
| `requires_payment_method` | Awaiting a payment method |
| `requires_confirmation` | Created but not yet confirmed |
| `requires_action` | Needs additional customer action (e.g. 3D Secure) |
| `processing` | Payment being processed |
| `succeeded` | Payment confirmed and captured |
| `canceled` | Payment intent was canceled |

## Common queries

### Recent payments
Call `list_payment_intents` with `limit: 20`.

### Payments for a specific customer
Resolve the customer ID via `list_customers`, then pass `customer: "<id>"`.

### Failed or stuck payments
Call `list_payment_intents`, then filter results to non-`succeeded` statuses. Alternatively, use `search_stripe_resources` with a query like `status:"requires_payment_method"`.

## Presenting results

For each payment intent show:
- ID
- Amount — divide `amount` by 100 for standard currencies (USD, AUD, EUR); check `currency` for zero-decimal exceptions
- Currency
- Status
- Customer (if set)
- Created date (Unix timestamp — convert to human-readable)

Offer pagination via `starting_after` if there are more results than the limit.

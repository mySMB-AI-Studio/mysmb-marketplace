---
name: stripe-payments
description: Look up Stripe payments (PaymentIntents). Triggers on "show payments", "recent transactions", "payment history", "failed payments", "succeeded payments", "how much came in", or similar.
---

# Stripe Payments

Use the `list_payments` and `get_payment` tools from the `stripe` MCP server.

## Listing payments

Call `list_payments` with optional filters:

- `limit` — number of results (default 10, max 100)
- `starting_after` — a payment ID to paginate past
- `customer` — scope to a specific Stripe customer ID

## Getting a single payment

Call `get_payment` with a `id` argument (the PaymentIntent ID, e.g. `pi_...`).

## Status values

| Status | Meaning |
|---|---|
| `succeeded` | Payment confirmed and funds captured |
| `processing` | Payment processing — outcome not yet final |
| `requires_payment_method` | Awaiting a payment method |
| `requires_action` | Needs additional customer action (e.g. 3D Secure) |
| `requires_confirmation` | Created but not yet confirmed |
| `canceled` | Payment intent was cancelled |

## Presenting results

For each payment show:

- Amount — divide `amount` by 100 for standard currencies (USD, AUD, EUR); check `currency` for zero-decimal exceptions (JPY, KRW, VND — do NOT divide for these)
- Currency
- Status
- Customer ID (if set)
- Created date (Unix timestamp — convert to a readable date before displaying)

## Common queries

### Recent payments
Call `list_payments` with `limit: 20`.

### Payments for a specific customer
Resolve the customer first with `list_customers`, then pass `customer: "<id>"` to `list_payments`.

### Failed or stuck payments
Call `list_payments`, then describe any non-`succeeded` results to the user. The gateway is read-only — direct the user to the Stripe Dashboard to take action on failed payments.

## Pagination

If the user wants more results, pass the last `id` in the current result set as `starting_after` to fetch the next page.

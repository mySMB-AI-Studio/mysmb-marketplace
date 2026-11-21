---
name: stripe-refunds
description: Issue a Stripe refund. Triggers on "refund payment", "refund customer", "issue refund", "process refund", "reverse charge", or similar.
---

# Stripe Refunds

Use the `create_refund` tool from the `stripe` MCP server.

## Required information

You need one of:
- `payment_intent` — the PaymentIntent ID (preferred, e.g. `pi_xxxxx`)
- `charge` — the Charge ID (e.g. `ch_xxxxx`)

## Optional fields

- `amount` — amount to refund in smallest currency unit (e.g. `1000` = $10.00 AUD). Omit to refund the full amount.
- `reason` — `duplicate`, `fraudulent`, or `requested_by_customer`
- `metadata` — key-value pairs for internal tracking

## How to use

1. Identify the payment to refund. If the user gives an order reference or customer name rather than a Stripe ID, use `list_payment_intents` or `search_stripe_resources` to locate the correct PaymentIntent.
2. Clarify whether the refund is full or partial. For a partial refund, confirm the exact amount.
3. **Confirm with the user before proceeding** — refunds cannot be undone through the MCP server.
4. Call `create_refund` with the `payment_intent` (or `charge`) and optional `amount`.
5. Echo back the refund ID, amount, and status.

## Important notes

- Refunds can take 5–10 business days to appear on the customer's statement.
- Stripe fees are not returned on refunds (varies by account and region).
- You cannot refund more than the original charge amount.

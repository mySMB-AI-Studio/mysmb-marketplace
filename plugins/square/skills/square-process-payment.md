---
name: square-process-payment
description: Process a payment through Square. Use when the user wants to take a payment, charge a card, create a payment link, or record a cash sale.
---

# Process a Square payment

All Square operations use the `make_api_request` tool:
`make_api_request({ service: "<service>", method: "<method>", request?: { ...params } })`

## Inputs

- `amount_money` — object with `amount` (integer, smallest currency unit e.g. cents) and `currency` (ISO 4217, e.g. `"AUD"`)
- `source_id` — card nonce, customer card on file ID, or `"CASH"` for cash
- `idempotency_key` — unique string per attempt; reuse the same key to safely retry
- `customer_id` — optional, links payment to a Square customer record
- `note` — optional, short description shown on the receipt
- `location_id` — optional, defaults to the merchant's main location

## How to use

1. Confirm amount and currency with the user before proceeding.
2. Call `make_api_request({ service: "payments", method: "create", request: { amount_money, source_id, idempotency_key } })`.
3. If the returned `status` is `COMPLETED`, report the payment ID and amount.
4. If `status` is `APPROVED` (card-present), call `make_api_request({ service: "payments", method: "complete", request: { payment_id } })`.
5. If the call fails with `CARD_DECLINED` or `INSUFFICIENT_FUNDS`, report the decline reason from `errors[0].detail`. Do not retry with the same card.
6. On any other error, report `errors[0].code` + `errors[0].detail` verbatim.

## Refunds

To refund: call `make_api_request({ service: "refunds", method: "payment", request: { payment_id, amount_money, idempotency_key } })`. Partial refunds are supported — set `amount_money` to less than the original.

## Payment links (no card present)

If the user wants to send a payment request: call `make_api_request({ service: "checkout", method: "createPaymentLink", request: { order: { line_items: [...] }, checkout_options: {} } })`. Return the `url` field for the customer to click.

## Safety rules

- Never log or echo a raw card nonce (`cnon:...`). Treat it as ephemeral.
- Always use a new `idempotency_key` per payment attempt. A UUID is fine.
- Confirm large amounts with the user before calling. "Large" is context-dependent — use judgement based on the merchant's typical transaction size, not a fixed currency-specific threshold.

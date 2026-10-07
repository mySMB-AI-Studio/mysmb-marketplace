---
name: stripe-balance
description: Retrieve the current Stripe account balance. Triggers on "what's my Stripe balance", "available balance", "pending balance", "how much money in Stripe", or similar.
---

# Stripe Balance

Use the `retrieve_balance` tool from the `stripe` MCP server.

## What it returns

- `available` — funds that can be paid out immediately, per currency
- `pending` — funds in transit (e.g. recently captured payments not yet settled)
- `connect_reserved` (if applicable) — funds held in reserve for connected accounts

Each entry is an array of `{ amount, currency }` objects. Amounts are in the smallest currency unit — cents for USD/AUD/EUR, whole units for zero-decimal currencies like JPY. Always check `currency` before dividing.

## How to use

1. Call `retrieve_balance` with no parameters.
2. For each currency in `available`, show the formatted amount (e.g. `$1,234.56 AUD`).
3. For each currency in `pending`, show the formatted amount with a note it is not yet available for payout.
4. If both available and pending exist for the same currency, group them together.

## Example narrative

> Your Stripe balance is **$4,250.00 AUD** available and **$890.00 AUD** pending.

Keep the response concise — no raw JSON unless the user asks.

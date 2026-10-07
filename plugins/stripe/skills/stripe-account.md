---
name: stripe-account
description: Retrieve Stripe account information. Triggers on "show my Stripe account", "what account is connected", "account details", "is my account enabled", or similar.
---

# Stripe Account Info

Use the `get_stripe_account_info` tool from the `stripe` MCP server.

## What it returns

- Account ID, display name, and country
- Default currency
- `charges_enabled` — whether the account can accept payments
- `payouts_enabled` — whether the account can pay out to a bank
- Business type and contact details

## How to use

1. Call `get_stripe_account_info` with no parameters.
2. Present the key fields: account name, country, default currency, and whether charges and payouts are active.
3. If `charges_enabled` or `payouts_enabled` is `false`, note that and point the user to the Stripe Dashboard to complete onboarding.

Keep the response concise — no raw JSON unless the user asks.

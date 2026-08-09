---
name: stripe-payment-links
description: Create a Stripe payment link. Triggers on "create payment link", "generate payment link", "shareable payment link", "link to pay", "hosted checkout link", or similar.
---

# Stripe Payment Links

Use the `create_payment_link` tool from the `stripe` MCP server.

## What a payment link is

A hosted URL Stripe generates that lets a customer pay without needing a full checkout integration. Useful for one-off sales, invoicing via chat/email, or quick product sales.

## Required information

- At least one **line item** — each item needs:
  - `price` — a Stripe Price ID (e.g. `price_xxxxx`)
  - `quantity` — number of units

If no Price ID exists yet, use `create_price` first to create one for the product.

## Optional fields

- `after_completion` — what happens after payment:
  - `{ "type": "redirect", "redirect": { "url": "https://..." } }` — redirect to a URL
  - `{ "type": "hosted_confirmation" }` — show a Stripe-hosted confirmation page (default)
- `allow_promotion_codes` — `true` to let customers apply coupon codes
- `metadata` — key-value pairs for your own tracking

## How to use

1. Confirm which product/price the link is for. If the user gives a product name, use `list_products` and `list_prices` to find the correct Price ID.
2. Confirm quantity.
3. Call `create_payment_link` with `line_items: [{ price, quantity }]` and any other options.
4. Return the `url` from the response — this is the shareable payment link.

The link is active immediately and can be shared via email, SMS, or any channel.

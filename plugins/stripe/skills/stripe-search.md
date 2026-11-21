---
name: stripe-search
description: Search Stripe resources or documentation. Triggers on "search Stripe", "find payment", "look up customer", "fetch Stripe object", "search Stripe docs", or similar when no specific resource type is obvious.
---

# Stripe Search & Fetch

Use the `search_stripe_resources`, `fetch_stripe_resources`, and `search_stripe_documentation` tools from the `stripe` MCP server.

## Search across Stripe objects

Call `search_stripe_resources` with a `query` string. Supports Stripe's search query syntax:

| Example query | What it finds |
|---|---|
| `email:"jane@example.com"` | Customers with that email |
| `name:"Acme Corp"` | Customers or products matching the name |
| `status:"open"` | Open invoices |
| `metadata["order_id"]:"1234"` | Any object with that metadata key/value |

Use this when the user knows what they are looking for but not the exact Stripe ID, or when searching across multiple resource types at once.

## Fetch a specific Stripe object

Call `fetch_stripe_resources` with an `id` (e.g. `cus_xxxxx`, `pi_xxxxx`, `sub_xxxxx`) or a relative API URL (e.g. `/v1/customers/cus_xxxxx`).

Use this when the user already has an ID and wants the full object details.

## Search the Stripe documentation

Call `search_stripe_documentation` with a `query` string to search the Stripe knowledge base. Use this when the user asks "how does X work in Stripe?" or needs guidance on a Stripe concept.

## How to use

1. If the user gives a Stripe ID directly, use `fetch_stripe_resources`.
2. If the user describes what they are looking for (name, email, status), use `search_stripe_resources`.
3. If the user asks a how-to or conceptual question about Stripe, use `search_stripe_documentation`.
4. Present results clearly — summarise rather than dumping raw JSON unless the user asks for it.

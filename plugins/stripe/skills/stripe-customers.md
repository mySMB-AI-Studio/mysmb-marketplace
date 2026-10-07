---
name: stripe-customers
description: Create or list Stripe customers. Triggers on "add customer to Stripe", "new Stripe customer", "create customer", "find customer", "list customers", "who are my customers", or similar.
---

# Stripe Customers

Use the `create_customer` and `list_customers` tools from the `stripe` MCP server.

## Listing customers

Call `list_customers` with optional filters:
- `email` — exact email match
- `limit` — number of results (default 10, max 100)

Present each customer with: ID, name, email, and created date (Unix timestamp — convert to human-readable).

To find a customer by name (not supported as a direct filter), use `search_stripe_resources` with a query like `name:"Jane Smith"`.

## Creating a customer

All fields are optional in Stripe, but at minimum collect one of:
- `email` — strongly recommended; used for receipts and deduplication
- `name` — full name or business name

Other useful fields:
- `phone`
- `description` — internal note (not shown to the customer)
- `metadata` — key-value pairs for your own record-keeping (e.g. `{ "crm_id": "123" }`)

## How to use

1. **Before creating**, check for an existing customer — call `list_customers` with `email: "<address>"`. If a match is found, show it and ask whether to update the existing record instead of creating a duplicate.
2. If no duplicate, call `create_customer` with the collected fields.
3. Echo back the new customer's `id` and `email` so the user can confirm.

## After creation

If the user intends to invoice this customer immediately, offer to call `create_invoice` next using the new customer ID.

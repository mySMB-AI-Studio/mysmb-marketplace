---
name: stripe-customers
description: Look up Stripe customers. Triggers on "find customer", "list customers", "who are my customers", "customer details", "look up customer", or similar.
---

# Stripe Customers

Use the `list_customers` and `get_customer` tools from the `stripe` MCP server. This gateway is read-only — customers cannot be created or modified here.

## Listing customers

Call `list_customers` with optional filters:

- `limit` — number of results (default 10, max 100)
- `starting_after` — a customer ID to paginate past
- `email` — exact email match (case-sensitive)

## Getting a single customer

Call `get_customer` with the customer ID (`cus_...`).

## How to use

1. If the user gives an email, call `list_customers` with `email: "<address>"`.
2. If the user gives a name, call `list_customers` with a reasonable `limit` and scan the results — the API does not support name-based filtering.
3. If the user gives a Stripe customer ID directly, call `get_customer`.

## Presenting results

For each customer show:

- ID (`cus_...`)
- Name
- Email
- Created date (Unix timestamp — convert to a readable date before displaying)

## Pagination

If the user wants more results, pass the last `id` from the current page as `starting_after`.

## Limitations

This gateway is read-only. For creating, updating, or deleting customers, direct the user to the Stripe Dashboard at https://dashboard.stripe.com/customers.

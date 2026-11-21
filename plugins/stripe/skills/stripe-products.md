---
name: stripe-products
description: Create or list Stripe products. Triggers on "create product", "add product to Stripe", "list products", "show catalog", "new service in Stripe", or similar.
---

# Stripe Products

Use the `create_product` and `list_products` tools from the `stripe` MCP server.

## Listing products

Call `list_products` with optional filters:
- `active` — `true` to show only active products (default shows all)
- `limit` — number of results (default 10, max 100)

Present each product with: ID, name, description (if set), and whether it is active.

## Creating a product

Call `create_product` with:

| Field | Required | Description |
|---|---|---|
| `name` | yes | Product or service name |
| `description` | no | Shown on invoices and receipts |
| `active` | no | `true` by default |
| `metadata` | no | Key-value pairs for internal tracking |
| `images` | no | Array of image URLs |
| `unit_label` | no | Label for what the unit represents (e.g. `"seat"`, `"hour"`) |

## How to use

1. Extract the product name and optional description from the user's request.
2. Call `create_product` with the collected fields.
3. Echo back the new product's `id` and `name`.
4. If the user wants to set a price for this product immediately, offer to call `create_price` next with the new product ID.

## Product vs Price

In Stripe, a **product** describes what you sell; a **price** describes how much it costs and how often. A product can have multiple prices (e.g. monthly and annual). Always create the product first, then add prices to it.

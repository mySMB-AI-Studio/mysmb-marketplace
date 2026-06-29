---
description: Use this skill when the user wants to view, create, or modify a shopping cart on their Shopify store, or when they want to proceed to checkout.
---

# Shopify Cart Management

Use these tools to create and manage shopping carts via the `shopify-storefront` MCP server (endpoint `/api/mcp`).

## Cart ID lifecycle

- A cart does not exist until `update_cart` is called without a `cart_id` — Shopify creates a new cart and returns an ID.
- The `cart_id` must be stored and passed on every subsequent call for that session.
- If the user's session context does not contain a `cart_id`, create a new cart by calling `update_cart` with only the items you want to add.
- Cart IDs persist server-side until the cart expires (typically 10 days of inactivity).

## Tool: get_cart

Use this to retrieve the current contents of a cart.

**Required parameters:**
- `cart_id` (string) — the existing cart identifier.

**What it returns:**
- All line items (merchandise ID, quantity, title, price).
- Total price and currency.
- A `checkoutUrl` the user can open to complete purchase.

**Tips:**
- Always call `get_cart` after `update_cart` to confirm the final cart state before showing the user a summary.
- Present the `checkoutUrl` as a direct link — do not reproduce checkout steps in the agent.

## Tool: update_cart

Use this to create a cart, add items, or change quantities.

**Parameters:**
- `cart_id` (string, optional) — omit to create a new cart; include to update an existing one.
- `add_items` (array, required) — each entry must have:
  - `merchandise_id` (string) — the variant GID (e.g. `"gid://shopify/ProductVariant/456"`).
  - `quantity` (integer, positive) — number of units to add.
  - `line_item_id` (string, optional) — if provided, updates an existing line item's quantity instead of adding a new line.

**Tips:**
- Always use variant GIDs (`gid://shopify/ProductVariant/...`), not product GIDs — carts require a specific variant.
- To remove an item, set its `quantity` to `0` using its `line_item_id`.
- After adding items, immediately call `get_cart` and confirm with the user.

## Tool: search_shop_policies_and_faqs

Use this when a customer asks about returns, shipping, store hours, or any store-specific FAQ before committing to a purchase.

**Required parameters:**
- `query` (string) — the customer's question in natural language (e.g. "what is your return policy?").

**Optional parameters:**
- `context` (string) — a product reference or additional context to narrow the policy lookup.

**Tips:**
- Call this proactively when a user expresses hesitation about a purchase (e.g. "can I return this?").
- Return the policy answer verbatim; do not paraphrase legal/policy language.

## Full cart workflow example

1. User says "add 2 of the blue medium t-shirt to my cart."
2. Call `search_catalog` (UCP) to resolve the variant GID if not already known.
3. Call `update_cart` with `merchandise_id = <variantGid>` and `quantity = 2`.
4. Capture the returned `cart_id`.
5. Call `get_cart` with the new `cart_id`.
6. Show the user the cart summary and the `checkoutUrl`.

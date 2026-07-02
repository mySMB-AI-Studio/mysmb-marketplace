# Shopify Storefront

Connect Shopify's public **Storefront MCP** and **UCP catalog MCP** servers to myHub. Browse products, manage carts, and look up shop policies — no customer authentication required.

This plugin wires two MCP server entries:

| Server key | Endpoint | Auth |
|---|---|---|
| `shopify-storefront` | `https://{shop}.myshopify.com/api/mcp` | None |
| `shopify-ucp` | `https://{shop}.myshopify.com/api/ucp/mcp` | None |

Both endpoints are publicly accessible — no credentials are required beyond knowing the store subdomain.

For authenticated customer data (orders, account details), see the **Shopify Customer** plugin.

## Storefront MCP — Tools

The standard storefront endpoint (`/api/mcp`) exposes:

- **`search_shop_policies_and_faqs`** — answers questions about store policies, return rules, shipping, and FAQs.
- **`get_cart`** — retrieves a cart by `cart_id`, including all line items and a checkout URL.
- **`update_cart`** — adds or updates items in a cart; creates a new cart if `cart_id` is omitted.

## UCP Catalog MCP — Tools

The UCP catalog endpoint (`/api/ucp/mcp`) exposes:

- **`search_catalog`** — free-text product search with buyer signals (country, intent, currency) and filters (category, price range).
- **`lookup_catalog`** — resolve up to 10 product or variant IDs to full product details.
- **`get_product`** — get a single product with variant selection and option relaxation.

All UCP tool calls automatically include the required `meta.ucp-agent.profile` metadata — the agent skills handle this.

## Platform Compatibility Note

The `.mcp.json` for this plugin uses a per-user variable in the URL host:

```json
"url": "https://${SHOPIFY_SHOP_SUBDOMAIN}.myshopify.com/api/mcp"
"url": "https://${SHOPIFY_SHOP_SUBDOMAIN}.myshopify.com/api/ucp/mcp"
```

This is correct per Shopify's own design — the [Storefront Catalog MCP docs](https://shopify.dev/docs/agents/catalog/storefront-catalog) confirm the endpoint is `https://{storedomain}/api/ucp/mcp`. There is no fixed upstream hostname to hardcode.

> **TODO (platform team):** Confirm that the myHub runtime performs `${VAR}` substitution in the `.mcp.json` `url` field before making the MCP connection. If not, a relay server in `myhub-mcp-servers` will be required. Do not ship to production until this is confirmed.

## Configuration

Every `${VAR}` placeholder in `.mcp.json` must be supplied before the plugin connects. The Connect dialog collects these:

| Variable | Required | Description |
|---|---|---|
| `SHOPIFY_SHOP_SUBDOMAIN` | Yes | Your store's myshopify.com subdomain (e.g. `my-store` for `my-store.myshopify.com`). Builds both the Storefront and UCP MCP server URLs. |

This value is not a secret. It is stored per-user in myHub's credential vault and never committed to this repository.

## Widgets

| Widget | Server | Tool | What it shows |
|---|---|---|---|
| **Product Search** | `shopify-ucp` | `search_catalog` | Search results for a configurable query — product title and price range. Assumes the tool response root key is `products` (array). |
| **Store Policies** | `shopify-storefront` | `search_shop_policies_and_faqs` | Key store policy snippets (returns, shipping, etc.). Assumes the tool response root key is `answer` (string). |

> **Widget response shape note:** The `$state` paths in both widgets are based on the expected Shopify MCP response envelope. If the actual tool response uses different root keys, the widget will render empty. Verify against a live store before shipping to production.

## Skills

| Skill | Covers |
|---|---|
| `search-catalog` | How to use `search_catalog`, `lookup_catalog`, and `get_product` effectively — query construction, context signals, UCP agent profile metadata. |
| `manage-cart` | How to create, retrieve, and update a cart — cart ID lifecycle, line item format, checkout URL. |

## Error handling

- Tools return descriptive error messages for invalid queries or missing products.
- Standard Shopify API rate limits apply. If you receive a rate-limit error, wait a few seconds and retry.
- The `update_cart` tool will create a new cart if `cart_id` is not supplied or is invalid.

## See also

- [Storefront MCP server docs](https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront)
- [Shopify Customer plugin](../shopify-customer/README.md) — for authenticated order and account access

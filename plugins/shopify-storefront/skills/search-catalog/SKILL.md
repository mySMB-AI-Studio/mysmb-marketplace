---
description: Use this skill when the user wants to search for products, look up specific products by ID, or browse catalog details on their Shopify store.
---

# Shopify Catalog Search

Use these tools to find and display products from a Shopify store's UCP catalog. All three tools target the `shopify-ucp` MCP server.

## UCP Agent Profile — required metadata

Every UCP catalog tool call must include an `ucp-agent` metadata field. Always append this to every request:

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json"
    }
  }
}
```

Omitting this will cause the UCP endpoint to reject the request.

## Tool: search_catalog

Use this for free-text product searches (e.g. "blue running shoes under $100").

> **Parameter note:** Shopify's raw HTTP docs show `query` nested inside a `catalog` object. When calling via MCP, the tool exposes these as flat top-level parameters — the MCP framing handles the nesting. Pass `query` directly; do not wrap it in a `catalog` object.

**Required parameters:**
- `query` (string) — the customer's search intent in plain language.

**Optional parameters:**
- `context.address_country` — ISO 3166-1 alpha-2 country code to localise pricing/availability (e.g. `"AU"`, `"US"`).
- `context.intent` — one of `"buy"`, `"browse"`, `"compare"` to refine ranking.
- `filters.price_min` / `filters.price_max` — numeric price bounds in the store's currency.
- `pagination.limit` — number of results (default varies by store); start with 10–20 for a dashboard tile.
- `pagination.cursor` — use the cursor from a previous response to page forward.

**Tips:**
- Prefer `search_catalog` for open-ended discovery ("what shoes do you have?").
- For follow-up refinements, carry the cursor from the previous response into the next call.
- If the user mentions a specific country, always include `context.address_country`.

## Tool: lookup_catalog

Use this to resolve known product or variant IDs (from a previous `search_catalog` result) to full product details.

**Required parameters:**
- `ids` (array of strings) — up to 10 product or variant GIDs (e.g. `["gid://shopify/Product/123"]`).

**Tips:**
- Use this after `search_catalog` to enrich a summary list with full variant data.
- IDs must be Shopify GIDs — do not pass raw numeric IDs.

## Tool: get_product

Use this when the user asks for full details on a single product — all variants, options, images, and pricing.

**Required parameters:**
- `id` (string) — a product or variant GID.

**Optional parameters:**
- `selected` (array) — option selections, e.g. `[{"name": "Color", "label": "Blue"}, {"name": "Size", "label": "M"}]`.
- `preferences` (array) — option relaxation priority if the exact selection is unavailable.
- `context` — same buyer-signal fields as `search_catalog`.

**Tips:**
- When the user picks a specific variant from search results, pass the variant GID (not the product GID) for accurate stock and price.
- If a variant is unavailable, use `preferences` to suggest the next-best option automatically.

## Error handling

- If a query returns zero results, broaden the search terms or remove price filters.
- If a GID is not found, confirm it came from a recent `search_catalog` or `lookup_catalog` response — stale IDs can expire.
- Rate limit errors: wait 2 seconds and retry once before reporting failure to the user.

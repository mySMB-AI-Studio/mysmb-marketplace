---
description: Use this skill when the user wants to look up their order history, view order details, manage their account information, or perform any action that requires the customer to be authenticated with Shopify.
---

# Shopify Customer Accounts

The `shopify-customer` MCP server provides authenticated access to a customer's personal data on a Shopify store. It is only available after the user completes the OAuth 2.0 + PKCE flow in the myHub Connect dialog.

## Authentication check

Before calling any tool on `shopify-customer`, confirm the user is connected:
- If the server is not connected, prompt the user to click Connect and complete the Shopify Customer Accounts OAuth flow.
- Do not attempt to call tools if the OAuth token is missing — the server will return a 401.

## Tool discovery

The Customer Accounts MCP server does not publish a fixed tool list in documentation — it is dynamically discovered. Always call `tools/list` on the `shopify-customer` server first to get the up-to-date schema for the connected store.

```
server: shopify-customer
method: tools/list
```

Cache the tool list for the session; do not re-call `tools/list` on every action.

## Common tool patterns

### Orders

- Look for tools named `get_orders`, `list_orders`, or similar to retrieve order history.
- Use `get_order` (or equivalent) with a Shopify order GID (`gid://shopify/Order/<id>`) or order number (e.g. `#1001`) to get full order detail.
- Order numbers may be passed with or without the `#` prefix — try both if one fails.

### Account and addresses

- Look for `get_customer`, `get_account`, or `me` tools to retrieve the authenticated customer's profile.
- Address management tools typically follow CRUD naming: `list_addresses`, `add_address`, `update_address`, `delete_address`.

### ID formats

All Shopify resource IDs in this server use the GID format:
```
gid://shopify/<Type>/<numericId>
```
For example: `gid://shopify/Order/6789012345678`. When a user provides a numeric order number, prepend `gid://shopify/Order/` if the tool's schema expects a GID.

## Error handling

| Error | Action |
|---|---|
| `401 Unauthorized` | Session token expired — prompt user to reconnect via the Connect dialog. |
| `403 Forbidden / insufficient scopes` | The OAuth token was minted without `customer-account-mcp-api:full`. Disconnect and reconnect. |
| `Resource not found` | The order/address ID does not belong to this customer. Confirm the ID with the user. |
| Rate limit | Wait 2 seconds and retry once. If it persists, inform the user and suggest trying again shortly. |
| Generic processing failure | Retry once. If it fails again, surface the raw error message to the user. |

## Privacy

The Customer Accounts MCP server returns PII (names, addresses, order history). Do not log or store any returned personal data outside of the current session context. Present it only to the authenticated user.

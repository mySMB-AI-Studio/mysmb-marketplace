# Shopify Customer

Connect Shopify's **Customer Accounts MCP** server to myHub. Access authenticated customer data — order history, order details, saved addresses, and account profile — via OAuth 2.0 + PKCE.

This plugin wires one MCP server entry:

| Server key | Endpoint | Auth |
|---|---|---|
| `shopify-customer` | `https://{shopDomain}/customer/api/mcp` | OAuth 2.0 + PKCE |

The Customer Accounts server requires each customer to authenticate via Shopify's OAuth 2.0 authorization-code-with-PKCE flow. A **custom domain** is also required — Shopify does not support Customer Accounts on `.myshopify.com` subdomains.

For public storefront tools (product search, cart management, policies) that need no sign-in, see the **Shopify Storefront** plugin.

## Customer Accounts MCP — Tools

After the OAuth flow completes, the customer endpoint (`/customer/api/mcp`) exposes order management and account detail tools. The exact tool list is discovered at runtime via `tools/list`. Common capabilities include:

- Order history and order detail lookup
- Order management actions
- Account and address management
- Customer profile details

Run `tools/list` against the `shopify-customer` server to see the full, up-to-date schema for your connected store.

## Authentication

### OAuth 2.0 + PKCE flow

Shopify Customer Accounts MCP uses the **authorization code grant flow with PKCE** (Proof Key for Code Exchange). This is a public-client OAuth flow — there is no client secret.

**Flow summary:**

1. MyHub generates a random `code_verifier` (32 bytes, base64URL-encoded).
2. MyHub computes `code_challenge = BASE64URL(SHA256(code_verifier))`.
3. MyHub discovers the authorization endpoint from `https://{shopDomain}/.well-known/openid-configuration` (the `authorization_endpoint` field). The URL contains a Shopify-internal `{shop_id}` segment resolved at discovery time — you do not need to know this value:
   ```
   https://{shopDomain}/authentication/{shop_id}/oauth/authorize
     ?client_id={SHOPIFY_CUSTOMER_CLIENT_ID}
     &redirect_uri={callbackUrl}
     &response_type=code
     &scope=customer-account-mcp-api:full
     &state={random16ByteHex}
     &code_challenge={code_challenge}
     &code_challenge_method=S256
   ```
4. Shopify authenticates the customer and redirects back with `?code=...&state=...`.
5. MyHub exchanges the code for tokens at the `token_endpoint`:
   ```
   POST {token_endpoint}
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &client_id={SHOPIFY_CUSTOMER_CLIENT_ID}
   &redirect_uri={callbackUrl}
   &code={code}
   &code_verifier={code_verifier}
   ```
6. The access token is sent as `Authorization: {access_token}` (raw token, **no `Bearer` prefix**) on every Customer Accounts MCP request. Shopify's Customer Accounts MCP uses a non-standard header format — not RFC 6750 Bearer. myHub's OAuth runtime handles this injection automatically.
7. Tokens are stored per-user in myHub's encrypted credential vault and refreshed via the `refresh_token` when they expire.

**Prerequisites (Shopify side):**
- Store must have a custom domain (required by Shopify Customer Accounts).
- A **Headless app** client must be registered in Shopify admin → Settings → Customer accounts → Headless.
- The redirect URI shown in the myHub Connect dialog must be added to the Headless client's allowed redirect URIs.
- Your store/app must have completed Shopify's protected customer data requirements (Level 2 PII approval via Partner Dashboard).

## Configuration

Every `${VAR}` placeholder in `.mcp.json` must be supplied before the plugin connects. The Connect dialog collects these:

| Variable | Required | Description |
|---|---|---|
| `SHOPIFY_SHOP_DOMAIN` | Yes | Your store's custom domain (e.g. `shop.example.com`). Required by Shopify — Customer Accounts MCP does not work on `.myshopify.com` domains. |
| `SHOPIFY_CUSTOMER_CLIENT_ID` | Yes | Client ID of your Shopify Headless app client. From Shopify admin → Settings → Customer accounts → Headless. |

Neither value is a secret — `SHOPIFY_CUSTOMER_CLIENT_ID` is a public client identifier (PKCE flow has no client secret). All values are stored per-user in myHub's encrypted credential vault and never committed to this repository.

## Error handling

- If authentication fails, re-run the Connect flow to mint a fresh token.
- Resource-not-found errors specify which order or object was missing.
- Generic processing failures include a retry suggestion.
- If a tool returns `insufficient scopes`, disconnect and reconnect to trigger a new OAuth consent with the `customer-account-mcp-api:full` scope.
- A `401 Unauthorized` response means the token has expired — prompt the user to reconnect.

## See also

- [Customer Accounts MCP server docs](https://shopify.dev/docs/apps/build/storefront-mcp/servers/customer-account)
- [Shopify Customer Accounts OAuth](https://shopify.dev/docs/apps/build/storefront-mcp/servers/customer-account#authentication)
- [Shopify Storefront plugin](../shopify-storefront/README.md) — for public product search, cart, and policies (no auth)
- [Shopify Partner Dashboard](https://partners.shopify.com)

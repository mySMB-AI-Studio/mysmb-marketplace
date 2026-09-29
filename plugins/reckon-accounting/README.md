# Reckon Accounting

Access Reckon One via the myHub-hosted OAuth MCP gateway. Browser OAuth flow — no env vars, no keys, just click Connect.

Covers company info, chart of accounts, contacts (customers/suppliers), items, invoices, bills, payments, and Profit & Loss / Balance Sheet / Trial Balance reports.

## Authentication

Reckon One and Reckon Accounts Hosted share one identity server (`identity.reckon.com`), using a standard OAuth 2.0 confidential authorization-code flow. myHub owns one OAuth app registration shared across every customer's connection — the user just signs in and authorizes.

### Flow summary

1. MyHub redirects the user's browser to Reckon's authorization endpoint to obtain consent.
2. Reckon redirects back with an authorization code.
3. The MCP server exchanges the code for an `access_token` + `refresh_token` using the token endpoint with `Authorization: Basic <Base64(client_id:client_secret)>`.
4. Every API call sends `Authorization: Bearer <access_token>` plus a mandatory `subscription-key` query parameter (a separate Azure APIM key, not the OAuth client secret).
5. The MCP server silently refreshes the access token using the refresh token before it expires — no manual rotation needed.
6. Immediately after connecting, the MCP server calls `GET /books` to discover the user's Reckon One "cashbook" — every subsequent call is scoped to that cashbook. If the account has more than one cashbook, the first one returned is used.

### Endpoints

| Purpose | URL |
|---|---|
| Authorization | `https://identity.reckon.com/connect/authorize` |
| Token | `https://identity.reckon.com/connect/token` |
| Discovery | `https://identity.reckon.com/.well-known/openid-configuration` |
| API base | `https://api.reckon.com/r1/{cashbookId}/` |

### Token lifetimes

| Token | Lifetime |
|---|---|
| Access token | 180 minutes |
| Refresh token | 45 days rolling (idle) / 12 months absolute |

### Scopes requested

```
openid read write offline_access
```

## Configuration

No environment variables are required in this plugin — authentication is handled entirely by the Reckon OAuth flow, and the OAuth client credentials + Azure APIM subscription key live server-side in the myHub-hosted MCP gateway, not here.

| Variable | Required | Description |
|---|---|---|
| *(none)* | — | Browser OAuth — credentials are never stored in this plugin. |

## Tools

### Company & accounts (2)

| Tool | Description |
|---|---|
| `get_company` | Get the current cashbook's company profile |
| `list_accounts` | List the chart of accounts |

### Contacts (3)

| Tool | Description |
|---|---|
| `list_contacts` | List customers and/or suppliers |
| `get_contact` | Get full detail for a single contact |
| `create_contact` | Create a new customer or supplier |

### Items (1)

| Tool | Description |
|---|---|
| `list_items` | List sale/purchase items (products and services) |

### Invoices (4)

| Tool | Description |
|---|---|
| `list_invoices` | List sales invoices |
| `get_invoice` | Get full detail for a single invoice, including line items |
| `create_invoice` | Create a new sales invoice (draft) |
| `approve_invoice` | Approve a draft invoice so it posts to the ledger |

### Bills (3)

| Tool | Description |
|---|---|
| `list_bills` | List supplier bills |
| `get_bill` | Get full detail for a single bill, including line items |
| `approve_bill` | Approve a draft bill so it posts to the ledger |

### Payments (2)

| Tool | Description |
|---|---|
| `list_payments` | List payments received or made |
| `create_payment` | Record a payment against an invoice or bill |

### Reports (3)

| Tool | Description |
|---|---|
| `get_profit_and_loss` | P&L for a date range |
| `get_balance_sheet` | Balance sheet as of a given date |
| `get_trial_balance` | Trial balance as of a given date |

## Widgets

- **Company Overview** — company name, total accounts, and this-tile-load's chart-of-accounts breakdown by type

## Destructive operations

- `create_invoice` / `approve_invoice` — posts a real invoice to the ledger
- `create_payment` — records a real payment
- `approve_bill` — posts a real bill to the ledger

## See also

- [Reckon Developer Portal](https://developer.reckon.com/apis)
- [Reckon One API v2 endpoints](https://help.reckon.com/article/kf31jtzv1r-api-reckon-one-endpoints)
- [Reckon API authorisation services](https://help.reckon.com/article/xcv063pbxz-reckon-api-authorisation-services)

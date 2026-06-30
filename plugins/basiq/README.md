# Basiq

Connect to Basiq's open banking platform to access financial data, bank connections, transactions, and account information via AI. This plugin points directly at Basiq's hosted MCP server (`https://api.basiq.io/mcp`) and surfaces the full Basiq API through seven built-in tools covering endpoint discovery, documentation search, and live API execution.

Basiq is an Australian open-banking data platform. It provides consented access to bank account data, transactions, income and expense analysis, identity verification, and affordability checks across hundreds of financial institutions.

## Tools & resources

### Endpoint discovery
- `list-endpoints` — list all Basiq API endpoints available through the MCP server, grouped by route category (affordability, analytics, connect, enrich, identity, insights, payees, platform, reporting, webhooks)
- `get-endpoint` — retrieve the full detail for a specific endpoint: HTTP method, path, parameters, request/response schemas, and authentication requirements
- `search-endpoints` — search endpoints by keyword, category, or functionality description

### API execution
- `execute-request` — execute a live request against any enabled Basiq API endpoint; use after discovery to fetch real banking data or trigger actions

### Documentation & specifications
- `list-specs` — list available Basiq API specification documents
- `fetch` — retrieve a specific documentation page or API specification by URL
- `search` — full-text search across Basiq documentation, endpoint references, and integration guides

## Configuration

Authenticate with a Basiq API key. The key is issued per application in the Basiq Dashboard and is sent as the `Authorization: Basic` credential to the Basiq MCP server. The Basiq MCP server handles token exchange internally — you do not need to exchange the key for a JWT access token yourself. Access tokens issued by Basiq expire after 60 minutes; if your session silently drops, re-connect the plugin from the Connections panel.

Copy the API key exactly as shown in the Basiq Dashboard — do not encode or modify it.

| Variable | Required | Description |
|----------|----------|-------------|
| `BASIQ_API_KEY` | Yes | Your Basiq application API key. In the Basiq Dashboard: **Applications** — select your app and copy the API key. Copy it exactly as shown; do not encode or modify it. See [Basiq MCP server docs](https://api.basiq.io/reference/mcp-server). |

The API key maps to a specific Basiq application. Each application controls which route groups are enabled (affordability, analytics, connect, etc.) through the Basiq Dashboard. If an endpoint is not available, check your application's route group configuration.

## Available route groups

The Basiq MCP server exposes endpoints from up to ten route groups. Which groups are enabled depends on your Basiq application configuration:

| Route group | What it covers |
|-------------|----------------|
| `connect` | Bank connections — linking user accounts to financial institutions |
| `platform` | Users, consents, and job management |
| `identity` | Identity verification from banking data |
| `affordability` | Affordability and expense analysis |
| `analytics` | Spending patterns and financial analytics |
| `insights` | Financial insights and summaries |
| `enrich` | Transaction enrichment and categorisation |
| `payees` | Payee management |
| `reporting` | Financial reports |
| `webhooks` | Webhook subscriptions and event delivery |

## Destructive operations

Confirm before calling — these mutate live data or trigger external processes:
- Creating or deleting bank connections (consent flows affect end users)
- Deleting users or consents
- Triggering jobs (e.g. refresh, statement fetch)

## See also
- [Basiq API reference](https://api.basiq.io/reference)
- [Basiq MCP server documentation](https://api.basiq.io/reference/mcp-server)
- [Basiq Dashboard](https://dashboard.basiq.io)
- [Basiq authentication](https://api.basiq.io/reference/authentication)

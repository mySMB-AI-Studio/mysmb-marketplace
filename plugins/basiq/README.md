# Basiq

Connect to Basiq's open banking platform to access financial data, bank connections, transactions, and account information via AI.

Basiq is an Australian open-banking data platform. It provides consented access to bank account data, transactions, income and expense analysis, identity verification, and affordability checks across hundreds of financial institutions.

**This plugin wires up two independent MCP servers** — see `.mcp.json`:

| Server key | Backend | Powers |
|---|---|---|
| `basiq` | Basiq's own hosted MCP (`https://api.basiq.io/mcp`) | The 7 generic discovery/execution tools below, and the 3 skills |
| `basiq-connect` | mySMB's `myhub-mcp-servers` `/basiq/mcp` route | The `basiq-connections-health` widget (see Widgets) |

They're unrelated backends with no shared state. `basiq`'s generic tools (`execute-request` etc.) need a specific Basiq user ID supplied by the caller on every data call, and Basiq's real API has no endpoint that returns connection/job data without one — there's no way to wire a per-tenant default into a live *widget's* data-fetch params (the renderer only resolves date tokens and `$state`, nothing else), so that server can't power a live dashboard tile without hardcoding one customer's user ID into this shared file. `basiq-connect` sidesteps this because the *server itself* holds a default (`BASIQ_DEFAULT_USER_ID`), the same pattern MYOB (`MYOB_COMPANY_FILE_ID`) and Dataverse (`DATAVERSE_DEFAULT_ORG`) use — see `myhub-mcp-servers/docs/BASIQ.md`.

**Known deployment gap:** the `basiq-connections-health` widget calls `list_basiq_connections` with no `userId`, relying on the server resolving `BASIQ_DEFAULT_USER_ID`. As of this writing, that fallback code isn't yet merged into `myhub-mcp-servers`'s `dev`, and `deploy-staging.yml` doesn't pass `BASIQ_DEFAULT_USER_ID` through to the deployed container even once it is. Until both are done, the tile will show its loading/error state against the real deployed endpoint — this is a `myhub-mcp-servers` follow-up, not a bug in this plugin.

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

## Widgets

| Widget | MCP server | Description |
|---|---|---|
| `basiq-connections-health` | `basiq-connect` | Live count of connections by status (Success/Running/Failed, mapped from Basiq's real `active`/`pending`+`pre-init`/`invalid` statuses — see the widget-elements JSDoc), overall health, and time since last activity. Click a status to drill into the individual connections in that bucket. Calls `list_basiq_connections` with no `userId` — the server resolves it from `BASIQ_DEFAULT_USER_ID` (see the deployment gap noted above). |
| `basiq-recent-transactions-demo` | — (static) | Sample bank transactions (date, description, account, amount) showing what a live transactions view would look like. Stays static because `execute-request` needs a specific Basiq user ID per call with no default-resolution path available to it, so it can't go live the way `basiq-connections-health` did. |

### Widget-elements

`widget-elements/src/index.ts` contributes the functions `basiq-connections-health` binds to:
- `basiq_flatten_connections_health` — maps `list_basiq_connections`' raw response into the single summary row (status counts, health label/tone, most-recent `lastUsed`). Status→bucket mapping is documented in its JSDoc — an interpretive grouping onto Basiq's real 4-value status enum, not something Basiq itself calls "Success/Running/Failed".
- `basiq_connections_by_status` — filters the same raw response down to one status bucket, for the click-to-drill-down breakdown panel.
- `basiq_connection_status_tone` / `basiq_status_bucket_label` — per-item tone and bucket label helpers used by the breakdown panel.

## Configuration

Authenticate with a Basiq API key. The key is issued per application in the Basiq Dashboard and is sent as the `Authorization: Basic` credential to the Basiq MCP server. The Basiq MCP server handles token exchange internally — you do not need to exchange the key for a JWT access token yourself. Access tokens issued by Basiq expire after 60 minutes; if your session silently drops, re-connect the plugin from the Connections panel.

Copy the API key exactly as shown in the Basiq Dashboard — do not encode or modify it.

The `connection.fields` below (`BASIQ_API_KEY`) apply only to the `basiq` server. `basiq-connect` takes no per-tenant credential from this plugin at all — it's an unauthenticated MCP endpoint on `myhub-mcp-servers`' own container, which holds the real Basiq API key and `BASIQ_DEFAULT_USER_ID` server-side (same pattern as the Humanitix plugin's single `myhub-mcp-servers`-backed server).

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

# Microsoft Dynamics 365 Business Central

Connects MyHub to **Microsoft's hosted Business Central MCP server** at `https://mcp.businesscentral.dynamics.com`. There is no custom MCP server in this plugin and no gateway hop — Microsoft runs the server, we just point at it. Authentication is standard MCP OAuth 2.0 (Authorization Code + PKCE) against Microsoft Entra ID; every operation runs as the signed-in user, so Business Central audit trails show who did what.

Which environment/company the connection talks to is selected by four HTTP headers (see [Configuration](#configuration)). By default the server gives **read-only access to every exposed API page**; write operations only become possible when a BC admin explicitly enables them in an MCP Server Configuration inside Business Central — a deliberate safety property we inherit for free.

## How the Business Central MCP server works

Two operating modes, chosen by the **MCP Server Configuration** the connection's `ConfigurationName` header points at (a record on BC page **8351**, *Model Context Protocol (MCP) Server Configurations*):

| Mode | Tools exposed | Best for |
|---|---|---|
| **Dynamic Tool Mode ON** (or no `ConfigurationName` at all) | `bc_actions_search`, `bc_actions_describe`, `bc_actions_invoke` — the agent discovers and invokes API pages at runtime | Chat / agent use across the whole ERP |
| **Dynamic Tool Mode OFF** | One generated tool per allowed operation per API page, e.g. `List_APIV2SalesInvoices_PAG30012` for *Allow Read* on page 30012 | Dashboard tiles and anything that needs **stable tool names** |

The dashboard tiles in this plugin need stable names, so they bind to generated read tools from a small configuration you create once (next section).

## Business Central setup (one-time, BC admin)

Requires the **MCP - ADMIN** permission set in Business Central.

1. In BC, search for **Model Context Protocol (MCP) Server Configurations** (page 8351) → **New**.
2. Name it `MYHUB` (or anything — it just has to match `BC_MCP_CONFIGURATION` below), set **Active** = on, **Dynamic Tool Mode** = off, **Unblock Edit Tools** = off (tiles are read-only).
3. Under **Available Tools**, add these API pages with **Allow Read** only:

   | Object ID | Object name | Used by |
   |---|---|---|
   | 30031 | APIV2 - Aged AR | Receivables Aging tile |
   | 30012 | APIV2 - Sales Invoices | Unpaid Invoices tile |
   | 30008 | APIV2 - Items | Low Stock tile |
   | 30009 | APIV2 - Customers | chat/agent convenience |

   Add more pages (or *Add All Standard APIs as Tools*) if you want the chat agent to reach more of the ERP through this same connection.

> **Preferring chat breadth over tiles?** Leave `BC_MCP_CONFIGURATION` pointing at a configuration with **Dynamic Tool Mode ON** (+ *Discover Additional Objects*) instead — the agent then gets `bc_actions_search/describe/invoke` over every API page, but the tiles will show an error state because their fixed tool names won't exist. One connection can't do both modes at once; tiles won that trade-off here.

## Entra ID app registration (one-time, M365 admin)

Microsoft Entra doesn't support MCP dynamic client registration, so a registered app is required ([Microsoft's guide](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/use-mcp-server-non-microsoft)):

1. **Entra admin center → App registrations → New registration.**
2. **Authentication →** add the redirect URI shown in MyHub's Connect modal (platform *Web*; for Claude Code CLI use *Mobile and desktop applications* with `http://localhost:33418/callback` and enable *Allow public client flows*).
3. **API permissions →** *Dynamics 365 Business Central → Delegated → `Financials.ReadWrite.All`* → **Grant admin consent**.
4. For MyHub's one-click Connect: put the client ID/secret in the tenant container env as `BC_OAUTH_CLIENT_ID` / `BC_OAUTH_CLIENT_SECRET` (see `serverClientEnv` in `plugin.json`). Without those, the Connect modal falls back to bring-your-own-client fields.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `BC_TENANT_ID` | yes | Microsoft Entra tenant ID (GUID) hosting the Business Central environment. Sent as the `TenantId` header. |
| `BC_ENVIRONMENT_NAME` | yes | Business Central environment name, e.g. `Production` or `Sandbox`. Sent as the `EnvironmentName` header. |
| `BC_COMPANY` | yes | Company name within the environment, e.g. `CRONUS AU Pty Ltd.`. Non-ASCII names must be Base64-wrapped as `=?base64?<encoded>?=`. Sent as the `Company` header. |
| `BC_MCP_CONFIGURATION` | yes | Name of the MCP Server Configuration in BC to use, e.g. `MYHUB` (setup above). Sent as the `ConfigurationName` header. |

These are **tenant-level settings** resolved from Key Vault at session start — they are not collected by the Connect modal (that only handles the OAuth client pair). Claude Code users set them in their shell instead.

## Tiles

| Tile | Tool it calls | What it shows |
|---|---|---|
| **Receivables Aging** | `List_APIV2AgedAR_PAG30031` | Total AR, overdue amount and %, aging buckets (current / 1–30 / 31–60 / 61+), top overdue customers |
| **Unpaid Invoices** | `List_APIV2SalesInvoices_PAG30012` | Posted, unpaid (`Open`) sales invoices sorted by due date, with overdue badges |
| **Low Stock** | `List_APIV2Items_PAG30008` | Inventory-type items with the lowest quantity on hand, out-of-stock flagged |

**Display decisions** (per `TILE-DISPLAY-STANDARDS.md`): dates are `dd-Mmm-yy`; amounts use the row's `currencyCode` when set, otherwise the tile's explicit `currency` param (default `AUD` — Business Central reports blank `currencyCode` for local-currency rows, and the org's LCY isn't in the payload); overdue escalation follows the WorkQ model (muted until due → warning on the due date → destructive after); aging buckets use a deliberate severity gradient (current = muted, 1–30 = info, 31–60 = warning, 61+ = destructive) rather than BC's own UI colours.

### ⚠️ Generated tool names — verify once per environment

Microsoft documents the generated-tool pattern as `List<object name>_PAG<id>`, and the one wire-level example seen in the field is `List_PostedSalesInvoices_PAG9970` (underscore-separated, object name compacted). The server is **in preview and naming may still change**, so on first connect run the `business-central-verify-setup` skill: it lists the live tools and confirms the three tile bindings above. If your environment reports different names, the tile `dataProvider.tool` values need a one-line update each.

## Chat / agent usage

With the tile configuration active, the agent gets typed read tools for the four pages above. With a dynamic-mode configuration it instead works through:

1. `bc_actions_search` — find API pages by keyword ("customers", "sales orders", "inventory")
2. `bc_actions_describe` — inspect the chosen action's parameters
3. `bc_actions_invoke` — execute it

The `business-central-query-data` skill teaches this flow. Writes (create/modify/delete/bound actions like posting an invoice) are only possible if a BC admin turned on *Unblock Edit Tools* + the specific permissions — and the agent is instructed to confirm before any write.

## Known issues

- **Claude Code header regression (upstream, open):** since the MCP 2026-07-28 stateless-spec rollout, Claude Code ≤ 2.1.220 stopped re-sending the configured `Company`/`EnvironmentName` headers on every request, so data tool calls fail with `Internal_CompanyNotFound` while `bc_actions_search`/`describe` still work ([anthropic/claude-code#81965](https://github.com/anthropics/claude-code/issues/81965)). MyHub's dashboard tool-caller sends headers per request and is unaffected; standalone Claude Code chat use may be until the client fix ships.
- **Preview status:** the BC MCP server is preview (BC 2025 wave 2+, online only). Copilot Studio caps agents at 70 tools — irrelevant for MyHub but a reason Microsoft added dynamic mode.
- `ListPart`/`CardPart` API pages and Query objects can't be exposed as tools; only top-level API pages.

## Claude Code (standalone) example

```json
{
  "mcpServers": {
    "business-central": {
      "type": "http",
      "url": "https://mcp.businesscentral.dynamics.com",
      "headers": {
        "TenantId": "<entra-tenant-guid>",
        "EnvironmentName": "Production",
        "Company": "CRONUS AU Pty Ltd.",
        "ConfigurationName": "MYHUB"
      },
      "oauth": { "clientId": "<entra-app-client-id>", "callbackPort": 33418 }
    }
  }
}
```

## See also

- [Business Central MCP overview](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/mcp-overview)
- [Configure the MCP server](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/configure-mcp-server)
- [Connect non-Microsoft MCP hosts](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/use-mcp-server-non-microsoft)
- [Business Central API v2.0 reference](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/)

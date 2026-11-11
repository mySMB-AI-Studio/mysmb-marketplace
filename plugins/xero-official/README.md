# Xero Official

Connects Workspace to **Xero's own hosted MCP server** (`https://mcp.xero.com/mcp`, HTTP transport).

## Sign-in

Xero's hosted server uses Xero's normal OAuth 2.0 sign-in (`identity.xero.com`) and does not support dynamic
client registration, so every client needs an app registered in the Xero developer portal. This plugin uses
**mySMB's** registered Xero app through `connection.serverClientEnv`:

| Tenant env var | Meaning |
| --- | --- |
| `XERO_MCP_OAUTH_CLIENT_ID` | Client ID of mySMB's Xero app for this environment |
| `XERO_MCP_OAUTH_CLIENT_SECRET` | Its client secret (Container App secret `xero-mcp-oauth-client-secret`) |

When both are set on the tenant, **Connect** goes straight to Xero's sign-in. When they are not, the user is
asked for their own app's Client ID and Secret (bring-your-own-app fallback).

The Xero app must list each Workspace environment's callback as a redirect URI:

- QA: `https://qa-workspace.myimpact.group/api/user/connections/oauth/callback`
- UAT: `https://uat-workspace.myimpact.group/api/user/connections/oauth/callback`
- Production: `https://workspace.myimpact.group/api/user/connections/oauth/callback`

Shared (admin) connections use `/api/admin/service-connections/oauth/callback` on the same hosts.

## Scopes and tools

Read-only. Requested scopes match the server's published `scopes_supported`: `openid profile email
offline_access accounting.settings accounting.invoices.read accounting.reports.aged.read
accounting.reports.balancesheet.read accounting.reports.profitandloss.read`. For write access use the
`xero-accounting` plugin.

# Xero Official

Connects Workspace to **Xero's own hosted MCP server** (`https://api.xero.com/mcp/v1`, HTTP transport), the URL in Xero's
Remote MCP docs (developer.xero.com/documentation/guides/remote-mcp/overview). The server publishes OAuth
protected-resource metadata at `https://api.xero.com/.well-known/oauth-protected-resource/mcp/v1`.

## Configuration

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

Xero's server has 39 Accounting tools (18 read, 21 write); each tool needs its own scope, and an agent can only
call tools whose scope the connection was granted. Requested scopes (all from the server's published
`scopes_supported`): `openid profile email offline_access accounting.settings accounting.settings.read
accounting.invoices.read accounting.contacts.read accounting.banktransactions.read accounting.payments.read
accounting.manualjournals.read accounting.reports.aged.read accounting.reports.balancesheet.read
accounting.reports.profitandloss.read accounting.reports.trialbalance.read`.

Write scopes (`accounting.invoices`, `accounting.contacts`, `accounting.banktransactions`, `accounting.payments`,
`accounting.manualjournals`) are not requested yet; add them when an agent that writes moves to this connector.
Xero's tools don't ask for confirmation before writing, so an agent must confirm with the user first.

Access to real (non-demo) organisations needs mySMB's Xero app to be on Xero's Core plan or above.

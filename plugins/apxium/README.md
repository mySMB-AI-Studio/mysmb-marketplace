# Apxium (Practice Engine)

Read **Apxium Practice Engine ("PE")** practice-management data through the
myHub-hosted Apxium MCP gateway. Practice Engine is practice-management software
used by accounting and legal firms — matters/jobs, time & billing, trust
accounting, and clients.

This plugin is currently a **connector-only scaffold**: it wires up the
`.mcp.json` pointer and the Connect modal so the plugin can be installed and
configured, but it ships **no tiles yet**. The Apxium MCP server itself is being
built in parallel in a separate `myhub-mcp-servers` PR, and the use case for a
first tile (e.g. open matters, outstanding billing) hasn't been decided yet.

## Authentication

Practice Engine uses machine-to-machine **OAuth2 client-credentials** — there is
no user login redirect. Your **AppId** and **AppKey** (created in PE's admin
panel) are your `client_id`/`client_secret`; the gateway exchanges them for a
short-lived Bearer token automatically on every call. You never paste a bearer
token yourself.

The staff user your AppId maps to needs these PE permissions: `API_Admin`,
`API_Banking`, `API_Billing`, `API_Client`, `API_Export`, `ClientDRS`,
`ClientSearch`, `LodgeHeader`.

See [Practice Engine: Creating an API Access Token](https://support.apxium.com/knowledge/practice-engine-creating-an-api-access-token).

## Configuration

Set these when connecting the plugin in myHub (Settings → Plugins → Connections):

| Variable | Required | Description |
|---|---|---|
| `APXIUM_APP_ID` | Yes | Practice Engine OAuth2 `client_id`, created in Admin → API Authentication Administration. |
| `APXIUM_APP_KEY` | Yes | Practice Engine OAuth2 `client_secret`, issued alongside the App Id. Exchanged server-side for a Bearer token. |
| `APXIUM_SITE` | Yes | The subdomain before `.pehosted.com` — e.g. `acme` for `acme.pehosted.com`. |

## Status

Scaffold only — no widgets/tiles in this PR. Untested against a live Apxium
tenant: the paired MCP server isn't deployed yet and no real Apxium credentials
exist yet.

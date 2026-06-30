# HubSpot

Access HubSpot CRM via HubSpot's official hosted OAuth MCP server at `https://mcp.hubspot.com`. Contacts, companies, deals, tickets, campaigns, owners, and CRM properties — all 12 tools from HubSpot's MCP server with browser OAuth (PKCE), no API keys.

Each user authorises individually; the MCP server only sees data that user can already see in HubSpot.

## Configuration

Connecting requires two credentials from a HubSpot MCP Auth App you create. No environment variables or API keys are required — everything is handled through the workspace Connect dialog.

| Field | Example format | Description |
|---|---|---|
| `OAUTH_CLIENT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Client ID from your HubSpot MCP Auth App |
| `OAUTH_CLIENT_SECRET` | *(generated secret)* | Client Secret from your HubSpot MCP Auth App — stored encrypted, per user |

### One-time setup: create a HubSpot MCP Auth App

You only need to do this once per HubSpot account:

1. Log into your HubSpot account and go to **Development** → **MCP Auth Apps**.
2. Click **Create MCP auth app** and fill in:
   - **App name** — any label (e.g. "myHub Workspace")
   - **Redirect URL** — paste the callback URL shown in the workspace Connect dialog
3. Click **Create** — the app details page shows your **Client ID** and **Client Secret**.
4. Copy both values and paste them into the workspace Connect dialog.
5. Click **Connect** — the browser opens HubSpot's OAuth authorisation page.
6. Sign in and grant the requested permissions. The workspace completes the token exchange and stores the session securely.

### How the authentication works

This plugin uses **OAuth 2.0 with PKCE** (Proof Key for Code Exchange), which is required by HubSpot's MCP server. The flow:

1. **Authorisation request** — the workspace generates a random `code_verifier`, derives a `code_challenge` (SHA-256), and redirects your browser to `https://app.hubspot.com/oauth/authorize` with `code_challenge_method=S256`.
2. **User consent** — you sign in to HubSpot and grant permissions. HubSpot redirects back to the workspace callback URL with a short-lived `code`.
3. **Token exchange** — the workspace POSTs the `code` + `code_verifier` to `https://api.hubapi.com/oauth/v1/token` and receives an `access_token` and `refresh_token`.
4. **Requests** — every MCP call carries the `access_token` as a Bearer token in the `Authorization` header.
5. **Refresh** — when the access token expires, the workspace silently exchanges the `refresh_token` for a new one — no re-login required.

Scopes are determined automatically by the MCP server based on the tools it exposes and the permissions you grant during step 2. No manual scope configuration is needed.

## Tool categories

### CRM records (4)
- `get_user_details` — Returns authenticated user's information, account details, and per-object read/write access
- `search_crm_objects` — Search and filter CRM records using filter groups (AND within group, OR between groups); up to 5 groups × 6 filters; max 200 results/page
- `get_crm_objects` — Fetch one or more CRM objects by their IDs; max 100 IDs per request
- `manage_crm_objects` — Create or update CRM records and activities (contacts, companies, deals, tickets, calls, emails, meetings, notes, tasks)

### Properties & ownership (3)
- `search_properties` — Find property definitions for an object type by keyword; max 5 keywords per request
- `get_properties` — Get full property definitions including data types and enumeration values
- `search_owners` — Find CRM record owners by name or email, or look up owners by ID; max 100 results

### Campaigns & marketing (4)
- `get_campaign_contacts_by_type` — Fetch paginated contact IDs for a campaign filtered by attribution type
- `get_campaign_analytics` — Get campaign analytics (metrics or revenue attribution) for one or more campaigns
- `get_campaign_asset_types` — List available campaign asset type names (e.g., landing pages, blog posts)
- `get_campaign_asset_metrics` — Get metrics and properties for CRM objects associated with a campaign

### Feedback (1)
- `submit_feedback` — Send feedback about the MCP server experience to HubSpot

## Data access

**Read:** contacts, companies, deals, tickets, users, carts, invoices, orders, line items, products, quotes, subscriptions, segments, activities (calls, emails, meetings, notes, tasks), and content (blog posts, landing pages, site pages, campaigns, marketing events)

**Write:** contacts, companies, deals, tickets, line items, products, and activities (calls, emails, meetings, notes, tasks)

> Activity objects are blocked if the account has **Sensitive Data** enabled.

## Destructive operations

Confirm before calling — these mutate or overwrite CRM records:

- `manage_crm_objects` with action `update` — overwrites existing field values
- `manage_crm_objects` with action `create` — creates new records visible to all users with access
- Deleting records is not supported via the MCP API — use the HubSpot UI for deletions.

## See also

- [HubSpot MCP server documentation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server)
- [HubSpot CRM API reference](https://developers.hubspot.com/docs/api/crm/contacts)
- [HubSpot developer portal](https://developers.hubspot.com/)

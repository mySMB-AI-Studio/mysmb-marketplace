# myConnect Platform Admin

The myConnect Platform Console for mySMB platform administrators — every community's health and lifecycle, networks and access grants, and AI provider status. Requires full Platform Console access, re-checked on every call. Install only on mySMB's own workspace.

Hosted by myConnect itself (`https://myconnect.community/api/mcp/platform-admin`, Streamable HTTP). For mySMB platform administrators with full Platform Console access.
Design: myConnect `docs/decisions/ADR-015-mcp-connector-servers.md`.

## Configuration

No environment variables required. Click **Connect**, sign in with your mySMB account and choose
**Allow access** on myConnect's consent screen. The workspace registers itself with myConnect's OAuth
server automatically (dynamic client registration, PKCE) and refreshes the connection silently.

| Scope | Grants |
|---|---|
| `myconnect.platform_admin` | This server only — a token for one myConnect server is refused by the others |

QA and UAT workspaces are pointed at `qa.myconnect.community` / `uat.myconnect.community` automatically
(myHub `MYCONNECT_BASE_URL` rewrite); the URL above is always the production one.

## Tools

| Tool | What it does |
|---|---|
| `get_platform_overview` | Communities by lifecycle, users, active memberships |
| `list_communities` | Every community with lifecycle, members, channels, domain |
| `get_community_health` | One community's operational snapshot |
| `set_community_lifecycle` | Suspend, archive or reactivate a community (reason required, audited) |
| `list_networks` | Community networks and their communities |
| `list_network_grants` | Cross-community access grants |
| `get_ai_provider_status` | AI key/model health (never returns the key) |

Every tool that works inside a community takes an optional `community` (slug or id). It is required
only when you belong to more than one, and it can only ever name one of your own communities.

## Security

- Acts only with the signed-in person's own access; roles are re-checked on every call, not trusted from the connection.
- Changes run the same rules and side-effects as the myConnect app (moderation, workflows, notifications).
- Admin and platform changes are written to the community's audit log as `mcp.<server>.<tool>`.
- Disconnecting in Workspace revokes the connection in myConnect immediately.

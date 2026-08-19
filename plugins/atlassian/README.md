# Atlassian

Access Jira Cloud through a mySMB-owned OAuth app and a myHub-hosted MCP gateway (`/atlassian/mcp`) — click Connect and sign in with your Atlassian account. No client ID/secret to create or paste in.

**Jira only for now.** Jira Service Management (SLA tracking, agent/customer ticket queues) and Confluence (pages, spaces) are explicitly out of scope for this build — a real WorkQ ticket asks for all three, but JSM needs a site-license check and a customer-facing-auth rollout decision resolved first, and Confluence is a separate REST API surface. This plugin is named `atlassian` (not `jira`) because Atlassian's OAuth is genuinely unified across products — one connection, one `accessible-resources` call, usable for Jira/JSM/Confluence alike (same shape as `google-workspace`/`microsoft-365` in this marketplace) — so JSM and Confluence tools/widgets are expected to land in this same plugin later, not a separate one.

Covers projects, issues, and JQL search via Jira Cloud Platform REST API v3.

## Configuration

No environment variables required. Click **Connect** and sign in to your Atlassian account; the workspace completes the OAuth exchange and stores your session securely.

Scope requested during Connect: `read:jira-work` (plus `offline_access`, appended automatically — required to keep the connection refreshing without re-authenticating).

A customer may have more than one Atlassian Cloud site connected. Tools default to the first/only site; call `list_sites` to see every site's `cloudId` and pass `cloud_id` explicitly when a customer has more than one.

## Tools

| Tool | Description |
|---|---|
| `list_sites` | Every Atlassian Cloud site this connection can access, with each site's `cloudId`. |
| `list_projects` | Jira projects visible to the connected user on one site. Classic `startAt`/`maxResults` pagination. |
| `search_issues` | JQL search. Uses Jira's current search endpoint (`POST /rest/api/3/search/jql`) with `nextPageToken` pagination — **not** the older `GET /rest/api/3/search`, which Atlassian fully removed in 2025. |
| `get_issue` | Retrieve a single issue by key (`ABC-123`) or numeric ID. |

**No write tools exist.** Creating, updating, transitioning, or commenting on issues is not supported via this connector — use Jira directly.

## Widgets

- **Tasks Due Today** (`atlassian-tasks-due-today`) — issues assigned to the connected user, due today or overdue, not yet done. JQL: `assignee = currentUser() AND duedate <= endOfDay() AND statusCategory != Done ORDER BY duedate ASC`. Each row's dot tone reflects urgency via the shared `is_overdue` system function (destructive = overdue, warning = due today). On a shared/admin connection, "assigned to me" means whoever connected Jira, not necessarily the tenant as a whole — a real limitation of the single shared-connection model, not a bug.
- **Projects** (`atlassian-project-overview`) — Jira projects visible on the connected site, name + key. No categorical/status color coding — a flat project list has no state to represent, so no tone is applied (deliberately, per `TILE-DISPLAY-STANDARDS.md` §7 — decorative color needs an actual reason to exist).

Both are capped at 20 rows (`max_results: 20`) per the row-limit standard — a "See more" reveal isn't built into the platform yet (see `TILE-DISPLAY-STANDARDS.md` §11), so this is the ceiling until that lands.

## See also

- [Atlassian OAuth 2.0 (3LO) guide](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Cloud Platform REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [myhub-mcp-servers docs/ATLASSIAN.md](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/dev/docs/ATLASSIAN.md) — server-side auth/tool implementation detail

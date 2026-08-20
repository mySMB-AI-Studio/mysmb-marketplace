# Atlassian

Access Jira Cloud and Confluence Cloud through a mySMB-owned OAuth app and a myHub-hosted MCP gateway (`/atlassian/mcp`) — click Connect and sign in with your Atlassian account. No client ID/secret to create or paste in.

**Jira + Confluence. Jira Service Management is the remaining deliberate gap.** A real WorkQ ticket asks for all three, but JSM needs a site-license check (not every Jira site has JSM activated) and a customer-facing-auth rollout decision resolved first — a "my open tickets" tile only makes sense as a personal connection, meaning every individual customer would need to connect themselves, a bigger onboarding lift than the usual one-admin-connection model. This plugin is named `atlassian` (not `jira`) because Atlassian's OAuth is genuinely unified across products — one connection, one `accessible-resources` call, usable for Jira/JSM/Confluence alike (same shape as `google-workspace`/`microsoft-365` in this marketplace) — so JSM tools/widgets are expected to land in this same plugin later, not a separate one.

Covers projects, issues, and JQL search via Jira Cloud Platform REST API v3; spaces, pages, and CQL search via Confluence Cloud REST API.

## Configuration

No environment variables required. Click **Connect** and sign in to your Atlassian account; the workspace completes the OAuth exchange and stores your session securely.

Scopes requested during Connect: `read:jira-work`, `read:page:confluence`, `read:space:confluence`, `search:confluence` (plus `offline_access`, appended automatically — required to keep the connection refreshing without re-authenticating). The Confluence scopes deliberately mix granular (`read:page:confluence`, `read:space:confluence` — required by the current v2 pages/spaces endpoints) and classic (`search:confluence` — CQL search hasn't migrated off the v1 endpoint) styles; both are supported on the same app.

A customer may have more than one Atlassian Cloud site connected. Tools default to the first/only site; call `list_sites` to see every site's `cloudId` and pass `cloud_id` explicitly when a customer has more than one. One site's `cloudId` can host both Jira and Confluence — a site missing Confluence simply won't have the Confluence scopes in its `list_sites` entry.

## Tools

### Jira

| Tool | Description |
|---|---|
| `list_sites` | Every Atlassian Cloud site this connection can access, with each site's `cloudId`. |
| `list_projects` | Jira projects visible to the connected user on one site. Classic `startAt`/`maxResults` pagination. |
| `search_issues` | JQL search. Uses Jira's current search endpoint (`POST /rest/api/3/search/jql`) with `nextPageToken` pagination — **not** the older `GET /rest/api/3/search`, which Atlassian fully removed in 2025. |
| `get_issue` | Retrieve a single issue by key (`ABC-123`) or numeric ID. |

### Confluence

| Tool | Description |
|---|---|
| `list_confluence_spaces` | Confluence spaces visible to the connected user on one site. Cursor-paginated. |
| `search_confluence` | CQL search. Uses `GET /wiki/rest/api/search` (the **v1** endpoint) — CQL content search has not been migrated to v2 as of this writing. |
| `get_confluence_page` | Retrieve a single page by numeric ID, including its body (`storage`, `atlas_doc_format`, or `view` representation — none pre-stripped to plain text). |

**No write tools exist for either product.** Creating, updating, transitioning, or commenting on issues/pages is not supported via this connector — use Jira/Confluence directly.

## Widgets

- **Tasks Due Today** (`atlassian-tasks-due-today`) — issues assigned to the connected user, due today or overdue, not yet done. JQL: `assignee = currentUser() AND duedate <= endOfDay() AND statusCategory != Done ORDER BY duedate ASC`. Each row's dot tone reflects urgency via the shared `is_overdue` system function (destructive = overdue, warning = due today). On a shared/admin connection, "assigned to me" means whoever connected Jira, not necessarily the tenant as a whole — a real limitation of the single shared-connection model, not a bug.
- **Projects** (`atlassian-project-overview`) — Jira projects visible on the connected site, name + key. No categorical/status color coding — a flat project list has no state to represent, so no tone is applied (deliberately, per `TILE-DISPLAY-STANDARDS.md` §7 — decorative color needs an actual reason to exist).
- **Knowledge Base** (`atlassian-knowledge-base`) — recently updated Confluence pages across every visible space. CQL: `type = page ORDER BY lastmodified DESC` — a generic recency view, not a filtered FAQ list, since there's no per-tile configuration UI to let a customer specify which label marks their actual FAQ content (same "no way to override per-portal" limitation documented for HubSpot's membership tiles). Shows Confluence's own pre-formatted `friendlyLastModified` relative-time string rather than re-deriving one from a raw timestamp whose exact format wasn't independently verified. **Known gap:** no click-through link to the page in Confluence yet — building one correctly needs verifying how the search result's site-relative `url` field combines with the site's browser base URL from `list_sites`, which hasn't been tested against a real site yet; flagged here rather than shipping an unverified guess.

All three are capped at 20 rows per the row-limit standard — a "See more" reveal isn't built into the platform yet (see `TILE-DISPLAY-STANDARDS.md` §11), so this is the ceiling until that lands.

## See also

- [Atlassian OAuth 2.0 (3LO) guide](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Cloud Platform REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Confluence Cloud REST API v2](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/)
- [myhub-mcp-servers docs/ATLASSIAN.md](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/dev/docs/ATLASSIAN.md) — server-side auth/tool implementation detail, including the Confluence v1/v2 scope-versioning nuance

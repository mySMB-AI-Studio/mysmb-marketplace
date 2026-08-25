# Atlassian

Access Jira Cloud, Confluence Cloud, and Jira Service Management through a mySMB-owned OAuth app and a myHub-hosted MCP gateway (`/atlassian/mcp`) — click Connect and sign in with your Atlassian account. No client ID/secret to create or paste in.

**Jira + Confluence + an agent-facing JSM queue. A customer-facing "my open tickets" JSM tile is the remaining deliberate gap.** JSM is a separately-licensed Jira product — not every site has it activated, in which case `list_service_desks` simply returns an empty list rather than erroring. The agent/admin-facing Service Desk Queue widget below uses this plugin's usual one-admin shared-connection model, same as every other tile here. A true "my tickets" tile for the *customer* (not the connected admin) still needs a personal-connection rollout decision resolved first — every individual customer would need to connect themselves, a bigger onboarding lift than the shared-connection model, so that one tile remains out of scope. This plugin is named `atlassian` (not `jira`) because Atlassian's OAuth is genuinely unified across products — one connection, one `accessible-resources` call, usable for Jira/JSM/Confluence alike (same shape as `google-workspace`/`microsoft-365` in this marketplace).

Covers projects, issues, and JQL search via Jira Cloud Platform REST API v3; spaces, pages, and CQL search via Confluence Cloud REST API; service desks, queues, requests, and SLAs via the JSM `servicedeskapi`.

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

### Jira Service Management

| Tool | Description |
|---|---|
| `list_service_desks` | Every JSM service desk visible to the connected user on one site. Returns an empty list (not an error) on a site without JSM activated. Offset-paginated. |
| `list_queues` | The queues configured for one service desk (from `list_service_desks`), e.g. a team's triage queue — each includes its own `jql` and `issueCount`. |
| `list_service_desk_requests` | Customer requests (tickets) in one service desk — the primary source for the Service Desk Queue widget. Always expands SLA and status detail server-side. `sla` is absent/empty for request types with no SLA policy configured; `requestFieldValues` contents are entirely request-type-configuration-dependent — don't assume a `priority` field exists. |
| `get_request_sla` | Full SLA detail for one request by issue key/ID — a request can have more than one named SLA clock, hence the `values` array. |

**No write tools exist for any product.** Creating, updating, transitioning, or commenting on issues/pages/requests is not supported via this connector — use Jira/Confluence/JSM directly.

## Widgets

- **Tasks Due Today** (`atlassian-tasks-due-today`) — issues assigned to the connected user, due today or overdue, not yet done. JQL: `assignee = currentUser() AND duedate <= endOfDay() AND statusCategory != Done ORDER BY duedate ASC`. Each row's dot tone reflects urgency via the shared `is_overdue` system function (destructive = overdue, warning = due today). On a shared/admin connection, "assigned to me" means whoever connected Jira, not necessarily the tenant as a whole — a real limitation of the single shared-connection model, not a bug.
- **Projects** (`atlassian-project-overview`) — Jira projects visible on the connected site, name + key. No categorical/status color coding — a flat project list has no state to represent, so no tone is applied (deliberately, per `TILE-DISPLAY-STANDARDS.md` §7 — decorative color needs an actual reason to exist).
- **Knowledge Base** (`atlassian-knowledge-base`) — recently updated Confluence pages across every visible space. CQL: `type = page ORDER BY lastmodified DESC` — a generic recency view, not a filtered FAQ list, since there's no per-tile configuration UI to let a customer specify which label marks their actual FAQ content (same "no way to override per-portal" limitation documented for HubSpot's membership tiles). Shows Confluence's own pre-formatted `friendlyLastModified` relative-time string rather than re-deriving one from a raw timestamp whose exact format wasn't independently verified. Clicking a row opens the real page in Confluence — the URL is `search_confluence`'s own top-level `_links.base` concatenated with each result's relative `url`, confirmed against a real live response.

  **Optional, not required.** Confluence's real value for The Nexus Collective is as a reference source for the Digital Twin, not a dashboard tile — a customer that connects Atlassian gets `search_confluence`/`get_confluence_page`/`list_confluence_spaces` available to Twin chat automatically (any connected + enabled connector's tools are resolved into every Twin turn — no tile, widget, or extra wiring required for that). This widget is kept in the plugin as a nice-to-have surface, not because a tile is necessary for Confluence to be useful.

- **Service Desk Queue** (`atlassian-service-desk-queue`) — bucket board for open requests in one JSM service desk, agent-facing (shows everything visible to the connected admin/agent account, not a per-customer "my tickets" view — see the note at the top of this README on why that tile is deferred). A header badge shows how many requests have a breached "Time to resolution" SLA clock, with a reserved spot beside it for a future opt-in "SLA % this month" action (deliberately not built yet — see the widget's own description). Four click-to-filter stat cards — New / In Progress / Behind / Alerts — are computed client-side from the same single `list_service_desk_requests` response (no second tool call): New/In Progress from `currentStatus.statusCategory` (Jira's own UPPERCASE JSM category string — `"NEW"` / `"INDETERMINATE"`, confirmed against Atlassian's servicedeskapi docs), Behind/Alerts from the "Time to resolution" SLA clock via the `atlassian_request_bucket` widget-element (SLA-urgency-first priority: Alerts > Behind > New > In Progress). Clicking a card selects that bucket (local widget state, click again to deselect) and reveals a filtered request list below, capped at 20 rows. Each row's tone still reflects the most urgent SLA clock still running via `atlassian_sla_tone`/`atlassian_sla_label` (destructive = breached, warning = under 15% of goal duration remaining or under 1h when goalDuration is missing, muted = comfortable or no SLA clock running), and clicking a row still opens the real ticket in Jira via the request's own `_links.agent` URL, unchanged from the prior version.

  **Confirmed limitation: the "New" card reads 0 on the default JSM template.** Verified directly against a live site's workflow diagram — the standard "IT support" template's workflow has no To-Do-category status at all; every new request lands straight in a status Jira categorizes as `INDETERMINATE` ("Waiting for support"). The bucket logic is correct (`statusCategory === "NEW"` is exactly how Jira represents a To-Do-category status generally), it just won't populate unless a customer has customized their workflow to include one — a per-customer configuration limitation, not a defect in this tile.

  **Known limitation: `service_desk_id` is genuinely site-specific and cannot be auto-resolved by this widget.** A widget's `dataProvider` fires exactly one MCP tool call on mount — it can't call `list_service_desks` first and feed a result into a second call, and there's no per-tenant widget-parameter configuration UI yet (the same class of gap as the Knowledge Base's FAQ-label filter above, and HubSpot's custom-object property names). The widget ships with `service_desk_id` pointed at the connected sandbox's own "Support" desk, used only to prove the tile end-to-end against real data — call `list_service_desks` and edit this widget's `dataProvider.params.service_desk_id` before enabling it for any other tenant. A proper fix needs either a per-tenant widget-parameter configuration UI, or `list_service_desks`/`list_service_desk_requests` chaining support in the dataProvider model — both are platform-level, out of scope for this plugin.

All four are capped at 20 rows per the row-limit standard — a "See more" reveal isn't built into the platform yet (see `TILE-DISPLAY-STANDARDS.md` §11), so this is the ceiling until that lands.

## See also

- [Atlassian OAuth 2.0 (3LO) guide](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Cloud Platform REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Confluence Cloud REST API v2](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/)
- [myhub-mcp-servers docs/ATLASSIAN.md](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/dev/docs/ATLASSIAN.md) — server-side auth/tool implementation detail, including the Confluence v1/v2 scope-versioning nuance

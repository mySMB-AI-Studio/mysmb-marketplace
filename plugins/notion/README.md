# Notion

Access Notion pages, data sources, and comments via the **myHub-hosted Notion MCP gateway** — a self-hosted connector (`myhub-mcp-servers/src/integrations/notion`) that talks to Notion's own REST API on your behalf. Covers workspace search, page reading/authoring, database and data-source inspection, row queries, and comments, all through a single OAuth-authenticated endpoint.

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to Notion, grant the requested pages/databases, and you're done. The MCP server only sees content the connected Notion account has explicitly shared with the integration.

## Configuration

No environment variables are required on the client side — this plugin's `.mcp.json` points at myHub's own hosted MCP gateway, and myHub injects the OAuth bearer token automatically once you connect.

On first use, Connect redirects to Notion's OAuth 2.0 authorization page (`https://api.notion.com/v1/oauth/authorize`) — sign in, choose a workspace if you belong to more than one, select which pages/databases to share, and you're returned to myHub. Notion has no granular OAuth scope system: access is controlled entirely by what you share with the integration during that same authorize screen, not by a scope negotiation.

Token behavior (see `myhub-mcp-servers/src/integrations/notion/provider.ts`'s header comment for the authoritative source): Notion's OAuth docs document no `expires_in` for the access token, and Notion access tokens are workspace/bot-scoped rather than tied to a timed session — the only documented way one stops working is the user uninstalling/revoking the integration in Notion. Notion does issue a real, usable `refresh_token` grant (unlike some other connectors in this marketplace that have no refresh grant at all), so myHub treats the token as long-lived but keeps a genuine refresh path wired in case Notion ever starts sending a real expiry, or in case a token needs recovering after being revoked and reissued. If the connection ever stops working, click Connect again to re-authorize.

### Prerequisites

- A Notion account (Free, Plus, Business, or Enterprise plan) — no specific plan is required by this connector; it uses Notion's standard public REST API, not an Enterprise-only feature.
- Share the pages/databases you want this connector to see — either during the Connect flow, or later in Notion via **Settings → Connections**. A `403` on a specific id almost always means it hasn't been shared, not that the connection is broken.

## Tools & resources

This connector exposes the following MCP tools, backed directly by Notion's REST API:

### Users

| Tool | Description |
|------|-------------|
| `get_current_user` | The bot/workspace identity this connection authenticates as — bot id, workspace name, owner info. |
| `list_users` | Every person and bot user in the connected workspace this integration can see. |

### Search

| Tool | Description |
|------|-------------|
| `search` | Search titles of pages and data sources shared with this integration. Omit `query` to list everything shared — Notion has no separate "list all pages" endpoint. Optional `object_type` (`"page"` or `"data_source"` — **not** `"database"`), `sort_direction`, `page_size`, `start_cursor`. |

### Pages

| Tool | Description |
|------|-------------|
| `get_page` | A page's metadata and property values by id. Does not include body content. |
| `get_page_content` | A page's body content as a list of blocks. Blocks with children only report `has_children: true` — call again with that block's id to descend into it. |
| `create_page` | Create a page as a child of another page (`parent_page_id`) or as a new row in a database (`parent_database_id`). |
| `update_page` | Update a page's property values and/or archived state. |

### Databases / data sources

Notion's `2025-09-03` API change split what used to be a single "database" concept into a **container** (the database itself — just title + url) plus one or more **data sources** (where the actual property schema and rows live). Almost every database has exactly one data source, but the shape means these two tools are not interchangeable:

| Tool | Description |
|------|-------------|
| `get_database` | A database's container metadata (title, url) and its `data_sources` array (id + name for each). **No property schema here.** |
| `get_data_source` | A data source's full property schema (column names, types, select options, etc.) plus its title and url. |
| `query_database` | Query a data source's rows, with optional `filter`/`sorts`. **Takes a `data_source_id`, not a `database_id`, despite the tool's name** — get one from `get_database`'s `data_sources` array first. |

Typical flow: `search` (or a known link) → `get_database` → `get_data_source` (to learn the schema) → `query_database`.

### Comments

| Tool | Description |
|------|-------------|
| `get_comments` | List comments on a page or block, oldest first. Requires the integration to have comment-read capability enabled in Notion. |
| `create_comment` | Add a comment to a page, a block, or as a reply in an existing discussion thread. Requires comment-write capability. |

## Capabilities this connector does NOT have

The previous version of this plugin pointed at Notion's own hosted MCP server (`mcp.notion.com`), which exposed a richer tool set. This self-hosted connector talks to Notion's plain REST API directly and genuinely does not support the following — they are not implemented here, not just undocumented:

- **Duplicating a page.**
- **Moving a page or a database row between parents.**
- **Creating a new database, or any of its views.**
- **Updating a data source's view configuration** (filters/sorts/display settings on a saved view).
- **Querying across multiple data sources at once** (cross-database aggregation).
- **Listing teams/teamspaces.**

If you need any of these, use the Notion UI directly. `create_page`/`update_page` still cover the common "add a row to an existing database" and "edit a page" workflows — the gap is specifically around database/view *structure* and page *relocation/duplication*, not day-to-day content editing.

## Destructive / mutating operations

Confirm before calling — these change workspace content:

- `create_page` — creates a new page or database row.
- `update_page` — can overwrite property values or archive a page.
- `create_comment` — adds account-visible content to a page's discussion.

There is no delete tool. Use the Notion UI to permanently remove a page — `update_page`'s `archived` field moves it to the trash-equivalent parent state, it does not delete it.

## Rate limits

Notion's REST API is rate-limited per integration (roughly 3 requests/second average, per Notion's own published limits). If a tool call returns a `429`, wait a few seconds and retry once.

## Widgets

Two dashboard tiles are included. Add them to any MyHub dashboard from the widget picker.

| Widget ID | Title | Description |
|-----------|-------|-------------|
| `notion-recent-pages` | Recent Notion Pages | Pages recently created or edited in your Notion workspace — title, last edited time. Calls `search` with `object_type: "page"`. |
| `notion-search-results` | Recent Notion Content | Recently edited pages **and data sources** in your Notion workspace — title, type, and last edited time. Calls `search` with no `object_type` filter. |

> **Note**: Both widgets call the `search` tool internally and share the same state slot in the widget runtime. Do not place both on the same dashboard simultaneously — one will overwrite the other's data. Use `notion-recent-pages` for a pages-only feed, or `notion-search-results` for all content types (pages + data sources). Pick one per dashboard.

`notion-search-results` can return both pages and data sources in the same list. Pages and data sources carry their title in different places in Notion's API response (a page's title lives in one of its `properties`; a data source's title is a top-level field), so this widget ships its own `widget-elements` helper (`notion_result_title`) to read the right shape for each row rather than assuming one. The same module also maps the raw `object` field (`"page"` / `"data_source"`) to a Title Case badge label (`Page` / `Data Source`) and a matching row icon, per this repo's `TILE-DISPLAY-STANDARDS.md` §3 rule against showing a raw connector enum directly in a badge.

## See also

- [Notion API reference](https://developers.notion.com/reference/intro)
- [Notion authorization (OAuth) guide](https://developers.notion.com/docs/authorization)
- [Notion API versioning](https://developers.notion.com/reference/versioning)
- [Working with databases (the 2025-09-03 data-source split)](https://developers.notion.com/docs/working-with-databases)

# Notion

Access Notion pages, databases, tasks, comments, and workspace members via Notion's official hosted MCP server at `https://mcp.notion.com/mcp`. Covers documentation, task management, knowledge search, report building, and campaign planning from a single OAuth-authenticated endpoint.

Browser OAuth — no API keys, no env vars. Each user authorises individually; the MCP server only sees data that user can already access in Notion.

## Configuration

No environment variables are required on the client side. On first use, the browser redirects to Notion's OAuth 2.0 Authorization Code flow with PKCE — sign in, grant the requested permissions, and subsequent calls flow over the authorised session.

Access tokens expire after one hour. The workspace refreshes them automatically using the refresh token. Refresh tokens are valid for up to 180 days from the initial authorisation, or 30 consecutive days of inactivity, whichever comes first. If the connection stops working after a long period of inactivity, click Connect again to re-authorise.

### Prerequisites

- A Notion account (Free, Plus, Business, or Enterprise plan).
- The Notion workspace you want to access must be connected during the OAuth flow — select the correct workspace if you belong to more than one.
- Pages and databases the bot integration can access are controlled by Notion's standard sharing model: share individual pages with the integration, or grant workspace-level access during the OAuth flow.

## Available actions

### Search and find answers (`notion-search`, `notion-fetch`)

- Search across pages, databases, and connected sources (Slack, Google Drive, Jira where configured) using natural language or exact terms. Full cross-workspace search including connected tools requires Notion AI access; without it, results are limited to workspace content only.
- Retrieve the full content and schema of any page or database by URL or ID.

### Create documentation (`notion-create-pages`, `notion-update-page`, `notion-duplicate-page`)

- Create one or more pages in any parent page or database with specified properties and rich-text content.
- Update existing pages — change title, body content, icon, cover, or any property.
- Duplicate a page (including nested content) asynchronously within the workspace.

### Manage tasks (`notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-query-database-view`)

- Create task entries in a Notion database with assignee, status, due date, and priority properties.
- Update task status, reassign, or change due dates on existing pages.
- Move tasks between databases or parent pages.
- Query a database view to list tasks filtered and sorted by any property (requires Business plan or higher with Notion AI).

### Build reports (`notion-create-database`, `notion-update-data-source`, `notion-create-view`, `notion-update-view`, `notion-query-data-sources`, `notion-query-database-view`)

- Create a new database with custom property schema (text, number, select, date, relation, formula, etc.).
- Add or modify data source properties and attributes.
- Create table, board, list, calendar, timeline, gallery, form, chart, map, or dashboard views on any database.
- Configure view filters, sorts, and display settings.
- Query a database view using its pre-defined filters and sorts (Business plan or higher with Notion AI required for `notion-query-database-view`).
- Query across multiple data sources to aggregate and summarise information (Enterprise plan with Notion AI required for `notion-query-data-sources`).

### Plan campaigns (`notion-create-pages`, `notion-create-database`, `notion-create-view`, `notion-create-comment`, `notion-get-teams`, `notion-get-users`)

- Create campaign planning databases with timeline and status tracking.
- Scaffold campaign pages with structured content and linked databases.
- Add comments and discussion threads to pages for team collaboration.
- List teams and workspace members to assign ownership.

### Comments and collaboration (`notion-create-comment`, `notion-get-comments`)

- Add comments to any page or specific inline content.
- List all discussion threads and comments on a page.

### Workspace and users (`notion-get-teams`, `notion-get-users`, `notion-get-user`, `notion-get-self`)

- List all teamspaces in the workspace.
- List workspace members with their details.
- Look up a specific user by ID.
- Retrieve the bot's own user record and workspace identity.

## Destructive operations

Confirm before calling — these mutate or remove workspace content:

- `notion-update-page` — overwrites existing page content or properties.
- `notion-move-pages` — relocates pages or databases; old parent loses the item.
- `notion-update-data-source` — modifies database schema (property additions/renames/deletions).
- `notion-update-view` — changes filters and sorts on a shared view visible to all team members.
- `notion-create-pages` with content — creates account-visible pages.

## Rate limits

- General tools: 180 requests per minute (averaged per user).
- `notion-search`: 30 requests per minute.

If you receive a rate-limit error, wait a few seconds before retrying.

## Widgets

Two dashboard tiles are included. Add them to any MyHub dashboard from the widget picker.

| Widget ID | Title | Description |
|-----------|-------|-------------|
| `notion-recent-pages` | Recent Notion Pages | Pages recently created or edited in your Notion workspace — title, last edited time. |
| `notion-search-results` | Recent Notion Content | Recently edited pages and databases in your Notion workspace — title, type, and last edited time. |

> **Note**: Both widgets call `notion-search` internally and share the same state slot in the widget runtime. Do not place both on the same dashboard simultaneously — one will overwrite the other's data. Use `notion-recent-pages` for a pages-only feed, or `notion-search-results` for all content types (pages + databases). Pick one per dashboard.

## See also

- [Get started with Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp)
- [Notion MCP supported tools](https://developers.notion.com/guides/mcp/mcp-supported-tools)
- [Build an MCP client for Notion](https://developers.notion.com/guides/mcp/build-mcp-client)
- [Notion API reference](https://developers.notion.com/reference/intro)

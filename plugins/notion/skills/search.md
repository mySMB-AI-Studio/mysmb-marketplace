---
name: notion-search
description: Search Notion pages and databases, or fetch a specific page/database by URL or ID. Use when the user asks to find information in Notion, look up a document, check a database record, or retrieve the contents of a page.
---

# Notion — searching and fetching content

Use the `notion` MCP server for all search and retrieval operations.

## Searching the workspace

Call `notion-search` with a `query` string to search across all pages, databases, and connected sources (Slack, Google Drive, Jira if configured). Results include page titles, snippets, and IDs.

> **Plan requirement**: `notion-search` returns full cross-workspace results only when the workspace has Notion AI access. Without Notion AI, results are limited to workspace-only content and connected tools are not included.

- Keep queries concise — keyword phrases work better than full sentences.
- Filter to a specific object type by passing `filter: { property: "object", value: "page" }` or `filter: { property: "object", value: "data_source" }`. Note: the API does not accept `"database"` as a filter value — use `"data_source"` for databases.
- Results are sorted by relevance by default; use `sort: { direction: "descending", timestamp: "last_edited_time" }` to surface recently edited content.
- Rate limit: 30 requests per minute. If the user submits rapid sequential searches, introduce a short pause between calls.

Present results as a numbered list: title, object type, and last edited date. Offer to fetch full content for any result the user selects.

## Fetching a page or database

Call `notion-fetch` with the page or database URL or ID to retrieve full content including the schema, properties, and all blocks.

- Accept Notion share URLs (`https://www.notion.so/...`) or bare UUIDs.
- For large pages with many blocks, the response may be paginated — follow `next_cursor` to retrieve subsequent pages.
- When the user says "open", "show", "get", or "read" followed by a page name, search first to resolve the ID, then fetch.

## Querying a database view

To retrieve filtered and sorted rows from a database, use `notion-query-database-view` with the database view URL or ID. This respects the view's existing filters and sorts. Requires Business plan or higher with Notion AI.

For ad-hoc queries not tied to a saved view, use `notion-query-data-sources` (requires Enterprise plan with Notion AI) with a natural-language query.

## Error handling

- `401 Unauthorized` — the OAuth session has expired or the user has not yet authorised. Ask the user to reconnect via the plugin settings.
- `403 Forbidden` — the integration does not have access to the requested page or database. Ask the user to share the page with the integration in Notion.
- `404 Not Found` — the page or database ID does not exist or has been deleted.
- Rate limit (429) — wait 2–3 seconds and retry once.

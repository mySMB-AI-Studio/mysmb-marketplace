---
name: notion-search
description: Search Notion pages and data sources, or fetch a specific page/database by id. Use when the user asks to find information in Notion, look up a document, check a database record, or retrieve the contents of a page.
---

# Notion — searching and fetching content

Use the `notion` MCP server for all search and retrieval operations.

## Searching the workspace

Call `search` with a `query` string to search titles of pages and data sources shared with this integration. Omit `query` to list everything shared — Notion has no separate "list everything" endpoint other than an empty search.

- Keep queries concise — keyword phrases work better than full sentences. This searches titles only, not body content.
- Filter to a specific object type with `object_type: "page"` or `object_type: "data_source"`. Note: the API does not accept `"database"` as a filter value — use `"data_source"`. A database's container itself is not directly searchable; you find its data source(s) this way, then call `get_database`/`get_data_source` on the parent database id if you need container-level info.
- Results are sorted by relevance by default; pass `sort_direction: "descending"` (or `"ascending"`) to sort by last-edited time instead.
- Paginate with `page_size` (1-100) and `start_cursor` (from a previous response's `next_cursor`, only when `has_more` was true).

Present results as a numbered list: title, object type, and last edited date. A result's `object` field is `"page"` or `"data_source"` — read the title accordingly (see "Reading a result's title" below), and offer to fetch full content for any result the user selects.

## Reading a result's title

A `search` result's title lives in a different place depending on its `object` type:

- **page** — inside `properties`, under whichever property has `type: "title"` (commonly, but not always, a property literally named "title"; a database row can name it anything).
- **data_source** — a top-level `title` rich-text array directly on the object.

Don't assume `properties.title.title[0].plain_text` works for every result — check `object` first.

## Fetching a page or database

- `get_page` — a page's metadata and property values by id. Does not include body content.
- `get_page_content` — a page's body as a list of blocks (paragraphs, headings, lists, etc). A block reporting `has_children: true` needs a follow-up call with that block's id to see its children.
- `get_database` — a database's container metadata (title, url) and its `data_sources` array. No property schema here.
- `get_data_source` — a data source's full property schema (names, types, select options). Get the id from `get_database`'s `data_sources` array or directly from a search result with `object_type: "data_source"`.
- `query_database` — query a data source's rows with optional `filter`/`sorts`. Takes a `data_source_id`, not a `database_id`, despite the name.

When the user says "open", "show", "get", or "read" followed by a name, `search` first to resolve the id, then fetch.

## Error handling

- `401 Unauthorized` — the OAuth session has expired or been revoked. Ask the user to reconnect via the plugin settings.
- `403 Forbidden` — the integration does not have access to the requested page or database. Ask the user to share it with the integration in Notion (Settings → Connections).
- `404 Not Found` — the id does not exist or has been deleted.
- Rate limit (429) — wait a few seconds and retry once.

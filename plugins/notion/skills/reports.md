---
name: notion-reports
description: Query and populate existing Notion databases for reporting. Use when the user asks to pull data out of a Notion database, add rows to a report tracker, inspect a database's schema, or summarize rows filtered by property.
---

# Notion — reporting against existing databases

Use the `notion` MCP server to read and populate reporting data in Notion. **This connector cannot create new databases or views** — see the gap note below. Its scope is querying and adding rows to a database that already exists in the workspace.

## Finding the report database

1. Call `search` with `object_type: "data_source"` and a query matching the report's name.
2. Confirm the result with the user. If they hand you a database link/id instead, call `get_database` on it first — its `data_sources` array holds the id(s) `get_data_source`/`query_database` actually need.
3. Call `get_data_source` on that id for the full property schema — names, types, and (for `select`/`multi_select`) the available option values.

## Querying for report data

Call `query_database` with the data source id and optional `filter`/`sorts` objects (see `get_data_source`'s property names/types for what's filterable). This returns one data source's rows; it does not aggregate across data sources — Notion's cross-database query capability isn't part of this connector (see gap note).

To build a report across more than one database, call `query_database` once per data source and combine/summarize the results yourself before presenting to the user.

## Adding a row to an existing report database

Call `create_page` with `parent_database_id` set to the report database's id and `properties` matching the schema from `get_data_source`. Confirm the schema with the user before creating if any property mapping is ambiguous — a wrong property name causes a `400`.

## Updating a row

Call `update_page` with the row's page id and the properties to change. Fetch `get_data_source` first if you're unsure of a property's exact name or valid option values.

## What this connector can't do

The previous Notion plugin (backed by Notion's own hosted MCP server) could scaffold new databases and add table/board/chart/calendar views. This connector's server has no tools for any of that. Concretely, this connector cannot:

- Create a new database or its initial schema.
- Add, edit, or remove a view (table/board/calendar/chart/etc) on any database.
- Update a data source's own property schema (rename/add/remove columns).
- Query across multiple data sources in a single call.

If the user needs a new report structure or a new view, walk them through creating it in the Notion UI directly — once it exists, this connector's `query_database`/`create_page`/`update_page` can read and populate it.

## Error handling

- Formula or rollup values look stale after the user changes something in Notion directly: re-run `get_data_source` — computed values reflect the schema at query time.
- `400 Bad Request` on `create_page`/`update_page`: verify property names and option values against a fresh `get_data_source` call.

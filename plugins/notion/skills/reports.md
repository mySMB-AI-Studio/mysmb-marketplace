---
name: notion-reports
description: Build Notion databases and views for reporting and analytics. Use when the user asks to create a report, set up a dashboard, add a new view to a database, configure filters or sorts, or aggregate data across Notion databases.
---

# Notion — building reports

Use the `notion` MCP server to create databases, views, and data aggregations for reporting.

## Creating a report database

Call `notion-create-database` to scaffold a new database. Required fields:

- `parent` — the parent page (uses `{ "type": "page_id", "page_id": "<id>" }` — databases can only be created under a page, not another database).
- `title` — an optional array of rich text objects naming the database (top-level field).
- `initial_data_source.properties` — a map of property name to property schema object. Note: `properties` is **nested inside `initial_data_source`**, not a top-level field.

Common reporting property types:

| Type | Use case |
|------|----------|
| `title` | Row name / report item |
| `number` | Metrics, counts, revenue |
| `select` | Status, category, region |
| `multi_select` | Tags |
| `date` | Period, due date |
| `formula` | Calculated fields |
| `relation` | Link to another database |
| `rollup` | Aggregate values from a relation |
| `people` | Owners |
| `url` | Source links |

Always confirm the schema with the user before creating — changing property types after creation requires deleting and re-adding properties.

## Adding views to a database

Call `notion-create-view` to add a view to an existing database. Specify:

- `database_id` — the target database (the official API parameter is `database_id`, not `parent_database_id`).
- `type` — one of: `table`, `board`, `list`, `calendar`, `timeline`, `gallery`, `form`, `chart`, `map`, `dashboard`.
- `name` — a descriptive label (e.g. "Q3 Revenue by Region").
- `filter` — optional filter object to scope the view.
- `sorts` — optional sort order.

Recommended view types for reporting:

| View type | Best for |
|-----------|----------|
| `table` | Tabular data with many properties |
| `board` | Status-based kanban reporting |
| `chart` | Visual summaries (bar, pie, line) |
| `timeline` | Gantt-style project tracking |
| `calendar` | Date-driven reports |

## Updating an existing view

Call `notion-update-view` with the view ID to adjust name, filters, sorts, or display settings. Present the current view configuration to the user first so changes are intentional — views are shared and visible to all workspace members.

## Updating a database schema

Call `notion-update-data-source` to modify an existing database's properties — rename, add, or change property settings. Warn the user before removing a property as doing so deletes all data in that column.

## Querying for report data

Use `notion-query-database-view` to pull rows for a specific view (requires Business plan or higher with Notion AI). Combine multiple queries to build a cross-database report:

1. Identify all source databases via `notion-search`.
2. Query each with `notion-query-database-view`.
3. Aggregate and present the combined data to the user as a summary table or narrative.

For semantic aggregation (e.g. "total revenue across all project databases"), use `notion-query-data-sources` (requires Enterprise plan with Notion AI).

> **Plan requirements**: `notion-search` returns full results only with Notion AI access; without it, results are limited to the workspace. `notion-query-database-view` requires Business plan or higher with Notion AI. `notion-query-data-sources` requires Enterprise plan with Notion AI.

## Error handling

- Formula or rollup errors after schema changes: re-fetch the database to check property IDs have not changed.
- `400 Bad Request` on view create: verify the `type` value is one of the supported view types listed above.

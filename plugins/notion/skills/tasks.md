---
name: notion-tasks
description: Create, update, and query Notion tasks stored in a database. Use when the user asks to add a task, update task status, assign work, change due dates, or list open tasks in Notion.
---

# Notion — managing tasks

Tasks in Notion are rows in a database — technically rows in one of that database's **data sources** (see Notion's `2025-09-03` database/data-source split). Use the `notion` MCP server for all task operations.

## Finding the task database

Before creating or querying tasks, identify the correct data source:

1. Call `search` with `object_type: "data_source"` and a query like "tasks" or "to-do".
2. Present the results to the user and confirm which one to use. If they instead give you a database link/id, call `get_database` on it first — its `data_sources` array has the id(s) you actually need (almost every database has exactly one).
3. Call `get_data_source` with that id to inspect its property schema — note property names and types (e.g. the status property might be called "Status", "State", or something custom).

## Creating a task

Call `create_page` with `parent_database_id: "<data_source's parent database id>"`. Map the user's intent to the schema you learned from `get_data_source`:

| Common property name | Notion type | Example value |
|----------------------|-------------|---------------|
| Title / Name | `title` | `[{ "text": { "content": "Write Q3 report" } }]` |
| Status | `status` or `select` | `{ "name": "In progress" }` |
| Assignee | `people` | `[{ "id": "<user_id>" }]` |
| Due date | `date` | `{ "start": "2026-07-01" }` |
| Priority | `select` | `{ "name": "High" }` |

Resolve assignee names to user ids via `list_users` before calling create. Always confirm task details with the user before creating.

After creating, echo: "Task '[title]' created — due [date], assigned to [name]."

## Updating a task

Call `update_page` with the task's page id and the changed properties. Common updates:

- Mark complete: set the status property to its "Done" option name.
- Reassign: update the `people`-type assignee property.
- Change due date: update the `date`-type property.
- Add a note: use `create_comment` after updating the page.

Find the task's page id via `search` (title match) or `query_database`.

## Querying tasks

Call `query_database` with the data source's id (**not** the database's own id — see "Finding the task database" above) and optional `filter`/`sorts` objects, e.g. `{ "property": "Status", "select": { "equals": "Done" } }` or `[{ "property": "Due date", "direction": "ascending" }]`. Property names/types come from `get_data_source`.

Present tasks as a list: title, status badge, assignee, due date.

## What this connector can't do

- **Moving a task to a different database or parent page.** There is no move tool. To relocate a task, create a new page in the target location with the same properties and archive the old one (`update_page` with `archived: true`), or tell the user to move it from the Notion UI.
- **Querying multiple task databases at once.** `query_database` targets one data source per call — run it once per database and combine results yourself if the user needs a cross-project view.

## Resolving users

Call `list_users` to list all workspace members (people and bots). Match names by the `name` field. If ambiguous, present the list and ask the user to pick.

## Error handling

- Property name mismatch: always call `get_data_source` before creating to confirm exact property names and option values.
- `400 Bad Request` on a status/select update: the option name does not exist in that property's schema. Re-check `get_data_source`.

---
name: notion-tasks
description: Create, update, move, and query Notion tasks stored in a database. Use when the user asks to add a task, update task status, assign work, change due dates, list open tasks, or reorganise tasks in Notion.
---

# Notion — managing tasks

Tasks in Notion are rows in a database. Use the `notion` MCP server for all task operations.

## Finding the task database

Before creating or querying tasks, identify the correct database:

1. Call `notion-search` with `filter: { property: "object", value: "data_source" }` and a query like "tasks" or "to-do". Note: the API does not accept `"database"` as a filter value — use `"data_source"` for databases.
2. Present the results to the user and confirm which database to use.
3. Call `notion-fetch` with the database ID to inspect its property schema — note property names and types (e.g. the status property might be called "Status", "State", or something custom).

## Creating a task

Call `notion-create-pages` with `parent: { "type": "database_id", "database_id": "<id>" }`. The `type` field is required. Map the user's intent to the database schema:

| Common property name | Notion type | Example value |
|----------------------|-------------|---------------|
| Title / Name | `title` | `[{ "text": { "content": "Write Q3 report" } }]` |
| Status | `status` or `select` | `{ "name": "In progress" }` |
| Assignee | `people` | `[{ "id": "<user_id>" }]` |
| Due date | `date` | `{ "start": "2026-07-01" }` |
| Priority | `select` | `{ "name": "High" }` |

Resolve assignee names to user IDs via `notion-get-users` before calling create. Always confirm task details with the user before creating.

After creating, echo: "Task '[title]' created — due [date], assigned to [name]."

## Updating a task

Call `notion-update-page` with the task page ID and the changed properties. Common updates:

- Mark complete: set the status property to its "Done" option name.
- Reassign: update the `people`-type assignee property.
- Change due date: update the `date`-type property.
- Add a comment: use `notion-create-comment` after updating the page.

To find the task page ID, search by title or query the database view.

## Querying tasks

Call `notion-query-database-view` with a database view URL or ID to list tasks with the view's existing filters and sorts. Requires Business plan or higher with Notion AI.

For a custom query (e.g. "show me all overdue tasks assigned to Alice"), use `notion-query-data-sources` with a natural-language description (requires Enterprise plan with Notion AI). Otherwise, describe the query and walk the user through applying a filter in Notion.

Present tasks as a list: title, status badge, assignee, due date.

## Moving tasks

Call `notion-move-pages` to relocate a task page to a different parent database or page. Confirm destination before calling — the task disappears from its current location.

## Resolving users

Call `notion-get-users` to list all workspace members. Match names by `name` field. If the name is ambiguous, present the list and ask the user to pick.

## Error handling

- Property name mismatch: always fetch the database schema before creating to confirm exact property names and option values.
- `409 Conflict` on status update: the status option name does not exist in the select. Fetch the database schema to see valid options.

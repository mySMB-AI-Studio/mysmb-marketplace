---
name: notion-campaigns
description: Plan and track marketing campaigns in an existing Notion campaign database, brief pages, and comments. Use when the user asks to add a campaign, create a campaign brief, assign a campaign owner, or review campaign status in Notion.
---

# Notion — campaign planning

Use the `notion` MCP server to work with campaign planning content in Notion. **This connector cannot create a new campaign database or its views** (see gap note below) — it assumes a campaign tracker database already exists in the workspace, and covers populating and reading it, plus brief pages and comments.

## Finding the campaign database

1. Call `search` with `object_type: "data_source"` and a query like "campaign" or "marketing".
2. Confirm with the user which data source to use. If they give you a database link/id, call `get_database` first — its `data_sources` array has the id `get_data_source`/`query_database`/`create_page` actually need.
3. Call `get_data_source` to confirm the exact property names (e.g. Status, Owner, Launch Date, Channel) and, for `select`/`multi_select` properties, the valid option values — don't assume the schema described below matches exactly.

A typical campaign database has properties like:

| Property name | Type |
|---------------|------|
| Campaign Name | `title` |
| Status | `select` (e.g. Planning, In Review, Active, Complete, Cancelled) |
| Owner | `people` |
| Launch Date | `date` |
| Channel | `multi_select` |
| Goal | `rich_text` |
| Link | `url` |

Always defer to what `get_data_source` actually reports over this table — schemas vary per workspace.

## Adding a campaign row

Call `create_page` with `parent_database_id` set to the campaign data source's id and `properties` matching its real schema. Confirm the values with the user before creating.

## Creating a campaign brief page

Call `create_page` with `parent_page_id` set to the campaign row's page id (or another page the user names) to add a brief as a child page. `create_page` only takes `properties` (title) here — there's no `children` block for body content in this connector, so structure the brief's sections (Goals, Target Audience, Key Messages, Channels, Timeline, Assets, Success Metrics) as a plan with the user and add that content separately if the workflow needs actual body blocks (see `notion-documentation` skill's note on the same limitation).

## Assigning an owner

Call `list_users` to list workspace members, then `update_page` on the campaign row to set its `people`-type owner property to the resolved user id.

## Campaign status reviews

Call `query_database` on the campaign data source with a `filter`/`sorts` to list campaigns by status or date. Present results as a summary table and highlight campaigns that look overdue (launch date passed, status not "Complete").

## Collaboration

Call `create_comment` to add feedback or an approval request to a campaign page (provide exactly one of `parent_page_id`, `parent_block_id`, or `discussion_id`). Call `get_comments` to review existing threads before adding new ones.

## What this connector can't do

- **Creating a new campaign database or its schema.** If no campaign tracker exists yet, the user needs to create it in the Notion UI first — this connector can then populate and query it.
- **Adding or editing views** (calendar, board, table, etc) on the database. View setup also happens in the Notion UI.
- **Listing teams/teamspaces.** There is no tool for this — ask the user directly which team owns a given campaign, or track it as a database property instead (e.g. a "Team" select property).

## Error handling

- `400 Bad Request` on `create_page`/`update_page`: verify property names and option values against a fresh `get_data_source` call.
- `403 Forbidden`: the integration does not have write access to the target page or database. Ask the user to share it with the integration and grant edit access.
- `404 Not Found`: the id does not exist or has been deleted — re-run `search` to get a fresh one.
- Rate limit (429): wait a few seconds and retry once before surfacing the error to the user.

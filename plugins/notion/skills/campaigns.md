---
name: notion-campaigns
description: Plan and track marketing campaigns in Notion using pages, databases, and collaborative comments. Use when the user asks to plan a campaign, set up a campaign tracker, create a campaign brief, assign campaign owners, or review campaign status in Notion.
---

# Notion — campaign planning

Use the `notion` MCP server to build campaign planning structures in Notion.

## Campaign planning workflow

A typical campaign planning setup in Notion uses:

1. A **campaign database** — one row per campaign with status, owner, launch date, and channel properties.
2. A **campaign brief page** — a child page under each database row with goals, target audience, messaging, and asset links.
3. A **calendar view** — shows campaigns by launch date.
4. A **board view** — shows campaigns by status (Planning, Active, Complete, Cancelled).

## Setting up a campaign database

Call `notion-create-database` with these recommended properties:

| Property name | Type | Options |
|---------------|------|---------|
| Campaign Name | `title` | — |
| Status | `select` | Planning, In Review, Active, Complete, Cancelled |
| Owner | `people` | — |
| Launch Date | `date` | — |
| End Date | `date` | — |
| Channel | `multi_select` | Email, Social, Paid, Content, Events, PR |
| Budget | `number` | Format: dollar |
| Goal | `rich_text` | — |
| Link | `url` | — |

Confirm the property list with the user before creating — they may want to add or remove columns.

## Creating a campaign brief

After creating the database row, call `notion-create-pages` to add a child page under the campaign row with:

- Heading blocks for each brief section: Goals, Target Audience, Key Messages, Channels, Timeline, Assets, Success Metrics.
- Callout blocks for critical notes or approvals needed.
- To-do blocks for pre-launch checklist items.

## Assigning owners

Call `notion-get-users` to list workspace members, then update the campaign row's `people` property with the owner's user ID via `notion-update-page`.

## Adding views

Call `notion-create-view` twice after the database is created:

1. Calendar view: `type: "calendar"`, date property set to "Launch Date".
2. Board view: `type: "board"`, group-by set to "Status".

## Campaign status reviews

Call `notion-query-database-view` on the board or table view to list all campaigns with their current status. Present results as a summary table and highlight campaigns that are overdue (launch date passed, status not "Complete").

> **Plan requirement**: `notion-query-database-view` requires Business plan or higher with Notion AI. If the workspace does not meet this requirement, ask the user to filter campaigns in the Notion UI or use `notion-fetch` to inspect the database directly.

## Collaboration

Call `notion-create-comment` to add feedback or approval requests to a campaign page. Call `notion-get-comments` to review existing threads on a page before adding new comments.

## Identifying teams

Call `notion-get-teams` to list teamspaces and identify which team owns which campaign database.

## Error handling

- `400 Bad Request` on database create: verify all property types are valid and the parent page ID is correct.
- `403 Forbidden`: the integration does not have write access to the target page or database. Ask the user to share it with the integration and grant "Can edit" access.
- `404 Not Found`: the parent page or database ID does not exist or has been deleted — re-run `notion-search` to get a fresh ID.
- Rate limit (429): wait 3 seconds and retry once before surfacing the error to the user.

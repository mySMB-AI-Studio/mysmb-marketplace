---
name: notion-documentation
description: Create and update Notion pages for documentation purposes. Use when the user asks to write a document, create a wiki page, update an existing page, or add content to Notion.
---

# Notion — creating and updating documentation

Use the `notion` MCP server for all page authoring operations.

## Creating pages

Call `create_page` with exactly one of:

- `parent_page_id` — place the new page under an existing page.
- `parent_database_id` — create a new row in a database (a data source). `properties` keys must match that data source's schema — call `get_data_source` first to learn the property names and types.

Required field:

- `properties` — a Notion property-value object, e.g. `{ "Name": { "title": [{ "text": { "content": "..." } }] } }`. For a plain child page (`parent_page_id`), only a `title` property is valid. For a database row (`parent_database_id`), keys must match the target data source's schema.

Optional: `icon_emoji` — a single emoji to use as the page icon.

**Before creating**: confirm the parent location and title with the user. Creating a page in the wrong parent can clutter the workspace, and there is no way to move it afterward (see "What this connector can't do" below) — only to archive/delete and recreate it.

After a successful create, echo: "Page '[title]' created under [parent name]."

## Structuring page content

`create_page` does not take a `children` block for body content in this connector — it creates the page with its properties only. To add body content, call `get_page_content` to see the page's current blocks (useful for existing pages you're editing), and note the block types Notion supports: `paragraph`, `heading_1`/`heading_2`/`heading_3`, `bulleted_list_item`, `numbered_list_item`, `to_do`, `toggle`, `code`, `quote`, `divider`, `callout`, `table`. Rich text within blocks uses a `rich_text` array — each element has a `type` of `text`, `mention`, or `equation`, plus optional `annotations` (bold, italic, code, strikethrough, underline, color).

## Updating pages

Call `update_page` with the page id and the fields to change:

- `properties` — update any property value (title, status, date, assignee, etc). Only the keys present are modified.
- `archived` — `true` to archive (Notion's trash-equivalent parent state), `false` to restore.

**Confirm before updating** if the change overwrites visible content or archives a page — describe what will change and await affirmation.

## What this connector can't do

The previous Notion plugin (backed by Notion's own hosted MCP server) could duplicate a page. This connector's server has no duplicate tool — Notion's plain REST API doesn't expose one. To copy a page's content, `get_page_content` the source and `create_page` a new one with the same body reproduced manually, or tell the user to duplicate it from the Notion UI.

## Error handling

- Verify the parent page/database id before calling `create_page`. A missing or wrong id causes a `400`.
- If the user provides a URL, extract the id as the last hyphen-stripped segment before any query string.
- `403 Forbidden` — the integration lacks write access. Ask the user to share the parent with the integration and grant edit access.

---
name: notion-documentation
description: Create, update, and duplicate Notion pages for documentation purposes. Use when the user asks to write a document, create a wiki page, update an existing page, add content to Notion, or duplicate a page template.
---

# Notion — creating and updating documentation

Use the `notion` MCP server for all page authoring operations.

## Creating pages

Call `notion-create-pages` to create one or more pages. Required fields:

- `parent` — specify either `{ "type": "page_id", "page_id": "<id>" }` (place under an existing page) or `{ "type": "database_id", "database_id": "<id>" }` (create a row in a database). The `type` field is required. Always resolve the parent ID via `notion-search` before calling.
- `properties` — at minimum include `title` as a `title`-type property array.
- `children` — optional array of block objects for the page body.

**Before creating**: confirm the parent location and title with the user. Creating a page in the wrong parent can clutter the workspace.

After a successful create, echo: "Page '[title]' created under [parent name]. Here is the link: [url]."

## Structuring page content

Notion blocks are the building blocks of page content. Common block types for documentation:

| Block type | When to use |
|------------|-------------|
| `paragraph` | Body text |
| `heading_1`, `heading_2`, `heading_3` | Section headings |
| `bulleted_list_item` | Unordered lists |
| `numbered_list_item` | Ordered steps or lists |
| `to_do` | Checklists / tasks inline on a page |
| `toggle` | Collapsible sections |
| `code` | Code blocks with language syntax |
| `quote` | Pull quotes or callout text |
| `divider` | Section breaks |
| `callout` | Highlighted notes or warnings |
| `table` | Structured data inline |

Rich text within blocks uses the `rich_text` array — each element is an object with a `type` of `text`, `mention`, or `equation`, plus optional `annotations` for bold, italic, code, strikethrough, underline, and colour.

## Updating pages

Call `notion-update-page` with the page ID and the fields to change:

- `properties` — update any property (title, status, date, assignee, etc.).
- `icon` — set an emoji or external URL icon.
- `cover` — set a cover image URL.
- To update body content (blocks), first fetch the page to understand its current structure, then update specific blocks or append new ones.

**Confirm before updating** if the change overwrites visible content — describe what will change and await affirmation.

## Duplicating pages

Call `notion-duplicate-page` with the source page ID. The official MCP tool does not expose a destination parent parameter — the duplicate is created in the same parent location as the original. Duplication is asynchronous — notify the user that it may take a few seconds for the copy to appear.

Duplication is useful for:
- Applying a template page to a new project.
- Cloning a recurring report structure.
- Creating a draft copy of a published page before making changes.

## Error handling

- Verify the parent page/database ID before calling create. A missing or wrong ID causes a `400` error.
- If the user provides a URL, extract the ID as the last hyphen-separated segment before any query string.
- `403 Forbidden` — the integration lacks write access. Ask the user to share the parent with the integration and grant "Can edit" access.

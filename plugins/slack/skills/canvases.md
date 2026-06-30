---
name: slack-canvases
description: Create, update, and read Slack canvases via the Slack MCP server. Use when the user wants to create a shared doc in Slack, update an existing canvas, or read/export canvas content.
---

# Slack — canvases

Use the `slack` MCP server for all canvas operations.

## Reading a canvas

Call `read_canvas` with the canvas ID. The tool returns the canvas content as markdown. Present the content to the user with a heading for each section.

If the user does not know the canvas ID, use `search_messages` with a keyword from the canvas title in the channel where it was shared to find the linked message, then extract the canvas ID from the message.

## Creating a canvas

Call `create_canvas` with:
- `channel_id` — the channel to associate the canvas with (resolve via `search_channels`)
- `title` — canvas title
- `document_content` — the initial content in Slack's canvas markdown format

Before calling:
1. Draft the canvas content and present the full draft to the user.
2. Confirm the destination channel and title.
3. Wait for explicit approval before creating.

Slack canvas markdown supports standard markdown: headings (`#`, `##`), bullet lists, numbered lists, bold, italic, code blocks, and links. It does not support raw HTML.

## Updating a canvas

Call `update_canvas` with the canvas ID and the updated `document_content`.

Before calling:
1. Read the current content with `read_canvas`.
2. Show the user a summary of what will change.
3. Confirm before proceeding — canvas updates overwrite the existing content.

## Working style

- Canvases are persistent shared documents — treat updates as consequential. Always confirm before writing.
- When creating, default to a clean structure: a title heading, a short intro paragraph, and clearly labelled sections.
- When exporting (the user says "give me the canvas as markdown"), call `read_canvas` and return the raw markdown content.

## Error handling

- `401 Unauthorized` — OAuth token expired. Ask the user to reconnect.
- `403 Forbidden` — missing `canvases:read` or `canvases:write` scope. Check README scope list.
- `404 Not Found` — canvas ID does not exist, has been deleted, or the user's app cannot access it. For `create_canvas`, a 404 can also mean the `channel_id` is stale — re-resolve it with `search_channels`.
- `429 Too Many Requests` — rate limit; wait ~10 seconds, retry once.

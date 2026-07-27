---
name: slack-search
description: Search Slack messages, files, users, channels, and emoji via the Slack MCP server. Use when the user wants to find information in Slack by keyword, sender, date, channel, or file type.
---

# Slack — searching messages, files, users, and channels

Use the `slack` MCP server for all Slack search operations.

## Searching messages

Call `search_messages` with a `query` string. Slack's search syntax supports modifiers:

- `in:#channel-name` — limit to a specific channel
- `from:@username` — messages by a specific user
- `before:2025-12-31` / `after:2025-01-01` — date range
- `has:link` / `has:reaction` — filter by content type
- `-keyword` — exclude a term

Combine modifiers: `budget in:#finance after:2025-05-01`. Present results as a numbered list with sender, channel, date, and a message snippet. Show at most 10 results; offer to load more.

## Searching files

Call `search_files` with a `query` and an optional `file_type` filter (e.g. `pdf`, `doc`, `image`). Present file name, uploader, channel shared in, and upload date.

## Reading file content

Call `read_files` with the file ID returned by `search_files` to retrieve the actual file content. Use this when the user wants to read, summarise, or quote from a specific document — not just see it was shared. Note: `read_files` has special rate limits; space out calls when processing multiple files.

## Searching users

Call `search_users` with a name, email address, or partial username. Return a short list with display name, real name, email, and title. Use this to resolve a human-readable name to a user ID before calling other tools.

## Searching channels

Call `search_channels` with a channel name or keyword. Returns channel name, ID, member count, and topic. Use this to resolve a channel name to an ID before reading history or sending messages.

## Listing custom emoji

Call `list_emoji` to retrieve all custom emoji in the workspace. Returns emoji name and image URL. Useful when the user asks "what emoji do we have for X?" or wants to add a reaction but is not sure of the name.

## Presenting results

- Always summarise results — never dump raw JSON.
- For messages: show sender name, channel, relative time, and a one-sentence snippet.
- For files: show file name, type, uploader, and upload date.
- For users: show display name, real name, and title.
- For channels: show name, member count, and topic.
- When zero results are returned, say so clearly and suggest broadening the query.

## Error handling

- `401 Unauthorized` — OAuth token expired or scope missing. Ask the user to reconnect.
- `403 Forbidden` — the `search:read.*` scope is missing for the requested context, or `files:read` is missing when calling `read_files`. Check the README.
- `404 Not Found` — the file or resource no longer exists, has been deleted, or the app cannot access it.
- `429 Too Many Requests` — rate limit hit. Wait ~10 seconds and retry once; surface the error if it persists.

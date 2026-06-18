---
name: google-workspace-chat
description: List Google Chat spaces, read messages, and send messages via the Google Workspace MCP server. Use when the user asks to check Chat messages, see what's in a room, or send a message to a Chat space or person.
---

# Google Chat — spaces and messaging

Use the `google-workspace-chat` MCP server for all Chat operations.

## Listing spaces

Call `list_spaces` to retrieve all Chat spaces the user is a member of. Each space has:

- `name` — resource name (e.g. `spaces/AAAA1234`)
- `displayName` — human-readable room or DM name
- `type` — `ROOM` (named space), `DM` (direct message), or `GROUP_CHAT`

Present spaces as a list with display name and type. Use the `name` field as the identifier in all subsequent calls.

## Listing space members

Call `list_members` with a `parent` (the space `name`). Returns each member's `member.name`, `member.displayName`, and `member.type` (`HUMAN` or `BOT`). Useful for confirming who is in a room before sending.

## Reading messages

Call `list_messages` with:

- `parent` — the space `name`
- `pageSize` — number of messages (default 25)
- `orderBy` — `createTime desc` to get newest first
- `filter` — e.g. `createTime > "2025-06-01T00:00:00Z"` or `thread.name = "spaces/…/threads/…"` for a specific thread

Present messages as: sender display name, relative time, and message text. Strip annotation markup if present. Truncate very long messages to the first 200 characters and offer to expand on request.

## Sending messages

Use `create_message` with:

- `parent` — the space `name`
- `text` — plain text content

To reply in a thread, also supply `thread.name` from an existing message.

**Sending a message is visible to all space members.** Confirm the space and message content with the user before calling.

After success, echo: "Message sent to [space display name]."

## Updating a message

Call `update_message` with the message `name` and the new `text`. Only the original sender can update their own messages.

## Deleting a message

Call `delete_message` with the message `name`. Only the original sender or a space manager can delete messages.

**Deletion is permanent.** Confirm before calling.

## Error handling

- `401` — token expired or missing the `chat.messages` scope.
- `403` — insufficient permissions; the token lacks `https://www.googleapis.com/auth/chat.messages` or the user is not a member of the space.
- `404` — space or message not found; confirm the resource name.
- `429` — rate limit; back off and retry once.

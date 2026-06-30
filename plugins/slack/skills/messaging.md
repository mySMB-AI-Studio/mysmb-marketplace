---
name: slack-messaging
description: Send messages, read channel history, read threads, create conversations, and add reactions in Slack via the Slack MCP server. Use when the user wants to communicate in Slack or read what has been posted.
---

# Slack — messaging

Use the `slack` MCP server for all messaging operations.

## Reading channel history

Call `read_channel_history` with a channel ID and optional `limit` (default 20, max 200) and `oldest`/`latest` Unix timestamps to scope the time window.

- Always resolve the channel name to its ID first using `search_channels`.
- Present messages as a timeline: timestamp, sender name, message text.
- For threads, show the parent message and indicate how many replies it has.
- Offer to read a specific thread in full with `read_thread`.

## Reading a thread

Call `read_thread` with the channel ID and the parent message's timestamp (`ts` field). Present all replies in chronological order with sender and timestamp. This is useful for following up on a decision or summarising a discussion.

## Sending a message

Call `send_message` with a `channel` ID (resolved via `search_channels` or `search_users` for DMs) and `text`.

**Before calling**: draft the message and show the user:
- **To:** `#channel-name` or `@username`
- **Message:** [body text]

Wait for explicit confirmation. Only call `send_message` after the user approves.

After a successful send, echo: "Message sent to [destination]."

Slack message formatting (mrkdwn):
- `*bold*` — bold text
- `_italic_` — italic text
- `~strikethrough~` — strikethrough
- `<URL|link text>` — hyperlink
- `` `code` `` — inline code
- ` ```code block``` ` — code block
- `> quoted text` — blockquote
- `• item` — bullet list (use the bullet character, not hyphens)

## Creating a conversation

Call `create_conversation` to create a new channel or open a DM. Confirm the channel name (for channels), members (for DMs), and whether it should be private, before calling.

For public channels: confirm name and purpose with the user.
For private channels: confirm name, purpose, and initial members.
For DMs: confirm the user ID(s) resolved via `search_users`.

## Adding reactions

Call `add_reaction` with the channel ID, message timestamp (`ts`), and the emoji name (without colons, e.g. `thumbsup`, `white_check_mark`).

Use `list_emoji` to show available custom emoji if the user is not sure of the name. Confirm the reaction if it could be misinterpreted in context.

## Error handling

- `401 Unauthorized` — OAuth token expired. Ask the user to reconnect.
- `403 Forbidden` — missing scope (e.g. `chat:write` for sending, `channels:history` for reading). Check README scope list.
- `404 Not Found` — channel or message does not exist, or the app cannot see it.
- `429 Too Many Requests` — rate limit; wait ~10 seconds, retry once.
- `channel_not_found` error in response — the channel ID is wrong or the app is not a member of that channel. Use `search_channels` to re-resolve the ID.

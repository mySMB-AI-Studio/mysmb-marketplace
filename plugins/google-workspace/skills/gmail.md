---
name: google-workspace-gmail
description: Read and search Gmail emails via the Google Workspace MCP server. Use when the user asks to check their inbox, find an email, or read a message. Send, reply, forward, label, and trash are not available (read-only scope).
---

# Gmail — reading and searching email

Use the `google-workspace-gmail` MCP server for all Gmail operations.

## Reading the inbox

Call `list_messages` with `labelIds: ["INBOX"]` to retrieve recent messages. Default page size is typically 10–20; increase with a `maxResults` parameter if the user asks for more. Messages returned by list are stubs — fetch the full body with `get_message` using the `id` field.

Always present emails as a concise summary: sender name, subject, date, and a one-sentence snippet. Never dump the full raw body unless the user explicitly asks.

## Searching

Use `search_messages` with a `q` parameter that accepts Gmail's search syntax:

- `from:alice@example.com` — filter by sender
- `subject:invoice` — filter by subject keyword
- `has:attachment` — only messages with attachments
- `after:2025/01/01 before:2025/02/01` — date range
- `is:unread` — unread only
- `label:important` — by label

Combine terms with spaces (implicit AND) or `OR`. Present results as a numbered list with sender, subject, and date.

## Getting a full message

Call `get_message` with the message `id`. Parse the `payload.parts` tree to extract `text/plain` or `text/html` body parts. Surface the plain-text body; render HTML only if plain-text is absent.

## Labels

Call `list_labels` to return all user-created and system labels with their `id` and `name`. Labels are read-only — modifying or applying labels is not available with this scope.

## What is not available

Gmail is connected with `gmail.readonly` scope. The following operations are not available:

- Sending, replying to, or forwarding emails
- Trashing or archiving messages
- Applying or removing labels
- Any modification to mailbox state

If the user asks to send or manage email, explain that the Gmail connection is read-only and they would need to reconnect with a broader scope.

## Error handling

- `401 Unauthorized` — the `GOOGLE_ACCESS_TOKEN` is expired or lacks the `gmail.readonly` scope. Ask the user to reconnect.
- `403 Forbidden` — insufficient scope; the token does not include `https://www.googleapis.com/auth/gmail.readonly`.
- `404 Not Found` — the message ID no longer exists.
- Rate limits: back off and retry once; if it fails again, surface the error.

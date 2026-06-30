---
name: google-workspace-gmail
description: Read, search, send, and manage Gmail emails via the Google Workspace MCP server. Use when the user asks to check their inbox, find an email, send a message, reply, forward, label, or trash a message.
---

# Gmail — reading, searching, and sending email

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

## Sending email

Use `send_message`. Required fields: `to` (array of addresses), `subject`, `body`. Optional: `cc`, `bcc`, `replyTo`.

**Before calling**: confirm the recipient(s), subject, and body text with the user. Never send without explicit confirmation.

After a successful send, echo: "Email sent to [recipients] — subject: [subject]."

## Replying and forwarding

Use `reply_to_message` with the original message `id` plus the reply body. The server preserves threading headers automatically.

Use `forward_message` with the original message `id` plus new `to` recipients and an optional forwarding note.

**Both operations send real email** — confirm before calling.

## Labels

- `list_labels` — returns all user-created and system labels with their `id` and `name`.
- `modify_message_labels` — accepts `addLabelIds` and `removeLabelIds` arrays.

Common system label IDs: `INBOX`, `SENT`, `TRASH`, `SPAM`, `STARRED`, `IMPORTANT`, `UNREAD`.

## Trashing messages

Call `trash_message` with the message `id`. The message moves to Trash and can be recovered within 30 days. Confirm before calling; do not use for bulk operations without explicit permission.

## Error handling

- `401 Unauthorized` — the `GOOGLE_ACCESS_TOKEN` is expired or lacks the `gmail.modify` scope. Ask the user to reconnect.
- `403 Forbidden` — insufficient scope; the token does not include `https://www.googleapis.com/auth/gmail.modify`.
- `404 Not Found` — the message ID no longer exists (likely already trashed or expunged).
- Rate limits: back off and retry once; if it fails again, surface the error.

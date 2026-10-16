---
name: google-workspace-gmail
description: Read and search Gmail emails via the Google Workspace MCP server. Use when the user asks to check their inbox, find an email, read a message, or see their bills. Send, reply, forward, label, and trash are not available (read-only scope).
---

# Gmail — reading and searching email

Use the `google-workspace-gmail` MCP server for all Gmail operations. It is connected with the `gmail.readonly` scope.

## Reading the inbox

Call `list_messages` with `labelIds: ["INBOX"]` (add `"UNREAD"` for unread only) and `maxResults` up to 50. Each result already carries sender, subject, snippet, timestamp, `threadId` and read/starred/attachment flags, so a summary rarely needs more calls.

Present emails as a concise summary: sender name, subject, date, and a one-sentence snippet.

## Searching

Pass Gmail search syntax to `list_messages` as `q`:

- `from:alice@example.com` — filter by sender
- `subject:invoice` — filter by subject keyword
- `has:attachment` — only messages with attachments
- `after:2026/01/01 before:2026/02/01` — date range
- `is:unread` — unread only
- `label:important` — by label

Combine terms with spaces (implicit AND) or `OR`.

## Getting a full message

Call `get_message` with the message `id`. It returns sender, subject, Date header, snippet, labels and an `attachments` list (`attachmentId`, `filename`, `mimeType`, `size`).

## Attachments

Call `get_attachment` with `messageId` and an `attachmentId` from `get_message`. It returns the file as base64 (15 MB limit). Describe the file rather than dumping base64 to the user.

## Bills

Call `list_bill_label_emails` for bills filed under a Gmail label (default "AP Bills"). It reads each PDF and returns supplier, invoice number, dates, GST and total. A label literally named "Bills" cannot be used — Gmail reserves it.

## Labels

Call `list_labels` for the mailbox's system and user labels. Applying or removing labels is not available.

## What is not available

- Sending, replying to, or forwarding emails
- Trashing or archiving messages
- Applying or removing labels
- Any change to mailbox state

For a reply, the morning briefing's "Draft a reply" opens Gmail's own compose window pre-filled; the user reviews and sends it in Gmail.

## Error handling

- `401 Unauthorized` — the connection needs re-authorising; ask the user to reconnect Gmail in Settings → Extensions → Connections.
- `403 Forbidden` — the connection lacks `https://www.googleapis.com/auth/gmail.readonly`; reconnect.
- `404 Not Found` — the message no longer exists.
- Rate limits: back off and retry once; if it fails again, surface the error.

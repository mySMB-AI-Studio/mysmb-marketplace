---
name: docusign-track-envelope
description: Check the status of DocuSign envelopes and recipients. Use when the user asks "has X signed?", "what's the status of the contract?", "who still needs to sign?", "send a reminder", "show me pending envelopes", or wants to track signing progress.
---

# Track a DocuSign envelope

Use the `docusign` MCP server to check envelope status, inspect recipients, and send reminders.

## Steps

### Check a specific envelope

1. If the user gives an envelope ID, call `getEnvelope` directly.
2. If no ID is given, call `getEnvelopes` with appropriate filters:
   - `status: "sent"` for pending envelopes
   - `status: "completed"` for signed/finished
   - `from_date` / `to_date` for a date range
   Filter by subject or recipient name to narrow results.

### Inspect recipients

Call `listRecipients` with the `envelopeId` to see each recipient's:
- `status` — `"sent"`, `"delivered"`, `"signed"`, `"declined"`, `"completed"`
- `email` and `name`
- `signedDateTime` (if signed)

### Send a reminder

Call `sendReminder` only if:
- The envelope status is `"sent"` (in-flight)
- The user explicitly asks to remind recipients
- Report which recipients were notified

### Modify recipients

If the user needs to correct an email address or add a new signer, call `updateEnvelopeRecipients`. Note this notifies affected recipients — confirm first.

## Rules

- Always show envelope subject, status, and creation date in your summary.
- Tally: "X of Y recipients have signed" before listing individuals.
- Do not call `sendReminder` automatically — only when the user requests it.
- If an envelope is in `"completed"` or `"voided"` status, remind is not applicable.
- If any tool returns a 4xx/5xx error, surface the error message verbatim — do not retry silently.

---
name: docusign-send-envelope
description: Send a document for signature using DocuSign. Use when the user says "send for signing", "get this signed", "create an envelope", "send a contract", "request signature on", or asks to dispatch a document to recipients via DocuSign.
---

# Send a DocuSign envelope

Use the `docusign` MCP server to create and send an envelope for signature.

## Decision: template or ad-hoc?

- **Template-based**: the user references a named template. Ask them to provide the `templateId` (found in DocuSign Admin → Templates) or look it up from a previous envelope if known.
- **Ad-hoc**: the user provides a document file or URL. Use `documents` with `remoteUrl` and supply `recipients` directly.

## Steps

1. **Confirm recipients**
   You need at minimum: `name` and `email` for each signer. If missing, ask before proceeding.

2. **Create the envelope**
   Call `createEnvelope` with:
   - `status: "sent"` to dispatch immediately (sends real emails — confirm with the user first)
   - `status: "created"` to save as a draft for review
   - `templateId` if using a template, or `documents` + `recipients` for ad-hoc
   - Max document size: 25 MB per file

3. **Confirm success**
   Report the returned `envelopeId` and `status`. Remind the user that recipients will receive email notifications.

## Rules

- Never set `status: "sent"` without explicit user confirmation — it dispatches real emails.
- Never invent recipient names or emails. Ask if not provided.
- If `createEnvelope` returns a 4xx error, surface the error message verbatim — do not retry silently.
- Do not upload document content unless the user has explicitly provided the file or URL.
- Never auto-select a template — always confirm the `templateId` with the user first.

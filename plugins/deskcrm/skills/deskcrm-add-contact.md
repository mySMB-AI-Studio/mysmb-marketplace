---
name: deskcrm-add-contact
description: Add a new person to the deskcrm Contacts sheet. Use when the user says "add X to the CRM", "new contact", "log a lead from Y", or similar.
---

# Add a contact

Use the `create_contact` tool to write a new row to the Contacts sheet. The tool assigns the `id`, `createdAt`, and `updatedAt` — do not try to supply them.

## Required fields

- `firstName`
- `lastName`

Everything else is optional. If the user has not given you an email, phone, or company, **do not invent one** — leave it unset.

## How to use

1. Extract what you have from the user's request. Map natural-language phrases to fields:
   - "CEO of Acme" → `title: "CEO"`, `company: "Acme"`
   - "met at a conference" → `tags: "event"` or add to `notes`
   - "looks like a good lead" → `status: "lead"`
2. If you are missing the required fields, ask a single clarifying question — do not guess.
3. Call `create_contact` once. If it errors, do not retry blindly; surface the error.
4. After success, echo back the new row's id and the key fields so the user can confirm.

## Status values

`active` (default), `lead`, `churned`, `archived`. When the user adds someone they just met with no prior relationship, `lead` is usually right.

## Duplicate check

Before creating, call `list_contacts` with `query: "<email or last name>"` and briefly check for an existing row. If you find a likely duplicate, show it and ask whether to update the existing row instead.

---
name: deskcrm-update-contact
description: Update fields on an existing deskcrm contact. Use when the user says "change X's title", "mark Y as churned", "add a note to Z", or similar.
---

# Update a contact

Use the `update_contact` tool to patch an existing row in the Contacts sheet.

## Inputs

- `id` — required, the contact id (`cnt_...`)
- `patch` — an object with the fields to change

The server only applies whitelisted fields. `id` and `createdAt` are immutable and silently dropped; `updatedAt` is refreshed automatically.

## How to use

1. **Resolve the id first.** If the user refers to a contact by name, call `list_contacts` with a `query` filter and pick the match. If there is more than one match, ask the user to disambiguate — never guess.
2. Build a minimal `patch`. Only include the fields that actually change. For example, to mark someone as churned: `patch: { status: "churned", notes: "<reason>" }`.
3. For notes, fetch the current row first if you need to append rather than overwrite. The server replaces the field verbatim.
4. Call `update_contact` once. Confirm the change back to the user by citing the fields you changed.

## Common patches

- Status change: `patch: { status: "churned" }`
- Title change: `patch: { title: "VP Operations" }`
- Append a tag: `get_contact` first, then `patch: { tags: "<existing>,<new>" }`

## What not to do

- Do not call `delete_contact` followed by `create_contact` as a substitute for an update — it loses the original id and timestamps.
- Do not send fields you do not intend to change, even if they are already known.

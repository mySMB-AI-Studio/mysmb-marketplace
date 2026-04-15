---
name: deskcrm-find-contact
description: Find contacts in the deskcrm workbook by status, company, or free-text. Use when the user asks "who is X", "do we have a contact at Y", or wants to see a list of active/lead/churned contacts.
---

# Find a contact

Use the `list_contacts` tool to search the Contacts sheet. The tool filters rows server-side; do not load everything and filter yourself.

## Inputs

- `status` — exact match (`active`, `lead`, `churned`, `archived`)
- `company` — case-insensitive substring on the company name
- `query` — free-text substring across firstName, lastName, email, company, title, notes, tags
- `limit` — default 100; lower when the user only needs a handful

## How to use

1. Decide which filter fits the request. Prefer the most specific one.
   - "who at Northwind?" → `company: "Northwind"`
   - "show me the leads" → `status: "lead"`
   - "find Amelia" → `query: "Amelia"`
2. Call `list_contacts` with just those fields. Leave the rest unset.
3. The tool returns `{ count, contacts }`. If `count` is 0, say so plainly and suggest the user broaden the filter — do not invent rows.
4. When the user wants details on a specific row, call `get_contact` with the `id` from the list result. Never reuse an id from earlier in the conversation without re-fetching if there has been a write since.

## Rendering

- For more than one row, summarise as a compact table: name, company, title, status, email.
- For a single row, show every non-empty field.
- Contact ids (`cnt_...`) are internal — mention them only when the next step needs one (update, delete).

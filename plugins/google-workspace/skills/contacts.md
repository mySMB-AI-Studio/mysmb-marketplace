---
name: google-workspace-contacts
description: Search and read contact profiles via the Google People API MCP server. Use when the user asks to look up a person's email address, phone number, job title, or other contact details from their Google Contacts.
---

# People API — searching and reading contacts

Use the `google-workspace-people` MCP server for all Contacts operations. This plugin uses the read-only `contacts.readonly` scope — it cannot create, update, or delete contacts.

## Searching contacts

Call `search_people` with a `query` string. The People API matches against the contact's name, email address, phone number, and organization. Returns a list of people matching the query.

Present results as: display name, primary email, primary phone, and organization/title. If multiple contacts match, list all and ask the user which one they meant.

## Getting a contact's full profile

Call `get_person` with the `resourceName` (e.g. `people/c1234567890`). Specify `personFields` to control which fields are returned:

Common `personFields` values:

- `names` — display name, given name, family name
- `emailAddresses` — all email addresses with type (work, home, etc.)
- `phoneNumbers` — all phone numbers with type
- `organizations` — employer, title, department
- `addresses` — postal addresses
- `biographies` — notes
- `photos` — profile photo URL

Example: `personFields: "names,emailAddresses,phoneNumbers,organizations"`

## Listing all contacts

Call `list_people` with `resourceName: "people/me"` and `personFields` as above. Use `pageSize` (max 1000) and `pageToken` for pagination. Useful when the user wants to see or export their full contact list.

## Getting the user's own profile

Call `get_person` with `resourceName: "people/me"` and the desired `personFields`. Returns the authenticated user's own profile — name, email, phone, organization, profile photo URL.

## Working style

- Always resolve a contact by name search before presenting their details. If a name is ambiguous, show the top candidates and ask which one the user means.
- Present contact details in a clean, readable format — not raw JSON.
- If a contact has multiple emails or phones, surface all of them and note the type (work, personal, etc.).
- This is a read-only server. If the user asks to add, edit, or delete a contact, explain that this plugin only supports reading contacts and direct them to Google Contacts at contacts.google.com.

## Error handling

- `401` — token expired or missing the `contacts.readonly` scope.
- `403` — insufficient permissions; the token lacks `https://www.googleapis.com/auth/contacts.readonly`.
- `404` — the contact resource name is invalid or the contact was deleted.

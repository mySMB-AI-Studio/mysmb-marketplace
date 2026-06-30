---
name: square-manage-customers
description: Search, create, and update Square customers. Use when the user asks about customer records, wants to add a new customer, or needs to update contact details.
---

# Manage Square customers

All Square operations use the `make_api_request` tool:
`make_api_request({ service: "<service>", method: "<method>", request?: { ...params } })`

## Find a customer

1. Use `make_api_request({ service: "customers", method: "search", request: { query: { filter: { email_address: { exact: "..." } } } } })` for exact email lookups.
2. Use `make_api_request({ service: "customers", method: "list", request: { limit: 10 } })` and browse if the user only knows a name fragment.
3. Use `make_api_request({ service: "customers", method: "get", request: { customer_id: "..." } })` for full details by known ID.

## Create a customer

Call `make_api_request({ service: "customers", method: "create", request: { given_name, family_name, email_address?, phone_number?, reference_id? } })`. `given_name` and `family_name` are the most useful fields. A `reference_id` can link to an external system.

## Update a customer

Call `make_api_request({ service: "customers", method: "update", request: { customer_id, ...changedFieldsOnly } })`. Send only the fields that are changing — Square performs a partial update.

## Customer groups

- `make_api_request({ service: "customers", method: "addGroupTo", request: { customer_id, group_id } })` — add to group.
- `make_api_request({ service: "customers", method: "removeGroupFrom", request: { customer_id, group_id } })` — remove from group.
- Use `get_service_info({ service: "customerGroups" })` to discover group listing and management methods.

## Delete a customer

Call `make_api_request({ service: "customers", method: "delete", request: { customer_id } })`. This is permanent and cannot be undone — Square does not restore deleted customer records.

Before calling:
1. Retrieve the customer with `make_api_request({ service: "customers", method: "get", request: { customer_id } })` and display their name and email to the user.
2. Ask for explicit confirmation: "This will permanently delete [Name] ([email]). Proceed?"
3. Only call `delete` after the user confirms.

## Rendering

- For lists: show name, email, phone, creation date.
- For single records: show all non-null fields.
- Never expose the internal `id` unless the user explicitly asks.

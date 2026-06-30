---
name: hubspot-manage-records
description: Create or update HubSpot CRM records and activities using manage_crm_objects. Use when the user asks to add a contact, update a deal stage, log a call, create a task, or modify any CRM record. Always discover property names before writing.
---

# Create and update HubSpot CRM records

## Before you write: discover properties

Never guess property internal names. HubSpot uses internal names (e.g., `hs_lead_status`, not `Lead Status`).

1. Call `search_properties` with `objectType` and up to 5 keywords describing the field you need.
2. If you need the full definition — especially enum values — call `get_properties` with the specific property names.
3. For enum properties, use only the `value` strings from the `options` array. Do not invent enum values.

## Before you write: search first

Always call `search_crm_objects` before creating a new record to check for duplicates. For contacts, search by `email`. For companies, search by `domain` or `name`. For deals, search by `dealname` within the same pipeline.

If a match exists, update it — do not create a duplicate.

## manage_crm_objects parameters

```
objectType    string    Required. The CRM object type (see supported types below).
action        string    Required. "create" or "update".
id            string    Required for "update". The HubSpot record ID.
properties    object    Key-value map of property internal name → value.
associations  array     Objects to associate the record with (see Activities below).
```

## Supported object types for write

**Standard CRM:** `contacts`, `companies`, `deals`, `tickets`, `line_items`, `products`

**Activities:** `calls`, `emails`, `meetings`, `notes`, `tasks`

> Activity objects are blocked on accounts with **Sensitive Data** enabled.

## Creating a contact

```json
{
  "objectType": "contacts",
  "action": "create",
  "properties": {
    "firstname": "Jane",
    "lastname": "Smith",
    "email": "jane.smith@example.com",
    "company": "Acme Corp",
    "jobtitle": "CFO",
    "lifecyclestage": "lead"
  }
}
```

## Updating a deal stage

```json
{
  "objectType": "deals",
  "action": "update",
  "id": "12345678",
  "properties": {
    "dealstage": "closedwon",
    "closedate": "<YYYY-MM-DD>"
  }
}
```

## Assigning an owner

Resolve the owner first with `search_owners`, then use the returned `ownerId`:

```json
{
  "objectType": "deals",
  "action": "update",
  "id": "12345678",
  "properties": {
    "hubspot_owner_id": "55443322"
  }
}
```

## Logging an activity (call, note, task, email, meeting)

Set `objectType` to the activity type and provide `associations` to link it to a CRM record:

```json
{
  "objectType": "notes",
  "action": "create",
  "properties": {
    "hs_note_body": "Spoke with Jane re Q3 renewal. She confirmed budget approved.",
    "hs_timestamp": "<ISO-8601 datetime>"
  },
  "associations": [
    { "toObjectType": "contacts", "toObjectId": "987654321" }
  ]
}
```

For tasks, key properties: `hs_task_subject`, `hs_task_body`, `hs_task_status` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), `hs_timestamp` (due date).

For calls, key properties: `hs_call_title`, `hs_call_body`, `hs_call_duration`, `hs_call_direction` (`INBOUND` / `OUTBOUND`), `hs_call_disposition` (outcome enum — discover values with `get_properties`).

## Idempotency rule

If the resulting record state would be identical to the current state, skip the write and say so. Do not call `manage_crm_objects` just to confirm a value that is already set.

## Confirm before mutating

For any update that changes a stage, amount, close date, or owner, confirm the intended change with the user before calling the tool. State the current value and the proposed new value.

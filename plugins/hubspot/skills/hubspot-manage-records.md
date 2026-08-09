---
name: hubspot-manage-records
description: Create or update HubSpot contacts, companies, deals, tickets, or custom-object records using the per-object create_/update_ tools, and link records with the Associations tools. Use when the user asks to add a record, update a field, change a deal/ticket stage, or associate two records. Always discover property names before writing.
---

# Create, update, and link HubSpot records

## Tool per object type

| Object type | Create | Update |
|---|---|---|
| Contact | `create_contact` | `update_contact` |
| Company | `create_company` | `update_company` |
| Deal | `create_deal` | `update_deal` |
| Ticket | `create_ticket` | `update_ticket` |
| Custom object (e.g. Members) | `create_custom_object` | `update_custom_object` |

There are no `delete_*` tools for any object type — deletion is not supported via this connector; direct the user to the HubSpot UI.

## Before you write: discover properties

Never guess property internal names. HubSpot uses internal names (e.g. `hs_ticket_priority`, not "Priority").

Call `list_properties` with the object type (or `objectTypeId` for a custom object). It returns internal `name`, display `label`, `type`, `fieldType`, and enum `options` where applicable. For enum properties, use only the `value` strings from `options` — never invent enum values.

## Before you write: search first

Always call the object's `search_*` tool before creating a new record, to check for duplicates:
- Contacts — search by `email`.
- Companies — search by `domain` or `name`.
- Deals — search by `dealname` within the same `pipeline`.
- Custom objects — search by whatever the portal uses as a natural key (check `list_properties`).

If a match exists, update it — do not create a duplicate.

## Common parameters

```
properties    object    Required. Map of internal property name → value.
id            string    Required for update_*. The HubSpot record ID.
objectTypeId  string    Required for create_custom_object / update_custom_object only.
```

## Creating a contact

```json
{
  "properties": {
    "firstname": "Jane",
    "lastname": "Smith",
    "email": "jane.smith@example.com",
    "company": "Acme Corp",
    "lifecyclestage": "lead"
  }
}
```
Call via `create_contact`. At minimum supply `email` and/or `firstname`/`lastname`.

## Creating a deal

`create_deal` requires `dealname`. `pipeline` and `dealstage` must be the **internal IDs** from `list_pipelines` — not the display labels shown in the HubSpot UI. Call `list_pipelines` (with `objectType: "deals"`) first if you don't already have them cached for this conversation.

```json
{
  "properties": {
    "dealname": "Nexus Collective — Annual Renewal",
    "pipeline": "default",
    "dealstage": "appointmentscheduled",
    "amount": "5000"
  }
}
```

## Updating a deal stage

```json
{
  "id": "12345678",
  "properties": {
    "dealstage": "closedwon",
    "closedate": "<YYYY-MM-DD>"
  }
}
```
Call via `update_deal`.

## Creating a ticket

`create_ticket` requires `subject` and `hs_pipeline_stage` (internal numeric stage ID from `list_pipelines` with `objectType: "tickets"`). `hs_pipeline` defaults to the account's default pipeline if omitted. `hs_ticket_priority` is typically `LOW`/`MEDIUM`/`HIGH` — confirm via `list_properties` if unsure.

```json
{
  "properties": {
    "subject": "Member unable to renew online",
    "hs_pipeline_stage": "1",
    "hs_ticket_priority": "HIGH"
  }
}
```

## Creating a custom-object record (e.g. a Member)

Get the `objectTypeId` from `list_object_schemas` first, and the valid property names from `list_properties` (passing that same `objectTypeId`).

```json
{
  "objectTypeId": "2-12345",
  "properties": {
    "email": "jane.smith@example.com",
    "membership_status": "active",
    "renewal_date": "2027-01-01"
  }
}
```
Call via `create_custom_object`. Requires the connected HubSpot portal to be on Enterprise tier on at least one Hub — on lower tiers the schema simply won't exist yet.

## Linking two records (Associations)

To associate a Members record with a Contact (or any two records across object types):

1. Call `list_association_labels` with `fromObjectType`/`toObjectType` to find the valid `associationTypeId` values between those two object types.
2. Call `create_association` with `fromObjectType`, `fromObjectId`, `toObjectType`, `toObjectId`, `associationCategory` (usually `HUBSPOT_DEFINED` unless it's a custom labelled association type, then `USER_DEFINED`), and the `associationTypeId` from step 1.

```json
{
  "fromObjectType": "2-12345",
  "fromObjectId": "9001",
  "toObjectType": "contacts",
  "toObjectId": "5001",
  "associationCategory": "USER_DEFINED",
  "associationTypeId": 4
}
```

To check existing links before creating a new one, call `list_associations` with `fromObjectType`/`toObjectType`/`fromObjectIds` (batch read).

## Idempotency rule

If the resulting record state would be identical to the current state, skip the write and say so. Don't call an `update_*` tool just to confirm a value that's already set.

## Confirm before mutating

For any update that changes a stage, amount, close date, or membership status, confirm the intended change with the user before calling the tool. State the current value and the proposed new value.

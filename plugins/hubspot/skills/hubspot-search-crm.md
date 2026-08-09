---
name: hubspot-search-crm
description: Find and list HubSpot records using the per-object list_/get_/search_ tools (contacts, companies, deals, tickets, custom objects). Use when the user asks to find, list, filter, sort, or page through any HubSpot object type.
---

# Find HubSpot records

## Choosing the right tool

Unlike a single generic search tool, each object type has its own `list_`/`get_`/`search_` tools. Pick the tool by object type first, then decide how to query it:

| Object type | List | Get one | Search |
|---|---|---|---|
| Contacts | `list_contacts` | `get_contact` | `search_contacts` |
| Companies | `list_companies` | `get_company` | `search_companies` |
| Deals | `list_deals` | `get_deal` | `search_deals` |
| Tickets | `list_tickets` | `get_ticket` | `search_tickets` |
| Custom object (e.g. Members) | `list_custom_objects` | `get_custom_object` | `search_custom_objects` |

Custom-object tools all take an extra required `objectTypeId` (numeric ID like `2-12345`, or fully-qualified name like `p12345_members`) — get it from `list_object_schemas` first.

| Situation | Tool |
|---|---|
| You know the record ID | `get_<singular>` |
| No filtering needed, just a page of records | `list_<plural>` |
| You need to filter by property, free-text search, or sort | `search_<plural>` |

## `list_*` parameters

```
limit         integer   1–100. Default 10.
after         string    Pagination cursor from a previous response's next_after. Omit for page 1.
properties    array     Internal property names to return. Omit for a sane per-object default set.
archived      boolean   Include archived (soft-deleted) records. Default false.
```

Returns `{ items, has_more, next_after }`.

## `search_*` parameters

```
filterGroups  array     Filter groups (see below). Omit for an unfiltered search driven only by `query`.
query         string    Free-text search across the object's default searchable properties.
sorts         array     Sort strings, e.g. ["hs_lastmodifieddate DESC"]. Max one sort rule.
properties    array     Internal property names to return.
limit         integer   1–100. Default 10.
after         string    Pagination cursor.
```

Returns `{ items, has_more, next_after, total }`.

**`sorts` is an array of plain strings** (`"propertyName DESC"` / `"propertyName ASC"`), not an array of `{propertyName, direction}` objects.

## Filter group construction

Filters **within** a group are AND-ed. Filter **groups** are OR-ed.

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "EQ", "value": "appointmentscheduled" },
        { "propertyName": "amount", "operator": "GT", "value": "10000" }
      ]
    },
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "EQ", "value": "qualifiedtobuy" }
      ]
    }
  ]
}
```

This matches deals that are (`appointmentscheduled` AND `amount > 10000`) OR (`qualifiedtobuy`).

## Filter operators

| Operator | Meaning | Extra field |
|---|---|---|
| `EQ` / `NEQ` | Equals / not equals | `value` |
| `LT` / `LTE` / `GT` / `GTE` | Less/greater than (or equal) | `value` |
| `BETWEEN` | Inclusive range | `value` (low) + `highValue` |
| `IN` / `NOT_IN` | Value is/isn't one of a set | `values` |
| `CONTAINS_TOKEN` / `NOT_CONTAINS_TOKEN` | String contains/doesn't contain token (case-insensitive) | `value` |
| `HAS_PROPERTY` / `NOT_HAS_PROPERTY` | Property exists and is non-empty / is empty or absent | (none) |

## Property discovery

If unsure of a property's internal name, call `list_properties` with the object type (or `objectTypeId` for a custom object) first — it returns internal `name`, display `label`, `type`, and `fieldType` for every standard + custom property. Don't guess property names.

## Common property names by object type

**Contacts:** `firstname`, `lastname`, `email`, `phone`, `company`, `lifecyclestage`, `createdate`, `lastmodifieddate`

**Companies:** `name`, `domain`, `phone`, `city`, `state`, `industry`, `createdate`

**Deals:** `dealname`, `amount`, `dealstage`, `pipeline`, `closedate`, `createdate`

**Tickets:** `subject`, `content`, `hs_pipeline`, `hs_pipeline_stage`, `hs_ticket_priority`, `createdate`

`dealstage` and `hs_pipeline_stage` are internal numeric IDs, not the display labels shown in HubSpot's UI — resolve them with `list_pipelines` if you need to show or filter by a human-readable stage name.

## Pagination

When the response includes `next_after`, pass that value as `after` in the next call to retrieve the next page. Repeat until `has_more` is `false`.

## Example: find high-value open deals

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "NEQ", "value": "closedwon" },
        { "propertyName": "dealstage", "operator": "NEQ", "value": "closedlost" },
        { "propertyName": "amount", "operator": "GTE", "value": "50000" }
      ]
    }
  ],
  "properties": ["dealname", "dealstage", "amount", "closedate"],
  "sorts": ["amount DESC"],
  "limit": 50
}
```
Call this via `search_deals`.

## Example: find custom-object (Members) records

```json
{
  "objectTypeId": "2-12345",
  "filterGroups": [
    { "filters": [{ "propertyName": "membership_status", "operator": "EQ", "value": "active" }] }
  ],
  "properties": ["email", "membership_status", "renewal_date"],
  "limit": 20
}
```
Call this via `search_custom_objects`. Get `2-12345` from `list_object_schemas` first — never invent an `objectTypeId`.

## Following associations

To find related records (e.g. which contacts are linked to a Members record), use `list_associations` with `fromObjectType`/`toObjectType`/`fromObjectIds` — don't try to express a cross-object join through `filterGroups`, HubSpot's search API doesn't support that.

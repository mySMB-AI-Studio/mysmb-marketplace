---
name: hubspot-search-crm
description: Search HubSpot CRM records using search_crm_objects or fetch by IDs with get_crm_objects. Use when the user asks to find contacts, companies, deals, tickets, or any CRM object type — including filtered lists, pipeline views, and paginated result sets.
---

# Search HubSpot CRM records

## Choosing the right tool

| Situation | Tool |
|---|---|
| You know the record IDs | `get_crm_objects` |
| You need to filter, sort, or search by property | `search_crm_objects` |

Use `get_crm_objects` when you already have HubSpot IDs (up to 100 per call). Use `search_crm_objects` for everything else.

## Supported object types

`contacts`, `companies`, `deals`, `tickets`, `line_items`, `products`, `quotes`, `subscriptions`, `carts`, `invoices`, `orders` — and any custom object type name the account has configured.

## search_crm_objects parameters

```
objectType    string    Required. The object type to search.
filterGroups  array     Filter groups (see below). Empty array = no filters (returns all).
properties    array     Property names to include in results. Always specify — do not omit.
sorts         array     [{ "propertyName": "...", "direction": "ASCENDING"|"DESCENDING" }]
limit         integer   Max results per page (1–200). Default 100.
after         string    Pagination cursor from previous response's paging.next.after.
```

## Filter group construction

Filters **within** a group are AND-ed. Filter **groups** are OR-ed. Max 5 groups, max 6 filters per group.

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "EQ", "value": "appointmentscheduled" },
        { "propertyName": "amount",    "operator": "GT", "value": "10000" }
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

| Operator | Meaning |
|---|---|
| `EQ` | Equals |
| `NEQ` | Not equals |
| `LT` / `LTE` | Less than / less than or equal |
| `GT` / `GTE` | Greater than / greater than or equal |
| `CONTAINS_TOKEN` | String contains token (case-insensitive) |
| `NOT_CONTAINS_TOKEN` | String does not contain token |
| `HAS_PROPERTY` | Property exists and is non-empty |
| `NOT_HAS_PROPERTY` | Property is empty or absent |

## Common property names by object type

**Contacts:** `firstname`, `lastname`, `email`, `phone`, `company`, `jobtitle`, `lifecyclestage`, `hs_lead_status`, `hubspot_owner_id`, `createdate`, `lastmodifieddate`

**Companies:** `name`, `domain`, `industry`, `city`, `country`, `numberofemployees`, `annualrevenue`, `hubspot_owner_id`, `lifecyclestage`

**Deals:** `dealname`, `dealstage`, `amount`, `closedate`, `pipeline`, `hubspot_owner_id`, `hs_deal_stage_probability`

**Tickets:** `subject`, `content`, `hs_pipeline_stage`, `hs_ticket_priority`, `hubspot_owner_id`, `createdate`

If you are unsure of a property name, call `search_properties` with `objectType` and relevant keywords first.

## Pagination

When the response includes `paging.next.after`, pass that value as `after` in the next call to retrieve the next page. Repeat until `paging.next` is absent.

## Example: find high-value open deals

```json
{
  "objectType": "deals",
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "dealstage", "operator": "NEQ", "value": "closedwon" },
        { "propertyName": "dealstage", "operator": "NEQ", "value": "closedlost" },
        { "propertyName": "amount",    "operator": "GTE", "value": "50000" }
      ]
    }
  ],
  "properties": ["dealname", "dealstage", "amount", "closedate", "hubspot_owner_id"],
  "sorts": [{ "propertyName": "amount", "direction": "DESCENDING" }],
  "limit": 50
}
```

## Example: find contacts by lifecycle stage

```json
{
  "objectType": "contacts",
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "lifecyclestage", "operator": "EQ", "value": "lead" }
      ]
    }
  ],
  "properties": ["firstname", "lastname", "email", "company", "createdate"],
  "sorts": [{ "propertyName": "createdate", "direction": "DESCENDING" }],
  "limit": 20
}
```

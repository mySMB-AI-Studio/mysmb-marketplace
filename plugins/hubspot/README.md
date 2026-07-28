# HubSpot

Access HubSpot CRM through a mySMB-owned OAuth app and a myHub-hosted MCP gateway (`/hubspot/mcp`) — click Connect and sign in with your HubSpot account. No client ID/secret to create or paste in; that step is gone.

This is a full custom build on top of HubSpot's standard CRM REST APIs, not a proxy to HubSpot's own `mcp.hubspot.com` remote server — that official server doesn't support custom objects or fine-grained Associations control, both of which are required for the membership-management use case (e.g. a `Members` custom object linked to Contacts via Associations).

Covers contacts, companies, deals, tickets, custom objects, and the Associations API. Each user's session is managed automatically, including silent token refresh — HubSpot access tokens expire after ~30 minutes.

## Configuration

No environment variables required. Click **Connect** and sign in to your HubSpot account; the workspace completes the OAuth exchange and stores your session securely.

Scopes requested during Connect:

| Scope | Grants |
|---|---|
| `crm.objects.contacts.read` / `.write` | Read and write contacts |
| `crm.objects.companies.read` / `.write` | Read and write companies |
| `crm.objects.deals.read` / `.write` | Read and write deals |
| `tickets` | Read and write tickets |
| `crm.objects.custom.read` / `.write` | Read and write custom object records (e.g. a `Members` object) |
| `crm.schemas.custom.read` | List custom object schemas (`objectTypeId`s) |

> **Known limitation — custom objects require HubSpot Enterprise tier.** The six custom-object tools (`list_object_schemas`, `list_custom_objects`, `get_custom_object`, `search_custom_objects`, `create_custom_object`, `update_custom_object`) only return data if the connected HubSpot portal is on **Enterprise tier on at least one Hub**. On lower tiers, `list_object_schemas` returns an empty list and the other custom-object tools return empty results — not an error. Contacts/companies/deals/tickets tools work regardless of tier.

## Tool categories

### Contacts (5)
- `list_contacts` — cursor-paginated list. Returns `{ items, has_more, next_after }`.
- `get_contact` — fetch one contact by ID (or an alternate `idProperty`, e.g. `email`).
- `search_contacts` — `filterGroups` + free-text `query` + `sorts`. Returns `{ items, has_more, next_after, total }`.
- `create_contact` — create; at minimum supply `email` and/or `firstname`/`lastname`.
- `update_contact` — partial update by ID.

### Companies (5)
- `list_companies`, `get_company`, `search_companies`, `create_company` (at minimum supply `name`), `update_company`.

### Deals (5)
- `list_deals`, `get_deal`, `search_deals`, `create_deal`, `update_deal`.
- Creating a deal requires `dealname`, plus `pipeline`/`dealstage` as the **internal IDs** from `list_pipelines` — not the display labels shown in the HubSpot UI.

### Tickets (5)
- `list_tickets`, `get_ticket`, `search_tickets`, `create_ticket`, `update_ticket`.
- Creating a ticket requires `subject` and `hs_pipeline_stage` (internal numeric stage ID from `list_pipelines`). `hs_pipeline` defaults to the account's default pipeline if omitted. `hs_ticket_priority` is typically `LOW`/`MEDIUM`/`HIGH`.

### Custom objects (6) — this is what makes the Members model work
- `list_object_schemas` — every custom object schema on the portal, and the `objectTypeId` every other custom-object tool needs.
- `list_custom_objects` / `get_custom_object` / `search_custom_objects` / `create_custom_object` / `update_custom_object` — same shape as the standard-object tools above, but take an explicit `objectTypeId` (numeric ID like `2-12345`, or fully-qualified name like `p12345_members`) instead of a fixed object type.

### Associations (3) — linking records, e.g. Members ↔ Contacts
- `list_associations` — batch-read associations from one or more records of `fromObjectType` to `toObjectType`.
- `create_association` — link two records with a specific `associationCategory`/`associationTypeId`.
- `list_association_labels` — valid `associationTypeId` values between two object types (call before `create_association`).

### Lookup helpers (2)
- `list_pipelines` — pipelines + stages for `deals`/`tickets` (or a pipeline-enabled custom object) — the internal IDs `create_deal`/`create_ticket` require.
- `list_properties` — every property (standard + custom) for an object type — internal `name`, display `label`, `type`, `fieldType`. Use before create/update to confirm valid property names; never guess.

Pagination is HubSpot's native `after`/`limit` cursor (never page numbers) — `limit` is capped at 100. `list_*` tools return `{ items, has_more, next_after }`; `search_*` tools add `total`.

**No delete tools exist.** Deleting records is not supported via this connector — use the HubSpot UI.

**Out of scope for this build:** Marketing Events and campaign-analytics endpoints (Marketing-Hub-gated, secondary to the contacts/companies/deals/tickets/Members use cases this connector targets). Tracked as backlog, not silently dropped.

## Destructive operations

Confirm before calling — these mutate CRM records:

- `create_contact` / `create_company` / `create_deal` / `create_ticket` / `create_custom_object` — creates a new record visible to everyone with access to that object type.
- `update_contact` / `update_company` / `update_deal` / `update_ticket` / `update_custom_object` — overwrites the supplied fields on an existing record.
- `create_association` — links two records; not easily reversible via this connector.

## Widgets

- **Recent Contacts** (`hubspot-contacts-recent`) — the most recently created contacts, sorted by create date, with name, company, email, and lifecycle-stage badge.
- **Deals Pipeline** (`hubspot-pipeline`) — open deals (excluding closed-won/closed-lost) with stage and amount.
- **Support Tickets** (`hubspot-support-tickets`) — recent tickets with a priority badge (tone-mapped: `HIGH` → destructive, `MEDIUM` → warning, `LOW` → neutral).
- **Members** (`hubspot-members-list`) — records from a custom object (e.g. a `Members` object). The `objectTypeId` and `properties` in this widget's data provider are illustrative placeholders — edit them in tile settings to match your portal's actual custom-object schema (`list_object_schemas` / `list_properties`).
- **Membership by State** (`hubspot-membership-by-state`) — count-and-percentage breakdown of a custom object's records by a state/territory property, with a data-driven insight callout naming the top state(s). Requires HubSpot Enterprise tier (same as Members, above). The `objectType` and `propertyName` in this widget's data provider are illustrative placeholders — edit them in tile settings to match your portal's actual custom-object schema and state/territory property (`list_object_schemas` / `list_properties`).

## See also

- [HubSpot OAuth quickstart](https://developers.hubspot.com/docs/api/oauth-quickstart-guide)
- [HubSpot CRM API reference](https://developers.hubspot.com/docs/api/crm/contacts)
- [HubSpot custom objects overview](https://developers.hubspot.com/docs/api/crm/crm-custom-objects)
- [HubSpot Associations API](https://developers.hubspot.com/docs/api/crm/associations)
- [HubSpot developer portal](https://developers.hubspot.com/)

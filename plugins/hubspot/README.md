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

### Custom objects (7) — this is what makes the Members model work
- `list_object_schemas` — every custom object schema on the portal, and the `objectTypeId` every other custom-object tool needs.
- `list_custom_objects` / `get_custom_object` / `search_custom_objects` / `create_custom_object` / `update_custom_object` — same shape as the standard-object tools above, but take an explicit `objectTypeId` (numeric ID like `2-12345`, or fully-qualified name like `p12345_members`) instead of a fixed object type.
- `count_objects_by_property` — count-and-percentage breakdown of an object type's records grouped by one property's value (e.g. Members by `state`). HubSpot has no native group-by-count endpoint, so this paginates the Search API and aggregates in-memory, capped at HubSpot's 10,000-result search limit (`truncated: true` if hit).

`list_custom_objects` and `count_objects_by_property` also accept an `objectTypeHint` (e.g. `"member"`) as an alternative to the exact `objectTypeId`/`objectType` — resolved automatically by matching the hint against `list_object_schemas` (exact match on name/label first, then substring). This exists because dashboard tiles have no way today to be configured with a customer's exact object ID (see Widgets, below) — an AI agent chatting with a user can always discover the exact ID via `list_object_schemas` and pass it directly instead.

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
- **Membership by State** (`hubspot-membership-by-state`) — count-and-percentage breakdown of a custom object's records by a state/territory property, with a per-state progress bar, a data-driven insight callout naming the top state(s), and a second callout naming the least-represented state(s) as an outreach opportunity (only shown once there are 3+ distinct states). Click a state row to drill down into up to 25 member names for that state (a `search_custom_objects` call scoped by the clicked state, with a "+N more" note if it has more); a footer link opens the full list directly in HubSpot. Uses `objectTypeHint: "member"` — automatically finds the portal's custom object whose name/label matches "member", no manual configuration needed (MyHub's dashboard has no per-tile parameter-configuration UI today, so this couldn't rely on an exact `objectTypeId` — see `count_objects_by_property` above). Requires HubSpot Enterprise tier. The `propertyName` (`"state"`) is still a fixed assumption — if a portal names its state/territory property differently, this tile won't find data, and there's currently no way to override that per portal.

- **Membership by Category** (`hubspot-membership-by-category`) — total active-member count plus a breakdown by membership type/category (e.g. Full/Accredited, Student, Associate, Retired/Honorary). Categories are color-coded by rank (highest count first), not by matching specific category names, since membership-type labels vary far more across portals than a state/territory list would. Same `objectTypeHint: "member"` auto-discovery as Membership by State; the `propertyName` (`"membership_type"`) is a fixed assumption with the same per-portal limitation.

Note: an earlier standalone "Members" list widget (browsing all member names, unfiltered) was retired in favor of the click-to-drill-down flow on Membership by State, which covers the same need (seeing member names) scoped to a specific state, plus the "Open in HubSpot" link for browsing everyone.

## Setting up your Members object (required for the membership tiles)

The Membership by State and Membership by Category tiles only show real data if the connected HubSpot portal has a custom object set up with a specific shape — there's no per-tile configuration UI in MyHub today (see `objectTypeHint` above), so exact property names matter. Before enabling either tile for a customer, confirm their portal has:

1. **HubSpot Enterprise tier** on at least one Hub — custom objects don't exist below this tier at all. `list_object_schemas` returns an empty list, not an error, if this isn't met.
2. **A custom object with "member" in its name or label** (e.g. "Members", "Member", "Association Members") — the object itself is auto-discovered by name match, so exact naming isn't critical here, just that "member" appears in it.
3. **A property internally named exactly `state`** (dropdown or text) — required for Membership by State. Internal name, not the display label — check via `list_properties` if unsure what a portal actually has.
4. **A property internally named exactly `membership_type`** (dropdown or text) — required for Membership by Category.

If a customer's existing setup doesn't match #3/#4 (e.g. they already have a differently-named property with the same meaning), the tile won't error — it'll just show every record bucketed under `"(not set)"`, since HubSpot silently returns blank values for an unrecognized property name rather than rejecting the request. Two ways to fix that: rename/add the property on the customer's HubSpot side to match, or (bigger effort) extend `count_objects_by_property`/`list_custom_objects` with the same kind of name-based fallback `objectTypeHint` already uses, but for property names instead of the object itself.

## See also

- [HubSpot OAuth quickstart](https://developers.hubspot.com/docs/api/oauth-quickstart-guide)
- [HubSpot CRM API reference](https://developers.hubspot.com/docs/api/crm/contacts)
- [HubSpot custom objects overview](https://developers.hubspot.com/docs/api/crm/crm-custom-objects)
- [HubSpot Associations API](https://developers.hubspot.com/docs/api/crm/associations)
- [HubSpot developer portal](https://developers.hubspot.com/)

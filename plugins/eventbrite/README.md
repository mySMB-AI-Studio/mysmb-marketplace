# Eventbrite

Connect Eventbrite to MyHub via the myHub-hosted Eventbrite MCP gateway. OAuth flow — click Connect and sign in to your Eventbrite account.

Covers organizations, events, attendees, and orders. Read-only — there are no create/update/delete tools.

## Authentication

Click **Connect** in the MyHub workspace and sign in with your Eventbrite account. Eventbrite's authorization-code grant returns a long-lived access token with no refresh token and no timed expiry (it stays valid until you revoke the app or change your Eventbrite password) — MyHub stores it and surfaces a re-connect prompt if it's ever revoked.

Eventbrite has no granular OAuth scopes for standard apps: connecting grants full read/write access to your account from Eventbrite's side, even though this plugin's gateway only exposes read tools.

## Configuration

This plugin uses OAuth. No environment variables or manual credentials are required.

| Variable | Description |
|---|---|
| _(none)_ | OAuth tokens are managed automatically by MyHub after you click Connect. |

## Tools & resources

- `get_current_user` — authenticated user profile (id, name, emails)
- `list_organizations` — every Eventbrite organization the authenticated user belongs to (id, name) — start here to find `organization_id`
- `list_events` — events owned by an organization (param: `organization_id`, optional `status`, `order_by`, `time_filter`, `page_size`, `continuation`)
- `get_event` — full detail for a single event (param: `event_id`, optional `expand: organizer | venue | ticket_classes`)
- `list_attendees` — attendees for an event (param: `event_id`, optional `status`, `changed_since`, `page_size`, `continuation`)
- `list_orders` — orders for an event (param: `event_id`, optional `status`, `changed_since`, `page_size`, `continuation`)

Eventbrite scopes almost everything to an organization — `list_organizations` first, then pass its `id` as `organization_id` to `list_events`.

## Widgets

- **Upcoming Events** (`eventbrite-upcoming-events`) — an organization's current and future events, with date, status, and online/in-person badges
- **Event Details** (`eventbrite-event-details`) — full detail for one event: date range, venue or online link, organizer, description, and ticket classes with sold/total counts

### Known limitation: `organization_id` / `event_id` can't be auto-resolved

Same limitation as this marketplace's Atlassian Service Desk Queue tile and monday.com's board tiles: a widget's `dataProvider` fires exactly **one** MCP tool call on mount, and there is no dataProvider-chaining support yet to call `list_organizations` (or `list_events`) first and feed the result into a second call. `list_events` requires `organization_id`; `get_event` / `list_attendees` / `list_orders` require an `event_id`. Both widgets below ship with a placeholder value in their `dataProvider.params` — **call `list_organizations` (and, for Event Details, `list_events`) yourself first and edit the widget's `dataProvider.params` to your real id before enabling it for a tenant.**

## Data verification note

This gateway's endpoint shapes were cross-checked against Eventbrite's official PHP SDK and multiple independent third-party integration write-ups, **not a live sandbox call** — no Eventbrite developer account/sandbox token was available while building this plugin (see `myhub-mcp-servers/src/integrations/eventbrite/api/client.ts`'s header comment for the server-side details). Both widgets below were built directly against the tool's documented response shape rather than a fabricated sample payload, and use defensive fallbacks (`??`, empty-string defaults) the same way this marketplace's other tiles do for fields whose presence is uncertain. Field names should be re-verified against a real Eventbrite response before this plugin is enabled for a live tenant — see each widget-element function's own doc comment in `widget-elements/src/index.ts` for exactly which fields are trusted vs. defensively guarded.

## See also

- [Eventbrite API v3 reference](https://www.eventbrite.com/platform/api)
- [Eventbrite OAuth guide](https://www.eventbrite.com/platform/docs/authentication)

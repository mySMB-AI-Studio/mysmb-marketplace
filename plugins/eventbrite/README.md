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

- **Upcoming Events** (`eventbrite-upcoming-events`) — an organization's current and future events, with date, status, and online/in-person badges. Event rows are clickable (opens that event's real Eventbrite page in a new tab), plus a footer button to open eventbrite.com.
- **Event Details** (`eventbrite-event-details`) — full detail for your organization's next upcoming event: date range, venue or online link, organizer, description, and ticket classes with sold/total counts
- **Check-In Progress** (`eventbrite-checkin-progress`) — browse your organization's events (all of them, not just upcoming) and click one to see its live check-in detail: seats filled vs. capacity, checked-in count and percentage, a progress bar, and the attendee roster (name, email, ticket type, checked-in status)
- **Guest List** (`eventbrite-guest-list`) — browse your organization's events and pull up the full registrant roster for whichever one you select, split into All / Checked In / Not Checked In / Cancelled tabs (tab labels show live counts). Complements Check-In Progress: that tile answers "how full is the room right now", this one answers "who exactly is on the list" — including cancelled/refunded registrants, which Check-In Progress doesn't surface at all.

### Zero-config: every widget auto-resolves organization_id / event_id

`list_events` requires `organization_id`; `get_event`/`list_attendees` require an `event_id`. No widget hardcodes one — each `dataProvider` fetches `list_organizations` on mount (no params needed), and a chained `watch` fires the next MCP call automatically once the previous one resolves an id:

- **Upcoming Events**: `list_organizations` → `watch` on `organizations/0/id` fires `eventbrite.list_events` with that id as `organization_id`.
- **Event Details**: `list_organizations` → `watch` fires `eventbrite.list_events` (`page_size: 1`, `order_by: start_asc`, i.e. the soonest upcoming event) → `watch` on `events/0/id` fires `eventbrite.get_event` with that id as `event_id`.
- **Check-In Progress**: `list_organizations` → `watch` fires `eventbrite.list_events` (`time_filter: all`, `order_by: start_desc`, up to 20 events) to populate its event picker list. Clicking an event row is a *different* trigger from the other two widgets' auto `watch` chains — the click itself fires `eventbrite.list_attendees` directly with that row's id as `event_id`, using `$bindItem` (not `$item` — see the note below) to read the clicked row's own id.
- **Guest List**: identical event-picker chain to Check-In Progress (`list_organizations` → `list_events`, click a row → `eventbrite.list_attendees` via `$bindItem`) — it's a different presentation of the same underlying `list_attendees` response, bucketed into tabs instead of a check-in percentage.

This uses the same `watch`-triggered chained-MCP-tool-call primitive already shipped in this marketplace (e.g. `plugins/copilot-studio/widgets/master-agent-chat.json`'s `list_copilot_agents` → `list_copilot_environments` chain, and `plugins/myob-accounting/widgets/myob-financial-position.json`) — confirmed by reading `myHubV2/apps/web/src/features/widgets-system/registry.ts`, where every connected MCP tool is auto-registered as a `<mcp>.<tool>` action callable from a `watch`, not just from `on.click`.

**Known trade-off, not a bug:** every widget defaults to the **first** organization returned by `list_organizations` (Eventbrite doesn't document/guarantee an ordering). An account with more than one Eventbrite organization has no way to pick a different one from the widget UI today — that would need a per-tenant override mechanism this widget system doesn't have yet. Single-organization accounts (the common case) are unaffected.

**Platform gotcha found while building Check-In Progress's clickable event rows:** `@json-render/core`'s `resolveActionParam` resolves `{ "$item": "field" }` inside a click action's `params` to the row's *state path* (e.g. `/ui/rows/0/id`), not its value — correct for something like `removeState`'s index param, but wrong for anything that needs the actual value (a URL, an id to pass to another tool call). `{ "$bindItem": "field" }` resolves to the real value in that same context (it takes a different code path in the same library). Every click action in this plugin's widgets that needs a per-row value uses `$bindItem` for exactly this reason — worth checking before copying this plugin's click patterns elsewhere in the marketplace.

**Check-In Progress's per-attendee fields are unverified against a live response with real attendees** — the test events used while building this plugin have zero registrations, so `list_attendees` only ever returned an empty array during development. The response envelope shape (`{ attendees: [...], pagination }`) and each event's own `capacity` field ARE live-confirmed; `checked_in`, `profile.name`, `profile.email`, and `ticket_class_name` are sourced from Eventbrite's own v3 API docs, not observed directly. Re-verify against a real event with real registrations before treating this tile as production-verified.

**Update (2026-09-17), found while building Guest List:** a real (test) registration is now live-confirmed, and it surfaced a genuine Eventbrite API bug — `profile.name` comes back as a malformed Python byte-string repr (`"b'Neil' b'Simon'"`), not a real display name. `profile.first_name`, `profile.last_name`, `profile.email`, `checked_in`, `ticket_class_name`, plus the previously-undocumented `cancelled`/`refunded` booleans and the `status` string field, are all now live-confirmed clean. **Check-In Progress's `flatten_attendees` still reads `profile.name` directly and has NOT been fixed** — it will render the garbled string for any attendee whose profile only has that field set. Guest List's `flatten_guest_list` avoids this by building the display name from `first_name`/`last_name` instead. Fixing Check-In Progress is a separate, small follow-up.

## Data verification note

This gateway's endpoint shapes were cross-checked against Eventbrite's official PHP SDK and multiple independent third-party integration write-ups, **not a live sandbox call** — no Eventbrite developer account/sandbox token was available while building this plugin (see `myhub-mcp-servers/src/integrations/eventbrite/api/client.ts`'s header comment for the server-side details). Both widgets below were built directly against the tool's documented response shape rather than a fabricated sample payload, and use defensive fallbacks (`??`, empty-string defaults) the same way this marketplace's other tiles do for fields whose presence is uncertain. Field names should be re-verified against a real Eventbrite response before this plugin is enabled for a live tenant — see each widget-element function's own doc comment in `widget-elements/src/index.ts` for exactly which fields are trusted vs. defensively guarded.

## See also

- [Eventbrite API v3 reference](https://www.eventbrite.com/platform/api)
- [Eventbrite OAuth guide](https://www.eventbrite.com/platform/docs/authentication)

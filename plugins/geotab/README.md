# Geotab

Connect Geotab fleet telematics to myHub via the official Geotab-hosted MCP Connector at `https://mcp.geotab.com/mygeotab`. Covers vehicle location and status, trips, mileage/fuel/energy usage, faults and diagnostics, hours-of-service/compliance, and fleet reporting from a single endpoint.

OAuth 2.1 + PKCE — no API keys, no env vars. Each user authorises individually against their own MyGeotab account; the MCP server enforces that user's existing MyGeotab permissions, so it only ever sees data they're already authorized to see in MyGeotab.

## Configuration

No environment variables are required. The Geotab MCP server implements OAuth 2.1 Authorization Code + PKCE with Dynamic Client Registration (DCR, RFC 7591):

- Confirmed via `https://mcp.geotab.com/.well-known/oauth-authorization-server` — the metadata document lists a real `registration_endpoint` (`https://mcp.geotab.com/register`), so clients self-register at connect time. No pre-registered `client_id`/`client_secret` needed.
- On first use, the browser redirects to Geotab's sign-in page — authenticate and grant access — and subsequent calls flow over a scoped, per-user token with automatic refresh. MyGeotab credentials never reach the client.

### Prerequisites

- An active MyGeotab database with API access enabled.
- The connecting user must be on **Geotab Unified Login** (self-service migration from MyGeotab profile settings). **SAML-authenticated accounts cannot connect directly** — they need to migrate first, or the customer's Geotab account team can assist.
- MyGeotab API rate limits apply and are passed through as structured errors — no fixed numeric limit is published; design any polling/bulk usage defensively.

## Tool coverage (by entity category — confirm exact tool names via Connections once live)

The server exposes roughly 20 tools across 50+ MyGeotab entity types. Categories confirmed from Geotab's own docs:

- **Devices & assets** — `Device`, `DeviceStatusInfo`, `Trailer`, `TrailerAttachment`
- **Location & trips** — `Trip`, `LogRecord`, `DriverChange`, posted-road-speed comparisons
- **Faults & diagnostics** — `FaultData`, `StatusData`, fault dismissal, VIN decoding
- **HOS & compliance** — `DutyStatusLog`, `DutyStatusAvailability`, `DVIRLog`
- **Fuel & energy** — `FuelTransaction`, `EVStatusInfo`, `BatteryStateOfHealth`
- **Zones, routes, users, events, notifications, and reporting tools**

The exact tool call names (equivalent to Calendly's `event_types-list_event_types` style naming) aren't published in Geotab's overview docs — list them from the Connections tab once connected, before wiring any widget's `dataProvider` to a specific tool name.

## Widgets

Four demo tiles ship with static, illustrative data — the live `dataProvider` wiring is deliberately deferred until the exact MyGeotab MCP tool names and call shapes are confirmed via the Connections tab (see above). Fictional sample names are used throughout, not real people or customer data.

- **After-Hours & Private Use** — FBT-year private/after-hours km against the ATO logbook method, 12-week coverage progress, and a per-vehicle breakdown with a flag for vehicles trending past the minor-and-infrequent threshold.
- **Travel vs On-Site Time** — today's on-site/travel/idle split for the field team, with a per-technician productive-ratio breakdown.
- **Fuel & Efficiency** — month-to-date fuel spend, fleet L/100km average and trend, a per-vehicle efficiency breakdown, and fill-exception flags.
- **Vehicles On Site Now** — live on-site/in-transit/unaccounted counts and per-geofence dwell time.

All four use a `Send to WorkQ` action wired to the system's `open_todo_modal` action (the closest existing primitive — there is no dedicated one-click "send" action yet) and follow `TILE-DISPLAY-STANDARDS.md`: Title Case section labels (not the mockup's original ALL CAPS), 2-decimal currency, and status tones restricted to `muted`/`info`/`warning`/`destructive` — `success` is deliberately never used for "efficient" or "productive," since that tone is reserved for done/paid/completed states.

## Destructive / mutating operations

Geotab's docs confirm the server supports **data retrieval, data modification, and specialized fleet methods** — not read-only. Until the exact tool list is confirmed, treat anything under "fault dismissal," DVIR log operations, or zone/route edits as mutating and requiring confirmation before calling, matching the caution already applied to Calendly's `meetings-cancel_event` and similar.

## See also

- [Getting started with MyGeotab MCP](https://support.geotab.com/help/mygeotab/access-and-administration/mygeotab-mcp/getting-started-with-mygeotab-mcp)
- [Geotab MCP technical overview](https://developers.geotab.com/ai/mcp/mygeotab/)
- [Geotab MCP Connector announcement](https://www.geotab.com/geotab-mcp-connector/)
- [Dynamic Client Registration RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)

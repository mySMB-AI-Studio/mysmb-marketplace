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

## Tool coverage

The connected server exposes 22 tools (confirmed live against the running MCP server's own tool schemas, not just Geotab's overview docs): **Reads** — `Get`, `GetCountOf`, `GetEntity`, `GetSkill`; **Writes** — `Add`, `Set`, `Remove`; plus category-specific tools for trips/speed, faults/HOS/emissions, media/cameras, reports/AI, and misc (VIN decode, feedback). There is no per-entity tool the way ServiceM8/Xero expose one — `Device`, `DeviceStatusInfo`, `Trip`, `LogRecord`, `FuelTransaction`, `Zone`, etc. are all fetched via the single generic `Get` tool with a `typeName` param, matching Geotab's real, long-documented MyGeotab SDK (`developers.geotab.com/myGeotab/apiReference/`) — field-level schemas came from there, not live discovery.

**`ListEntities` is not a data-fetch tool** — confirmed by pulling its real `inputSchema` straight off the running server: it takes zero parameters. Its actual job is listing which `typeName` values are supported for `Get`/`Add`/`Set`/`Remove`, not returning entity records. An earlier version of this plugin called it with `{database, typeName, resultsLimit}` expecting Zone records back and got a Pydantic validation error (all three params rejected as "unexpected keyword argument") — that was fixed by removing the call entirely, see the platform gotcha below.

**Platform gotcha (confirmed, currently unfixable at the widget/plugin layer)**: state paths for tool-call results are keyed purely by `/{mcp}/{tool}` (`registry.ts`'s `resultToStateWrites`) — no per-params or per-`typeName` disambiguation, confirmed against the real widget runtime. Calling `Get` twice with different `typeName`s in the same widget silently overwrites the same state, no matter whether the second call comes from the `dataProvider`, a chained `watch` action, or a plugin-authored action — plugin actions only get read/write access to the state store (`WidgetActionContext`), not a way to call a tool directly. This means **a single widget cannot combine two different Geotab entity types today.** A real fix would need a platform change (e.g. an explicit custom result-key on watch actions in `registry.ts`) — flagged, not attempted here. The Vehicle Status widget below was simplified to work within this constraint.

**Unconfirmed / needs live verification**: the exact wire format of `Duration`-typed fields (`Trip.drivingDuration`, `DeviceStatusInfo.currentStateDuration`, etc.) — Geotab's docs don't specify numeric-seconds vs. ISO 8601 vs. `.NET TimeSpan` string, so the widgets parse all three defensively (see `durationToMinutes` in widget-elements). Also unconfirmed: whether relationship fields like `FuelTransaction.device`/`Trip.device` come back fully inlined with `.name` (assumed, matching how other connectors in this codebase return relationship fields) or as a bare `{id}` reference requiring a separate `Device` lookup — if the latter, per-vehicle labels will silently fall back to raw device IDs rather than names.

**Confirmed live against the `demo_mysmb_dev` demo account**: `Trip` and `DeviceStatusInfo` both have real data — `Trip` across at least a calendar quarter, `DeviceStatusInfo` currently live for ~40 devices. `FuelTransaction` has **zero records, confirmed with no date filter at all** — this demo account was never seeded with fuel-card transaction data (unlike GPS-derived entity types, which come from simulated driving and always exist). The Fuel & Efficiency widget's empty state is accurate, not a bug; it should populate against any account with real fuel-card integration data. Similarly, Travel vs On-Site Time's "today"-only window can show empty against this same static/seeded demo data even though the underlying query and computation are correct (confirmed by temporarily widening its date range and seeing real data) — expected to populate correctly against a live production account with continuously-tracked vehicles.

## Widgets

All four widgets are wired to live data via the connected MyGeotab account (`database: "demo_mysmb_dev"` is currently hardcoded — becomes a real gap once this needs to work per-tenant, not just against one demo account). Every aggregation is computed client-side in `widget-elements/src/index.ts` from raw Geotab entity records — none of it comes pre-aggregated from the API.

- **After-Hours & Private Use** — quarter-to-date after-hours km/trip count and 12-week logbook coverage, computed from `Trip` records, with a flag for the vehicle furthest past the minor-and-infrequent threshold. Relabeled from the original demo's "FBT year to date" — no fiscal-year-start date token exists to fetch a true FBT year, only calendar month/quarter. The demo's Business/Private/Unclassified % badges are dropped — `Trip` has no explicit business-vs-private classification field, only `afterHoursDistance`/`workDistance`.
- **Travel vs On-Site Time** — today's on-site/travel/idle split and per-vehicle productive ratio, computed from `Trip` records (`stopDuration` minus `idlingDuration` = on-site; `idlingDuration` = idle). Grouped by **vehicle**, not driver — `Device`'s fields were confirmed against Geotab's docs, `Driver`'s weren't this pass.
- **Fuel & Efficiency** — month-to-date fuel cost and per-vehicle L/100km, computed fill-to-fill from `FuelTransaction.odometer` deltas (no separate `Trip` fetch needed). The demo's fabricated tank-overfill/odd-hours-fill exceptions are replaced with a real, derivable signal: vehicles whose latest fill-to-fill reading is 18+ L/100km.
- **Vehicle Status** (`geotab-vehicle-status.json`) — real-time driving/stopped/offline status and speed per vehicle, computed from `DeviceStatusInfo` records. Originally scoped as live geofence on-site/in-transit detection (point-in-polygon against `Zone.points`) — Geotab has no API call that answers "which vehicles are in this zone right now" anyway (confirmed against their docs and a community thread — `ExceptionEvent`-based zone rules report zero duration while a vehicle is still inside, and need a pre-existing Rule configured on the account) — but that design also needed a second Geotab entity type (`Zone`) fetched in the same widget, which turned out to be a confirmed platform limitation (see above), not just a missing-API problem. Simplified to a single `DeviceStatusInfo` fetch instead.

The After-Hours and Travel-vs-On-Site widgets use a `Send to WorkQ` action wired to the system's `open_todo_modal` action (the closest existing primitive — there is no dedicated one-click "send" action yet) and follow `TILE-DISPLAY-STANDARDS.md`: Title Case section labels, status tones restricted to `muted`/`info`/`warning`/`destructive` — `success` is deliberately never used for "efficient" or "productive," since that tone is reserved for done/paid/completed states.

## Destructive / mutating operations

Geotab's docs confirm the server supports **data retrieval, data modification, and specialized fleet methods** — not read-only. Until the exact tool list is confirmed, treat anything under "fault dismissal," DVIR log operations, or zone/route edits as mutating and requiring confirmation before calling, matching the caution already applied to Calendly's `meetings-cancel_event` and similar.

## See also

- [Getting started with MyGeotab MCP](https://support.geotab.com/help/mygeotab/access-and-administration/mygeotab-mcp/getting-started-with-mygeotab-mcp)
- [Geotab MCP technical overview](https://developers.geotab.com/ai/mcp/mygeotab/)
- [Geotab MCP Connector announcement](https://www.geotab.com/geotab-mcp-connector/)
- [Dynamic Client Registration RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)

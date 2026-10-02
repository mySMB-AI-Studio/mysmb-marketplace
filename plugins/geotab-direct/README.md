# Geotab (Direct API)

Connect Geotab fleet telematics to myHub by talking **directly** to MyGeotab's classic REST/JSON-RPC API with your own database, username, and password (or a Geotab API key) -- no OAuth, no developer account, no client registration. This is a **self-hosted, sibling alternative** to the [`geotab`](../geotab) plugin, not a replacement for it: both plugins can be installed side by side, and a tenant switches between them independently depending on which connection model works for their environment.

## Why this plugin exists

The `geotab` plugin connects through Geotab's official, vendor-hosted OAuth 2.1 + PKCE MCP connector at `mcp.geotab.com`. That connector rejects mySMB's real deployed OAuth `redirect_uri` at the `/authorize` step (confirmed live, twice, with a fresh Dynamic Client Registration `client_id` each time: `{"error":"invalid_request","error_description":"redirect_uri not allowed"}`). Geotab's own developer community team has confirmed that third-party OAuth support is still **"experimental"** -- not an officially documented/supported path, with no timeline for one.

Rather than wait on that, this plugin talks to a **self-hosted MyGeotab MCP server** (built in `myhub-mcp-servers`, `src/integrations/geotab/`) that uses MyGeotab's classic, long-established `Authenticate` JSON-RPC method instead of OAuth. Per Geotab's own docs: *"You do not need a separate developer API key."* (<https://developers.geotab.com/myGeotab/guides/gettingStarted/>)

## How auth differs from the `geotab` plugin

| | `geotab` (vendor OAuth connector) | `geotab-direct` (this plugin) |
|---|---|---|
| Auth model | OAuth 2.1 + PKCE, Dynamic Client Registration | Direct credentials (`Authenticate` JSON-RPC) |
| What the user provides | Nothing up front -- browser redirect + sign-in | MyGeotab database, username, password (or API key) |
| Where it breaks today | Blocked at `/authorize` on mySMB's real deployed domain | Works today -- no redirect, no client registration |
| Credential storage | Per-user OAuth token, auto-refreshed by the platform | Per-tenant credentials, sent as request headers on every call |

Connecting is a single form: your MyGeotab database name, your MyGeotab username (email), and your MyGeotab password or a Geotab API key -- MyGeotab authenticates either one identically through the `Authenticate` method. There is no separate developer account and no OAuth popup.

## Configuration

| Variable | Used by |
|---|---|
| `GEOTAB_DATABASE` | `geotab-direct` MCP server |
| `GEOTAB_PASSWORD` | `geotab-direct` MCP server |
| `GEOTAB_USERNAME` | `geotab-direct` MCP server |

## What this provides

One MCP server (mounted at `/geotab` on the myhub-mcp-servers container):

- **`Get`** -- a generic MyGeotab entity fetch (`typeName`, `search.fromDate`/`search.toDate`, `resultsLimit`), returning `{ result: [...] }`. Named exactly `Get` (not this repo's usual `snake_case`) and shaped to match MyGeotab's own JSON-RPC envelope on purpose, so the After-Hours & Private Use, Travel vs On-Site Time, and Fuel & Efficiency widgets carried over from the `geotab` plugin's widget designs work the same way against this server.
- **`get_vehicle_geofence_status`** -- combines `DeviceStatusInfo` + `Zone` in a **single call** (point-in-polygon against each zone's mapped boundary) to classify every vehicle as `on-site`, `in-transit`, or `offline`, with the matched zone's name when on-site.

## Real geofencing -- the actual point of this plugin

The `geotab` plugin's Vehicle Status widget had to be scaled back from live on-site/in-transit geofence detection to a plain driving/stopped/offline status list. That wasn't a Geotab API limitation -- it was a **platform limitation**: MyHub's widget runtime keys tool-call state purely by `<mcp>.<tool>` with no per-params disambiguation, so a widget calling the vendor connector's generic `Get` tool twice in one widget (once for `DeviceStatusInfo`, once for `Zone`) would have the second call silently overwrite the first at the same state path. There was no way to combine both entity types in one widget.

This self-hosted server sidesteps the limitation entirely with a **dedicated tool**, `get_vehicle_geofence_status`, that does the `DeviceStatusInfo` + `Zone` fetch and point-in-polygon classification server-side, in one MCP call. The **Vehicles On Site Now** widget (`widgets/geotab-direct-vehicle-geofence-status.json`) uses this tool to show real on-site / in-transit / offline counts and, for every on-site vehicle, which mapped zone it's actually in -- something the `geotab` plugin's version of this widget cannot do.

## Widgets

All four widgets compute client-side in `widget-elements/src/index.ts` (one `*_dashboard` function per widget, called from the card's `watch`) and draw with the system chart elements (`Donut`, `BarChart`, and segmented bars built from a `template`d `Row` of `ProgressBar`s):

- **Vehicles On Site Now** (`geotab-direct-vehicle-geofence-status.json`) -- a Donut of on-site / in-transit / offline counts via `get_vehicle_geofence_status`, and a per-vehicle list with the matched zone name for on-site vehicles. This is the widget that was rebuilt for this plugin -- see above.
- **After-Hours & Private Use** -- after-hours km over the last 30 days by weekday (peak day highlighted, weekend share), a BarChart of the top vehicles, and the minor-and-infrequent flag, from `Trip` records.
- **Travel vs On-Site Time** -- today's on-site / travel / idle split as a segmented bar for the fleet and for each vehicle, from `Trip` records.
- **Fuel & Efficiency** -- month-to-date fuel cost, fleet-average L/100km, litres per day for the last 7 days, MTD litres by vehicle (Donut), and the highest fill-to-fill L/100km vehicles, from `FuelTransaction` records.

The `Get`-backed widgets pass `search.fromDate`/`toDate` as instant tokens (`$today`, `$days_ago_30`, `$now`), not the `*_date` calendar tokens: MyGeotab treats a date-only `toDate` as midnight, so `fromDate == toDate == $today_date` is a zero-length window that always returns nothing.

None of the other three widgets were ever blocked by the state-key platform limitation (each only calls one MyGeotab entity type).

**Known gap:** `Trip`, `FuelTransaction` and `DeviceStatusInfo` reference the vehicle by id only, so vehicle labels currently show the device id (e.g. `b1`) rather than the Device name. Fixing it means resolving names server-side; a second `Get` for `Device` in the same widget would collide with the first (state-key limitation above).

## Destructive / mutating operations

This server currently exposes only the two read-only tools listed above (`Get`, `get_vehicle_geofence_status`). Should write tools be added later, treat them as mutating and requiring confirmation before calling, matching the caution applied elsewhere in this catalog.

## See also

- [Getting started with the MyGeotab API](https://developers.geotab.com/myGeotab/guides/gettingStarted/)
- [MyGeotab API object reference](https://developers.geotab.com/myGeotab/apiReference/objects/)
- The [`geotab`](../geotab) plugin -- the official vendor-hosted OAuth alternative, recommended once Geotab's third-party OAuth support leaves "experimental" status.

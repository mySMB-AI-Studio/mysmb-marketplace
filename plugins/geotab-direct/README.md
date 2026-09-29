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

All four widgets carry over the same aggregation logic as the `geotab` plugin's widgets (client-side computation in `widget-elements/src/index.ts`), renamed and rewired to this plugin's `geotab-direct` MCP server and `$computed` prefix:

- **Vehicles On Site Now** (`geotab-direct-vehicle-geofence-status.json`) -- real on-site/in-transit/offline classification per vehicle via `get_vehicle_geofence_status`, with the matched zone name for on-site vehicles. This is the widget that was rebuilt for this plugin -- see above.
- **After-Hours & Private Use** -- quarter-to-date after-hours km/trip count and 12-week logbook coverage, computed from `Trip` records. Unchanged in behaviour from the `geotab` plugin, just repointed at `geotab-direct`.
- **Travel vs On-Site Time** -- today's on-site/travel/idle split and per-vehicle productive ratio, computed from `Trip` records. Unchanged in behaviour.
- **Fuel & Efficiency** -- month-to-date fuel cost and per-vehicle L/100km, computed fill-to-fill from `FuelTransaction` records. Unchanged in behaviour.

None of the other three widgets were ever blocked by the state-key platform limitation (each only calls one MyGeotab entity type), so they needed no redesign -- only the `dataProvider.mcp` value, `/geotab/...` state paths, and `geotab_*` -> `geotab-direct_*` `$computed` prefixes changed.

## Destructive / mutating operations

This server currently exposes only the two read-only tools listed above (`Get`, `get_vehicle_geofence_status`). Should write tools be added later, treat them as mutating and requiring confirmation before calling, matching the caution applied elsewhere in this catalog.

## See also

- [Getting started with the MyGeotab API](https://developers.geotab.com/myGeotab/guides/gettingStarted/)
- [MyGeotab API object reference](https://developers.geotab.com/myGeotab/apiReference/objects/)
- The [`geotab`](../geotab) plugin -- the official vendor-hosted OAuth alternative, recommended once Geotab's third-party OAuth support leaves "experimental" status.

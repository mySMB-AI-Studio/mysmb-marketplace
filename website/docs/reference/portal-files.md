---
id: portal-files
title: Portal files
sidebar_position: 5
---

# Portal files reference

The field-level contract for the two client-portal element types. For the concepts and a walkthrough, read [Client portals](/authoring/client-portals) first.

:::note
The authoritative schema lives in the MyHub host and is not part of this repo. These tables are documented from the shipping `xero-projects` files; fields not exercised there are marked _unverified_.
:::

## Manifest keys

Declared in **`plugin.json`** and the plugin's **`marketplace.json`** entry. Both are arrays of repo-relative paths (relative to the plugin root).

| Key | Type | Notes |
|---|---|---|
| `portalDataMaps` | `string[]` | Paths to portal data-map JSON files, e.g. `["portal-data-maps/staffed-employee-time-entries.json"]`. |
| `portalWidgets` | `string[]` | Paths to portal widget JSON files, e.g. `["portal-widgets/employee-time-entries.json"]`. |

Keep the two manifests in sync — list the same paths in `plugin.json` and `marketplace.json`.

## Portal data map (`portal-data-maps/*.json`)

```json
{
  "id": "xero-projects/staffed-employee-time-entries",
  "plugin": "xero-projects",
  "canonical": "xero-projects/TimeEntry",
  "source": { "mcpServer": "xero-projects", "tool": "list_time_entries_for_users" },
  "filters": [ /* … */ ],
  "fieldProjection": [ /* … */ ],
  "cache": { "ttl": 300, "keyTemplate": "portal:{portalId}:map:…:{weekStartUtc}:{weekEndUtc}" }
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | ✅ | string | Unique map id, referenced by a portal widget's `recipe.mapId`. Convention: `<plugin>/<name>`. |
| `plugin` | ✅ | string | Owning plugin slug. |
| `canonical` | recommended | string | Canonical entity type the projected rows conform to, e.g. `xero-projects/TimeEntry`. |
| `source` | ✅ | `{ mcpServer, tool }` | The MCP server-id and tool name this map calls. |
| `filters` | ✅ | array | How the call is clamped and parameterised. See below. |
| `fieldProjection` | ✅ | `{ out, in }[]` | Renames raw tool output fields (`in`) to canonical output fields (`out`). |
| `cache` | recommended | `{ ttl, keyTemplate }` | `ttl` in seconds; `keyTemplate` supports `{portalId}` and any `widgetParam` as `{name}`. |

### `filters[]`

Two kinds:

**`kind: "context"`** — inject a trusted value from the portal's identity. The client cannot override it; this is the security clamp.

| Field | Type | Notes |
|---|---|---|
| `kind` | `"context"` | |
| `param` | string | The tool input parameter to set. |
| `contextKey` | string | Dotted path into the portal context, e.g. `portal.employees.externalIds.xero-projects`. |
| `operator` | string | How the value applies, e.g. `"in"`. _Other operators unverified._ |

**`kind: "param"`** — pass through a value the widget is allowed to supply (e.g. a date range).

| Field | Type | Notes |
|---|---|---|
| `kind` | `"param"` | |
| `param` | string | The tool input parameter to set. |
| `widgetParam` | string | The key the portal widget provides under `recipe.params`. |

## Portal widget (`portal-widgets/*.json`)

A portal widget is a [widget JSON](./widget-json) with a `portal-proxy` data provider. Only the differences are listed here; all other top-level fields (`id`, `title`, `sizing`, `spec`, `defaultState`, …) behave as in a normal widget.

| Field | Required | Type | Notes |
|---|---|---|---|
| `category` | ✅ | string | Use `"client-portal"` by convention. |
| `status` | recommended | string | e.g. `"published"`. _Lifecycle values unverified._ |
| `dataProvider.kind` | ✅ | `"portal-proxy"` | Marks this as a portal call rather than a direct MCP call. |
| `dataProvider.recipe` | ✅ | object | See below. |

### `dataProvider.recipe`

```json
"dataProvider": {
  "kind": "portal-proxy",
  "recipe": {
    "mapId": "xero-projects/staffed-employee-time-entries",
    "params": { "weekStartUtc": { "$state": "/ui/weekStartUtc" } },
    "writeTo": "/timeEntries"
  }
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `mapId` | ✅ | string | The `id` of a portal data map shipped by this plugin. |
| `params` | when the map has `kind: "param"` filters | object | Keys match the map's `widgetParam` names. Values may be `$state` bindings. |
| `writeTo` | ✅ | JSON pointer | State path the projected rows are written to. The `spec` reads from here. |

## Validation

The marketplace validator (`scripts/validate.ts`) does not currently deep-lint portal files — it checks plugin-level structure only. Enforce these by hand and in review:

- Every `recipe.mapId` resolves to a data-map `id` the plugin ships.
- Every `recipe.params` key matches a `widgetParam` in the map's `kind: "param"` filters.
- `portalDataMaps` / `portalWidgets` paths exist and are listed in both manifests.

See [Validator rules](./validator-rules) for what *is* enforced today.

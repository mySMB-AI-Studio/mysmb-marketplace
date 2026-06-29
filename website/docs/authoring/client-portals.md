---
id: client-portals
title: Client portals
sidebar_position: 6
---

# Client portals — portal widgets & data maps

Most widgets render on the **staff dashboard**, where the logged-in user is one of your own team and is trusted to see everything the connector returns. **Client portals** are different: they render for an *external* client, who must only ever see their own slice of the data.

That security boundary is why two extra element types exist:

| Element | Files | Manifest key | What it is |
|---|---|---|---|
| **Portal widget** | `portal-widgets/*.json` | `portalWidgets` | A widget rendered in the client-facing portal instead of the staff dashboard. |
| **Portal data map** | `portal-data-maps/*.json` | `portalDataMaps` | A server-side recipe that calls an MCP tool, **filters the result by portal context**, projects fields to a canonical shape, and caches. |

A regular widget's `dataProvider` calls an MCP tool **directly** with author-supplied params. A portal widget must not do that — a client could otherwise ask for another client's records. Instead, the portal widget calls a **named data map** through a `portal-proxy`, and the data map (running server-side, where the portal's identity is trusted) injects the "only your rows" filter before the tool ever runs.

```
client opens portal
      │
      ▼
portal widget  ──(portal-proxy: mapId + params)──►  portal data map (server-side)
                                                          │  injects portal-context filters
                                                          │  (e.g. only employees staffed to THIS portal)
                                                          ▼
                                                     MCP tool call
                                                          │  field projection → canonical shape
                                                          │  cache (ttl)
                                                          ▼
                                          rows written to widget state  ──►  json-render renders the tile
```

:::note
The portal feature currently ships in **`xero-projects`** only, and its authoritative schema lives in the MyHub host (`apps/web/src/features/widgets-system/`), which isn't part of this repo. The shapes below are documented from the live `xero-projects` files — treat them as the working contract and check the host if you need a field this page doesn't cover.
:::

---

## Step 1 — Write the data map

A data map is the trusted server-side half. It says: *which tool to call, how to clamp it to this portal, and what shape to hand back.*

```json title="portal-data-maps/staffed-employee-time-entries.json"
{
  "id": "xero-projects/staffed-employee-time-entries",
  "plugin": "xero-projects",
  "canonical": "xero-projects/TimeEntry",
  "source": {
    "mcpServer": "xero-projects",
    "tool": "list_time_entries_for_users"
  },
  "filters": [
    {
      "kind": "context",
      "param": "userIds",
      "contextKey": "portal.employees.externalIds.xero-projects",
      "operator": "in"
    },
    { "kind": "param", "param": "dateAfterUtc",  "widgetParam": "weekStartUtc" },
    { "kind": "param", "param": "dateBeforeUtc", "widgetParam": "weekEndUtc" }
  ],
  "fieldProjection": [
    { "out": "id",              "in": "timeEntryId" },
    { "out": "userId",          "in": "userId" },
    { "out": "userName",        "in": "userName" },
    { "out": "durationMinutes", "in": "duration" },
    { "out": "dateUtc",         "in": "dateUtc" }
  ],
  "cache": {
    "ttl": 300,
    "keyTemplate": "portal:{portalId}:map:xero-projects/time-entries:{weekStartUtc}:{weekEndUtc}"
  }
}
```

The two filter kinds are the heart of it:

- **`kind: "context"`** — the map pulls a value out of the **portal's identity** (the `contextKey`) and forces it onto the tool call. The client can't override it. Here, `portal.employees.externalIds.xero-projects` is the set of employees staffed to this portal, fed into the tool's `userIds` param with operator `in`. This is the "only your rows" clamp.
- **`kind: "param"`** — a value the widget is *allowed* to supply (e.g. the visible week range). `widgetParam` is the name the widget passes in its recipe; `param` is the tool's parameter.

Then `fieldProjection` renames the tool's raw output (`in`) into a stable canonical shape (`out`) so the widget never depends on connector-specific field names, and `cache` memoises the result per-portal.

See the [portal-files reference](/reference/portal-files) for every field.

---

## Step 2 — Write the portal widget

A portal widget is a normal [widget JSON](/reference/widget-json) with one swap: its `dataProvider` is a **`portal-proxy`** that names the data map instead of an MCP tool.

```json title="portal-widgets/employee-time-entries.json"
{
  "id": "xero-projects-employee-time-entries",
  "title": "Employee time entries",
  "description": "Daily time entries Sun–Sat for the employees staffed to you.",
  "category": "client-portal",
  "tags": ["xero", "projects", "time-tracking", "portal"],
  "connectorsUsed": ["xero-projects"],
  "sizing": {
    "preferred": { "colSpan": 5, "rowSpan": 5 },
    "min":       { "colSpan": 4, "rowSpan": 4 },
    "max":       { "colSpan": 8, "rowSpan": 9 }
  },
  "status": "published",
  "dataProvider": {
    "kind": "portal-proxy",
    "recipe": {
      "mapId": "xero-projects/staffed-employee-time-entries",
      "params": {
        "weekStartUtc": { "$state": "/ui/weekStartUtc" },
        "weekEndUtc":   { "$state": "/ui/weekEndUtc" }
      },
      "writeTo": "/timeEntries"
    }
  },
  "defaultState": {
    "/ui/weekStartUtc": { "$computed": "current_week_start", "args": { "anchor": "sun" } }
  },
  "spec": {
    "root": "card",
    "elements": { /* … standard json-render tree … */ }
  }
}
```

What's different from a staff-dashboard widget:

| Field | Staff widget | Portal widget |
|---|---|---|
| `dataProvider` | `{ mcp, tool, params }` — calls the tool directly | `{ kind: "portal-proxy", recipe: { mapId, params, writeTo } }` |
| `category` | e.g. `"finance"` | `"client-portal"` (convention) |
| where it renders | staff dashboard | the client portal |

The `recipe`:

- **`mapId`** — the `id` of the data map from Step 1.
- **`params`** — values for the map's `kind: "param"` filters. Keys match the data map's `widgetParam` names; values may be `$state` bindings, so the tile can be interactive (here the visible week).
- **`writeTo`** — the state path the mapped, projected rows are written to. The rest of the `spec` reads from there (`/timeEntries`) using ordinary `$state` / `$computed` / `watch` — see [spec primitives](/widgets/spec-primitives).

Everything below `spec` is the same json-render vocabulary as any other widget. Build the data flow with the [widget tutorials](/widgets/tutorial-1-first-widget) first if you're new to it.

---

## Step 3 — Wire them into the manifest

Both element types are arrays of repo-relative paths, declared in **`plugin.json`** and mirrored in the plugin's **`marketplace.json`** entry:

```json title=".claude-plugin/plugin.json"
{
  "name": "xero-projects",
  "widgets": "widgets",
  "widgetElements": "widget-elements/dist/index.js",
  "portalDataMaps": ["portal-data-maps/staffed-employee-time-entries.json"],
  "portalWidgets": ["portal-widgets/employee-time-entries.json"]
}
```

```json title=".claude-plugin/marketplace.json (this plugin's entry)"
{
  "name": "xero-projects",
  "source": "./plugins/xero-projects",
  "widgets": "widgets",
  "widgetElements": "widget-elements/dist/index.js",
  "portalDataMaps": ["portal-data-maps/staffed-employee-time-entries.json"],
  "portalWidgets": ["portal-widgets/employee-time-entries.json"]
}
```

Run the validator and ship exactly as for any other change — see [Validate & ship](./validate-and-ship).

---

## Checklist

- [ ] Every `recipe.mapId` in a portal widget resolves to a data map `id` you ship.
- [ ] Every `recipe.params` key matches a `widgetParam` declared by a `kind: "param"` filter in the map.
- [ ] The "only your rows" clamp is a `kind: "context"` filter — never a widget param a client could set.
- [ ] `fieldProjection` covers every field your widget `spec` reads.
- [ ] `portalDataMaps` and `portalWidgets` paths are listed in **both** `plugin.json` and the `marketplace.json` entry.

## Up next

→ [Validate & ship](./validate-and-ship) · [Portal files reference](/reference/portal-files)

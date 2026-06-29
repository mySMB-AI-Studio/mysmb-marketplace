---
id: widget-json
title: Widget JSON
sidebar_position: 3
---

# Widget JSON reference

Lives at `plugins/<name>/widgets/<widget-id>.json`.

## Top-level fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | ✅ | string | Stable identifier. **Must equal the filename (sans `.json`).** |
| `title` | ✅ | string | Human-readable name. Shown in the gallery and on the dashboard tile. |
| `description` | ✅ | string | One sentence. Used for search and as a tooltip. |
| `category` | ✅ | string | Top-level grouping (e.g. `"finance"`, `"hr"`). |
| `tags` | ✅ | string[] | Free-form classification. |
| `keywords` | recommended | string[] | Search synonyms — alternate phrases users might say. |
| `connectorsUsed` | ✅ | string[] | Slugs of MCP servers this widget needs. The widget is hidden from tenants without those connectors. |
| `popularity` | recommended | number | Hint for the gallery sort. Start at `0`. |
| `sizing` | ✅ | `{ preferred, min, max }` | Each is `{ colSpan, rowSpan }`. |
| `dataProvider` | ✅ when spec uses `$state` | `{ mcp, tool, params }` | The MCP call that runs on mount. |
| `spec` | ✅ | `{ root, elements }` | The render tree (json-render schema). |

## `sizing`

```json
"sizing": {
  "preferred": { "colSpan": 5, "rowSpan": 4 },
  "min":       { "colSpan": 4, "rowSpan": 3 },
  "max":       { "colSpan": 10, "rowSpan": 8 }
}
```

The grid is 12 columns wide. Heights are uniform-row (each `rowSpan: 1` ≈ ~80px on desktop).

## `dataProvider`

```json
"dataProvider": {
  "mcp": "acme-billing",
  "tool": "list_invoices",
  "params": { "limit": 25, "status": "overdue" }
}
```

| Field | Notes |
|---|---|
| `mcp` | Server-id from `.mcp.json`'s `mcpServers` keys. |
| `tool` | Tool name as exposed by `tools/list`. |
| `params` | Object passed as the tool's input. Static values only — no `$state` here. |

The response is written to the state store at `/<mcp>/<tool>/...`.

## `spec`

```json
"spec": {
  "root": "card",
  "elements": {
    "card": { "type": "Card", "children": ["..."] },
    "...": { ... }
  }
}
```

| Field | Notes |
|---|---|
| `root` | Key into `elements`. The first thing the renderer mounts. |
| `elements` | Map of element id → element definition. Keys are arbitrary strings. |

Each element has shape:

```json
{
  "type": "<ComponentName>",
  "props": { ... },          // resolved from $state/$computed/$item/$prop/$template
  "children": ["<id>", ...], // child ids, looked up in spec.elements
  "watch": { ... }           // optional: state-change reactions
}
```

See [Spec primitives](/widgets/spec-primitives) for the binding tokens you can use inside `props` values.

## Validation

The marketplace validator does not deep-lint widget JSON — it only checks plugin-level structure. The strict widget linter lives in MyHub (`apps/web/src/features/widgets-system/lint.ts`) and runs at load time. Common rejections:

- `id` doesn't match filename.
- `spec.root` references an unknown element id.
- An element references a child id missing from `spec.elements`.
- `connectorsUsed` references a server-id not present in any plugin's `.mcp.json`.

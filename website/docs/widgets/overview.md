---
id: overview
title: Overview
sidebar_position: 1
---

# Widgets overview

A **widget** is a JSON file that declares two things:

1. **Where the data comes from** — usually an MCP tool call.
2. **How to render it** — a tree of components, props, and bindings.

The MyHub dashboard reads the JSON, calls the tool, drops the response into a reactive store, and renders the component tree. When the user clicks something or the data changes, the tree re-renders against the new state.

## Powered by Vercel json-render

Widgets are rendered by [Vercel's json-render](https://json-render.vercel.app/) library. It is the canonical implementation of the schema described in this section. Read its docs for the formal grammar; everything in this guide is a plugin-author-friendly view of the same primitives.

> **External reading:** [json-render docs](https://json-render.vercel.app/) · [json-render on GitHub](https://github.com/vercel-labs/json-render)

MyHub's `widgets-system` extends json-render with:

- A typed `dataProvider` block (which MCP tool, which params).
- A bridge to plugin-contributed `widget-elements` so `$computed` references can be resolved against your slug-namespaced helpers.
- A library of opinionated components (`Card`, `Header`, `Stat`, `Table`, `Badge`, …).

## Anatomy of a widget file

```json title="widgets/acme-overdue-invoices.json"
{
  "id": "acme-overdue-invoices",
  "title": "Overdue Invoices",
  "description": "All Acme invoices past their due date.",
  "category": "finance",
  "tags": ["acme", "invoices", "overdue"],
  "keywords": ["overdue", "late", "ar", "receivables"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 5, "rowSpan": 4 },
    "min":       { "colSpan": 4, "rowSpan": 3 },
    "max":       { "colSpan": 10, "rowSpan": 8 }
  },
  "dataProvider": {
    "mcp": "acme-billing",
    "tool": "list_invoices",
    "params": { "status": "overdue" }
  },
  "spec": {
    "root": "card",
    "elements": { /* … json-render tree … */ }
  }
}
```

| Field | Purpose |
|---|---|
| `id` | Stable id. Must match the filename. |
| `title`, `description` | Shown in the widget gallery and on the dashboard tile. |
| `category`, `tags`, `keywords` | Used for search and filtering in the gallery. |
| `connectorsUsed` | Slugs of MCP servers this widget needs. The widget is hidden if the tenant hasn't installed them. |
| `sizing` | `preferred` is what the agent drops on the dashboard; `min`/`max` bound the user's resize. |
| `dataProvider` | Which MCP tool runs on mount. Response lands at `/<mcp>/<tool>/…` in the state store. |
| `spec.root` | Key into `spec.elements` — the entry point of the render tree. |
| `spec.elements` | Map of element id → element definition. |

## Where widgets fit in MyHub

```
agent ──► proposes a widget id ──► MyHub loads widgets/<id>.json
                                         │
                                         ▼
                          dataProvider runs (MCP call)
                                         │
                                         ▼
                       json-render builds the component tree
                                         │
                                         ▼
                              tile appears on dashboard
```

The agent doesn't generate JSON on the fly — it picks from the catalog you ship. Generative widgets are a separate path (Anthropic Messages API, Haiku 4.5) and not covered here.

## Tutorial path

If you've never built a widget before, run the tutorials in order:

1. **[First widget](./tutorial-1-first-widget)** — a static stat card. ~15 min.
2. **[Live data](./tutorial-2-live-data)** — wire it to an MCP tool and render a Table. ~20 min.
3. **[Computed and transforms](./tutorial-3-computed-transforms)** — `$computed`, status tones, `$watch`. ~30 min.
4. **[Composite widget](./tutorial-4-composite-widget)** — multi-section layout with header + stats + table + footer. ~45 min.

Then dive into the [spec primitives](./spec-primitives) and the [components reference](./components-reference) for everything the tutorials skipped.

---
id: tutorial-1-first-widget
title: 'Tutorial 1 — Your first widget'
sidebar_label: '1. First widget'
sidebar_position: 2
---

# Tutorial 1 — Your first widget

**Goal:** ship a single-stat card that shows a hard-coded number. No data calls yet — just the JSON skeleton, the file location, the smallest legal `spec`.

**Time:** ~15 minutes.

**You'll learn:** the required top-level fields, where widgets live in your plugin, what the `spec` tree looks like, how to test in MyHub.

## 1. Pick a plugin home

We'll build inside the `acme-billing` plugin. Create the widgets folder if it doesn't exist:

```bash
mkdir -p plugins/acme-billing/widgets
```

## 2. Create the widget file

```json title="plugins/acme-billing/widgets/acme-hello.json"
{
  "id": "acme-hello",
  "title": "Hello, dashboard",
  "description": "A static stat card — the smallest legal widget.",
  "category": "demo",
  "tags": ["acme", "demo"],
  "keywords": ["hello", "first", "demo"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 3, "rowSpan": 2 },
    "min":       { "colSpan": 2, "rowSpan": 2 },
    "max":       { "colSpan": 4, "rowSpan": 3 }
  },
  "dataProvider": {
    "mcp": "acme-billing",
    "tool": "noop",
    "params": {}
  },
  "spec": {
    "root": "card",
    "elements": {
      "card": {
        "type": "Card",
        "children": ["stat"]
      },
      "stat": {
        "type": "Stat",
        "props": {
          "label": "Outstanding invoices",
          "value": 12,
          "delta": "+2 this week",
          "tone": "info"
        }
      }
    }
  }
}
```

## 3. What every part does

| Part | Why it's there |
|---|---|
| `id`, `title` | Identifies the widget in the gallery and on disk. **The `id` MUST match the filename.** |
| `connectorsUsed` | Tells MyHub to hide this widget unless the tenant has the `acme-billing` MCP server installed. |
| `sizing` | The agent uses `preferred` when it drops the widget on the dashboard; the user can resize within `min`/`max`. |
| `dataProvider` | Required even when you don't use the response. The `noop` tool here is a placeholder — we'll do real data in Tutorial 2. |
| `spec.root` | Points at the element that gets rendered first. |
| `spec.elements.card` | A `Card` is a container with `children` — referenced by id. |
| `spec.elements.stat` | A `Stat` is a single-value tile with a label, value, optional delta, and tone. |

:::tip
You can omit `dataProvider` entirely if your widget is fully static. It's required only when the spec uses `$state` to read from the data store.
:::

## 4. Validate

```bash
npx tsx scripts/validate.ts
```

The marketplace validator only checks plugin-level structure — it won't lint your widget JSON. The strict widget linter lives in MyHub (`apps/web/src/features/widgets-system/lint.ts`) and runs at load time. Common errors it catches:

- `id` doesn't match the filename.
- `spec.root` references an unknown element id.
- An element references a child id that isn't in `spec.elements`.

## 5. Test it in MyHub

```bash
# from the MyHub repo
npm run dev --workspace=apps/web

# in the chat: ask the agent to add the widget
"add the acme-hello widget to my dashboard"
```

You should see a card with `Outstanding invoices` and the value `12`.

## What you have now

A widget that:

- Is registered with the gallery (`title`, `description`, `tags`).
- Lives in your plugin and is gated by your MCP server (`connectorsUsed`).
- Renders a single component tree (`Card` containing a `Stat`).

## Next

→ [Tutorial 2 — Live data](./tutorial-2-live-data) — replace the hard-coded `12` with a number computed from a real MCP tool response.

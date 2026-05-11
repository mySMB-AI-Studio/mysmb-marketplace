---
id: tutorial-4-composite-widget
title: 'Tutorial 4 — Composite multi-section widget'
sidebar_label: '4. Composite widget'
sidebar_position: 5
---

# Tutorial 4 — Composite multi-section widget

**Goal:** assemble a polished, multi-section dashboard tile — header, stat row, table, footer — modelled on the real `xero-pnl-pulse` widget that ships in this marketplace.

**Time:** ~45 minutes.

**You'll learn:** layout primitives (`Header`, `StatGrid`, `Divider`), composing many `$computed` calls in one spec, the `$template` string interpolator, and "section thinking" — how to break a busy widget into legible chunks.

## The shape we're building

```
┌──────────────────────────────────────────────────┐
│  P&L Pulse                          May 2026     │  ← Header
├──────────────────────────────────────────────────┤
│   Revenue $52,300   Expenses $31,200   Net $21k  │  ← StatGrid
├──────────────────────────────────────────────────┤
│   Line item              Amount                  │  ← Table
│   Income — Sales         $48,200                 │
│   Income — Other          $4,100                 │
│   Expenses — Salaries    $19,300                 │
│   …                                              │
└──────────────────────────────────────────────────┘
```

Three clear sections, three different render strategies, all driven by one MCP call (`get_profit_and_loss`).

## 1. Helpers we'll need

In `widget-elements/src/index.ts`:

```ts
const flatten_report_rows: ComputedFunction = (args) => {
  // walks the nested Reports[0].Rows tree and returns flat rows
  // (the real implementation is in plugins/xero-accounting/widget-elements/src/index.ts)
};

const report_find_row: ComputedFunction = (args) => {
  // looks up a row by title and returns the value at column N
};
```

Both are real helpers from the `xero-accounting` plugin. They take a Xero P&L report tree and let the spec read it like a flat list.

## 2. The composite spec

```json title="plugins/acme-billing/widgets/acme-pnl-pulse.json"
{
  "id": "acme-pnl-pulse",
  "title": "P&L Pulse",
  "description": "Profit & loss pulse — revenue vs expenses at a glance.",
  "category": "finance",
  "tags": ["acme", "pnl", "profit", "loss", "report"],
  "keywords": ["pnl", "p&l", "profit", "loss", "income", "expenses"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 6, "rowSpan": 5 },
    "min":       { "colSpan": 5, "rowSpan": 4 },
    "max":       { "colSpan": 10, "rowSpan": 8 }
  },
  "dataProvider": {
    "mcp": "acme-billing",
    "tool": "get_profit_and_loss",
    "params": {}
  },
  "spec": {
    "root": "card",
    "elements": {
      "card": {
        "type": "Card",
        "children": ["header", "stats", "divider", "table"],
        "watch": {
          "/acme-billing/get_profit_and_loss": {
            "action": "setState",
            "params": {
              "statePath": "/ui/acme/pnl/rows",
              "value": {
                "$computed": "acme-billing_flatten_report_rows",
                "args": { "value": { "$state": "/acme-billing/get_profit_and_loss" } }
              }
            }
          }
        }
      },

      "header": {
        "type": "Header",
        "props": {
          "title": "P&L Pulse",
          "subtitle": {
            "$template": "As of {{month}}",
            "vars": { "month": { "$state": "/ui/acme/pnl/asOf" } }
          }
        }
      },

      "stats": {
        "type": "StatGrid",
        "props": {
          "columns": 3,
          "items": [
            {
              "label": "Revenue",
              "format": "currency",
              "value": {
                "$computed": "acme-billing_report_find_row",
                "args": { "value": { "$state": "/ui/acme/pnl/rows" }, "title": "Total Income", "cell": 1 }
              }
            },
            {
              "label": "Expenses",
              "format": "currency",
              "value": {
                "$computed": "acme-billing_report_find_row",
                "args": { "value": { "$state": "/ui/acme/pnl/rows" }, "title": "Total Expenses", "cell": 1 }
              }
            },
            {
              "label": "Net",
              "format": "currency",
              "tone": "success",
              "value": {
                "$computed": "acme-billing_report_find_row",
                "args": { "value": { "$state": "/ui/acme/pnl/rows" }, "title": "Net Profit", "cell": 1 }
              }
            }
          ]
        }
      },

      "divider": { "type": "Divider" },

      "table": {
        "type": "Table",
        "props": {
          "rows": { "$state": "/ui/acme/pnl/rows" },
          "compact": true,
          "columns": [
            { "key": "title", "label": "Line item" },
            { "key": "c1",    "label": "Amount", "format": "currency" }
          ]
        }
      }
    }
  }
}
```

## 3. Section thinking

The trick to a busy widget is to give every section **one job and one shape of input data.**

| Section | Reads | Renders |
|---|---|---|
| `header` | A scalar (the report period) | `Header` with a subtitle |
| `stats` | Three derived totals | `StatGrid` of 3 |
| `table` | The flattened row array | `Table` with 2 columns |

The `card`'s `watch` does the heavy lifting once — flattening the nested report tree into a clean array — then every section reads cheap derivations from it. **Don't repeat that flatten in every section.** That's why the watch lives at the card level.

## 4. The `$template` primitive

```json
{
  "$template": "As of {{month}}",
  "vars": { "month": { "$state": "/ui/acme/pnl/asOf" } }
}
```

Use `$template` whenever you want to interpolate state into a string. Avoid `+`-style string concatenation in `$computed`s — `$template` is cleaner and reactive.

## 5. Re-using vs. forking

If you find yourself building the *same composite shape* in two plugins (e.g. "header + 3 stats + table"), promote the layout into a **composite component** — the third kind of widget element. It lives in your plugin's `widget-elements/src/index.ts`:

```ts
const elements: PluginElementsModule = {
  slug: 'acme-billing',
  components: {
    PnlCard: {
      kind: 'composite',
      props: ['title', 'rowsPath'],
      spec: {
        root: 'card',
        elements: { /* the same card → header → stats → divider → table tree */ }
      }
    }
  }
};
```

Then in any widget:

```json
{ "type": "acme-billing/PnlCard", "props": { "title": "P&L", "rowsPath": "/ui/acme/pnl/rows" } }
```

Composite components are MyHub's plugin-level abstraction equivalent — they let you ship reusable layouts without polluting the system baseline. v1 is composite-only; non-composite components ship in MyHub itself.

## 6. Try it

```
"show me my profit and loss"
```

The agent should pick `acme-pnl-pulse`. The widget mounts, the card-level watch fires, all three sections read from `/ui/acme/pnl/rows` and render.

## What you have now

A widget that:

- Calls one MCP tool once.
- Pre-shapes the response with a card-level `watch`.
- Renders a multi-section layout where every section reads from cheap derived state.
- Could be promoted to a composite component if you reused the shape elsewhere.

This is the pattern every "real" widget in the catalog uses. Browse [`plugins/xero-accounting/widgets/`](https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/plugins/xero-accounting/widgets) for 22 production examples.

## Next

Now go deep:

- [Spec primitives](./spec-primitives) — every binding (`$state`, `$computed`, `$item`, `$prop`, `$template`, `watch`) in one place.
- [Components reference](./components-reference) — the system-level building blocks (`Card`, `Header`, `Stat`, `Table`, `Badge`, …).
- [json-render](./json-render) — what the underlying renderer does and where its docs live.

---
id: tutorial-2-live-data
title: 'Tutorial 2 — Live data from an MCP tool'
sidebar_label: '2. Live data'
sidebar_position: 3
---

# Tutorial 2 — Live data from an MCP tool

**Goal:** call an MCP tool, drop the response into the state store, render a `Table` of rows.

**Time:** ~20 minutes.

**You'll learn:** the `dataProvider` block, the `$state` binding, how to render a list with `Table`.

## Starting point

You have `acme-billing` with a `list_invoices` MCP tool that returns:

```json
[
  { "number": "INV-001", "customer": "Acme Co",   "total": 1250.00, "status": "OVERDUE", "dueDate": "2026-04-15" },
  { "number": "INV-002", "customer": "Beta LLC",  "total":  890.50, "status": "PAID",    "dueDate": "2026-05-01" },
  { "number": "INV-003", "customer": "Gamma Inc", "total": 2100.00, "status": "DRAFT",   "dueDate": "2026-06-10" }
]
```

## 1. Wire the data provider

```json
"dataProvider": {
  "mcp": "acme-billing",
  "tool": "list_invoices",
  "params": { "limit": 25 }
}
```

When the widget mounts, MyHub calls `acme-billing.list_invoices(limit: 25)` and writes the response into the state store at the path:

```
/acme-billing/list_invoices
```

Every key in the response also gets indexed there — e.g. if the response were an object `{ invoices: [...] }`, you'd read it from `/acme-billing/list_invoices/invoices`.

## 2. Read the data in your spec

The full file:

```json title="plugins/acme-billing/widgets/acme-invoices-table.json"
{
  "id": "acme-invoices-table",
  "title": "Recent invoices",
  "description": "All invoices, latest 25.",
  "category": "finance",
  "tags": ["acme", "invoices"],
  "keywords": ["invoices", "ar", "billing"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 6, "rowSpan": 5 },
    "min":       { "colSpan": 4, "rowSpan": 3 },
    "max":       { "colSpan": 12, "rowSpan": 8 }
  },
  "dataProvider": {
    "mcp": "acme-billing",
    "tool": "list_invoices",
    "params": { "limit": 25 }
  },
  "spec": {
    "root": "card",
    "elements": {
      "card": {
        "type": "Card",
        "children": ["header", "table"]
      },
      "header": {
        "type": "Header",
        "props": { "title": "Recent invoices" }
      },
      "table": {
        "type": "Table",
        "props": {
          "rows": { "$state": "/acme-billing/list_invoices" },
          "columns": [
            { "key": "number",   "label": "#" },
            { "key": "customer", "label": "Customer" },
            { "key": "total",    "label": "Total", "format": "currency" },
            { "key": "status",   "label": "Status" },
            { "key": "dueDate",  "label": "Due", "format": "date" }
          ]
        }
      }
    }
  }
}
```

## 3. Anatomy of the `$state` binding

```json
{ "$state": "/acme-billing/list_invoices" }
```

- The leading `/` is required.
- The path is `/<mcp>/<tool>` followed by any nested key.
- The renderer subscribes to the path. If the response refreshes (e.g. user hits "reload"), the table re-renders automatically.

## 4. What the `Table` does for you

The `Table` component:

- Iterates `rows` in order.
- For each row, renders one cell per `columns` entry.
- `column.key` is read from the row object.
- `column.format` applies a built-in formatter — `currency`, `date`, `number`, `percent`. Anything fancier needs `$computed` (Tutorial 3).

## 5. Try it

In the MyHub chat:

```
"show me recent acme invoices"
```

The agent should pick `acme-invoices-table` from the catalog (because of `tags`/`keywords`/`description`), drop it on the dashboard, and the table populates as soon as `list_invoices` returns.

## Common gotchas

| Symptom | Probable cause |
|---|---|
| Empty table, no error | `dataProvider.tool` name doesn't match what the MCP server exposes. |
| `cannot read property of undefined` in console | Your `$state` path points to a key that doesn't exist on the response. Add a `console.log` in your MCP server to confirm the actual shape. |
| Widget hidden from gallery | Tenant hasn't installed the `acme-billing` plugin — `connectorsUsed` gates visibility. |

## Next

→ [Tutorial 3 — Computed and transforms](./tutorial-3-computed-transforms) — add status colours, derived columns, and a reactive `$watch`.

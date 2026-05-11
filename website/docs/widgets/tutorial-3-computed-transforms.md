---
id: tutorial-3-computed-transforms
title: 'Tutorial 3 — Computed values and reactive transforms'
sidebar_label: '3. Computed & transforms'
sidebar_position: 4
---

# Tutorial 3 — Computed values and reactive transforms

**Goal:** turn raw API data into the shape your UI actually needs — derived columns, status colours, and a reactive `$watch` that runs a transform whenever data changes.

**Time:** ~30 minutes.

**You'll learn:** `$computed`, `$item`, the `format`/`tone` props on `Table` columns, and the `watch` hook that lets you precompute derived state when the source data changes.

## The problem

Tutorial 2's table renders raw fields. Real dashboards need:

- "Days overdue" derived from `dueDate`.
- A coloured `Status` badge — green for PAID, red for OVERDUE.
- A "Total outstanding" stat in the header that sums only the OVERDUE rows.

We'll add all three.

## 1. Add the helpers to `widget-elements`

```ts title="widget-elements/src/index.ts"
import type { ComputedFunction, PluginElementsModule } from './types';

const days_overdue: ComputedFunction = (args) => {
  const ms = Date.parse(String(args.value ?? ''));
  if (!Number.isFinite(ms)) return 0;
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.now() - ms) / day);
};

const status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'PAID')    return 'success';
  if (s === 'OVERDUE') return 'destructive';
  if (s === 'DRAFT')   return 'muted';
  if (s === 'SENT')    return 'info';
  return 'default';
};

const sum_overdue: ComputedFunction = (args) => {
  const rows = Array.isArray(args.value) ? args.value : [];
  return rows
    .filter((r: any) => String(r?.status).toUpperCase() === 'OVERDUE')
    .reduce((acc: number, r: any) => acc + (Number(r?.total) || 0), 0);
};

const elements: PluginElementsModule = {
  slug: 'acme-billing',
  functions: { days_overdue, status_tone, sum_overdue },
};

export default elements;
```

Build and commit:

```bash
cd plugins/acme-billing/widget-elements
npm run build
git add dist/
```

The host will register these as `acme-billing_days_overdue`, `acme-billing_status_tone`, `acme-billing_sum_overdue`.

## 2. Use them in the spec

```json title="plugins/acme-billing/widgets/acme-invoices-table.json"
{
  "id": "acme-invoices-table",
  "title": "Recent invoices",
  "description": "All invoices, latest 25 — with overdue total and status tones.",
  "category": "finance",
  "tags": ["acme", "invoices", "overdue"],
  "keywords": ["invoices", "ar", "billing", "overdue"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 7, "rowSpan": 5 },
    "min":       { "colSpan": 5, "rowSpan": 4 },
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
        "children": ["header", "stat", "table"],
        "watch": {
          "/acme-billing/list_invoices": {
            "action": "setState",
            "params": {
              "statePath": "/ui/acme/overdueTotal",
              "value": {
                "$computed": "acme-billing_sum_overdue",
                "args": { "value": { "$state": "/acme-billing/list_invoices" } }
              }
            }
          }
        }
      },
      "header": {
        "type": "Header",
        "props": { "title": "Recent invoices" }
      },
      "stat": {
        "type": "Stat",
        "props": {
          "label": "Outstanding (overdue)",
          "value": { "$state": "/ui/acme/overdueTotal" },
          "format": "currency",
          "tone": "destructive"
        }
      },
      "table": {
        "type": "Table",
        "props": {
          "rows": { "$state": "/acme-billing/list_invoices" },
          "columns": [
            { "key": "number",   "label": "#" },
            { "key": "customer", "label": "Customer" },
            { "key": "total",    "label": "Total", "format": "currency" },
            {
              "key": "daysOverdue",
              "label": "Days late",
              "value": {
                "$computed": "acme-billing_days_overdue",
                "args": { "value": { "$item": "dueDate" } }
              }
            },
            {
              "key": "status",
              "label": "Status",
              "tone": {
                "$computed": "acme-billing_status_tone",
                "args": { "value": { "$item": "status" } }
              }
            },
            { "key": "dueDate", "label": "Due", "format": "date" }
          ]
        }
      }
    }
  }
}
```

## 3. What changed, line by line

### `$item` inside `Table` columns

Inside a row iteration (the `rows` of a `Table`), the special token `$item` refers to the current row.

```json
{ "$item": "dueDate" }   // == row.dueDate
```

This is how the `daysOverdue` column reads each row's `dueDate` and feeds it into `acme-billing_days_overdue`.

### `tone` on a column

`Table` columns accept three "presentation" props beyond `key`:

- `format` — built-in formatter (`currency`, `date`, etc.).
- `value` — override the rendered value (use `$computed`).
- `tone` — semantic colour (`success`, `info`, `warning`, `destructive`, `muted`, `default`). The cell will be styled accordingly.

### The `watch` hook

```json
"watch": {
  "/acme-billing/list_invoices": {
    "action": "setState",
    "params": {
      "statePath": "/ui/acme/overdueTotal",
      "value": { "$computed": "acme-billing_sum_overdue", "args": { … } }
    }
  }
}
```

`watch` lives on an element and registers reactions: *when this state path changes, run this action*. Here we:

1. Watch `/acme-billing/list_invoices` (the table data).
2. When it changes, run `setState` to write a derived total at `/ui/acme/overdueTotal`.
3. The `Stat` component reads `/ui/acme/overdueTotal` and re-renders.

This pattern — store derived UI state under `/ui/<plugin>/...` so it's clearly separated from MCP response data — is the convention used by every plugin in this marketplace.

:::tip
Watches give you a one-pass derivation. For derivations that fit cleanly in a row (like `daysOverdue` per row), put `$computed` directly in the column. Reach for `watch` when you need to aggregate across rows or coordinate state between elements.
:::

## 4. Try it

```
"show me my acme invoices"
```

You should now see:

- A card header.
- A red "Outstanding (overdue)" stat showing the sum of OVERDUE rows' totals.
- A table where the Status column is coloured per row and a Days late column is computed from the due date.

## Next

→ [Tutorial 4 — Composite widget](./tutorial-4-composite-widget) — assemble a multi-section dashboard tile that combines stats, a chart row, and a footer.

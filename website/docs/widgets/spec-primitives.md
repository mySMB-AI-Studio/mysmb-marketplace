---
id: spec-primitives
title: Spec primitives
sidebar_position: 6
---

# Spec primitives

These are the binding tokens you can use anywhere a widget JSON value is expected. The renderer (json-render + the MyHub widgets-system layer) recognises each one as a special object shape and resolves it at render time.

## `$state` — read from the data store

```json
{ "$state": "/acme-billing/list_invoices" }
```

- The leading `/` is required.
- Path is `/<mcp>/<tool>/...` for MCP responses, `/ui/...` for derived UI state you wrote yourself.
- The renderer subscribes — when the path changes, the host re-renders the dependent element.

## `$computed` — call a widget-element function

```json
{
  "$computed": "acme-billing_status_tone",
  "args": { "value": "PAID" }
}
```

- Plugin functions are namespaced as `<slug>_<snake_name>`.
- System functions are bare names: `format_currency`, `truncate_text`, etc.
- `args` is an object. Argument values can themselves be `$state` / `$computed` / `$item` references — they're resolved before the function is called.

## `$item` — current row inside a list

```json
{ "$item": "dueDate" }
```

- Available **only** inside an iterating element (`Table.rows`, `List.items`).
- Refers to the current iteration's object. `$item.dueDate` shorthand is `{ "$item": "dueDate" }`.

## `$prop` — read from this element's `props`

```json
{ "$prop": "rowsPath" }
```

- Used inside composite components to wire props into the inner spec.
- Dot-paths supported: `{ "$prop": "user.email" }`.

## `$template` — string interpolation

```json
{
  "$template": "Hello, {{name}} — {{count}} unread",
  "vars": {
    "name":  { "$state": "/ui/user/name" },
    "count": { "$state": "/ui/inbox/unread" }
  }
}
```

- Use whenever you want to mix state into a string. Cleaner and more reactive than concatenating in `$computed`.
- `vars` values can be any other primitive.

## `watch` — react to state changes

`watch` is not a value primitive — it's an element-level hook. It registers reactions that fire when a state path changes.

```json
{
  "type": "Card",
  "children": ["…"],
  "watch": {
    "/acme-billing/list_invoices": {
      "action": "setState",
      "params": {
        "statePath": "/ui/acme/overdueTotal",
        "value": { "$computed": "acme-billing_sum_overdue", "args": { "value": { "$state": "/acme-billing/list_invoices" } } }
      }
    }
  }
}
```

Use `watch` when:

- A derivation needs to span multiple rows or aggregate.
- Multiple sections need to read the same derived value.
- You want to fire a side-effect (`navigate`, `toast`, plugin action) on data change.

## `actions` — explicit user-triggered actions

Buttons / clickable rows can declare an action:

```json
{
  "type": "Button",
  "props": {
    "label": "Mark paid",
    "action": {
      "tool": "acme-billing.mark_paid",
      "params": { "invoiceId": { "$item": "id" } }
    }
  }
}
```

The host knows about `tool` actions (call an MCP tool), `setState` (write to the store), `navigate` (route), `toast` (notification), and any plugin-contributed actions named `<slug>_<snake_name>`.

## Resolution order at render time

For each element the renderer:

1. Resolves `props` — recursively replacing every `$state` / `$computed` / `$item` / `$prop` / `$template` token.
2. Renders the component.
3. Iterates `children` (resolving each child by id from `spec.elements`).
4. Subscribes to every `$state` path it touched and to every key in `watch`.

When any subscribed state changes, the affected element re-renders.

## See also

- [Vercel json-render docs](https://json-render.vercel.app/) — the underlying schema.
- [Components reference](./components-reference) — what props each component accepts.
- [Tutorials 2 & 3](./tutorial-2-live-data) — every primitive in action.

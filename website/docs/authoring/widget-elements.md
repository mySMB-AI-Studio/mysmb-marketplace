---
id: widget-elements
title: Widget elements
sidebar_position: 5
---

# Widget elements

Widget elements are JS helpers that widget JSON specs reference at render time. There are three kinds:

| Kind | Use for | Spec reference |
|---|---|---|
| `functions` | Pure `$computed` helpers (format dates, derive tones, flatten trees) | `<slug>_<snake_name>` |
| `components` | Composite components built from system primitives | `<slug>/<PascalName>` |
| `actions` | Side-effectful operations (rare in v1) | `<slug>_<snake_name>` |

## When to put a helper here vs. in the system baseline

- **System baseline** (`apps/web/src/features/widgets-system/system/` in MyHub): connector-agnostic. Anyone could use it. Example: `format_currency`, `truncate_text`.
- **Plugin widget-elements**: only makes sense for *this* connector's payload shape. Example: `xero_format_date` (handles Xero's `/Date(…)/` format), `acme_invoice_status_tone`.

If you'd write the same helper for any connector, it doesn't belong here — push it to the system baseline.

## Layout

```
widget-elements/
├── package.json
├── tsconfig.json
└── src/
    ├── types.ts      ← local mirror of the host's contract
    └── index.ts      ← default export: PluginElementsModule
```

## Files

```ts title="widget-elements/src/types.ts"
export type ComputedFunction = (args: Record<string, unknown>) => unknown;

export interface CompositeComponentDef {
  kind: 'composite';
  spec: { root: string; elements: Record<string, unknown> };
  props?: string[];
}

export interface PluginWidgetAction {
  description: string;
  schema: unknown;
  handler: (params: Record<string, unknown>) => Promise<void> | void;
}

export interface PluginElementsModule {
  slug: string;
  components?: Record<string, CompositeComponentDef>;
  functions?: Record<string, ComputedFunction>;
  actions?: Record<string, PluginWidgetAction>;
}
```

```ts title="widget-elements/src/index.ts"
import type { ComputedFunction, PluginElementsModule } from './types';

const invoice_status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'PAID')    return 'success';
  if (s === 'OVERDUE') return 'destructive';
  if (s === 'DRAFT')   return 'muted';
  if (s === 'SENT')    return 'info';
  return 'default';
};

const days_overdue: ComputedFunction = (args) => {
  const ms = Date.parse(String(args.value ?? ''));
  if (!Number.isFinite(ms)) return 0;
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.now() - ms) / day);
};

const elements: PluginElementsModule = {
  slug: 'acme-billing',
  functions: { invoice_status_tone, days_overdue },
};

export default elements;
```

```json title="widget-elements/package.json"
{
  "name": "@mysmb/acme-billing-widget-elements",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "devDependencies": { "typescript": "^5.4.0" }
}
```

## Build and commit

```bash
cd plugins/acme-billing/widget-elements
npm install
npm run build
git add dist/
```

The host loads `dist/index.js` directly. **Commit the `dist/` folder** — no install at runtime.

## Namespacing at the spec level

The host prepends the plugin slug to every name, so spec authors write:

```json
{ "$computed": "acme-billing_invoice_status_tone", "args": { "value": "PAID" } }
```

…not `invoice_status_tone`.

## Up next

→ [Validate and ship](./validate-and-ship)

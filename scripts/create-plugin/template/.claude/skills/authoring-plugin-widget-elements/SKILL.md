---
name: authoring-plugin-widget-elements
description: Standards for contributing widget-elements (functions, actions, composite components) to a marketplace plugin. Use when adding to or modifying a plugin's widget-elements/ directory, or when deciding how to package a connector-specific helper. Covers stack constraints, naming, schema requirements, and the v1 composite-only restriction.
---

# Authoring Plugin Widget-Elements

This skill defines the standards every plugin author follows when shipping widget-elements. The marketplace validator at `mySMB-Plugin-Marketplace/Plugins/scripts/validate.ts` enforces most rules mechanically — this skill explains the *why* and the parts the validator can't check.

For deciding **whether** something belongs in a plugin or in the system, see `.claude/skills/composing-widgets/SKILL.md` (agnosticism heuristic). This skill assumes you've already decided "plugin."

## Plugin layout

```
plugins/<slug>/
├── .claude-plugin/
│   └── plugin.json            # declares widgetElements + widgets paths
├── widget-elements/
│   ├── src/
│   │   ├── index.ts           # default-exports a PluginElementsModule
│   │   └── types.ts           # local copy of the contract types
│   ├── dist/
│   │   └── index.js           # compiled, COMMITTED
│   ├── package.json
│   └── tsconfig.json
└── widgets/
    └── *.json                 # at least one example widget using the elements
```

Pre-compiled `dist/index.js` is committed per marketplace policy — plugins ship pre-built artifacts so consumers don't need a build step. The reference implementation is the Xero plugin: `mySMB-Plugin-Marketplace/Plugins/plugins/xero-accounting/widget-elements/`.

## The contract

`widget-elements/src/index.ts` default-exports a `PluginElementsModule`:

```ts
import type { ComputedFunction } from '@json-render/core';

export interface CompositeComponentDef {
  kind: 'composite';
  spec: { root: string; elements: Record<string, unknown> };
  props?: string[];                       // documentation only; substitution is driven by `{ "$prop": "<key>" }` in spec
}

export interface PluginWidgetAction {
  description: string;
  schema: unknown;                        // typically Zod, loose at the plugin boundary
  handler: (params: Record<string, unknown>) => Promise<void> | void;
}

export interface PluginElementsModule {
  slug: string;                           // must match plugin name
  components?: Record<string, CompositeComponentDef>;
  functions?: Record<string, ComputedFunction>;
  actions?: Record<string, PluginWidgetAction>;
}
```

These types are also re-exported from `@myhub/widget-tokens` — depend on it where possible. If your build can't resolve the host workspace, copy the interfaces verbatim into a local `types.ts` and import from `./types`.

## Stack constraints — non-negotiable

The marketplace validator enforces an import allowlist. Everything in your `widget-elements/dist/index.js` (the file the validator scans) must import from this set:

- `react`
- `lucide-react`
- `zod`
- `@json-render/core`
- `@json-render/react`
- `@myhub/widget-tokens`
- Relative imports inside the same plugin (`./util`, `../helpers`)

Disallowed:
- Anything from the host app (`@/lib/...`, `@myhub/web`, `@myhub/shared`).
- State libraries (Zustand, React Query) — read/write through json-render's `useStateStore`.
- HTTP libraries — call MCP tools, never `fetch` inside a widget-element.
- Native modules / binaries.
- `eval`, `new Function`, `dangerouslySetInnerHTML`.

## Naming + namespacing

| Element type | In-module name | Runtime key (after merge) |
|---|---|---|
| Component | `PascalCase` (e.g. `StatCard`) | `<slug>/<PascalCase>` |
| Function | `snake_case` (e.g. `format_phone`) | `<slug>_<snake_case>` |
| Action | `snake_case` (e.g. `open_in_external`) | `<slug>_<snake_case>` |

Use bare names inside the module; the merger prepends the slug. Do **not** pre-prefix.

Slug must match `^[a-z][a-z0-9-]*$` — anything else is rejected at runtime with a `console.warn`.

## Mandatory deliverables

**Every function:**
- JSDoc with one-line description, `Args:` documenting each parameter, and a one-line spec example.
- Pure — no async, no I/O, no timers, no DOM.

**Every action:**
- JSDoc as above.
- `schema:` field (typically a Zod object). The validator checks for the field's presence; format the action object on multiple lines so the regex finds it.
- Browser-side handler. No Node APIs.

**Every composite component (v1):**
- JSON sub-spec — NOT TSX. Code-defined React components are not accepted in v1.
- Reference props via `{ "$prop": "<key>" }` markers inside the sub-spec. See `apps/web/src/features/widgets-system/plugin-elements/composite.ts` for the substitution semantics.
- Composites can only compose **system primitives**. No nested composites, no plugin-tool actions, no other plugin's components.

**Every plugin shipping `widgetElements`:**
- At least one `widgets/<name>.json` that exercises a contributed element. The validator rejects `widgetElements` declarations without a populated `widgets/` directory.

## Styling

Components use only the design tokens exported from `@myhub/widget-tokens`:
- `TONE_BG_SOFT`, `TONE_BG_SOLID`, `TONE_BORDER`, `TONE_TEXT` — color.
- `TEXT_SIZE`, `GAP_SIZE`, `ICON_SIZE` — size.
- `FONT_WEIGHT` — weight.

Forbidden: raw hex, arbitrary Tailwind color classes (`bg-red-500`, `text-[#abc]`), inline `style={{ color }}`. The system maintains visual coherence by funneling color/spacing decisions through the token table — overrides break that.

## Build + ship

1. Author `widget-elements/src/index.ts` (and `types.ts` if needed).
2. From the plugin's `widget-elements/` directory: `npm install && npm run build`. Compile produces `dist/index.js`.
3. **Commit `dist/index.js`** alongside the source.
4. Update `.claude-plugin/plugin.json`:
   ```json
   {
     "widgetElements": "widget-elements/dist/index.js",
     "widgets": "widgets"
   }
   ```
5. Place at least one example widget at `widgets/<name>.json`.
6. From the marketplace repo root: `npx tsx scripts/validate.ts` — must report `validate: OK`.

## Worked example — `acme_format_phone`

Goal: contribute a phone-number formatter to a hypothetical `acme` plugin.

`plugins/acme/widget-elements/src/index.ts`:

```ts
import type { ComputedFunction } from '@json-render/core';
import type { PluginElementsModule } from './types';

/**
 * Format a 10-digit phone number as (XXX) XXX-XXXX.
 * Returns the input unchanged if it doesn't have 10 digits.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "acme_format_phone", "args": { "value": { "$item": "phone" } } }
 */
const format_phone: ComputedFunction = (args) => {
  const raw = String(args.value ?? '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const elements: PluginElementsModule = {
  slug: 'acme',
  functions: { format_phone },
};
export default elements;
```

`plugins/acme/.claude-plugin/plugin.json` adds:

```json
{
  "widgetElements": "widget-elements/dist/index.js",
  "widgets": "widgets"
}
```

`plugins/acme/widgets/contact-card.json`:

```json
{
  "title": "Contact",
  "dataProvider": { "mcp": "acme", "tool": "get_contact", "params": {} },
  "spec": {
    "root": "card",
    "elements": {
      "card": { "type": "Card", "props": {}, "children": ["row"] },
      "row":  {
        "type": "Stat",
        "props": {
          "label": "Phone",
          "value": {
            "$computed": "acme_format_phone",
            "args": { "value": { "$state": "/acme/get_contact/phone" } }
          }
        }
      }
    }
  }
}
```

Build, commit, validate.

## Troubleshooting

- **Validator says my import isn't allowlisted.** Check the list above. Pure JS/TS, no host-app reach-ins.
- **Validator says my action has no `schema`.** The regex looks for `schema:` inside an object that contains `handler:`. Spread the action across multiple lines so the regex finds the field.
- **My composite component renders nothing.** Composites can only compose system primitives in v1. Nested composites and plugin tools aren't supported. Read `apps/web/src/features/widgets-system/plugin-elements/composite.ts`.
- **My module loads but functions don't appear.** Check the `slug` — it must match the plugin name exactly and pass `^[a-z][a-z0-9-]*$`. Also confirm `default export` (not named export).
- **Cell formatters (`Table` column `format`/`tone` resolvers).** Plugins **cannot** contribute these in v1 — they live in the system bag only. Defer to the system or open an issue.

---

*The marketplace validator is the gate. This skill explains the why. Both must agree before a contribution merges.*

*Last updated: April 2026*

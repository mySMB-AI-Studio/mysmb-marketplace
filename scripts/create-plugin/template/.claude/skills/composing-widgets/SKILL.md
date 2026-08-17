---
name: composing-widgets
description: Teaches how to compose widgets from system + plugin widget-elements. Use when building a new widget, modifying an existing one, or deciding whether a new helper should live in the system baseline or a plugin. Covers spec shape, $state/$template/$computed/$item/$prop bindings, and the agnosticism heuristic.
---

# Composing Widgets

## Workflow

1. Read the system catalog: `.claude/skills/widget-elements-system/SKILL.md`. Most needs are already covered.
2. Pick the data source — usually an MCP tool from a connected plugin (e.g. `xero-accounting.list_invoices`).
3. Sketch the spec: a `root` element id, an `elements` map, optionally a `dataProvider` that fires the MCP tool on mount.
4. Bind values with `$state`, `$template`, `$computed`, `$item`, `$prop`.
5. If you need a transform that doesn't exist, apply the **agnosticism heuristic** below before writing it.

## The widget JSON shape

```json
{
  "title": "Invoices today",
  "dataProvider": {
    "mcp": "xero-accounting",
    "tool": "list_invoices",
    "params": { "where": "Status==\"AUTHORISED\"" }
  },
  "spec": {
    "root": "card",
    "elements": {
      "card":  { "type": "Card", "props": {}, "children": ["body"] },
      "body":  { "type": "Body", "props": {}, "children": ["stat"] },
      "stat":  {
        "type": "Stat",
        "props": {
          "label": "Authorised",
          "value": {
            "$computed": "count",
            "args": { "value": { "$state": "/xero-accounting/list_invoices/Invoices" } }
          }
        }
      }
    }
  }
}
```

Container elements (`Card`, `Body`, `Stack`, `Section`, `Row`, `Grid`) need an empty `props: {}` even when you don't pass anything — the renderer reads from `props` unconditionally.

## Bindings

- `$state` — read from the per-widget StateStore. Tool results land at `/<mcp>/<tool>/<key>`. Example: `{ "$state": "/xero-accounting/list_invoices/Invoices" }`.
- `$template` — interpolate state paths into a string. Example: `{ "$template": "${/xero-accounting/list_invoices/Total} authorised" }`.
- `$computed` — call a registered helper. Example: `{ "$computed": "format_currency", "args": { "value": { "$state": "/.../Total" } } }`.
- `$item` — inside a `repeat`, reads a field from the current row. Example: `{ "$item": "InvoiceNumber" }`.
- `$prop` — composite-component-only. Substitutes a prop into the sub-spec at render time. See `apps/web/src/features/widgets-system/plugin-elements/composite.ts`.

## Agnosticism heuristic — system vs plugin

Decide where a new helper goes BEFORE writing it.

| Question | If yes | If no |
|---|---|---|
| Does it reference a connector's data shape (Xero `/Date(...)/`, Xero status enum, Graph `nextLink`)? | **Plugin element** — namespace `<slug>_<name>`. | Continue. |
| Is it a generic transform (`sum`, `count`, `top_n`, `format_currency`, `format_date`)? | **System element** — bare name. | Continue. |
| Does it touch only the browser/DOM (download blob, clipboard, open URL)? | **System action**. | Continue. |
| Does it render a primitive UI shape (Card, Stat, Table, Badge)? | **System component**. | **Plugin component** — must be a JSON composite in v1. |

Tie-breaker: if two connectors might use it, system. If only one will ever use it, plugin.

## Where things live

- System catalog (auto-generated) — `.claude/skills/widget-elements-system/SKILL.md`
- System source — `apps/web/src/features/widgets-system/system/`
- Plugin authoring rules — `.claude/skills/authoring-plugin-widget-elements/SKILL.md`
- Plugin contributions — `mySMB-Plugin-Marketplace/Plugins/plugins/<slug>/widget-elements/`
- Widget JSON specs — `widgets/*.json` (platform default catalog)

## Worked example — "Invoices authorised today"

Need: a Stat showing how many Xero invoices are authorised.

1. Tool: `xero-accounting.list_invoices` returns `{ Invoices: [...] }` at `/xero-accounting/list_invoices/Invoices`.
2. Spec: a `Card` containing a `Stat`.
3. Count via the system `count` helper:

```json
{
  "title": "Invoices authorised today",
  "dataProvider": {
    "mcp": "xero-accounting",
    "tool": "list_invoices",
    "params": { "where": "Status==\"AUTHORISED\"" }
  },
  "spec": {
    "root": "card",
    "elements": {
      "card": { "type": "Card", "props": {}, "children": ["stat"] },
      "stat": {
        "type": "Stat",
        "props": {
          "label": "Authorised",
          "value": {
            "$computed": "count",
            "args": { "value": { "$state": "/xero-accounting/list_invoices/Invoices" } }
          }
        }
      }
    }
  }
}
```

The `dataProvider` fires once on mount; bindings light up when the tool result hits the store.

## Tile typography & consistent rows

Tiles follow **`docs/design/WIDGET-STYLE-GUIDE.md`** (flat, dense; max font-weight 500; min 10px; 0.5px borders; fixed tile anatomy) — read it before composing a tile.

**Tiles also follow `TILE-DISPLAY-STANDARDS.md` (in `mysmb-marketplace`, repo root)** — canonical date/currency/status-casing/header/spacing/color-tone conventions across every connector, added 2026-08-05 after an audit found widgets disagreeing with each other (and sometimes themselves) on all of these. Check any new or edited widget against it: dates default to `dd-Mmm-yy` (e.g. `05-Aug-26` — a new `format_date` option not yet implemented, see the doc's platform-gap note) or `relative_time` for activity feeds, never mixed within one widget; currency is always `A$x,xxx.xx` (explicit `currency` arg, 2dp, never the silent AUD default); status badges are Title Case via a `<connector>_<field>_label` helper (never a raw enum) — matches WorkQ's own `status_label`/`priority_label`; headers are Title Case with one fixed term per concept ("Customer", not "Client"/"Account"/"Company"); `gap` is only ever `xs`/`sm`/`md`/`lg` (`"xxs"` silently renders as zero gap — don't use it); status tones follow WorkQ's own Priority-column model (destructive/warning/muted, "success" = done/paid only); decorative (non-status) color is mint `#34DFBA` (matches mySMB.com's public site, not the in-app `--brand` blurple) — never a borrowed status tone like `accent`/`info`; and a tile's `Eyebrow` (the small text directly below its `Heading`) uses sentence case per `·`-segment — capitalize only each segment's first word, a brand/product name keeps its own natural capitalization anywhere (`Stripe`, `NetSuite ERP`), never Title Case throughout or ALL CAPS.

**For any list / feed / inbox / notification row, ALWAYS use `ActivityItem` (or `ListItem`).** They render title (13px/500), subtitle/preview (**11px**), and timestamp (10px) at FIXED sizes, so preview text is identical across every tile. `ActivityItem` takes a leading `status` dot (`unread`/`read`/`high`/`medium`) + avatar/icon + timestamp — the full email/inbox row in one block.

**Never hand-roll these rows from `Row` + `Text`.** Generic `Text` takes an author-chosen `size` (xs 11 / sm 13 / md 14 / lg 16), so two tiles drift to different preview sizes — the exact inconsistency this rule prevents. If you truly need standalone secondary text, use `Caption` (fixed 11px) or `Text size="xs"` — never `sm`/`md`/`lg` for preview/metadata text.

## Common gotchas

- Header and data columns drifting out of alignment on a multi-column tile → you hand-rolled a table from `Row`+`template`+`repeat`; use the system `Table` component instead. A hand-rolled header row and each data row are separate CSS Grid containers, so `auto`-width columns can compute different widths independently even though each row looks fine alone. `Table` shares one width state across header and rows, so alignment can't drift. Caveat: `Table`'s `format`/`toneFormat` cell formatters only see that column's own value — if a cell's display depends on a *different* field on the same row (e.g. `amount` formatted using that row's own `currency` field), pre-compute the display string before handing rows to `Table`.
- Forgetting `props: {}` on container elements — `resolveBindings` calls `Object.entries(element.props)` and crashes.
- Inside a `repeat`, `$item` reads the current row; `$state` still reads absolute paths. Don't mix them up.
- Post-Xero-migration, `xero_*` `$computed` names became `xero-accounting_*`. Cell formatters (`xero_status`, `xero_date`, `xero_date_short`) stayed in system unchanged.
- Cell formatters are scoped to `Table` columns (`format: "currency"`, `tone: "xero_status"`). Don't reach for them outside Table.

## When to extend the system

If you author the same helper across two plugins, it belongs in the system. Steps:
1. Add to `apps/web/src/features/widgets-system/system/functions.ts` (or `actions.ts`/`components.tsx`).
2. Run `npm run sync:widget-skills` to regenerate the catalog skill.
3. Update any plugin that previously shipped a duplicate.

System additions are global — treat them like a public API. When in doubt, ask before adding.

*Last updated: April 2026*

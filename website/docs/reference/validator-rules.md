---
id: validator-rules
title: Validator rules
sidebar_position: 4
---

# Validator rules

The marketplace validator (`scripts/validate.ts`) runs in CI on every PR and locally with:

```bash
npx tsx scripts/validate.ts
```

It hard-fails the PR if any rule is violated.

## Manifest & required files

| # | Rule | How to satisfy |
|---|---|---|
| 1 | `.claude-plugin/marketplace.json` exists and parses as valid JSON, with a non-empty `plugins` array. | Don't commit a syntax error or an empty manifest. |
| 2 | Every plugin entry has a recognised `source` (`"./plugins/<name>"` shorthand or the `{ path }` / `{ source }` object form). | Use the `"./plugins/<name>"` shorthand. |
| 3 | Every plugin in `marketplace.json` has a matching directory under `plugins/`. | Match `name` to the directory name. |
| 4 | Every plugin directory has `.claude-plugin/plugin.json`, `.mcp.json`, and `README.md`. | Don't delete required files. |
| 5 | `plugin.json`'s `name` matches the `marketplace.json` entry name. | Keep the two in sync. |

## MCP server & credentials

| # | Rule | How to satisfy |
|---|---|---|
| 6 | `.mcp.json` has an `mcpServers` object. | Declare at least one server. |
| 7 | Every MCP server declares `type` as `"stdio"`, `"sse"`, or `"http"`. | Use one of the recognised transports. |
| 8 | Every `${VAR}` placeholder in `.mcp.json` (env **or** headers) is either `CLAUDE_PLUGIN_ROOT` (reserved) or appears under a `## Configuration` heading in the README. | Add a row for each variable to your README. |

## `connection` block

These run when `plugin.json` includes a [`connection`](./plugin-json#the-connection-block) object.

| # | Rule | How to satisfy |
|---|---|---|
| 9  | `connection` is an object with `authType` ∈ `oauth` \| `api_key` \| `none`. | Pick a valid auth type. |
| 10 | `docUrl` / `instructions`, if present, are strings. | Use strings. |
| 11 | `authType: "api_key"` requires a non-empty `fields` array. | List each credential field. |
| 12 | Each field has an `UPPER_SNAKE_CASE` `name` and a non-empty `label`; `type`, if set, is `"password"` or `"text"`. | Follow the field schema. |
| 13 | Each field `name` appears as a `${NAME}` placeholder in `.mcp.json` **and** is documented under `## Configuration` in the README. | Wire and document every field. |

## Widgets & widget-elements

These run when `plugin.json` (or the manifest entry) declares `widgets` / `widgetElements`.

| # | Rule | How to satisfy |
|---|---|---|
| 14 | If you declare `widgetElements`, you must also declare `widgets`. | Ship at least one example widget alongside your elements. |
| 15 | The `widgetElements` file exists. | Build and **commit** `widget-elements/dist/index.js`. |
| 16 | The `widgets` directory exists and contains at least one `*.json` file. | Add at least one widget spec. |
| 17 | The compiled `widgetElements` module only imports from the allowlist: `react`, `lucide-react`, `zod`, `@json-render/core`, `@json-render/react`, `@myhub/widget-tokens` (plus relative imports). | Don't pull in arbitrary npm packages. |
| 18 | Every widget-element `action` (an object with a `handler`) also declares a `schema`. | Give each action a schema. |

## Convention rules (reviewed in PR, not enforced)

These are not blocked by the validator but will be flagged in code review:

- **Pure Node only** — no native modules, no platform-specific code, no `node-gyp`.
- **No hardcoded credentials** anywhere — all secrets via env vars / headers.
- **No interactive prompts** at runtime, no OS keyring access.
- **Custom servers ship `dist/`** — runtime install cost must be zero.
- **Slug-prefix all names** — skills, agents, widget elements, widgets must be slug-prefixed to avoid collisions across plugins.
- **`displayName`, `category`, `tags`** in `marketplace.json` — gives the catalog a usable card.

## Future rules under consideration

- Lint widget JSON shape (currently MyHub-side only).
- Verify every `connectorsUsed` slug resolves to an installed plugin's MCP server-id.
- Deep-validate `$computed` references against the plugin's compiled `widget-elements/dist/`.

If you hit a validator failure that's not documented here, open an [issue](https://github.com/mySMB-AI-Studio/mysmb-marketplace/issues/new) — the message and your fix should be added to this page.

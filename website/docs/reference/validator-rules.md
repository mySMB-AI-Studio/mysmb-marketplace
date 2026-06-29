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

## Rules

| # | Rule | How to satisfy |
|---|---|---|
| 1 | `.claude-plugin/marketplace.json` exists and parses as valid JSON. | Don't commit a syntax error. |
| 2 | Every plugin in `marketplace.json` has a matching directory under `plugins/`. | Match `name` to the directory name. |
| 3 | Every plugin directory has `.claude-plugin/plugin.json`, `.mcp.json`, and `README.md`. | Don't delete required files. |
| 4 | Every MCP server in `.mcp.json` declares `type` as `"stdio"`, `"sse"`, or `"http"`. | Use one of the recognised transports. |
| 5 | Every `${VAR}` placeholder in `.mcp.json` (env or headers) is either `CLAUDE_PLUGIN_ROOT` (reserved) or appears under a `## Configuration` heading in the plugin's README. | Add a row for each variable to your README. |

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

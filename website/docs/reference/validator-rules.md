---
id: validator-rules
title: Validator rules
sidebar_position: 4
---

# Validator rules

The marketplace validator (`scripts/validate.ts`) runs in CI on every PR and on every push to each branch tier (`dev`, `qa`, `uat`, `main`) — including AI Studio's publish and promote commits — and locally with:

```bash
npx tsx scripts/validate.ts
```

It hard-fails the PR or push if any rule is violated; a failed publish or promotion shows up in the AI Studio promotion log.

## Rules

| # | Rule | How to satisfy |
|---|---|---|
| 1 | `.claude-plugin/marketplace.json` exists and parses as valid JSON. | Don't commit a syntax error. |
| 2 | Every plugin in `marketplace.json` has a matching directory under `plugins/`. | Match `name` to the directory name. |
| 3 | Every plugin directory has `.claude-plugin/plugin.json`, `.mcp.json`, and `README.md`. | Don't delete required files. |
| 4 | Every MCP server in `.mcp.json` declares `type` as `"stdio"`, `"sse"`, or `"http"`. | Use one of the recognised transports. |
| 5 | Every `${VAR}` placeholder in `.mcp.json` (env or headers) is either `CLAUDE_PLUGIN_ROOT` (reserved) or appears under a `## Configuration` heading in the plugin's README. | Add a row for each variable to your README. |
| 6 | A `content` section in `plugin.json` lists files that exist, parse, match their `originKey` / `kind`, and whose automation dependencies are bundled in the same plugin. | Bundle every content file the section lists, named after its `originKey`. |
| 7 | `briefingEmailSources` files exist, match the email-source schema, and name only MCP servers this plugin declares. | Point sources at your own plugin's servers. |
| 8 | No new widget uses `"gap": "xxs"` (not a real value — renders as zero gap). Pre-existing files are grandfathered in `scripts/xxs-baseline.json`. | Use `"xs"` or `"none"`. |
| 9 | Every myhub-hosted MCP URL uses the **production** myhub-mcp-servers host, on every branch tier. | Use the production host; myHub rewrites it per environment at runtime. `node scripts/normalize-mcp-urls.mjs` fixes imported files. |
| 10 | Store `branding` / `listing` on a `marketplace.json` entry (when present): `branding.color` is `#rgb`/`#rrggbb`; `branding.tagline` ≤ 90 chars; `listing.highlights` ≤ 4 × ≤ 120 chars; `listing.screenshots` ≤ 6; `listing.longDescription` ≤ 20,000 chars; `listing.publisher` has a `name` (≤ 80 chars); publisher/support URLs parse; every image (`branding.logo`, `branding.logoDark`, `listing.screenshots[]`) is an `https://` URL, a `data:image/…` URI, or a bundle-relative svg/png/jpg/jpeg/webp/gif that exists in `plugins/<slug>/` and is ≤ 96 KB. | Keep images in the bundle (e.g. `assets/logo.svg`) — SVG preferred. See [Validate and ship](/authoring/validate-and-ship#store-branding-and-listing-optional). |

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

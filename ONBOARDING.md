# Developer Onboarding — Plugins & MCP Servers

Welcome! This is the 30-minute path from zero to a merged plugin. Two repos work
together:

| Repo | What it is | When you touch it |
|------|------------|-------------------|
| **`mysmb-marketplace`** (this repo) | The plugin catalog MyHub installs. Plugins bundle an MCP server reference (`.mcp.json`), skills, agents, and widgets. | Authoring/registering a plugin |
| **`myhub-mcp-servers`** | The hosted MCP servers (one Express app, ~30 routes) the plugins call. | Adding/changing a connector's actual tools |

> A **plugin ≠ an MCP server**. A plugin is the packaging unit; it *points at*
> an MCP server route. Many plugins, one servers repo.

## Mental model

```
user prompt ─► MyHub agent ─► MCP tool ─► your hosted MCP server ─► vendor API
                  ▲                                  (myhub-mcp-servers repo)
                  └── plugin (.mcp.json + skills + widgets)  (this repo)
```

## Branch tiers (this repo)

```
dev ──publish──► qa ──promote──► uat ──promote──► main (production)
```

All work lands on `dev` — saves in the AI Studio Developer Instance
auto-commit there, and code changes are pushed there. The mySMB.com Admin
Center's **AI Studio** then publishes each extension to `qa` and promotes it to
`uat` and `main`, bumping the version as it goes; nobody commits to `qa`,
`uat` or `main` by hand. MyHub installs the branch matching the tenant's
environment (QA → `qa`, UAT → `uat`, production → `main`). Details:
[CONTRIBUTING.md](./CONTRIBUTING.md#branch-tiers).

`myhub-mcp-servers` has its own deploy branches (production is `master`) — see
that repo's README.

## Day 1 — run things locally

**MCP servers** (`myhub-mcp-servers`):
```bash
cp .env.dev.example .env && docker compose up
curl localhost:3000/health        # see the mounted routes
```
See its `DEVELOPMENT.md` (covers the OAuth-localhost gotcha — API-key
integrations like Cliniko/Sprout/Talkdesk need no secret to run locally).

**This repo** (no server to run — it's a catalog):
```bash
npx tsx scripts/validate.ts       # validates the whole marketplace
```

## Day 1 — build your first plugin

1. `git checkout dev && git pull`, read **[CREATING_PLUGINS.md](./CREATING_PLUGINS.md)**
   and scaffold under `plugins/<name>/`.
2. Point `.mcp.json` at the **production** server route
   (`…/<server>/mcp`) — never a dev/QA/UAT host (the validator enforces this).
3. Register it in `.claude-plugin/marketplace.json` (optionally with store
   `branding` / `listing` — see CREATING_PLUGINS.md).
4. `npx tsx scripts/validate.ts` until green.
5. Push to `dev` (or open a PR into `dev`), then in AI Studio → Extensions press
   **Pull** and **Publish** (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

## How environments work (read this once)

- One repo, four branch tiers: `dev` (unpublished) → `qa` → `uat` → `main` (prod).
- `.mcp.json` URLs are **environment-agnostic** (always production host).
- MyHub redirects to the right environment's servers at runtime via
  `MCP_SERVERS_BASE_URL` — you never encode environment in the repo.
- A tenant's marketplace install is pinned to a branch (`ref`); MyHub pre-fills
  it per environment (`MARKETPLACE_DEFAULT_REF`: local `dev`, QA `qa`, UAT `uat`,
  production `main`).
- Versions are AI Studio's job: publish = patch + 1, promote to UAT = major + 1,
  promote to production = unchanged.

That's it. Ask in the team channel if `/health` or the validator surprises you.

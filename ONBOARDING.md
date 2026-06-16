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

## Branch model (both repos)

```
feature/* ──► dev ──► staging ──► main/master (production)
```

Cut `feature/*` from `dev`, PR into `dev`, promote up the tiers. The production
branch is `main` in this repo and `master` in `myhub-mcp-servers` (historical;
mapped in each repo's README). MyHub installs the branch matching the tenant's
environment automatically.

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

1. Read **[CREATING_PLUGINS.md](./CREATING_PLUGINS.md)** and scaffold under
   `plugins/<name>/`.
2. Point `.mcp.json` at the **production** server route
   (`…/<server>/mcp`) — never a staging host (the validator enforces this).
3. Register it in `.claude-plugin/marketplace.json`.
4. `npx tsx scripts/validate.ts` until green.
5. Open a PR into `dev` (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

## How environments work (read this once)

- One repo, branch tiers. `main`=prod, `staging`, `dev`.
- `.mcp.json` URLs are **environment-agnostic** (always production host).
- MyHub redirects to the right environment's servers at runtime via
  `MCP_SERVERS_BASE_URL` — you never encode environment in the repo.
- A tenant's marketplace install is pinned to a branch (`ref`); the MyHub admin
  form pre-fills it per environment.

That's it. Ask in the team channel if `/health` or the validator surprises you.

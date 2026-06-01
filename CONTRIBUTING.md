# Contributing to the mySMB Marketplace

This is the **single** plugin marketplace consumed by MyHub tenants and by
local Claude Code. It uses **branch tiers**, not separate repos per environment.

## Branch model

```
feature/* ──→ dev ──→ staging ──→ main (production)
```

| Branch | Who installs it | What lives here |
|--------|-----------------|-----------------|
| `main` | Production tenants | Vetted, released plugins only |
| `staging` | Staging tenants | Full superset under pre-prod validation |
| `dev` | Local Claude Code / dev tenants | Integration of in-flight plugin work |
| `feature/*` | — | One plugin's work, short-lived, branched from `dev` |

- Open PRs **into `dev`**. Promote up the tiers (`dev → staging → main`) via PR.
- Graduate a single plugin between tiers with
  [`scripts/promote-plugin.mjs`](./scripts/promote-plugin.mjs).
- Branches differ **only by which plugins/versions exist** — never by URLs or
  environment config.

## The one hard rule about URLs

Every plugin `.mcp.json` ships the **production** myhub-mcp-servers host on
**every** branch:

```
https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/<server>/mcp
```

Do **not** put a staging/dev host in a `.mcp.json`. MyHub rewrites the host
per-environment at runtime (`MCP_SERVERS_BASE_URL`), and the same URL works
unmodified in stock Claude Code. The validator **fails** on any non-production
myhub host. If you imported a file with the wrong host, run
`node scripts/normalize-mcp-urls.mjs`.

## Authoring a plugin

Full guide: **[CREATING_PLUGINS.md](./CREATING_PLUGINS.md)**. Minimum legal
plugin = `.claude-plugin/plugin.json` + `.mcp.json` + `README.md` (with a
`## Configuration` heading documenting every `${VAR}`).

If your plugin needs a **new hosted MCP server**, build it in the companion repo
[`myhub-mcp-servers`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers)
first (see its `DEVELOPMENT.md`), then point your `.mcp.json` at its production
route.

## Definition of done (before you open a PR)

```bash
npx tsx scripts/validate.ts        # schema, README config, transport, URL rule
node scripts/normalize-mcp-urls.mjs --check   # no non-prod myhub URLs
```

- [ ] Validator passes
- [ ] `.mcp.json` uses the production myhub host (or a third-party host)
- [ ] README has a `## Configuration` section for every `${VAR}`
- [ ] Plugin registered in `.claude-plugin/marketplace.json`
- [ ] PR targets `dev`

New here? Start with **[ONBOARDING.md](./ONBOARDING.md)**.

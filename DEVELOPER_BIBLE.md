# The Developer Bible — Building Plugins & MCP Servers

> The single source of truth for building, shipping, and operating connectors on
> the mySMB / MyHub platform. If something here conflicts with another doc, **this
> wins** — and please open a PR to fix the other doc.

This guide spans **two repos** that together make a connector:

| Repo | What it is |
|------|-----------|
| **[`mysmb-marketplace`](https://github.com/mySMB-AI-Studio/mysmb-marketplace)** (this repo) | The **catalog**. Plugins = packaging (an `.mcp.json` pointer + skills + agents + widgets). Installed into MyHub tenants and into stock Claude Code. |
| **[`myhub-mcp-servers`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers)** | The **engines**. ~30 hosted MCP servers (one Express app) that expose the actual tools the AI calls. |

Deep-dive companions (this Bible is the umbrella over them):
[`ONBOARDING.md`](./ONBOARDING.md) ·
[`CONTRIBUTING.md`](./CONTRIBUTING.md) ·
[`CREATING_PLUGINS.md`](./CREATING_PLUGINS.md) ·
mcp-servers [`DEVELOPMENT.md`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/DEVELOPMENT.md) ·
[`docs/consolidation-runbook.md`](./docs/consolidation-runbook.md)

---

## Table of contents

1. [The 60-second mental model](#1-the-60-second-mental-model)
2. [The Ten Commandments (non-negotiables)](#2-the-ten-commandments-non-negotiables)
3. [Repos, branches & environments](#3-repos-branches--environments)
4. [How a request actually flows](#4-how-a-request-actually-flows)
5. [Anatomy of a plugin](#5-anatomy-of-a-plugin)
6. [Anatomy of an MCP server](#6-anatomy-of-an-mcp-server)
7. [Credentials: OAuth vs API key](#7-credentials-oauth-vs-api-key)
8. [The golden URL rule (env-agnostic)](#8-the-golden-url-rule-env-agnostic)
9. [Widgets & skills (optional power-ups)](#9-widgets--skills-optional-power-ups)
10. [The workflow: build → validate → PR → promote](#10-the-workflow-build--validate--pr--promote)
11. [Local development](#11-local-development)
12. [Validation rules (what CI enforces)](#12-validation-rules-what-ci-enforces)
13. [Deployment & how environments are wired](#13-deployment--how-environments-are-wired)
14. [Recipes](#14-recipes)
15. [Troubleshooting](#15-troubleshooting)
16. [Glossary](#16-glossary)

---

## 1. The 60-second mental model

```
user types a request
        │
        ▼
 MyHub agent (Claude)  ──calls──►  MCP tool  ──►  your hosted MCP server  ──►  vendor API
        │                          (lives in myhub-mcp-servers)
        │
        ▼
 widget JSON ──$computed──► widget-elements        ← optional UI, lives in the plugin
```

- A **plugin** is *packaging*. It bundles: a pointer to an MCP server (`.mcp.json`),
  optional **skills** (how-to instructions for the agent), optional **agents**
  (personas), and optional **widgets** (dashboard UI). It contains **no server code**
  (except the rare committed `server/dist/`).
- An **MCP server** is the *tool API*. It wraps a vendor (Xero, Cliniko, M365…) and
  exposes typed tools. All of them live in `myhub-mcp-servers`.
- **Plugin ≠ MCP server.** One is the box; the other is the engine inside.

> Rule of thumb: building/changing *tools* → `myhub-mcp-servers`. Packaging them for
> users (UI, skills, catalog entry) → `mysmb-marketplace`. A brand-new connector
> usually needs a PR in **both**.

---

## 2. The Ten Commandments (non-negotiables)

1. **Thou shalt ship the production MCP URL on every branch.** Never a staging/dev
   host. Per-env routing is automatic (see §8). The validator will reject you.
2. **Thou shalt put no secrets in the repo.** Credentials are `${VAR}` placeholders,
   resolved at runtime. No tokens, no keys, no `.env` committed.
3. **Thou shalt document every `${VAR}`** under a `## Configuration` heading in the
   plugin `README.md`. CI fails otherwise.
4. **Thou shalt branch from `dev` and PR back into `dev`.** Never commit straight to
   `staging`/`main`/`master`.
5. **Thou shalt run the validator before pushing** (`npx tsx scripts/validate.ts`).
6. **Thou shalt keep it pure Node** — no native binaries, no platform-specific code.
7. **Thou shalt prefer upstream servers** (npm/remote) over hand-written ones (§6).
8. **Thou shalt make integrations skip cleanly when unconfigured** — blank secrets =
   the server doesn't mount, never crashes.
9. **Thou shalt name things by convention** — `plugin.json` name == marketplace entry
   name == plugin directory.
10. **Thou shalt not encode an environment** anywhere in the repo. Branches differ only
    by *which plugins exist*, never by config.

---

## 3. Repos, branches & environments

Both repos use the same tiered branch model the rest of the platform uses:

```
feature/*  ──►  dev  ──►  staging  ──►  main (production)
                                        └─ called "master" in myhub-mcp-servers (historical)
```

| Branch | Who runs it | What's on it |
|--------|-------------|--------------|
| `main` / `master` | Production tenants / Azure prod | Vetted, released work only |
| `staging` | Staging tenants / Azure staging | Pre-prod validation; full superset in the marketplace |
| `dev` | Local Docker / dev | Integration of in-flight work |
| `feature/*` | Your laptop | One change, short-lived, branched from `dev` |

- **Branches differ only by which plugins/versions exist** — *not* by URLs or config.
- MyHub installs the branch that matches the tenant's environment (prod→`main`,
  staging→`staging`), pinned via a stored `ref` (see §13).
- Promote a single plugin up a tier with
  [`scripts/promote-plugin.mjs`](./scripts/promote-plugin.mjs).

---

## 4. How a request actually flows

1. User asks something in MyHub chat.
2. The agent (Claude Agent SDK, the MCP **host**) decides to call a tool.
3. MyHub has already loaded the tenant's installed plugins: for each, it read the
   plugin's `.mcp.json`, **rewrote the host for this environment** (§8), and
   **injected the user's credential** (from the per-user vault) as an `Authorization`
   header (http/sse) or `env` var (stdio).
4. The tool call hits your MCP server route (e.g. `/xero-accounting/mcp`), which calls
   the vendor API and returns structured data.
5. If the plugin ships a **widget**, the result is rendered as a dashboard tile via the
   widget's `$computed` helpers.

You own steps 4 (the server) and the optional widget in step 5. The platform owns the
rest.

---

## 5. Anatomy of a plugin

```
plugins/<your-plugin>/
├── .claude-plugin/
│   └── plugin.json            ← REQUIRED: name, version, metadata, (optional) connection block
├── .mcp.json                  ← REQUIRED: which MCP server(s) + transport + ${VAR} placeholders
├── README.md                  ← REQUIRED: must contain a "## Configuration" section
├── skills/        (optional)  ← one .md per slash-command / how-to for the agent
├── agents/        (optional)  ← one .md per persona/sub-agent
├── widget-elements/(optional) ← JS $computed helpers/components (compiled dist committed)
├── widgets/       (optional)  ← declarative JSON dashboard tiles
└── server/        (rare)      ← only if you ship a custom MCP server; commit dist/
```

The **minimum legal plugin** = `plugin.json` + `.mcp.json` + `README.md`.

### `plugin.json`
```jsonc
{
  "name": "cliniko-scheduling",
  "version": "0.1.0",
  "description": "Cliniko appointments & availability.",
  "author": { "name": "mySMB AI Studio" },
  "license": "MIT",
  "keywords": ["healthcare", "scheduling"],
  // Optional: drives the friendly Connect modal (see §7)
  "connection": {
    "authType": "api_key",
    "instructions": "In Cliniko: My Info → Manage API keys → create a key.",
    "docUrl": "https://help.cliniko.com/...",
    "fields": [{ "name": "CLINIKO_API_KEY", "label": "API key", "secret": true }]
  }
}
```

### `.mcp.json`
```jsonc
{
  "mcpServers": {
    "cliniko-scheduling": {
      "type": "http",                                    // "stdio" | "sse" | "http"
      "url": "https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/cliniko-scheduling/mcp",
      "headers": { "X-Cliniko-Api-Key": "${CLINIKO_API_KEY}" }  // ${VAR} resolved per-user at runtime
    }
  }
}
```

### `README.md` — the `## Configuration` section is mandatory
Every `${VAR}` you reference in `.mcp.json` must be listed here, or CI fails:
```markdown
## Configuration

| Variable | What it is | Where to get it |
|----------|-----------|-----------------|
| `CLINIKO_API_KEY` | Per-user Cliniko API key | My Info → Manage API keys |
```

### Register it in `.claude-plugin/marketplace.json`
```jsonc
{
  "name": "cliniko-scheduling",
  "displayName": "Cliniko Scheduling",
  "description": "…",
  "category": "healthcare",
  "version": "0.1.0",
  "author": { "name": "mySMB AI Studio" },
  "source": "./plugins/cliniko-scheduling",
  "widgets": "widgets",                                  // optional
  "widgetElements": "widget-elements/dist/index.js"      // optional
}
```

Full step-by-step: [`CREATING_PLUGINS.md`](./CREATING_PLUGINS.md).

---

## 6. Anatomy of an MCP server

Lives in `myhub-mcp-servers`. It's a monorepo of integrations mounted as routes on one
Express app; `/health` lists what's mounted.

```
src/integrations/<name>/
├── index.ts      ← exports the IntegrationDefinition (registered in src/integrations/index.ts)
├── config.ts     ← Zod schema over env vars; reports "not configured" when secrets are blank
│                    so the route SKIPS mounting instead of crashing
├── auth/         ← OAuth provider (omit for API-key integrations)
├── servers/      ← one MCP server factory per route (an integration may expose several)
└── api/          ← HTTP client + tool schemas
```

### Pick the cheapest viable distribution (in order)
1. **Upstream MCP server from npm** — launch via `npx -y <pkg>@latest` (stdio). Upstream
   owns schema changes. Preferred.
2. **Upstream remote MCP server** over `sse`/`http` — no install, but you depend on their
   uptime/rate limits.
3. **Custom server in the repo** — only when no upstream exists. Commit compiled
   `dist/`; pure Node.

### Conventions
- Register OAuth integrations in the `integrations[]` list; API-key ones as
  `credentialIntegrations[]`.
- Make config **fail-soft**: blank secrets → not mounted (so a near-empty local `.env`
  still boots a useful subset).
- One vendor, multiple concerns → multiple routes (e.g. `cliniko-billing`,
  `cliniko-scheduling`), often sharing a `_<vendor>-shared/` provider.

Local setup, the OAuth-localhost gotcha, and the full "add a new integration" walkthrough
are in mcp-servers [`DEVELOPMENT.md`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/DEVELOPMENT.md).

---

## 7. Credentials: OAuth vs API key

All credentials flow as `${VAR}` placeholders that MyHub fills **per-user at session
start** — never stored in the repo.

| Transport | Static credential (API key) | OAuth |
|-----------|-----------------------------|-------|
| `stdio` | substituted into `env` | access token → `env.MYHUB_PLUGIN_TOKEN` |
| `http`/`sse` | substituted into `headers` | `Authorization: Bearer <token>`, auto-refreshed |

- **API key** (e.g. Cliniko, Sprout, Talkdesk): no server-side secret; the user's key is
  sent in headers per request. Declare `connection.authType: "api_key"` + `fields` so the
  Connect modal shows friendly labels and a "where to get it" link.
- **OAuth** (e.g. Xero, M365, Zoho): the MCP server runs the OAuth dance; MyHub stores the
  tokens in a per-user encrypted vault and refreshes them transparently. Declare
  `authType: "oauth"` (the default for http/sse).
- `authType` values: `oauth` · `oauth_client` · `api_key` · `none`.

Whatever you use, **document every `${VAR}` in the README `## Configuration` section.**

---

## 8. The golden URL rule (env-agnostic)

**Every myhub-hosted `.mcp.json` URL uses the PRODUCTION host on every branch:**
```
https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/<server>/mcp
```

Why this is safe — and required:
- At session-build time, MyHub's `rewriteMcpServersHost`
  (`packages/shared/src/plugins/session-config.ts`) checks the `MCP_SERVERS_BASE_URL`
  env var on the tenant's container. If set (non-prod), it **rewrites the scheme+host**
  to that environment's MCP servers, **preserving the `/<server>/mcp` path**.
- So a staging tenant automatically talks to the staging servers; a prod tenant to prod;
  a local Claude Code user (no rewrite) to prod. **One file, every environment.**
- The validator **rejects** any non-production myhub host. If you imported a file with a
  staging host, run `node scripts/normalize-mcp-urls.mjs`.

Third-party hosts (e.g. `mcp.monday.com`) and `stdio` servers are unaffected.

---

## 9. Widgets & skills (optional power-ups)

- **Skills** (`skills/*.md`) — teach the agent *how* to use your tools well (one file per
  slash-command/workflow). Pure instructions; no code.
- **Agents** (`agents/*.md`) — a persona that owns a domain workflow.
- **Widgets** (`widgets/*.json`) — declarative dashboard tiles that render a tool result.
- **Widget-elements** (`widget-elements/`) — small JS `$computed` helpers/components/actions
  the widget JSON calls. Compiled `dist/` is committed. Imports are allow-listed (react,
  lucide-react, zod, json-render, widget-tokens). A plugin that ships widget-elements must
  also ship at least one example widget.

If you only ship tools, skip all of these — the minimum plugin is still valid.

---

## 10. The workflow: build → validate → PR → promote

```
1. git checkout -b feature/<thing> dev
2. Build:   add the server (myhub-mcp-servers) and/or the plugin (mysmb-marketplace)
3. Validate (marketplace):  npx tsx scripts/validate.ts
           (mcp-servers):   npm run lint && npm test
4. PR into dev  (validator/CI must be green; fill the PR checklist)
5. Promote up the tiers as it hardens:  dev → staging → main
   - graduate one plugin:  node scripts/promote-plugin.mjs <plugin> --from staging --to main
```

Definition of done lives in [`CONTRIBUTING.md`](./CONTRIBUTING.md). A new connector =
linked PRs in **both** repos.

---

## 11. Local development

**MCP servers** (`myhub-mcp-servers`):
```bash
cp .env.dev.example .env     # fill in only the integrations you need (most are optional)
docker compose up            # Redis + all servers, hot-reload via tsx watch
curl localhost:3000/health   # see what mounted
```
API-key integrations (Cliniko/Sprout/Talkdesk) need **no secret** to run locally. OAuth
flows need a dev/staging app registration with a `localhost` redirect URI — see
mcp-servers `DEVELOPMENT.md`.

**Marketplace** (this repo — a catalog, nothing to "run"):
```bash
npx tsx scripts/validate.ts                 # validates the whole marketplace
node scripts/normalize-mcp-urls.mjs --check  # confirms no non-prod myhub URLs
```
To build widgets visually, scaffold a plugin (`create-mysmb-plugin`) and use the widget
harness — see the [README Quick start](./README.md#quick-start).

---

## 12. Validation rules (what CI enforces)

`scripts/validate.ts` (run on every PR and on `main`/`staging`/`dev`) checks:

1. `marketplace.json` parses; every listed plugin has a matching directory.
2. Each plugin has `plugin.json`, `.mcp.json`, `README.md`.
3. `plugin.json` `name` == marketplace entry name.
4. Each MCP server declares a known transport (`stdio` | `sse` | `http`).
5. Every `${VAR}` in `env`/`headers` is `CLAUDE_PLUGIN_ROOT` (reserved) **or** documented
   under `## Configuration` in the README.
6. **Every myhub-hosted URL uses the production host** (the §8 rule).
7. If a plugin ships `widgetElements` it must also ship `widgets`; the elements file must
   exist; its imports are on the allowlist; declared `widgets` dir must hold ≥1 `.json`.

Run it locally before pushing — same script CI runs.

---

## 13. Deployment & how environments are wired

**MCP servers** (`myhub-mcp-servers`):
- Push to `staging` → GitHub Actions builds the image in ACR and deploys the
  **`myhub-mcp-servers-staging`** Container App (resource group `myHub-Staging`).
- Push to `master` → deploys **`myhub-mcp-servers`** (resource group `myHub-Production`).
- `dev` runs locally via Docker (no Azure).
- Staging needs its own Entra/Xero/etc. app registrations bound to the staging FQDN, or
  `/health` passes but Connect flows fail with `redirect_uri_mismatch`.

**Marketplace** (consumed by MyHub):
- MyHub stores each marketplace registration with a `ref` (branch). The admin "Add
  marketplace" form pre-fills it from **`MARKETPLACE_DEFAULT_REF`** (prod→`main`,
  staging→`staging`, dev→`dev`) and it's overridable.
- Plugins are fetched/cloned from that branch; relative-path plugin dirs are cloned with
  `git clone --branch <ref>`.
- Combined with §8, this is the whole "right code in the right environment" story:
  **the branch decides which plugins; the host-rewrite decides which servers.**

---

## 14. Recipes

**"Add a brand-new connector (e.g. FreshBooks)"**
1. `myhub-mcp-servers`: add `src/integrations/freshbooks/` (config/auth/servers/api),
   register it, `docker compose up`, confirm `/freshbooks/mcp` in `/health`, add tests.
   PR into `dev`.
2. `mysmb-marketplace`: add `plugins/freshbooks/` with `.mcp.json` pointing at the
   **production** `/freshbooks/mcp` URL, a README `## Configuration`, and a
   `marketplace.json` entry. `npx tsx scripts/validate.ts`. PR into `dev`. Link both PRs.

**"Wrap an existing npm MCP server"** — use `type: "stdio"`, `command: "npx"`,
`args: ["-y", "<pkg>@latest"]`, map secrets into `env` as `${VAR}`. No server code needed.

**"Add a dashboard tile to an existing plugin"** — add `widgets/<name>.json` (+ any
`widget-elements/`), set `"widgets"`/`"widgetElements"` in the marketplace entry, validate.

**"Promote a plugin to production"**
```bash
git checkout main
node scripts/promote-plugin.mjs <plugin> --from staging --to main
node scripts/normalize-mcp-urls.mjs && npx tsx scripts/validate.ts
git commit -am "feat: promote <plugin> staging -> main"
```

---

## 15. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `validate: FAILED … must use the production host` | A `.mcp.json` has a staging/dev URL. Run `node scripts/normalize-mcp-urls.mjs`. |
| `validate: FAILED … not documented under a "Configuration" heading` | Add the `${VAR}` to the plugin README `## Configuration` section. |
| Plugin loads but the tool 401s | OAuth token expired / not connected. Reconnect in MyHub; check the server's app registration. |
| Local `/health` doesn't list your server | Its config reported "not configured" — a required secret in `.env` is blank, or you didn't register it in `src/integrations/index.ts`. |
| OAuth fails locally with `redirect_uri_mismatch` | Register `http://localhost:3000/<provider>/callback` on your dev app, or point at staging. |
| Staging tenant hits prod servers (or vice-versa) | `MCP_SERVERS_BASE_URL` not set on that tenant. This is platform config, not the repo. |
| `widgetElements` declared but plugin won't validate | You must also ship a `widgets/` dir with ≥1 `.json`; check the import allowlist. |

---

## 16. Glossary

- **MCP (Model Context Protocol)** — the protocol the agent uses to call tools. MyHub's
  agent is the *host*; your server is the *server*.
- **Plugin** — packaging unit installed into a tenant: `.mcp.json` + skills + agents +
  widgets. Not a server.
- **MCP server** — the tool API that wraps a vendor; lives in `myhub-mcp-servers`.
- **Transport** — how the agent reaches the server: `stdio` (subprocess), `http`/`sse`
  (remote).
- **`${VAR}` placeholder** — a credential slot filled per-user at session start from the
  vault; never committed.
- **Host-rewrite (`MCP_SERVERS_BASE_URL`)** — runtime redirect of the MCP host per
  environment; why URLs are env-agnostic.
- **`ref`** — the marketplace branch a tenant is pinned to (`main`/`staging`/`dev`).
- **Widget / widget-element** — declarative dashboard tile / the JS helpers it calls.
- **Validator** — `scripts/validate.ts`; the gate every plugin must pass.

---

*This Bible is living. Found a gap or something that bit you? Open a PR against this file —
that's how it stays the source of truth.*

# Contributing to the mySMB Marketplace

This is the **single** plugin marketplace consumed by MyHub tenants (where
plugins are called **Workspace Extensions**) and by local Claude Code. It uses
**branch tiers**, not separate repos per environment.

## Branch tiers

```
dev ──publish──► qa ──promote──► uat ──promote──► main (production)
```

| Branch | Who installs it | What lives here |
|--------|-----------------|-----------------|
| `dev` | Local Claude Code / local MyHub | Unpublished work — AI Studio auto-commits and code-driven pushes |
| `qa` | QA tenants | Extensions published from AI Studio |
| `uat` | UAT tenants | Extensions promoted from QA |
| `main` | Production tenants | Released extensions, promoted from UAT |

- **All authoring lands on `dev`.** Nobody commits to `qa`, `uat` or `main` by
  hand — only the AI Studio writes those tiers.
- **Promotion is per extension**, in the mySMB.com Admin Center →
  **AI Studio → Extensions**. Each step copies `plugins/<slug>/` and the
  extension's `.claude-plugin/marketplace.json` entry from the tier below,
  rewrites the version, commits straight onto the target branch, and refreshes
  that environment's marketplace so its tenants see the change in the store
  immediately.
- Branches differ **only by which extensions/versions exist** — never by URLs or
  environment config.
- CI ([`validate.yml`](./.github/workflows/validate.yml)) runs the validator on
  every PR and on every push to each tier. A publish or promotion that breaks a
  rule shows up in the AI Studio promotion log.

### Versioning (automatic)

| Step | From → to | Version |
|------|-----------|---------|
| New extension | — | `0.0.0` |
| **Publish** | `dev → qa` | patch + 1 (`0.0.1` → `0.0.2`) |
| **Promote to UAT** | `qa → uat` | major + 1, patch kept (`0.0.2` → `1.0.2`) |
| **Promote to Production** | `uat → main` | unchanged (`1.0.2`) |

The version is written into both `plugins/<slug>/.claude-plugin/plugin.json` and
the `marketplace.json` entry on the target branch. **Don't bump `version`
yourself** — the next publish overwrites it. Any change on `dev` after a publish
makes the extension publishable again.

## Two ways to change an extension

### 1. In AI Studio (no git)

Open the extension in **AI Studio → Extensions** and edit its components in the
**Developer Instance** (the QA workspace wired to AI Studio). Every save
auto-commits the assembled extension to `dev` — a toast confirms
`Committed <slug> to dev · <sha7>`. When it's ready, press **Publish**, then
**Promote to UAT** and **Promote to Production** as it passes each environment.

### 2. In code

```bash
git clone https://github.com/mySMB-AI-Studio/mysmb-marketplace.git
cd mysmb-marketplace
git checkout dev && git pull

# edit plugins/<slug>/ (and its entry in .claude-plugin/marketplace.json)

npx tsx scripts/validate.ts                   # must print "validate: OK"
node scripts/normalize-mcp-urls.mjs --check   # no non-prod myhub URLs
git add plugins/<slug> .claude-plugin/marketplace.json
git commit -m "feat(<slug>): what changed"
git push origin dev
```

Then, in **AI Studio → Extensions**, press **Pull** on the extension so the
Developer Instance picks up your commit (otherwise the next save in the UI
re-commits its older copy over yours), and **Publish** it. AI Studio's
*Open in VS Code* (vscode.dev on `dev`) and *Clone* buttons are shortcuts into
this same flow. Want a review first? Push a short-lived branch and open a PR
into `dev` instead — CI validates it — then Pull and Publish once it merges.

> `scripts/promote-plugin.mjs` is a break-glass fallback for when AI Studio is
> unavailable. It copies the subtree and the manifest entry between branches but
> does **not** rewrite the version or refresh the environment's marketplace —
> do both by hand and tell the extension's owner.

## The one hard rule about URLs

Every plugin `.mcp.json` ships the **production** myhub-mcp-servers host on
**every** branch (`dev`, `qa`, `uat` and `main`):

```
https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/<server>/mcp
```

Do **not** put a dev/QA/UAT host in a `.mcp.json`. MyHub rewrites the host
per-environment at runtime (`MCP_SERVERS_BASE_URL`), and the same URL works
unmodified in stock Claude Code. The validator **fails** on any non-production
myhub host. If you imported a file with the wrong host, run
`node scripts/normalize-mcp-urls.mjs`.

## Authoring a plugin

Full guide: **[CREATING_PLUGINS.md](./CREATING_PLUGINS.md)**. Minimum legal
plugin = `.claude-plugin/plugin.json` + `.mcp.json` + `README.md` (with a
`## Configuration` heading documenting every `${VAR}`). Store branding (logo,
colour, tagline, screenshots, long description) is optional — see
[CREATING_PLUGINS.md → Store branding and listing](./CREATING_PLUGINS.md#store-branding-and-listing-optional).

If your plugin needs a **new hosted MCP server**, build it in the companion repo
[`myhub-mcp-servers`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers)
first (see its `DEVELOPMENT.md`), then point your `.mcp.json` at its production
route.

## Definition of done (before you push to `dev`)

```bash
npx tsx scripts/validate.ts        # schema, README config, transport, URL rule, store branding
node scripts/normalize-mcp-urls.mjs --check   # no non-prod myhub URLs
```

- [ ] Validator passes
- [ ] `.mcp.json` uses the production myhub host (or a third-party host)
- [ ] README has a `## Configuration` section for every `${VAR}`
- [ ] Plugin registered in `.claude-plugin/marketplace.json`
- [ ] Store assets (if any) live in the bundle — SVG preferred, ≤ 96 KB each
- [ ] Change lands on `dev` (pushed, or a PR into `dev`); `version` left alone

New here? Start with **[ONBOARDING.md](./ONBOARDING.md)**.

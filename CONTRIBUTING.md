# Contributing to the mySMB Marketplace

This is the **single** plugin marketplace consumed by MyHub tenants (where
plugins are called **Workspace Extensions**) and by local Claude Code. It uses
**branch tiers**, not separate repos per environment.

## Branch tiers

```
feature/* ──PR──► dev ──publish──► qa ──promote──► uat ──promote──► main (production)
```

| Branch | Who installs it | What lives here |
|--------|-----------------|-----------------|
| `feature/*` (any short-lived branch) | Nobody | Optional review path for code changes: push the branch and open a PR into `dev`. Nothing is published from it |
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
- CI ([`validate.yml`](./.github/workflows/validate.yml)) runs on **every pull
  request, whatever branch it targets**, and on every push to `main`, `uat`,
  `qa` and `dev` (plus the retired `staging`, kept until that branch is
  archived). It does `npm ci`, `npm test` and `npm run validate`, so the
  validator and its fixture tests gate every tier. A publish or promotion that
  breaks a rule shows up in the AI Studio promotion log.

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
> unavailable. Run it **while checked out on the target branch**:
> `node scripts/promote-plugin.mjs <plugin> [--from uat] [--to main]`. It
> replaces `plugins/<plugin>/` with the copy on the `--from` branch and upserts
> that branch's `marketplace.json` entry, leaving the changes in your working
> tree. `--to` only labels the log line — the script never switches branches,
> commits or pushes. It does **not** rewrite the version or refresh the
> environment's marketplace: set both by hand (publish = patch + 1, promote to
> UAT = major + 1, UAT → production = unchanged), refresh the environment in
> AMP, and tell the extension's owner.

`qa` is the canonical QA marketplace branch. `staging` remains only as a legacy
rollback branch and is not a new publish target.

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
npx tsx scripts/validate.ts        # schema, README config, transport, URL rule, store branding, business-agent content
npm test                           # the validator's own fixture tests (what CI runs before the validator)
node scripts/normalize-mcp-urls.mjs --check   # no non-prod myhub URLs
```

- [ ] Validator passes
- [ ] `.mcp.json` uses the production myhub host (or a third-party host)
- [ ] README has a `## Configuration` section for every `${VAR}`
- [ ] Plugin registered in `.claude-plugin/marketplace.json`
- [ ] Store assets (if any) live in the bundle — SVG preferred, ≤ 96 KB each
- [ ] Change lands on `dev` (pushed, or a PR into `dev`); `version` left alone
- [ ] Business-agent package? `listing.agent` keys match the bundled processes and capabilities, `dependencies[]` is declared, and `plugin.json` / `marketplace.json` versions agree (see below)

## Business-agent packages

A package whose `marketplace.json` entry carries `listing.agent` is a **business
agent**. It may bundle three extra content kinds — `process`, `capability` and
`evaluation` (see [CREATING_PLUGINS.md → Business-agent content](./CREATING_PLUGINS.md#business-agent-content-processes-capabilities-evaluations)) —
and the validator holds it to a stricter standard than an ordinary plugin:

- `version` must be **strict semver** (`x.y.z`, optional prerelease, no `+build`)
  and `plugin.json`'s `version` must **equal** the `marketplace.json` entry's.
  AI Studio's `0.0.0 → patch + 1 → major + 1` scheme already satisfies this, which
  is another reason not to bump `version` by hand. For every *other* plugin a
  disagreement between the two files is only a **warning** (several existing
  plugins have one).
- Anything a process uses — capability keys, automations, forms, templates,
  evaluations — must be bundled in the same plugin or in a plugin listed in the
  entry's `dependencies[]` (`[{ "plugin": "<name>", "version": "^1.2.0" }]`; the
  plugin must exist in this registry, the version is an exact, `^`, `~` or
  x-range, and the dependency graph must be acyclic).
- Each process / capability / evaluation `definition` is validated against
  [`contracts/studio-contracts-v1.json`](./contracts/studio-contracts-v1.json),
  the schema artefact the Workspace generates. **Never hand-edit it** — when the
  Workspace regenerates it, copy the new file over this one in the same PR as any
  package change that needs it.

New here? Start with **[ONBOARDING.md](./ONBOARDING.md)**.

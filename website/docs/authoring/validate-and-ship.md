---
id: validate-and-ship
title: Validate and ship
sidebar_position: 6
---

# Validate and ship

The marketplace has four branch tiers:

```
dev ──publish──► qa ──promote──► uat ──promote──► main (production)
```

All work lands on **`dev`**. The mySMB.com Admin Center's **AI Studio** then publishes each extension to `qa` and promotes it to `uat` and `main`, one extension at a time. Nobody commits to `qa`, `uat` or `main` by hand.

## 1. Register your plugin

Work on the `dev` branch:

```bash
git clone https://github.com/mySMB-AI-Studio/mysmb-marketplace.git
cd mysmb-marketplace
git checkout dev && git pull
```

Add an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "acme-billing",
  "displayName": "Acme Billing",
  "description": "Acme billing — invoices, customers, payments. Stdio MCP server, bearer-token auth.",
  "category": "billing",
  "version": "0.1.0",
  "author": { "name": "Your Org" },
  "tags": ["acme", "billing", "invoices", "smb"],
  "source": "./plugins/acme-billing",
  "widgets": "widgets",
  "widgetElements": "widget-elements/dist/index.js"
}
```

Drop the `widgets` / `widgetElements` keys if your plugin doesn't ship them. Don't bump `version` later — AI Studio rewrites it on every publish and promotion.

### Store branding and listing (optional)

Two optional blocks on the same entry dress the extension up in the MyHub **Workspace Extensions** store (card and detail page). Claude Code ignores them; AI Studio's extension metadata form edits the same fields. Without them the store falls back to `icon`, then a monogram.

```json
{
  "name": "acme-billing",
  "source": "./plugins/acme-billing",
  "branding": {
    "logo": "assets/logo.svg",
    "logoDark": "assets/logo-dark.svg",
    "color": "#0f766e",
    "tagline": "Invoices, customers and payments without leaving your workspace."
  },
  "listing": {
    "longDescription": "## What it does\n\nAcme Billing puts your receivables on the dashboard.",
    "highlights": ["Overdue invoices on your dashboard", "Draft invoices from chat"],
    "screenshots": ["assets/screenshot-dashboard.png"],
    "publisher": { "name": "Acme Inc.", "url": "https://acme.com" },
    "support": { "url": "https://acme.com/support", "privacyUrl": "https://acme.com/privacy" }
  }
}
```

| Field | Limit |
|---|---|
| `branding.logo`, `branding.logoDark` | image (see below); `logoDark` falls back to `logo` |
| `branding.color` | `#rgb` or `#rrggbb` — a soft wash behind the detail-page hero |
| `branding.tagline` | ≤ 90 characters |
| `listing.longDescription` | Markdown, ≤ 20,000 characters |
| `listing.highlights` | ≤ 4 lines, ≤ 120 characters each |
| `listing.screenshots` | ≤ 6 images |
| `listing.publisher` | `{ name (≤ 80 chars), url?, verified? }` — `verified` is set by marketplace maintainers only |
| `listing.support` | `{ url?, privacyUrl? }` |

**Images** are a bundle-relative path (`assets/logo.svg`, relative to `plugins/<slug>/`), an `https://` URL, or a `data:image/…` URI. Prefer bundle-relative paths: marketplace sync inlines them as data URIs into the tenant's catalog, so the store never fetches from GitHub, and they travel with the extension as it is promoted. **SVG preferred**; PNG, JPEG, WebP and GIF also work. **≤ 96 KB per file** — larger files are dropped at sync, so the validator fails them.

## 2. Validate locally

```bash
npx tsx scripts/validate.ts
```

This runs the same checks CI does — see [Validator rules](/reference/validator-rules) for the full list. The essentials:

1. `marketplace.json` exists and parses.
2. Every plugin in the manifest has a matching directory.
3. Every plugin has `plugin.json`, `.mcp.json`, and `README.md`.
4. Every MCP server declares `type: "stdio" | "sse" | "http"`.
5. Every `${VAR}` from `.mcp.json` is documented in the README under `## Configuration`.
6. myhub-hosted MCP URLs use the **production** host on every branch.
7. Store `branding` / `listing` (if present) respect the limits above, and every bundle-relative image exists.

## 3. Push to `dev`

```bash
git add plugins/acme-billing .claude-plugin/marketplace.json
git commit -m "feat(plugins): add acme-billing"
git push origin dev
```

CI runs the same validator on the push. Want a review first? Push a short-lived branch and open a PR into `dev` instead.

## 4. Publish and promote from AI Studio

In the mySMB.com Admin Center → **AI Studio → Extensions**, open the extension and:

1. **Pull** — brings your `dev` commit into the Developer Instance (the QA workspace wired to AI Studio), so a later save there doesn't re-commit an older copy over yours.
2. **Publish** — copies `plugins/<slug>/` and its manifest entry `dev → qa`, version **patch + 1**. QA tenants see it in the store straight away.
3. **Promote to UAT** — `qa → uat`, version **major + 1** (patch kept, e.g. `0.0.2 → 1.0.2`).
4. **Promote to Production** — `uat → main`, same version.

If you build the extension in AI Studio instead of in code, every save in the Developer Instance auto-commits to `dev` for you — skip sections 1–3 and **Pull**, and go straight to **Publish**.

## 5. Test it

### In Claude Code

```bash
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install acme-billing
```

That tracks the repo's default branch (`main`), so a new extension appears there once it is promoted to production. Set the env vars listed in your `## Configuration` section, then start a session and try the skill triggers.

### In MyHub (QA)

After **Publish**, install the extension on a QA test tenant from the Workspace Extensions store, watch the tenant's container logs for the MCP server boot, and exercise the connector from the chat UI.

## Common rejection reasons

| Symptom | Fix |
|---|---|
| `validate: missing plugin.json` | You forgot `.claude-plugin/plugin.json` |
| `validate: undocumented variable ACME_FOO` | Add a row for `ACME_FOO` under your README's `## Configuration` heading |
| `validate: unknown transport "tcp"` | Use `stdio`, `sse`, or `http` — nothing else |
| `branding.logo "assets/logo.svg" does not exist` | Commit the file under `plugins/<slug>/assets/`, or fix the path |
| `… is 140000 bytes — store assets must be … at most 96 KB` | Export an SVG, or compress the PNG/JPEG |
| Plugin doesn't appear in `/plugin marketplace list` | Did you add it to `.claude-plugin/marketplace.json`? Has it been promoted to `main`? |
| Pushed to `dev` but QA tenants don't see it | `dev` is unpublished — **Pull** and **Publish** in AI Studio |

---
id: validate-and-ship
title: Validate and ship
sidebar_position: 7
---

# Validate and ship

## 1. Register your plugin

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

Drop the `widgets` / `widgetElements` keys if your plugin doesn't ship them.

## 2. Validate locally

```bash
npx tsx scripts/validate.ts
```

This runs the same checks CI does:

1. `marketplace.json` exists and parses.
2. Every plugin in the manifest has a matching directory.
3. Every plugin has `plugin.json`, `.mcp.json`, and `README.md`.
4. Every MCP server declares `type: "stdio" | "sse" | "http"`.
5. Every `${VAR}` from `.mcp.json` is documented in the README under `## Configuration`.

## 3. Open a PR

```bash
git checkout -b feature/acme-billing
git add plugins/acme-billing .claude-plugin/marketplace.json
git commit -m "feat(plugins): add acme-billing"
git push origin feature/acme-billing
gh pr create
```

CI runs the same validator. Once merged, MyHub picks the plugin up at the next tenant provisioning / refresh, and Claude Code users see it in `/plugin marketplace list`.

## 4. Test it

### In Claude Code

```bash
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install acme-billing
```

Set the env vars listed in your `## Configuration` section, then start a session and try the skill triggers.

### In MyHub (staging)

Subscribe a test tenant to the connector via the admin plane, watch the tenant's container logs for the MCP server boot, and exercise the connector from the chat UI.

## Common rejection reasons

| Symptom | Fix |
|---|---|
| `validate: missing plugin.json` | You forgot `.claude-plugin/plugin.json` |
| `validate: undocumented variable ACME_FOO` | Add a row for `ACME_FOO` under your README's `## Configuration` heading |
| `validate: unknown transport "tcp"` | Use `stdio`, `sse`, or `http` — nothing else |
| Plugin doesn't appear in `/plugin marketplace list` | Did you add it to `.claude-plugin/marketplace.json`? |

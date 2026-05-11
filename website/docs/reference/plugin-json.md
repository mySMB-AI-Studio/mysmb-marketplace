---
id: plugin-json
title: plugin.json
sidebar_position: 1
---

# `plugin.json` reference

Lives at `plugins/<name>/.claude-plugin/plugin.json`.

```json
{
  "name": "acme-billing",
  "version": "0.1.0",
  "description": "Acme billing — invoices, customers, payments via the Acme REST API.",
  "author": { "name": "Your Org" },
  "homepage": "https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/plugins/acme-billing",
  "license": "MIT",
  "keywords": ["acme", "billing", "invoices", "smb"],
  "widgets": "widgets",
  "widgetElements": "widget-elements/dist/index.js"
}
```

## Fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | ✅ | string | Must equal the directory name. Lowercase, hyphen-separated. |
| `version` | ✅ | semver | E.g. `0.1.0` |
| `description` | ✅ | string | One line. |
| `author` | ✅ | `{ name: string }` | Author / org name. |
| `homepage` | recommended | URL | Link to the plugin folder on GitHub. |
| `license` | recommended | SPDX id | Usually `"MIT"`. |
| `keywords` | recommended | string[] | Used for search / discovery. |
| `widgets` | when present | path | Directory of widget JSON, relative to plugin root. Usually `"widgets"`. |
| `widgetElements` | when present | path | Compiled JS module, relative to plugin root. Usually `"widget-elements/dist/index.js"`. |

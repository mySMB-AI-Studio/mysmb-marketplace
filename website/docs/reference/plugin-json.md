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
| `name` | ✅ | string | Must equal the directory name **and** the `name` in the `marketplace.json` entry. Lowercase, hyphen-separated. |
| `version` | ✅ | semver | E.g. `0.1.0` |
| `description` | ✅ | string | One line. |
| `author` | ✅ | `{ name: string, email?: string }` | Author / org name. |
| `homepage` | recommended | URL | Link to the plugin folder on GitHub. |
| `license` | recommended | SPDX id | Usually `"MIT"`. |
| `keywords` | recommended | string[] | Used for search / discovery. |
| `category` | recommended | string | Human-readable category for the connection UI (e.g. `"Health & Wellness"`). The kebab-case `category` in `marketplace.json` is what the catalog filters on. |
| `connection` | when the plugin needs credentials | object | Drives MyHub's connection UI. See below. |
| `widgets` | when present | path | Directory of widget JSON, relative to plugin root. Usually `"widgets"`. If you ship `widgetElements`, you **must** also ship `widgets`. |
| `widgetElements` | when present | path | Compiled JS module, relative to plugin root. Usually `"widget-elements/dist/index.js"`. |
| `portalWidgets` | when present | path[] | Paths to client-portal widget JSON files. See [Client portals](/authoring/client-portals). |
| `portalDataMaps` | when present | path[] | Paths to portal data-map JSON files (server-side recipes). See [Portal files](./portal-files). |

## The `connection` block

When MyHub provisions a tenant, it renders a connection form from this block to collect the credentials your `.mcp.json` references. The validator enforces its shape.

```json
{
  "connection": {
    "authType": "api_key",
    "instructions": "Connect with your **personal** Cliniko API key.\n\n1. In Cliniko, click your name → **My Info**.\n2. Scroll to **Manage API keys** → **Add a key**.\n3. Paste the key below.",
    "docUrl": "https://help.cliniko.com/en/articles/1023957-find-your-api-key",
    "fields": [
      {
        "name": "CLINIKO_API_KEY",
        "label": "Cliniko API key",
        "type": "password",
        "required": true,
        "placeholder": "MS0xxxx…-au4",
        "helpText": "Found under My Info → Manage API keys."
      }
    ]
  }
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `authType` | ✅ | `"oauth"` \| `"api_key"` \| `"none"` | `oauth` → credentials come from the gateway's browser flow; `api_key` → collect `fields`; `none` → no credentials. |
| `instructions` | recommended | string (markdown) | Shown above the form. Newlines and markdown render. |
| `docUrl` | recommended | URL | "Where do I find this?" link. |
| `fields` | required when `authType: "api_key"` | array | One entry per credential. Must be non-empty for `api_key`. |

Each entry in `fields`:

| Key | Required | Type | Notes |
|---|---|---|---|
| `name` | ✅ | `UPPER_SNAKE_CASE` | **Must** appear as a `${NAME}` placeholder in `.mcp.json` (env or headers) **and** be documented under `## Configuration` in the README — otherwise the validator fails. |
| `label` | ✅ | string | Non-empty field label. |
| `type` | recommended | `"password"` \| `"text"` | Defaults to `text`. Use `password` for secrets. |
| `required` | recommended | boolean | Whether the user must fill it. |
| `placeholder` | optional | string | Greyed-out example value. |
| `helpText` | optional | string | Helper line under the field. |

> **OAuth plugins** set `authType: "oauth"` and usually omit `fields` — they point their `.mcp.json` at the [`myhub-mcp-servers`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers) gateway, which owns the token exchange. See QuickBooks and the Xero suite for examples.

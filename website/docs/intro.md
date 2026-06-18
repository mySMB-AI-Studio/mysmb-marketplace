---
id: intro
title: Getting started
slug: /intro
sidebar_position: 1
---

# Getting started

mySMB Marketplace is a registry of agent plugins. Every plugin wraps a business tool — Xero, QuickBooks, Zoho, Microsoft 365, monday.com, GitHub — as a [Model Context Protocol](https://modelcontextprotocol.io/) server, so an AI assistant can read and write to it in natural language. Browse the full [plugin catalog](/catalog) for the current list.

The plugin format is the **standard Claude Code plugin format**. The same artefact installs into two places:

| Audience | How to install | Where it runs |
|---|---|---|
| **Claude Code users** | `/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace` then `/plugin install <name>` | Local Claude Code session |
| **MyHub tenants** | Auto-installed at provisioning from the tenant's connector subscriptions | Per-tenant Container App |

## What's in a plugin?

A plugin can ship any combination of:

- **MCP server** — typed tools the LLM can call. Either upstream npm package, remote `sse`/`http` server, or a custom server bundled in the repo.
- **Skills** — short Markdown files that teach the model how to handle one task ("create an invoice", "find a contact").
- **Agents** — a complete persona scoped to a domain ("CRM assistant", "billing assistant").
- **Widget elements** — small JS helpers (date formatting, status-to-tone mapping) referenced from widget JSON specs via `$computed`.
- **Widgets** — declarative JSON specs that render an interactive dashboard tile in MyHub. Powered by [Vercel json-render](https://json-render.vercel.app/).

Minimum legal plugin: `plugin.json` + `.mcp.json` + `README.md`. Add the rest as you need them.

## Try it in 60 seconds

```bash
# Add the marketplace
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace

# Browse the catalog
/plugin marketplace list

# Install a plugin
/plugin install xero-accounting
```

Each plugin's README has a `## Configuration` section listing the env vars you need to set.

## Where to go next

| If you want to… | Go here |
|---|---|
| Browse what's available | [Plugin catalog](/catalog) |
| Build your first plugin | [Authoring guide → Overview](/authoring/overview) |
| Build your first dashboard widget | [Widgets → Tutorial 1](/widgets/tutorial-1-first-widget) |
| Understand the spec primitives | [Widgets → Spec primitives](/widgets/spec-primitives) |
| Look up a file format | [Reference](/reference/plugin-json) |
| Contribute upstream | [Contributing](/contributing) |

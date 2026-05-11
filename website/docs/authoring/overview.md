---
id: overview
title: Overview
sidebar_position: 1
---

# Authoring overview

This section walks you through building a plugin from an empty folder to a merged PR. Each chapter covers one asset type. If you're in a hurry, follow them in order — the running example (`acme-billing`) is built up across chapters.

## The mental model

```
┌──────────────────────────────────────────────────────────────────┐
│                          MyHub tenant                            │
│                                                                  │
│   user prompt ──► agent (Claude) ──► MCP tool ──► your API       │
│                       │                  ▲                       │
│                       │                  │                       │
│                       ▼                  │                       │
│                   widget JSON ─── $computed ─── widget-elements  │
└──────────────────────────────────────────────────────────────────┘
```

- The **MCP server** is what the LLM actually calls. It exposes business actions as typed tools.
- **Skills** and **agents** teach the LLM *how* to use those tools well.
- **Widgets** turn tool responses into a UI tile on the dashboard.
- **Widget elements** are the small JS helpers (date formatting, status‑to‑colour mapping, tree flattening) that the JSON spec invokes via `$computed`.

A plugin is just the bundle that ships these together so a tenant can opt in or out as one unit.

## Repository layout

```
plugins/<your-plugin>/
├── .claude-plugin/
│   └── plugin.json            ← required: name, version, asset paths
├── .mcp.json                  ← required: MCP server transport + auth
├── README.md                  ← required: must contain ## Configuration
│
├── server/                    ← OPTIONAL: only if you ship a custom MCP server
│   ├── package.json
│   └── src/index.js → dist/index.js   (commit dist/, no install at runtime)
│
├── skills/                    ← OPTIONAL: one .md per slash command
├── agents/                    ← OPTIONAL: one .md per persona
├── widget-elements/           ← OPTIONAL: $computed helpers / components / actions
└── widgets/                   ← OPTIONAL: dashboard tiles
```

## The minimum legal plugin

```
plugins/acme-billing/
├── .claude-plugin/plugin.json
├── .mcp.json
└── README.md
```

That's it. Everything else is opt-in.

## What gets enforced

The validator (`scripts/validate.ts`, runs in CI) checks:

1. `.claude-plugin/marketplace.json` exists and parses.
2. Every plugin in the manifest has a matching directory.
3. Every plugin directory has `plugin.json`, `.mcp.json`, and `README.md`.
4. Every MCP server declares `type: "stdio"` | `"sse"` | `"http"`.
5. Every `${VAR}` placeholder is documented under `## Configuration` in the README.

Run it locally before pushing:

```bash
npx tsx scripts/validate.ts
```

## Up next

→ [MCP server](./mcp-server)

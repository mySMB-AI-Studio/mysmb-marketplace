---
id: mcp-json
title: .mcp.json
sidebar_position: 2
---

# `.mcp.json` reference

Lives at `plugins/<name>/.mcp.json`. Declares one or more MCP servers.

## Schema

```json
{
  "mcpServers": {
    "<server-id>": {
      "type": "stdio" | "sse" | "http",
      // …transport-specific fields…
    }
  }
}
```

## Per-transport fields

### stdio

| Field | Required | Notes |
|---|---|---|
| `type` | ✅ | `"stdio"` |
| `command` | ✅ | Executable, e.g. `"node"`, `"npx"` |
| `args` | ✅ | string[] of args |
| `env` | as needed | `{ VAR: "${VAR}" }` map |

### sse / http

| Field | Required | Notes |
|---|---|---|
| `type` | ✅ | `"sse"` or `"http"` |
| `url` | ✅ | Full URL to the MCP endpoint |
| `headers` | as needed | `{ "Authorization": "Bearer ${VAR}" }` map |

## Variable substitution

Two flavours of `${…}` placeholders are recognised:

| Placeholder | Source |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Reserved. Expands to the plugin's absolute path on disk. |
| `${ANY_OTHER_VAR}` | Tenant secret store (MyHub) or shell env (Claude Code). **Must be documented in the README's `## Configuration` section** — the validator enforces this. |

## Multiple servers per plugin

Allowed. The Microsoft 365 plugin uses one server per Graph scope, plus a
combined `m365-workspace` server so a single consent covers mail, calendar and
people:

```json
{
  "mcpServers": {
    "m365-mail-read": { "type": "http", "url": "…/m365-mail-read/mcp" },
    "m365-calendar":  { "type": "http", "url": "…/m365-calendar/mcp" },
    "m365-workspace": { "type": "http", "url": "…/m365-workspace/mcp" }
  }
}
```

Each server-id is what the widget `dataProvider.mcp` (and the agent's tool-call routing) will reference.

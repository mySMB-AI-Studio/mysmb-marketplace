---
id: mcp-server
title: MCP server
sidebar_position: 2
---

# MCP server

The MCP server is what the LLM actually calls. Pick a transport, declare it in `.mcp.json`, document the env vars in your README. The host substitutes `${VAR}` placeholders at session start.

## Choose a transport

| Transport | When to use |
|---|---|
| `stdio` via npm package (preferred) | Upstream ships an MCP server on npm. Spawn with `npx -y <pkg>@latest`. |
| `sse` / `http` (preferred for OAuth) | Upstream hosts a remote MCP server. Or you use the [`myhub-mcp-servers`](https://github.com/mySMB-AI-Studio/myhub-mcp-servers) gateway. |
| `stdio` via custom server | No upstream exists, or upstream is missing critical functionality. Bundle a pre-compiled `server/dist/`. |

## Option A — Stdio via upstream npm package

```json title=".mcp.json"
{
  "mcpServers": {
    "acme-billing": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@acme/mcp-server@latest"],
      "env": {
        "ACME_API_TOKEN": "${ACME_API_TOKEN}",
        "ACME_BASE_URL": "${ACME_BASE_URL}"
      }
    }
  }
}
```

## Option B — Remote sse / http

```json title=".mcp.json"
{
  "mcpServers": {
    "acme-billing": {
      "type": "http",
      "url": "https://mcp.acme.com/v1",
      "headers": {
        "Authorization": "Bearer ${ACME_API_TOKEN}"
      }
    }
  }
}
```

For OAuth-backed services, point at the `myhub-mcp-servers` gateway and skip token wiring entirely:

```json
{
  "mcpServers": {
    "xero-accounting": {
      "type": "http",
      "url": "https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/xero-accounting/mcp"
    }
  }
}
```

## Option C — Custom stdio server

```
plugins/acme-billing/server/
├── package.json
├── src/index.js
└── dist/index.js   ← built and committed
```

```json title=".mcp.json"
{
  "mcpServers": {
    "acme-billing": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/dist/index.js"],
      "env": {
        "ACME_API_TOKEN": "${ACME_API_TOKEN}"
      }
    }
  }
}
```

`${CLAUDE_PLUGIN_ROOT}` is reserved — the runtime substitutes the absolute path to your plugin.

### Custom server checklist

- Pure Node, no native modules, no platform-specific code.
- Read every credential from `process.env`.
- Exit with a clear `console.error` + non-zero code if a required var is missing.
- Implement the MCP wire protocol (`initialize`, `tools/list`, `tools/call`). See [`plugins/circle/server/src/index.js`](https://github.com/mySMB-AI-Studio/mysmb-marketplace/blob/main/plugins/circle/server/src/index.js) for a single-file reference implementation.
- Build with esbuild, **commit `dist/`**. The runtime must not have to install anything.

## Document every variable

The validator parses your `README.md` for the `## Configuration` heading and rejects the plugin if any `${VAR}` from `.mcp.json` is missing.

```markdown title="README.md"
## Configuration

| Variable | Required | Description |
|---|---|---|
| `ACME_API_TOKEN` | yes | Bearer token from Acme → Settings → API. |
| `ACME_BASE_URL`  | no  | Override the API host. Defaults to `https://api.acme.com`. |
```

## Up next

→ [Skills](./skills)

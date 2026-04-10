# mySMB Marketplace

Curated Claude Code plugins for SMB-focused business integrations.

mySMB Marketplace is the plugin registry consumed by **MyHub**, a conversational AI
platform for small and medium businesses. Every plugin here wraps a business tool
(accounting, CRM, payments, etc.) as a Model Context Protocol (MCP) server so that
MyHub tenants can talk to their business data in natural language.

## Who this is for

- **MyHub** - loads this marketplace at tenant provisioning time and installs the
  plugins each tenant has subscribed to.
- **Claude Code users** - can add this marketplace locally with
  `/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace` and install any plugin
  for direct use.

## Policy: stdio + env vars only

Every plugin in this marketplace follows two hard rules:

1. **stdio MCP servers only.** No HTTP, no SSE. The MyHub tenant runtime is a
   Linux container with no inbound networking, and stdio is the only transport
   that works uniformly across Linux containers, macOS, and Windows developer
   machines.
2. **All credentials via environment variables.** No hardcoded secrets, no
   interactive prompts at runtime, no OS keyring access. MyHub's connection UI
   collects credentials, stores them in its secrets manager, and injects them
   into the MCP server process at session start. Claude Code users can set the
   same variables in their shell.

Plugins must also be pure Node.js - no native binaries, no platform-specific
code - so the same build artifact runs on every tenant.

### Server distribution

We prefer, in order:

1. **Official upstream MCP servers published to npm** (for example,
   `@xeroapi/xero-mcp-server`). Plugins launch them with `npx -y <pkg>@latest`.
   First-run start pays an install cost which the tenant container image can
   pre-warm; subsequent starts are fast. Upstream maintainers own schema
   changes.
2. **Custom servers maintained in this repo**, with the compiled `dist/`
   output committed under `plugins/<name>/server/dist/`. Use this only when
   no upstream server exists or the upstream server is missing critical
   functionality.

## Current plugins

| Plugin | Category | Description |
| ------ | -------- | ----------- |
| [xero](plugins/xero) | accounting | Query and manage Xero invoices, contacts, and financial reports. |

## How MyHub consumes this marketplace

MyHub pulls this repository at tenant provisioning time, reads
`.claude-plugin/marketplace.json`, and for each plugin a tenant has enabled it:

1. Copies the plugin directory into the tenant's Claude Code config.
2. Reads `.mcp.json` and substitutes credential placeholders with secrets from
   the tenant's vault.
3. Starts the MCP server over stdio as a subprocess of the tenant's Claude Code
   session.

See the MyHub repo for the consumer-side integration code.

## Adding a new plugin

1. Create `plugins/<name>/` with this structure:
   ```
   plugins/<name>/
   ├── .claude-plugin/plugin.json
   ├── .mcp.json         # declares the stdio MCP server
   ├── server/           # ONLY if you maintain a custom server here
   ├── skills/           # optional slash commands
   ├── agents/           # optional subagents
   └── README.md         # must include a "Configuration" section
   ```
2. The MCP server must use stdio transport and read all credentials from
   `process.env`. Exit with a clear stderr message if any required variable is
   missing. If the upstream server does not do this by default, wrap it.
3. If you are shipping a custom server, commit the compiled `server/dist/`
   output so the plugin runs with zero install-time steps. If you are
   launching an upstream server from npm via `npx`, there is no `server/`
   directory.
4. Add an entry to `.claude-plugin/marketplace.json`.
5. Document every environment variable the plugin reads under a
   `## Configuration` heading in the plugin's README. The validator enforces
   this.
6. Run `npx tsx scripts/validate.ts` - it must pass.
7. Open a PR. CI runs the same validator.

## Local validation

```bash
npx tsx scripts/validate.ts
```

## License

MIT - see [LICENSE](LICENSE).

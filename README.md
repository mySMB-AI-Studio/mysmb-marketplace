# mySMB Marketplace

Curated agent plugins for SMB-focused business integrations.

mySMB Marketplace is the plugin registry consumed by **MyHub**, a conversational AI
platform for small and medium businesses. Every plugin here wraps a business tool
(accounting, CRM, payments, etc.) as a Model Context Protocol (MCP) server so that
MyHub tenants can talk to their business data in natural language.

## Who this is for

- **MyHub** - loads this marketplace at tenant provisioning time and installs the
  agent plugins each tenant has subscribed to.
- **Claude Code users** - can add this marketplace locally with
  `/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace` and install any plugin
  for direct use. The plugin format is the standard Claude Code plugin format, so
  the same artefacts work for both MyHub tenants and individual developers.

## Policy: any MCP transport, env-var credentials, pure Node

Every plugin in this marketplace follows these rules:

1. **Any MCP transport is allowed.** `stdio`, `sse`, and streamable `http`
   are all supported. Pick the transport the upstream server ships with:
   stdio for local subprocess servers, sse/http for remote services. The
   MyHub tenant runtime is a Linux container with outbound networking, so
   remote MCP servers work fine.
2. **All credentials via environment variables.** No hardcoded secrets, no
   interactive prompts at runtime, no OS keyring access. MyHub's connection
   UI collects credentials, stores them in its secrets manager, and injects
   them into the MCP client at session start - either as `env` (stdio) or
   `headers` (sse/http). Claude Code users can set the same variables in
   their shell. Every `${VAR}` placeholder must be documented in the
   plugin's README under a `## Configuration` heading - the validator
   enforces this.
3. **Pure Node, no native binaries, no platform-specific code.** The same
   build artifact has to run on every tenant container and every developer
   machine.

### Server distribution

We prefer, in order:

1. **Official upstream MCP servers published to npm** (for example,
   `@xeroapi/xero-mcp-server`). Plugins launch them with `npx -y <pkg>@latest`.
   First-run start pays an install cost which the tenant container image can
   pre-warm; subsequent starts are fast. Upstream maintainers own schema
   changes.
2. **Official upstream remote MCP servers** reached over `sse` or `http`.
   No install cost, no version drift, but the plugin depends on the
   upstream service's availability and rate limits.
3. **Custom servers maintained in this repo**, with the compiled `dist/`
   output committed under `plugins/<name>/server/dist/`. Use this only when
   no upstream server exists or the upstream server is missing critical
   functionality.

## Current agent plugins

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

## Adding a new agent plugin

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
2. The MCP server must use one of the allowed transports (`stdio`, `sse`,
   or `http`) and read all credentials from environment variables - via
   `process.env` for stdio servers, or via `${VAR}` placeholders in
   `headers` for remote transports. Stdio servers should exit with a clear
   stderr message if any required variable is missing; if the upstream
   server does not do this by default, wrap it.
3. If you are shipping a custom stdio server, commit the compiled
   `server/dist/` output so the plugin runs with zero install-time steps.
   If you are launching an upstream server from npm via `npx`, or
   connecting to a remote `sse`/`http` server, there is no `server/`
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

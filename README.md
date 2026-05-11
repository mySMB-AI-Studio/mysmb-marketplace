<div align="center">

# mySMB Marketplace

**Curated agent plugins for SMB-focused business integrations.**

Accounting, CRM, HR, payroll, community, productivity — wrapped as Model Context Protocol (MCP) servers and ready to install into [MyHub](https://github.com/mySMB-AI-Studio/myHubV2) tenants or directly into Claude Code.

### 📚 [Read the docs →](https://mysmb-ai-studio.github.io/mysmb-marketplace/)

[Quick start](#quick-start) · [Catalog](#plugin-catalog) · [Authoring guide](https://mysmb-ai-studio.github.io/mysmb-marketplace/authoring/overview) · [Widget tutorials](https://mysmb-ai-studio.github.io/mysmb-marketplace/widgets/tutorial-1-first-widget) · [Policy](#policy)

</div>

---

## What this is

mySMB Marketplace is a registry of agent plugins. Every plugin wraps a business tool as an **MCP server** so an AI assistant can read and write to it in natural language. Plugins use the **standard Claude Code plugin format**, so the same artefact installs into:

- **MyHub tenants** — auto-installed at provisioning time from the tenant's connector subscriptions.
- **Claude Code (CLI / Desktop / IDE)** — installed individually by any developer with one slash command.

A plugin can ship any combination of an MCP server, slash-command **skills**, persona **agents**, declarative **widgets** for the MyHub dashboard, and JS **widget elements** that power those widgets.

---

## Quick start

### For Claude Code users

```bash
# Add the marketplace once
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace

# Install any plugin
/plugin install xero-accounting
/plugin install zoho-crm
/plugin install circle
```

Each plugin's README has a `## Configuration` section listing the env vars you need to set.

### For MyHub operators

Tenants pick up new plugins automatically — MyHub pulls this repo at provisioning time, reads `.claude-plugin/marketplace.json`, and installs every plugin a tenant has subscribed to. See [MyHub repo](https://github.com/mySMB-AI-Studio/myHubV2) for the consumer-side wiring.

### For plugin authors

Read the **[full developer documentation](https://mysmb-ai-studio.github.io/mysmb-marketplace/)** — multi-chapter authoring guide, four hands-on widget tutorials, and complete file-format reference. The single-page summary lives in [`CREATING_PLUGINS.md`](CREATING_PLUGINS.md). Then run the validator before opening a PR:

```bash
npx tsx scripts/validate.ts
```

---

## Plugin catalog

| Plugin | Category | Description |
| --- | --- | --- |
| [deskcrm](plugins/deskcrm) | crm | Lightweight SMB CRM backed by an Excel workbook. Stores contacts and accounts in Contacts and Accounts sheets and exposes CRUD operations over a stdio MCP server. Primarily used for testing the marketplace and plugin lifecycle. |
| [Circle](plugins/circle) | community | Circle community platform (circle.so) Admin API v2. 52 tools across members, spaces, space groups, posts, comments, events, member tags, topics, direct messages, and cross-resource search. Stdio server, API-token auth. |
| [Microsoft 365](plugins/microsoft-365) | productivity | Access Microsoft 365 emails, calendar, files, Teams, and people via Microsoft Graph. Six MCP servers with independent OAuth scopes — mail is split into read (user-consentable) and send (admin-consent). |
| [Xero Accounting](plugins/xero-accounting) | accounting | Full Xero Accounting API coverage via the myHub-hosted OAuth MCP gateway. 119 tools covering sales, purchases, banking, attachments, history, linked transactions, expense claims, receipts, payment services, and all 8 financial reports. Browser OAuth, no API keys. |
| [Xero Projects](plugins/xero-projects) | project-management | Xero Projects via the myHub-hosted OAuth MCP gateway. Projects, tasks, time entries, project users. 11 tools. |
| [Xero Fixed Assets](plugins/xero-assets) | accounting | Xero Fixed Assets register via the myHub-hosted OAuth MCP gateway. List, view, and register fixed assets. 5 tools. |
| [Xero Finance (read-only)](plugins/xero-finance) | accounting | Read-only Xero Finance API — cash validation, AR/AP statements, account usage, bank statement reconciliation. Higher-fidelity than Accounting reports. 6 tools. |
| [Xero Payroll (Australia)](plugins/xero-payroll-au) | payroll | Xero Payroll AU — employees, pay runs, leave, timesheets, superannuation. AU organisations only. 24 tools. |
| [monday.com](plugins/monday) | work-management | Access monday.com boards, items, groups, columns, updates, users, and WorkForms via monday's hosted OAuth MCP server (mcp.monday.com). Browser OAuth, no API keys. |
| [Zoho CRM](plugins/zoho-crm) | crm | Zoho CRM v8 via the myHub-hosted OAuth MCP gateway. Records (CRUD on any module), COQL, search, notes, attachments, tags, related lists, mass actions, lead conversion, settings, users, send mail. Per-user datacenter routing. |
| [Zoho People](plugins/zoho-people) | hr | Zoho People HRIS via the myHub-hosted OAuth MCP gateway. Employees, departments, leave, attendance, timesheets, files, approvals, plus a generic forms CRUD escape hatch. |
| [Zoho Recruit](plugins/zoho-recruit) | recruiting | Zoho Recruit v2 (ATS) via the myHub-hosted OAuth MCP gateway. Candidates, job openings, clients, contacts, interviews, plus candidate↔job association, status changes, and resume upload/parse. |
| [Zoho Sign](plugins/zoho-sign) | e-signature | Zoho Sign v1 e-signature workflows via the myHub-hosted OAuth MCP gateway. Send documents for signature, manage templates, track requests, recall/remind, download signed PDFs. |

> Source of truth: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

---

## Documentation

The full developer documentation is published at **[mysmb-ai-studio.github.io/mysmb-marketplace](https://mysmb-ai-studio.github.io/mysmb-marketplace/)** and rebuilt automatically on every push to `main`.

| Topic | Where |
| --- | --- |
| **Getting started** | [docs site → Getting started](https://mysmb-ai-studio.github.io/mysmb-marketplace/intro) |
| **Plugin catalog (live, filterable)** | [docs site → Catalog](https://mysmb-ai-studio.github.io/mysmb-marketplace/catalog) |
| **Authoring guide (6 chapters)** | [docs site → Authoring](https://mysmb-ai-studio.github.io/mysmb-marketplace/authoring/overview) — MCP server, skills, agents, widget elements, validate & ship |
| **Widget tutorials (4 hands-on)** | [docs site → Widgets](https://mysmb-ai-studio.github.io/mysmb-marketplace/widgets/overview) — first widget → live data → computed transforms → composite multi-section |
| **Spec primitives** | [docs site → Spec primitives](https://mysmb-ai-studio.github.io/mysmb-marketplace/widgets/spec-primitives) — `$state`, `$computed`, `$item`, `$prop`, `$template`, `watch` |
| **Components reference** | [docs site → Components](https://mysmb-ai-studio.github.io/mysmb-marketplace/widgets/components-reference) |
| **About json-render** | [docs site → json-render](https://mysmb-ai-studio.github.io/mysmb-marketplace/widgets/json-render) → [Vercel json-render](https://json-render.vercel.app/) |
| **File-format reference** | [docs site → Reference](https://mysmb-ai-studio.github.io/mysmb-marketplace/reference/plugin-json) — `plugin.json`, `.mcp.json`, widget JSON, validator rules |
| **Single-page authoring summary** | [`CREATING_PLUGINS.md`](CREATING_PLUGINS.md) — the same content condensed into one file for offline reading |
| **OAuth gateway for hosted MCP servers** | [`myhub-mcp-servers` repo](https://github.com/mySMB-AI-Studio/myhub-mcp-servers) |
| **MyHub consumer integration** | [MyHub repo](https://github.com/mySMB-AI-Studio/myHubV2), `packages/shared/src/plugins/` |

---

## Policy

Every plugin in this marketplace follows three rules:

1. **Any MCP transport is allowed.** `stdio`, `sse`, and streamable `http` are all supported. Pick whichever the upstream server ships with — stdio for local subprocesses, sse/http for remote services. The MyHub tenant runtime is a Linux container with outbound networking, so remote MCP servers work fine.
2. **All credentials via environment variables.** No hardcoded secrets, no interactive prompts at runtime, no OS keyring access. MyHub's connection UI collects credentials, stores them in Key Vault, and injects them into the MCP client at session start — `env` for stdio, `headers` for sse/http. Claude Code users set the same variables in their shell. Every `${VAR}` placeholder must be documented in the plugin's README under a `## Configuration` heading — the validator enforces this.
3. **Pure Node, no native binaries, no platform-specific code.** The same build artefact has to run on every tenant container and every developer machine.

### Server-distribution preference

When you have a choice, pick the highest option on this list:

1. **Official upstream MCP servers on npm** (e.g. `@xeroapi/xero-mcp-server`). Plugins launch them with `npx -y <pkg>@latest`. Upstream owns schema changes; first-run install cost is amortised by the tenant container image.
2. **Official upstream remote MCP servers** over `sse` or `http`. No install cost, no version drift. Trade-off: you depend on upstream availability and rate limits.
3. **Custom servers maintained in this repo**, with the compiled `dist/` output committed under `plugins/<name>/server/dist/`. Use only when no upstream exists or it's missing critical functionality.

---

## How MyHub consumes this marketplace

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   This repo  ──► MyHub provisioner  ──► tenant Container App            │
│                       │                       │                          │
│                       │ reads                 │ starts MCP servers       │
│                       ▼                       ▼                          │
│         marketplace.json + each              one per enabled plugin,     │
│         plugin's .mcp.json + creds            credentials injected at    │
│                                               session start              │
└──────────────────────────────────────────────────────────────────────────┘
```

1. MyHub clones this repo at provisioning time and reads `.claude-plugin/marketplace.json`.
2. For each plugin a tenant has enabled, MyHub copies the plugin directory into the tenant's Claude Code config.
3. Reads `.mcp.json`, substitutes `${VAR}` placeholders with secrets from the tenant's Key Vault.
4. Starts the MCP server (subprocess for stdio, HTTP client for sse/http) when the tenant's Claude Code session begins.

---

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json        ← registry consumed by MyHub + Claude Code
├── plugins/
│   └── <plugin-name>/          ← one folder per plugin (see CREATING_PLUGINS.md)
├── scripts/
│   └── validate.ts             ← CI + local validator
├── CREATING_PLUGINS.md         ← author's guide
└── README.md                   ← this file
```

---

## Contributing

1. Read [CREATING_PLUGINS.md](CREATING_PLUGINS.md).
2. Scaffold your plugin under `plugins/<your-plugin>/`.
3. Add an entry to `.claude-plugin/marketplace.json`.
4. Run the validator locally — it must pass:
   ```bash
   npx tsx scripts/validate.ts
   ```
5. Open a PR. CI runs the same validator.

---

## License

MIT — see [LICENSE](LICENSE).

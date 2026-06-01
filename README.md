<div align="center">

# mySMB Marketplace

**Curated agent plugins for SMB-focused business integrations.**

Accounting, CRM, HR, payroll, community, productivity — wrapped as Model Context Protocol (MCP) servers and ready to install into [MyHub](https://github.com/mySMB-AI-Studio/myHubV2) tenants or directly into Claude Code.

### [Read the docs](https://mysmb-ai-studio.github.io/mysmb-marketplace/)

[Quick start](#quick-start) · [What you can build](#what-you-can-build) · [Catalog](#plugin-catalog) · [Install an existing plugin](#install-an-existing-plugin) · [Policy](#policy)

**New here?** → [DEVELOPER_BIBLE.md](./DEVELOPER_BIBLE.md) (the full reference) · [ONBOARDING.md](./ONBOARDING.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) · [CREATING_PLUGINS.md](./CREATING_PLUGINS.md)

**One repo, branch tiers:** `feature/* → dev → staging → main`. Plugin `.mcp.json` URLs use the **production** MCP host on every branch — myHub routes per-environment at runtime. See [CONTRIBUTING.md](./CONTRIBUTING.md#the-one-hard-rule-about-urls).

</div>

---

## Quick start

Scaffold a new plugin project and start building widgets in your browser:

```
npx --package github:mySMB-AI-Studio/mysmb-marketplace -- create-mysmb-plugin my-plugin
cd my-plugin
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — that's the **widget harness**. Edit a widget JSON and the preview updates live. The bottom panel lists every MCP server you've wired in `plugin/.mcp.json` and all the tools each one exposes.

In a second terminal, from the same folder:

```
claude
```

Claude Code reads the `CLAUDE.md` and `.claude/skills/` we shipped in the scaffold and knows how to author plugins. Try:

> "Add a widget that shows my five most recent invoices."
>
> "Add a `$computed` helper that formats dates as `dd MMM`."
>
> "Add a slash command for creating a new contact."

Claude writes the file, you reload the harness, the change is live.

> Don't have Node.js or Claude Code yet? Jump to [prerequisites](#prerequisites).

---

## What you can build

A plugin is a packaging unit. It can ship any combination of:

| Asset | What it is |
|---|---|
| **MCP server** | The tool API the LLM calls — `stdio`, `sse`, or `http`. Wire upstream npm packages or build your own. |
| **Skills** | Slash-command instructions for narrow tasks (`/<plugin>-<task>`). |
| **Agents** | A persona / sub-agent that owns a domain. |
| **Widgets** | Declarative JSON UI tiles for the MyHub dashboard. |
| **Widget elements** | JS helpers (`$computed` functions, composite components, actions) the widgets reference. |

You don't need all five. The minimum legal plugin is `plugin.json` + `.mcp.json` + `README.md`. Add the rest as your use case demands.

The same plugin installs in two places:

- **MyHub tenants** — auto-installed at provisioning time from the tenant's connector subscriptions.
- **Claude Code (CLI / Desktop / IDE)** — installed individually by any developer with one slash command.

---

## Prerequisites

Two things on your machine. Open your terminal and check whether each is already installed.

**Node.js 18 or newer.** Check with `node --version`. If you don't have it:

- **macOS** — [install Homebrew](https://brew.sh) once, then `brew install node`.
- **Windows** — `winget install OpenJS.NodeJS.LTS` from PowerShell, or grab the installer at [nodejs.org](https://nodejs.org).
- **Linux** — use your distro's package manager, or [the official binaries](https://nodejs.org/en/download).

**Claude Code or Claude Desktop.**

- **Claude Code (CLI, recommended for plugin building)** — `npm install -g @anthropic-ai/claude-code`. Then run `claude` from any folder. Setup guide: [docs.claude.com/claude-code](https://docs.claude.com/en/docs/claude-code/overview).
- **Claude Desktop** — download from [claude.ai/download](https://claude.ai/download). The MCP servers your plugin defines can be wired into Claude Desktop too once you publish.

---

## What's in the scaffold

```
my-plugin/
├── plugin/                       ← the publishable plugin (what ends up in the marketplace)
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json                 ← MCP server transport, ${VAR} credential placeholders
│   ├── README.md                 ← must contain a ## Configuration heading
│   ├── skills/                   ← slash-command instructions
│   ├── agents/                   ← personas
│   ├── widgets/                  ← declarative dashboard tiles (JSON)
│   └── widget-elements/          ← $computed helpers / composite components / actions
│
├── harness/                      ← local dev sandbox: Vite + React widget renderer
│   └── server/                   ←   Node backend that spawns the plugin's MCP servers
│
├── .claude/
│   ├── skills/                   ← composing-widgets, widget-elements-system,
│   │                                authoring-plugin-widget-elements, plugin-author
│   └── agents/plugin-builder.md
│
├── CLAUDE.md                     ← project orientation Claude reads on first turn
└── README.md                     ← per-project quickstart
```

The harness reads `plugin/widgets/*.json` for templates and `plugin/.mcp.json` for the live MCP client, so anything you (or Claude) write to `plugin/` shows up after a reload.

---

## Setting credentials

The harness reads `plugin/.mcp.json` and forwards `${VAR}` placeholders from your shell. Set them before `npm run dev`:

**macOS / Linux**
```
export MY_PLUGIN_API_TOKEN=xxx
npm run dev
```

**Windows PowerShell**
```
$env:MY_PLUGIN_API_TOKEN = "xxx"
npm run dev
```

Every `${VAR}` you reference in `.mcp.json` must also appear in `plugin/README.md` under a `## Configuration` heading — the marketplace validator enforces this.

---

## Publishing

When the plugin works the way you want:

1. Copy `plugin/` into the marketplace repo at `Plugins/plugins/<your-slug>/`.
2. Add an entry to `.claude-plugin/marketplace.json`.
3. From the marketplace root: `npx tsx scripts/validate.ts` — it must report `validate: OK`.
4. Open a PR.

Full reference: [`CREATING_PLUGINS.md`](CREATING_PLUGINS.md).

---

## Install an existing plugin

### In Claude Code

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install xero-accounting
```

Each plugin's README lists the env vars it needs under `## Configuration`.

### In a MyHub tenant

Tenants pick up new plugins automatically — MyHub clones this repo at provisioning time and installs every plugin a tenant has subscribed to. See the [MyHub repo](https://github.com/mySMB-AI-Studio/myHubV2) for the consumer-side wiring.

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
│   ├── create-plugin/          ← create-mysmb-plugin scaffolder + template
│   └── validate.ts             ← CI + local validator
├── CREATING_PLUGINS.md         ← author's guide
└── README.md                   ← this file
```

---

## License

MIT — see [LICENSE](LICENSE).

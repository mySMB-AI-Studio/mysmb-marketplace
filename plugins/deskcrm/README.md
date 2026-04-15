# deskcrm plugin

A lightweight SMB CRM backed by an Excel workbook. Part of the
[mySMB Marketplace](../../README.md).

The plugin ships a custom **stdio MCP server** that reads and writes
`data/deskcrm.xlsx` — a workbook with two sheets, `Contacts` and `Accounts`
— and exposes CRUD tools, skills, and a subagent on top of it.

> deskcrm is primarily a **testing** plugin. It lets MyHub and Claude Code
> exercise the full plugin lifecycle (manifest, stdio server, skills,
> agents, validator) against a realistic CRM-shaped dataset without
> depending on a third-party API or credentials.

## What it does

### Slash commands

| Command | What it does |
| ------- | ------------ |
| `/deskcrm:find-contact` | Search contacts by status, company, or free-text query. |
| `/deskcrm:add-contact` | Create a new row in the Contacts sheet. |
| `/deskcrm:update-contact` | Patch fields on an existing contact. |
| `/deskcrm:accounts-pipeline` | Summarise the Accounts pipeline by stage, owner, industry, or ARR. |
| `/deskcrm:manage-account` | Create, update, or delete an account. |

### Subagent

- **`deskcrm-assistant`** — general-purpose CRM assistant. Answers
  questions about contacts and accounts, summarises the pipeline, and
  handles writes. Treats churn as an update (not a delete), resolves
  names before writing, and refuses to invent missing data.

### MCP tools

The stdio server exposes ten tools:

| Tool | Operation | Notes |
| ---- | --------- | ----- |
| `list_contacts` | read | filters: `status`, `company`, `query`, `limit` |
| `get_contact` | read | by `id` |
| `create_contact` | write | requires `firstName`, `lastName`; assigns `id` + timestamps |
| `update_contact` | write | whitelisted fields only; `id` and `createdAt` are immutable |
| `delete_contact` | write | returns the removed row |
| `list_accounts` | read | filters: `stage`, `industry`, `owner`, `query`, `limit` |
| `get_account` | read | by `id` |
| `create_account` | write | requires `name` |
| `update_account` | write | whitelisted fields only |
| `delete_account` | write | returns the removed row |

## Data model

### Contacts sheet

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string | `cnt_<10hex>` — assigned by the server |
| `firstName` | string | required on create |
| `lastName` | string | required on create |
| `email` | string | |
| `phone` | string | |
| `company` | string | free-form |
| `title` | string | |
| `status` | enum | `active`, `lead`, `churned`, `archived` |
| `tags` | string | comma-separated |
| `notes` | string | free-form |
| `createdAt` | ISO timestamp | |
| `updatedAt` | ISO timestamp | refreshed on every write |

### Accounts sheet

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string | `acc_<10hex>` — assigned by the server |
| `name` | string | required on create |
| `industry` | string | free-form (e.g. SaaS, Home Services) |
| `employees` | number | |
| `website` | string | |
| `phone` | string | |
| `billingCity` | string | |
| `billingCountry` | string | |
| `owner` | string | sales rep name |
| `stage` | enum | `prospect`, `qualified`, `customer`, `churned` |
| `arr` | number | annual recurring revenue (USD) |
| `renewalDate` | ISO date | `YYYY-MM-DD` |
| `notes` | string | |
| `createdAt` | ISO timestamp | |
| `updatedAt` | ISO timestamp | |

## Architecture

```
 ┌──────────────────┐  JSON-RPC 2.0 (stdin/stdout)   ┌──────────────────┐
 │  Claude / MyHub  │ ─────────────────────────────▶ │  deskcrm server  │
 │  MCP host        │ ◀───────────────────────────── │  (Node, bundled) │
 └──────────────────┘                                └────────┬─────────┘
                                                              │ read/write
                                                              ▼
                                                   ┌────────────────────┐
                                                   │ data/deskcrm.xlsx  │
                                                   │  Contacts sheet    │
                                                   │  Accounts sheet    │
                                                   └────────────────────┘
```

The server is a hand-rolled MCP implementation in plain CommonJS — no
`@modelcontextprotocol/sdk` dependency — bundled into a single file at
`server/dist/index.js` using esbuild. This keeps the install footprint to
one committed file and avoids any install-time steps when the plugin is
loaded into a tenant container.

`xlsx` (SheetJS) is the only runtime dependency and is inlined into the
bundle. The plugin is pure Node with no native binaries, as required by
the marketplace policy.

## Configuration

The plugin has **no required configuration**. It runs out of the box
against the sample workbook bundled at `data/deskcrm.xlsx`, which the
server locates via `CLAUDE_PLUGIN_ROOT` (set automatically by the MCP
host to the plugin install directory).

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `CLAUDE_PLUGIN_ROOT` | auto | Set by the MCP host. The server uses it to locate the default workbook at `${CLAUDE_PLUGIN_ROOT}/data/deskcrm.xlsx`. |
| `DESKCRM_WORKBOOK_PATH` | optional | Advanced override. Absolute path to a different Excel workbook. Not exposed through the MyHub connection UI — set it directly on the tenant container's environment if you want to point at a persistent path on the Azure File Share (e.g. `/data/deskcrm/workbook.xlsx`). Takes precedence over `CLAUDE_PLUGIN_ROOT` when set. |

The server exits with a clear stderr message if no workbook can be
resolved from either variable.

## Install (Claude Code)

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install deskcrm@mysmb-marketplace
```

No credentials to set — restart your session and the sample workbook is
ready.

## Rebuilding the server bundle

The plugin ships a pre-built bundle at `server/dist/index.js` that is
committed to the repo. If you edit `server/src/index.js`, rebuild with:

```bash
cd plugins/deskcrm/server
npm install
npm run build
```

The build uses `esbuild` to produce a single CommonJS file targeting
Node 18+. Do **not** commit `node_modules/` — it is gitignored.

## Regenerating the sample workbook

If the sample data drifts or you want to reset it:

```bash
cd plugins/deskcrm/server
npm run seed
```

This overwrites `data/deskcrm.xlsx` with six seeded contacts and six
seeded accounts spanning the full range of statuses and stages.

## License

MIT.

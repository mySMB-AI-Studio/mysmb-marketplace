# Creating a Plugin

A complete, end‑to‑end guide to authoring a plugin for the **mySMB Marketplace** — the registry consumed by **MyHub** tenants and by individual Claude Code users.

A plugin is a packaging unit. It can ship any combination of:

| Asset | What it is | Lives in |
|---|---|---|
| **MCP server** | The tool API the LLM calls | `.mcp.json` (+ optional `server/`) |
| **Skills** | Slash‑command instructions for narrow tasks | `skills/*.md` |
| **Agents** | A persona / sub‑agent that owns a domain | `agents/*.md` |
| **Widget elements** | JS helpers (`$computed` functions, composite components, actions) | `widget-elements/` |
| **Widgets** | Declarative JSON UI specs | `widgets/*.json` |

You don't need all five. The minimum legal plugin is `plugin.json` + `.mcp.json` + `README.md`. Add the others as your use case demands.

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Repository layout](#2-repository-layout)
3. [Step 1 — Scaffold the plugin](#3-step-1--scaffold-the-plugin)
4. [Step 2 — Wire the MCP server](#4-step-2--wire-the-mcp-server)
5. [Step 3 — Add skills](#5-step-3--add-skills)
6. [Step 4 — Add an agent](#6-step-4--add-an-agent)
7. [Step 5 — Add widget elements](#7-step-5--add-widget-elements)
8. [Step 6 — Add widgets](#8-step-6--add-widgets)
9. [Step 7 — Register in `marketplace.json`](#9-step-7--register-in-marketplacejson)
10. [Step 8 — Validate, commit, ship](#10-step-8--validate-commit-ship)
11. [Reference: file formats](#11-reference-file-formats)
12. [Reference: rules the validator enforces](#12-reference-rules-the-validator-enforces)
13. [FAQ & gotchas](#13-faq--gotchas)

---

## 1. Mental model

```
┌──────────────────────────────────────────────────────────────────┐
│                          MyHub tenant                             │
│                                                                   │
│   user prompt ──► agent (Claude) ──► MCP tool ──► your API       │
│                       │                  ▲                       │
│                       │                  │                       │
│                       ▼                  │                       │
│                   widget JSON ─── $computed ─── widget-elements   │
└──────────────────────────────────────────────────────────────────┘
```

- The **MCP server** is what the LLM actually calls. It exposes business actions as typed tools.
- **Skills** and **agents** teach the LLM *how* to use those tools well.
- **Widgets** turn tool responses into a UI tile on the dashboard.
- **Widget elements** are the small JS helpers (date formatting, status‑to‑colour mapping, tree flattening) that the JSON spec invokes via `$computed`.

A plugin is just the bundle that ships these together so a tenant can opt in or out as one unit.

---

## 2. Repository layout

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
│   ├── <plugin>-do-thing-a.md
│   └── <plugin>-do-thing-b.md
│
├── agents/                    ← OPTIONAL: one .md per persona
│   └── <plugin>-assistant.md
│
├── widget-elements/           ← OPTIONAL: $computed helpers / components / actions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          → dist/index.js (commit dist/)
│       └── types.ts
│
└── widgets/                   ← OPTIONAL: dashboard tiles
    ├── <plugin>-thing.json
    └── <plugin>-other.json
```

---

## 3. Step 1 — Scaffold the plugin

Pick a slug. Lowercase, hyphen‑separated, globally unique within the marketplace. We'll use `acme-billing` as our running example.

```bash
mkdir -p plugins/acme-billing/.claude-plugin
mkdir -p plugins/acme-billing/skills
mkdir -p plugins/acme-billing/agents
mkdir -p plugins/acme-billing/widgets
```

Create `plugins/acme-billing/.claude-plugin/plugin.json`:

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

Create `plugins/acme-billing/README.md` with at minimum:

```markdown
# Acme Billing plugin

Wraps the Acme REST API as an MCP server.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ACME_API_TOKEN` | yes | Bearer token from Acme → Settings → API. |
| `ACME_BASE_URL`  | no  | Override the API host. Defaults to `https://api.acme.com`. |
```

> **Validator rule:** every `${VAR}` placeholder you reference in `.mcp.json` must appear in this `## Configuration` section. The token has to be ALL_CAPS_SNAKE and at least 3 chars.

---

## 4. Step 2 — Wire the MCP server

You have three transports to choose from. Pick whichever the upstream offers; only build a custom server when no upstream exists.

### Option A — `stdio` to an upstream npm package (preferred)

Zero code in this repo. The runtime spawns the package via `npx`.

```json
{
  "mcpServers": {
    "acme-billing": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@acme/mcp-server@latest"],
      "env": {
        "ACME_API_TOKEN": "${ACME_API_TOKEN}",
        "ACME_BASE_URL":  "${ACME_BASE_URL}"
      }
    }
  }
}
```

### Option B — Remote `sse` or `http` (preferred when upstream offers it)

```json
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

For OAuth‑backed integrations we host a gateway at `myhub-mcp-servers` — point your plugin at `https://myhub-mcp-servers.<…>.azurecontainerapps.io/<route>/mcp` and you skip token wiring entirely (see `myhub-mcp-servers/README.md`).

### Option C — Custom stdio server (only when no upstream exists)

```
plugins/acme-billing/server/
├── package.json
└── src/index.js   → built to dist/index.js (esbuild bundle, CJS, target node18)
```

`server/package.json`:

```json
{
  "name": "@mysmb/acme-billing-mcp-server",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "esbuild src/index.js --bundle --platform=node --target=node18 --format=cjs --outfile=dist/index.js"
  },
  "devDependencies": { "esbuild": "0.24.0" }
}
```

`.mcp.json`:

```json
{
  "mcpServers": {
    "acme-billing": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/dist/index.js"],
      "env": {
        "ACME_API_TOKEN": "${ACME_API_TOKEN}",
        "ACME_BASE_URL":  "${ACME_BASE_URL}"
      }
    }
  }
}
```

`${CLAUDE_PLUGIN_ROOT}` is reserved — the runtime substitutes the absolute path to your plugin directory. Always use it; never hard‑code paths.

**Custom server checklist**

- Pure Node, no native modules, no platform‑specific code.
- Read every credential from `process.env`. Exit with a clear `console.error` + non‑zero code if a required var is missing.
- Implement the MCP wire protocol (`initialize`, `tools/list`, `tools/call`) — see `plugins/deskcrm/server/src/index.js` for a reference implementation.
- Build with esbuild, **commit `dist/`**. The runtime must not have to install anything.

---

## 5. Step 3 — Add skills

A skill is a single Markdown file that teaches the model how to perform one well‑scoped task. Skills become available as slash commands.

`plugins/acme-billing/skills/acme-billing-create-invoice.md`:

```markdown
---
name: acme-billing-create-invoice
description: Draft a new invoice in Acme. Use when the user says "invoice X for $Y", "bill the customer", or asks to create a new invoice line.
---

# Create an invoice

Use the `create_invoice` tool. The tool returns the new invoice with its server-assigned `id` and `number`.

## Required fields

- `customerId` — resolve from name with `find_customer` first; if more than one match, ask which.
- `lineItems` — array of `{ description, quantity, unitPrice }`. Never invent prices; ask if missing.

## Working style

1. Resolve the customer before creating.
2. Confirm totals out loud before calling the tool.
3. After success, echo the invoice number and total.
4. On 4xx errors, surface the message verbatim — do not retry.
```

**Skill rules**

- One skill per file. Filename = skill name = the `name:` in frontmatter.
- Prefix with the plugin slug so skills don't collide across plugins.
- Frontmatter requires `name` and `description`. The description is what the LLM matches against the user's prompt to decide whether to load the skill — be specific about trigger phrases.
- Body: short, imperative, second person. Tell the model what to do, in what order, and what *not* to do.

---

## 6. Step 4 — Add an agent

Agents are heavier than skills — a complete persona with goals, scope boundaries, and tool inventory. Use one when a domain (a CRM, a billing system) deserves a dedicated assistant the user can address by name.

`plugins/acme-billing/agents/acme-billing-assistant.md`:

```markdown
---
name: acme-billing-assistant
description: Acme billing assistant. Use for invoices, customers, payments, dunning, and revenue questions. Handles read and write operations.
---

# Acme Billing Assistant

You are the billing assistant for a small business. Your only source of truth is the Acme API via the `acme-billing` MCP server.

## What you do
- Answer questions about invoices, customers, and payments.
- Create and update invoices when the user gives you the line items.
- Flag overdue invoices when asked about cash flow.

## What you do NOT do
- You do not send emails, take payments, or schedule reminders.
- You do not invent data. Empty fields stay empty.
- You do not batch-delete. One delete at a time, explicitly authorised.

## Working style
- **Resolve before you write** — look up customers by name first.
- **Prefer updates over create+delete.**
- **Summary over dump** — counts and totals first, details on request.

## Tools available
Invoices: `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `void_invoice`.
Customers: `list_customers`, `get_customer`, `create_customer`, `update_customer`.
Payments: `list_payments`, `record_payment`.
```

**Agent rules**

- Same frontmatter as skills (`name`, `description`).
- Describe scope **and** anti‑scope. The "what you do NOT do" section is the load‑bearing one — it's what stops the model from confidently hallucinating capabilities.
- List the tools the agent should reach for. The agent can technically call any MCP tool the tenant has installed, but the inventory shapes its defaults.

---

## 7. Step 5 — Add widget elements

Widget elements are JS helpers that widgets reference from their JSON specs. There are three kinds:

| Kind | Use for | Spec reference |
|---|---|---|
| `functions` | Pure `$computed` helpers (format dates, derive tones, flatten trees) | `<slug>_<snake_name>` |
| `components` | Composite components built from system primitives | `<slug>/<PascalName>` |
| `actions` | Side‑effectful operations (rare in v1) | `<slug>_<snake_name>` |

### When to put a helper here vs. in the system baseline

- **System baseline** (`apps/web/src/features/widgets-system/system/` in MyHub): connector‑agnostic. Anyone could use it. Example: `format_currency`, `truncate_text`.
- **Plugin widget‑elements**: only makes sense for *this* connector's payload shape. Example: `xero_format_date` (handles Xero's `/Date(…)/` format), `acme_invoice_status_tone`.

If you'd write the same helper for any connector, it doesn't belong here — push it to system.

### Layout

```
widget-elements/
├── package.json
├── tsconfig.json
└── src/
    ├── types.ts      ← local mirror of the host's contract
    └── index.ts      ← default export: PluginElementsModule
```

`src/types.ts` (copy verbatim — this matches the host structurally):

```ts
export type ComputedFunction = (args: Record<string, unknown>) => unknown;

export interface CompositeComponentDef {
  kind: 'composite';
  spec: { root: string; elements: Record<string, unknown> };
  props?: string[];
}

export interface PluginWidgetAction {
  description: string;
  schema: unknown;
  handler: (params: Record<string, unknown>) => Promise<void> | void;
}

export interface PluginElementsModule {
  slug: string;
  components?: Record<string, CompositeComponentDef>;
  functions?: Record<string, ComputedFunction>;
  actions?: Record<string, PluginWidgetAction>;
}
```

`src/index.ts`:

```ts
import type { ComputedFunction, PluginElementsModule } from './types';

const invoice_status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'PAID')      return 'success';
  if (s === 'OVERDUE')   return 'destructive';
  if (s === 'DRAFT')     return 'muted';
  if (s === 'SENT')      return 'info';
  return 'default';
};

const days_overdue: ComputedFunction = (args) => {
  const ms = Date.parse(String(args.value ?? ''));
  if (!Number.isFinite(ms)) return 0;
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.now() - ms) / day);
};

const elements: PluginElementsModule = {
  slug: 'acme-billing',
  functions: {
    invoice_status_tone,
    days_overdue,
  },
};

export default elements;
```

`package.json`:

```json
{
  "name": "@mysmb/acme-billing-widget-elements",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "devDependencies": { "typescript": "^5.4.0" }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

Build it: `npm install && npm run build`. **Commit the `dist/` folder.** The host loads `dist/index.js` directly — no install at runtime.

The host namespaces every name with the slug, so spec authors will write `acme-billing_invoice_status_tone`, not `invoice_status_tone`.

---

## 8. Step 6 — Add widgets

A widget is a JSON file that declares (1) which MCP tool to call, and (2) how to render the response. The MyHub `widgets-system` interprets the JSON.

Minimum shape:

```json
{
  "id": "acme-overdue-invoices",
  "title": "Overdue Invoices",
  "description": "All Acme invoices past their due date.",
  "category": "finance",
  "tags": ["acme", "invoices", "overdue"],
  "keywords": ["overdue", "late", "ar", "receivables"],
  "connectorsUsed": ["acme-billing"],
  "popularity": 0,
  "sizing": {
    "preferred": { "colSpan": 5, "rowSpan": 4 },
    "min":       { "colSpan": 4, "rowSpan": 3 },
    "max":       { "colSpan": 10, "rowSpan": 8 }
  },
  "dataProvider": {
    "mcp": "acme-billing",
    "tool": "list_invoices",
    "params": { "status": "overdue" }
  },
  "spec": {
    "root": "card",
    "elements": {
      "card": {
        "type": "Card",
        "children": ["header", "table"]
      },
      "header": {
        "type": "Header",
        "props": { "title": "Overdue invoices" }
      },
      "table": {
        "type": "Table",
        "props": {
          "rows": { "$state": "/acme-billing/list_invoices" },
          "columns": [
            { "key": "number",     "label": "#" },
            { "key": "customer",   "label": "Customer" },
            { "key": "total",      "label": "Total", "format": "currency" },
            {
              "key": "dueDate",
              "label": "Days late",
              "value": { "$computed": "acme-billing_days_overdue", "args": { "value": { "$item": "dueDate" } } }
            },
            {
              "key": "status",
              "label": "Status",
              "tone": { "$computed": "acme-billing_invoice_status_tone", "args": { "value": { "$item": "status" } } }
            }
          ]
        }
      }
    }
  }
}
```

**Key spec primitives**

| Primitive | Meaning |
|---|---|
| `$state`    | Read from the live data store at this JSON pointer. The MCP response lands at `/<mcp>/<tool>/…`. |
| `$computed` | Call a widget‑element function (`<slug>_<name>` for plugins, bare name for system). |
| `$item`     | Inside a row/list iterator, refers to the current item. |
| `$prop`     | Read from this element's `props`. |
| `$template` | String interpolation: `"Hello {{name}}"`. |
| `watch`     | Run an `action` when a `$state` path changes. |

For the full vocabulary, run the `widget-elements-system` skill in MyHub or read `apps/web/src/features/widgets-system/`.

**Widget rules**

- Filename, `id`, and on‑disk slug must match.
- Every name in `connectorsUsed` must match an MCP server the tenant has installed (otherwise the widget is hidden).
- Use `$computed` for any non‑trivial transform — don't try to pre‑shape data in the spec.
- Sizing: `preferred` is what the agent drops on the dashboard, `min`/`max` are the resize bounds.

---

## 9. Step 7 — Register in `marketplace.json`

Add an entry to `.claude-plugin/marketplace.json` at the marketplace root:

```json
{
  "name": "acme-billing",
  "displayName": "Acme Billing",
  "description": "Acme billing — invoices, customers, payments. Stdio MCP server, bearer-token auth.",
  "category": "billing",
  "version": "0.1.0",
  "author": { "name": "Your Org" },
  "tags": ["acme", "billing", "invoices", "smb"],
  "source": "./plugins/acme-billing",
  "widgets": "widgets",
  "widgetElements": "widget-elements/dist/index.js"
}
```

Drop the `widgets` / `widgetElements` keys if your plugin doesn't ship them.

---

## 10. Step 8 — Validate, commit, ship

```bash
# from the marketplace repo root
npx tsx scripts/validate.ts
```

Fix anything it complains about, then:

```bash
git add plugins/acme-billing .claude-plugin/marketplace.json
git commit -m "feat(plugins): add acme-billing"
git push origin feature/acme-billing
gh pr create
```

CI runs the same validator. Once merged, MyHub picks the plugin up at the next tenant provisioning / refresh.

---

## 11. Reference: file formats

### `.claude-plugin/plugin.json`

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Must equal the directory name. |
| `version` | ✅ | SemVer. |
| `description` | ✅ | One line. |
| `author` | ✅ | `{ "name": "…" }`. |
| `homepage` | recommended | Link to the plugin's folder on GitHub. |
| `license` | recommended | Usually `MIT`. |
| `keywords` | recommended | Used for search. |
| `widgets` | when present | Path to widgets dir, relative to plugin root. |
| `widgetElements` | when present | Path to compiled JS module, relative to plugin root. |

### `.mcp.json`

```json
{ "mcpServers": { "<id>": { "type": "stdio" | "sse" | "http", … } } }
```

| Transport | Required keys | Credentials go in |
|---|---|---|
| `stdio` | `command`, `args`, `env` | `env` |
| `sse`   | `url`, optional `headers` | `headers` |
| `http`  | `url`, optional `headers` | `headers` |

`${VAR}` placeholders are resolved at session start from the tenant's secret store. `${CLAUDE_PLUGIN_ROOT}` is reserved — it expands to the plugin's absolute path.

### Skill / agent frontmatter

```yaml
---
name: <slug>-<short-name>
description: <one sentence — used by the model to decide when to load it>
---
```

### Widget‑elements module

A default export of `PluginElementsModule` — see [Step 5](#7-step-5--add-widget-elements). The host loads `dist/index.js`; the source `.ts` is for your own development.

### Widget JSON

Required top‑level keys: `id`, `title`, `description`, `category`, `tags`, `connectorsUsed`, `sizing`, `dataProvider`, `spec`. Recommended: `keywords`, `popularity`.

---

## 12. Reference: rules the validator enforces

From `scripts/validate.ts`:

1. `.claude-plugin/marketplace.json` exists and parses.
2. Every plugin in `marketplace.json` has a matching directory under `plugins/`.
3. Every plugin directory has `.claude-plugin/plugin.json`, `.mcp.json`, and `README.md`.
4. Every MCP server declares a recognised `type` — `stdio`, `sse`, or `http`.
5. Every `${VAR}` placeholder in `.mcp.json` (env or headers) is either `CLAUDE_PLUGIN_ROOT` or appears under a `## Configuration` heading in the plugin README.

Other rules enforced by convention (and reviewed in PR):

- Pure Node only — no native modules, no `node-gyp`, no platform‑specific code.
- No hardcoded credentials, no interactive prompts at runtime, no OS keyring access.
- Custom servers ship pre‑compiled `dist/` so runtime install cost is zero.
- Skill / agent / widget‑element / widget names are slug‑prefixed to prevent collisions.

---

## 13. FAQ & gotchas

**Do I need all five asset types?**
No. The minimum legal plugin is `plugin.json` + `.mcp.json` + `README.md`. Add skills/agents/widgets/widget‑elements only when they earn their keep.

**Can a plugin ship multiple MCP servers?**
Yes — `.mcp.json` is keyed by server id, so you can list several. The Microsoft 365 plugin does this (one server per Graph scope).

**Where do credentials come from in production?**
MyHub's connection UI collects them, stores them in Key Vault, and injects them at session start as either `env` (stdio) or `headers` (sse/http). Claude Code users set the same variables in their shell. Either way, your plugin only ever sees `${VAR}` placeholders in source.

**My helper would be useful for any connector — should I put it in widget‑elements?**
No. Push it to the system baseline (`apps/web/src/features/widgets-system/system/` in MyHub). The plugin folder is for connector‑specific code only.

**My MCP server needs to mutate state on the tenant container — what's available?**
Only what you read from environment variables. There is no shared filesystem, no cross‑tenant state, no host calls. Treat the MCP server as a stateless function from `(env, args)` to `result`.

**Why are widget‑element names namespaced (`acme-billing_days_overdue`) but tool names aren't?**
MCP tool names are scoped per server connection, so `acme-billing.list_invoices` is already disambiguated by the server id. Widget‑element functions live in a single global registry on the dashboard, so the host prefixes them at load time to avoid collisions.

**How do I test locally without MyHub?**
Install the marketplace into Claude Code:

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install acme-billing
```

Set the env vars in your shell, then talk to the plugin from a Claude Code session.

---

*Last updated: May 2026.*

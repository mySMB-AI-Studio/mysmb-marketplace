# myConnect Builder

Turns myConnect change requests into a WorkQ-driven build pipeline. The project manager
files a **myConnect Change Request** WorkQ item (template included), attaches the change
document, and assigns it to the **myConnect Builder** account. A laptop-side daemon (the
**bridge**, in [`bridge/`](bridge/)) picks the item up over the workspace's external MCP
endpoint, drives Claude Code against the myConnect repository, and reports plans,
progress, QA builds, and deployments back on the item. Humans approve at two gates:
plan approval and release approval.

Design spec: myHubV2 `docs/superpowers/specs/2026-08-12-myconnect-builder-agent-design.md`.

## What installs into the workspace

- **WorkQ template** — "myConnect Change Request" (Goal/Scope/Acceptance scaffold, a
  Request Title slot, and a principal slot for assigning the builder).
- **Skill** — `requesting-myconnect-changes`: teaches the workspace AI to explain the
  flow, the `mcb:*` stage labels, and the approval commands.
- `agents/myconnect-builder.md` is a **dormant v2 blueprint** (deliberately not listed in
  `content.agents`) — see the comment inside it.

No MCP server is installed in the tenant (`.mcp.json` is intentionally empty): the
bridge is an MCP **client** of the workspace, not a server inside it.

## Configuration

This plugin has no tenant-side environment variables. All configuration lives in the
bridge's local `bridge.config.json` (see `bridge/bridge.config.example.json`):

| Field | Meaning |
|---|---|
| `workspaceMcpUrl` | The workspace's external MCP resource URI, e.g. `https://<host>/mcp` |
| `builderUserId` | `users.id` of the myConnect Builder service account items are assigned to |
| `approverUserIds` | Comment authors allowed to advance gates (`approve plan` / `approve release`) |
| `intakeAllowlistUserIds` | Item **creators** the bridge accepts work from |
| `repoPath` | Local myConnect repository path Claude Code runs in |
| `pollSeconds` | Queue poll interval (default 45) |
| `claudeBin` | Claude Code CLI binary (default `claude`) |
| `oauthCallbackPort` | Localhost port for the one-time OAuth redirect (default 8976) |
| `stages.*` | Per-stage Claude permission mode + timeout |

## Bridge setup (developer laptop)

Prerequisites: Node 20+, Claude Code CLI installed and signed in, the myConnect repo
cloned locally, and the tenant's MCP endpoint enabled (workspace admin →
Integrations → MCP).

```bash
cd bridge
npm install
npm run build
cp bridge.config.example.json bridge.config.json   # then fill it in
node dist/index.js bridge.config.json
```

First run opens a browser for OAuth — **sign in as the myConnect Builder service
account** and approve the `workq:read workq:write` scopes. Tokens persist to
`.mcb-auth.json` (rotating refresh, 60-day idle window); no secrets ever live in this
repository.

## Pipeline

| Stage label | Meaning | Exit |
|---|---|---|
| `mcb:planning` | Reading request + attachments, writing the execution plan (plan-mode Claude run) | Plan posted (summary comment + `execution-plan.md` attachment) |
| `mcb:plan-review` | Waiting on the PM | `approve plan` / `request changes: …` |
| `mcb:executing` | Implementing, testing, deploying to QA | QA-ready comment |
| `mcb:qa-review` | PM verifies QA | `approve release` / `request changes: …` |
| `mcb:deploying` | UAT → verify → Production → verify | Completion summary, status `done` |
| `mcb:blocked` / `mcb:hold` | Needs input / paused | approver comments `resume` |

Security model: gate commands are honored only when the **comment author's user id** is
in `approverUserIds`; items are only picked up when the **creator's user id** is in
`intakeAllowlistUserIds`. Text from anyone else never reaches Claude Code.

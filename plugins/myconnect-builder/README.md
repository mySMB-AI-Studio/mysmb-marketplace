# myConnect Builder

Turns myConnect change requests into WorkQ-driven delivery, split across two parties:

- **myConnect Builder** — a tenant-level **platform agent** installed into the
  workspace by this plugin. It runs on the normal workspace agent runtime and does
  intake only: understand the request, ask the clarifying questions a developer
  would need answered, write the brief onto the item, hand off. It has **no access
  to the myConnect codebase**.
- **The build runner** — a Claude Code routine, on a schedule, working against the
  myConnect repository. It polls the workspace's external MCP endpoint for items
  the agent has marked ready, writes the execution plan, makes the code changes,
  deploys, and posts every step back on the item **as the agent**.

Design spec: myHubV2 `docs/superpowers/specs/2026-08-18-myconnect-builder-platform-agent.md`.

## What installs into the workspace

- **Platform agent** — `myConnect Builder` (`content/agents/…json`, authored in
  [`agents/myconnect-builder.md`](agents/myconnect-builder.md)). `platform: true`
  so it is ownerless and provisioned once for the whole tenant; `audience: users`
  so an admin picks who may direct it.
- **WorkQ template** — "myConnect Change Request" (Goal/Scope/Acceptance scaffold).
- **Skill** — `requesting-myconnect-changes`: teaches the workspace AI how the flow
  reads from a requester's point of view.

No MCP server is installed in the tenant (`.mcp.json` is intentionally empty) and
there is **no daemon to run**. The runner is an MCP *client* of the workspace.

## Configuration

None. This plugin has no tenant-side environment variables and no config file.

## Handoff mechanics

The two halves meet on one hidden field, `todos.agent_state` — a WorkQ handoff
signal that is invisible in the UI and never set by a human:

| `agent_state` | Set by | Meaning |
|---|---|---|
| *(null)* | — | Not part of a build pipeline |
| `ready` | the agent | Brief confirmed — the runner may pick this up |
| `working` | the runner | Claimed and executing |
| `blocked` | the runner | Needs a decision only a person can make |
| `done` | the runner | Runner finished its side |

The agent sets it with `todo_update`; the runner reads and writes it with
`workq_agent_inbox` / `workq_agent_update`. Because the gate is explicit, a request
still being clarified is never picked up.

## Setting up the build runner

Everything the runner needs is generated in the workspace: as a tenant admin open
**mySidekick → Agents → myConnect Builder → Claude Code**. The dialog has three
parts (myHubV2 spec `2026-08-19-platform-agent-claude-code-runner.md`):

1. **Setup kit** — the MCP endpoint URL, the scopes to grant (`workq:read`,
   `workq:write`, `agent:impersonate` — the last shows on the consent screen as
   *Act as a workspace agent*), the *Act as* name to pick (**myConnect Builder**),
   a suggested routine name, the repository and schedule from this plugin's
   `runner-*` frontmatter, and the runner prompt — each with a Copy button.
   Create the routine at claude.ai/code/routines from it.
2. **API trigger** — on the routine add *another trigger → API → Generate token*,
   paste the `trig_…` id and the token here. The token is stored encrypted and
   never shown again. With **Fire on handoff** on, the workspace fires the routine
   the moment the agent marks an item ready (and again after `blocked → ready`),
   naming the item in the run context so the runner skips the poll. **Test fire**
   confirms the wiring and links the session.
3. **Recent fires** — status, attempts, session link, last error.

The runner authenticates to the workspace MCP endpoint as a human but **authors
as the agent** — comments read as myConnect Builder, not as whoever connected.
That binding is chosen once, on the OAuth consent screen (*Act as*); it is
fire-scoped to that one agent and survives token refresh. Requires the platform
agent to be provisioned in the tenant first — an unprovisioned or admin-suspended
agent does not appear in the picker.

The schedule stays as a safety net: if a fire fails terminally (token rotated,
routine paused) the workspace shows it on the agent card and the next scheduled
run still picks the item up.

### Frontmatter used by the setup kit

```yaml
runner: claude-code
runner-repository: mySMB-AI-Studio/myconnect
runner-schedule: */30 * * * *
```

Flat keys (the agent frontmatter parser is line-based). Regenerate the content
payload after editing the agent markdown:

```bash
# from the myHubV2 repo root
npx tsx scripts/regen-plugin-agent-payload.ts ../mysmb-marketplace/plugins/myconnect-builder myconnect-builder
```

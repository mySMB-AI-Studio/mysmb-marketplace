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

The runner authenticates to the workspace MCP endpoint as a human, but **authors
as the agent** — comments read as myConnect Builder, not as whoever connected.
That binding is chosen once, on the workspace's OAuth consent screen:

1. Workspace admin → Integrations → MCP: make sure the endpoint is enabled.
2. Add the workspace as a connector in Claude Code and start the OAuth flow.
3. On the consent screen, grant `workq:read`, `workq:write`, and
   **Act as a workspace agent**, then pick **myConnect Builder** under *Act as*.
4. Create a Claude Code routine on a schedule whose prompt polls
   `workq_agent_inbox` with `agentState: 'ready'`, does the work in the myConnect
   repo, and reports back with `workq_agent_comment` / `workq_agent_update`.

The grant is fire-scoped to that one agent: it cannot act as any other agent, and
the binding survives token refresh. Requires the platform agent to be provisioned
in the tenant first — an unprovisioned or admin-suspended agent does not appear in
the picker.

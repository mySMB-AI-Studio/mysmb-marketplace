---
name: master-agent-list-agents
description: Discover and list the Microsoft Copilot Studio agents available in the user's tenant. Use when the user asks "which agents can I talk to?", "what copilots are available?", or before routing a question to a specialist for the first time.
---

# List the tenant's Copilot Studio agents

Use the `list_copilot_agents` tool to discover every Copilot Studio agent the signed-in user can reach.

## How to use

1. Call `list_copilot_agents` with no arguments to search across all of the user's Power Platform environments. Pass `environment_id` only if the user wants to scope to a specific environment.
2. The tool returns `{ count, agents }`. Each agent has `name`, `schemaName`, `description`, `environmentId`, and `environmentName`.
3. Discovery is cached for ~10 minutes — don't call repeatedly in one conversation. Re-call only if the user says an agent is missing or was just published.

## Rendering

- Summarise as a compact list grouped by `environmentName` when there is more than one environment: for each agent show `name` and a one-line take on its `description`.
- If `count` is 0, say so plainly: no Copilot Studio agents were found for this account. Suggest the user confirm they have access to a Power Platform environment with published agents — do not invent agents.
- `schemaName` / `environmentId` are internal identifiers for tool calls. Don't surface them unless the user is troubleshooting.

## Next step

Once the user picks (or you infer) an agent, hand off to `master-agent-ask` to send it a question.

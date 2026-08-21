---
name: master-agent-ask
description: Delegate a question to a specific Microsoft Copilot Studio agent and synthesize the reply. Use when the user @-mentions or names an agent, or once you've identified the right specialist for their request.
---

# Ask a Copilot Studio agent

Use the `ask_copilot_agent` tool to send a message to one specialist agent and return its answer.

## Inputs

- `agent_schema_name` — the agent's `schemaName` (from `list_copilot_agents`). Required.
- `environment_id` — the `environmentId` the agent lives in (from `list_copilot_agents`). Required.
- `message` — the question to send. Rephrase the user's request for clarity if helpful, but don't change its intent.
- `conversation_id` — omit on the first turn; pass the value returned by the previous call to continue the same conversation.

## How to use

1. If you don't yet know the agent's `schemaName` + `environmentId`, run `master-agent-list-agents` first and pick the best match by `description` (or the one the user named / `@`-mentioned). If two agents fit equally, ask which one — don't guess.
2. Call `ask_copilot_agent` with the chosen agent and the user's question.
3. The tool returns `{ reply, conversationId }`. Keep `conversationId` and pass it back as `conversation_id` on the next question to the same agent so it retains context.
4. Present the `reply` in your own words and attribute it ("The HR agent says…"). If the agent returned nothing useful, say so — do not fabricate a specialist answer.

## Multi-agent questions

If a request needs two specialists, call `ask_copilot_agent` for each, then synthesize one coherent answer that attributes each part.

## Guardrails

- Only delegate to agents that actually appeared in `list_copilot_agents`. Never invent a `schemaName`.
- Keep `schemaName` / `environmentId` / `conversationId` internal — use them in tool calls, don't surface them unless the user is debugging.

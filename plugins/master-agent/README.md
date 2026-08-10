# Master Agent

Connect to and orchestrate the **Microsoft Copilot Studio agents** in your tenant via the myHub-hosted OAuth MCP gateway. Browser OAuth — no API keys, no tenant URL to configure.

The Master Agent turns the myHub Workspace into a single front door for every specialist agent your organisation has built in Copilot Studio. It discovers the agents the signed-in user can reach, routes a question to the most relevant one (or the one you `@`-mention), holds a multi-turn conversation with it, and synthesizes the reply — so you talk to one assistant instead of hunting for the right bot.

Multi-environment per user: discovery enumerates every Power Platform environment the signed-in user can access and lists each environment's published agents. Non-production agents (names prefixed `[parked]`, `[test]`, `[deprecated]`, `[draft]`, `[wip]`) are hidden.

## Configuration

No environment variables required on the client side. On first use, the browser redirects to `login.microsoftonline.com` — sign in to the account that has access to your Power Platform environment(s) and grant the requested permissions.

Scopes requested:

```
https://api.powerplatform.com/.default
offline_access
openid
```

The single Power Platform delegated permission both discovers the tenant's agents and drives the Direct-Engine conversation with each one.

> **Tenant-admin step**: the Entra app registration backing the gateway needs the *Power Platform API* delegated permission. The signed-in user must have access to at least one Power Platform environment containing published Copilot Studio agents. See the [server-side docs](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/docs/COPILOT_STUDIO.md) for full setup.

## Tools

| Tool | Description |
|---|---|
| `list_copilot_agents` | Discover the Copilot Studio agents in the user's tenant. Returns each agent's `name`, `schemaName` (needed to talk to it), `description`, and `environmentId` / `environmentName`. Optional `environment_id` scopes the search to one environment. Cached ~10 minutes. |
| `ask_copilot_agent` | Send a `message` to a specific agent (by `agent_schema_name` + `environment_id`) and return its reply plus a `conversationId`. Pass that `conversation_id` back on the next call to continue a multi-turn conversation. |

## Widgets

| Widget | Description |
|---|---|
| `master-agent-directory` | A dashboard tile listing the Copilot Studio agents available in your tenant — name, description, and environment — so you can see at a glance which specialists you can reach. |

## How it works

The **Master Agent persona** (`agents/master-agent.md`) is the brain: MyHub / Claude acts as the orchestrator, using the two tools above to discover agents and delegate to them. You don't need a separate app — ask the Master Agent in the Workspace ("who can help with expenses?", "ask the HR agent about leave policy") and it routes, delegates, and synthesizes.

## See also

- [Server-side docs (auth, app reg, discovery)](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/docs/COPILOT_STUDIO.md)
- [Microsoft Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/)

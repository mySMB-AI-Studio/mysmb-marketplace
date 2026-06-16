# Talkdesk plugin

Connects the mySMB Workspace to Talkdesk AI Agent Platform via MCP.

Exposes two core capabilities to the Talkdesk AI Agent:

| Tool | What it does |
|---|---|
| `knowledge_search` | Searches the mySMB Workspace knowledge base and returns matching articles |
| `score_call_qa` | Scores a call transcript against the mySMB 5-point QA scorecard |
| `get_qa_scorecard` | Returns a summary of recent QA scores (used by the Workspace dashboard widget) |

The MCP server is hosted on the shared `myhub-mcp-servers` Azure Container App and authenticates via a Bearer token.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `TALKDESK_API_KEY` | yes | Shared secret between the MCP server and Talkdesk. Generate a strong random string (e.g. `openssl rand -hex 32`). Set it in both the Azure Container App env vars **and** in Talkdesk AI Agent Platform → MCP Server config → Bearer token. |
| `MYSMB_KNOWLEDGE_API_URL` | no | Base URL of the mySMB Workspace knowledge REST API. Defaults to `https://workspace.myimpact.group`. |
| `MYSMB_KNOWLEDGE_API_KEY` | no | Bearer token for the knowledge API. Leave blank if the endpoint is unauthenticated. |

## Talkdesk side setup

1. In Talkdesk, go to **AI Agent Platform → MCP Servers → Add**.
2. Set **URL** to `https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/talkdesk/mcp`.
3. Set **Authentication** → Bearer token → paste the value of `TALKDESK_API_KEY`.
4. Click **Test connection** — it should return the tool list.
5. Add the tools (`knowledge_search`, `score_call_qa`) to your AI Agent Orchestration.

## mySMB side setup

1. Set `TALKDESK_API_KEY` on the Azure Container App (`myhub-mcp-servers`).
2. Optionally set `MYSMB_KNOWLEDGE_API_URL` and `MYSMB_KNOWLEDGE_API_KEY`.
3. Deploy: `/deploy` in Claude Code, or push to `master`.

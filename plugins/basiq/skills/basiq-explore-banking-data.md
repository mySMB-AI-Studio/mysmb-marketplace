---
name: basiq-explore-banking-data
description: Explore available Basiq banking API endpoints and discover what financial data is accessible. Use when the user asks what Basiq can do, which banking endpoints are available, or wants to understand the scope of data accessible through their Basiq application.
---

# Explore Basiq banking data

Use the Basiq MCP tools to discover and navigate available banking API endpoints before fetching live data.

## When to use this skill

- User asks "what can Basiq do?" or "what data is available?"
- User wants to explore endpoints in a specific category (accounts, transactions, identity, etc.)
- User wants to understand the request/response shape before executing a live call

## How to proceed

1. Call `list-endpoints` to get the full list of available endpoints. Note the categories returned — these reflect what is enabled in the user's Basiq application.

2. If the user has a specific area in mind (e.g. "accounts", "transactions", "income"), call `search-endpoints` with a relevant keyword to narrow the list quickly.

3. For any endpoint the user wants to understand deeply, call `get-endpoint` with the endpoint identifier to retrieve: HTTP method, path, all parameters (path, query, body), request schema, response schema, and authentication requirements.

4. Present findings clearly:
   - Group endpoints by category
   - Highlight required vs optional parameters
   - Note which endpoints require a user ID or connection ID (these need a prior consent flow)

## Important constraints

- Do not guess endpoint paths or parameter names — always discover them via `list-endpoints` or `get-endpoint` first.
- If `list-endpoints` returns an empty set or a specific category is absent, it means that route group is not enabled for the user's application; tell the user to enable it in the Basiq Dashboard.
- The `execute-request` tool should only be suggested after the user understands the endpoint shape.

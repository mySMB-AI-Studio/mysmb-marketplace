# SurePact Grants

Search currently listed Australian government and community grants through
[SurePact](https://www.surepact.com/)'s Intelligent Grants API. Filter by
state or territory and get each grant's title, description, funding amount,
open date, and close date.

Grant search is provided through mySMB's SurePact partnership — users need
no SurePact account and no configuration. The Connect button enables the
plugin immediately (`authType: "none"`).

## Tools

| Tool | Description |
| ---- | ----------- |
| `surepact_search_grants` | Search grants for one Australian state/territory (`ACT`, `NSW`, `VIC`, `SA`, `WA`, `QLD`, `NT`, `TAS`), returning up to 50 grants with title, description, open/close dates, funding amount, and location. |

Notes on the data:

- `openDate`, `closeDate`, and `fundingAmount` are free-text display
  strings as published by the grant issuer — formats vary (`"9-Jul-2026"`,
  `"30 March 2026"`, `"Up to $450,000"`) and they are not machine-parseable.
  Show them verbatim; never sort or compare them numerically.
- National grants list every state in `location` and appear in every
  state's results, so dedupe by title when searching more than one state.

## Configuration

The plugin has **no configuration**. It is a thin pointer at the
myHub-hosted `surepact-grants` MCP server, which authenticates to SurePact
with a partner credential held server-side.

The credential is a Microsoft Entra ID app registration issued to mySMB in
SurePact's tenant. It is a **platform-level** secret, not a per-user one, so
it lives in the `myhub-mcp-servers` deployment environment
(`SUREPACT_CLIENT_ID` / `SUREPACT_CLIENT_SECRET`) and never in this
repository. See that repo's `docs/SUREPACT.md`.

## Install (Claude Code)

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install surepact-grants
```

Note that installing in stock Claude Code points at the production
myHub-hosted server, which is reachable without a user credential.

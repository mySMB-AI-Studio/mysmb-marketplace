# Restoke

Access Restoke's hospitality back-of-house analytics via the myHub-hosted MCP gateway. Single account-level restaurant/HQ API key — no OAuth, no browser connect flow.

## Authentication

Restoke's Reports API authenticates with a single static key (a UUID) for the restaurant or HQ account. There is no OAuth flow and no per-user credential — mySMB holds one key, used for every call. The key is sent as the `X-Restaurant-Key` header (Restoke's documented preferred method over the `?key=` query param).

## Configuration

No environment variables are required in this plugin — the API key lives server-side in the myHub-hosted MCP gateway (`RESTOKE_API_KEY`, sourced from the `RESTOKE_CLIENT_SECRET_STAGING` / production secret), not here.

| Variable | Required | Description |
|---|---|---|
| *(none)* | — | Server-side static key — nothing to configure in this plugin. |

## Tools

| Tool | Description |
|---|---|
| `list_venues` | List venue IDs and names visible to an HQ-level key. Returns 403 for a single-restaurant key that isn't HQ-scoped. |
| `get_report` | Row-level data for a named report (`reportName`) over a `startDate`/`endDate` window (YYYY-MM-DD, inclusive), optionally scoped to specific venues via `restaurantIds`. |

Restoke's own docs warn that report names and paths can change over time and give no fixed enumeration — `get_report` takes a free-form `reportName` rather than a hardcoded list. Confirm the exact name against the live Reports API documentation page (`https://analytics.restoke.ai/api/v1/reports/index/?key=<uuid>`) before calling it.

## Rate limits

100 requests/hour, per restaurant. A 429 response includes the reset time when Restoke sends `X-RateLimit-Reset`.

## Widgets

- **Venues** — live list of venue IDs/names for the configured HQ key, for use as `restaurantIds` input to `get_report`.

Additional report-backed tiles (sales, covers, labor, waste, etc.) are natural follow-ups once specific report names are confirmed against a real account's live Reports API documentation page.

## Destructive operations

None — every tool is read-only.

## See also

- [Restoke Reports API docs](https://help.restoke.ai/en/articles/14507583-using-the-restoke-reports-api)

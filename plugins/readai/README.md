# Read.ai

Access Read.ai meeting summaries, transcripts, action items, and key questions via the myHub-hosted Read.ai MCP gateway.

## Authentication

Read.ai uses its own dynamic-client-registration OAuth2 + PKCE flow (RFC 7591) — distinct from a standard pre-registered OAuth app. The client was registered once via `POST https://api.read.ai/oauth/register`; its `client_id`/`client_secret` are held server-side in the myHub-hosted MCP gateway, not here. Click **Connect** to sign in with your own Read.ai account via the standard OAuth popup flow — no manual token copying needed.

Read.ai's own docs show `https://api.read.ai/oauth/ui` as the example redirect target, but that page is a human-operated testing console, not a real authorize endpoint — it generates its own `state`/PKCE values client-side and ignores a caller's, before redirecting on to the actual authorize endpoint at `https://authn.read.ai/oauth2/auth`. This gateway redirects there directly (confirmed fixed 2026-10-21) — see `myhub-mcp-servers/src/integrations/readai/provider.ts` for how this was diagnosed.

## Configuration

No configuration variables are required.

## Tools

| Tool | Description |
|---|---|
| `list_meetings` | List active and ended meetings, newest first. Cursor-paginated; supports a `start_time_ms` range filter and optional `expand[]` fields. |
| `get_meeting` | Full detail for one meeting by its id (ULID), with optional `expand[]` fields (summary, transcript, action_items, key_questions, topics, metrics, recording_download). |
| `get_live_meeting` | Real-time transcript/chapter data for an ongoing meeting — only populated if Read.ai's live dashboard was open during it. |

A meeting is "ended" once `end_time_ms` is set; otherwise it's still active. Expanding fields slows the response, and active meetings have limited data for most of them.

## Rate limits

100 requests/minute, per user.

## Widgets

None yet — this plugin currently exposes the MCP tools only, for testing the Connect/OAuth flow. Meeting-data tiles (recent meetings, action items, summaries) are a natural follow-up once the connection is verified end-to-end.

## Destructive operations

None — every tool is read-only.

## See also

- [API Reference](https://support.read.ai/hc/en-us/articles/49381161088659-API-Reference)
- [API Keys & Authentication](https://support.read.ai/hc/en-us/articles/49380809380371-API-Keys-Authentication)

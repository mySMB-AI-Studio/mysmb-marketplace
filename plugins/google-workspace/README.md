# Google Workspace

Read-only Gmail, Google Calendar, Google Drive and Google Meet for the Workspace, through the myHub Google Workspace OAuth gateway (`myhub-mcp-servers`, `src/integrations/google-workspace/`). Each service is its **own connection with its own consent**: a user who connects only Gmail is asked only for Gmail access. Tokens are held and refreshed by the gateway; nothing is pasted by hand.

## Servers

| Server | What it does | Scopes it requests |
|--------|--------------|--------------------|
| `google-workspace-gmail` | List, search and read messages and attachments; extract bills from a label | `gmail.readonly` |
| `google-workspace-calendar` | List calendars, list and read events, merged multi-calendar agenda | `calendar.events.readonly`, `calendar.calendarlist.readonly` |
| `google-workspace-drive` | Recent files, folder listings, full-text search — metadata and links only | `drive.readonly` |
| `google-workspace-meet` | Recent meetings, transcripts, talk-time and summaries | `meetings.space.readonly`, `calendar.events.readonly` |

Every connection also requests `openid` and `email`.

## OAuth scopes

All scopes are prefixed `https://www.googleapis.com/auth/`.

| Scope | Class | Why |
|-------|-------|-----|
| `gmail.readonly` | Restricted | Message bodies, snippets and attachments for the inbox, briefing and bills tiles. `gmail.metadata` returns headers only. |
| `calendar.events.readonly` | Sensitive | Event details across the user's calendars, and Meet's event-title lookup. |
| `calendar.calendarlist.readonly` | Sensitive | Enumerate the calendars the user has ticked as visible, for the merged agenda. `calendar.events.readonly` does not cover `/users/me/calendarList`. |
| `drive.readonly` | Restricted | Recent files and full-text search. `drive.file` sees only app-created files; `drive.metadata.readonly` cannot run `fullText contains`. |
| `meetings.space.readonly` | Sensitive | Conference records and transcripts via the Meet REST API. |
| `openid`, `email` | Non-sensitive | Identity only: labels the connected account with its address. |

> **These scopes are under Google OAuth verification** for Cloud project
> `mysmb-workspace`. The gateway's requested set must equal that project's
> **Data Access** list character for character. Adding a scope or a server
> here is a re-verification: update the Console, justify the scope, and
> demonstrate the feature on video. See
> `myHubV2/docs/security/2026-10-07-google-oauth-verification-pack.md`.

> **Consent screen:** `openid` and `email` are OIDC identity scopes requested by
> the shared authorization flow, so they appear on every Google connection's
> consent screen. Without `email` every Gmail card reads "Connected account".

## OAuth redirect URIs — register these before a server can be connected

**Every MCP server in this plugin has its OWN callback URL**, because the gateway
builds it as `${BASE_URL}${serverPath}/callback`. Each one must be listed in the
provider's app registration or the connect flow dies with
`redirect_uri_mismatch` / `Invalid Redirect URI` — and it dies at the moment a
user first clicks Connect, which can be months after the server shipped.

**Adding a server to `.mcp.json` therefore requires registering two more URIs.**
There is no way to discover the omission from CI: the code, the manifest and the
validator are all perfectly happy, and only a human clicking Connect finds out.

There are exactly **two gateway hosts**, not one per environment:

| Tenants in | Reach the gateway at | Why |
|---|---|---|
| QA (Azure `staging`) | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io` | tenant sets `MCP_SERVERS_BASE_URL`, which rewrites the host in this file |
| UAT and Production | `https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io` | no `MCP_SERVERS_BASE_URL` set, so the URL below is used verbatim |

So each server needs **both** rows below registered against the Google OAuth client.

| Server | Redirect URIs (register both) |
|---|---|
| `google-workspace-gmail` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/google-workspace-gmail/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/google-workspace-gmail/callback` |
| `google-workspace-calendar` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/google-workspace-calendar/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/google-workspace-calendar/callback` |
| `google-workspace-drive` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/google-workspace-drive/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/google-workspace-drive/callback` |
| `google-workspace-meet` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/google-workspace-meet/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/google-workspace-meet/callback` |

> **Both hosts share ONE Google OAuth client**, so all eight URIs above belong in
> the same **Authorized redirect URIs** list (Google Cloud Console → APIs &
> Services → Credentials → the OAuth 2.0 Client whose id is `GOOGLE_CLIENT_ID`
> on the gateway). Changes take a minute or two to apply.
>
> Withdrawn connections (`google-workspace-gmail-write`, `-chat`, `-people`,
> removed October 2026) should have their URIs **deleted** from that list: the
> Google verification review treats leftovers as unexplained access paths.

## Available actions

All actions are read-only. Nothing is sent, created, changed or deleted in the user's Google account.

### Gmail (`google-workspace-gmail`)

`list_messages` (label filter and Gmail search via `q`), `get_message`, `get_attachment`, `list_labels`, `list_bill_label_emails`.

### Google Calendar (`google-workspace-calendar`)

`list_calendars`, `list_events`, `get_event`, `get_upcoming_events_dashboard`.

### Google Drive (`google-workspace-drive`)

`list_recent_files`, `get_recent_files_dashboard`, `list_files`, `search_files`. These return names, types, dates and an open-in-Drive link; no tool downloads or exports file contents.

### Google Meet (`google-workspace-meet`)

`list_meetings`, `list_transcripts`, `get_transcript`, `get_meeting_dashboard`, `get_meeting_summaries_dashboard`.

## Widgets

| Widget ID | Title | Server |
|-----------|-------|--------|
| `google-workspace-gmail-inbox` | Gmail Inbox | `google-workspace-gmail` |
| `google-workspace-gmail-bill-extraction` | Bills from Gmail | `google-workspace-gmail` |
| `google-workspace-calendar-today` | Upcoming Events | `google-workspace-calendar` |
| `google-workspace-drive-recent` | Recent Files | `google-workspace-drive` |
| `google-workspace-drive-search` | Drive Search | `google-workspace-drive` |
| `google-workspace-meet-latest-transcript` | Latest Meeting Transcript | `google-workspace-meet` |

Custom computed functions and components ship in `widget-elements/` (compiled to `widget-elements/dist/index.js`).

## Briefing email source

`briefing-sources/email.json` (declared as `briefingEmailSources` in
`.claude-plugin/plugin.json`) lets the mySidekick morning briefing read this
plugin's mailbox alongside every other connected email account.

It maps `google-workspace-gmail/list_messages` onto the canonical
`email/Message` contract: Gmail returns `{ messages: [...] }` (hence
`itemsPath`), a raw RFC-5322 `From` header (split by the `mailbox-name` /
`mailbox-address` transforms), and `internalDate` as epoch milliseconds **in a
string** (`unix-ms-to-iso`).

Replies use `compose.mode: "deeplink"`: "Draft a reply" opens Gmail's own
compose window, pre-filled, in the connected account (`/mail/u/{accountAddress}/`),
and the user sends it from Gmail. That needs **no OAuth scope**, which is why the
former `gmail.compose` drafts connection could be withdrawn. Because `/u/{email}`
is not a documented Gmail URL, the briefing card names the mailbox and asks the
user to check the From field.

The file is inert unless declared, and `scripts/validate.ts` enforces that it
names only a server this plugin owns and uses an https compose template with
known placeholders. Schema:
`myHubV2/packages/shared/src/briefing-sources/email-source-schema.ts`.

## See also

- [Gmail API reference](https://developers.google.com/gmail/api/reference/rest)
- [Google Drive API reference](https://developers.google.com/drive/api/reference/rest/v3)
- [Google Calendar API reference](https://developers.google.com/calendar/api/v3/reference)
- [Google Meet REST API](https://developers.google.com/workspace/meet/api/guides/overview)
- [Google OAuth 2.0 scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

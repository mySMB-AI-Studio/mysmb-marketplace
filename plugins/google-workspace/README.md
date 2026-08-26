# Google Workspace

Integrates Gmail, Google Drive, Google Calendar, Google Chat, and Google Contacts (People API) via their respective Google Workspace MCP servers. All five services share a single Google OAuth 2.0 Bearer token.

## Servers

| Server | MCP Endpoint | Description |
|--------|-------------|-------------|
| `google-workspace-gmail` | `https://gmailmcp.googleapis.com/mcp/v1` | Read, search, send, and manage emails |
| `google-workspace-drive` | `https://drivemcp.googleapis.com/mcp/v1` | List, search, read, and upload files |
| `google-workspace-calendar` | `https://calendarmcp.googleapis.com/mcp/v1` | View, create, update, and delete calendar events |
| `google-workspace-chat` | `https://chatmcp.googleapis.com/mcp/v1` | List spaces, read and send messages |
| `google-workspace-people` | `https://people.googleapis.com/mcp/v1` | Search and read contact profiles |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_ACCESS_TOKEN` | yes | Google OAuth 2.0 access token with the Workspace scopes listed below. Stored encrypted per user; never committed to the repo. |

### OAuth scopes required

Each service requires the following Google OAuth 2.0 scopes:

| Service | Scope | Notes |
|---------|-------|-------|
| Gmail | `https://www.googleapis.com/auth/gmail.readonly` | Read and search only — no send, label, or trash |
| Google Drive | `https://www.googleapis.com/auth/drive.readonly` | List, search, and read files — no upload or edit |
| Google Calendar | `https://www.googleapis.com/auth/calendar.events.readonly` | Read-only event access — no create, update, or delete |
| Google Chat (messages) | `https://www.googleapis.com/auth/chat.messages` | Read, send, update, and delete messages |
| Google Chat (members) | `https://www.googleapis.com/auth/chat.memberships.readonly` | List space members (`list_members` tool) |
| People (Contacts) | `https://www.googleapis.com/auth/contacts.readonly` | Read-only contact and profile access |

> **Note:** Google OAuth 2.0 access tokens expire after approximately one hour.
> Re-generate and re-paste the token when you see `401 Unauthorized` errors.
> If only some services fail with `403`, check that the token was minted with **all** scopes above — a partial-scope token causes silent failures on the missing services.

### How to obtain an access token

#### Option A — Google OAuth 2.0 Playground (quickest for testing)

1. Open the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. In **Step 1**, enter or select the five scopes listed above and click **Authorize APIs**.
3. Sign in with your Google Workspace account and grant the requested permissions.
4. In **Step 2**, click **Exchange authorization code for tokens**.
5. Copy the `access_token` value from the response.
6. Paste it into the `GOOGLE_ACCESS_TOKEN` field in the Connect dialog.

> Access tokens expire after one hour. Re-run the Playground or use a refresh-token flow for longer sessions.

#### Option B — Your own OAuth 2.0 client (recommended for production)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or open a project.
2. Enable the APIs: **Gmail API**, **Google Drive API**, **Google Calendar API**, **Google Chat API**, **People API**.
3. Create an **OAuth 2.0 Client ID** (Application type: Desktop app or Web application).
4. Implement the OAuth 2.0 Authorization Code flow with the scopes above. Google's [Python Quickstart](https://developers.google.com/gmail/api/quickstart/python) is a good reference.
5. After the user authorizes, store and refresh the access token as needed, and supply the current `access_token` to this plugin.

## Available actions

### Gmail (`google-workspace-gmail`)

- List messages in the inbox or any label/folder
- Search messages using Gmail search syntax (`from:`, `subject:`, `has:attachment`, etc.)
- Get the full content of a specific message
- List available labels

### Google Drive (`google-workspace-drive`)

- List files and folders in My Drive or a specific folder
- Search files by name, MIME type, or content
- Read file content (Docs, Sheets exported as plain text; binary files as base64)
- List recently accessed files

### Google Calendar (`google-workspace-calendar`)

- List upcoming events on the primary or a named calendar
- Get the details of a specific event (attendees, location, conference link)
- List all calendars the user has access to
- Find free/busy slots for a set of attendees

### Google Chat (`google-workspace-chat`)

- List Chat spaces (rooms and direct messages) the user belongs to
- List members of a space
- Read messages in a space or thread
- Send a new message to a space
- Reply to a message in a thread
- Update or delete a sent message

### People API — Contacts (`google-workspace-people`)

- Search contacts by name or email address
- Get a specific contact's full profile (phone numbers, emails, organization, address)
- List all contacts in the user's directory
- Read the user's own profile

## Destructive operations

The following operations make irreversible or externally visible changes — confirm before calling:

- **Chat**: `send_message` / `update_message` / `delete_message` — visible to all space members

Gmail, Drive, and Calendar are read-only — no send, write, or delete operations are available for those services.

## Widgets

Three dashboard tiles are included. Add them to any MyHub dashboard from the widget picker.

| Widget ID | Title | Description |
|-----------|-------|-------------|
| `google-workspace-gmail-inbox` | Gmail Inbox | Recent unread Gmail messages — sender, subject, and relative timestamp. Reads from the `google-workspace-gmail` connector. |
| `google-workspace-calendar-today` | Upcoming Events | Upcoming Google Calendar events — title, start time, and status badge. Reads from the `google-workspace-calendar` connector. |
| `google-workspace-drive-recent` | Recent Files | Recently accessed Google Drive files — name, file-type badge, last modified time, and direct link to open in Drive. Reads from the `google-workspace-drive` connector. |

### Custom computed functions (`widget-elements`)

The plugin ships a small `widget-elements` module (compiled to `widget-elements/dist/index.js`) that provides:

| Function | Description |
|----------|-------------|
| `google_workspace_mime_label` | Maps a Drive MIME type to a short label (Doc, Sheet, Slide, PDF, etc.) |
| `google_workspace_mime_tone` | Maps a Drive MIME type to a badge tone |
| `google_workspace_sender_name` | Extracts a display name from a Gmail `From` header string |

## Briefing email source

`briefing-sources/email.json` (declared as `briefingEmailSources` in
`.claude-plugin/plugin.json`) lets the mySidekick morning briefing read this
plugin's mailbox alongside every other connected email account.

It maps `google-workspace-gmail/list_messages` onto the canonical
`email/Message` contract: Gmail returns `{ messages: [...] }` (hence
`itemsPath`), a raw RFC-5322 `From` header (split by the `mailbox-name` /
`mailbox-address` transforms), and `internalDate` as epoch milliseconds **in a
string** (`unix-ms-to-iso`).

The file is inert unless declared, and `scripts/validate.ts` enforces that it
names only a server this plugin owns and uses an https compose template with
known placeholders. Schema:
`myHubV2/packages/shared/src/briefing-sources/email-source-schema.ts`.

## See also

- [Gmail API reference](https://developers.google.com/gmail/api/reference/rest)
- [Google Drive API reference](https://developers.google.com/drive/api/reference/rest/v3)
- [Google Calendar API reference](https://developers.google.com/calendar/api/v3/reference)
- [Google Chat API reference](https://developers.google.com/chat/api/reference/rest)
- [People API reference](https://developers.google.com/people/api/rest)
- [Google OAuth 2.0 scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

# Microsoft 365

Access Microsoft 365 emails, calendar, files, Teams, and people through Microsoft Graph.

## Servers

| Server | Description | Scopes | Consent |
|--------|-------------|--------|---------|
| m365-mail-read | Read, search, and inspect emails | `Mail.Read` | **User self-consent OK** |
| m365-mail-send | Compose, reply, forward, delete emails | `Mail.Send`, `Mail.ReadWrite` | **Admin consent required** |
| m365-calendar | View, create, and manage calendar events | `Calendars.ReadWrite` | User consent (may require admin) |
| m365-files | Browse, search, upload, and share OneDrive files | `Files.ReadWrite` | User consent (may require admin) |
| m365-teams | Read and send Teams channel and chat messages | `Team.ReadBasic.All`, `ChannelMessage.Read.All`, `Chat.ReadWrite` | Admin consent required |
| m365-people | Search people, view profiles and org chart | `People.Read`, `User.Read` | User self-consent OK |

Mail is split into two servers on purpose: `Mail.Send` and `Mail.ReadWrite` are
classified as high-risk by Entra and user self-consent is blocked by default,
so a tenant admin has to pre-approve the send server. The read-only server
only needs `Mail.Read`, which users can self-consent to — so reading inbox
works without waiting on an admin.

See the **[Admin consent](#admin-consent-for-high-risk-scopes)** section below
for how to unblock `m365-mail-send` org-wide.

## Configuration

No environment variables required. Each server uses OAuth — click Connect in
MyHub to sign in with your Microsoft account. Each server requests only its
own scopes.

## Admin consent for high-risk scopes

`m365-mail-send` (and some optional scopes on calendar, files, teams) require
**tenant admin consent** before any user can connect. Do this once:

1. Sign in to https://entra.microsoft.com as a Global Admin.
2. **Identity → Applications → Enterprise applications**.
3. Find **MyHub MCP M365** (it appears after the first user attempts consent).
4. **Security → Permissions → Grant admin consent for `<tenant>`**.

Or use the admin-consent URL:

```
https://login.microsoftonline.com/{TENANT_ID}/adminconsent?client_id={APP_CLIENT_ID}
```

After admin consent, every user in the tenant can connect the send server
without another prompt.

## Tools

### Mail — Read (3 tools, `m365-mail-read`)
- `list_emails` — List recent emails from inbox
- `get_email` — Get a single email with full body
- `search_emails` — Search across all folders

### Mail — Send (4 tools, `m365-mail-send`)
- `send_email` — Compose and send
- `reply_to_email` — Reply to a message
- `forward_email` — Forward to recipients
- `delete_email` — Move to trash

### Calendar (6 tools)
- `list_events` — List upcoming events
- `get_event` — Get event details
- `create_event` — Create a new event
- `update_event` — Modify an event
- `cancel_event` — Cancel with notification
- `find_free_slots` — Find available meeting times

### Files (6 tools)
- `list_files` — Browse OneDrive folders
- `get_file_content` — Download file content
- `search_files` — Search by name or content
- `upload_file` — Upload a file
- `share_file` — Create sharing link
- `list_recent_files` — Recently accessed files

### Teams (12 tools)
- `list_teams` — List joined teams
- `list_channels` — List team channels
- `list_messages` — Read channel/chat messages, enriched with `isFromMe`,
  `isSystemEvent`, `senderName`, `text`, `relativeTime`, and `reactions`
  (`[{ reactionType, glyph, displayName, count, reactedByMe, reactedBy }]`,
  count-desc; `[]` when there are none)
- `send_message` — Send to channel/chat
- `reply_to_message` — Reply in a thread
- `list_chats` — List 1:1, group, and meeting chats with display-ready
  metadata (`displayName`, `senderName`, `snippet`, `snippetFallback`,
  `relativeTime`, `unread`, `isFromMe`, `bucket`, `hasMention`, `mentionsMe`,
  `reactions`). Sorted unread-first, then newest-first. Optional `timeZone`
  (IANA name) for the recency-bucket day boundary.
- `create_chat` — Create a new 1:1 or group chat. `memberUserIds` are
  the Entra user IDs of the other members (the caller is added
  automatically); optional `topic` applies to group chats only. A 1:1
  with an existing chat partner returns that existing chat. Returns
  `{ id, chatType, topic, webUrl }` — follow up with `send_message
  { chatId }` to post the first message.
- `mark_chat_read` — Mark a chat as read for the current user (mirrors
  what the Teams client does when a user opens a chat).
- `mark_chat_unread` — Flip a chat back to unread (snooze flow).
- `mark_all_chats_read` — Clear unread on every recent chat in one call;
  returns `{ ok, marked, errors }` so partial success still wins.
- `set_message_reaction` — Add a reaction to a chat message. Accepts **any
  Unicode emoji** (`👍`, `🎉`, `✅`, skin-tone/ZWJ/flag sequences) as well as
  the legacy names `like` | `heart` | `laugh` | `surprised` | `sad` | `angry`.
- `unset_message_reaction` — Remove a previously-set reaction. Send back the
  `reactionType` exactly as it appears on the message (a legacy `like` renders
  as 👍 but must be removed as `like`).

### People (4 tools)
- `search_people` — Search by name or email
- `get_profile` — Get user profile
- `get_manager` — Get user's manager
- `get_direct_reports` — Get direct reports

## Briefing email source

`briefing-sources/email.json` (declared as `briefingEmailSources` in
`.claude-plugin/plugin.json`) lets the mySidekick morning briefing read this
mailbox alongside every other connected email account.

It maps `m365-mail-read/list_emails` onto the canonical `email/Message`
contract. It passes `unreadOnly: true` so Graph filters server-side — otherwise
`limit: 10` returns "the unread subset of the ten newest", which on a busy
morning is routinely empty. `unreadFilter` repeats the check client-side as
defence in depth.

The file is inert unless declared, and `scripts/validate.ts` enforces that it
names only a server this plugin owns and uses an https compose template with
known placeholders. Schema:
`myHubV2/packages/shared/src/briefing-sources/email-source-schema.ts`.

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

So each server needs **both** rows below registered against the Entra app registration.

| Server | Redirect URIs (register both) |
|---|---|
| `m365-mail-read` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-mail-read/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-mail-read/callback` |
| `m365-mail-send` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-mail-send/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-mail-send/callback` |
| `m365-calendar` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-calendar/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-calendar/callback` |
| `m365-files` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-files/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-files/callback` |
| `m365-teams` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-teams/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-teams/callback` |
| `m365-people` | `https://myhub-mcp-servers-staging.orangesky-e321d350.westus2.azurecontainerapps.io/m365-people/callback`<br>`https://myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io/m365-people/callback` |

> Register these under the Entra app registration whose id is `ENTRA_CLIENT_ID`
> on the gateway (Azure Portal → App registrations → Authentication → Web →
> Redirect URIs). All six servers share one app registration, differing only by
> requested scopes.
>
> `m365-mail-send` is only reached when a user creates a draft, so an unregistered
> URI there stays invisible until someone clicks "Open draft".

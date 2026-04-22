# Microsoft 365

Access Microsoft 365 emails, calendar, files, Teams, and people through Microsoft Graph.

## Servers

| Server | Description | Scopes | Consent |
|--------|-------------|--------|---------|
| m365-mail-read | Read, search, and inspect emails | `Mail.Read` | **User self-consent OK** |
| m365-mail-send | Compose, reply, forward, delete emails | `Mail.Send`, `Mail.ReadWrite` | **Admin consent required** |
| m365-calendar | View, create, and manage calendar events | `Calendars.ReadWrite` | User consent (may require admin) |
| m365-files | Browse, search, upload, and share OneDrive files | `Files.ReadWrite` | User consent (may require admin) |
| m365-teams | Read and send Teams channel and chat messages | `ChannelMessage.Read.All`, `Chat.ReadWrite` | Admin consent required |
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

### Teams (6 tools)
- `list_teams` — List joined teams
- `list_channels` — List team channels
- `list_messages` — Read channel/chat messages
- `send_message` — Send to channel/chat
- `reply_to_message` — Reply in a thread
- `list_chats` — List 1:1 and group chats

### People (4 tools)
- `search_people` — Search by name or email
- `get_profile` — Get user profile
- `get_manager` — Get user's manager
- `get_direct_reports` — Get direct reports

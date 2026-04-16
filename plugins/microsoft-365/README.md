# Microsoft 365

Access Microsoft 365 emails, calendar, files, Teams, and people through Microsoft Graph.

## Servers

| Server | Description | Scopes |
|--------|-------------|--------|
| m365-email | Read, send, search, and manage emails | Mail.Read, Mail.Send |
| m365-calendar | View, create, and manage calendar events | Calendars.ReadWrite |
| m365-files | Browse, search, upload, and share OneDrive files | Files.ReadWrite |
| m365-teams | Read and send Teams channel and chat messages | ChannelMessage.Read.All, Chat.ReadWrite |
| m365-people | Search people, view profiles and org chart | People.Read, User.Read |

## Configuration

No environment variables required. Each server uses OAuth — click Connect in MyHub to sign in with your Microsoft account. Each server requests only its own scopes.

## Tools

### Email (7 tools)
- `list_emails` — List recent emails from inbox
- `get_email` — Get a single email with full body
- `search_emails` — Search across all folders
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

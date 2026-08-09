# Slack

Connect to your Slack workspace via [Slack's official MCP server](https://mcp.slack.com/mcp). Search messages and files, read and send in channels, manage canvases, and look up users — all through a single confidential OAuth connection.

## Server

| Server | MCP Endpoint | Description |
|--------|-------------|-------------|
| `slack` | `https://mcp.slack.com/mcp` | Slack's official hosted MCP server — search, messaging, canvases, users |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_CLIENT_ID` | yes | OAuth Client ID from your Slack app's Basic Information page. Must be a directory-published or internal app. |
| `SLACK_CLIENT_SECRET` | yes | OAuth Client Secret from your Slack app's Basic Information page. Stored encrypted per user; never committed to the repo. |

### OAuth scopes required

The following Slack OAuth scopes are requested when a user connects:

| Scope | Purpose |
|-------|---------|
| `search:read.public` | Search public channels and messages |
| `search:read.private` | Search private channels the user has access to |
| `search:read.mpim` | Search multi-party direct messages |
| `search:read.im` | Search direct messages |
| `search:read.files` | Search files |
| `search:read.users` | Search users by name, email, or ID |
| `emoji:read` | List custom emoji |
| `files:read` | Read and download file content |
| `chat:write` | Send messages to any conversation |
| `channels:history` | Read public channel message history |
| `groups:history` | Read private channel message history |
| `mpim:history` | Read group DM message history |
| `im:history` | Read direct message history |
| `channels:write` | Create public channels |
| `groups:write` | Create private channels |
| `im:write` | Open direct messages |
| `mpim:write` | Open group direct messages |
| `reactions:write` | Add emoji reactions to messages |
| `canvases:read` | Read and export canvases |
| `canvases:write` | Create and update canvases |
| `users:read` | Fetch user profile information |
| `users:read.email` | Read user email addresses |
| `channels:read` | List channels and their members |
| `groups:read` | List private channels and members |
| `mpim:read` | List group DMs and members |

### How to create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From scratch**.
2. Name your app and select your Slack workspace.
3. Under **OAuth & Permissions**, add all the scopes listed above under **User Token Scopes**.
4. Under **Basic Information**, copy your **Client ID** and **Client Secret**.
5. Install the app to your workspace.
6. Submit your app to the Slack App Directory (required) or configure it as an internal integration.
7. Paste the Client ID and Client Secret into the Connect dialog.

> **Note:** Slack only permits directory-published or internal apps to access the MCP server. Unlisted apps are blocked by Slack policy. If you see an authorisation error, verify your app's distribution status in the Slack App Directory.

## Available tools

### Search

| Tool | Description |
|------|-------------|
| `search_messages` | Search messages by keyword, date, user, or channel |
| `search_files` | Search files by name or type |
| `read_files` | Read the content of a file by its file ID |
| `search_users` | Search users by name, email, or user ID |
| `search_channels` | Search public and private channels by name or description |
| `list_emoji` | List all custom emoji in the workspace |

### Messaging

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to any channel, DM, or group DM |
| `read_channel_history` | Read the message history of a channel |
| `read_thread` | Read a full message thread by parent timestamp |
| `create_conversation` | Create a new channel or open a DM/group DM |
| `add_reaction` | Add an emoji reaction to a message |

### Canvases

| Tool | Description |
|------|-------------|
| `create_canvas` | Create a new canvas in a channel |
| `update_canvas` | Update the content of an existing canvas |
| `read_canvas` | Read and export a canvas as markdown |

### Users

| Tool | Description |
|------|-------------|
| `get_user_profile` | Fetch a user's complete profile including custom fields and status |
| `list_channel_members` | List the user IDs of all members in a channel |

## Rate limits

Slack's MCP server follows the standard Slack Web API rate limit tiers:

| Tier | Rate | Applies to |
|------|------|-----------|
| Tier 2 | 20+ req/min | Emoji list, user search, channel search, create canvas |
| Tier 3 | 50+ req/min | Read channel history, read thread, add reaction, update canvas, read canvas |
| Tier 4 | 100+ req/min | Read files, user profile, list channel members |
| Special | Per-method | Search messages, search files, send message — consult Slack API method docs |

> **Note:** `read_canvas` appears in both Tier 3 and Tier 4 depending on context; Tier 3 applies in most cases.

If you hit a rate limit (HTTP 429), wait before retrying. The agent guidance in this plugin automatically handles backoff.

## Authentication

This plugin uses confidential OAuth 2.0 with your Slack app's `client_id` and `client_secret`. The workspace handles the OAuth flow and token refresh automatically — you do not need to manage tokens manually.

- **Authorization endpoint:** `https://slack.com/oauth/v2_user/authorize`
- **Token endpoint:** `https://slack.com/api/oauth.v2.user.access`
- **Token refresh:** Handled automatically by the MyHub workspace runtime.

> **Note:** These are Slack's *user-token* OAuth endpoints (not the bot-token `oauth/v2/authorize` flow). Slack's MCP server requires user tokens to act on behalf of the connected user, which is why user-token scopes (e.g. `search:read.public`) are used instead of bot scopes.

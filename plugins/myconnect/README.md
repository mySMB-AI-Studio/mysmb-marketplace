# myConnect

Your myConnect communities, as you — read feeds, posts, comments and notifications, find members, and post, comment, like and bookmark. Signs in with your mySMB account; acts only with your own access.

Hosted by myConnect itself (`https://myconnect.community/api/mcp/member`, Streamable HTTP). For any myConnect member.
Design: myConnect `docs/decisions/ADR-015-mcp-connector-servers.md`.

## Configuration

No environment variables required. Click **Connect**, sign in with your mySMB account and choose
**Allow access** on myConnect's consent screen. The workspace registers itself with myConnect's OAuth
server automatically (dynamic client registration, PKCE) and refreshes the connection silently.

| Scope | Grants |
|---|---|
| `myconnect.member` | This server only — a token for one myConnect server is refused by the others |

QA and UAT workspaces are pointed at `qa.myconnect.community` / `uat.myconnect.community` automatically
(myHub `MYCONNECT_BASE_URL` rewrite); the URL above is always the production one.

## Tools

| Tool | What it does |
|---|---|
| `list_communities` | The communities you belong to, with your role in each |
| `get_my_profile` | Your own profile and custom profile fields |
| `list_channels` | Channels you can see, grouped, with unread counts and whether you can post |
| `get_feed` | Home feed, or one channel's feed (plus pinned posts); cursor-paged |
| `get_post` | One post in full |
| `list_comments` | Comments on a post, oldest first |
| `create_post` | Publish a post as you (moderation screening applies) |
| `create_comment` | Comment or reply as you |
| `set_like` | Like / unlike a post or comment (idempotent) |
| `list_bookmarks` | Your saved posts and comments |
| `set_bookmark` | Save / unsave a post or comment (idempotent) |
| `list_notifications` | Your notifications and unread count |
| `mark_notifications_read` | Mark some or all notifications read |
| `search_members` | Find members by name |
| `get_member` | A member's public profile |

Every tool that works inside a community takes an optional `community` (slug or id). It is required
only when you belong to more than one, and it can only ever name one of your own communities.

## Security

- Acts only with the signed-in person's own access; roles are re-checked on every call, not trusted from the connection.
- Changes run the same rules and side-effects as the myConnect app (moderation, workflows, notifications).
- Admin and platform changes are written to the community's audit log as `mcp.<server>.<tool>`.
- Disconnecting in Workspace revokes the connection in myConnect immediately.

# myConnect Community Admin

Run the myConnect communities you administer — members, invitations, the moderation queue, analytics and the audit log. For community owners and admins; every change is checked against your role and written to the community's audit log.

Hosted by myConnect itself (`https://myconnect.community/api/mcp/community-admin`, Streamable HTTP). For owners and admins of at least one myConnect community.
Design: myConnect `docs/decisions/ADR-015-mcp-connector-servers.md`.

This plugin also bundles myConnect's member-scoped server (`myconnect-member`, same host, `/api/mcp/member`)
so the **Community Manager** tile's community picker can show every community you belong to — not just the
ones you administer — the same way myConnect's own app switcher does. Each server needs its own separate
**Connect**: a token for one myConnect server is refused by the others.

## Configuration

No environment variables required. Click **Connect** on each of the two servers below, sign in with your
mySMB account and choose **Allow access** on myConnect's consent screen. The workspace registers itself
with myConnect's OAuth server automatically (dynamic client registration, PKCE) and refreshes each
connection silently.

| Server | Scope | Grants |
|---|---|---|
| `myconnect-community-admin` | `myconnect.community_admin` | Manage communities you administer — members, invites, moderation, audit log |
| `myconnect-member` | `myconnect.member` | The full list of communities you belong to (any role), for the community picker only |

QA and UAT workspaces are pointed at `qa.myconnect.community` / `uat.myconnect.community` automatically
(myHub `MYCONNECT_BASE_URL` rewrite); the URLs above are always the production ones.

## Tools

`myconnect-community-admin`:

| Tool | What it does |
|---|---|
| `list_communities` | Communities where you are an admin or owner |
| `get_community_summary` | Members, posts, comments, events and RSVPs (30-day deltas) |
| `list_members` | Members with email, role, status, tags; filter and page |
| `get_member` | One member in full, with custom profile fields |
| `update_member` | Change role, status, display name, headline or tags |
| `invite_member` | Add an existing account now, or email an invitation |
| `list_channels` | Every channel, including private and secret |
| `get_moderation_queue` | Held posts/comments with excerpt, author and reason |
| `review_moderation_item` | Approve (publishes + notifies) or reject held content |
| `list_audit_log` | Recent admin activity, including changes made through this connector |

Every tool that works inside a community takes an optional `community` (slug or id). It is required
only when you belong to more than one, and it can only ever name one of your own communities.

`myconnect-member` (used only to populate the community picker):

| Tool | What it does |
|---|---|
| `list_communities` | Every community you're an active member of, any role, with that role included |

## Security

- Acts only with the signed-in person's own access; roles are re-checked on every call, not trusted from the connection.
- Changes run the same rules and side-effects as the myConnect app (moderation, workflows, notifications).
- Admin and platform changes are written to the community's audit log as `mcp.<server>.<tool>`.
- Disconnecting in Workspace revokes the connection in myConnect immediately.

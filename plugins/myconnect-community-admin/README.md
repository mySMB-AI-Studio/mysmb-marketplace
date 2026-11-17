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

## Sign-ups CSV

On the **myConnect Admin** tile, open **Analytics**, press **Show sign-ups**, then **Download CSV**. The tile
fetches every page of `list_members` (100 members per page) for the community and dates shown, and builds
the file only after the last page arrives. Columns: Name, Email, Status, Role, Joined, Last seen, Tags,
Access group.

Pages are fetched with the workspace's isolated tool calls for plugin actions (myHub
`widgets-system/plugin-tools.ts`, exposed to the action as `ctx.tools`):

- Every page goes to one myConnect account. The workspace pins the account that answered the first page
  and refuses a reply from any other. A tile bound to more than one account is refused.
- Pages are never cached or written to the tile's shared member list, so the Members tab and member
  popups keep working during a download and don't see its pages.
- The download stops when the tile is closed or reloaded, or its connection or signed-in user changes.

Nothing downloads when any page fails, a page doesn't line up with the one before it, you press
**Cancel**, the selected community changes, or the download stops for one of the reasons above.
**Try again** starts again from the first page.

**Workspace requirement.** This needs a myHub build that provides `ctx.tools`; deploy that host change
first. On an older workspace, **Download CSV** shows "This workspace needs an update before it can
download this CSV" and downloads nothing. It never falls back to the older single-page export.

The file is UTF-8 with a byte-order mark, every cell is quoted, and rows end with CRLF. In the file
itself, commas, quotes and line breaks (LF, CR or CRLF) inside a value stay inside that quoted cell, and
a standard (RFC 4180) CSV parser reads them back unchanged. Spreadsheet apps don't all import CSV that way.

**Formula-looking values.** A cell whose first visible character is `=`, `+`, `-` or `@` (or the
full-width `＝ ＋ － ＠`), even after leading spaces, invisible characters or a tab or line break, starts
with an apostrophe (`'`) in the file. For example, a member named `=1+1` is exported as `'=1+1`. The name
in myConnect is not changed. The apostrophe is part of the file, so it may show in the cell. This lowers
the risk of a value running as a formula when the file is opened. It isn't a guarantee for every app or
every value.

**Tested spreadsheet routes.** Two routes have been tested on a Mac, with one synthetic file
(21 rows × 8 columns: formula-looking values, quotes, commas, LF / CRLF / bare-CR line breaks and
Unicode text):

- **Numbers:** opening the CSV, then **File → Export To → CSV**, closing, and reopening the exported
  copy. Both the original and the copy showed 21 rows × 8 columns. Formula-looking values stayed as
  literal text with the apostrophe visible. Every multi-line cell stayed one cell, and Unicode displayed
  correctly. A field-by-field comparison of the original and the exported copy found no differences.
- **Excel for Mac, Text Import Wizard** (UTF-8, comma delimiter only, double-quote text qualifier, General
  columns): formula-looking values stayed as text with the apostrophe visible, including after saving a
  copy as CSV UTF-8 and reopening it through the same wizard. Commas, quotes and Unicode displayed
  correctly. **Values with line breaks did not survive:** every value containing LF, CRLF or a bare CR was
  split across extra rows (21 rows became 27), so rows after it no longer line up with their columns. If
  any member's name, tags or access groups contain line breaks, don't use this route, or check the
  imported sheet before relying on it.

Other apps (Google Sheets, LibreOffice) and Excel's other ways of opening a CSV (double-clicking the file,
**Data → From Text/CSV**) have not been tested and may behave differently. In any app:

- Saving the file and opening the saved copy can remove or reinterpret the apostrophe, and the value may
  then be treated as a formula. Editing a cell (for example, deleting the apostrophe) can have the same
  effect.
- Treat the exported file, and any copy you edit and save, as untrusted data.

## Security

- Acts only with the signed-in person's own access; roles are re-checked on every call, not trusted from the connection.
- Changes run the same rules and side-effects as the myConnect app (moderation, workflows, notifications).
- Admin and platform changes are written to the community's audit log as `mcp.<server>.<tool>`.
- Disconnecting in Workspace revokes the connection in myConnect immediately.

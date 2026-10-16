# Zoom

Access [Zoom](https://zoom.us) meetings, webinars, and the connected user's own profile via the **myHub-hosted Zoom MCP gateway** — a self-hosted connector (`myhub-mcp-servers/src/integrations/zoom`) that talks to Zoom's REST API (`https://api.zoom.us/v2`) on your behalf through a single mySMB-owned Zoom OAuth app (the same shared-app model as ApprovalMax — one app for every customer portal, not a per-tenant registration).

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to Zoom, and you're done.

## Configuration

No configuration variables are required.

## Tools & resources

This connector exposes the following MCP tools, backed directly by Zoom's REST API:

### Current user

| Tool | Description |
|------|-------------|
| `get_current_user` | Profile detail for the connected Zoom user, or another user by `user_id` (Zoom user ID or email). Omit `user_id` (or pass `"me"`) for the connected user's own profile. |

### Meetings

| Tool | Description |
|------|-------------|
| `list_meetings` | List meetings for a Zoom user. Filters: `user_id`, `type` (`scheduled` \| `live` \| `upcoming` \| `upcoming_meetings` \| `previous_meetings`, defaults to `scheduled`). Paginated via `page_size` (max 300, default 30) and `next_page_token` (expires after 15 minutes). |
| `get_meeting` | Full detail for a single meeting — join URL, settings, recurrence — by `meeting_id`. |
| `create_meeting` | Schedule a new meeting. Fields: `user_id`, `topic`, `type` (`1`=instant, `2`=scheduled [default], `3`=recurring no fixed time, `8`=recurring fixed time), `start_time` (ISO 8601 UTC, required for types 2/8), `duration` (minutes, 1–1440), `timezone` (IANA, e.g. `America/Los_Angeles`), `password` (max 10 chars), `agenda` (max 2000 chars), `settings` (free-form object passed through verbatim — e.g. `join_before_host`, `waiting_room`, `host_video`, `participant_video`, `mute_upon_entry`; see Zoom's Create a Meeting API docs for the full field list). |
| `update_meeting` | Update an existing meeting by `meeting_id`. Same optional fields as `create_meeting` (`topic`, `type`, `start_time`, `duration`, `timezone`, `password`, `agenda`, `settings`) — only the fields provided are changed. Returns no content on success. |
| `delete_meeting` | Permanently delete a meeting by `meeting_id`. Returns no content on success. |

### Webinars

| Tool | Description |
|------|-------------|
| `list_webinars` | List webinars for a Zoom user. Filters: `user_id`, `type` (`scheduled` \| `upcoming`, defaults to `scheduled`). Paginated via `page_size` (max 300, default 30) and `next_page_token` (expires after 15 minutes). Requires the Webinar add-on license. |
| `get_webinar` | Full detail for a single webinar by `webinar_id`. Requires the Webinar add-on license. |

## Capabilities this connector does NOT have

- **No webhook / real-time events.** Every tool above is on-demand/pull only — there's no push notification when a meeting starts, ends, or a webinar registrant signs up. Poll `list_meetings`/`list_webinars` if you need to track state over time.
- **No participant, registrant, or recording management.** This connector covers meeting/webinar scheduling metadata and the user's own profile — it does not list attendees, manage webinar registrants, or access cloud recordings.
- **No Zoom Phone or Zoom Chat APIs.** Out of scope for this pass.

## Destructive / mutating operations

Confirm before calling — these change the connected user's live Zoom account:

- `create_meeting` — schedules a new meeting on the connected (or specified) user's calendar.
- `update_meeting` — changes an existing meeting's details.
- `delete_meeting` — **permanently deletes** a meeting. There is no undo.

## Rate limits

Follow Zoom's own published API rate limits. If a tool call returns a `429`, wait a few seconds and retry once.

## See also

- [Zoom API docs](https://developers.zoom.us/docs/api/)
- [Zoom OAuth integration guide](https://developers.zoom.us/docs/integrations/oauth/)

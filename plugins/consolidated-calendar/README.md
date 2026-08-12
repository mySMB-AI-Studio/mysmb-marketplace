# Consolidated Calendar plugin

One calendar view across **Outlook (Microsoft 365)**, **Google Calendar**, and **iCloud**.

Ships three MCP server connections (the same myHub-hosted gateways the standalone
Microsoft 365 and Google Workspace plugins use, plus the iCloud Calendar CalDAV
gateway) and a **Consolidated Calendar** dashboard tile that merges today's events
from all three sources into a single chronological agenda, each row tagged with its
source.

## Connectors used

| Server | Upstream | Auth |
|---|---|---|
| `m365-calendar` | Microsoft Graph (Outlook calendar) | OAuth — Connect opens the Microsoft sign-in popup |
| `google-workspace-calendar` | Google Calendar API | OAuth — Connect opens the Google sign-in popup |
| `icloud-calendar` | iCloud Calendar over CalDAV | App-specific password — Connect opens a credential form |

The tile degrades gracefully: sources that aren't connected simply contribute no
rows, and each source's events appear as soon as that source responds.

> **Note:** this plugin intentionally declares no `connection` block — the block
> applies to every server in a plugin, and this plugin mixes OAuth servers with a
> static-credential server. The per-server defaults do the right thing: the two
> OAuth servers get the popup flow, and the iCloud server (whose `${VAR}`
> placeholders live in its headers) gets the credential modal.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ICLOUD_APPLE_ID` | yes | The Apple ID email the iCloud calendars belong to (e.g. `you@icloud.com`). |
| `ICLOUD_APP_PASSWORD` | yes | An **app-specific password** — NOT the Apple ID password. Generate one at [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords (the Apple ID must have two-factor authentication enabled). Format `xxxx-xxxx-xxxx-xxxx`. Revocable any time from the same page. |

The Microsoft and Google connections need no variables — they authenticate with
the OAuth popup flow at Connect time.

## What ships

- **Widget** `consolidated-calendar-today` — "Consolidated Calendar" tile: per-source
  counts, then today's events from all three calendars merged chronologically with
  source badges. Click-free v1 (rows link out via each source's native tools).
- **Widget elements** — `merge_events` (normalises Graph / Google / CalDAV event
  shapes and merges + sorts them), `source_label`, `source_tone`.
- **Skill** `consolidated-calendar-agenda` — teaches the assistant to answer
  "what's on today / this week?" by querying all three calendars and merging.

## Event shape notes (for widget authors)

- Outlook events land at `/m365-calendar/list_events` (array of Graph events —
  `subject`, `start.dateTime` in UTC, `location.displayName`, `webLink`).
- Google events land at `/google-workspace-calendar/list_events` (response object —
  events under `items`, each with `summary`, `start.dateTime|date`, `htmlLink`).
- iCloud events land at `/icloud-calendar/list_all_events` (array — `summary`,
  ISO `start`/`end`, `calendarName`, `url`; all-day events use bare dates).
- `consolidated-calendar_merge_events` accepts all three raw payloads and returns
  `{ id, source, sourceLabel, title, start, end, allDay, location, calendar, url }`
  sorted by start time.

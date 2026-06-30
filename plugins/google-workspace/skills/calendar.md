---
name: google-workspace-calendar
description: List, create, update, and delete Google Calendar events via the Google Workspace MCP server. Use when the user asks about their schedule, upcoming meetings, wants to create an event, reschedule, or cancel a meeting.
---

# Google Calendar — managing events and schedules

Use the `google-workspace-calendar` MCP server for all Calendar operations.

## Listing calendars

Call `list_calendars` to retrieve all calendars the user has access to: primary, other personal calendars, shared team calendars, and subscribed calendars. Each entry has an `id`, `summary` (display name), and `accessRole`.

The primary calendar `id` is typically the user's email address. Use `primary` as a shorthand for the primary calendar in most tools.

## Listing events

Call `list_events` with:

- `calendarId` — defaults to `primary`
- `timeMin` / `timeMax` — ISO 8601 date-times (e.g. `2025-06-01T00:00:00Z`)
- `maxResults` — number of events (default 10)
- `orderBy` — `startTime` (for non-recurring) or `updated`
- `q` — free-text search across event title and description

Present events as: title, date and time, location or conference link, attendees count. Use the user's local timezone when displaying times — ask if unknown.

## Getting event details

Call `get_event` with `calendarId` and `eventId`. Returns full attendee list, conferencing data (Meet/Zoom link), description, attachments, and recurrence rule.

## Creating events

Use `create_event`. Required fields:

- `summary` — event title
- `start` — `{ dateTime: "2025-06-15T10:00:00+10:00", timeZone: "Australia/Sydney" }`
- `end` — same shape

Optional but commonly needed:

- `description` — meeting agenda or notes
- `attendees` — array of `{ email }` objects; Google sends invitations automatically
- `location` — physical address or conference URL
- `conferenceData` — set `createRequest` to auto-generate a Google Meet link

**Creating an event with attendees sends real calendar invitations.** Confirm the guest list, date, and time with the user before calling.

After success, surface the event `id`, `htmlLink` (Google Calendar web link), and any conference join URL.

## Updating events

Use `update_event` with the `calendarId`, `eventId`, and only the fields that are changing. To reschedule, update `start` and `end`. To add an attendee, append to the `attendees` array.

**Updating an event with attendees sends update notifications.** Confirm the change with the user first.

## Deleting / cancelling events

Call `delete_event` with `calendarId` and `eventId`. This removes the event from all attendees' calendars and sends cancellation notifications.

**This is irreversible.** Always confirm with the user before calling.

## Finding free/busy slots

Call `get_freebusy` with a `timeMin`, `timeMax`, and an array of calendar IDs or email addresses. The response shows busy intervals for each calendar — use this to find a slot when everyone is free before proposing a meeting time.

## Error handling

- `401` — token expired or missing the `calendar.events` scope.
- `403` — insufficient permissions; the token lacks `https://www.googleapis.com/auth/calendar.events`.
- `404` — event or calendar not found; confirm IDs.
- `409 Conflict` — event ID collision; let the server generate the ID instead of supplying one.

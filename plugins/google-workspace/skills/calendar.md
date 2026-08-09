---
name: google-workspace-calendar
description: List and read Google Calendar events via the Google Workspace MCP server. Use when the user asks about their schedule or upcoming meetings. Create, update, and delete events are not available (read-only scope).
---

# Google Calendar — viewing events and schedules

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

## Finding free/busy slots

Call `get_freebusy` with a `timeMin`, `timeMax`, and an array of calendar IDs or email addresses. The response shows busy intervals for each calendar — use this to find a slot when everyone is free.

## What is not available

Calendar is connected with `calendar.events.readonly` scope. The following operations are not available:

- Creating events
- Updating or rescheduling events
- Deleting or cancelling events

If the user asks to create or modify a calendar event, explain that the Calendar connection is read-only and they would need to reconnect with a broader scope.

## Error handling

- `401` — token expired or missing the `calendar.events.readonly` scope.
- `403` — insufficient permissions; the token lacks `https://www.googleapis.com/auth/calendar.events.readonly`.
- `404` — event or calendar not found; confirm IDs.

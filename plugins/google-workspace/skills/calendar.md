---
name: google-workspace-calendar
description: List and read Google Calendar events via the Google Workspace MCP server. Use when the user asks about their schedule or upcoming meetings. Create, update, and delete events are not available (read-only scope).
---

# Google Calendar — viewing events and schedules

Use the `google-workspace-calendar` MCP server for all Calendar operations. It is connected with `calendar.events.readonly` (read events) and `calendar.calendarlist.readonly` (list the user's calendars).

## Listing calendars

Call `list_calendars` for the calendars the user has: primary, other personal calendars, shared team calendars, and subscribed calendars. Use `primary` as the shorthand for the primary calendar.

## Upcoming agenda across calendars

Call `get_upcoming_events_dashboard` for one merged view of the next 30 days across every calendar the user has ticked as visible in Google Calendar. Each event carries its calendar name and colour, the user's RSVP, whether it clashes with another event, and a Meet link when present.

## Listing events

Call `list_events` with:

- `calendarId` — defaults to `primary`
- `timeMin` / `timeMax` — RFC 3339 date-times (e.g. `2026-06-01T00:00:00Z`)
- `maxResults` — up to 50 (default 10)
- `orderBy` — `startTime` or `updated`
- `q` — free-text search across event fields

Present events as: title, date and time, location or conference link. Use the user's local timezone — ask if unknown.

## Getting event details

Call `get_event` with `calendarId` and `eventId` for attendees, location, description and the conference link.

## What is not available

- Creating, updating, rescheduling or deleting events
- Responding to invitations
- Free/busy lookups for other people

## Error handling

- `401` — the connection needs re-authorising; ask the user to reconnect Calendar in Settings → Extensions → Connections.
- `403` — the connection lacks `calendar.events.readonly` or `calendar.calendarlist.readonly` (a Calendar connection made before October 2026 may need reconnecting).
- `404` — event or calendar not found; confirm IDs.

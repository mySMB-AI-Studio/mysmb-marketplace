---
name: consolidated-calendar-agenda
description: Answer cross-calendar agenda questions — "what's on today", "am I free at 3", "show my week" — by merging Outlook (Microsoft 365), Google Calendar, and iCloud events into one chronological view.
---

# Consolidated agenda

The user's events live in three calendars. For any agenda or availability
question, query all three and merge — never answer from a single source unless
the user names it.

## Tools

| Source | Tool | Range params |
|---|---|---|
| Outlook | `m365-calendar` → `list_events` | `startDateTime`, `endDateTime` (ISO) |
| Google | `google-workspace-calendar` → `list_events` | `timeMin`, `timeMax` (ISO); also pass `calendarId: "primary"`, `singleEvents: true`, `orderBy: "startTime"` |
| iCloud | `icloud-calendar` → `list_all_events` | `start`, `end` (ISO) — spans every iCloud calendar in one call |

## Working style

1. Call all three list tools for the same range (they are independent — call them together).
2. Merge chronologically. Watch the shapes: Outlook `start.dateTime` is UTC, Google uses `start.dateTime` (with offset) or `start.date` (all-day), iCloud uses ISO `start` (bare date = all-day). Present times in the user's local timezone.
3. Tag every event with its source — `[Outlook]`, `[Google]`, `[iCloud]` — and for iCloud include the calendar name when it adds context.
4. If one source fails (commonly: not connected yet), still answer from the others and say which source was unavailable — e.g. "iCloud isn't connected; showing Outlook and Google only."
5. For availability questions ("am I free at 3?"), a slot is free only if it is clear in **all three** calendars.
6. Do not create, move, or delete events from this skill — surface the conflict or gap and let the user decide. Each source has its own write tools if they ask.

---
name: calendly-manage-availability
description: How to view and update Calendly availability schedules and check busy times. Use when the user wants to see their working hours, modify availability windows, or check what times are already blocked.
---

# Managing availability in Calendly

## When to use this skill

Use this skill when the user wants to:
- View their current availability schedules (working hours)
- Check what times are blocked in a date range
- Update availability windows for an event type or schedule

## Viewing availability schedules

1. Call `availability-list_user_availability_schedules` — returns all schedules for the current user.
2. To get the rules (days and time windows) for a specific schedule, call `availability-get_user_availability_schedule` with the `uuid` from the listing.
3. Present the schedule name, timezone, and the time windows per day of week.

## Checking busy times

To find what blocks are already on the user's calendar within a range:

1. Call `availability-list_user_busy_times` with:
   - `user` — the user's URI (obtain from `users-get_current_user`)
   - `start_time` — ISO 8601 start of the range
   - `end_time` — ISO 8601 end of the range (max 1 week per request)
2. Returns a collection of busy periods. Summarise any conflicts for the user.

## Updating an availability schedule for an event type

To change when an event type is bookable:

1. Call `event_types-list_event_type_availability_schedule` with the event type URI to see the current schedule.
2. Call `event_types-update_event_type_availability_schedule` with the event type URI and the new `rules` array.

Each rule specifies:
- `type`: `"wday"` (recurring weekly) or `"date"` (one-off override)
- `wday`: day name (e.g. `"monday"`) — for `wday` rules only
- `date`: ISO date — for `date` rules only
- `intervals`: array of `{ "from": "HH:MM", "to": "HH:MM" }` objects (empty array = unavailable that day)

## Notes

- Schedules are in the user's configured timezone. Always confirm the timezone before presenting times.
- Changes to availability schedules affect all event types using that schedule — warn the user before making updates.

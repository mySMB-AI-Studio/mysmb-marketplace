---
name: calendly-schedule-meeting
description: How to schedule a new meeting (create an invitee booking) via Calendly. Use when the user wants to book a time, add an invitee to a meeting, or create a scheduling link for a one-off event.
---

# Scheduling a meeting via Calendly

## When to use this skill

Use this skill when the user wants to:
- Book a time slot on a Calendly event type
- Create a scheduling link for a specific one-time meeting
- Add an invitee to an existing event

## Step-by-step

1. **Identify the event type** — Call `event_types-list_event_types` to list available event types. Present them to the user and ask which one to use if not specified.

2. **Check availability** — Call `event_types-list_event_type_available_times` with the chosen event type URI and a `start_time` / `end_time` range (default to the next 7 days if not specified). Show the available slots.

3. **Book the meeting** — Once the user picks a slot, call `meetings-create_invitee` with:
   - `event_type` — the full event type URI (e.g. `https://api.calendly.com/event_types/<uuid>`)
   - `start_time` — ISO 8601 datetime (e.g. `2026-06-20T10:00:00Z`)
   - `invitee.name` — the invitee's full name
   - `invitee.email` — the invitee's email address
   - `timezone` — optional; defaults to the event type's timezone

   Note: `meetings-create_invitee` requires a **paid Calendly plan**. If the account is on Free, use `scheduling_links-create_single_use_scheduling_link` instead and share the link with the invitee.

4. **Confirm** — Report the confirmed event URI and start time back to the user.

## Alternative — single-use scheduling link

If direct booking is not possible or the user prefers to let the invitee choose a time:

1. Call `scheduling_links-create_single_use_scheduling_link` with `max_event_count: 1` and the `owner` (event type URI).
2. Share the returned `booking_url` with the invitee.

## Error handling

- If `meetings-create_invitee` returns a 403, the account does not have a paid plan — fall back to the scheduling-link approach.
- If no available times are returned, the user's availability schedule may block the requested range. Ask the user to check their Calendly availability settings.

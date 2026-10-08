---
name: healthcare-practice-management-scheduling-reasoning
description: Reads available times, appointment types and blocked time to propose suitable slots, and checks for conflicts before any diary change. Use for AU-04 (reschedule requests) and AU-05 (cancellation to reschedule offer).
---

# Scheduling reasoning

Use before proposing, moving or cancelling any Cliniko appointment.

1. Identify the current appointment with `get_individual_appointment` or `list_individual_appointments` (filtered by patient and date range).
2. Confirm the appointment type's duration with `get_appointment_type` so any proposed slot is long enough.
3. Find real availability with `get_available_times` (and `get_next_available_time` for "as soon as possible" requests), scoped to the same practitioner and business as the original appointment unless the patient says otherwise. Cross-check against `list_unavailable_blocks` for blocked time the availability call might not already exclude.
4. Before finalising any change, call `get_individual_appointment_conflicts` to check for a double-booking. Never propose or apply a slot that conflicts.
5. Apply `healthcare-practice-management-practice-policy`'s `cancellation_window_hours` rule: a cancellation or reschedule request inside that window is flagged for the practitioner's judgement, not auto-offered a reschedule, unless policy says otherwise.
6. Never call `update_individual_appointment` or `cancel_individual_appointment` directly from this skill — propose 2–3 concrete options for `healthcare-practice-management-practitioner-voice-drafting` to offer, and let the calling automation apply the practitioner's approved choice.

Guardrails: always re-check availability immediately before applying a change (times can fill between proposal and approval); never propose a slot outside the practice's normal operating hours implied by its appointment types and existing bookings.

Example: a cancellation for Thursday 10am (appointment type "Initial consult", 45 min). `get_available_times` for the same practitioner over the next 10 days returns three 45-minute slots; `get_individual_appointment_conflicts` confirms none clash with existing bookings. Offer the two earliest.

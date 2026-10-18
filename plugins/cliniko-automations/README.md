# Cliniko Automations

Automations for Cliniko-based allied-health practices. Each item approval-gates anything
patient-facing or diary-changing through WorkQ before it happens.

## What's in this extension

- **#1 Reschedule and cancellation desk** — two automations:
  - *Draft reschedule or cancellation reply* (scheduled, every 15 minutes): finds reschedule/cancel
    emails in the practice inbox, matches the patient and their upcoming Cliniko appointment, checks
    real availability over the next 6 days, drafts a reply, and creates a WorkQ item with the
    **Reschedule or cancellation reply review** form attached.
  - *Apply reschedule or cancellation reply* (triggered by that form's submission): sends the
    approved/edited reply, and for a cancellation, cancels the Cliniko booking. A reschedule's
    booking is intentionally left untouched — the patient still has to reply picking one of the
    offered times, and no automation yet reads that reply and moves the booking.

- **#2 Cancellation gap filler**, first step:
  - *Find freed slots to fill* (scheduled, every 15 minutes): finds Cliniko slots that came free
    between 2 hours and 7 days from now. These are cancelled bookings, plus old times freed when
    *Apply patient's chosen reschedule time* moves a booking (it leaves a note in
    `PracticeManager/State/<slug>-freed-slots.json`). It skips slots that have been rebooked since.
    For each free slot it lists candidate patients: those booked later with the same practitioner,
    and overdue patients last seen 6–16 weeks ago with nothing booked. AI ranks them and drafts a
    personalised offer for each, and it creates one WorkQ item with the **Freed slot offer
    approval** form attached. It sends nothing; sending the approved offers and booking the first
    acceptance are the next steps. Override the window with `gap_filler.min_notice_hours` / `max_days_ahead` in
    the practice settings file.

More automations from the practice's Top 10 shortlist (referral/care plan watchdog, no-show
recovery, new-enquiry-to-booked-patient, calendar guard) will be added here.

## Requires

- A practice settings file already created at `PracticeManager/Practices/<slug>.json` (via the
  `healthcare-practice-management` extension's **Start practice setup** / **Apply practice setup**
  automations) — these automations read `cancellation_window_hours` and `tone` from it.
- Nothing else to configure for a single practice: each automation's `practice_slug` param can
  stay blank, and it then uses the only settings file in `PracticeManager/Practices/`. Set the
  param only when more than one practice is set up.

## Configuration

- **Cliniko**: set `CLINIKO_API_KEY` when connecting this extension's Cliniko servers
  (`cliniko-scheduling`, `cliniko-patients`) — the practice's own Cliniko API key.
- **Microsoft 365 mail**: `m365-mail-read` and `m365-mail-send` connect via the standard OAuth
  flow; no extra configuration.

## Known gaps (v1)

- Reschedule bookings aren't moved automatically — only the offer is sent. Closing that loop (the
  patient's reply naming which time they chose) needs a follow-up automation.
- No cross-check against `list_unavailable_blocks` or appointment-conflict checking before
  proposing times — availability comes from `get_available_times` alone.
- Patient matching is by exact email only; a parent/guardian contact match requires exactly one
  Cliniko contact record for that email (no secondary disambiguation yet).

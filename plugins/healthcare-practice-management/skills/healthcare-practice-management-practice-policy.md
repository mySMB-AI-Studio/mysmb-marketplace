---
name: healthcare-practice-management-practice-policy
description: Applies the practice's own configured rules — cancellation window, payment-before-dispatch, email over SMS, approval requirements, payer addressing. Use for AU-05, AU-10, AU-11 and as the first step of any automation that needs a policy decision.
---

# Practice policy application

Use at the start of any automation or draft that depends on a practice-specific rule rather than a universal one. Load `healthcare-practice-management-foundation` first for the file layout.

1. Read `PracticeManager/Practices/<practice-slug>.json` with `api.files.read`. If it doesn't exist, stop: this practice has no policy configured yet, and nothing patient-facing or diary-changing should proceed on a guessed default.
2. Apply the relevant `policy` field for the decision at hand:
   - `cancellation_window_hours` — how close to an appointment a cancellation/reschedule stops being auto-offered a new slot (see `healthcare-practice-management-scheduling-reasoning`).
   - `tone` — feeds `healthcare-practice-management-practitioner-voice-drafting`.
   - `email_tiers` — feeds `healthcare-practice-management-email-triage`.
   - `payer_addressing` — feeds `healthcare-practice-management-patient-payer-resolution`.
   - `approval_required_for` — a list of action kinds (`patient_facing_email`, `diary_change`, `invoice_status_change`, …) that must land in WorkQ before they happen. Treat anything not explicitly marked `"auto"` in `email_tiers`, or not absent from this list, as needing approval.
   - `never_do` — a hard stop list. If an action matches one of these, refuse it and say why, regardless of who asked.
3. When a decision isn't covered by any configured field, default to the more conservative (approval-required) behaviour and note the gap — don't silently invent a policy.

Guardrails: policy is per practice, never global — always re-read the specific practice's file rather than reusing a value seen earlier in the conversation, since a workspace may manage more than one practice. `healthcare-practice-management-guardrail-audit` is the enforcement layer that actually blocks a violating action; this skill is where the rule is looked up.

Example: an automation wants to send a payer-addressed invoice email automatically. `policy.approval_required_for` includes `patient_facing_email`, so even though AU-11 is configured as an "Auto" automation in the spec, this practice's own policy still routes the draft to WorkQ first.

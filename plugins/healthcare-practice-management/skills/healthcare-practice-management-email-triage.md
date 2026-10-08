---
name: healthcare-practice-management-email-triage
description: Sorts inbound practice email into the practice's own tiers (reschedules/cancellations/results, patient queries, industry news), flags urgency and surfaces anything missed. Use for AU-03 (inbox triage) and AU-13 (weekend queue and Friday loose ends).
---

# Email classification and triage

Use when a new email has arrived in the practice inbox and needs sorting before any reply is drafted. Load `healthcare-practice-management-foundation` and `healthcare-practice-management-practice-policy` first to get the practice's own `email_tiers` and timezone.

1. List new mail since the last run: on Outlook, `list_emails` (folder `"inbox"`, `unreadOnly` true or filtered by received date) then `get_email` for full content; on Gmail (dev), `list_messages` then `get_message`. There is no connector-level "new email" event — this always runs on a schedule, so track the newest timestamp or id you've already triaged and don't re-triage it.
2. Classify each email into exactly one of the practice's configured `email_tiers` (from `PracticeManager/Practices/<slug>.json` → `policy.email_tiers`). If none fit confidently, use the lowest-approval tier and say why in your summary — never invent a new tier.
3. Flag urgency: a cancellation or reschedule request for an appointment in the next 48 hours, or a test result email, is urgent regardless of tier.
4. Note whether the email already has an attachment (`hasAttachments` on Outlook, or Gmail's attachment list) — route it to `healthcare-practice-management-document-extraction` if it looks like a test result or supplier document, not here.
5. For an email that doesn't fit any automation (a question only the practitioner can answer, a personal email), surface it rather than guessing a reply — this becomes a line in the Inbox loose ends report (RP-05), not a silent skip.
6. Write one `healthcare-practice-management-guardrail-audit` entry per email with `action: "read"`, naming the tier and urgency.

Guardrails: never mark an email as handled without a tier decision; never auto-reply from this skill — drafting is `healthcare-practice-management-practitioner-voice-drafting`'s job, sending always needs approval per policy.

Example: an Outlook inbox poll returns 6 unread emails. Four match "patient_query", one is a reschedule request (tier "clinical", urgent — appointment in 2 days), one is a supplier newsletter (tier "industry", not urgent). Hand the reschedule one to `healthcare-practice-management-patient-payer-resolution` next.

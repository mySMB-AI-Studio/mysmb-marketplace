---
name: healthcare-practice-management-practitioner-voice-drafting
description: Drafts replies, follow-ups and offers in the practitioner's own tone, never sent without approval. Use for AU-03, AU-04, AU-05, AU-08, AU-12 and any other patient- or payer-facing email.
---

# Practitioner-voice drafting

Use whenever a reply, offer or follow-up email needs to go out to a patient or payer. Load `healthcare-practice-management-practice-policy` first for the practice's configured `tone`.

1. Read a handful of the practitioner's own recently sent emails for voice (Outlook: `list_emails` with `folder: "sentitems"` then `get_email`; Gmail: `list_messages` with a `from:me` style query via `search_emails` if available, else skip and rely on `policy.tone`). Match sentence length, greeting and sign-off style, not just vocabulary.
2. Apply `healthcare-practice-management-patient-payer-resolution` first so the draft addresses the right person (patient, or parent/guardian when they are the contact and payer).
3. Draft as a reply-in-thread where one exists: Outlook `create_reply_draft`, Gmail (dev) `create_draft`. Use `create_draft_email` (Outlook) only for a new thread (e.g. a payer-addressed invoice email with no prior thread).
4. Never claim something you haven't verified against Cliniko or Xero (an appointment time, an amount owing). Pull the real value first with the relevant tool, then write it into the draft.
5. Keep it short: one clear ask or answer per email, the practice's tone, no clinical interpretation (see `healthcare-practice-management-clinical-summarisation` for the "summaries only" boundary).
6. Never call a send tool (`send_email`, `reply_to_email`, `forward_email`) directly from this skill. Every patient- or payer-facing draft goes to WorkQ for approval first, per `policy.approval_required_for` — that's `healthcare-practice-management-guardrail-audit`'s job to enforce and record.
7. Write a `healthcare-practice-management-guardrail-audit` entry with `action: "drafted"`.

Guardrails: never threaten fees, legal action or urgency language not in the practice's own `never_do` exceptions (see `healthcare-practice-management-debtor-follow-up` for the debtor-specific version of this rule). If the practitioner's edits to a past draft are available, treat them as the stronger signal over generic tone guidance.

Example: a reschedule request from Jo Chen. Resolve Jo as a patient (not a payer concern). Check real availability (`healthcare-practice-management-scheduling-reasoning`) before drafting so the draft offers times that are actually free. Draft a reply-in-thread offering two concrete slots, practitioner's usual sign-off, and route it to WorkQ.

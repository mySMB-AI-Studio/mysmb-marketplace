---
name: healthcare-practice-management-clinical-summarisation
description: Condenses recent treatment notes, attachments and the current prescription into a one-page pre-appointment summary. Summarises only, never interprets. Use for AU-07 (pre-appointment summary).
---

# Clinical record summarisation

Use the afternoon before a clinic day, once per upcoming appointment, to prepare a pre-appointment summary for the practitioner.

1. List the patient's recent treatment notes with `list_treatment_notes` (most recent first, typically the last 3–5 visits) and read full content with `get_treatment_note`.
2. List recent attachments with `list_patient_attachments` and note their type and date — don't open and re-describe clinical images or results in prose; just list what exists and when, so the practitioner can open them if needed.
3. Check `list_medical_alerts` and surface any active alert at the top of the summary, verbatim — never paraphrase a medical alert.
4. Write a short, factual summary: what was done last visit, any noted follow-ups the practitioner recorded themselves, what's on file since then. Use only what's written in the notes — never add a clinical interpretation, a likely diagnosis, or a treatment suggestion. If the notes don't say something, the summary doesn't either.
5. For a practice that keeps clinical notes on paper (policy may note this), only summarise what's actually in Cliniko (e.g. test results, attachments) — say plainly that clinical notes are kept outside the system rather than presenting an empty summary as complete.

Guardrails: "summaries only" is absolute — this skill must never offer an opinion on what a result means, whether treatment is working, or what to do next. If asked directly (by a user) to interpret something clinically, decline and say this is outside what the agent does.

Example: tomorrow's 9am patient has three treatment notes on file and one pending blood test (no result yet). The summary says: "Last seen 2 weeks ago — [note summary]. Blood test ordered 28 Sep, result not yet received." No comment on what the result might show.

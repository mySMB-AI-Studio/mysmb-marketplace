---
name: healthcare-practice-management-patient-payer-resolution
description: Matches an email, attachment or payment to the right Cliniko patient, and identifies who to address when a parent or guardian is the contact and payer. Use for AU-04, AU-06, AU-08, AU-09, AU-11 and anywhere a name needs matching to a patient record.
---

# Patient and payer resolution

Use before drafting, filing an attachment, or following up on money, whenever you need to know exactly which Cliniko patient (and which contact to address) a piece of information belongs to.

1. Search by the strongest identifier available: email address or full name via `list_patients` (filter client-side on name/email fields), or `list_contacts` when the sender is a parent/guardian rather than the patient themself.
2. If more than one patient plausibly matches (same name, shared family email), use secondary signals — the appointment context, patient date of birth if present in the thread, or the Cliniko `get_patient` record's linked contacts — before concluding.
3. Determine payer: read the patient's linked contact record (`get_contact` / `get_patient`) for a designated parent or guardian who is billed. When the payer differs from the patient (a child patient), address the payer by name in any email, and mention the patient by name in the body, not the salutation.
4. If no confident match exists, stop and ask — in WorkQ for an automation run, or directly if in chat. Never guess a patient match for anything that will touch billing, clinical records or an email send. A wrong patient match is worse than a delay.
5. Record the match (or the "uncertain, asked" outcome) as part of the calling automation's own audit entry — this skill doesn't write its own audit line, since it's always used inside another action.

Guardrails: never merge two different patients' information because their names are similar; never assume the sender of an email is the patient without checking (many emails come from a parent/guardian or a different family member).

Example: an email signed "Sarah (David's mum)" arrives about a reschedule. `list_patients` for "David" plus the sending email address on the linked contact resolves to patient David Chen, contact/payer Sarah Chen. The reply addresses Sarah, references David's appointment.

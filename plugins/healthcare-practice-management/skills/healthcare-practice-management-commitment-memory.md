---
name: healthcare-practice-management-commitment-memory
description: Remembers open loops across conversations and automation runs — promised payment dates, reschedule offers awaiting reply, results not yet reviewed, actions the practitioner said they'd do. Use for AU-04, AU-08, AU-13, and whenever an open loop needs creating, checking or closing.
---

# Commitment memory

Use whenever an interaction creates a commitment someone needs to follow up on, or whenever you need to check what's still open. Load `healthcare-practice-management-foundation` first for the file path and schema.

1. Read `PracticeManager/Commitments/<practice-slug>.json` with `api.files.read`; treat a missing file as an empty list, not an error.
2. **Creating** a commitment: append an object with a new `id` (generate a UUID), the right `type` (`payment_promise`, `reschedule_offer`, `result_pending_review`, `practitioner_action`), `patient_name`, a one-line `description`, `created_at` (now, practice timezone), a `due_date` when one is known, `status: "open"`, and `source` (`{kind, id}` pointing at the email, WorkQ item or appointment that created it). Write the whole updated array back with `api.files.write` — this file is small enough to read-modify-write, unlike the audit log.
3. **Checking**: filter for `status: "open"` and a `due_date` on or before today (for the daily brief), or for a specific patient/type (for debtor follow-up deciding its escalation step).
4. **Resolving**: when a reply, payment or appointment confirms the loop is closed, set `status: "resolved"` and `resolved_at` (now). An unresolved commitment whose `due_date` has passed by more than a few days without a reply becomes `status: "expired"` rather than staying `"open"` forever — surface expired ones in the daily brief as needing a decision, not silently.
5. Never delete a commitment outright — resolved and expired entries stay as a record; this file is also a source for what the practitioner has been promised, if they ask.

Guardrails: one commitment per real loop — don't create a duplicate for the same reschedule offer across multiple runs; check for an existing open entry with the same `source` first.

Example: a reschedule offer email is drafted and approved. Create a `reschedule_offer` commitment with `due_date` two days out. If the patient doesn't reply by then, the daily brief surfaces it as expired, prompting a follow-up rather than it being forgotten.

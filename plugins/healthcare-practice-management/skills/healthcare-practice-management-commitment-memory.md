---
name: healthcare-practice-management-commitment-memory
description: Reads open loops across conversations and automation runs — promised payment dates, reschedule offers awaiting reply, results not yet reviewed, actions the practitioner said they'd do. Use for AU-04, AU-08, AU-13, and whenever an open loop needs checking. Writing a new one is an automation's job, not the chat agent's.
---

# Commitment memory

Use whenever you need to check what's still open, or an automation needs to record a new loop. Load `healthcare-practice-management-foundation` first for the file path, schema, and the read-only limit that applies to the chat agent.

## Reading (the chat agent does this)

1. Read `PracticeManager/Commitments/<practice-slug>.json` with `knowledge_read(scope="org", path="PracticeManager/Commitments", fileName="<practice-slug>.json")`; treat a missing file or empty result as "no open commitments," not an error.
2. **Checking**: filter for `status: "open"` and a `due_date` on or before today (for the daily brief), or for a specific patient/type (for debtor follow-up deciding its escalation step).
3. Report what you find plainly — which loop, who it's for, how old it is. Don't editorialise about whether it should have been resolved by now beyond what the `due_date`/`status` already says.

## Writing (an automation's job — the chat agent cannot do this)

The chat agent's Knowledge tools cannot write at organisation scope — see `healthcare-practice-management-foundation`. Creating, updating or resolving a commitment entry only happens inside an automation, with `api.files.read`/`api.files.put` (scope locked to `org`), using this shape:

- **Creating**: append an object with a new `id` (generate a UUID), the right `type` (`payment_promise`, `reschedule_offer`, `result_pending_review`, `practitioner_action`), `patient_name`, a one-line `description`, `created_at` (now, practice timezone), a `due_date` when one is known, `status: "open"`, and `source` (`{kind, id}` pointing at the email, WorkQ item or appointment that created it). Check for an existing open entry with the same `source` first — one commitment per real loop, never a duplicate for the same offer across runs.
- **Resolving**: when a reply, payment or appointment confirms the loop is closed, set `status: "resolved"` and `resolved_at` (now). An unresolved commitment whose `due_date` has passed by more than a few days without a reply becomes `status: "expired"` rather than staying `"open"` forever.
- Never delete a commitment outright — resolved and expired entries stay as a record.

**If you are the chat agent and the practitioner asks you to remember or follow up on something right now, and no automation already owns that kind of action:** don't pretend to add a commitment entry — you can't. Create a real WorkQ item instead with `todo_create` (title describing what to check, a `due_date` if one was implied), and tell the practitioner that's how you're tracking it. Once a matching domain automation exists, its own writes to this file supersede the WorkQ-item workaround.

Example: a reschedule offer email is drafted and approved by a future reschedule-handling automation. That automation creates a `reschedule_offer` commitment with `due_date` two days out directly in `PracticeManager/Commitments/<slug>.json`. If the patient doesn't reply by then, the daily brief (reading this file) surfaces it as expired. Until that automation exists, the same "remind me to follow up on Jo's reschedule" request from chat becomes a WorkQ item instead.

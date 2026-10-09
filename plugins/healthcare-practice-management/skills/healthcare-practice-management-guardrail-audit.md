---
name: healthcare-practice-management-guardrail-audit
description: Checks every action against the practice's approval rules and never-do list before it happens, and writes an audit trail of what was read, drafted, approved and sent. Use before every action, in every automation and in chat.
---

# Guardrail enforcement and audit

Use before any action that reads sensitive data, drafts patient-facing content, or would change the diary, an invoice or anything else external. Load `healthcare-practice-management-foundation` first for the audit-log format, and `healthcare-practice-management-practice-policy` for the rules being enforced.

1. Before acting, check the action against the practice's `policy.never_do` list. A match is a hard stop: refuse, explain why in plain words, and write an audit entry with `action: "blocked"`.
2. Check whether the action's kind appears in `policy.approval_required_for` (or isn't explicitly marked `"auto"` in `email_tiers`). If so, the action must land in WorkQ for approval rather than executing directly — this is what stops every patient-facing send and every diary change from happening without a human decision, per the spec's own guardrail rule.
3. After the action happens (a read, a draft, an approval, a send, a rejection, an edit, or a block), write one line to `PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl` (today's date, practice timezone) via `api.files.write` in **append** mode — read the day's file first only if the platform has no native append, then write content + newline + the new line, never dropping prior lines. Use the exact keys from `healthcare-practice-management-foundation`'s format: `ts`, `practice_slug`, `actor`, `source`, `action`, `target`, `summary`, and `guardrails`/`workq_item_id`/`minutes_saved_estimate` when relevant.
4. `source` should name the calling automation or skill (e.g. `"automation:AU-04 Reschedule request handling"`, `"skill:healthcare-practice-management-practice-data-qa"`, `"agent-chat"`) so RP-06 can group by where an action came from.
5. Never retrofit an audit entry after the fact to look like the check happened earlier than it did — `ts` is always "now", not backdated to when the triggering email arrived.

Guardrails for this skill itself: the audit log is append-only — never truncate or rewrite a past day's file. A guardrail check that blocks an action still gets logged; a blocked action is data too (it's what RP-06 reports as prevented, not just approved).

Example: an automation wants to send a reschedule offer. Policy requires approval for `patient_facing_email` → route to WorkQ instead of calling `reply_to_email` directly, log `action: "drafted"` now, and log `action: "sent"` only after the WorkQ approval triggers the actual send.

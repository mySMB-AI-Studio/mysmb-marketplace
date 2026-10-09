---
name: healthcare-practice-management-guardrail-audit
description: Checks every action against the practice's approval rules and never-do list before it happens, routes anything needing approval to a real WorkQ item, and defines the audit-trail format automations write to. Use before every action, in every automation and in chat.
---

# Guardrail enforcement and audit

Use before any action that reads sensitive data, drafts patient-facing content, or would change the diary, an invoice or anything else external. Load `healthcare-practice-management-foundation` first for the audit-log format, and `healthcare-practice-management-practice-policy` for the rules being enforced.

## 1. Enforce the rules (chat agent and automations both do this)

1. Before acting, check the action against the practice's `policy.never_do` list. A match is a hard stop: refuse and explain why in plain words. Do not proceed "just this once."
2. Check whether the action's kind appears in `policy.approval_required_for` (or isn't explicitly marked `"auto"` in `email_tiers`). If so, it must be routed for approval — see below — rather than executed directly.

## 2. Route for approval — this means a real tool call, not a sentence

**As the chat agent**, "this needs approval" is not itself the safeguard — the WorkQ item is. Call `todo_create` (title naming the action and who it's for, a description with the concrete content — the patient, the amount, the proposed time — and a `due_date` if relevant). This tool is always available to you regardless of what's in your declared connectors; there is no reason not to call it when something needs approval. Saying "I've sent this for approval" without having called `todo_create` first is a bug: the practitioner has nothing to actually act on.

**Inside an automation**, the equivalent is `api.workq.create(title=..., scope="org", description=..., priority=..., assignee_ids=..., labels=...)`, the same call `bookkeeping-xero`'s automations use for every approve-then-apply step.

## 3. Write the audit trail — automations only

The chat agent **cannot** write to `PracticeManager/AuditLog/` — its Knowledge tools are read-only at organisation scope (see `healthcare-practice-management-foundation`). Only an automation can log a real entry, with `api.files.put` (scope locked to `org`) appending one JSON Lines object to `PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl`:

1. After the action happens (a read, a draft, an approval, a send, a rejection, an edit, or a block) inside an automation, append one line: read the day's file first (it may not exist yet — treat that as empty), add the new JSON line, write the whole thing back. Never drop prior lines.
2. Use the exact keys from `healthcare-practice-management-foundation`'s format: `ts`, `practice_slug`, `actor`, `source`, `action`, `target`, `summary`, and `guardrails`/`workq_item_id`/`minutes_saved_estimate` when relevant. `source` names the automation (e.g. `"automation:AU-04 Reschedule request handling"`) so RP-06 can group by where an action came from.
3. Never backdate `ts` to when the triggering event happened — it's always "now," the moment the automation logged it.

**Until a domain automation exists to do this (step 2 onward), nothing gets written to the audit log at all.** If asked in chat what the agent has done this session, answer from the conversation itself — don't claim it's recorded anywhere durable, and don't read-and-report an empty or missing audit file as if that proves nothing happened; it only proves nothing has been automated yet.

Example: a future automation sends a reschedule offer. Policy requires approval for `patient_facing_email` → it calls `api.workq.create` instead of `reply_to_email` directly, appends an `action: "drafted"` audit line now, and appends a second `action: "sent"` line only after the WorkQ approval triggers the actual send. In today's chat-only equivalent, the agent calls `todo_create` for the approval item and is explicit that no audit line gets written anywhere.

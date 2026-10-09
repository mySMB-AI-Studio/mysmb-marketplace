---
name: healthcare-practice-management-foundation
description: The Knowledge folder layout, per-practice settings, commitment memory and audit-trail formats every Practice Manager Agent skill and automation reads or writes. Load this before any other healthcare-practice-management skill.
---

# Practice Manager foundation

Use when you are about to read or write practice settings, policy rules, open commitments or the audit trail for the Practice Manager Agent. Load this skill first, before `healthcare-practice-management-practice-policy`, `-commitment-memory` or `-guardrail-audit`, and before any automation that touches these files.

This extension keeps no database of its own. Everything it remembers lives in Knowledge (`workspace:knowledge` — `api.files.read` / `api.files.write` / `api.files.list`), one JSON (or JSON-lines) file per practice, the same per-client-state-file pattern `bookkeeping-xero` uses for its clients.

## Folder layout

```
PracticeManager/Practices/<practice-slug>.json       one file per practice this workspace manages
PracticeManager/Commitments/<practice-slug>.json      open loops for that practice (SK-12)
PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl   one line per guardrail-checked action, append-only (SK-13)
```

`<practice-slug>` is a short kebab-case id for the practice (e.g. `samantha-bake-clinic`). Most workspaces manage exactly one practice; the per-practice-file pattern still applies so the same automations work unchanged if a second site (a locum, or a clinic-owned Cliniko account) is added later.

## `PracticeManager/Practices/<practice-slug>.json`

```json
{
  "slug": "samantha-bake-clinic",
  "name": "Samantha Bake Clinic",
  "cliniko_business_id": "",
  "email_provider": "gmail",
  "xero_tenant_id": "",
  "timezone": "Australia/Sydney",
  "policy": {
    "cancellation_window_hours": 24,
    "tone": "warm, concise, no jargon",
    "email_tiers": [
      { "key": "clinical", "label": "Reschedules, cancellations, results", "mode": "approve" },
      { "key": "patient_query", "label": "Patient queries", "mode": "approve" },
      { "key": "industry", "label": "Industry news and newsletters", "mode": "auto" }
    ],
    "payer_addressing": "parent_or_guardian_when_patient_is_a_child",
    "approval_required_for": ["patient_facing_email", "diary_change", "invoice_status_change"],
    "never_do": [
      "give clinical advice, diagnosis or interpretation",
      "threaten fees or legal action on an overdue account",
      "mark a Cliniko invoice as paid or closed (the API is read-only for invoices)",
      "store a card or bank account number"
    ]
  },
  "digest_recipient_ids": [],
  "reviewer_id": ""
}
```

Read it with `api.files.read(file="PracticeManager/Practices/" + slug + ".json")`, parsed as JSON; treat a missing file as "this practice is not set up yet" and say so rather than guessing defaults. Every Cliniko, email or Xero call for a practice uses the connector and tenant implied by this file (`xero_tenant_id` passed as the `xero_tenant_id` argument on every `xero-accounting` call, matching the `bookkeeping-xero` convention). See `healthcare-practice-management-practice-policy` for how to apply the `policy` block.

## `PracticeManager/Commitments/<practice-slug>.json`

A JSON array, one object per open or resolved loop:

```json
[
  {
    "id": "6f1a0c2e-...",
    "type": "reschedule_offer",
    "patient_name": "Jo Chen",
    "description": "Offered Tue 14 Oct 9:00am and 11:00am after her cancellation",
    "created_at": "2026-10-09T08:15:00+11:00",
    "due_date": "2026-10-11",
    "status": "open",
    "source": { "kind": "email", "id": "AAMk..." },
    "resolved_at": null
  }
]
```

`type` is one of `payment_promise`, `reschedule_offer`, `result_pending_review`, `practitioner_action`. See `healthcare-practice-management-commitment-memory` for how to read, add and resolve entries.

## `PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl`

Append-only, one JSON object per line (JSON Lines, not a JSON array — never read-modify-write the whole file):

```json
{"ts":"2026-10-09T08:16:03+11:00","practice_slug":"samantha-bake-clinic","actor":"agent","source":"automation:AU-04 Reschedule request handling","action":"drafted","target":{"kind":"email","id":"AAMk..."},"summary":"Drafted a reschedule offer to Jo Chen for the cancelled Tue appointment","guardrails":[{"rule":"patient_facing_requires_approval","result":"pass","detail":"routed to WorkQ for approval before send"}],"workq_item_id":"123","minutes_saved_estimate":5}
```

Required keys: `ts` (ISO 8601, practice timezone), `practice_slug`, `actor` (`"agent"` or a workspace user id), `source` (`"automation:<name>"`, `"agent-chat"` or `"skill:<id>"`), `action` (`read`, `drafted`, `approved`, `sent`, `rejected`, `edited`, `blocked`), `target` (`{kind, id}`), `summary` (one plain sentence). Optional: `guardrails` (array of `{rule, result: pass|block|warn, detail}`), `workq_item_id`, `minutes_saved_estimate`. See `healthcare-practice-management-guardrail-audit` for when to write an entry; this format is the data source RP-06 (Agent activity and approvals log) reads later — don't change the key names without updating that report too.

## Rules that apply everywhere

- Never invent a `practice-slug`. If a conversation or automation run doesn't say which practice, and the workspace manages only one, read its single file; if more than one exists and it's ambiguous, ask.
- Never write patient-identifying detail into the audit log beyond a name already visible in Cliniko or the email thread — no clinical content, no account numbers.
- `Knowledge` folders nest at most two levels deep (the same limit `bookkeeping-xero` works around). `PracticeManager/AuditLog/` is already at that limit, which is exactly why the audit file is named `<slug>-<date>.jsonl` rather than nested under a per-practice subfolder — don't add `AuditLog/<slug>/` as a folder, it will fail.

---
name: healthcare-practice-management-foundation
description: The Knowledge folder layout, per-practice settings, commitment memory and audit-trail formats the Practice Manager Agent reads and its automations write. Load this before any other healthcare-practice-management skill.
---

# Practice Manager foundation

Use when you are about to read practice settings, policy rules, open commitments or the audit trail for the Practice Manager Agent. Load this skill first, before `healthcare-practice-management-practice-policy`, `-commitment-memory` or `-guardrail-audit`.

## You read Knowledge. You do not write it. This is a platform limit, not a style choice.

The chat agent's only Knowledge tools are `knowledge_read` and `knowledge_list`. Both accept `scope: "org"`, and at `org` scope they are **read-only** — there is no `knowledge_upload`/`knowledge_create_folder` path that can ever reach organisation-level storage from a chat agent; those write tools are hard-locked to a private scope tied to your own agent identity, invisible to every human and to every automation. Writing `PracticeManager/*` files for real only happens inside this extension's **automations** (`api.files.put`, which is locked to `org` scope by the automation's own configuration) — starting with **Healthcare Practice Management: Apply practice setup**, which creates `PracticeManager/Practices/<slug>.json` when the Practice setup form is submitted.

Practically: if a file described below doesn't exist yet, tell the practitioner to run **Healthcare Practice Management: Start practice setup** (it creates a WorkQ item with the Practice setup form attached) rather than attempting to create the file yourself.

## Folder layout

```
PracticeManager/Practices/<practice-slug>.json       one file per practice this workspace manages
PracticeManager/Commitments/<practice-slug>.json      open loops for that practice (SK-12)
PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl   one line per guardrail-checked action, append-only (SK-13)
```

`<practice-slug>` is a short kebab-case id for the practice (e.g. `samantha-bake-clinic`). Most workspaces manage exactly one practice; the per-practice-file pattern still applies so the same design works unchanged if a second site (a locum, or a clinic-owned Cliniko account) is added later.

**How to read any of these as the agent:** `knowledge_read` takes the scope, the folder and the filename separately — it is not one combined path string. For `PracticeManager/Practices/mysmbcom.json` call `knowledge_read(scope="org", path="PracticeManager/Practices", fileName="mysmbcom.json")`. Use `knowledge_list(scope="org", path="PracticeManager/Practices")` to see what practices exist at all. A missing file or a "not found" result means that practice genuinely has no settings yet — say so, don't guess defaults.

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

Created and updated only by the **Apply practice setup** automation, from the Practice setup form. Every Cliniko, email or Xero call for a practice uses the connector and tenant implied by this file (`xero_tenant_id` passed as the `xero_tenant_id` argument on every `xero-accounting` call, matching the `bookkeeping-xero` convention). See `healthcare-practice-management-practice-policy` for how to apply the `policy` block.

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

`type` is one of `payment_promise`, `reschedule_offer`, `result_pending_review`, `practitioner_action`. This file is created empty by **Apply practice setup** and from then on is written only by whichever automation performs the real action that creates the loop (e.g. a future reschedule-handling automation writes its own `reschedule_offer` entry when it sends an offer). See `healthcare-practice-management-commitment-memory` for how the agent reads it, and what to do instead when asked to track something in chat with no automation behind it yet.

## `PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl`

Append-only, one JSON object per line (JSON Lines, not a JSON array):

```json
{"ts":"2026-10-09T08:16:03+11:00","practice_slug":"samantha-bake-clinic","actor":"agent","source":"automation:AU-04 Reschedule request handling","action":"drafted","target":{"kind":"email","id":"AAMk..."},"summary":"Drafted a reschedule offer to Jo Chen for the cancelled Tue appointment","guardrails":[{"rule":"patient_facing_requires_approval","result":"pass","detail":"routed to WorkQ for approval before send"}],"workq_item_id":"123","minutes_saved_estimate":5}
```

Required keys: `ts` (ISO 8601, practice timezone), `practice_slug`, `actor` (`"agent"` or a workspace user id), `source` (`"automation:<name>"` — chat has no writer yet, see below), `action` (`read`, `drafted`, `approved`, `sent`, `rejected`, `edited`, `blocked`), `target` (`{kind, id}`), `summary` (one plain sentence). Optional: `guardrails` (array of `{rule, result: pass|block|warn, detail}`), `workq_item_id`, `minutes_saved_estimate`. This format is the data source RP-06 (Agent activity and approvals log) reads later — any automation that writes a line follows these exact keys. **No automation writes to this file yet** (none exist before step 2) and **the chat agent never writes to it** (it can't, per the platform limit above) — until a domain automation ships, this file may not exist at all for a practice, and that's expected, not a bug.

## Rules that apply everywhere

- Never invent a `practice-slug`. If a conversation doesn't say which practice, and the workspace manages only one, read its single file; if more than one exists and it's ambiguous, ask.
- Never surface patient-identifying detail from the audit log beyond a name already visible in Cliniko or the email thread — no clinical content, no account numbers.
- `Knowledge` folders nest at most two levels deep (the same limit `bookkeeping-xero` works around). `PracticeManager/AuditLog/` is already at that limit, which is exactly why the audit file is named `<slug>-<date>.jsonl` rather than nested under a per-practice subfolder — never attempt `AuditLog/<slug>/` as a folder.
- If the practitioner asks you to remember something or follow up later, and no automation already owns that action, create a real WorkQ item with `todo_create` (see `healthcare-practice-management-guardrail-audit`) instead of claiming you've recorded it in Commitments or the audit log — those files are not yours to write.

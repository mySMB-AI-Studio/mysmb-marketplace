---
name: healthcare-practice-management-practice-data-qa
description: Answers plain-language questions over Cliniko, Xero and email, with sources, e.g. "who hasn't paid this month?" or "when did I last see Jo?". Use for any direct chat question, and as the basis for every report (SK-18 narrates the result).
---

# Practice data Q&A

Use when the practitioner asks a plain-language question in chat rather than triggering an automation.

1. Work out which systems the question touches: a scheduling question needs `cliniko-scheduling`, a billing question needs `cliniko-billing` and/or `xero-accounting`, a clinical-history question needs `cliniko-clinical` (summarise only, per `healthcare-practice-management-clinical-summarisation` — never answer "what's wrong with Jo" with an interpretation).
2. Resolve any named patient with `healthcare-practice-management-patient-payer-resolution` before querying their records.
3. Query the real tools for the answer — never answer from memory of an earlier conversation turn if the data could have changed since. A "who hasn't paid this month" question re-runs `list_invoices` / `get_aged_receivables_by_contact`, it doesn't reuse a number from an hour ago.
4. State the answer plainly, with its source (which system, and roughly when the data was read) so the practitioner can tell a live answer from a stale one.
5. If the question needs data this extension doesn't have access to (a system not connected, a field the Cliniko API doesn't expose), say so directly rather than approximating.

Guardrails: this skill answers questions, it never takes an action (no draft, no diary change, no send) — if the practitioner's question implies an action ("reschedule Jo to Thursday"), hand off to the relevant automation/skill instead of doing it inline.

Example: "Who hasn't paid this month?" → `get_aged_receivables_by_contact`, filtered to invoices raised this month. Answer: "3 unpaid invoices raised this month: [list], based on Xero as of just now."

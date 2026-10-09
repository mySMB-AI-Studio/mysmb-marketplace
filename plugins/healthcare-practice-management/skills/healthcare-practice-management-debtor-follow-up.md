---
name: healthcare-practice-management-debtor-follow-up
description: Ranks overdue accounts and drafts courteous, payer-addressed follow-ups that escalate step by step, never threatening or adding fees. Use for AU-08 (slow payer follow-up).
---

# Debtor follow-up

Use weekly to find overdue accounts and draft the next follow-up step for each.

1. Pull aged receivables with `get_aged_receivables_by_contact` (Xero) and cross-check against Cliniko's `list_invoices` for context (what the invoice was for, which patient).
2. **Scope check before anything else:** a Xero organisation can carry receivables that have nothing to do with this practice's patients — a different business line, a bookkeeping client sharing the same connection, a supplier credit. Resolve every Xero AR row to a real Cliniko patient or payer with `healthcare-practice-management-patient-payer-resolution`, either by invoice number matching one of Cliniko's own invoices or by the contact name matching a patient or a payer on a patient's record (a parent or guardian may be the payer, not the patient). A row that resolves to neither is a different book entirely — leave it alone. Don't draft a follow-up to it, don't log it as an overdue patient account, and don't treat "unresolved" as "keep trying" — it's out of scope, not a pending match.
3. Rank the remaining, resolved rows by days overdue, then amount — the oldest, largest balances first.
4. Decide the escalation step from how many prior follow-ups exist for this invoice (check `PracticeManager/Commitments/<practice-slug>.json` for a prior `payment_promise` or follow-up record tied to this invoice/patient — see `healthcare-practice-management-commitment-memory`): first follow-up is a gentle reminder, a second is firmer but still courteous, and so on. Never jump straight to a final-notice tone.
5. Draft with `healthcare-practice-management-practitioner-voice-drafting`, addressed to the payer. The draft states the amount and invoice reference plainly and asks for payment or a payment date — it never threatens fees, legal action, or implies consequences the practice hasn't actually set as policy.
6. If the payer replies with a payment date, record it as a `payment_promise` commitment (see `healthcare-practice-management-commitment-memory`) so the next run doesn't chase an account that's already been promised.

Guardrails: `never_do` in practice policy always wins over this skill's own escalation logic — if policy says no fee language ever, there is no escalation step that adds one.

Example: invoice INV-0030, 45 days overdue, $180, no prior follow-up on file. Draft a first, friendly reminder to the payer referencing the invoice number and amount, asking for payment or a date it can be expected.

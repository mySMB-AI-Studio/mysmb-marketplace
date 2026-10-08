---
name: healthcare-practice-management-payment-matching
description: Reconciles payments from Xero against Cliniko invoice status and flags invoices paid elsewhere that are still open in Cliniko. Use for AU-09 (reconciliation exceptions) and AU-10 (paid and ready to dispatch).
---

# Payment matching

Use to compare what Xero shows as paid against what Cliniko still shows as open — Cliniko's invoice API is read-only, so this skill never tries to close anything there.

1. List open Cliniko invoices with `list_invoices` (billing server) and their line items with `list_invoice_items` where needed.
2. List matching Xero activity: `list_payments`, `list_bank_transactions`, and `get_bank_summary` for the relevant account, plus `get_aged_receivables_by_contact` for an outstanding-by-contact view. Match on invoice number, contact name and amount — in that order of reliability.
3. An invoice Xero shows as paid (a `list_payments` entry or a reconciled bank transaction against it) but Cliniko's `get_invoice` still shows open is a reconciliation exception: list it, don't act on it. Cliniko cannot be updated from here (confirmed: no update/create/delete tool exists on invoices in the Cliniko billing server).
4. For "paid and ready to dispatch" (AU-10): an invoice confirmed paid in Xero gates the dispatch of tests or herb orders tied to that invoice — read-only alert, not an automatic dispatch action.
5. Never guess a match when the amount or contact name doesn't line up closely — list it as unmatched rather than forcing a pairing.

Guardrails: this skill only ever produces a list for a human to act on (an Alert-mode automation, per the spec) — it does not call any Xero or Cliniko write tool.

Example: Xero shows a $220 payment against invoice INV-0042 from "J Chen"; Cliniko's `list_invoices` still shows INV-0042 as unpaid for patient Jo Chen. List it under reconciliation exceptions: "INV-0042, Jo Chen, $220 — paid in Xero, still open in Cliniko. Close by hand."

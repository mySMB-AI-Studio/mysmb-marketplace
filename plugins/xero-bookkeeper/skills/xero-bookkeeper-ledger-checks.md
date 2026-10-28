---
name: xero-bookkeeper-ledger-checks
description: Run the checks catalogue over each onboarded client's Xero file and build the findings. Use in Ledger checks (scan), daily and weekly.
---

# Ledger checks for Xero

Use with `bookkeeping-xero-foundation` (client files, `Bookkeeping/Checks/<client>.json`, the checks items). Always pass the client's `xero_tenant_id`. When `clientSlug` is empty, run for every client whose file has `checks_enabled: true`.

## Daily cycle (`cycle == "daily"`)

| Check | What | Severity |
|---|---|---|
| CHK-001 Duplicate bills | Same supplier + invoice number, or same supplier + total + date within 90 days, across DRAFT/SUBMITTED/AUTHORISED | high |
| CHK-056 Changed supplier bank details | Fingerprint of each supplier contact's `BankAccountDetails` vs the saved fingerprint; a change since yesterday is a finding. Save the new fingerprint, never the number | high |
| CHK-031 Unusual rate | A line's unit amount more than `rateVariancePct` away from the supplier's last five bills for the same description | medium |
| CHK-012 Supplier ABN missing or inactive | Suppliers with bills this week and no `TaxNumber`, or an ABN the register says is cancelled | medium |

## Weekly cycle (`cycle == "weekly"`)

Everything daily, plus:

| Check | What | Severity |
|---|---|---|
| CHK-101 GST on a non-registered supplier | `INPUT` tax lines on a supplier whose ABN is not GST-registered | high |
| CHK-110 Missing attachments | AUTHORISED bills over $82.50 with no attachment in the last 30 days | low |
| CHK-120 Unreconciled bank lines | Bank statement lines older than 14 days still unreconciled | medium |
| CHK-129 Lock date | Transactions dated before the organisation's lock date created this week (heuristic; say so) | medium |
| CHK-133 Suspense balances | Non-zero balance in the client's suspense codes at week end (heuristic; say so) | medium |
| CHK-140 Overdue bills | AUTHORISED ACCPAY with `AmountDue > 0` past due date, grouped by supplier | low |

## Findings

One finding per `<CHK id>:<record ids>`: `check`, `name`, `category`, `severity`, `amount`, `text` (one line, what was found), `link` (deep link into Xero), `status: open`, `first_seen`, `last_seen`. Carry over `dismissed` and `snoozed` entries from the client's checks file; a snoozed finding is not reported until `until` passes. A finding that no longer reproduces is dropped. `clean: true` when no client has an open finding.

`summary`: per client, counts by severity and the three largest amounts at risk; this is the body of the report step and of the owner's checks item.

## Never

Change anything in Xero. Write bank account numbers anywhere. Report a heuristic check (CHK-129, CHK-133) without saying it is a heuristic.
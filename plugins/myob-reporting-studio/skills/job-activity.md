---
name: MYOB Job Activity
description: Use when the user wants only the debit/credit line(s) for ONE job AND ONE account together, within a date range. If they want every transaction on a job regardless of account, use MYOB Job Transactions instead.
---

# Job Activity

Prompt ID M56 · Reporting › Reports › Jobs › Job activity. MYOB's description: "Displays every transaction assigned to a job within the given date range for each selected account." Use `list_journal_transactions` with BOTH `job_uid` AND `account_uid` set — this report is scoped to one job AND one account at a time, unlike Job Transactions (job-only).

**Render only the matching line(s), not the whole transaction** — same technique as Categories Transactions. A line qualifies only if it independently touches both the selected account and the selected job (they don't have to be the exact same line for the transaction to be fetched, but only render lines that themselves carry both the matching `Account.UID` and `Job.UID`). Present one row per matching line: date (`DateOccurred`), journal number (`DisplayID`), description (`LineDescription`, falling back to `Description`), and the amount under Debit or Credit per `IsCredit`. Show a period debit/credit subtotal.

Validate: total debits + total credits shown reconciles to the net movement of that job+account combination for the period (debit-normal vs credit-normal per the account's classification).

## Interactivity

* Declare a required `job` input mapped to `job_uid`, and a required `category` (account) input mapped to `account_uid`, populated from `list_accounts`.
* Declare `from_date`/`to_date` with a client-side preset picker.
* `persona` input per the foundation skill.

## Sources & limitations

Tool used: `list_journal_transactions`, both filters applied client-side (no documented server-side job or nested account filter for this endpoint). **No `list_jobs` tool exists in this connector yet** — resolve the `job` input by name at generation time (a live lookup) rather than a pre-populated enum; don't invent a `list_jobs` call that doesn't exist.

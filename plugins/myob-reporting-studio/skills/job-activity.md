---
name: MYOB Job Activity
description: Use when the user wants only the debit/credit line(s) for ONE job AND ONE account together, within a date range. If they want every transaction on a job regardless of account, use MYOB Job Transactions instead.
---

# Job Activity

Prompt ID M56 · Reporting › Reports › Jobs › Job activity. MYOB's description: "Displays every transaction assigned to a job within the given date range for each selected account." Use `list_journal_transactions` with BOTH `job_uid` AND `account_uid` set — this report is scoped to one job AND one account at a time, unlike Job Transactions (job-only).

**Render only the matching line(s), not the whole transaction** — same technique as Categories Transactions. The connector's filters keep a whole transaction when ANY line matches the account and ANY line matches the job (not necessarily the same line), so filter `Lines[]` client-side: render only lines that themselves carry both the matching `Account.UID` and `Job.UID`. Present one row per matching line: date (`DateOccurred`), journal number (`DisplayID`), description (`LineDescription`, falling back to `Description`), and the amount under Debit or Credit per `IsCredit`. Show a period debit/credit subtotal.

Validate (0.01 tolerance): total debits + total credits shown reconciles to the net movement of that job+account combination for the period (debit-normal vs credit-normal per the account's classification).

## Interactivity

* Declare a required `job` `string` UID input (maxLength 36) mapped to `job_uid`. There is no `list_jobs` tool: fill its dropdown from job UIDs/names found in `list_job_register` rows or journal `Lines[].Job`, and default it to a real job UID found during generation — never `""`.
* Declare a required `category` (account) `string` UID input (maxLength 36) mapped to `account_uid`, its dropdown filled client-side from a `list_accounts` binding (excluding `IsHeader` accounts), defaulting to a real account UID.
* Declare `from_date`/`to_date` with a client-side preset picker.
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tool used: `list_journal_transactions` with `job_uid` and `account_uid` (the connector keeps a transaction when any line matches each filter), then client-side line filtering to the lines that carry both. Job choices come from `list_job_register` rows or journal lines — don't invent a `list_jobs` call that doesn't exist.

---
name: MYOB Job Transactions
description: Use when the user wants EVERY transaction that has been assigned to one job (accrual), full transaction blocks. If they want only the lines for one job AND one account, use MYOB Job Activity instead.
---

# Job Transactions (Accrual)

Prompt ID M55 · Reporting › Reports › Jobs › Job transactions (accrual). MYOB's description: "Display all transactions that have been assigned to a job." Use `list_journal_transactions` with `job_uid` set to the selected job, full `from_date`/`to_date` range, no `account_uid`.

**Job-scoped, not account-scoped.** Render one journal-entry block per matching transaction (mirrors Journal Entries' transaction-centric layout — `DisplayID`, `DateOccurred`, `Description` as the header, all of that transaction's `Lines[]` shown together in original order). The connector's `job_uid` filter keeps a transaction if ANY of its lines carries a `Job.UID` matching the selected job — once shown, display every line on that transaction, not just the job-tagged one(s). Visually mark which specific line(s) actually carry the matching `Job` reference (e.g. a badge or highlight) — the other lines on the same transaction may belong to different accounts, or no job at all; don't imply the whole transaction is job-related.

Validate, per transaction (0.01 tolerance): debit lines sum to credit lines (double-entry). Flag any transaction that doesn't balance.

## Interactivity

* Declare `from_date`/`to_date` with a client-side preset picker.
* Declare a required `job` `string` UID input (maxLength 36) mapped to `job_uid`, defaulting to a real job UID found during generation — never `""`. Fill its dropdown from job UIDs/names found in `list_job_register` rows (`Job{UID, Name}`) or journal `Lines[].Job`.
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tool used: `list_journal_transactions`, job-scoped by the connector (any line matching), with client-side marking of the job-tagged lines. **No `list_jobs` tool exists in this connector** — `GeneralLedger/Job` is a real MYOB entity but isn't wired up here. Job choices come from `list_job_register` rows or journal lines — do not invent a `list_jobs` call that doesn't exist.

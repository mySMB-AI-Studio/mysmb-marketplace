---
name: MYOB Job Transactions
description: Use when the user wants EVERY transaction that has been assigned to one job (accrual), full transaction blocks. If they want only the lines for one job AND one account, use MYOB Job Activity instead.
---

# Job Transactions (Accrual)

Prompt ID M55 · Reporting › Reports › Jobs › Job transactions (accrual). MYOB's description: "Display all transactions that have been assigned to a job." Use `list_journal_transactions` with `job_uid` set to the selected job, full `from_date`/`to_date` range, no `account_uid`.

**Job-scoped, not account-scoped.** Render one journal-entry block per matching transaction (mirrors Journal Entries' transaction-centric layout — `DisplayID`, `DateOccurred`, `Description` as the header, all of that transaction's `Lines[]` shown together in original order). A transaction qualifies if ANY of its lines carries a `Job.UID` matching the selected job — but once shown, display every line on that transaction, not just the job-tagged one(s). Visually mark which specific line(s) actually carry the matching `Job` reference (e.g. a badge or highlight) — the other lines on the same transaction may belong to different accounts, or no job at all; don't imply the whole transaction is job-related.

Validate, per transaction: debit lines sum to credit lines (double-entry). Flag any transaction that doesn't balance.

## Interactivity

* Declare `from_date`/`to_date` with a client-side preset picker.
* Declare a required `job` input mapped to `job_uid`.
* `persona` input per the foundation skill.

## Sources & limitations

Tool used: `list_journal_transactions`, job-scoped, client-side line filtering (no documented server-side job filter for this endpoint). **No `list_jobs` tool exists in this connector yet** — `GeneralLedger/Job` is a real MYOB entity but isn't wired up here. Until a `list_jobs` tool is added, populate the `job` input by resolving the name the user gives at generation time (a live lookup), not from an enum you can pre-populate — do not invent a `list_jobs` call that doesn't exist.

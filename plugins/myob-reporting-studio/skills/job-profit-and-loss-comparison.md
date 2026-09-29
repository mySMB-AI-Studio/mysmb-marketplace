---
name: MYOB Job Profit and Loss Comparison
description: Side-by-side P&L comparison across multiple jobs, from pre-aggregated monthly job register data. Use Job Profit and Loss instead for a single job.
---

# Job Profit and Loss Comparison

Prompt ID M54 · Reporting › Reports › Jobs › Job profit and loss comparison. MYOB's description: "Displays a side-by-side P&L report totalling the transactions assigned to selected jobs."

Same tool and computation as `myob-reporting-studio:job-profit-and-loss` (`list_job_register`, period filtered client-side on `Year`/`Month` because the tool has no date params, summed `Activity` per account, every row classified via `list_accounts` into `Income`, `CostOfSales`, `Expense`, `OtherIncome`, `OtherExpense`, balance-sheet accounts excluded, same sign-verification discipline) — but for multiple jobs at once, rendered as one column per job instead of a single P&L.

Bind `list_job_register` ONCE, unfiltered (no `job_uid`), and split the rows client-side by `Job.UID` — that one binding also supplies the job list. Only if the unfiltered register is too large, keep a `job_uid`-filtered binding and loop `getData` over the selected jobs (a bounded fan-out per the foundation skill). Render a table with accounts as rows and jobs as columns, plus a Net Profit/Loss row per job and, optionally, a variance column between two jobs if exactly two are selected.

**Job selection — there is no `list_jobs` tool and no multi-select input.** Job UIDs and names come from the register rows (`Job{UID, Name}`) or journal `Lines[].Job`. Offer checkboxes over the jobs found in the data (client-side selection), and persist the choice in a `jobs` `string` input of comma-separated job UIDs, parsed client-side. Disclose plainly if no job data comes back.

Validate (0.01 tolerance): each job's column ties out internally the same way a single Job Profit and Loss report would (section totals = sum of account rows, Net Profit = Income − Cost of Sales + Other Income − Expenses − Other Expenses).

## Interactivity

* Declare `jobs` as a `string` presentation input (comma-separated job UIDs; empty means "all jobs in the data") — never an enum or a multi-select, and never passed to `job_uid`.
* Declare period inputs as presentation inputs (e.g. `from_period`/`to_period` strings `YYYY-MM`, or a `financial_year` number) filtered client-side on `Year`/`Month` — not `from_date`/`to_date`; `list_job_register`'s granularity is Year/Month integers only, and `Year` may be the financial year (verify on first run).
* Declare `persona` and `company_file` per the foundation skill.
* Columns sortable/reorderable client-side over already-hydrated data.

## Sources & limitations

Tools used: `list_job_register` (monthly net movement only — no transaction-level detail), `list_accounts` for classification. No job-list tool exists; jobs come from the register rows. For a single job's own P&L, use `myob-reporting-studio:job-profit-and-loss` instead.

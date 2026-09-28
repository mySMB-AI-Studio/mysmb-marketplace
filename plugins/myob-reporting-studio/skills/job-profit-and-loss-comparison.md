---
name: MYOB Job Profit and Loss Comparison
description: Side-by-side P&L comparison across multiple jobs, from pre-aggregated monthly job register data. Use Job Profit and Loss instead for a single job.
---

# Job Profit and Loss Comparison

Prompt ID M54 · Reporting › Reports › Jobs › Job profit and loss comparison. MYOB's description: "Displays a side-by-side P&L report totalling the transactions assigned to selected jobs."

Same tool and computation as Job Profit and Loss (`list_job_register`, summed `Activity` per account across the selected months, accounts classified via `list_accounts`, same sign-verification discipline) — but for multiple jobs at once, rendered as one column per job instead of a single P&L.

Fetch `list_job_register` once per selected job (`job_uid`), or unfiltered and split client-side by `Job.UID` if the job count is small — discover which is more efficient at generation time rather than assuming. Render a table with accounts as rows and jobs as columns, plus a Net Profit/Loss row per job and, optionally, a variance column between two jobs if exactly two are selected.

**Known gap — no job picker yet:** same as Job Profit and Loss — there is no `list_jobs` tool in this connector. Resolve jobs during generation rather than assuming a multi-select dropdown source exists; disclose plainly if no resolution path is found.

Validate: each job's column ties out internally the same way a single Job Profit and Loss report would (section totals = sum of account rows, Net Profit = Income − Expense).

## Interactivity

* Declare a `jobs` input (multi-select, plural) instead of a single `job` — resolved the same live-lookup way, same disclosed limitation.
* Declare a month/financial-year range input, not `from_date`/`to_date` — `list_job_register`'s granularity is Year/Month integers only.
* Declare `persona` per the foundation skill.
* Columns sortable/reorderable client-side over already-hydrated data.

## Sources & limitations

Tool used: `list_job_register` (monthly net movement only — no transaction-level detail), `list_accounts` for classification. No job-picker tool exists yet. For a single job's own P&L, use Job Profit and Loss instead.

---
name: MYOB Job Profit and Loss
description: Use for a P&L scoped to ONE JOB — income and expenses assigned to that job. If the user wants the whole company's P&L instead, use MYOB Profit and Loss. For multiple jobs side by side, use MYOB Job Profit and Loss Comparison.
---

# Job Profit and Loss

Prompt ID M53 · Reporting › Reports › Jobs › Job profit and loss. MYOB's description: "Displays a P&L report totalling the transactions assigned to selected jobs."

Use `list_job_register` filtered to the selected job (`job_uid`). The tool returns pre-aggregated rows — one per job+account+month, with `Activity` as that month's net movement — never individual transactions. Sum `Activity` across every month in the requested period, grouped by `Account`.

The `Account` object on each row (UID, Name, DisplayID) does not itself carry a Type/Classification field. Before rendering, call `list_accounts` once to resolve each account's Type/Classification, then group into Income and Expense sections the same way Profit and Loss does — discover the real field names live rather than assuming. Compute Net Profit/Loss = Income total − Expense total. Apply the same sign-verification discipline as Profit and Loss: don't assume a classification's sign, check internal consistency, and show both as-retrieved and sign-corrected figures in Validation if a correction was applied.

**Known gap — no job picker yet:** there is no `list_jobs` tool in this connector. Resolve the job during generation (a live lookup against whatever job data is reachable) rather than assuming a dropdown source exists; flag this plainly if no resolution path is found, rather than inventing one.

Validate: section totals equal the sum of their account rows; Net Profit ties to Income − Expense exactly.

## Interactivity

* Declare a `job` input (single job) — until a `list_jobs` tool exists, resolve its options live at generation time and disclose this limitation in Sources & limitations.
* Declare a month/financial-year range input, not a `from_date`/`to_date` date-picker — `list_job_register`'s own granularity is Year/Month integers, not exact dates. Don't imply daily precision the tool doesn't have.
* Declare `persona` per the foundation skill.
* Account sections expand/collapse client-side over already-hydrated data.

## Sources & limitations

Tool used: `list_job_register` (monthly net movement per job+account only — no transaction-level detail; for that, see Job Transactions), plus `list_accounts` to resolve account classifications. No job-picker tool exists yet — this is a genuine connector gap, not a UI omission. For a side-by-side multi-job view, use Job Profit and Loss Comparison instead.

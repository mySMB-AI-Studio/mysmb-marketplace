---
name: MYOB Job Profit and Loss
description: Use for a P&L scoped to ONE JOB — income and expenses assigned to that job. If the user wants the whole company's P&L instead, use MYOB Profit and Loss. For multiple jobs side by side, use MYOB Job Profit and Loss Comparison.
---

# Job Profit and Loss

Prompt ID M53 · Reporting › Reports › Jobs › Job profit and loss. MYOB's description: "Displays a P&L report totalling the transactions assigned to selected jobs."

Use `list_job_register` filtered to the selected job (`job_uid`). The tool returns pre-aggregated rows `{ Job, Account, Year, Month, Activity, YearEndActivity }` — one per job+account+month, with `Activity` as that month's net movement — never individual transactions. It has **no date, year or month params**, so filter the period client-side on `Year`/`Month`, then sum `Activity` across every month in the period, grouped by `Account`. `Year` may be the financial year rather than the calendar year — verify on first run (compare one known month against the journal) and state which in Sources & limitations.

The `Account` object on each row (UID, Name, DisplayID) does not itself carry a Classification field. Add a `list_accounts` binding and join on `Account.UID` to classify every row into the P&L sections — `Income`, `CostOfSales`, `Expense`, `OtherIncome`, `OtherExpense` — the same way Profit and Loss does. **Exclude balance-sheet accounts** (`Asset`, `Liability`, `Equity` — e.g. debtors, bank or GST lines that happen to carry the job) from the P&L and show their excluded total in Sources & limitations. Compute Net Profit/Loss = Income − Cost of Sales + Other Income − Expenses − Other Expenses. Apply the same sign-verification discipline as Profit and Loss: don't assume a classification's sign, check internal consistency, and show both as-retrieved and sign-corrected figures in Validation if a correction was applied.

**Job picker — there is no `list_jobs` tool.** Discover job UIDs and names from `list_job_register` rows (`Job{UID, Name}`) or from journal `Lines[].Job`. Either bind an unfiltered `list_job_register` (which lists every job and lets you filter the selected job client-side — no second call), or keep a `job_uid`-filtered binding and fill the dropdown from job UIDs discovered at generation time. Flag plainly if no job data comes back at all, rather than inventing one.

Validate (0.01 tolerance): section totals equal the sum of their account rows; Net Profit ties to the section formula exactly; every register row in the period is either classified into a P&L section or listed as an excluded balance-sheet row.

## Interactivity

* Declare a `job` `string` UID input (maxLength 36) — required, defaulting to a real job UID found during generation, never `""`. Map it to `job_uid`, or use it as a client-side filter over the unfiltered register binding.
* Declare period inputs as presentation inputs, not bound to any param — e.g. `from_period`/`to_period` strings (`YYYY-MM`) or a `financial_year` number — filtered client-side on `Year`/`Month`. Not a `from_date`/`to_date` date-picker: `list_job_register`'s own granularity is Year/Month integers, not exact dates. Don't imply daily precision the tool doesn't have.
* Declare `persona` and `company_file` per the foundation skill.
* Account sections expand/collapse client-side over already-hydrated data.

## Sources & limitations

Tools used: `list_job_register` (monthly net movement per job+account only — no transaction-level detail; for that, see `myob-reporting-studio:job-transactions`), plus `list_accounts` to resolve account classifications. The period is filtered client-side. No job-list tool exists — job UIDs come from the register rows or journal lines. For a side-by-side multi-job view, use `myob-reporting-studio:job-profit-and-loss-comparison` instead.

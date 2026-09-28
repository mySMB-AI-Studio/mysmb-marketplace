---
name: MYOB Pay Item Transactions
description: All payroll transactions grouped by pay item (e.g. Base Salary, PAYG Withholding) across all employees, for a period — not grouped by employee. Use MYOB Payroll Register (which also covers MYOB's Payroll activity report) instead for an employee-first view.
---

# Pay Item Transactions

Prompt ID M30 · MYOB menu: Reporting › Reports › Payroll › Pay item transactions. MYOB's own description: "A list of all transactions grouped by pay item."

Same source and call pattern as `myob-reporting-studio:payroll-register`: `list_employees` (`is_active: true`), then `get_employee_payroll_advice` per employee with `from_date`/`to_date`. The grouping is the orthogonal cut — by pay item first, employees within each, rather than by employee first.

`get_employee_payroll_advice` requires `employee_uid`, so declare ONE advice binding whose `employee_uid` maps a `string` `employee` input (defaulting to a real employee UID found during generation — never `""`) and loop client-side over the roster with `await MyHubReport.getData(<advice binding>, { ...inputs, employee: uid })` — a bounded fan-out per the foundation skill (state the cap, show progress, say so if it's hit). MYOB ignores the dates, but the connector filters advices by pay-period overlap with the range itself, so each call returns every advice in range for that employee. Pool every `Lines[]` entry from every employee's advices, then group by `PayrollCategory.Name`.

Render one section per distinct `PayrollCategory.Name` (e.g. "Base Salary", "PAYG Withholding", "Superannuation Guarantee") — under each, one row per employee who has a line for that category in range, with the amount and the pay date/period it belongs to. Show a per-pay-item total, and a grand total across all pay items.

Validate (0.01 tolerance): the grand total across all pay-item sections reconciles to the sum of all individual lines pooled at the start — construction-guaranteed, so a mismatch signals a real bug, not a data quirk. If any employee's call failed, list them as "not loaded" and mark the completeness check N/A.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker.
* Declare the `employee` `string` UID input (maxLength 36) used by the loop — no enum.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive see per-pay-item totals only; Bookkeeper/Practitioner see the employee-level rows under each pay item.
* Pay-item sections collapsible/expandable client-side once hydrated — no new data call for this.

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` per active employee (bounded client-side loop; the connector applies the date range by pay-period overlap), pooled and grouped client-side by pay item. Snapshots keep only the bundle data, so looped employees aren't in a downloaded or shared snapshot — say so in snapshot mode.

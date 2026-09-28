---
name: MYOB Payroll Summary
description: Company-wide totals for salary and wages, taxes, deductions, leave, and expenses across all active employees for a period.
---

# Payroll Summary

Prompt ID M20 · MYOB menu: Reporting › Reports › Payroll › Payroll summary. MYOB's own description: "A summary displaying total values for salary and wages, taxes, deductions, leave, and expenses."

Bind `list_employees` (`is_active: true`) for the roster. `get_employee_payroll_advice` requires `employee_uid`, so declare ONE advice binding whose `employee_uid` maps a `string` `employee` input (defaulting to a real employee UID found during generation — never `""`), plus `from_date`/`to_date`, and call it once per active employee in a client-side loop with `await MyHubReport.getData(<advice binding>, { ...inputs, employee: uid })` — a bounded fan-out per the foundation skill (small N for an SMB; state the cap, show progress, say so if it's hit). MYOB ignores the dates, but the connector filters advices by pay-period overlap with the range itself, so each call returns every advice in range: sum every wage/deduction/tax/expense line by `PayrollCategory` type, across all returned advices, across all employees, into one company-wide total per category.

Render one number per category, company-wide: total wages, total tax, total deductions, total leave accrued (from entitlement-type lines' `Hours`/`YearToDate`), total expenses.

Validate (0.01 tolerance): the sum of all per-employee category totals (before company-wide collapse) reconciles to the rendered company-wide totals — this is a construction-guaranteed tie-out, so a mismatch would indicate a real aggregation bug, not a data-quality issue. If any employee's call failed, name them as "not loaded" and mark the totals' completeness check N/A — never present a partial total as complete.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this pay period, this quarter, FY to date).
* Declare the `employee` `string` UID input (maxLength 36) used by the loop — no enum.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive show only the company-wide totals; Bookkeeper/Practitioner also show the per-employee breakdown feeding those totals (`detail-block`).

## Sources & limitations

Tools used: `list_employees` (is_active=true) for the roster; `get_employee_payroll_advice` called once per active employee (bounded client-side loop; the connector applies the date range by pay-period overlap), aggregated client-side. No employer-side payroll tax (state-based) figure is included unless it surfaces as its own `PayrollCategory` line — don't invent one if absent. Snapshots keep only the bundle data, so looped employees aren't in a downloaded or shared snapshot — say so in snapshot mode.

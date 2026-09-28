---
name: MYOB Payroll Summary
description: Company-wide totals for salary and wages, taxes, deductions, leave, and expenses across all active employees for a period.
---

# Payroll Summary

Prompt ID M20 · MYOB menu: Reporting › Reports › Payroll › Payroll summary. MYOB's own description: "A summary displaying total values for salary and wages, taxes, deductions, leave, and expenses."

Call `list_employees` (`is_active: true`) to get the employee roster. Then call `get_employee_payroll_advice` once per active employee (bounded, small N for an SMB — the same acceptable per-entity-call pattern already used for per-contact aged reports elsewhere in this library), passing `from_date`/`to_date` for the selected period.

**Critical unconfirmed point — resolve live, not from docs:** whether `from_date`/`to_date` actually filter `get_employee_payroll_advice` to multiple pay periods, or whether MYOB ignores them and this endpoint always returns just the employee's single most recent advice, is NOT confirmed by MYOB's documentation. You cannot resolve this by reading docs further — only by a live call. During generation, call it once for one employee and inspect the shape:
- **If the response is (or contains) multiple advices spanning the requested range:** aggregate properly — sum every wage/deduction/tax/expense line by `PayrollCategory` type, across all returned advices, across all employees, into one company-wide total per category.
- **If it only ever returns the one most recent advice regardless of the date range requested:** disclose plainly, in the header and in Sources & limitations, that this report can currently only show the latest pay period per employee, not a true date-range aggregate — do not silently mislabel a single-period snapshot as a period total.

Render one number per category, company-wide: total wages, total tax, total deductions, total leave accrued (from entitlement-type lines' `Hours`/`YearToDate`), total expenses.

Validate: the sum of all per-employee category totals (before company-wide collapse) reconciles to the rendered company-wide totals — this is a construction-guaranteed tie-out, so a mismatch would indicate a real aggregation bug, not a data-quality issue.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this pay period, this quarter, YTD).
* Declare `persona` per the foundation skill — Client/Executive show only the company-wide totals; Bookkeeper/Practitioner also show the per-employee breakdown feeding those totals (`detail-block`).

## Sources & limitations

Tools used: `list_employees` (is_active=true) for the roster; `get_employee_payroll_advice` called once per active employee, aggregated client-side. State clearly whether the date-range aggregation above resolved to the multi-advice or single-latest-advice branch for this generation. No employer-side payroll tax (state-based) figure is included unless it surfaces as its own `PayrollCategory` line — don't invent one if absent.

---
name: MYOB Payroll Register
description: Per-employee payroll for a period. Declares a detail_level toggle — Summary shows category totals (wages, tax, deductions, leave, expenses) per employee; Detail adds every individual pay-item line underneath each employee.
---

# Payroll Register

Prompt ID M21/M22 (merged) · MYOB menu: Reporting › Reports › Payroll › Payroll register / Payroll activity.

Bind `list_employees` (`is_active: true`) for the roster. `get_employee_payroll_advice` requires `employee_uid`, so declare ONE advice binding whose `employee_uid` maps a `string` `employee` input (defaulting to a real employee UID found during generation — never `""`), plus `from_date`/`to_date`, and loop client-side over the employees in scope with `await MyHubReport.getData(<advice binding>, { ...inputs, employee: uid })` — a bounded fan-out per the foundation skill (state the cap, show progress, say so if it's hit). MYOB ignores the dates, but the connector filters advices by pay-period overlap with the range itself, so each call returns every advice in range; sum each employee's wage/deduction/tax/expense/leave lines by `PayrollCategory` type across their advices.

**Always render**, regardless of `detail_level`: one row per employee — name (`Employee` header), and one column per category (wages, tax, deductions, leave accrued, expenses), category totals only. Add a grand-total row across all employees shown.

**When `detail_level` is "Detail", additionally render** one section per employee (name, pay period dates) with a table listing every individual `Lines[]` entry: `PayrollCategory.Name`, the line's amount, and `YearToDate` where present. Group entitlement-type lines (leave accrual) separately from wage/deduction/expense/tax lines, since they represent a different kind of figure (accrued hours, not a dollar payment).

Validate (0.01 tolerance): the grand-total row ties to the sum of the individual employee category-total rows above it — construction-guaranteed, so a mismatch signals a real bug. In Detail mode, each employee's line-item sum must also reconcile to that same employee's category totals shown in the Summary section — built from identical source data, must agree by construction. An employee whose call failed is listed as "not loaded" and makes the grand-total completeness check N/A, never Pass.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker.
* Declare the `employee` `string` UID input (maxLength 36) used by the loop. The scope picker is a client-side dropdown filled from `list_employees` (all active employees, or one) — no enum, no multi-select; "all" loops over every roster UID.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — a presentation input, NOT the same as `persona`. Both versions call the identical tools and do the identical per-employee aggregation; `detail_level` only controls how far the breakdown is shown (category totals vs. every individual line), not whether extra data gets fetched.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive show the grand-total row only (and, in Detail mode, category subtotals per employee rather than individual lines); Bookkeeper/Practitioner show every employee row (and, in Detail mode, every line).

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` per employee in scope (bounded client-side loop; the connector applies the date range by pay-period overlap), aggregated client-side. Snapshots keep only the bundle data, so looped employees aren't in a downloaded or shared snapshot — say so in snapshot mode.

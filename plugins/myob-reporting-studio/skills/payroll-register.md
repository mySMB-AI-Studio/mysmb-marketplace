---
name: MYOB Payroll Register
description: Per-employee payroll for a period. Declares a detail_level toggle — Summary shows category totals (wages, tax, deductions, leave, expenses) per employee; Detail adds every individual pay-item line underneath each employee.
---

# Payroll Register

Prompt ID M21/M22 (merged) · MYOB menu: Reporting › Reports › Payroll › Payroll register / Payroll activity.

Call `list_employees` (`is_active: true`) for the roster — or the selected subset if the `employee` input is set. Then call `get_employee_payroll_advice` once per employee in scope, passing `from_date`/`to_date`.

**Critical unconfirmed point — resolve live, not from docs:** whether `from_date`/`to_date` actually filter `get_employee_payroll_advice` to multiple pay periods, or whether MYOB ignores them and this endpoint always returns just the employee's single most recent advice, is NOT confirmed by MYOB's documentation. Resolve this live: call it once for one employee and inspect the shape.
- **If multiple advices are returned across the range:** sum each employee's wage/deduction/tax/expense/leave lines by `PayrollCategory` type across their advices in range.
- **If only the single most recent advice is ever returned:** disclose plainly that this report shows only the latest pay period per employee, not a true period aggregate — say so in the header, not just a footnote.

**Always render**, regardless of `detail_level`: one row per employee — name (`Employee` header), and one column per category (wages, tax, deductions, leave accrued, expenses), category totals only. Add a grand-total row across all employees shown.

**When `detail_level` is "Detail", additionally render** one section per employee (name, pay period dates) with a table listing every individual `Lines[]` entry: `PayrollCategory.Name`, the line's amount, and `YearToDate` where present. Group entitlement-type lines (leave accrual) separately from wage/deduction/expense/tax lines, since they represent a different kind of figure (accrued hours, not a dollar payment).

Validate: the grand-total row ties to the sum of the individual employee category-total rows above it — construction-guaranteed, so a mismatch signals a real bug. In Detail mode, each employee's line-item sum must also reconcile to that same employee's category totals shown in the Summary section — built from identical source data, must agree by construction.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker.
* Declare an optional `employee` enum input (multi-select or "all") populated from `list_employees`, defaulting to all active employees.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — this is NOT the same as `persona`. Both versions call the identical tools and do the identical per-employee aggregation; `detail_level` only controls how far the breakdown is shown (category totals vs. every individual line), not whether extra data gets fetched.
* Declare `persona` per the foundation skill — Client/Executive show the grand-total row only (and, in Detail mode, category subtotals per employee rather than individual lines); Bookkeeper/Practitioner show every employee row (and, in Detail mode, every line).

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` per employee in scope, aggregated client-side. State clearly whether this generation resolved the date-range aggregation to the multi-advice or single-latest-advice branch.

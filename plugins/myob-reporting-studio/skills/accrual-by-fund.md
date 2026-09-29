---
name: MYOB Accrual by Fund
description: Superannuation accrued per fund across all employees. Declares a detail_level toggle — Summary shows fund-level totals only; Detail adds the per-employee breakdown within each fund.
---

# Accrual by Fund

Prompt ID M25/M26 (merged) · Reporting › Reports › Payroll › Accrual by fund / Accrual by fund (detail).

`get_employee_payroll_advice` requires `employee_uid`, so this is a fan-out report. Bind `list_employees` (`is_active: true`) and ONE `get_employee_payroll_advice` binding whose `employee_uid` maps a `string` `employee` input (defaulting to a real employee UID found during generation — never `""`), plus `from_date`/`to_date`. On load, loop client-side over the employee rows with `await MyHubReport.getData(<advice binding>, { ...inputs, employee: uid })` — a bounded fan-out per the foundation skill (state the cap, show progress, and say so if the cap is hit). MYOB ignores the dates, but the connector filters advices by pay-period overlap with `from_date`/`to_date` itself, so each call returns every advice in range for that employee.

Each advice's header carries a `SuperannuationFund` reference (`UID`, `Name`) — **this is HEADER-LEVEL only, one fund per advice; there is no per-line fund identifier**, only the `PayrollCategory` object on each line. For each advice, take the header fund plus that advice's superannuation-category line total (sum the `Lines[]` entries whose `PayrollCategory` is a superannuation type), then group by fund.

**Always render the Summary section**, regardless of `detail_level`: group-sum across all employees by fund (multiple employees can share the same fund, combine them) — one row per fund: fund name, total super accrued across all employees for the period, employee count contributing to it.

**When `detail_level` is "Detail", additionally render the per-employee breakdown**: within each fund group, show one row per employee — name, super accrued this period, YTD if available on the superannuation-category line — plus a fund subtotal per group and a grand total across all funds (the fund subtotal must equal the Summary section's total for that fund, 0.01 tolerance).

If an employee's call fails (an error or `__error` result), list that employee as "not loaded" and mark the fund totals' completeness check N/A — never treat the missing employee as $0.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `get_employee_payroll_advice`'s date params.
* Declare the `employee` `string` UID input (maxLength 36) used by the fan-out loop. To scope the report to one person, fill a dropdown from `list_employees` and loop over just that UID — no enum, no multi-select.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — a presentation input.
* Declare a `fund` `string` presentation input (the fund UID, or empty for all) — a client-side filter over already-hydrated data, its dropdown filled from the `SuperannuationFund` values found in the advices; no binding, no enum. Most useful in Detail mode.
* Declare `persona` and `company_file` per the foundation skill — the per-employee rows within each fund group (Detail mode) are a `detail-block`, hidden for Client/Executive regardless of `detail_level`; fund subtotals and grand total stay visible.

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` (one call per employee, bounded client-side loop; the connector applies the date range by pay-period overlap). Fund grouping uses the header-level `SuperannuationFund` only — never inferred or invented per-line. Snapshots keep only the bundle data, so a downloaded or shared snapshot won't include the looped employees — say so in snapshot mode.

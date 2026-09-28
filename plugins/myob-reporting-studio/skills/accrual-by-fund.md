---
name: MYOB Accrual by Fund
description: Superannuation accrued per fund across all employees. Declares a detail_level toggle — Summary shows fund-level totals only; Detail adds the per-employee breakdown within each fund.
---

# Accrual by Fund

Prompt ID M25/M26 (merged) · Reporting › Reports › Payroll › Accrual by fund / Accrual by fund (detail).

Call `list_employees` (`is_active: true`), then `get_employee_payroll_advice` once per employee for the selected range. Each advice's header carries a `SuperannuationFund` reference (`UID`, `Name`) — **this is HEADER-LEVEL only, one fund per advice; there is no per-line fund identifier**, only the `PayrollCategory` object on each line. For each employee's advice, take the header fund plus that advice's superannuation-category line total (sum the `Lines[]` entries whose `PayrollCategory` is a superannuation type), then group by fund.

**Always render the Summary section**, regardless of `detail_level`: group-sum across all employees by fund (multiple employees can share the same fund, combine them) — one row per fund: fund name, total super accrued across all employees for the period, employee count contributing to it.

**When `detail_level` is "Detail", additionally render the per-employee breakdown**: within each fund group, show one row per employee — name, super accrued this period, YTD if available on the superannuation-category line — plus a fund subtotal per group and a grand total across all funds (the fund subtotal must equal the Summary section's total for that fund).

**Unconfirmed by MYOB's docs — resolve live before trusting the date range:** whether `from_date`/`to_date` actually filter `get_employee_payroll_advice` to multiple pay periods, or whether MYOB always returns just the employee's most recent advice regardless of range. During generation, call it once for a sample employee across a range spanning multiple known pay periods and check whether more than one period's data comes back. If only the latest advice is returned regardless of range, disclose this plainly and scope the report to "most recent pay period" rather than silently claiming date-range coverage it doesn't have.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `get_employee_payroll_advice`'s date params.
* Declare `detail_level` (enum: Summary / Detail, default Summary).
* Declare a `fund` optional enum input (client-side filter over already-hydrated data, no new binding) to isolate one fund — most useful in Detail mode.
* Declare `persona` per the foundation skill — the per-employee rows within each fund group (Detail mode) are a `detail-block`, hidden for Client/Executive regardless of `detail_level`; fund subtotals and grand total stay visible.

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` (one call per employee). Fund grouping uses the header-level `SuperannuationFund` only — never inferred or invented per-line. State the resolved date-range behavior (see above) explicitly.

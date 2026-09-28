---
name: MYOB Leave Balance
description: Leave/entitlement hours per employee. Declares a detail_level toggle — Summary shows the current accrued/YTD snapshot per employee per entitlement type; Detail adds a running, period-by-period progression across the selected date range.
---

# Leave Balance

Prompt ID M28/M29 (merged) · Reporting › Reports › Payroll › Leave balance / Leave balance (detail).

Call `list_employees` (`is_active: true`) to get the employee roster, then `get_employee_payroll_advice` once per employee for the selected range. Each advice's `Lines[]` includes entitlement-type entries with `Hours` (accrued/paid hours) and `YearToDate`, and `PayrollCategory.Name` naming the specific entitlement (e.g. "Holiday leave Accrual") — do not assume only "Annual Leave"/"Personal Leave" exist; discover the real entitlement names live per company file.

**Always render the Summary section**, regardless of `detail_level`: group each employee's entitlement lines by `PayrollCategory.Name` and present one row per employee per entitlement type — accrued hours, YTD hours, from the latest advice in range.

**When `detail_level` is "Detail", additionally render the running progression**: if the live-discovery check below confirms multiple pay periods come back for a date range, render each employee's entitlement lines in date order, one row per pay period, with a running accrued-hours total carried forward period to period. If only the latest advice is returned regardless of range, this report cannot show a real running progression — disclose that plainly and state the "running" aspect isn't achievable from what the connector returns today, falling back to showing just the Summary section.

**Honest gap — disclose plainly, don't fabricate:** the confirmed fields give accrued hours and a YTD figure, but there is no separately-confirmed field for "hours taken" as distinct from "hours accrued." If a live discovery call doesn't turn up a clear taken-vs-accrued distinction, say so and show only accrued + YTD — never derive a "taken" number by subtraction without evidence that's the correct interpretation.

**Unconfirmed by MYOB's docs — resolve live before trusting the date range:** whether `from_date`/`to_date` actually filter `get_employee_payroll_advice` to multiple pay periods, or whether MYOB always returns just the employee's most recent advice regardless of the range given. During generation, call it once for a sample employee across a range spanning multiple known pay periods and check whether more than one period's data comes back. If only the latest advice is returned regardless of range, disclose this plainly and scope the report to "most recent pay period" rather than silently claiming date-range coverage it doesn't have — this also determines whether Detail mode's running progression is even possible (see above).

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `get_employee_payroll_advice`'s date params.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — gates whether the running per-period progression is rendered; the underlying data fetch (one `get_employee_payroll_advice` call per employee) happens either way, since Summary already needs the latest advice.
* Declare `employee` as an optional enum input (mapped to `employee_uid`) to scope to one person.
* Declare `persona` per the foundation skill — Client/Executive show only accrued/YTD totals; Bookkeeper/Practitioner show the full per-employee breakdown, and the Detail-mode running table is itself a `detail-block`, hidden for Client/Executive regardless of `detail_level`.

## Sources & limitations

Tools used: `list_employees` (is_active=true), `get_employee_payroll_advice` (one call per employee). State the resolved date-range behavior (see above), which branch (real running progression vs. Summary-only fallback) Detail mode is running in, and the "hours taken" gap, explicitly.

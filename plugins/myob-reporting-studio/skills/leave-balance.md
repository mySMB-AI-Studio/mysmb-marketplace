---
name: MYOB Leave Balance
description: Leave/entitlement hours per employee. Declares a detail_level toggle — Summary shows the current accrued/YTD snapshot per employee per entitlement type; Detail adds a running, period-by-period progression across the selected date range.
---

# Leave Balance

Prompt ID M28/M29 (merged) · Reporting › Reports › Payroll › Leave balance / Leave balance (detail).

`get_employee_payroll_advice` requires `employee_uid`, so this is a fan-out report. Bind `list_employees` (`is_active: true`) for the roster and ONE `get_employee_payroll_advice` binding whose `employee_uid` maps a `string` `employee` input (defaulting to a real employee UID found during generation — never `""`), plus `from_date`/`to_date`. On load, loop client-side over the roster with `await MyHubReport.getData(<advice binding>, { ...inputs, employee: uid })` — a bounded fan-out per the foundation skill (state the cap, show progress, say so if the cap is hit). MYOB ignores the dates, but the connector filters advices by pay-period overlap with the range itself, so each call returns every advice in range for that employee.

Each advice's `Lines[]` includes entitlement-type entries with `Hours` (accrued/paid hours) and `YearToDate`, and `PayrollCategory.Name` naming the specific entitlement (e.g. "Holiday leave Accrual") — do not assume only "Annual Leave"/"Personal Leave" exist; discover the real entitlement names live per company file.

**Always render the Summary section**, regardless of `detail_level`: group each employee's entitlement lines by `PayrollCategory.Name` and present one row per employee per entitlement type — accrued hours, YTD hours, from the latest advice in range.

**When `detail_level` is "Detail", additionally render the running progression**: each employee's entitlement lines in pay-date order, one row per pay period in range, with a running accrued-hours total carried forward period to period.

**Honest gap — disclose plainly, don't fabricate:** the confirmed fields give accrued hours and a YTD figure, but there is no separately-confirmed field for "hours taken" as distinct from "hours accrued." If a live discovery call doesn't turn up a clear taken-vs-accrued distinction, say so and show only accrued + YTD — never derive a "taken" number by subtraction without evidence that's the correct interpretation.

If an employee's call fails (an error or `__error` result), list that employee as "not loaded" rather than showing zero hours.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to `get_employee_payroll_advice`'s date params.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — a presentation input that gates whether the running per-period progression is rendered; the underlying fan-out happens either way, since Summary already needs the latest advice.
* Declare the `employee` `string` UID input (maxLength 36) used by the loop. To scope to one person, fill a dropdown from `list_employees` and loop over just that UID — no enum.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive show only accrued/YTD totals; Bookkeeper/Practitioner show the full per-employee breakdown, and the Detail-mode running table is itself a `detail-block`, hidden for Client/Executive regardless of `detail_level`.

## Sources & limitations

Tools used: `list_employees` (is_active=true), `get_employee_payroll_advice` (one call per employee, bounded client-side loop; the connector applies the date range by pay-period overlap). State the "hours taken" gap explicitly. Snapshots keep only the bundle data, so looped employees aren't in a downloaded or shared snapshot — say so in snapshot mode.

---
name: MYOB Timesheets
description: Employee timesheets — logged hours per week, optionally tagged with a job, activity, or customer. Not the same thing as payroll advice hours (paid amounts) — this is logged time entries.
---

# Timesheets

Prompt ID M24 · Reporting › Reports › Payroll › Timesheets. MYOB's description: "Timesheets for each of your employees."

**Replaces the earlier disclosure-only version of this skill** — `list_timesheets` now exists (added once the `sme-timebilling` OAuth scope was confirmed working).

Use `list_timesheets` with `from_date`/`to_date`, optionally scoped to one `employee_uid`. Each timesheet has a `StartDate`/`EndDate` (the week), and `Lines[]` with a `PayrollCategory`, optional `Job`/`Activity`/`Customer` tags, `Notes`, and `Entries[]` (`Date`, `Hours`, `Processed`).

Present one section per employee, then one row per week (`StartDate`–`EndDate`), with each line's total hours and any Job/Activity/Customer tag shown alongside. Expand to daily `Entries[]` detail (date, hours, processed y/n) as a `detail-block`.

**Do not conflate this with payroll advice hours** (`get_employee_payroll_advice`'s entitlement lines) — those are paid/accrued amounts on a payslip; this is logged time against a week, which may or may not match what was ultimately paid. Never cross-reference the two as if interchangeable.

Validate: sum of `Entries[].Hours` per line should equal any week-level hours total the data independently exposes, if one exists — discover this live during generation rather than assuming a specific total field name.

## Interactivity

* Declare `from_date`/`to_date` with a client-side preset picker (this month, last quarter).
* Declare an optional `employee` `string` UID input (maxLength 36), a presentation filter: bind `list_timesheets` without `employee_uid` (all employees) and filter client-side, filling the dropdown from `list_employees` or the employees in the returned timesheets. Never pass `""`.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive show weekly totals only; Bookkeeper/Practitioner show daily entry detail.

## Sources & limitations

Tool used: `list_timesheets`. Date-range params are sent to MYOB and also re-applied client-side (on `Entries[].Date`), since MYOB ignores identically-named date params on the sibling payroll-advice endpoint (the connector filters those itself) — don't assume this one's server-side filtering works until confirmed live.

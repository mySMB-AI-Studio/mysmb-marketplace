---
name: payroll-summarize
description: Assembles the headline review-pack figures: totals, comparison to the last run, and timesheet/hours checks.
---

# Assemble the payroll review pack

Only reached once readiness is confirmed clean. Call the payroll summary capability, which covers three checks in one call:

1. **Payroll processing** — the pay run's period, payment date, employee count, and totals (wages, tax, super, net pay), plus the percentage change vs the last Posted run.
2. **Timesheet approval check** — whether every employee's timesheet for the period is approved and the hours on it match what's on their payslip (`allApproved`). An employee can be flagged for not being approved, having a variance, or both at once — report both, don't collapse them into one vague status.
3. **Hours reconciliation** — whether the approved-timesheet count matches the payroll count (`allMatched`), broken out by earnings rate.

Write the headline summary in plain numbers — the actual wages/tax/super/net pay figures, the actual percentage change, and the actual count of any timesheet issues — not a qualitative "looks good." If `allApproved` or `allMatched` is false, name which employees and what the discrepancy is, since the reviewer needs that to make their decision, not just a flag.

Report your outputs: the totals, the vs-last-run comparison, whether timesheets are all approved, whether hours all match, and the period/payment-date text for display.

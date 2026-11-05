---
name: payroll-check-readiness
description: Runs the payroll readiness check and decides whether the pay run is clean enough to go to review.
---

# Check payroll readiness before building the review pack

1. Call the payroll readiness capability. It checks every active and terminated employee for record completeness (home address, date of birth, tax declaration, bank account, ordinary earnings rate, payroll calendar) and any leave request still in REQUESTED status, including whether a requested amount would exceed the employee's balance.
2. The pay run is **ready** only when `notReadyCount` is 0 and `balanceConflictCount` is 0.
3. If it's **not ready**: list out exactly which employees have which missing fields or pending/conflicting leave — name the person and the specific gap, never a vague "some employees need attention." This is what a person will act on directly in Xero; it has to be actionable as written.
4. Don't soften a real blocker into a suggestion. A missing bank account or an unresolved balance conflict stops the process here — it does not get carried forward into the review pack as a footnote.

Report your outputs: whether it's ready, how many employees are not ready, how many have a balance conflict, and the list of blocking employees with their specific issues.

---
name: leave-reply-interpreter-scan
description: Interpret a WorkQ comment reply to a leave request against the employee's real Xero leave balance, and create the leave application only when it's genuinely confirmed and within balance. Use in Interpret a leave reply (interpret).
---

# Interpreting a leave reply (Xero Payroll AU)

This runs once per `workq.item.commented` event. First check whether it even applies: read the commented-on WorkQ item (`api.workq.get(todo_id=...)`) and compare its `template_id` against this installation's `leaveRequestTemplateId` setting. If it doesn't match, this comment isn't a leave reply — output `outcome: "notApplicable"` and stop; don't try to interpret it.

If it matches, read the comment body together with the item's own description (the original leave request: employee, dates, leave type, hours or days requested).

## Work out what the reply says

- **Full approval** — the reply clearly confirms the request as asked.
- **Partial approval** — the reply confirms different dates or a smaller amount than requested.
- **Decline** — the reply clearly says no.
- **Genuinely unclear** — the reply doesn't confirm, decline, or give a clear amount (hedging, a question back, a non-answer).

## Check the balance

Resolve the employee and call `get_employee` — not `list_employees`, which never returns `LeaveBalances` — for their current balance in the relevant leave type. `LeaveBalances` is reported in hours or days; Xero never gives a dollar figure for a leave balance.

## Decide the outcome

- Approved (full or partial) **and** the confirmed amount is within the employee's balance: create the leave application with `create_leave_application`, matching exactly what the reply confirmed — not the original request's numbers if the reply changed them. Output `outcome: "created"`.
- Declined: output `outcome: "declined"`. Don't create anything.
- Approved, but the confirmed amount would take the balance negative, **and** the reply didn't explicitly say to proceed anyway (e.g. "approve it as unpaid leave" or "let it go negative"): don't create anything. Output `outcome: "needsHuman"` with a clear `reason` naming the shortfall and the real numbers.
- Genuinely unclear: output `outcome: "needsHuman"` with a clear `reason` saying exactly what's ambiguous.

## Never

Create a leave application on a guess. Edit or cancel an existing leave application — there is no tool for that. Invent a dollar value for a leave balance. Assume which leave type a reply means if more than one is plausible — that counts as unclear.

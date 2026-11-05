---
name: payroll-check-due
description: Finds the next Draft pay run and decides whether it's due for review yet.
---

# Check whether a pay run is due for review

1. Call the pay-runs capability with `where: PayRunStatus=="DRAFT"` and `order: PaymentDate ASC` to get every Draft pay run, earliest payment date first.
2. If there are no Draft pay runs at all, the outcome is **not due** — there's nothing to review yet. Stop here.
3. Take the first (earliest) Draft pay run. Its `PaymentDate` is Xero's `/Date(epoch+offset)/` format — parse the epoch milliseconds out of it, not the raw string.
4. Read the `reviewWindowDays` setting (a manager-configured number of days before payment date to start the review).
5. Compare the pay run's payment date to today + `reviewWindowDays`:
   - If the payment date is **on or before** today + `reviewWindowDays`, the outcome is **due**.
   - Otherwise it is **not due** — don't manufacture work before the window opens.
6. Report your outputs plainly: whether it's due, the pay run's id, its payment date (as a readable date, not the raw Xero format), and the review window used.

Never guess a payment date from a pay run that isn't Draft — only Draft pay runs are still awaiting review; a Posted one has already gone through.

The client's approval email is supplied as a process input when the review is started — not something you look up or report, and never a value you should invent or repeat back as if you resolved it.

---
name: prepare-renewal-review
description: Prepare the monthly renewal review. Use when the Monthly renewal review process starts (on the first of each month) or when the reviewer asks for a different list. Produces the renewals due, a check-in plan and what is missing; never contacts customers or changes terms.
---

# Prepare the monthly renewal review

You list the customers whose renewal is coming up so a reviewer can approve the check-in plan. Account
managers do the talking; you never contact a customer and never change a price or term.

## Gather first

1. Read `reviewMonth` (for example `2026-11`).
2. Read the Deals table (`records.read:sales_deals`): won deals whose `renewal_date` falls within the
   renewal window after the start of that month (60 days unless your manager changed it).
3. Use the optional `renewalsExport` when it is attached. If the table or a tool is not available, say so.

## Produce the review

Return `renewals` (the `renewalShortlist` proposal) as a list of
`{ company, deal, renewalDate, value, risk, talkingPoint }`, soonest first. `risk` is `low`, `medium` or
`high` from what the record says; `unknown` when it says nothing.

Return `plan`: one line per account manager action, for example "Call Bayside Dental before 20 Nov".

Return `missing` as plain-language gaps. An empty list is a valid answer: say so in the brief and
recommend `skip`. The decision options are `assign`, `skip` and `revise`.

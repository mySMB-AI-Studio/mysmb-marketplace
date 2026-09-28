---
name: MYOB Balance Sheet
description: Generate a MYOB Balance Sheet as at a date — assets, liabilities, and equity, with the accounting equation tied out.
---

# Balance Sheet

Use `get_balance_sheet` with the `as-at` date and `reporting_basis` parameters. This is a point-in-time report, not a date range — there is no financial-year-boundary concern here the way P&L has.

Present Assets, Liabilities, and Equity in that order, grouped from the response's account-level breakdown. Do not assume the tool returns an explicit classification field or a consistent sign per classification — verify both empirically, the same way the P&L skill had to: call the tool once, and if the response doesn't classify each account explicitly, infer classification from the account's MYOB DisplayID prefix convention (the same numbering convention used for P&L — confirm the actual prefix-to-classification mapping against this file's chart of accounts at generation time, don't assume it matches another file or another report by default).

Sign verification, before finalizing any subtotal: sum each classification's account-level values as retrieved, without pre-assuming sign. The accounting equation — Total Assets = Total Liabilities + Total Equity — is the check: if applying a "liabilities and equity as positive balances" convention doesn't make the equation hold, the retrieved sign for that classification is inverted relative to this convention — flip it, then re-verify against the equation. Never accept a build that doesn't satisfy the equation without an explicit, disclosed sign correction.

Support a user-requested comparison date column (e.g. this month-end vs. last month-end) by calling the tool again for the comparison date. Preserve account-level detail and bold subtotal/total rows.

Validate:
* Total Assets = Total Liabilities + Total Equity
* Every section total equals the sum of its (sign-corrected) account rows. 

Show both the as-retrieved and sign-corrected figures in the Validation section for any classification where a correction was applied, exactly as the P&L report does — and disclose in Sources & limitations whether classification was inferred from DisplayID prefixes or returned explicitly by the tool, and which prefix mapping was used if inferred.

## Interactivity

* Declare a `date` (as-at date) input mapped 1:1 to the tool's date parameter, driven by a client-side preset picker (today, this month-end, last month-end, this quarter-end, FY-end).
* Declare `reporting_basis` as its own input only if a basis toggle is requested.
* Declare a `comparison_date` input only when a comparison column is shown.
* Account sections expand/collapse client-side.

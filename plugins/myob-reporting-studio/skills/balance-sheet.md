---
name: MYOB Balance Sheet
description: Generate a MYOB Balance Sheet as at a date — assets, liabilities, and equity, with the accounting equation tied out.
---

# Balance Sheet

Use `get_balance_sheet` with its `date` parameter (required — the as-at date; it is not called `as_of_date`) and `reporting_basis` (`Accrual` | `Cash`). This is a point-in-time report, not a date range — there is no financial-year-boundary concern here the way P&L has.

Present Assets, Liabilities, and Equity in that order, grouped from the response's account-level breakdown. Do not assume the tool returns an explicit classification field or a consistent sign per classification — verify both empirically: call the tool once, and if the response doesn't classify each account explicitly, add a `list_accounts` binding and join on `Account.UID` to take each account's `Classification` (`Asset`, `Liability`, `Equity`). Only if an account can't be matched that way, fall back to the file's DisplayID prefix convention (confirm the actual prefix-to-classification mapping against this file's chart of accounts at generation time, don't assume it matches another file). Exclude any `IsHeader` account from sums.

Sign verification, before finalizing any subtotal: sum each classification's account-level values as retrieved, without pre-assuming sign. The accounting equation — Total Assets = Total Liabilities + Total Equity — is the check: if applying a "liabilities and equity as positive balances" convention doesn't make the equation hold, the retrieved sign for that classification is inverted relative to this convention — flip it, then re-verify against the equation. Never accept a build that doesn't satisfy the equation without an explicit, disclosed sign correction.

Support a user-requested comparison date column (e.g. this month-end vs. last month-end) with a second balance-sheet binding for the comparison date. Preserve account-level detail and bold subtotal/total rows.

Validate (0.01 tolerance):
* Total Assets = Total Liabilities + Total Equity
* Every section total equals the sum of its (sign-corrected) account rows.
* If the balance sheet source failed or returned no accounts, the checks are N/A, not Pass.

Show both the as-retrieved and sign-corrected figures in the Validation section for any classification where a correction was applied, exactly as the P&L report does — and disclose in Sources & limitations whether classification came from the tool, from `list_accounts`, or from DisplayID prefixes (and which prefix mapping was used if so).

## Interactivity

* Declare a `date` (as-at date) input mapped 1:1 to the tool's `date` parameter, driven by a client-side preset picker (today, this month-end, last month-end, this quarter-end, FY-end).
* Declare `basis` (enum `Accrual` / `Cash`, default `Accrual`) mapped to `reporting_basis`.
* Declare a `comparison_date` input only when a comparison column is shown.
* Declare `company_file` per the foundation skill.
* Account sections expand/collapse client-side.

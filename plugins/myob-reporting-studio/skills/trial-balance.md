---
name: MYOB Trial Balance
description: Generate a MYOB Trial Balance — every account's current balance, debits and credits, tying to zero.
---

# Trial Balance

Use `list_accounts` (filter to `is_active: true` unless told otherwise — inactive accounts are typically excluded from a trial balance). There is no as-of-date parameter on this tool. This report can only reflect current account balances, not a specific past date. If asked for a trial balance "as at [past date]," say plainly that the connected data source doesn't support that and this report will show current balances instead — don't silently substitute one for the other.

Discover the actual field shape before assuming anything. Call the tool once and confirm: which field holds each account's balance (don't assume a specific field name — verify it), whether MYOB flags header/summary accounts that shouldn't be included in totals (commonly a boolean field marking a grouping account rather than a postable one — exclude these from the trial balance body and totals if present), and what account-type values actually appear (cross-check against the classification/DisplayID-prefix convention already established in `myob-report-foundation` and used in Balance Sheet).

Sign verification, same discipline as Balance Sheet: a trial balance's defining property is that total debits equal total credits (equivalently, signed balances sum to zero once debit-normal types are positive and credit-normal types are negative, or vice versa). Don't assume which sign convention the retrieved balances use — test both, and use whichever one actually makes debits equal credits. If neither does, say so plainly rather than forcing a false balance, exactly as the Balance Sheet skill does when the accounting equation doesn't resolve.

Present one row per account: account ID, name, type, and the balance split into a Debit column and a Credit column (never a single signed number — that's what makes it recognizable as a trial balance). Group by account type in the standard order (Asset, Liability, Equity, Income, Cost of Sales, Expense) with subtotals per group.

Validate:
* Total Debits = Total Credits

Show the actual computed totals and Pass/Fail, not just an assertion. Disclose in Sources & limitations whether balance/header-account/type fields were discovered as expected or required a fallback assumption, and restate clearly that this reflects current balances only, not a historical as-of date.

## Interactivity

* Declare a `type` filter as an optional input (`Asset`/`Liability`/`Equity`/`Income`/`Cost of Sales`/`Expense`) mapped to the tool's type parameter, for viewing one classification at a time. 
* Table is sortable by account ID, name, or balance, and filterable by name/ID, per the shared foundation skill's rules. 
* No date input — see the limitation above.

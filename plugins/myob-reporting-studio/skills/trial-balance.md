---
name: MYOB Trial Balance
description: Generate a MYOB Trial Balance — every account's current balance, debits and credits, tying to zero.
---

# Trial Balance

Use `list_accounts` (filter to `is_active: true` unless told otherwise — inactive accounts are typically excluded from a trial balance). There is no trial-balance tool and no as-of-date parameter on this one. This report can only reflect current account balances, not a specific past date. If asked for a trial balance "as at [past date]," say plainly that the connected data source doesn't support that and this report will show current balances instead — don't silently substitute one for the other.

The row shape is known: `UID`, `DisplayID`, `Name`, `Type`, `Classification`, `IsHeader`, `CurrentBalance`. Exclude every `IsHeader: true` account (a grouping account, not a postable one) from the body and totals. Call the tool once during generation to confirm the balances look as expected before writing render code.

**Current Year Earnings may double count.** MYOB's current-year-earnings equity account is a computed roll-up of the P&L accounts' balances. If it carries a non-zero `CurrentBalance`, including it alongside the Income/Expense accounts can count the same profit twice. Verify on the live data: if debits equal credits only when that account is excluded (or its balance equals the net of the P&L accounts), exclude it and disclose that in Sources & limitations; otherwise keep it.

Sign verification, same discipline as Balance Sheet: a trial balance's defining property is that total debits equal total credits (equivalently, signed balances sum to zero once debit-normal classifications are positive and credit-normal classifications are negative, or vice versa). Don't assume which sign convention the retrieved balances use — test both, and use whichever one actually makes debits equal credits. If neither does, say so plainly rather than forcing a false balance, exactly as the Balance Sheet skill does when the accounting equation doesn't resolve.

Present one row per account: account ID, name, type, and the balance split into a Debit column and a Credit column (never a single signed number — that's what makes it recognizable as a trial balance). Group by `Classification` in the standard order — `Asset`, `Liability`, `Equity`, `Income`, `CostOfSales`, `Expense`, `OtherIncome`, `OtherExpense` (display labels may add spaces, e.g. "Cost of Sales") — with subtotals per group.

Validate (0.01 tolerance):
* Total Debits = Total Credits
* If `list_accounts` failed or returned no postable accounts, the check is N/A — an empty trial balance never "balances" to a Pass.

Show the actual computed totals and Pass/Fail, not just an assertion. Disclose in Sources & limitations how the sign convention and the current-year-earnings question were resolved, and restate clearly that this reflects current balances only, not a historical as-of date.

## Interactivity

* Declare a `classification` presentation input (enum: `All`, `Asset`, `Liability`, `Equity`, `Income`, `CostOfSales`, `Expense`, `OtherIncome`, `OtherExpense`; default `All`) that filters the displayed rows client-side. The binding always fetches every account so the Debits = Credits check always runs on the full set.
* Declare `persona` and `company_file` per the foundation skill.
* Table is sortable by account ID, name, or balance, and filterable by name/ID, per the shared foundation skill's rules.
* No date input — see the limitation above.

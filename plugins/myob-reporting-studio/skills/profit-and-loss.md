---
name: MYOB Profit and Loss
description: Generate a MYOB Profit and Loss report — trading income through net profit, with tie-outs.
---

# Profit and Loss

Use `get_profit_and_loss` only when the range is fixed at authoring and stays within one Australian financial year (1 July – 30 June). Whenever the reader can change the range, or the range may cross 1 July (FY-to-date against last FY, rolling 12 months, custom ranges), bind `get_profit_and_loss_3m` instead — MYOB's report doesn't span the financial-year boundary natively, and this variant auto-splits the range at 1 July and merges the two `AccountsBreakdown` results for you. Never implement that splitting/merging yourself in the report's JavaScript. Both tools require `from_date` and `to_date` and take `reporting_basis` (`Accrual` | `Cash`).

The response is `AccountsBreakdown[{ Account{UID, Name, DisplayID}, AccountTotal }]` only — it carries **no section totals and no classification**. Add a `list_accounts` binding and join each row on `Account.UID` to get its `Classification`, then sum each classification yourself:

* `Income` → Trading Income
* `CostOfSales` → Cost of Sales
* `OtherIncome` → Other Income
* `Expense` → Operating Expenses
* `OtherExpense` → Other Expenses

A breakdown row that matches no `list_accounts` row, or matches a balance-sheet classification, goes in a visible "Unclassified" row and makes the classification check Fail — never drop it silently.

Present Trading Income, Cost of Sales (if any accounts are classified into it), Gross Profit, Other Income, Operating Expenses, Other Expenses, and Net Profit in that order. Support user-requested previous-period or prior-year comparison columns and variance amounts/percentages with a second P&L binding for the comparison period (also `get_profit_and_loss_3m` when it may cross 1 July). Preserve account-level detail and bold subtotal/total rows.

Do not assume the sign of any classification's totals. MYOB may return Income, Cost of Sales, or Expense classifications as positive or negative depending on account normal balance — verify empirically, don't hardcode a flip. Before finalizing any subtotal:
* Sum each classification's account-level values as retrieved, without pre-assuming a sign.
* Check internal consistency: Gross Profit (Income − Cost of Sales) must not exceed Total Income when Cost of Sales is non-zero; Net Profit (Gross Profit + Other Income − Expenses − Other Expenses) must not exceed Gross Profit when Expenses is non-zero and Other Income is zero. If applying the "subtract as a positive deduction" convention produces a result that's larger than the figure it was deducted from, that classification's retrieved sign is inverted relative to this convention — flip it, then re-verify.
* The tool returns no totals of its own, so the completeness check below is the primary check: every `AccountTotal` must land in exactly one section.

Validate (0.01 tolerance):
* Gross Profit = Trading Income − Cost of Sales
* Net Profit = Gross Profit + Other Income − Operating Expenses − Other Expenses
* Every section total equals the sum of its (sign-corrected) account rows.
* Every `AccountsBreakdown` row is classified exactly once (sum of all `AccountTotal` = sum of the section totals as retrieved). If the P&L or `list_accounts` source failed, these checks are N/A, not Pass.

Show both the as-retrieved classification totals and the sign-corrected figures actually used in the Validation section — if a sign correction was ever applied, say so explicitly and name the classification, so a real anomaly is visible rather than silently masked.

## Interactivity

* Declare `from_date` and `to_date` (date) inputs mapped 1:1 to the tool's `from_date`/`to_date` parameters, driven by a client-side preset picker (this month, last quarter, FY to date — the picker computes both dates and calls `getData` with the declared names). A relative default such as FY to date is computed client-side on load per the foundation skill.
* Declare `basis` (enum `Accrual` / `Cash`, default `Accrual`) mapped to `reporting_basis`.
* Declare `company_file` per the foundation skill.
* Account sections expand/collapse client-side.

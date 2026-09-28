---
name: MYOB Profit and Loss
description: Generate a MYOB Profit and Loss report — trading income through net profit, with tie-outs.
---

# Profit and Loss

Use `get_profit_and_loss` for date ranges that stay within one Australian financial year. Use `get_profit_and_loss_3m` instead whenever the requested range crosses 1 July — MYOB's report tool doesn't span the financial-year boundary natively, and this variant auto-splits the range and merges the two `AccountsBreakdown` results for you. Never implement that splitting/merging yourself in the report's JavaScript; picking the right tool at generation time is enough.

Present Trading Income, Cost of Sales (if any accounts are classified into it), Gross Profit, Other Income, Operating Expenses, and Net Profit in that order, grouped from the `AccountsBreakdown` array's account classifications — discover the actual classification field and values by calling the tool once before assuming a shape. Support user-requested previous-period or prior-year comparison columns and variance amounts/percentages by calling the tool again for the comparison period. Preserve account-level detail and bold subtotal/total rows.

Do not assume the sign of any classification's totals. MYOB may return Income, Cost of Sales, or Expense classifications as positive or negative depending on account normal balance — verify empirically, don't hardcode a flip. Before finalizing any subtotal:
* Sum each classification's account-level values as retrieved, without pre-assuming a sign.
* Check internal consistency: Gross Profit (Income − Cost of Sales) must not exceed Total Income when Cost of Sales is non-zero; Net Profit (Gross Profit + Other Income − Expenses) must not exceed Gross Profit when Expenses is non-zero and Other Income is zero. If applying the "subtract as a positive deduction" convention produces a result that's larger than the figure it was deducted from, that classification's retrieved sign is inverted relative to this convention — flip it, then re-verify.
* If the API response includes its own top-line total separate from `AccountsBreakdown`, tie out against that as the primary check rather than relying on internal-consistency alone.

Validate:
* Gross Profit = Trading Income − Cost of Sales
* Net Profit = Gross Profit + Other Income − Operating Expenses
* Every section total equals the sum of its (sign-corrected) account rows. 

Show both the as-retrieved classification totals and the sign-corrected figures actually used in the Validation section — if a sign correction was ever applied, say so explicitly and name the classification, so a real anomaly is visible rather than silently masked.

## Interactivity

* Declare `from_date` and `to_date` (date) inputs mapped 1:1 to the tool's `StartDate`/`EndDate` parameters, driven by a client-side preset picker (this month, last quarter, YTD — the picker computes both dates and calls `getData` with the declared names).
* Declare `reporting_basis` as its own input only if a basis toggle is requested — the tool accepts `Accrual` or `Cash`.
* Account sections expand/collapse client-side.

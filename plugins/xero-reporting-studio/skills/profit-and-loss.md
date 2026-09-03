# Profit and Loss

Use `get_profit_and_loss` and `get_organisation_financial_year`.

Present Trading Income, Cost of Sales, Gross Profit, Other Income, Operating Expenses, and Net Profit in that order. Support user-requested previous-period or prior-year comparison columns and variance amounts/percentages. Preserve account detail and bold subtotal/total rows.

Validate Gross Profit = Trading Income - Cost of Sales, Net Profit = Gross Profit + Other Income - Operating Expenses, and every section total equals its account rows.
## Interactivity

Declare `period` (enum presets), `comparison` (enum: none, prior_period, prior_year) and, where the tool supports it, `basis` (enum: accrual, cash) inputs; period/comparison/basis changes re-query. Account sections expand/collapse client-side; the comparison column renders only when hydrated.

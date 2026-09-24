# Profit and Loss

Use `get_profit_and_loss`. For financial-year boundaries, use `get_organisation` (`FinancialYearEndDay`/`FinancialYearEndMonth` fields) — there is no separate financial-year tool.

Present Trading Income, Cost of Sales, Gross Profit, Other Income, Operating Expenses, and Net Profit in that order. For user-requested comparisons: use `get_profit_and_loss`'s own `periods`/`timeframe` params for adjacent-period comparison in one call; for prior-year comparison against a custom range, make a second call with `fromDate`/`toDate` shifted back a year. Show variance amounts/percentages. Preserve account detail and bold subtotal/total rows.

Validate Gross Profit = Trading Income − Cost of Sales, Net Profit = Gross Profit + Other Income − Operating Expenses, and every section total equals its account rows.